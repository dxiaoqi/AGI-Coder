import chalk from 'chalk';

/**
 * Utility class for consistent logging throughout the application
 */
class Logger {
  private name: string;

  /**
   * Creates a new Logger instance
   * @param name - The name of the component for identification in logs
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Formats a message with timestamp and component name
   * @param message - The message to format
   * @returns Formatted message with timestamp and component name
   */
  format(message: string): string {
    return `[${new Date().toISOString()}] [${this.name}] ${message}`;
  }

  /**
   * Logs an informational message
   * @param message - The message to log
   */
  info(message: string): void {
    console.log(chalk.blue(this.format(message)));
  }

  /**
   * Logs a success message
   * @param message - The message to log
   */
  success(message: string): void {
    console.log(chalk.green(this.format(message)));
  }

  /**
   * Logs a warning message
   * @param message - The message to log
   */
  warn(message: string): void {
    console.log(chalk.yellow(this.format(message)));
  }

  /**
   * Logs an error message
   * @param message - The message to log
   */
  error(message: string): void {
    console.error(chalk.red(this.format(message)));
  }
}

export default Logger; 