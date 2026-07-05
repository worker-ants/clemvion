# 정식 규약 준수 검토 — spec/4-nodes/1-logic/

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=`spec/4-nodes/1-logic/`)

## 대조한 정식 규약
- `spec/conventions/node-output.md` (Principle 0~11)
- `spec/conventions/node-cancellation.md`
- `spec/conventions/execution-context.md`
- `spec/conventions/error-codes.md`
- `spec/conventions/swagger.md`
- `spec/conventions/spec-impl-evidence.md`
- `spec/5-system/2-api-convention.md` (§8 페이지네이션)
- `spec/3-workflow-editor/1-node-common.md` (§2.6 UiHint DSL)
- 실제 구현 코드: `codebase/backend/src/nodes/logic/**`, `codebase/backend/src/modules/executions/background-runs/**`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

> 첨부된 프롬프트의 "정식 규약 모음" 섹션에는 `audit-actions.md` / `cafe24-api-catalog/**` 만 포함돼 있었으나, target 도메인(Logic 노드·5필드 output·cancellation·execution-context)과 직접 관련이 없어 저장소의 `spec/conventions/**` 원본을 직접 조회해 대조했다.

---

### 발견사항

- **[WARNING]** `10-parallel.md` §Rationale 의 signal-aware 노드 범위 서술이 `node-cancellation.md` SoT 와 어긋난 stale drift
  - target 위치: `spec/4-nodes/1-logic/10-parallel.md` §6 에러 코드 표 아래 "`cancel-others-on-fail` errorPolicy" Rationale — "본 PR 기준 signal-aware 는 HTTP 노드만 — DB / AI / Email / chat-channel 은 후속 PR." (§4 실행 로직의 동일 각주에도 반복: "signal-aware 노드만 조기 cleanup, best-effort")
  - 위반 규약: `spec/conventions/node-cancellation.md` §6 "구현 현황 / 후속" 표 — 해당 표는 **본 컨벤션이 SoT**임을 명시하고 있으며 (`node-cancellation.md` 본문: "동작 계약 (전파 의무·best-effort·에러 분류) SoT 는 본 문서"), AI 계열 노드(`ai_agent`/`text-classifier`/`information-extractor`)의 signal 전파가 이미 **✓ 구현됨**으로 기록돼 있다.
  - 상세: 코드 대조 결과 `ai-turn-executor.ts`(ai_agent), `text-classifier.handler.ts`, `information-extractor.handler.ts` 모두 `context.abortSignal` 을 SDK 호출에 전파하고 있어 (`node-cancellation.md` §6 표의 "✓" 판정과 일치), 실제로는 signal-aware 노드가 "HTTP + AI 3종"이다. `10-parallel.md` 는 이를 "HTTP 노드만"으로 서술해 규약 SoT 표와 두 노드군(AI 3종)만큼 어긋난다. `10-parallel.md` 자체가 §Rationale 상단에 "2026-05-30 결정"이라는 타임스탬프를 달아두고 있어, AI 노드 signal 전파가 그 이후에 완료됐음에도 `10-parallel.md` 가 갱신되지 않은 것으로 보인다.
  - 제안: `10-parallel.md` §4 실행 로직 5번 항목과 §Rationale "`cancel-others-on-fail` errorPolicy" 절의 "signal-aware 는 HTTP 노드만" 서술을 `node-cancellation.md` §6 표 기준으로 "HTTP + AI 계열(ai_agent/text-classifier/information-extractor)"로 갱신하고, 남은 미구현 노드군(DB/Email/chat-channel/MakeShop/Cafe24)만 후속으로 명시한다. 두 문서가 동일 사실(signal-aware 범위)을 서로 다른 시점 기준으로 중복 서술하고 있어, 이번처럼 한쪽만 갱신되고 다른 쪽이 stale 해지는 재발 소지가 있다 — `10-parallel.md` 쪽 서술을 `node-cancellation.md` §6 표에 대한 링크 인용으로 축약하는 편이 근본적으로 안전하다 (SoT 중복 축소).

