# 정식 규약 준수 검토 — `spec/data-flow/7-llm-usage.md`

검토 모드: `--impl-done` (scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`)

## 사전 확인

- `git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` → **공란** (본 PR 에서 target 문서 자체는 전혀 수정되지 않았다). 즉 아래 검토는 "구현 변경 이후에도 그대로인 현재 문서 상태"가 conventions 를 따르는지를 본다.
- `spec/conventions/spec-impl-evidence.md §1` — `spec/data-flow/**` 는 frontmatter(`id`/`status`/`code`) 의무 대상에서 명시적으로 제외됨을 확인. 따라서 target 문서에 frontmatter 가 없는 것은 위반이 아니다 (오탐 방지 차 명기).
- 문서 구조: `## Overview` (L7) → 본문 (L31~L167, `1. Source → Sink` / `2. Schema 매핑` / `3. 상태 전이` / `4. 외부 의존`) → `## Rationale` (L170) — CLAUDE.md 가 요구하는 3섹션 구성 준수. `0-` prefix 는 root/영역 진입 문서에만 필요하며 본 문서는 해당 없음(정상).
- 링크 무결성: 본문의 모든 상대 링크(`../1-data-model.md#216-modelconfig`, `../2-navigation/6-config.md#3-api`, `../5-system/17-agent-memory.md`, `../5-system/7-llm-client.md`, `../5-system/8-embedding-pipeline.md`, `../conventions/node-cancellation.md`, `./0-overview.md`) 및 인용 앵커를 대조 — 전부 실존 (`spec-link-integrity.test.ts` 대상 위반 없음).
- 필드 명명: 문서 전반에서 TS/context 레이어는 camelCase(`workflowId`/`executionId`/`nodeExecutionId`), Postgres 컬럼 레이어는 snake_case(`workflow_id`/`execution_id`/`node_execution_id`)로 일관되게 구분 표기 — `spec/conventions/execution-context.md §1 원칙1 Stable core` 의 필드명(`workflowId`, `executionId`, `nodeExecutionId`)과도 정확히 일치. 위반 없음.
- API 문서(Swagger/OpenAPI) 관점(항목4): 본 diff·target 문서 범위에 controller/DTO 변경이 없어 `spec/conventions/swagger.md` 대상 표면 자체가 없음 — 해당 없음(N/A).

## 발견사항

- **[WARNING]** `llm_usage_log` attribution 관련 서술이 구현 완료 후에도 stale — 문서 자신이 선언한 "단일 진실" 위치가 부정확
  - target 위치:
    - §1.3 Caller 카탈로그 표, "AI Agent 자동 메모리 롤링 요약 압축" row (L107): `"context" 미전달 → workflow_id / execution_id / node_execution_id 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)`
    - §1.3 "attribution 채움 현황" 문단 (L113): `...노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐이다.`
    - §4 외부 의존 표, Agent Memory row (L162): `추출 processor chat + 롤링 요약 압축 chat (usage 적재, context NULL) / 저장·recall embed (미적재)`
    - Rationale "`llm_usage_log` 의 nullable context 컬럼들" (L204~206): `(b) LlmCallContext 가 아직 배선되지 않은 caller(RerankService listwise grading, AI Agent 자동 메모리 롤링 요약 압축)뿐이다`
  - 위반 규약: `CLAUDE.md` "정보 저장 위치 (단일 진실 원칙)" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 본 문서 L113 스스로도 이 attribution 현황 서술을 "일원화 — 단일 진실" 이라 선언한다.
  - 상세: 이번 diff(`ai-memory-manager.ts` / `ai-turn-executor.ts` / `agent-memory-injection.ts`)는 코드 주석에서 `[Spec 7-llm-usage §1.3]` 을 5회 인용하며, AI Agent 자동 메모리 롤링 요약 압축 chat 에 `workflowId`/`executionId`/`nodeExecutionId` 를 채우도록 구현을 완결했다(단발·첫 턴은 `context.*`, multi-turn resume 은 재구성 `state.*` — `injectMemoryContext` 두 호출부 모두 확인, `agent-memory-injection.spec.ts` 신규 테스트가 `llm.chat.mock.calls[0][2]` 로 3필드 채움을 회귀 고정). 즉 target 문서가 §1.3/§4/Rationale 에서 "잔여 갭"·"미배선"·"context NULL" 로 서술하는 그 caller 가, 바로 이 PR 로 attribution 을 완전히 채우게 됐다. 그런데 target 문서 자체는 이 PR 에서 전혀 갱신되지 않아(사전 확인 diff 공란), 방금 해소된 갭을 여전히 잔존 갭으로 기술한다. `injectMemoryContext` 의 유일한 호출부가 `ai-turn-executor.ts`(AI Agent 노드) 뿐임을 확인했으므로 Text Classifier/Information Extractor 관련 row 는 영향 없음 — 정정 범위는 위 4곳으로 한정된다.
  - 제안: `project-planner` 위임으로 spec 갱신 — (a) §1.3 표의 해당 row 를 "context 채움(단발/첫 턴=`context.*`, resume=`state.*`)" 으로 다른 AI 노드 row 와 동일 패턴으로 수정, (b) L113 문단에서 "노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축" 어구 삭제(잔여 NULL 목록을 워크플로우 밖 caller 로만 좁힘), (c) §4 Agent Memory row 를 "추출 processor chat(context NULL) + 롤링 요약 압축 chat(context 채움)" 으로 분리 표기, (d) Rationale (b) 항목에서 "AI Agent 자동 메모리 롤링 요약 압축" 을 제거해 `RerankService` listwise grading 만 남긴다. CLAUDE.md 규약상 "구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임" 이 정확히 이 케이스에 해당 — 이번 PR 의 스코프에 spec 갱신이 누락된 것으로 보인다.

## 요약

target 문서(`spec/data-flow/7-llm-usage.md`)의 문서 구조(Overview/본문/Rationale), 링크 무결성, frontmatter 면제 대상 판정, TS camelCase ↔ Postgres snake_case 필드 명명 구분은 모두 `spec/conventions/**` 및 CLAUDE.md 의 정식 규약을 그대로 따르고 있어 구조·명명·API 문서 관점에서는 위반이 없다. 다만 이번 diff 가 구현으로 완결한 "AI Agent 자동 메모리 롤링 요약 압축 chat 의 attribution 채움" 이 target 문서(§1.3 표·문단, §4, Rationale 총 4곳)에는 반영되지 않아, 문서가 스스로 "단일 진실" 이라 선언한 attribution 현황 서술이 구현과 어긋난 채로 남아 있다(WARNING 1건). 이는 CLAUDE.md 의 단일 진실 원칙·Rationale SoT 컨벤션과 직결되므로 별도 spec 갱신 커밋(project-planner 위임)으로 조속히 정정이 필요하다.

## 위험도

MEDIUM
