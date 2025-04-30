import Node from './Node.js';
import { SharedState, Abstraction, OllamaService } from '../types.js';

/**
 * Node for identifying key abstractions in the codebase.
 * Uses Ollama to analyze code and extract meaningful abstractions.
 */
class IdentifyAbstractions extends Node {
  private ollama: OllamaService;
  private current_context: any;

  /**
   * Creates a new IdentifyAbstractions instance.
   * @param ollamaService - The Ollama service for LLM functionality.
   */
  constructor(ollamaService: OllamaService) {
    super('IdentifyAbstractions');
    this.ollama = ollamaService;
  }
  
  /**
   * Prepares for abstraction identification by setting up context.
   * @param shared - The shared workflow state.
   * @returns Preparation data with context for LLM.
   */
  async prepare(shared: SharedState): Promise<{
    projectName: string;
    language: string;
    files: SharedState['files'];
    chunkedFiles: SharedState['chunkedFiles'];
    needsChunkedProcessing: boolean;
  }> {
    if (!shared.files || !Array.isArray(shared.files)) {
      throw new Error('No files available for abstraction identification');
    }
    
    // Determine the primary programming language
    let language = 'unknown';
    if (shared.stats && shared.stats.extensionCounts) {
      const languages: Record<string, string> = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript (React)',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript (React)',
        '.py': 'Python',
        '.java': 'Java',
        '.c': 'C',
        '.cpp': 'C++',
        '.go': 'Go',
        '.php': 'PHP',
        '.rb': 'Ruby'
      };
      
      // Find the most common extension
      let maxCount = 0;
      let maxExt = '';
      
      for (const [ext, count] of Object.entries(shared.stats.extensionCounts)) {
        if (count > maxCount) {
          maxCount = count;
          maxExt = ext;
        }
      }
      
      language = languages[maxExt] || 'unknown';
    }
    
    // Determine if we need chunked processing
    const needsChunkedProcessing = shared.needsChunkedProcessing || false;
    
