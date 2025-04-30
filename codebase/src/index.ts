#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import chalk from 'chalk';

// Import workflow and nodes
import Workflow from './Workflow.js';
import LocalFileReader from './nodes/LocalFileReader.js';
import TextChunker from './nodes/TextChunker.js';
import IdentifyAbstractions from './nodes/IdentifyAbstractions.js';
import OrderChapters from './nodes/OrderChapters.js';
import WriteChapters from './nodes/WriteChapters.js';
import CombineTutorial from './nodes/CombineTutorial.js';
import OllamaService from './services/OllamaService.js';
import { SharedState } from './types.js';

// Define CLI arguments interface
interface CliArgs {
  target: string;
  output: string;
  'project-name'?: string;
  model: string;
  'chunk-size': number;
  'ollama-url': string;
  [key: string]: unknown;
}

// Create CLI
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('target', {
    alias: 't',
    describe: 'Target directory to analyze',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: 'Output directory for tutorial',
    type: 'string',
    default: './tutorial'
  })
  .option('project-name', {
    alias: 'p',
    describe: 'Project name',
    type: 'string'
  })
  .option('model', {
    alias: 'm',
    describe: 'Ollama model to use',
    type: 'string',
    default: 'llama2'
  })
  .option('chunk-size', {
    alias: 'c',
    describe: 'Maximum chunk size for processing',
    type: 'number',
    default: 8000
  })
  .option('ollama-url', {
    describe: 'Ollama API base URL',
    type: 'string',
    default: 'http://localhost:11434'
  })
  .example('$0 -t ./my-project -o ./docs/tutorial -p "My Project"', 'Generate tutorial for ./my-project')
  .help()
  .alias('help', 'h')
  .epilog('For more information, visit https://github.com/yourusername/codebase-tutorial-generator')
  .parseSync() as CliArgs;

/**
 * Main function to run the tutorial generation workflow.
 */
async function main(): Promise<void> {
  try {
    console.log(chalk.blue('=== AI-Driven Codebase Tutorial Generator ==='));
    
    // Validate and normalize paths
    const targetPath = path.resolve(argv.target);
    const outputDir = path.resolve(argv.output);
    
    console.log(chalk.blue(`Analyzing codebase: ${targetPath}`));
    console.log(chalk.blue(`Output directory: ${outputDir}`));
    
    // Initialize Ollama service
    const ollamaService = new OllamaService({
      model: argv.model,
      baseUrl: argv['ollama-url']
    });
    
    console.log(chalk.blue(`Using Ollama model: ${argv.model}`));
    
    // Create workflow nodes
    const localFileReader = new LocalFileReader();
    const textChunker = new TextChunker({
      chunkSize: argv['chunk-size']
    });
    const identifyAbstractions = new IdentifyAbstractions(ollamaService);
    const orderChapters = new OrderChapters(ollamaService);
    const writeChapters = new WriteChapters(ollamaService);
    const combineTutorial = new CombineTutorial({
      outputDir
    });
    
    // Create workflow
    const workflow = new Workflow([
      localFileReader,
      textChunker,
      identifyAbstractions,
      orderChapters,
      writeChapters,
      combineTutorial
    ]);
    
    // Initial state
    const initialState: SharedState = {
      targetPath,
      projectName: argv['project-name'] || path.basename(targetPath)
    };
    
    // Run workflow
    console.log(chalk.blue('Starting tutorial generation workflow...'));
    const result = await workflow.run(initialState);
    
    // Output results
    console.log(chalk.green('\n✅ Tutorial generation completed successfully!'));
    console.log(chalk.green(`Tutorial index: ${result.tutorial?.indexPath}`));
    console.log(chalk.green(`Generated ${result.tutorial?.chapterPaths?.length} chapters`));
    
    // Print some stats
    if (result.stats) {
      console.log(chalk.yellow('\nProject Statistics:'));
      console.log(chalk.yellow(`- Total Files: ${result.stats.totalFiles}`));
      console.log(chalk.yellow(`- Total Size: ${Math.round(result.stats.totalSize / 1024)} KB`));
    }
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    process.exit(1);
  }
}

// Run the program
main(); 