import { TaskType } from "@/core/types";

export function extractRequestText(body: any): string {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const messageText = messages
    .map((message: any) => {
      if (typeof message?.content === "string") return message.content;
      if (Array.isArray(message?.content)) {
        return message.content.map((part: any) => part?.text ?? "").join(" ");
      }
      return "";
    })
    .join(" ");

  const input = typeof body?.input === "string" ? body.input : "";
  return `${messageText} ${input}`.trim();
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function detectTaskType(text: string): TaskType {
  if (/arsitektur|architecture|microservice|distributed|scal(e|ing)|system design|deploy|refactor besar/i.test(text)) {
    return "coding_heavy";
  }
  if (/analisis|analyze|review|compare|evaluate|audit|ringkas dokumen|dokumen panjang/i.test(text)) {
    return "analysis";
  }
  if (/code|function|implement|debug|fix|buat|tulis|generate|typescript|python|api route/i.test(text)) {
    return "coding_light";
  }
  return "chat";
}

export function estimateOutputTokens(inputTokens: number, taskType: TaskType) {
  const multiplier = {
    chat: 0.45,
    coding_light: 0.8,
    coding_heavy: 1.2,
    analysis: 1
  } satisfies Record<TaskType, number>;
  return Math.max(128, Math.ceil(inputTokens * multiplier[taskType]));
}

export function estimateCost(inputTokens: number, outputTokens: number, inputCostPerMTok: number, outputCostPerMTok: number) {
  return (inputTokens / 1_000_000) * inputCostPerMTok + (outputTokens / 1_000_000) * outputCostPerMTok;
}
