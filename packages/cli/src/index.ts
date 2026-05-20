#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  sharedCodexAppServerClient,
  type CodexImageGenerationInput
} from "@vn-maker/generation-codex";
import {
  buildProjectHtml,
  createAssetManifest,
  createImageGenerationJob,
  createStarterProject,
  validateProject,
  type CreateImageGenerationJobInput,
  type VnMakerProject
} from "@vn-maker/engine-core";

interface CliInput {
  project?: VnMakerProject;
  outputPath?: string;
  job?: CreateImageGenerationJobInput;
  image?: CodexImageGenerationInput;
  login?: {
    flow?: "browser" | "device";
  };
  starter?: {
    id?: string;
    title?: string;
    premise?: string;
  };
}

function readStdin(): string {
  return readFileSync(0, "utf8").trim();
}

function parseInput(): CliInput {
  const raw = readStdin();
  return raw ? JSON.parse(raw) as CliInput : {};
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function getProject(input: CliInput): VnMakerProject {
  return input.project || createStarterProject(input.starter);
}

function printCapabilities(): void {
  writeJson({
    ok: true,
    commands: [
      "inspect",
      "create-starter",
      "validate",
      "manifest",
      "build-html",
      "create-image-job",
      "codex-auth-status",
      "codex-login",
      "codex-logout",
      "generate-image"
    ],
    io: "stdin-json/stdout-json",
    purpose: "Codex/AI가 VN Maker Core를 안정적으로 호출하기 위한 기계용 인터페이스"
  });
}

async function run(): Promise<void> {
  const command = process.argv[2] || "inspect";

  if (command === "inspect") {
    printCapabilities();
    return;
  }

  const input = parseInput();

  if (command === "create-starter") {
    writeJson({ ok: true, project: createStarterProject(input.starter) });
    return;
  }

  if (command === "validate") {
    const issues = validateProject(getProject(input));
    writeJson({ ok: issues.every((issue) => issue.severity !== "error"), issues });
    return;
  }

  if (command === "manifest") {
    writeJson({ ok: true, manifest: createAssetManifest(getProject(input)) });
    return;
  }

  if (command === "build-html") {
    const artifact = buildProjectHtml(getProject(input));
    if (input.outputPath) {
      writeFileSync(input.outputPath, artifact.html, "utf8");
    }
    writeJson({ ok: true, artifact });
    return;
  }

  if (command === "create-image-job") {
    if (!input.job) {
      throw new Error("job 입력이 필요합니다.");
    }
    writeJson({ ok: true, job: createImageGenerationJob(input.job) });
    return;
  }

  if (command === "codex-auth-status") {
    writeJson({ ok: true, session: await sharedCodexAppServerClient.readSession(false) });
    return;
  }

  if (command === "codex-login") {
    writeJson({ ok: true, login: await sharedCodexAppServerClient.startLogin(input.login?.flow || "browser") });
    return;
  }

  if (command === "codex-logout") {
    await sharedCodexAppServerClient.logout();
    writeJson({ ok: true });
    return;
  }

  if (command === "generate-image") {
    if (!input.image) {
      throw new Error("image 입력이 필요합니다.");
    }

    const result = await sharedCodexAppServerClient.generateImageAsset(input.image);
    writeJson({ ok: true, result });
    return;
  }

  throw new Error(`알 수 없는 명령입니다: ${command}`);
}

run().catch((error: unknown) => {
  writeJson({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}).finally(() => {
  sharedCodexAppServerClient.close();
});
