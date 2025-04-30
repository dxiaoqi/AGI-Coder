import Logger from './utils/Logger.js';
import Node from './nodes/Node.js';
import { SharedState } from './types.js';

/**
 * Workflow manages the execution of a sequence of processing nodes.
 * It ensures nodes are executed in order and handles the sharing of state
 * between them.
 */
class Workflow {
  private nodes: Node[];
  private logger: Logger;

  /**
   * Creates a new workflow with the specified nodes.
   * @param nodes - Array of Node instances to execute in sequence.
   */
  constructor(nodes: Node[]) {
    this.nodes = nodes;
    this.logger = new Logger('Workflow');
  }
  
  /**
   * Adds a node to the end of the workflow.
   * @param node - The node to add.
   * @returns The workflow instance for chaining.
   */
  addNode(node: Node): Workflow {
    this.nodes.push(node);
    return this;
  }
  
  /**
   * Runs the entire workflow, executing each node in sequence.
   * @param initialState - The initial state to pass to the first node.
   * @returns The final state after all nodes have executed.
   */
  async run(initialState: SharedState = {}): Promise<SharedState> {
    let shared: SharedState = { ...initialState };
    
    this.logger.info(`Starting workflow with ${this.nodes.length} nodes`);
    
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      this.logger.info(`Executing node ${i + 1}/${this.nodes.length}: ${node.nodeName}`);
      
      try {
        // Pass the current shared state to the node and get the updated state
        shared = await node.run(shared);
      } catch (error) {
        this.logger.error(`Workflow failed at node ${node.nodeName}: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(`Workflow execution failed at node ${node.nodeName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    this.logger.success('Workflow completed successfully');
    return shared;
  }
}

export default Workflow;
