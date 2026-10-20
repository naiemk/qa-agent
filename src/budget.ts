import type { ModelClient } from "./model/index.ts";

export class BudgetExceeded extends Error {}

/** Token and wall-clock budget for a CI run (exit code 4 when spent). */
export interface Budget {
  tokens: { model: number; magpi: number };
  costUsd: number;
  browserActions: number;
  started: number;
  maxTokens?: number;
  maxMinutes?: number;
  check(): void;
}

export function createBudget(options: { maxTokens?: number; maxMinutes?: number } = {}): Budget {
  return {
    tokens: { model: 0, magpi: 0 },
    costUsd: 0,
    browserActions: 0,
    started: Date.now(),
    ...options,
    check() {
      const used = this.tokens.model + this.tokens.magpi;
      if (this.maxTokens !== undefined && used >= this.maxTokens) throw new BudgetExceeded(`token budget spent (${used} >= ${this.maxTokens})`);
      const minutes = (Date.now() - this.started) / 60_000;
      if (this.maxMinutes !== undefined && minutes >= this.maxMinutes) throw new BudgetExceeded(`time budget spent (${minutes.toFixed(1)} >= ${this.maxMinutes} min)`);
    },
  };
}

export function meteredModel(model: ModelClient, budget: Budget): ModelClient {
  return {
    name: model.name,
    async completeJson(request) {
      budget.check();
      const result = await model.completeJson(request);
      budget.tokens.model += result.usage.inputTokens + result.usage.outputTokens;
      return result;
    },
  };
}
