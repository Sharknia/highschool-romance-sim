import type {
  VisualNovelKeyValueStorage,
  VisualNovelLogger,
  VisualNovelPlatform,
  VisualNovelPlatformOptions
} from "./types";

const noopLogger: VisualNovelLogger = {
  error() {},
  warn() {},
  info() {}
};

function getGlobalRecord(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function getDefaultLogger(): VisualNovelLogger {
  const globalConsole = getGlobalRecord().console as Partial<VisualNovelLogger> | undefined;

  return {
    error: typeof globalConsole?.error === "function" ? globalConsole.error.bind(globalConsole) : noopLogger.error,
    warn: typeof globalConsole?.warn === "function" ? globalConsole.warn.bind(globalConsole) : noopLogger.warn,
    info: typeof globalConsole?.info === "function" ? globalConsole.info.bind(globalConsole) : noopLogger.info
  };
}

function getDefaultStorage(): VisualNovelKeyValueStorage | null {
  try {
    const localStorage = getGlobalRecord().localStorage as VisualNovelKeyValueStorage | undefined;
    return localStorage || null;
  } catch {
    return null;
  }
}

function getDefaultElementFactory(): ((tagName: string) => unknown) | undefined {
  try {
    const documentLike = getGlobalRecord().document as { createElement?: (tagName: string) => unknown } | undefined;

    if (typeof documentLike?.createElement !== "function") {
      return undefined;
    }

    return documentLike.createElement.bind(documentLike);
  } catch {
    return undefined;
  }
}

function getDefaultAlert(): (message: string) => void {
  const globalAlert = getGlobalRecord().alert;

  if (typeof globalAlert === "function") {
    return globalAlert.bind(getGlobalRecord()) as (message: string) => void;
  }

  return noopLogger.info;
}

function getDefaultTimer(): (callback: () => void, delayMs: number) => unknown {
  const globalSetTimeout = getGlobalRecord().setTimeout;

  if (typeof globalSetTimeout === "function") {
    return globalSetTimeout.bind(getGlobalRecord()) as (callback: () => void, delayMs: number) => unknown;
  }

  return (callback: () => void) => {
    callback();
    return undefined;
  };
}

export function createDefaultVisualNovelPlatform(options: VisualNovelPlatformOptions = {}): VisualNovelPlatform {
  const now = options.now || (() => Date.now());

  return {
    now,
    createSaveTimestamp: options.createSaveTimestamp || (() => new Date(now()).toISOString()),
    setTimeout: options.setTimeout || getDefaultTimer(),
    logger: options.logger || getDefaultLogger(),
    alert: options.alert || getDefaultAlert(),
    createElement: options.createElement || getDefaultElementFactory(),
    getStorage: options.getStorage || getDefaultStorage
  };
}
