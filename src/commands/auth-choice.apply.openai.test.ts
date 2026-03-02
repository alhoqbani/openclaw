import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAuthChoiceOpenAI } from "./auth-choice.apply.openai.js";
import {
  createAuthTestLifecycle,
  createExitThrowingRuntime,
  createWizardPrompter,
  setupAuthTestEnv,
} from "./test-wizard-helpers.js";

const loginOpenAICodexOAuth = vi.hoisted(() =>
  vi.fn<() => Promise<OAuthCredentials | null>>(async () => null),
);
vi.mock("./openai-codex-oauth.js", () => ({
  loginOpenAICodexOAuth,
}));

describe("applyAuthChoiceOpenAI", () => {
  const lifecycle = createAuthTestLifecycle([
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_AGENT_DIR",
    "PI_CODING_AGENT_DIR",
  ]);

  afterEach(async () => {
    await lifecycle.cleanup();
  });

  it("returns null for non-openai auth choices", async () => {
    const prompter = createWizardPrompter({}, { defaultSelect: "" });
    const runtime = createExitThrowingRuntime();

    const result = await applyAuthChoiceOpenAI({
      authChoice: "apiKey",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(result).toBeNull();
  });

  it("runs Codex OAuth flow and writes oauth profile", async () => {
    const env = await setupAuthTestEnv("openclaw-openai-codex-");
    lifecycle.setStateDir(env.stateDir);

    loginOpenAICodexOAuth.mockResolvedValueOnce({
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 3600_000,
    });

    const prompter = createWizardPrompter({}, { defaultSelect: "" });
    const runtime = createExitThrowingRuntime();

    const result = await applyAuthChoiceOpenAI({
      authChoice: "openai-codex",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(result).not.toBeNull();
    expect(loginOpenAICodexOAuth).toHaveBeenCalledOnce();

    const codexProfile = result?.config.auth?.profiles?.["openai-codex:default"];
    expect(codexProfile).toMatchObject({
      provider: "openai-codex",
      mode: "oauth",
    });
  });
});
