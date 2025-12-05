
import { GoogleGenAI } from "@google/genai";
import { 
  getBreakdownWorkerPrompt, 
  getBreakdownAlignerPrompt, 
  getScriptWorkerPrompt, 
  getWebtoonAlignerPrompt,
  getAdaptMethod,
  OUTPUT_STYLE,
  PLOT_EXAMPLE,
  PLOT_TEMPLATE,
  SCRIPT_EXAMPLE,
  SCRIPT_TEMPLATE 
} from '../constants';
import { NovelChapter, PlotPoint, LogEntry } from '../types';

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const cleanText = (text: string | undefined) => text || "";

// Helper: Delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface AgentLoopResult {
  content: string;
  status: 'PASS' | 'FAIL';
  report: string;
  logs: LogEntry[];
  isApiError?: boolean;
}

// Helper: Robust API Call with Retry Strategies
async function generateContentWithRetry(
  model: string,
  prompt: string,
  systemInstruction: string,
  agentName: string,
  onUpdate?: (msg: string) => void,
  checkStop?: () => boolean
): Promise<string> {
  let attempt = 0;
  const MAX_API_RETRIES = 3; // For transient errors (5xx)
  
  while (true) {
    // 1. Check Cancellation before request
    if (checkStop && checkStop()) {
        throw new Error("USER_ABORT");
    }

    try {
      const result = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: systemInstruction }
      });
      return cleanText(result.text);
    } catch (e: any) {
      // 2. Check Cancellation after error
      if (checkStop && checkStop()) {
          throw new Error("USER_ABORT");
      }

      const errMsg = e.toString().toLowerCase();

      // Strategy 1: Rate Limit (429) -> Wait 60s and Retry
      if (errMsg.includes('429') || errMsg.includes('resource exhausted') || errMsg.includes('too many requests')) {
         onUpdate?.(`⚠️ API Rate Limit Triggered. Pausing for 60s before retry...`);
         
         // Wait with intermediate checks
         for (let i = 0; i < 60; i++) {
             if (checkStop && checkStop()) throw new Error("USER_ABORT");
             await delay(1000);
         }
         
         onUpdate?.(`${agentName}: Resuming after cooldown...`);
         continue; 
      }

      // Strategy 2: Quota/Auth/Permission (403, 401, 400) -> Fatal Stop
      if (errMsg.includes('403') || errMsg.includes('quota') || errMsg.includes('permission') || errMsg.includes('key')) {
         throw new Error(`FATAL_API_ERROR: Quota exceeded or Permission denied. ${e.message}`);
      }

      // Strategy 3: Server Errors (500, 503) -> Short Wait and Retry
      if (errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('internal') || errMsg.includes('overloaded')) {
         if (attempt < MAX_API_RETRIES) {
             attempt++;
             const waitTime = attempt * 5000;
             onUpdate?.(`⚠️ Server Busy (${e.message}). Retrying in ${waitTime/1000}s...`);
             await delay(waitTime);
             continue;
         }
      }

      // Strategy 4: Unknown/Network Errors -> Retry a few times
      if (attempt < MAX_API_RETRIES) {
          attempt++;
          onUpdate?.(`⚠️ Network/Unknown Error. Retrying (${attempt}/${MAX_API_RETRIES})...`);
          await delay(2000);
          continue;
      }

      // If exhausted retries or fatal error
      throw e;
    }
  }
}

