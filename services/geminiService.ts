
import { GoogleGenAI } from "@google/genai";
import { 
  getBreakdownyWorkerPrompt, 
  getBreakdownySysPrompt,
  getBreakdownAlignerSysPrompt, 
  getBreakdownBasePrompt
} from '../prompts/breakPlot';
import { 
  getScriptSysPrompt, 
  getScriptBasePrompt, 
  getScriptWorkerPrompt,
  getWebtoonAlignerPrompt 
} from '../prompts/adaptScript';
import { NovelChapter, PlotPoint, LogEntry, LLMConfig } from '../types';

// --- Generic LLM Implementation ---

const cleanText = (text: string | undefined) => text || "";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// OpenAI/Standard Compatible Stream Handler
async function streamOpenAICompatible(
  config: LLMConfig,
  prompt: string,
  systemInstruction: string,
  onChunk: (text: string) => void
): Promise<string> {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: messages,
        stream: true,
        temperature: 0.7
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split("\n");
      // Keep the last line in buffer if it's incomplete
      buffer = lines.pop() || ""; 

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            console.warn("Failed to parse SSE line", line);
          }
        }
      }
    }
    return fullText;

  } catch (error: any) {
    throw error;
  }
}

// Gemini Stream Handler
async function streamGemini(
  config: LLMConfig,
  prompt: string,
  systemInstruction: string,
  onChunk: (text: string) => void
): Promise<string> {
  const options: any = { apiKey: config.apiKey };
  if (config.baseUrl) {
    options.baseUrl = config.baseUrl;
  }
  const ai = new GoogleGenAI(options);
  
  // Handle model name mapping if needed, or trust user input
  // Default to gemini-2.5-flash if generic name given, but usually use config.modelName
  const modelName = config.modelName || 'gemini-2.5-flash';

  const responseStream = await ai.models.generateContentStream({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction
    }
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    const text = chunk.text || "";
    if (text) {
      fullText += text;
      onChunk(text);
    }
  }
  return fullText;
}

// Unified Streaming Function
async function generateStreamWithRetry(
  config: LLMConfig,
  prompt: string,
  systemInstruction: string,
  agentName: string,
  onUpdate?: (msg: string) => void,
  onChunk?: (text: string) => void,
  checkStop?: () => boolean
): Promise<string> {
  let attempt = 0;
  const MAX_API_RETRIES = 3;

  while (true) {
    if (checkStop && checkStop()) throw new Error("USER_ABORT");

    try {
      // Dispatch based on provider
      if (config.provider === 'gemini') {
        return await streamGemini(config, prompt, systemInstruction, onChunk || (() => {}));
      } else {
        return await streamOpenAICompatible(config, prompt, systemInstruction, onChunk || (() => {}));
      }
    } catch (e: any) {
      if (checkStop && checkStop()) throw new Error("USER_ABORT");
      
      const errMsg = e.toString().toLowerCase();

      // Retry Logic
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit')) {
         onUpdate?.(`⚠️ ${config.provider} Rate Limit. Pausing 60s...`);
         if (onChunk) onChunk(`\n[System] Rate Limit encountered. Pausing 60s...\n`);
         
         for (let i = 0; i < 60; i++) {
             if (checkStop && checkStop()) throw new Error("USER_ABORT");
             await delay(1000);
         }
         onUpdate?.(`${agentName}: Resuming...`);
         continue; 
      }

      // Fatal Auth Errors
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('invalid api key')) {
         throw new Error(`FATAL AUTH ERROR (${config.provider}): ${e.message}`);
      }

      // Server Errors
      if (attempt < MAX_API_RETRIES) {
         attempt++;
         const waitTime = attempt * 3000;
         onUpdate?.(`⚠️ Error (${e.message}). Retrying in ${waitTime/1000}s...`);
         if (onChunk) onChunk(`\n[System] API Error: ${e.message}. Retrying...\n`);
         await delay(waitTime);
         continue;
      }

      throw e;
    }
  }
}

interface AgentLoopResult {
  content: string;
  status: 'PASS' | 'FAIL';
  report: string;
  logs: LogEntry[];
  isApiError?: boolean;
}

