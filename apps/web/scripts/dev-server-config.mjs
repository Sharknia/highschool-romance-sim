export const DEFAULT_WEB_API_PORT = "5174";
export const DEFAULT_WEB_VITE_PORT = "5173";

function firstConfiguredEnv(env, names) {
  for (const name of names) {
    if (env[name]) {
      return env[name];
    }
  }
  return undefined;
}

export function resolveWebDevServerConfig(env = process.env) {
  const apiPort = firstConfiguredEnv(env, ["API_PORT", "VITE_API_PORT", "PORT"]) || DEFAULT_WEB_API_PORT;
  const vitePort = env.VITE_PORT || DEFAULT_WEB_VITE_PORT;
  return {
    apiPort,
    vitePort,
    apiTarget: `http://127.0.0.1:${apiPort}`
  };
}
