import Node from './Node.js';
import { SharedState } from '../types.js';

/**
 * BatchNode provides support for parallel processing of multiple items.
 * This is particularly useful for operations like generating multiple chapters
 * or processing multiple files concurrently.
 */
abstract class BatchNode extends Node {
  /**
   * Creates a new BatchNode.
   * @param name - Name of the node for logging and identification.
   */
  constructor(name: string) {
    super(name);
  }
  
  /**
   * Prepares a list of items to be processed in parallel.
   * @param shared - The shared workflow state.
   * @returns Object containing the items array.
   */
  async prepare(shared: SharedState): Promise<{ items: any[], [key: string]: any }> {
    // Default implementation returns empty items array
    // Override in subclasses to provide actual items to process
    return { items: [] };
  }
  
  /**
   * Processes a single item from the batch.
   * @param item - A single item to process.
   * @param context - Additional context needed for processing.
   * @returns Result of processing this item.
   */
  async executeItem(item: any, context: Record<string, any> = {}): Promise<any> {
    // Default implementation returns the item unchanged
    // Override in subclasses to implement item-specific processing
    return item;
  }
  
  /**
   * Executes parallel processing of all items.
   * @param prepData - Preparation data containing items array.
   * @returns Array of processing results.
   */
  async execute(prepData: { items: any[], [key: string]: any }): Promise<any[]> {
    if (!prepData.items || !Array.isArray(prepData.items) || prepData.items.length === 0) {
      this.logger.warn('No items to process in batch');
      return [];
    }
    
    this.logger.info(`Processing ${prepData.items.length} items in parallel`);
    
    // Create execution context shared across all items
    const context: Record<string, any> = { ...prepData };
    delete context.items;
    
    // Process all items in parallel
    const results = await Promise.all(
      prepData.items.map(async (item, index) => {
        try {
          this.logger.info(`Processing item ${index + 1}/${prepData.items.length}`);
          return await this.executeItem(item, context);
        } catch (error) {
          this.logger.error(`Error processing item ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
      })
    );
    
    this.logger.info(`Batch processing completed: ${results.length} items processed`);
    return results;
  }
}

export default BatchNode;
