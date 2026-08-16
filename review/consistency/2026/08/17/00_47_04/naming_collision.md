# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 조사 범위

`git diff origin/main...HEAD` 로 실측한 실제 변경분(번들 프롬프트의 diff 청크는 예산 초과로 절단돼 있었음, `<git diff origin/main...HEAD -- code_areas>` 섹션 참조):

- spec: `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,14-external-interaction-api,15-chat-channel}.md`
- code: `codebase/backend/src/shared/utils/{redact-stored-error,sanitize-error-message}.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`, 관련 DTO 2개, frontend 문서 2개

신규 파일은 없음(전부 `M`) — 파일 경로 충돌 항목은 해당 없음. 신규 API endpoint·신규 ENV var·신규 요구사항 ID(`R-*`/`EIA-*`/`CCH-*`)도 이번 diff 에서 발행되지 않음 — `CCH-MP-06` 등은 기존 ID 를 재사용해 본문만 보강했고, `git diff` 전수 검색으로 신규 `R-*`/`EIA-*`/`CCH-*`/`W\d+` 토큰이 0건임을 확인했다.

target 이 실제로 도입하는 신규 식별자는 다음 코드 심볼들이다 (spec 쪽은 기존 §R17/§4.1/§5.3 본문의 갱신·정정이며 신규 명명 없음):

| 신규 식별자 | 위치 | 성격 |
|---|---|---|
| `redactStoredDataForResponse` | `shared/utils/redact-stored-error.ts` | 함수 (기존 `redactStoredErrorForResponse` 의 자매) |
| `VALUE_MASK_MARKER` / `KEY_MASK_MARKER` / `DEPTH_MASK_MARKER` | `shared/utils/sanitize-error-message.ts` | export 상수 (마스킹 마커 리터럴 canonical화) |
| `deepRedactSecretsPreserving` / `deepRedactCore` / `DeepRedactOptions` | 같은 파일 | 함수/내부 타입 |
| `WIRE_PRESERVED_FIELDS` | `websocket.service.ts` | 모듈-private 상수 |
| `maskWireEnvelope` / `toFanoutEnvelope` | `websocket.service.ts` | private 메서드 |
| `MASKED_INPUT_DATA_REASON` / `maskIfPresent` | `executions.service.ts` | 상수 / private 헬퍼 |

## 검증 방법

각 식별자를 `grep -rn` 으로 `codebase/backend/src`·`spec/` 전역에서 조회해, target 외 지점에서 **다른 의미**로 이미 쓰이고 있는지 확인했다. 또한 `nodeName → nodeLabel` 필드명 정정이 다른 spec 문서(`3-workflow-editor/3-execution.md`·`3-workflow-editor/4-ai-assistant.md`·`conventions/conversation-thread.md` 등)의 기존 `nodeLabel` 용례와 같은 의미인지 대조했다.

## 발견사항

없음 — CRITICAL·WARNING 없음.

조사한 9개 신규 코드 심볼 전부 **target 내에서만 정의·사용**되며(대부분 module-private), 기존 코드베이스에 동명의 심볼이 다른 의미로 존재하지 않는다. `WIRE_PRESERVED_FIELDS` 는 기존 `EXTERNAL_STRIPPED_FIELDS`(`strip-external-only-fields.ts`, 값 `['llmCalls']`)를 의도적으로 재사용(`new Set(EXTERNAL_STRIPPED_FIELDS)`)해 두 목록이 갈리지 않게 한 설계이므로 충돌이 아니라 오히려 SoT 통합이다. `nodeLabel` 필드명 정정은 `3-workflow-editor/3-execution.md`·`3-workflow-editor/4-ai-assistant.md`·`4-nodes/3-ai/0-common.md`·`conventions/conversation-thread.md` 등 기존 문서 전반에서 이미 쓰이던 동일 의미(노드 라벨 표시값)와 정확히 합치한다 — 오히려 이번 diff 가 `error-handling.md`/`websocket-protocol.md` 의 오래된 `nodeName` drift 를 이 기존 용례에 맞춰 정정한 것이다.

