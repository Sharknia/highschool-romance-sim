export const alphaSandboxStatusText = "Alpha Sandbox: fixture generation 활성";

declare global {
  var __VN_MAKER_ALPHA_SANDBOX__: boolean | undefined;
}

export function isAlphaSandboxEnabled(): boolean {
  return globalThis.__VN_MAKER_ALPHA_SANDBOX__ === true;
}
