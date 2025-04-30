import Logger from '../utils/Logger.js';
import { OllamaConfig } from '../types.js';
import { Ollama } from "ollama";
// Define types for Ollama API
interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
}

interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
}

// Type for the dynamically imported Ollama module
interface OllamaModule {
  host: string;
  chat: (params: {
    model: string;
    messages: OllamaMessage[];
    options?: OllamaOptions;
  }) => Promise<OllamaResponse>;
}

/**
 * Service for interacting with Ollama API to perform LLM operations.
 * Provides abstractions for calling the model and batch processing text chunks.
 */
class OllamaService {
  private model: string;
  private baseUrl: string;
  private maxTokens: number;
  private temperature: number;
  private logger: Logger;
  private ollama?: OllamaModule;

  /**
   * Creates a new OllamaService instance.
   * @param config - Configuration options for the service.
   */
  constructor(config: OllamaConfig = {}) {
    this.model = config.model || 'llama2';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
    
    // Create logger first
    this.logger = new Logger('OllamaService');
    
    // Then initialize client
    this.initializeClient().catch(err => {
      this.logger.error(`Failed to initialize Ollama client: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  
  /**
   * Initializes the Ollama client.
   * This is done as a separate method to allow for lazy loading and error handling.
   */
  async initializeClient(): Promise<void> {
    try {
      this.logger.info(`Ollama host set to: ${this.baseUrl}`);
      
      try {
        
        this.ollama = new Ollama() as unknown as OllamaModule;
        
        // Set the host
        this.ollama.host = this.baseUrl;
        
        this.logger.info(`Ollama client initialized with model: ${this.model}`);
      } catch (importError) {
        this.logger.warn(`Ollama module import failed, will retry on first call: ${importError instanceof Error ? importError.message : String(importError)}`);
      }
    } catch (error) {
      // If Logger is not initialized, handle gracefully
      console.error(`Error initializing Ollama client: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Ollama initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Calls the Ollama API with the specified prompt.
   * @param prompt - The prompt to send to the model.
   * @param options - Optional parameters to override defaults.
   * @returns The model's response.
   */
  async call(prompt: string, options: Partial<OllamaOptions> = {}): Promise<string> {
    if (!this.ollama) {
      this.logger.info('Ollama client not initialized yet, initializing now...');
      await this.initializeClient();
    }
    
    try {
      this.logger.info(`Calling Ollama with model: ${this.model}`);
      
      if (!this.ollama) {
        throw new Error('Ollama client initialization failed');
      }
      
      const response = await this.ollama.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: options.temperature || this.temperature,
          num_predict: options.num_predict || this.maxTokens
        }
      });
      
      this.logger.info(`Ollama response received`);
      return response.message.content;
    } catch (error) {
      this.logger.error(`Ollama API error: ${error instanceof Error ? error.message : String(error)}`);
      
      // For demonstration purposes, return a mock response
      this.logger.warn('Returning mock response since Ollama API is not available');
      return `[Mock Response] Analysis of the content: "${prompt.substring(0, 50)}..."\n\nThis is a mock response because the Ollama API is not available. In a real scenario, this would contain the LLM's analysis.`;
    }
  }
  
  /**
   * Processes a batch of text chunks, calling the processor function on each.
   * @param chunks - Array of text chunks to process.
   * @param processor - Async function that processes a single chunk.
   * @param chunkContext - Optional context to provide with each chunk.
   * @returns Array of processing results.
   */
  async processBatches(
    chunks: string[],
    processor: (chunk: string) => Promise<string>,
    chunkContext: string = ""
  ): Promise<string[]> {
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      this.logger.warn('No chunks to process');
      return [];
    }
    
    this.logger.info(`Processing ${chunks.length} chunks`);
    
    // Process chunks with a concurrency limit to avoid overloading
    const concurrencyLimit = 2;
    const results: string[] = [];
    
    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
      const batch = chunks.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkNumber = i + batchIndex + 1;
        this.logger.info(`Processing chunk ${chunkNumber}/${chunks.length}`);
        
        try {
          // Inject chunk number and context
          const contextualizedChunk = `${chunkContext}\n\nCHUNK ${chunkNumber}/${chunks.length}:\n${chunk}`;
          return await processor(contextualizedChunk);
        } catch (error) {
          this.logger.error(`Error processing chunk ${chunkNumber}: ${error instanceof Error ? error.message : String(error)}`);
          return `[Error processing chunk ${chunkNumber}]`;  // Return error message instead of throwing
        }
      });
      
      // Wait for the current batch to complete before moving to the next
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    this.logger.info(`Batch processing completed: ${results.length} chunks processed`);
    return results;
  }
}

export default OllamaService;
