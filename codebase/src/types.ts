/**
 * Shared state types that will be passed between nodes in the workflow
 */

/**
 * File information with metadata and content
 */
export interface FileInfo {
  path: string;
  absolutePath: string;
  size: number;
  extension: string;
  content: string;
  isTooLarge?: boolean;
  error?: string;
  isChunked?: boolean;
  chunks?: string[];
  chunkCount?: number;
}

/**
 * Statistics about the codebase
 */
export interface CodebaseStats {
  totalFiles: number;
  validFiles: number;
  totalSize: number;
  extensionCounts: Record<string, number>;
}

/**
 * Abstract representation of a code component
 */
export interface Abstraction {
  name: string;
  type: string;
  description: string;
  relationships: string[];
}

/**
 * Graph node for relationship visualization
 */
export interface GraphNode {
  id: number;
  name: string;
  type: string;
}

/**
 * Relationship between abstractions
 */
export interface Relationship {
  from: number;
  to: number;
  label: string;
}

/**
 * Complete relationship graph
 */
export interface RelationshipGraph {
  nodes: GraphNode[];
  relationships: {
    count: number;
    details: Relationship[];
  };
}

/**
 * Chapter content
 */
export interface Chapter {
  chapterNumber: number;
  title: string;
  abstraction: Abstraction;
  content: string;
}

/**
 * Tutorial output information
 */
export interface TutorialOutput {
  outputDir: string;
  indexPath: string;
  chapterPaths: string[];
}

/**
 * OllamaService interface for LLM functionality
 */
export interface OllamaService {
  call(prompt: string, options?: any): Promise<string>;
  processBatches(
    chunks: string[],
    processor: (chunk: string) => Promise<string>,
    chunkContext?: string
  ): Promise<string[]>;
}

/**
 * Shared state that is passed through the workflow
 */
export interface SharedState {
  targetPath?: string;
  projectName?: string;
  files?: FileInfo[];
  stats?: CodebaseStats;
  chunkedFiles?: FileInfo[];
  needsChunkedProcessing?: boolean;
  language?: string;
  abstractions?: Abstraction[];
  chapter_order?: number[];
  ordering_explanation?: string;
  relationship_graph?: RelationshipGraph;
  chapters?: Chapter[];
  tutorial?: TutorialOutput;
}

/**
 * Configuration for Ollama service
 */
export interface OllamaConfig {
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Configuration for LocalFileReader
 */
export interface LocalFileReaderConfig {
  fileExtensions?: string[];
  excludeDirs?: string[];
  maxFileSize?: number;
}

/**
 * Configuration for TextChunker
 */
export interface TextChunkerConfig {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Configuration for CombineTutorial
 */
export interface CombineTutorialConfig {
  outputDir?: string;
} 