// Helper: Agent Execution Loop
async function agentLoop(
  workerName: string,
  alignerName: string,
  workerSystemPrompt: string,
  alignerSystemPrompt: string,
  workerTaskPrompt: string,
  alignerContextPrompt: (output: string) => string,
  maxRetries = 3,
  onProgress?: (status: string) => void,
  checkStop?: () => boolean
): Promise<AgentLoopResult> {
  
  let currentOutput = "";
  let feedback = "";
  let retries = 0;
  const logs: LogEntry[] = [];

  while (retries < maxRetries) {
    if (checkStop && checkStop()) {
        throw new Error("USER_ABORT");
    }

    // 1. Worker Step
    onProgress?.(retries === 0 ? `${workerName}: Generating content...` : `${workerName}: Refining content (Attempt ${retries + 1})...`);
    
    let fullWorkerPrompt = workerTaskPrompt;
    if (feedback) {
      fullWorkerPrompt += `\n\n[Previous Feedback - Please Fix]\n${feedback}`;
    }

    logs.push({
        timestamp: Date.now(),
        role: 'user',
        agentName: workerName,
        content: fullWorkerPrompt,
        sysPrompt: workerSystemPrompt
    });

    try {
      // Use Robust API Wrapper
      currentOutput = await generateContentWithRetry(
        'gemini-3-pro-preview', 
        fullWorkerPrompt, 
        workerSystemPrompt, 
        workerName,
        onProgress,
        checkStop
      );
      
      logs.push({
          timestamp: Date.now(),
          role: 'model',
          agentName: workerName,
          content: currentOutput,
          sysPrompt:"",
      });

    } catch (e: any) {
      if (e.message === 'USER_ABORT') throw e;

      const errorMsg = `API ERROR in Worker: ${e.message || e}`;
      
      logs.push({
          timestamp: Date.now(),
          role: 'system',
          agentName: 'System',
          content: errorMsg
      });
      
      return { 
        content: currentOutput, 
        status: 'FAIL', 
        report: errorMsg, 
        logs, 
        isApiError: true 
      };
    }

    if (checkStop && checkStop()) {
        throw new Error("USER_ABORT");
    }

    // 2. Aligner Step
    onProgress?.(`${alignerName}: Checking quality...`);
    const alignerPrompt = alignerContextPrompt(currentOutput);
    
    logs.push({  
        timestamp: Date.now(),
        role: 'user',
        agentName: alignerName,
        content: alignerPrompt,
        sysPrompt: alignerSystemPrompt
    });

    try {
      // Use Robust API Wrapper
      const report = await generateContentWithRetry(
        'gemini-3-pro-preview',
        alignerPrompt,
        alignerSystemPrompt,
        alignerName,
        onProgress,
        checkStop
      );

      logs.push({
          timestamp: Date.now(),
          role: 'model',
          agentName: alignerName,
          content: report
      });

      if (report.includes("PASS")) {
        return { content: currentOutput, status: 'PASS', report, logs };
      } else {
        feedback = report;
        retries++;
      }
    } catch (e: any) {
       if (e.message === 'USER_ABORT') throw e;

       const errorMsg = `API ERROR in Aligner: ${e.message || e}`;

       logs.push({
          timestamp: Date.now(),
          role: 'system',
          agentName: 'System',
          content: errorMsg
       });
       
       return { 
         content: currentOutput, 
         status: 'FAIL', 
         report: errorMsg, 
         logs,
         isApiError: true
       };
    }
  }

  logs.push({
      timestamp: Date.now(),
      role: 'system',
      agentName: 'System',
      content: "Max retries reached."
  });

  return { content: currentOutput, status: 'FAIL', report: "Max retries reached. Last feedback: " + feedback, logs };
}

/**
 * Breakdown Agent Loop
 */
export const generateBreakdownBatch = async (
  chapters: NovelChapter[],
  novelType: string,
  lastEpisode: number,
  lastPlotNumber: number,
  maxRetries: number,
  onUpdate: (msg: string) => void,
  novelDescription: string = "",
  batchSize: number = 6,
  nextBatchStartEpisode?: number,
  checkStop?: () => boolean
) => {
  const chapterText = chapters.map(c => `Chapter ${c.name}:\n${c.content}`).join("\n\n");
  const adaptMethod = getAdaptMethod(batchSize);
  
  // Includes both Method and Style as requested
  const workerTask = `
  NOVEL TYPE: ${novelType}
  
  TASK: Breakdown the following ${batchSize} chapters into plot points.
  
  CONTEXT: 
  - The previous batch ended at Episode ${lastEpisode}.
  - The previous batch ended at Plot Number ${lastPlotNumber}.
  
  INSTRUCTION: 
  - You can continue with Episode ${lastEpisode} if the plot connects directly to the previous cliffhanger, OR start with Episode ${lastEpisode + 1} if it's a new scene.
  - DO NOT SKIP EPISODE NUMBERS.
  - Start plot numbering from 【剧情${lastPlotNumber + 1}】.
  
  KNOWLEDGE (Method & Style):
  ${adaptMethod}
  
  TEMPLATE:
  ${PLOT_TEMPLATE}
  
  EXAMPLE:
  ${PLOT_EXAMPLE}

  NOVEL CONTENT:
  ${chapterText} 
  `;

  const alignerPromptBuilder = (output: string) => `
  TASK: Check the quality of this plot breakdown.
  
  NOVEL TYPE: ${novelType}
  
  
  CONTEXT: 
  - The previous batch ended at Episode ${lastEpisode}.
  - The previous batch ended at Plot Number ${lastPlotNumber}.
  
  INSTRUCTION: 
  - You can continue with Episode ${lastEpisode} if the plot connects directly to the previous cliffhanger, OR start with Episode ${lastEpisode + 1} if it's a new scene.
  - DO NOT SKIP EPISODE NUMBERS.
  - Start plot numbering from 【剧情${lastPlotNumber + 1}】.
  
  KNOWLEDGE (Method & Style):
  ${adaptMethod}
  
  TEMPLATE:
  ${PLOT_TEMPLATE}
  
  EXAMPLE:
  ${PLOT_EXAMPLE}

  ORIGINAL NOVEL:
  ${chapterText}
  
  GENERATED BREAKDOWN:
  ${output}
  `;

  return agentLoop(
    'Breakdown Worker',
    'Breakdown Aligner',
    getBreakdownWorkerPrompt(novelType, novelDescription, batchSize, lastPlotNumber, nextBatchStartEpisode),
    getBreakdownAlignerPrompt(novelType, novelDescription, batchSize),
    workerTask,
    alignerPromptBuilder,
    maxRetries,
    onUpdate,
    checkStop
  );
};