// Helper: Agent Execution Loop
async function agentLoop(
  config: LLMConfig,
  workerName: string,
  alignerName: string,
  workerSystemPrompt: string,
  alignerSystemPrompt: string,
  workerTaskPrompt: string,
  alignerContextPrompt: (output: string) => string,
  maxRetries = 3,
  onProgress?: (status: string) => void,
  onStreamChunk?: (text: string) => void, // Callback for streaming text
  checkStop?: () => boolean
): Promise<AgentLoopResult> {
  
  let currentOutput = "";
  let feedback = "";
  let retries = 0;
  const logs: LogEntry[] = [];

  while (retries < maxRetries) {
    const currentAttempt = retries + 1;
    if (checkStop && checkStop()) throw new Error("USER_ABORT");

    // 1. Worker Step
    onProgress?.(retries === 0 ? `${workerName}: Generating...` : `${workerName}: Refining (Attempt ${currentAttempt})...`);
    
    // Add header to stream
    onStreamChunk?.(`\n\n══════════════════════════════════════\n[Attempt ${currentAttempt}/${maxRetries}] ${workerName} Working...\n══════════════════════════════════════\n\n`);

    let fullWorkerPrompt = workerTaskPrompt;
    if (feedback) {
      fullWorkerPrompt += `\n\n[Previous Output]\n${currentOutput}\n\n[Previous Feedback - Please Fix]\n${feedback}`;
    }

    logs.push({
        timestamp: Date.now(),
        role: 'user',
        agentName: workerName,
        content: fullWorkerPrompt,
        sysPrompt: workerSystemPrompt,
        attempt: currentAttempt
    });

    try {
      // STREAMING CALL FOR WORKER
      currentOutput = await generateStreamWithRetry(
        config, 
        fullWorkerPrompt, 
        workerSystemPrompt, 
        workerName,
        onProgress,
        onStreamChunk, // Pass streaming callback here
        checkStop
      );
      
      logs.push({
          timestamp: Date.now(),
          role: 'model',
          agentName: workerName,
          content: currentOutput,
          sysPrompt:"",
          attempt: currentAttempt
      });

    } catch (e: any) {
      if (e.message === 'USER_ABORT') throw e;
      const errorMsg = `API ERROR in Worker: ${e.message || e}`;
      onStreamChunk?.(`\n\n❌ ${errorMsg}\n`);
      logs.push({ timestamp: Date.now(), role: 'system', agentName: 'System', content: errorMsg, attempt: currentAttempt });
      return { content: currentOutput, status: 'FAIL', report: errorMsg, logs, isApiError: true };
    }

    if (checkStop && checkStop()) throw new Error("USER_ABORT");

    // 2. Aligner Step 
    onProgress?.(`${alignerName}: Checking quality...`);
    const alignerPrompt = alignerContextPrompt(currentOutput);
    
    // Add header to stream
    onStreamChunk?.(`\n\n--------------------------------------\n>>> [Aligner Check] ${alignerName} Verifying...\n--------------------------------------\n\n`);

    logs.push({  
        timestamp: Date.now(),
        role: 'user',
        agentName: alignerName,
        content: alignerPrompt,
        sysPrompt: alignerSystemPrompt,
        attempt: currentAttempt
    });

    try {
      // STREAMING CALL FOR ALIGNER (Now Enabled)
      const report = await generateStreamWithRetry(
        config,
        alignerPrompt,
        alignerSystemPrompt,
        alignerName,
        onProgress,
        onStreamChunk, // Stream aligner output to console too
        checkStop
      );

      logs.push({
          timestamp: Date.now(),
          role: 'model',
          agentName: alignerName,
          content: report,
          attempt: currentAttempt
      });

      if (report.includes("PASS")) {
        onStreamChunk?.(`\n\n✅ CHECK PASSED\n`);
        return { content: currentOutput, status: 'PASS', report, logs };
      } else {
        onStreamChunk?.(`\n\n⚠️ CHECK FAILED. Preparing retry...\n`);
        feedback = report;
        retries++;
      }
    } catch (e: any) {
       if (e.message === 'USER_ABORT') throw e;
       const errorMsg = `API ERROR in Aligner: ${e.message || e}`;
       onStreamChunk?.(`\n\n❌ ${errorMsg}\n`);
       logs.push({ timestamp: Date.now(), role: 'system', agentName: 'System', content: errorMsg, attempt: currentAttempt });
       return { content: currentOutput, status: 'FAIL', report: errorMsg, logs, isApiError: true };
    }
  }

  const failMsg = "Max retries reached.";
  onStreamChunk?.(`\n\n❌ ${failMsg}\n`);
  logs.push({ timestamp: Date.now(), role: 'system', agentName: 'System', content: failMsg, attempt: maxRetries });
  return { content: currentOutput, status: 'FAIL', report: "Max retries reached. Last feedback: " + feedback, logs };
}

/**
 * Breakdown Agent Loop
 */
