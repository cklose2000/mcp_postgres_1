/**
 * Logging utility module
 * Provides consistent logging throughout the application
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Current log level setting
 * Can be controlled via environment variable
 */
let currentLogLevel = LogLevel.INFO;

/**
 * Configure the logger
 */
export function configure(options: { level?: LogLevel } = {}) {
  if (options.level) {
    currentLogLevel = options.level;
  }
}

/**
 * Check if a log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  const currentIndex = levels.indexOf(currentLogLevel);
  const targetIndex = levels.indexOf(level);
  
  return targetIndex >= currentIndex;
}

/**
 * Format a log message
 */
function formatMessage(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    // Don't expose passwords or sensitive information in logs
    const safeData = JSON.parse(JSON.stringify(data));
    if (safeData.password) safeData.password = '********';
    if (safeData.DB_PASSWORD) safeData.DB_PASSWORD = '********';
    
    formattedMessage += `\n${JSON.stringify(safeData, null, 2)}`;
  }
  
  return formattedMessage;
}

/**
 * Debug level logging
 */
export function debug(message: string, data?: any) {
  if (shouldLog(LogLevel.DEBUG)) {
    console.debug(formatMessage(LogLevel.DEBUG, message, data));
  }
}

/**
 * Info level logging
 */
export function info(message: string, data?: any) {
  if (shouldLog(LogLevel.INFO)) {
    console.info(formatMessage(LogLevel.INFO, message, data));
  }
}

/**
 * Warning level logging
 */
export function warn(message: string, data?: any) {
  if (shouldLog(LogLevel.WARN)) {
    console.warn(formatMessage(LogLevel.WARN, message, data));
  }
}

/**
 * Error level logging
 */
export function error(message: string, data?: any) {
  if (shouldLog(LogLevel.ERROR)) {
    console.error(formatMessage(LogLevel.ERROR, message, data));
  }
}

// Default export for convenience
export default {
  configure,
  debug,
  info,
  warn,
  error,
  LogLevel
}; 