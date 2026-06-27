/**
 * `listModels` / `GET :id/models` 의 `type` 필터 허용값 **단일 출처(SOT)**.
 *
 * - 런타임 객체 `MODEL_TYPE_ENUM` — 컨트롤러 `ParseEnumPipe`(허용값 외 400) 와
 *   `@ApiQuery({ enum, enumName })` 가 사용한다.
 * - 파생 유니온 `ModelTypeFilter` — `LlmService.listModels` 의 `opts.type` 타입.
 *
 * 값은 `ModelInfo['type']`(`llm/interfaces/llm-client.interface.ts`) 와 일치한다
 * (chat / embedding). rerank 는 모델 목록 필터 대상이 아니라 제외.
 */
export const MODEL_TYPE_ENUM = {
  chat: 'chat',
  embedding: 'embedding',
} as const;

export type ModelTypeFilter =
  (typeof MODEL_TYPE_ENUM)[keyof typeof MODEL_TYPE_ENUM];
