# AI-Driven Codebase Tutorial Generator

A powerful TypeScript tool for automatically generating comprehensive tutorials from your codebase. Using the Ollama API for local LLM inference, this tool analyzes your project structure and produces well-organized, educational documentation to help developers quickly understand complex codebases.

## Features

- **Intelligent Code Analysis**: Automatically extracts key abstractions and their relationships from your code
- **Smart Content Chunking**: Handles large codebases efficiently by breaking them into semantically meaningful chunks
- **Parallel Processing**: Generates multiple chapters concurrently for faster results
- **Mermaid Diagrams**: Creates visual representations of component relationships
- **Local Privacy**: Uses Ollama for 100% local inference, keeping your code private
- **Language Agnostic**: Works with multiple programming languages (JavaScript, TypeScript, Python, Java, etc.)
- **Type Safety**: Built with TypeScript for better code reliability and developer experience

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/codebase-tutorial-generator
cd codebase-tutorial-generator

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Make the CLI executable
chmod +x dist/index.js

# Optionally, link for global usage
npm link
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v14.0.0 or higher)
- [Ollama](https://ollama.com/) running locally with your preferred model

## Usage

```bash
# Basic usage
npm start -- -t /path/to/your/project -o ./output/tutorial

# Or use the built JavaScript directly
node dist/index.js -t /path/to/your/project -o ./output/tutorial

# With custom project name and model
npm start -- -t /path/to/your/project -o ./output/tutorial -p "My Amazing Project" -m codellama:7b

# Development mode (using ts-node)
npm run dev -- -t /path/to/your/project -o ./output/tutorial
```

### Command Line Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| --target | -t | Target directory to analyze | (Required) |
| --output | -o | Output directory for tutorial | ./tutorial |
| --project-name | -p | Project name | (Directory name) |
| --model | -m | Ollama model to use | llama2 |
| --chunk-size | -c | Maximum chunk size for processing | 8000 |
| --ollama-url | | Ollama API base URL | http://localhost:11434 |
| --help | -h | Show help | |

## Recommended Models

Based on testing, here are some recommended models for different languages:

- **JavaScript/TypeScript**: codellama:7b
- **Python**: wizardcoder:13b
- **General multi-language**: mistral:7b
- **Complex systems**: llama3:70b (slower but more comprehensive)

## Output

The generator produces a structured tutorial with:

1. An index file with table of contents and project overview
2. Individual chapter files for each key abstraction
3. Mermaid diagrams showing component relationships
4. Navigation links between chapters

## Architecture

The tool uses a node-based workflow architecture written in TypeScript:

1. **LocalFileReader**: Scans and reads project files
2. **TextChunker**: Intelligently chunks large files
3. **IdentifyAbstractions**: Identifies key components and relationships
4. **OrderChapters**: Determines optimal learning sequence
5. **WriteChapters**: Generates detailed explanations for each abstraction
6. **CombineTutorial**: Compiles everything into a cohesive tutorial

## Development

This project is built with TypeScript for improved code quality and developer experience. To contribute:

```bash
# Install dependencies
npm install

# Run in development mode (ts-node)
npm run dev -- -t /path/to/your/project

# Type check without compilation
npx tsc --noEmit

# Build JavaScript files
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 