    return {
      projectName: shared.projectName || '',
      language,
      files: shared.files,
      chunkedFiles: shared.chunkedFiles || [],
      needsChunkedProcessing
    };
  }
  
  /**
   * Builds a prompt for LLM to identify abstractions.
   * @param codeContent - The code content to analyze.
   * @param language - The programming language.
   * @param projectName - The project name.
   * @param isChunk - Whether this is a chunk of a larger file.
   * @returns The formatted prompt.
   */
  buildPrompt(codeContent: string, language: string, projectName: string, isChunk = false): string {
    return `You are analyzing a software project named "${projectName}" written in ${language}.
Your task is to identify the key abstractions (classes, interfaces, modules, important functions) in this codebase.
${isChunk ? 'This is a chunk of a larger codebase, so focus on what you can see in this segment.' : ''}

For each abstraction, provide:
1. Name - The name of the abstraction
2. Type - Class, Interface, Module, Function, etc.
3. Description - A concise description of its purpose and functionality
4. Relationships - How it relates to other abstractions (if evident)

Code to analyze:
\`\`\`
${codeContent}
\`\`\`

Format your response as a JSON array like this:
[
  {
    "name": "AbstractionName",
    "type": "AbstractionType",
    "description": "A concise description of what this abstraction does",
    "relationships": ["RelatedAbstraction1", "RelatedAbstraction2"]
  },
  ...
]`;
  }
  
  /**
   * Merges abstraction results from multiple chunks, eliminating duplicates.
   * @param chunkResults - Array of chunk processing results.
   * @returns Merged abstraction results.
   */
  mergeChunkResults(chunkResults: string[]): Abstraction[] {
    // First, parse all JSON results and flatten into a single array
    const allAbstractions: Abstraction[] = [];
    
    for (const chunkResult of chunkResults) {
      try {
        // Extract JSON from the chunk result
        const jsonMatch = chunkResult.match(/\[\s*\{.*\}\s*\]/s);
        if (!jsonMatch) {
          this.logger.warn('Could not extract JSON from chunk result');
          continue;
        }
        
        const parsedAbstractions = JSON.parse(jsonMatch[0]);
        allAbstractions.push(...parsedAbstractions);
      } catch (error) {
        this.logger.error(`Error parsing abstractions: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other chunks even if one fails
      }
    }
    
    // Group abstractions by name
    const abstractionGroups: Record<string, Abstraction[]> = {};
    
    for (const abstraction of allAbstractions) {
      if (!abstraction.name) continue;
      
      const name = abstraction.name;
      if (!abstractionGroups[name]) {
        abstractionGroups[name] = [];
      }
      
      abstractionGroups[name].push(abstraction);
    }
    
    // Merge abstractions with the same name
    const mergedAbstractions = Object.entries(abstractionGroups).map(([name, abstractions]) => {
      if (abstractions.length === 1) {
        return abstractions[0];
      }
      
      // Merge multiple descriptions of the same abstraction
      // Use the most common type
      const typeCounts: Record<string, number> = {};
      for (const abs of abstractions) {
        typeCounts[abs.type] = (typeCounts[abs.type] || 0) + 1;
      }
      
      let maxCount = 0;
      let maxType = '';
      for (const [type, count] of Object.entries(typeCounts)) {
        if (count > maxCount) {
          maxCount = count;
          maxType = type;
        }
      }
      
      // Choose the longest description as it's likely the most complete
      let bestDescription = '';
      for (const abs of abstractions) {
        if (abs.description && abs.description.length > bestDescription.length) {
          bestDescription = abs.description;
        }
      }
      
      // Combine all unique relationships
      const allRelationships = new Set<string>();
      for (const abs of abstractions) {
        if (abs.relationships && Array.isArray(abs.relationships)) {
          for (const rel of abs.relationships) {
            allRelationships.add(rel);
          }
        }
      }
      
      return {
        name,
        type: maxType,
        description: bestDescription,
        relationships: Array.from(allRelationships)
      };
    });
    
    return mergedAbstractions;
  }
  
  /**
   * Executes the abstraction identification process.
   * @param prepData - Preparation data with context.
   * @returns Identified abstractions.
   */
  async execute(prepData: {
    projectName: string;
    language: string;
    files: SharedState['files'];
    chunkedFiles: SharedState['chunkedFiles'];
    needsChunkedProcessing: boolean;
  }): Promise<Abstraction[]> {
    const { projectName, language, files, chunkedFiles, needsChunkedProcessing } = prepData;
    
    if (needsChunkedProcessing && chunkedFiles && chunkedFiles.length > 0) {
      // Process files in chunks
      this.logger.info(`Processing chunked files for abstractions`);
      
      const allChunkResults: string[] = [];
      
      // Process each chunked file
      for (const file of chunkedFiles) {
        this.logger.info(`Processing ${file.chunks?.length || 0} chunks for file: ${file.path}`);
        
        const chunkProcessor = async (chunkContent: string) => {
          const prompt = this.buildPrompt(chunkContent, language, projectName, true);
          return await this.ollama.call(prompt);
        };
        
        const contextText = `Analyzing file: ${file.path} in project ${projectName}`;
        
        if (file.chunks) {
          const chunkResults = await this.ollama.processBatches(
            file.chunks,
            chunkProcessor,
            contextText
          );
          
          allChunkResults.push(...chunkResults);
        }
      }
      
      // Process regular (non-chunked) files
      const regularFiles = files?.filter(file => !file.isChunked && !file.error && !file.isTooLarge) || [];
      
      for (const file of regularFiles) {
        const prompt = this.buildPrompt(file.content, language, projectName, false);
        const result = await this.ollama.call(prompt);
        allChunkResults.push(result);
      }
      
      // Merge all results
      return this.mergeChunkResults(allChunkResults);
    } else {
      // Traditional processing for all files at once
      this.logger.info(`Processing all files together for abstractions`);
      
      // Combine all file contents with file paths as headers
      let combinedContent = files
        ?.filter(file => !file.error && !file.isTooLarge)
        .map(file => `// File: ${file.path}\n${file.content}`)
        .join('\n\n') || '';
      
      // Truncate if too large
      if (combinedContent.length > 15000) {
        this.logger.warn(`Combined content too large (${combinedContent.length} chars), truncating`);
        combinedContent = combinedContent.substring(0, 15000) + '\n// Content truncated due to length...';
      }
      
      const prompt = this.buildPrompt(combinedContent, language, projectName);
      const result = await this.ollama.call(prompt);
      
      try {
        // Extract JSON from result
        const jsonMatch = result.match(/\[\s*\{.*\}\s*\]/s);
        if (!jsonMatch) {
          this.logger.error('Could not extract JSON from result');
          return [];
        }
        
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        this.logger.error(`Error parsing abstractions: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }
  }
  
  /**
   * Updates the shared state with identified abstractions.
   * @param shared - The shared workflow state.
   * @param prepData - Data from preparation phase.
   * @param execResult - Result from execution phase.
   * @returns Updated shared state.
   */
  async postProcess(
    shared: SharedState, 
    prepData: {
      projectName: string;
      language: string;
      files: SharedState['files'];
      chunkedFiles: SharedState['chunkedFiles'];
      needsChunkedProcessing: boolean;
    }, 
    execResult: Abstraction[]
  ): Promise<SharedState> {
    return {
      ...shared,
      abstractions: execResult,
      language: prepData.language
    };
  }
}

export default IdentifyAbstractions;
