# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 대상

- `spec/5-system/14-external-interaction-api.md` §7.1 · §R17 (내부 읽기 경로 마스킹 신설, 결정 2026-08-16)
- `spec/5-system/6-websocket-protocol.md` §4.1 `execution.snapshot` 행 (마스킹 상속 서술 추가)
- 연쇄 변경: `spec/1-data-model.md` §2.14, `spec/2-navigation/14-execution-history.md` R-5, `spec/4-nodes/1-logic/12-background.md`, `spec/conventions/secret-store.md` §1

대조한 정식 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/execution-context.md`, `spec/conventions/swagger.md`, `spec/conventions/secret-store.md`, `spec/conventions/spec-impl-evidence.md`, `spec/5-system/2-api-convention.md §5.3/§5.4`, `spec/5-system/3-error-handling.md §1/§2/§6`.

실코드 대조(절대경로): `codebase/backend/src/shared/utils/redact-stored-error.ts`, `codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution`/`toExecutionDto`/`findById`/`getChain`/`stop`), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`.

## 발견사항

- **[WARNING] WS 프로토콜 문서 frontmatter `code:` 가 새로 서술한 마스킹 관문 구현 파일을 누락 — 같은 PR 의 자매 문서 3곳과 불일치**
  - target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` (파일 상단) / §4.1 `execution.snapshot` 행 (신규 서술)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 (`code:` = "본 spec 이 약속한 surface 의 구현 경로")
  - 상세: 이번 PR 은 `execution.snapshot` payload 의 `execution.error`/`execution.nodeExecutions[].error` 가 `ExecutionsService.findById` 의 마스킹 관문(`redactStoredErrorForResponse`, `codebase/backend/src/shared/utils/redact-stored-error.ts`)을 상속한다는 새 계약을 이 문서에 명문화했다. 그런데 정작 `code:` 목록에는 `executions.service.ts`도 `redact-stored-error.ts`도 없다(현행 9개 항목은 websocket 모듈·SSE adapter·프론트 ws-client 뿐). 반면 같은 근본 변경을 서술한 자매 문서 3곳 — `spec/5-system/14-external-interaction-api.md`, `spec/2-navigation/14-execution-history.md`, `spec/4-nodes/1-logic/12-background.md` — 은 이번 diff 에서 모두 `redact-stored-error.ts`(EIA 는 `executions.service.ts` 도 함께)를 `code:` 에 추가했다. WS 문서만 빠져 PR 내부에서 스스로 세운 패턴과 불일치한다.
  - 참고: `spec-impl-evidence.md` R-1 에 따라 build 가드(`spec-code-paths.test.ts`)는 "글로브 ≥1 매치"만 확인하므로 이 누락이 build 를 깨뜨리지는 않는다(기존 9개 항목이 이미 매치). 즉 CRITICAL 은 아니나, 이 문서가 이제 `findById`/`redactStoredErrorForResponse` 를 명시적으로 지목하는 이상 `code:` 로 추적하지 않으면 `/spec-coverage`(spec 약속 vs 구현 evidence) 관점에서 근거가 빠진 서술로 남는다.
  - 제안: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 에 `codebase/backend/src/modules/executions/executions.service.ts` · `codebase/backend/src/shared/utils/redact-stored-error.ts` 두 항목을 추가해 자매 문서 3곳과 동형으로 맞춘다.

- **[INFO] 값-패턴 egress 마스킹 정책이 전용 `spec/conventions/*.md` 없이 5개 spec 문서에 분산 서술**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다" 불릿(신규) + 기존 `conversationThread`/`execution.ai_message`/`nodeOutput.conversationConfig` 불릿, `spec/1-data-model.md` §2.14 "응답 마스킹" 행(신규), `spec/2-navigation/14-execution-history.md` R-5 캐비엇(신규), `spec/4-nodes/1-logic/12-background.md` `nodeExecutions.data` 행(신규), `spec/5-system/6-websocket-protocol.md` §4.1(신규)
  - 위반 규약: 엄밀한 위반은 아님 — CLAUDE.md "정보 저장 위치" 표의 "정식 규약 → `spec/conventions/<name>.md`" 원칙에 대한 근접성 관찰
  - 상세: `deepRedactSecrets`/`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 기반 egress 마스킹은 이제 (a) EIA 종결 emit(§6.4/`toTerminalErrorPayload`), (b) EIA conversationThread/ai_message/nodeOutput, (c) 내부 REST 4경로 + Background body(이번 PR), (d) WS `execution.snapshot`(이번 PR) 를 관통하는 cross-cutting 패턴이 됐다. `secret-store.md`(암복호화 저장) 는 이미 전용 convention 문서를 갖는데, 같은 층위의 "egress 값-패턴 마스킹" 은 EIA §R17 을 사실상의 SoT 로 삼아 여러 문서가 참조하는 형태로 남아 있다. 문서 자신이 "이 문서가 반복해 겪은 실패 형태"(§R17 "적용 범위는 총칭이 아니라 열거다")라고 자인할 만큼 스코프 drift 가 이미 여러 차례 있었던 영역이라, 향후 소비처가 더 늘면(예: workflow-assistant LLM 도구 통합 논의가 이미 §R17 잔여로 언급됨) 분산 서술의 유지비용이 누적될 수 있다.
  - 제안: 즉시 조치 불요(정보성). 소비처가 한두 곳 더 늘면 `spec/conventions/error-redaction.md`(가칭)로 값-패턴 마스킹 헬퍼(`deepRedactSecrets`/`redactStoredErrorForResponse`/`redactThreadForPublic`/`toTerminalErrorPayload`)의 명명·적용범위 규율을 분리해 `error-codes.md`(명명 규율)·`secret-store.md`(저장 암호화)와 나란히 두는 방안을 고려. 규약 갱신이 필요하다면 project-planner 턴에서 결정할 사안.

## 검증 결과 (위반 없음으로 확인된 항목)

다음은 위반 가능성이 있어 보여 대조했으나 conventions 를 준수하는 것으로 확인된 항목:

- **명명**: 신규 파일 `redact-stored-error.ts`/함수 `redactStoredErrorForResponse` — 자매 파일(`terminal-error-payload.ts`/`toTerminalErrorPayload`, `sanitize-error-message.ts`)와 동형 kebab-case 파일명·camelCase 함수명. 신규 에러 코드·API endpoint 명명 없음.
- **출력 포맷**: `redactStoredErrorForResponse` 는 "형태 보존, 값만 마스킹"(`Record<string, unknown> | null` 불변) — `node-output.md` §3.2 표준 에러 형태·`1-data-model.md` §2.14 `Execution.error` 구조를 변경하지 않음. `execution-response.dto.ts` 가 JSDoc 로 마스킹 출처를 명시해 `swagger.md` §1-1(JSDoc → description) 과 정합.
- **레이어 분리**: EIA §R17 신규 불릿이 "이 마스킹은 API 규약 §5.3 의 HTTP 에러 envelope 비echo 원칙과 다른 레이어" 라고 명시적으로 선을 그어, `error-codes.md`/`3-error-handling.md` 가 소유한 응답 envelope·카탈로그 SoT 와 충돌하지 않음 — 오히려 MEMORY 교훈("방어의 정의를 한 칸 좁게")에 부합하는 열거형 스코프 기술.
- **secret-store.md 예외 등재**: `Trigger.config.interaction.triggerToken` 비대상 예외가 기존 `AuthConfig.config` 비대상 예외와 동일한 "**비대상 — `X`**" 서식·앵커(`#1-uri-scheme`)로 정확히 추가됨. "같은 근거를 재사용하는 세 번째 필드가 이 등재의 실패 모드" 라는 자기 경고 문구까지 포함해 규약 취지를 보강.
- **문서 구조**: `spec/5-system/14-external-interaction-api.md` 는 Overview(§29)/본문/`## Rationale`(§1158) 3섹션 구조를 유지하며 신규 불릿은 기존 `## Rationale` §R17(§1380) 안에 정확히 위치. 상호 참조 앵커(`2-api-convention.md#53-에러-응답`, `1-data-model.md#214-nodeexecution`(§2.14 표), `14-execution-history.md#r-5-...`, `12-background.md#82-...`, `secret-store.md#1-uri-scheme`) 전부 실제 heading slug 와 일치 확인.
- **구현 대조**: "`ExecutionsService` 4곳(`findById`·`toExecutionDto`·`getChain`·`stop`)" 서술은 실제로 `toResponseExecution`(→`findById`/`getChain`/`stop` 공유) + `toExecutionDto`(목록 별도) 두 지점에서 `redactStoredErrorForResponse` 호출로 확인됨 — 과다 서술(총칭 초과) 아님.

## 요약

이번 diff(EIA §R17 내부 읽기 경로 마스킹, WS `execution.snapshot` 상속 서술, secret-store `triggerToken` 명시적 비대상 예외)는 `spec/conventions/**` 의 명명·출력 포맷·문서 구조·레이어 분리 원칙을 대체로 정밀하게 준수한다 — 특히 "API §5.3 에러 envelope 과 다른 레이어"라고 스스로 경계를 긋고, "적용 범위는 열거이지 총칭이 아니다"라고 스코프를 좁혀 문서화하는 태도가 이 프로젝트가 반복 지적해온 실패 패턴(방어 정의 과다 일반화)을 예방적으로 피하고 있다. 유일한 실질적 아쉬움은 WS 프로토콜 문서의 frontmatter `code:` 가 같은 PR 안에서 자매 문서 3곳이 채택한 "새로 지목한 구현 파일을 `code:` 에 추가" 패턴을 따르지 않은 것으로, build 가드를 깨뜨리지는 않지만 spec-impl-evidence 관점의 완결성 관점에서 WARNING 으로 남긴다. 그 외에는 CRITICAL 급 위반이 없다.

## 위험도

LOW