- **[INFO]** `12-background.md` §8 모니터링 API의 cursor 페이지네이션 표기가 규약과 합치하나 교차 인용이 한 방향뿐
  - target 위치: `spec/4-nodes/1-logic/12-background.md` §8.2/§8.3
  - 위반 규약: 없음 (규약 위반 아님) — `spec/5-system/2-api-convention.md` §8.2 "Cursor 기반" 절과 표현·필드(`nextCursor`/`hasMore`)가 정확히 일치하며, `swagger.md` §5-2 헬퍼(`ApiOkWrappedResponse`) 사용도 실제 컨트롤러(`background-runs.controller.ts`)와 합치한다.
  - 상세: `2-api-convention.md` §8.2 는 본 엔드포인트(`GET /api/executions/{executionId}/background-runs/{backgroundRunId}`)를 cursor 페이지네이션의 대표 예시로 직접 인용하고 있으나, `12-background.md` §8.2 쪽에서는 `2-api-convention.md` §8 로 역방향 인용을 걸지 않는다 (다른 절에서는 상호 링크 패턴을 쓰는 경우가 많음).
  - 제안: `12-background.md` §8.3 페이지네이션 절 서두에 `[api-convention §8.2](../../5-system/2-api-convention.md#82-cursor-기반-대량-nodeexecution-등)` 링크를 추가해 두 문서가 같은 계약을 설명하고 있음을 명시하면 향후 한쪽만 갱신되는 drift 를 줄일 수 있다 (위 WARNING 과 같은 유형의 예방 조치).

- **[INFO]** Logic 카테고리 문서 전반의 CONVENTIONS 인용 형식은 일관되게 우수
  - target 위치: `0-common.md` §9, 각 노드 문서 §5 상단의 "CONVENTIONS Principle 11 포맷" 안내문
  - 위반 규약: 없음
  - 상세: 12개 파일 모두 frontmatter(`id`/`status: implemented`/`code:`)가 `spec-impl-evidence.md` §2.1/§3 스키마를 준수하고, 실제 `code:` glob 이 전부 저장소에서 매치됨을 확인했다 (`spec-code-paths.test.ts` 가 요구하는 ≥1 매치 조건 충족). 파일명도 `0-` prefix(공통 규약 문서) + 번호 순서 + `id:` 가 basename 과 정합해 CLAUDE.md 명명 컨벤션과 일치한다. Switch 의 `ui.requiredWhen` 화이트리스트 서술(§8.1/§8.2)도 `1-node-common.md` §2.6.1 UiHint DSL 정의 및 실제 `switch.schema.ts`/`warningRules` 코드와 정확히 대조된다 (특히 `switch:value-mode-needs-switch-value` 룰의 블랙리스트/화이트리스트 비대칭에 대한 코드 주석이 spec §8.2 step 4 를 직접 인용하는 등 SoT 정합이 이례적으로 견고함).

---

### 요약

`spec/4-nodes/1-logic/` 전 12개 문서는 `node-output.md`(5필드 invariant·config echo·에러 컨트랙트·container 오버라이트), `node-cancellation.md`, `execution-context.md`, `error-codes.md`, `swagger.md`, `spec-impl-evidence.md`, `2-api-convention.md` 등 관련 정식 규약과 대체로 높은 수준의 정합성을 보인다. frontmatter 스키마·code-path 증거·에러 코드 명명(UPPER_SNAKE_CASE, 의미 기반)·config echo 명시 enumeration·cursor 페이지네이션 표기 모두 실제 코드와 대조해 문제가 없었다. 유일한 실질적 이슈는 `10-parallel.md` 가 Parallel `cancel-others-on-fail` 의 signal-aware 노드 범위를 "HTTP 노드만"으로 서술하는 부분으로, 이는 `node-cancellation.md` §6 (실제 규약 SoT — AI 계열 3종 노드도 이미 구현 완료로 기록)과 어긋나는 stale drift다. --impl-prep 검토이므로 이 문서를 신뢰하고 구현에 착수하면 이미 완료된 작업을 다시 시도하거나 범위를 과소평가할 위험이 있어 WARNING 으로 분류했다. 그 외에는 INFO 수준의 상호 인용 보강 제안뿐이다.

### 위험도

LOW