export const generateBreakdownBatch = async (
  config: LLMConfig,
  chapters: NovelChapter[],
  novelType: string,
  lastEpisode: number,
  lastPlotNumber: number,
  maxRetries: number,
  onUpdate: (msg: string) => void,
  onStream: (text: string) => void,
  novelDescription: string = "",
  batchSize: number = 6,
  nextBatchStartEpisode?: number,
  checkStop?: () => boolean
) => {
  const chapterText = chapters.map(c => `Chapter ${c.name}:\n${c.content}`).join("\n\n");
  
  const workerTask = getBreakdownyWorkerPrompt(
    novelType as any, 
    novelDescription, 
    chapterText, 
    batchSize, 
    lastEpisode, 
    lastPlotNumber, 
    undefined, 
    nextBatchStartEpisode
  );

  const alignerPromptBuilder = (output: string) => `
  TASK: Check the quality of this plot breakdown.
  ${getBreakdownBasePrompt(novelType as any, 
    novelDescription, 
    chapterText, 
    batchSize, 
    lastEpisode, 
    lastPlotNumber, 
    undefined, 
    nextBatchStartEpisode)}
[GENERATED BREAKDOWN]:
${output}
  `;

  return agentLoop(
    config,
    'Breakdown Worker',
    'Breakdown Aligner',
    getBreakdownySysPrompt(batchSize),
    getBreakdownAlignerSysPrompt(novelType, novelDescription, batchSize),
    workerTask,
    alignerPromptBuilder,
    maxRetries,
    onUpdate,
    onStream,
    checkStop
  );
};

// --- Script Service (Batch) ---

export const generateBatchScripts = async (
  config: LLMConfig,
  plotPoints: PlotPoint[],
  relatedChapters: string,
  previousScript: string,
  previousBatchPlotPoint: string,
  maxRetries: number,
  onUpdate: (msg: string) => void,
  onStream: (text: string) => void,
  novelType: string = "",
  novelDescription: string = "",
  batchSize: number = 6,
  checkStop?: () => boolean
) => {
  const plotText = plotPoints.map(p => p.content).join("\n");
  
  const workerTask = getScriptWorkerPrompt(
    novelType,
    novelDescription,
    relatedChapters,
    plotText,
    batchSize,
    previousScript,
    previousBatchPlotPoint
  );

  const alignerPromptBuilder = (output: string) => `
  TASK: Check consistency of these scripts.

  ${getScriptBasePrompt(
    novelType,
    novelDescription,
    relatedChapters,
    plotText,
    batchSize,
    previousScript,
    previousBatchPlotPoint
  )}

[GENERATED SCRIPT]:
${output}
  `;

  return agentLoop(
    config,
    'Script Worker',
    'Webtoon Aligner',
    getScriptSysPrompt(novelType, novelDescription),
    getWebtoonAlignerPrompt(novelType, novelDescription),
    workerTask,
    alignerPromptBuilder,
    maxRetries,
    onUpdate,
    onStream,
    checkStop
  );
};

// ... existing helper functions (parseScripts, parsePlotPoints) keep unchanged ...
// Helper to parse multiple episodes from the output string (separated by ===)
export const parseScripts = (text: string): { episode: number, content: string }[] => {
  const scripts: { episode: number, content: string }[] = [];
  const parts = text.split('===');
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    // Extract episode number from "# 第<N>集"
    const match = trimmed.match(/#\s*第\s*(\d+)\s*集/);
    if (match) {
      scripts.push({
        episode: parseInt(match[1]),
        content: trimmed
      });
    }
  });
  
  return scripts;
};

// Reuse parsePlotPoints
export const parsePlotPoints = (text: string, batchIdx: number, startPlotNum: number = 0): PlotPoint[] => {
  const lines = text.split('\n');
  const points: PlotPoint[] = [];
  const regex = /【(剧情\d+)】\s*(.*?)[,，]\s*(.*?)[,，]\s*(.*?)[,，]\s*第(\d+)集(?:.*?第(\d+)章)?/;

  let localIndex = 0;
  lines.forEach(line => {
    const match = line.match(regex);
    if (match) {
      localIndex++;
      points.push({
        id: `batch-${batchIdx}-plot-${startPlotNum + localIndex}`,
        content: line,
        scene: match[2].trim(), 
        action: match[3].trim(), 
        hookType: match[4].trim(), 
        episode: parseInt(match[5]),
        sourceChapter: match[6] ? `第${match[6]}章` : '',
        status: 'unused',
        batchIndex: batchIdx
      });
    }
  });
  return points;
};