- **[INFO]** `값-레벨 마스킹` vs `값-패턴 마스킹` 용어 근접
  - target 신규 식별자: `6-websocket-protocol.md` §4.1 캐비엇의 "값-패턴 마스킹"(강제됨, 2026-08-16 결정 — emit 시점 자유 텍스트 credential 마스킹)
  - 기존 사용처: 같은 문서 `## Rationale` §"llmCalls 외부 수신자 strip" 의 "기각된 대안: **값-레벨 마스킹**은 에디터 디버깅 가치를 훼손…"(기존 문구, 이번 diff 대상 아님, `llmCalls` 를 strip 대신 값-마스킹으로 **대체**하자는 이미 기각된 안)
  - 상세: 두 용어가 "값-…-마스킹" 접두를 공유해 빠르게 훑으면 같은 결정을 가리키는 것으로 오독될 수 있다. 실제로는 "값-레벨 마스킹"(기각된, llmCalls 전용 대체안)과 "값-패턴 마스킹"(신규 채택, llmCalls 를 제외한 나머지 필드에 병존 추가)은 대상·판정이 다르다.
  - 제안: **이미 target 자신이 처리했다** — 같은 diff 가 "(2026-08-16 보강 — 이 결정은 유지된다)" 문단을 `## Rationale` 바로 아래 추가해 "대체가 아니라 병존"임을 명시적으로 구분해 뒀다(`spec/5-system/6-websocket-protocol.md:1090-1092`). 추가 조치 불요 — 다만 향후 이 절을 다시 손댈 때 두 문구를 통일된 한 용어(예: "패턴 기반 값 마스킹")로 좁히면 재발 여지가 줄어든다.

- **[INFO]** 마스킹 마커 리터럴 `'[REDACTED]'` 의 SoT 가 여전히 3곳에 분산
  - target 신규 식별자: `sanitize-error-message.ts` 의 `KEY_MASK_MARKER = '[REDACTED]'` — JSDoc 이 이 값을 "문서화된 계약"·"canonical 마커"로 서술하고, 웹훅 ingestion(`sanitizeResponseHeaders`)이 남기는 마커까지 이 상수와 같은 리터럴이라 가정해 재마스킹을 건너뛴다(`isMaskedMarker`).
  - 기존 사용처: `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts:25` (`const REDACTED = '[REDACTED]'`, 이번 diff 밖) · `codebase/backend/src/modules/workflow-assistant/tools/redact.ts:11` (`const REDACTED = '[REDACTED]'`, 이번 diff 밖) — 둘 다 **동일 리터럴 값**을 독립적으로 정의한다.
  - 상세: 이름 충돌은 아니다(각각 지역 상수 `REDACTED` vs export `KEY_MASK_MARKER`, 스코프가 겹치지 않음). 다만 target 의 새 JSDoc(`sanitize-error-message.ts` 상단 표)이 "`[REDACTED]` 는 문서화된 계약"이라 선언하면서 실제로는 값이 3곳에 독립 하드코딩돼 있다 — 그중 한 곳(`sanitize-response-headers.util.ts`)이 훗날 마커를 바꾸면 `isMaskedMarker` 의 재마스킹-방지 불변식이 조용히 깨지는데, 그 리스크를 인지시키는 참조나 import 연결이 없다.
  - 제안: 새 식별자 자체는 문제 없으나, `KEY_MASK_MARKER` 를 도입한 김에 `sanitize-response-headers.util.ts`/`workflow-assistant/tools/redact.ts` 의 지역 `REDACTED` 상수를 이 export 로 교체(또는 최소한 상호 참조 주석 추가)하면 "마커 값이 유일 SoT" 라는 target 의 문서화된 전제가 실제로 성립한다. 이번 PR 범위 밖이라도 후속 항목으로 등재할 가치가 있다.

## 요약

target(`spec/5-system/` impl-done, EIA/WS/webhook 마스킹 후속 diff)이 새로 도입한 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로는 없다 — 이번 변경은 기존 §R17/§4.1/§5.3 명명 체계 내에서 코드 심볼(주로 module-private 헬퍼·상수)을 추가한 것이며, 전수 grep 결과 그 심볼들이 기존 코드베이스·spec 어디에서도 다른 의미로 선점돼 있지 않았다. `nodeName→nodeLabel` 정정은 오히려 기존 다수 문서의 확립된 용례에 신규 표기를 맞춘 것이라 충돌이 아니라 정합화다. INFO 두 건은 각각 (1) target 자신이 이미 해소한 용어 근접 리스크의 기록, (2) 새 canonical 마커 상수가 주장하는 "단일 SoT" 전제가 diff 범위 밖 두 지역 상수 때문에 아직 완전히는 성립하지 않는다는 관찰이며, 어느 쪽도 사용자·시스템 혼선을 유발할 실질적 충돌은 아니다.

## 위험도

NONE