/**
 * Script Agent Loop
 */
export const generateScriptEpisode = async (
  episodeNum: number,
  plotPoints: PlotPoint[],
  relatedChapters: string, // content of relevant chapters
  maxRetries: number,
  onUpdate: (msg: string) => void,
  novelType: string = "",
  novelDescription: string = "",
  batchSize: number = 6,
  checkStop?: () => boolean
) => {
  const plotText = plotPoints.map(p => p.content).join("\n");
  const adaptMethod = getAdaptMethod(batchSize);
  
  const workerTask = `
  TASK: Write Script for Episode ${episodeNum}.
  
  PLOT POINTS:
  ${plotText}
  
  SOURCE NOVEL CONTENT:
  ${relatedChapters}
  
  KNOWLEDGE (Method & Style):
  ${adaptMethod}
  ${OUTPUT_STYLE}
  
  TEMPLATE:
  ${SCRIPT_TEMPLATE}

  EXAMPLE:
  ${SCRIPT_EXAMPLE}
  `;

  const alignerPromptBuilder = (output: string) => `
  TASK: Check consistency of this script.
  
  PLOT POINTS:
  ${plotText}

  SOURCE NOVEL CONTENT:
  ${relatedChapters}
  
  KNOWLEDGE (Method & Style):
  ${adaptMethod}
  ${OUTPUT_STYLE}
  
  TEMPLATE:
  ${SCRIPT_TEMPLATE}

  EXAMPLE:
  ${SCRIPT_EXAMPLE}
  
  GENERATED SCRIPT:
  ${output}
  `;

  return agentLoop(
    'Script Worker',
    'Webtoon Aligner',
    getScriptWorkerPrompt(novelType, novelDescription),
    getWebtoonAlignerPrompt(novelType, novelDescription),
    workerTask,
    alignerPromptBuilder,
    maxRetries,
    onUpdate,
    checkStop
  );
};

// Parser Helpers
export const parsePlotPoints = (text: string, batchIdx: number, startPlotNum: number = 0): PlotPoint[] => {
  const lines = text.split('\n');
  const points: PlotPoint[] = [];
  // Updated regex to better capture Scene, Action, and HookType
  // Matches: 【剧情1】[场景]，[内容]，[钩子]，第1集...
  // Flexible to handle standard comma or Chinese comma
  const regex = /【(剧情\d+)】\s*(.*?)[,，]\s*(.*?)[,，]\s*(.*?)[,，]\s*第(\d+)集/;

  let localIndex = 0;
  lines.forEach(line => {
    const match = line.match(regex);
    if (match) {
      localIndex++;
      // Create a GLOBALLY unique internal ID by prefixing with batch index OR using global counter logic
      // Ideally, the 'id' field is used for React keys and status tracking.
      // We use a composite ID to guarantee uniqueness regardless of what the LLM outputs.
      const uniqueInternalId = `batch-${batchIdx}-plot-${startPlotNum + localIndex}`;
      
      points.push({
        id: uniqueInternalId, // Internal Unique ID
        content: line,
        scene: match[2].trim(), 
        action: match[3].trim(), // Extracted Action
        hookType: match[4].trim(), // Extracted Hook Type
        episode: parseInt(match[5]),
        status: 'unused',
        batchIndex: batchIdx
      });
    }
  });
  return points;
};
