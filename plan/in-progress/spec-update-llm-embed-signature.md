---
worktree: embedding-model-ux-c40698
started: 2026-06-06
owner: resolution-applier
---
# Spec Update Draft — llm-embed-signature

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) + spec 결함(기술 오류 — config 인자 누락)

## 원본 발견사항

SUMMARY#8: [SPEC-DRIFT] `spec/5-system/7-llm-client.md §3.3` 의 `LlmService.embed` 시그니처 기술이 `opts` 파라미터를 누락 — 코드가 옳고 spec 기술이 낡음.

INFO-19: `spec/5-system/8-embedding-pipeline.md §5.4` 의 `LlmService.embed` 인자 순서 기술이 실제 시그니처(`config` 첫 번째 인자 등)와 미미하게 어긋남.

## 제안 변경

### `spec/5-system/7-llm-client.md §3.3` (SPEC-DRIFT — opts 추가)

NOTE: §3.3 은 `LLMClient` 인터페이스를 기술한다. `LlmService.embed` 는 §8 에 해당하므로
`LlmService.embed` 의 `opts` 파라미터는 §8.3 service layer 기술에 추가한다.

Before (§8.3 의 `LlmService` pseudo-code):
```typescript
class LlmService {
  // 기존 chat / embed / testConnection / resolveConfig 유지
  ...
}
```

After (§8.3 에 embed 시그니처 명시 추가):
```typescript
class LlmService {
  /** 배치 임베딩. 20개 단위 chunking + 재시도 내장.
   * @param opts.timeoutMs   배치당 timeout (ms). 0/생략 = 무제한.
   * @param opts.disableInnerRetry  외부 재시도 루프가 제어권을 갖는 경우 내부 withRetry 비활성화.
   * @param inputType  기본값 'document'. 검색 query 경로만 'query'.
   */
  embed(
    config: LlmConfig,
    texts: string[],
    model?: string,
    opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>,
    inputType?: 'query' | 'document',   // 생략 시 'document'
  ): Promise<number[][]>;
  // 기존 chat / testConnection / resolveConfig 유지
  ...
}
```

### `spec/5-system/8-embedding-pipeline.md §5.4` (spec 결함 — config 인자 누락)

Before:
```
`LlmService.embed(texts, model, opts, inputType)` 의 `inputType`(...)
```

After:
```
`LlmService.embed(config, texts, model?, opts?, inputType)` 의 `inputType`(...)
```
