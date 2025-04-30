import Node from './Node.js';
import { SharedState, Abstraction, OllamaService, RelationshipGraph, Relationship } from '../types.js';

/**
 * Node for determining the logical order of chapters based on abstractions.
 * Uses Ollama to suggest the most educational sequence for presenting abstractions.
 */
class OrderChapters extends Node {
  private ollama: OllamaService;

  /**
   * Creates a new OrderChapters instance.
   * @param ollamaService - The Ollama service for LLM functionality.
   */
  constructor(ollamaService: OllamaService) {
    super('OrderChapters');
    this.ollama = ollamaService;
  }
  
  /**
   * Prepares for chapter ordering by validating abstractions.
   * @param shared - The shared workflow state.
   * @returns Preparation data with abstractions.
   */
  async prepare(shared: SharedState): Promise<{
    projectName: string;
    language: string;
    abstractions: Abstraction[];
  }> {
    if (!shared.abstractions || !Array.isArray(shared.abstractions) || shared.abstractions.length === 0) {
      throw new Error('No abstractions available for chapter ordering');
    }
    
    return {
      projectName: shared.projectName || '',
      language: shared.language || 'unknown',
      abstractions: shared.abstractions
    };
  }
  
  /**
   * Builds a prompt for LLM to suggest chapter ordering.
   * @param abstractions - The identified abstractions.
   * @param language - The programming language.
   * @param projectName - The project name.
   * @returns The formatted prompt.
   */
  buildOrderingPrompt(abstractions: Abstraction[], language: string, projectName: string): string {
    // Format abstractions for readability
    const abstractionsText = abstractions.map((abs, index) => {
      return `${index}. ${abs.name} (${abs.type}): ${abs.description}
   Related to: ${abs.relationships && abs.relationships.length > 0 ? abs.relationships.join(', ') : 'None'}`;
    }).join('\n\n');
    
    return `You are organizing a tutorial for a software project named "${projectName}" written in ${language}.
You have extracted ${abstractions.length} key abstractions from the codebase, and now need to determine the 
most logical and educational order to present them in a tutorial.

The abstractions are:

${abstractionsText}

Please analyze the dependencies and relationships between these abstractions to determine the best order for learning.
Core abstractions that others depend on should come first, followed by those that build upon them.

Return the indices of the abstractions in the order they should be presented, as a JSON array.
For example: [3, 1, 4, 0, 2]

Provide a brief explanation for your ordering to justify your educational approach.`;
  }
  
  /**
   * Executes the chapter ordering logic.
   * @param prepData - Preparation data with abstractions.
   * @returns Chapter ordering results.
   */
  async execute(prepData: {
    projectName: string;
    language: string;
    abstractions: Abstraction[];
  }): Promise<{
    chapter_order: number[];
    explanation: string;
    relationship_graph: RelationshipGraph;
  }> {
    const { projectName, language, abstractions } = prepData;
    
    this.logger.info(`Determining optimal chapter order for ${abstractions.length} abstractions`);
    
    const prompt = this.buildOrderingPrompt(abstractions, language, projectName);
    const result = await this.ollama.call(prompt);
    
    try {
      // Extract JSON array from the result
      const jsonMatch = result.match(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/);
      if (!jsonMatch) {
        this.logger.error('Could not extract chapter order from result');
        // Fall back to original order
        return {
          chapter_order: abstractions.map((_, index) => index),
          explanation: "Failed to determine optimal order, using default sequence.",
          relationship_graph: this.buildRelationshipGraph(abstractions)
        };
      }
      
      const chapterOrder = JSON.parse(jsonMatch[0]);
      
      // Extract explanation
      const explanationMatch = result.match(/(?:explanation|reasoning|justification):(.*?)(?:\n\n|\[\s*\d+|$)/is);
      const explanation = explanationMatch 
        ? explanationMatch[1].trim() 
        : "Order determined based on dependencies and educational sequence.";
      
      return {
        chapter_order: chapterOrder,
        explanation,
        relationship_graph: this.buildRelationshipGraph(abstractions)
      };
    } catch (error) {
      this.logger.error(`Error parsing chapter order: ${error instanceof Error ? error.message : String(error)}`);
      // Fall back to original order
      return {
        chapter_order: abstractions.map((_, index) => index),
        explanation: "Error occurred during ordering, using default sequence.",
        relationship_graph: this.buildRelationshipGraph(abstractions)
      };
    }
  }
  
  /**
   * Builds a graph representation of relationships between abstractions.
   * @param abstractions - The identified abstractions.
   * @returns Relationship graph object.
   */
  buildRelationshipGraph(abstractions: Abstraction[]): RelationshipGraph {
    const nodes = abstractions.map((abs, index) => ({
      id: index,
      name: abs.name,
      type: abs.type
    }));
    
    const relationships: Relationship[] = [];
    
    // Build edges based on relationships
    abstractions.forEach((abs, fromIndex) => {
      if (!abs.relationships || !Array.isArray(abs.relationships)) return;
      
      abs.relationships.forEach(relName => {
        // Find the related abstraction by name
        const toIndex = abstractions.findIndex(a => a.name === relName);
        if (toIndex !== -1) {
          relationships.push({
            from: fromIndex,
            to: toIndex,
            label: 'related'
          });
        }
      });
    });
    
    return {
      nodes,
      relationships: {
        count: relationships.length,
        details: relationships
      }
    };
  }
  
  /**
   * Updates the shared state with chapter ordering.
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
      abstractions: Abstraction[];
    }, 
    execResult: {
      chapter_order: number[];
      explanation: string;
      relationship_graph: RelationshipGraph;
    }
  ): Promise<SharedState> {
    return {
      ...shared,
      chapter_order: execResult.chapter_order,
      ordering_explanation: execResult.explanation,
      relationship_graph: execResult.relationship_graph
    };
  }
}

export default OrderChapters;
