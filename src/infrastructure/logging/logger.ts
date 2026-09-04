export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

function write(stream: NodeJS.WriteStream, level: 'info' | 'error', message: string, fields?: LogFields): void {
  stream.write(`${JSON.stringify({ level, message, time: new Date().toISOString(), ...fields })}\n`);
}

export function createConsoleLogger(): Logger {
  return {
    info: (message, fields) => write(process.stdout, 'info', message, fields),
    error: (message, fields) => write(process.stderr, 'error', message, fields),
  };
}
