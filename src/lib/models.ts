/**
 * Human-readable credit for the model that wrote a daily brief. The pipeline
 * stores the id of the model that actually served the request: an OpenRouter
 * free model such as "upstage/solar-pro-3:free" (picked by OpenRouter's Free
 * Router), or a Claude model id.
 */
export function describeModel(model: string): { name: string; via: string | null } {
  if (model.endsWith(":free")) {
    return { name: model.slice(0, -":free".length), via: "free model via OpenRouter" };
  }
  if (model.startsWith("claude-")) return { name: model, via: "Anthropic" };
  return { name: model, via: null };
}
