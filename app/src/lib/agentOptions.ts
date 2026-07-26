import type { JasaSelectOption } from "../components/JasaSelect";
import type { CliDefaults } from "../ipc";
import { AgentEffort, AgentEffortLabel, AgentModel, AgentModelLabel } from "../types";

/** Map a raw model string from the CLI settings (e.g. "claude-fable-5[1m]")
 * to the family name used in jasa's picker; unknown strings pass through. */
const modelFamily = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (lower.includes("fable")) return AgentModelLabel[AgentModel.Fable];
  if (lower.includes("opus")) return AgentModelLabel[AgentModel.Opus];
  if (lower.includes("sonnet")) return AgentModelLabel[AgentModel.Sonnet];
  if (lower.includes("haiku")) return AgentModelLabel[AgentModel.Haiku];
  return raw;
};

const isEffort = (value: string): value is AgentEffort =>
  Object.values(AgentEffort).includes(value as AgentEffort);

export const modelLabel = (model: AgentModel, defaults: CliDefaults): string => {
  if (model !== AgentModel.Default) {
    return AgentModelLabel[model];
  }
  return defaults.model
    ? `Default (${modelFamily(defaults.model)})`
    : AgentModelLabel[AgentModel.Default];
};

export const effortLabel = (effort: AgentEffort, defaults: CliDefaults): string => {
  if (effort !== AgentEffort.Default) {
    return AgentEffortLabel[effort];
  }
  return defaults.effort && isEffort(defaults.effort)
    ? `Default (${AgentEffortLabel[defaults.effort]})`
    : AgentEffortLabel[AgentEffort.Default];
};

export const modelOptions = (defaults: CliDefaults): JasaSelectOption<AgentModel>[] =>
  Object.values(AgentModel).map((model) => ({ value: model, label: modelLabel(model, defaults) }));

export const effortOptions = (defaults: CliDefaults): JasaSelectOption<AgentEffort>[] =>
  Object.values(AgentEffort).map((effort) => ({
    value: effort,
    label: effortLabel(effort, defaults),
  }));
