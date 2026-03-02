import { createAuthChoiceAgentModelNoter } from "./auth-choice.apply-helpers.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { isRemoteEnvironment } from "./oauth-env.js";
import { applyAuthProfileConfig, writeOAuthCredentials } from "./onboard-auth.js";
import { openUrl } from "./onboard-helpers.js";
import {
  applyOpenAICodexModelDefault,
  OPENAI_CODEX_DEFAULT_MODEL,
} from "./openai-codex-model-default.js";
import { loginOpenAICodexOAuth } from "./openai-codex-oauth.js";

export async function applyAuthChoiceOpenAI(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  const noteAgentModel = createAuthChoiceAgentModelNoter(params);

  if (params.authChoice === "openai-codex") {
    let nextConfig = params.config;
    let agentModelOverride: string | undefined;

    let creds;
    try {
      creds = await loginOpenAICodexOAuth({
        prompter: params.prompter,
        runtime: params.runtime,
        isRemote: isRemoteEnvironment(),
        openUrl: async (url) => {
          await openUrl(url);
        },
        localBrowserMessage: "Complete sign-in in browser…",
      });
    } catch {
      // The helper already surfaces the error to the user.
      // Keep onboarding flow alive and return unchanged config.
      return { config: nextConfig, agentModelOverride };
    }
    if (creds) {
      const profileId = await writeOAuthCredentials("openai-codex", creds, params.agentDir, {
        syncSiblingAgents: true,
      });
      nextConfig = applyAuthProfileConfig(nextConfig, {
        profileId,
        provider: "openai-codex",
        mode: "oauth",
      });
      if (params.setDefaultModel) {
        const applied = applyOpenAICodexModelDefault(nextConfig);
        nextConfig = applied.next;
        if (applied.changed) {
          await params.prompter.note(
            `Default model set to ${OPENAI_CODEX_DEFAULT_MODEL}`,
            "Model configured",
          );
        }
      } else {
        agentModelOverride = OPENAI_CODEX_DEFAULT_MODEL;
        await noteAgentModel(OPENAI_CODEX_DEFAULT_MODEL);
      }
    }
    return { config: nextConfig, agentModelOverride };
  }

  return null;
}
