import BatchNode from './BatchNode.js';
import { SharedState, Abstraction, OllamaService, Chapter } from '../types.js';

interface ChapterItem {
  chapterNumber: number;
  abstractionIndex: number;
  abstraction: Abstraction;
  projectName: string;
  language: string;
}

interface WrittenChapter {
  chapterNumber: number;
  name: string;
  content: string;
}

interface WriteChaptersContext {
  projectName: string;
  language: string;
  abstractions: Abstraction[];
  relationship_graph: SharedState['relationship_graph'];
}

/**
 * Node for writing tutorial chapters based on identified abstractions.
 * Uses parallel processing via BatchNode to generate multiple chapters concurrently.
 */
class WriteChapters extends BatchNode {
  private ollama: OllamaService;
  private chapters_written_so_far: WrittenChapter[];
  private current_context: WriteChaptersContext | null;

  /**
   * Creates a new WriteChapters instance.
   * @param ollamaService - The Ollama service for LLM functionality.
   */
  constructor(ollamaService: OllamaService) {
    super('WriteChapters');
    this.ollama = ollamaService;
    this.chapters_written_so_far = [];
    this.current_context = null;
  }
  
  /**
   * Prepares batch items for chapter generation.
   * @param shared - The shared workflow state.
   * @returns Preparation data with chapter items.
   */
  async prepare(shared: SharedState): Promise<{
    items: ChapterItem[];
    projectName: string;
    language: string;
    abstractions: Abstraction[];
    relationship_graph: SharedState['relationship_graph'];
  }> {
    if (!shared.abstractions || !Array.isArray(shared.abstractions)) {
      throw new Error('No abstractions available for chapter writing');
    }
    
    if (!shared.chapter_order || !Array.isArray(shared.chapter_order)) {
      throw new Error('No chapter order available for chapter writing');
    }
    
    // Reset written chapters
    this.chapters_written_so_far = [];
    
    // Create items for batch processing
    const items = shared.chapter_order.map((abstractionIndex, chapterIndex) => {
      const abstraction = shared.abstractions?.[abstractionIndex];
      
      if (!abstraction) {
        this.logger.error(`Invalid abstraction index: ${abstractionIndex}`);
        return null;
      }
      
      return {
        chapterNumber: chapterIndex + 1,
        abstractionIndex,
        abstraction,
        projectName: shared.projectName || '',
        language: shared.language || 'unknown'
      };
    }).filter((item): item is ChapterItem => item !== null);
    
    return {
      items,
      projectName: shared.projectName || '',
      language: shared.language || 'unknown',
      abstractions: shared.abstractions,
      relationship_graph: shared.relationship_graph
    };
  }
  
  /**
   * Summarizes chapters that have already been written for context in later chapters.
   * @returns Summary of written chapters.
   */
  summarizeWrittenChapters(): string {
    if (this.chapters_written_so_far.length === 0) {
      return "No chapters have been written yet.";
    }
    
    // Sort chapters by chapter number
    const sortedChapters = [...this.chapters_written_so_far].sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    return sortedChapters.map(chapter => {
      // Extract first paragraph as summary
      const firstParagraph = chapter.content.split('\n\n')[0];
      return `Chapter ${chapter.chapterNumber}: ${chapter.name} - ${firstParagraph}`;
    }).join('\n\n');
  }
  
  /**
   * Builds a prompt for LLM to generate a chapter.
   * @param item - The chapter item to generate.
   * @param writtenChaptersSummary - Summary of previously written chapters.
   * @returns The formatted prompt.
   */
  buildChapterPrompt(item: ChapterItem, writtenChaptersSummary: string): string {
    const { abstraction, chapterNumber, projectName, language } = item;
    
    // Find related abstractions
    const relatedAbstractions: Array<{ name: string; type: string; description: string }> = [];
    if (abstraction.relationships && Array.isArray(abstraction.relationships) && this.current_context?.abstractions) {
      for (const relName of abstraction.relationships) {
        const relatedAbs = this.current_context.abstractions.find(abs => abs.name === relName);
        if (relatedAbs) {
          relatedAbstractions.push({
            name: relatedAbs.name,
            type: relatedAbs.type,
            description: relatedAbs.description
          });
        }
      }
    }
    
    return `You are writing a tutorial for a software project named "${projectName}" written in ${language}.
You are now writing Chapter ${chapterNumber}, which focuses on the "${abstraction.name}" ${abstraction.type}.

Here's what you know about "${abstraction.name}":
- Type: ${abstraction.type}
- Description: ${abstraction.description}
- Relationships: ${abstraction.relationships && abstraction.relationships.length > 0 ? abstraction.relationships.join(', ') : 'None'}

${relatedAbstractions.length > 0 ? `Related abstractions:\n${relatedAbstractions.map(rel => `- ${rel.name} (${rel.type}): ${rel.description}`).join('\n')}` : ''}

Previously written chapters:
${writtenChaptersSummary}

Write a comprehensive tutorial chapter that:
1. Explains the purpose and importance of this abstraction
2. Describes how it works and its key components
3. Provides code examples showing its usage
4. Explains how it interacts with related components
5. Includes best practices and common pitfalls

Format your chapter in Markdown, with a main heading, subheadings, code blocks, and explanations.
The chapter should be well-structured, educational, and provide clear guidance for developers.`;
  }
  
  /**
   * Executes generation for a single chapter item.
   * @param item - The chapter item to process.
   * @param context - Additional context data.
   * @returns The generated chapter.
   */
  async executeItem(item: ChapterItem, context: WriteChaptersContext): Promise<Chapter> {
    this.current_context = context;
    
    // Get summaries of chapters written so far
    const writtenChaptersSummary = this.summarizeWrittenChapters();
    
    this.logger.info(`Generating Chapter ${item.chapterNumber}: ${item.abstraction.name}`);
    
    // Generate chapter content
    const prompt = this.buildChapterPrompt(item, writtenChaptersSummary);
    const chapterContent = await this.ollama.call(prompt);
    
    // Store chapter for future context
    this.chapters_written_so_far.push({
      chapterNumber: item.chapterNumber,
      name: item.abstraction.name,
      content: chapterContent
    });
    
    return {
      chapterNumber: item.chapterNumber,
      title: item.abstraction.name,
      abstraction: item.abstraction,
      content: chapterContent
    };
  }
  
  /**
   * Updates the shared state with generated chapters.
   * @param shared - The shared workflow state.
   * @param prepData - Data from preparation phase.
   * @param execResult - Result from execution phase (array of chapters).
   * @returns Updated shared state.
   */
  async postProcess(
    shared: SharedState, 
    prepData: {
      items: ChapterItem[];
      projectName: string;
      language: string;
      abstractions: Abstraction[];
      relationship_graph: SharedState['relationship_graph'];
    }, 
    execResult: Chapter[]
  ): Promise<SharedState> {
    // Sort chapters by chapter number
    const chapters = execResult.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    return {
      ...shared,
      chapters
    };
  }
}

export default WriteChapters;
