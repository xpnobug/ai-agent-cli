import { format } from 'node:util';

type WriteFn = typeof process.stdout.write;
type WriteChunk = Parameters<WriteFn>[0];
type WriteEncoding = BufferEncoding;
type WriteCallback = (err?: Error | null) => void;

type GuardHandle = {
  writeAcpLine: (line: string) => void;
  restore: () => void;
  originalStdoutWrite: WriteFn;
};

function writeTo(
  write: WriteFn,
  chunk: WriteChunk,
  encoding?: WriteEncoding | WriteCallback,
  cb?: WriteCallback,
): boolean {
  if (typeof encoding === 'function') {
    return write(chunk, encoding);
  }
  return write(chunk, encoding, cb);
}

export function installStdoutGuard(): GuardHandle {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const originalConsoleLog = console.log.bind(console);
  const originalConsoleInfo = console.info.bind(console);
  const originalConsoleDebug = console.debug.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleError = console.error.bind(console);

  const writeAcpLine = (line: string) => {
    writeTo(originalStdoutWrite, `${line}\n`);
  };

  const writeLogToStderr = (...args: unknown[]) => {
    writeTo(originalStderrWrite, `${format(...args)}\n`);
  };

  console.log = writeLogToStderr as typeof console.log;
  console.info = writeLogToStderr as typeof console.info;
  console.debug = writeLogToStderr as typeof console.debug;
  console.warn = writeLogToStderr as typeof console.warn;
  console.error = writeLogToStderr as typeof console.error;

  process.stdout.write = ((chunk: WriteChunk, encoding?: WriteEncoding | WriteCallback, cb?: WriteCallback) => {
    return writeTo(originalStderrWrite, chunk, encoding, cb);
  }) as WriteFn;

  const restore = () => {
    process.stdout.write = originalStdoutWrite;
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  };

  return { writeAcpLine, restore, originalStdoutWrite };
}
