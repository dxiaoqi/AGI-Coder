import Node from './Node.js';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { SharedState, FileInfo, CodebaseStats, LocalFileReaderConfig } from '../types.js';

/**
 * Node for scanning a local codebase directory and reading files.
 * Applies filtering based on file extensions and excludes specified directories.
 */
class LocalFileReader extends Node {
  private fileExtensions: string[];
  private excludeDirs: string[];
  private maxFileSize: number;

  /**
   * Creates a new LocalFileReader instance.
   * @param config - Configuration options.
   */
  constructor(config: LocalFileReaderConfig = {}) {
    super('LocalFileReader');
    this.fileExtensions = config.fileExtensions || ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp'];
    this.excludeDirs = config.excludeDirs || ['node_modules', 'dist', 'build', '.git'];
    this.maxFileSize = config.maxFileSize || 1024 * 1024; // 1MB
  }
  
  /**
   * Prepares the scan by validating and normalizing the input path.
   * @param shared - The shared workflow state.
   * @returns Preparation data including the path to scan.
   */
  async prepare(shared: SharedState): Promise<{ targetPath: string; projectName: string }> {
    if (!shared.targetPath) {
      throw new Error('Target path not specified');
    }
    
    // Resolve the target path to an absolute path
    const targetPath = path.resolve(shared.targetPath);
    
    // Check if the path exists
    if (!await fs.pathExists(targetPath)) {
      throw new Error(`Target path does not exist: ${targetPath}`);
    }
    
    // Check if the path is a directory
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${targetPath}`);
    }
    
    return {
      targetPath,
      projectName: shared.projectName || path.basename(targetPath)
    };
  }
  
  /**
   * Scans the directory recursively and reads the content of matching files.
   * @param prepData - Preparation data including the path to scan.
   * @returns Object containing file data and statistics.
   */
  async execute(prepData: { targetPath: string; projectName: string }): Promise<{
    projectName: string;
    targetPath: string;
    files: FileInfo[];
    stats: CodebaseStats;
  }> {
    const { targetPath, projectName } = prepData;
    
    this.logger.info(`Scanning directory: ${targetPath}`);
    
    // Build glob patterns for file extensions
    const patterns = this.fileExtensions.map(ext => `**/*${ext}`);
    
    // Build ignore patterns for excluded directories
    const ignorePatterns = this.excludeDirs.map(dir => `**/${dir}/**`);
    
    // Find all matching files
    const files = await glob(patterns, {
      cwd: targetPath,
      ignore: ignorePatterns,
      nodir: true,
      absolute: true
    });
    
    this.logger.info(`Found ${files.length} files matching patterns`);
    
    // Read file contents and collect metadata
    const fileData = await Promise.all(
      files.map(async (filePath) => {
        try {
          const relativePath = path.relative(targetPath, filePath);
          const stats = await fs.stat(filePath);
          
          // Skip files that are too large
          if (stats.size > this.maxFileSize) {
            this.logger.warn(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
            return {
              path: relativePath,
              absolutePath: filePath,
              size: stats.size,
              extension: path.extname(filePath),
              content: `[File too large: ${stats.size} bytes]`,
              isTooLarge: true
            };
          }
          
          // Read file content
          const content = await fs.readFile(filePath, 'utf8');
          
          return {
            path: relativePath,
            absolutePath: filePath,
            size: stats.size,
            extension: path.extname(filePath),
            content,
            isTooLarge: false
          };
        } catch (error) {
          this.logger.error(`Error reading file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
          return {
            path: path.relative(targetPath, filePath),
            absolutePath: filePath,
            error: error instanceof Error ? error.message : String(error),
            size: 0,
            extension: path.extname(filePath),
            content: ''
          };
        }
      })
    );
    
    // Calculate statistics
    const validFiles = fileData.filter(file => !file.error && !file.isTooLarge);
    const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    const extensionCounts: Record<string, number> = validFiles.reduce((counts, file) => {
      const ext = file.extension;
      counts[ext] = (counts[ext] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return {
      projectName,
      targetPath,
      files: fileData,
      stats: {
        totalFiles: files.length,
        validFiles: validFiles.length,
        totalSize,
        extensionCounts
      }
    };
  }
  
  /**
   * Updates the shared state with the file data and statistics.
   * @param shared - The shared workflow state.
   * @param prepData - Data from preparation phase.
   * @param execResult - Result from execution phase.
   * @returns Updated shared state.
   */
  async postProcess(
    shared: SharedState, 
    prepData: { targetPath: string; projectName: string }, 
    execResult: {
      projectName: string;
      targetPath: string;
      files: FileInfo[];
      stats: CodebaseStats;
    }
  ): Promise<SharedState> {
    return {
      ...shared,
      projectName: execResult.projectName,
      targetPath: execResult.targetPath,
      files: execResult.files,
      stats: execResult.stats
    };
  }
}

export default LocalFileReader;
