# 신규 식별자 충돌 검토 결과

## 발견사항

- **[INFO]** `LlmCallOptions` 타입명 — spec 최초 도입, 코드와 정합
  - target 신규 식별자: `LlmCallOptions` (Pick 대상 타입으로 spec §8.3 에 등장)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm.service.ts:42` — 코드에 이미 정의·사용 중. 다른 spec 파일에는 미등장.
  - 상세: target 이 spec 에 처음 명시하는 것이며, 코드의 기존 정의와 의미가 일치한다. 충돌 없음. 다만 `LlmCallOptions` 자체 전체 인터페이스(chat 경로의 `timeoutMs`, `disableInnerRetry`, `context?` 등)는 현재 spec 어디에도 정의되어 있지 않으므로, `Pick<LlmCallOptions, ...>` 참조만으로는 독자가 전체 타입을 유추할 수 없다. spec §3 또는 §8 에 `LlmCallOptions` 의 최소 인터페이스 정의를 추가하거나, "코드 SoT — `src/modules/llm/llm.service.ts`" 각주를 달아 독자를 안내하면 완전해진다.
  - 제안: 충돌은 없으나 spec 문서에 `LlmCallOptions` 인터페이스 스텁(또는 참조 주석)을 추가해 `Pick` 참조가 자기 완결되도록 보완.

- **[INFO]** `inputType?: 'query' | 'document'` 파라미터 — spec + 코드 양쪽 모두 신규
  - target 신규 식별자: `inputType` 파라미터 (`'query' | 'document'` 타입)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/order/orderform-properties.md` 에 `input_type`(snake_case) 이 존재하나, Cafe24 주문서 추가항목 UI 입력 형식 enum(`T`/`M`/`R`/`C`/`S`/`D`/`I`)이며 LLM 임베딩 도메인과 완전히 다름 — 충돌 아님. `llm.service.ts` 의 현재 `embed()` 시그니처(라인 194–216)에는 `inputType` 파라미터가 없다. target 이 spec 에 추가하는 것은 코드에 아직 반영되지 않은 기능이다.
  - 상세: spec draft 가 `inputType` 을 코드보다 먼저 선언하는 형태다. spec-drift 방향이 아니라 spec 선행 기술이므로 충돌이 아니라 신규 약속이다.
  - 제안: 코드 구현 전 spec 에 "구현 예정(Planned)" 또는 "코드 반영 전" 표기를 추가해 현재 코드와의 갭을 명시하면 혼선을 막을 수 있다.

- **[WARNING]** `spec/5-system/8-embedding-pipeline.md §5.4` — 존재하지 않는 섹션 참조
  - target 신규 식별자: 참조 위치 `§5.4`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md` — 현재 §5 아래 §5.1·§5.2·§5.3 만 존재하며 §5.4 는 없다.
  - 상세: target 의 "Before" 절이 `§5.4 의 LlmService.embed(texts, model, opts, inputType)` 기술을 수정한다고 설명하지만, 현재 파일에 그 텍스트 자체가 없다. target 이 기존 텍스트를 수정하는 것이 아니라 새 §5.4 를 신설하는 작업임에도 "Before/After" 형식으로 기술되어 혼동을 유발한다.
  - 제안: "Before" 를 "(현재 §5.4 없음 — 신설)" 로 명확히 기재하거나, 섹션 제목(`### 5.4 서비스 레이어 embed 시그니처`)을 포함한 완전한 "After" 텍스트를 target 에 제시하면 구현자가 오해 없이 적용할 수 있다.

- **[INFO]** `spec/5-system/7-llm-client.md §8.3` 의 `LlmService` 코드 블록 — 기존 내용과 통합 방향 확인 필요
  - target 신규 식별자: `embed(config, texts, model?, opts?, inputType?)` 시그니처를 §8.3 서비스 레이어 pseudo-code 에 추가
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` §8.3 (라인 375–389) — 현재 `LlmService` 블록에 `// 기존 chat / embed / testConnection / resolveConfig 유지` 주석만 있고 `embed` 시그니처가 명시되어 있지 않다.
  - 상세: target 이 §8.3 에 `embed` 시그니처를 명시 추가하는 것은 기존 내용과 상충하지 않는다. 다만 §3.3(`LLMClient` 인터페이스 레벨 embed 시그니처 — `embed(texts, model?)`) 과 §8.3 에 추가될 `LlmService.embed(config, texts, model?, opts?, inputType?)` 가 동일 문서에 다른 계층 시그니처로 공존하게 된다. 두 시그니처는 인터페이스 vs 서비스 계층으로 역할이 다르므로 충돌이 아니나, 독자 혼란 방지를 위해 §3.3 주석 또는 §8.3 서문에 "LLMClient.embed 는 §3.3, LlmService.embed(config, ...) 는 service wrapper" 를 명기하면 좋다.
  - 제안: §8.3 에 추가 시 "§3.3 의 LLMClient.embed 래퍼. config 를 첫 번째 인자로 받아 클라이언트 생성·배치·재시도를 캡슐화한다" 설명 한 줄을 추가.

---

## 요약

target 문서가 도입하는 신규 식별자(`LlmCallOptions`, `opts?: Pick<...>`, `inputType?: 'query'|'document'`)는 다른 spec 영역 또는 API 엔드포인트·이벤트명과 충돌하지 않는다. `LlmCallOptions`·`opts`·`disableInnerRetry`·`timeoutMs` 는 코드(`llm.service.ts`)에 이미 존재하며 spec 최초 기술이므로 방향이 맞다. 단, target 이 "Before" 텍스트로 참조하는 `spec/5-system/8-embedding-pipeline.md §5.4` 는 현재 파일에 없는 섹션으로, "신설"임을 명시해야 구현자 오해가 없다. `inputType` 은 코드에 아직 없으므로 spec 선행 기술임을 표기하면 혼선을 막을 수 있다.

---

## 위험도

LOW
