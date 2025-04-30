import Node from './Node.js';
import { SharedState, TextChunkerConfig, FileInfo } from '../types.js';

/**
 * Node for intelligent text chunking to optimize content for LLM processing.
 * Handles breaking down large text/code files into semantically meaningful chunks.
 */
class TextChunker extends Node {
  private chunkSize: number;
  private chunkOverlap: number;

  /**
   * Creates a new TextChunker instance.
   * @param config - Configuration options.
   */
  constructor(config: TextChunkerConfig = {}) {
    super('TextChunker');
    this.chunkSize = config.chunkSize || 8000; // Default chunk size
    this.chunkOverlap = config.chunkOverlap || 500; // Default overlap
  }
  
  /**
   * Prepares chunking by determining which files need to be chunked.
   * @param shared - The shared workflow state.
   * @returns Preparation data with files to chunk.
   */
  async prepare(shared: SharedState): Promise<{
    filesToChunk: FileInfo[];
    projectName: string;
    allFiles: FileInfo[];
  }> {
    if (!shared.files || !Array.isArray(shared.files)) {
      throw new Error('No files available for chunking');
    }
    
    // Determine which files require chunking (non-error, non-too-large files)
    const filesToChunk = shared.files.filter(file => 
      !file.error && 
      !file.isTooLarge && 
      file.content && 
      file.content.length > this.chunkSize
    );
    
    this.logger.info(`${filesToChunk.length} files need chunking out of ${shared.files.length} total files`);
    
    return {
      filesToChunk,
      projectName: shared.projectName || '',
      allFiles: shared.files
    };
  }
  
  /**
   * Creates intelligent chunks from text content.
   * @param text - The text to chunk.
   * @returns Array of text chunks.
   */
  createSmartChunks(text: string): string[] {
    const chunks: string[] = [];
    let position = 0;
    
    while (position < text.length) {
      let end = Math.min(position + this.chunkSize, text.length);
      
      if (end < text.length) {
        // Find optimal break points within the overlap region
        const searchRegion = text.substring(end - Math.min(this.chunkSize / 2, 2000), end);
        
        // Define ideal break patterns in order of preference
        const idealBreakPatterns = [
          /\n\s*\n/g,  // Empty line
          /\n\}\s*\n/g, // End of code block
          /;\n/g,      // End of statement
          /\n/g        // Any line break
        ];
        
        let foundBreak = false;
        
        // Try each pattern until we find a break point
        for (const pattern of idealBreakPatterns) {
          const matches = [...searchRegion.matchAll(pattern)];
          if (matches.length > 0) {
            // Use the last match as the break point
            const lastMatch = matches[matches.length - 1];
            const breakPoint = end - searchRegion.length + lastMatch.index + lastMatch[0].length;
            end = breakPoint;
            foundBreak = true;
            break;
          }
        }
        
        // If no ideal break was found, just use the calculated end
        if (!foundBreak) {
          this.logger.warn(`No ideal break point found in chunk, using character boundary`);
        }
      }
      
      // Extract the chunk
      chunks.push(text.substring(position, end));
      
      // Move position for next chunk, with overlap
      position = end - (end < text.length ? this.chunkOverlap : 0);
    }
    
    return chunks;
  }
  
  /**
   * Executes chunking for all files that need it.
   * @param prepData - Preparation data with files to chunk.
   * @returns Chunking results.
   */
  async execute(prepData: {
    filesToChunk: FileInfo[];
    allFiles: FileInfo[];
  }): Promise<{
    chunkedFiles: FileInfo[];
    allProcessedFiles: FileInfo[];
  }> {
    const { filesToChunk, allFiles } = prepData;
    
    if (filesToChunk.length === 0) {
      this.logger.info('No files need chunking');
      return {
        chunkedFiles: [],
        allProcessedFiles: allFiles
      };
    }
    
    // Process each file that needs chunking
    const chunkedFiles = filesToChunk.map(file => {
      this.logger.info(`Chunking file: ${file.path} (${file.content.length} chars)`);
      
      const chunks = this.createSmartChunks(file.content);
      
      this.logger.info(`Created ${chunks.length} chunks for ${file.path}`);
      
      return {
        ...file,
        isChunked: true,
        chunks,
        chunkCount: chunks.length
      };
    });
    
    // Replace the original files with chunked versions
    const allProcessedFiles = allFiles.map(file => {
      const chunkedVersion = chunkedFiles.find(chunked => chunked.path === file.path);
      return chunkedVersion || file;
    });
    
    return {
      chunkedFiles,
      allProcessedFiles
    };
  }
  
  /**
   * Updates the shared state with chunked files.
   * @param shared - The shared workflow state.
   * @param prepData - Data from preparation phase.
   * @param execResult - Result from execution phase.
   * @returns Updated shared state.
   */
  async postProcess(
    shared: SharedState, 
    prepData: {
      filesToChunk: FileInfo[];
      projectName: string;
      allFiles: FileInfo[];
    }, 
    execResult: {
      chunkedFiles: FileInfo[];
      allProcessedFiles: FileInfo[];
    }
  ): Promise<SharedState> {
    // Update the files in the shared state with their chunked versions
    return {
      ...shared,
      files: execResult.allProcessedFiles,
      chunkedFiles: execResult.chunkedFiles,
      needsChunkedProcessing: execResult.chunkedFiles.length > 0
    };
  }
}

export default TextChunker;
