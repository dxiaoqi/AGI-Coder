import Logger from '../utils/Logger.js';
import { SharedState } from '../types.js';

/**
 * Base Node class representing a discrete processing step in the workflow.
 * Each node follows a consistent prepare -> execute -> postProcess pattern.
 */
abstract class Node {
  protected name: string;
  protected logger: Logger;

  /**
   * Creates a new Node.
   * @param name - Name of the node for logging and identification.
   */
  constructor(name: string) {
    this.name = name;
    this.logger = new Logger(name);
  }
  
  /**
   * Gets the name of the node.
   */
  get nodeName(): string {
    return this.name;
  }
  
  /**
   * Prepares node execution context based on shared state.
   * @param shared - The shared workflow state.
   * @returns Data needed for execution phase.
   */
  async prepare(shared: SharedState): Promise<any> {
    // Default implementation returns empty object
    // Override in subclasses to implement specific preparation
    return {};
  }
  
  /**
   * Executes the main logic of the node.
   * @param prepData - Data prepared in the prepare phase.
   * @returns Result of the execution.
   */
  async execute(prepData: any): Promise<any> {
    // Default implementation returns null
    // Override in subclasses to implement specific execution logic
    return null;
  }
  
  /**
   * Processes execution results and updates shared state.
   * @param shared - The shared workflow state.
   * @param prepData - Data from preparation phase.
   * @param execResult - Result from execution phase.
   * @returns Updated shared state.
   */
  async postProcess(shared: SharedState, prepData: any, execResult: any): Promise<SharedState> {
    // Default implementation returns unchanged shared state
    // Override in subclasses to implement specific post-processing
    return shared;
  }
  
  /**
   * Runs the node's complete processing cycle.
   * @param shared - The shared workflow state.
   * @returns Updated shared state after processing.
   */
  async run(shared: SharedState): Promise<SharedState> {
    try {
      this.logger.info(`Starting...`);
      const prepData = await this.prepare(shared);
      this.logger.info(`Preparation completed`);
      
      const execResult = await this.execute(prepData);
      this.logger.info(`Execution completed`);
      
      const updatedShared = await this.postProcess(shared, prepData, execResult);
      this.logger.success(`Completed successfully`);
      
      return updatedShared;
    } catch (error) {
      this.logger.error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export default Node; 