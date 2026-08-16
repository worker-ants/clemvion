# 정식 규약 준수 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 범위 확인

`origin/main...HEAD` 의 `spec/5-system/` 실 diff 는 2개 파일 한정이다:
- `spec/5-system/14-external-interaction-api.md` — §7.1 secret-store 예외 각주 갱신 + §R17(Rationale) "내부 REST 비대칭은 미결이다" → "내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 로 확정 서술 교체, frontmatter `code:` 2개 추가 (`redact-stored-error.ts`, `executions.service.ts`)
- `spec/5-system/6-websocket-protocol.md` — §4 이벤트 표의 `execution.snapshot` 행에 마스킹 상속 각주 1문장 추가

번들이 컨텍스트 예산 초과로 다수 `spec/conventions/**` 파일(예: `swagger.md`, `error-codes.md`, `spec-impl-evidence.md`, `execution-context.md`)의 본문을 생략했으므로, 해당 파일은 워크트리에서 직접 `Read` 했다. 코드 검증은 워킹트리 절대경로 기준.

## 발견사항

- **[WARNING] 응답 DTO의 `error` 필드 JSDoc 이 신규 마스킹 부수효과를 반영하지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7 데이터 모델 / §R17 (신규 "내부 읽기 경로도 같은 마스킹을 적용한다" 블록)
  - 위반 규약: `spec/conventions/swagger.md` §1-1("모든 필드에 JSDoc 추가") · §3("가능하면 '무엇을 하는지 + 제약/부수효과'를 담습니다") · §5-1("비밀값은 마스킹하거나 제외") + `PROJECT.md` §변경 유형→갱신 위치 매핑 "백엔드 API 추가·변경 → (a) controller·DTO 의 swagger jsdoc" (같은 turn 갱신 의무, §사후 보정 PR 패턴 금지)
  - 상세: 이번 PR 은 `GET /api/executions/:id` 등 4경로 + `BackgroundRunsService` body 노드가 반환하는 `error` 컬럼 값에 자격증명 마스킹을 새로 적용했다(코드 확인: `codebase/backend/src/modules/executions/executions.service.ts:634,926,974`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302` 모두 `redactStoredErrorForResponse` 호출 — spec 서술과 일치, 구현 완료 확인). 그런데 이 값을 실어 나르는 Swagger DTO 필드의 JSDoc 은 이번 diff 에서 전혀 손대지 않았다:
    - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:64`(`ExecutionDto.error`) — `/** 에러 객체 */`
    - 같은 파일 `:161`(`ExecutionDetailDto` 계열) — `/** 에러 */`
    - 같은 파일 `:161`(`NodeExecutionSummaryDto.error`) — `/** 에러 */`
    - `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:62` — `description: '에러 정보'`
    네 곳 모두 "값이 자격증명 패턴에 대해 마스킹된다"는 사실을 언급하지 않는다. `git diff origin/main...HEAD -- codebase/backend/src/modules/executions/dto/ codebase/backend/src/modules/executions/background-runs/dto/` 는 빈 결과 — 즉 같은 PR 안에서 DTO 문서가 갱신되지 않았다. spec 은 결정을 정확히 등재했지만(§R17 신규 블록이 근거·범위·잔여를 상세히 기술) Swagger 표면(API 소비자가 실제로 읽는 문서)에는 그 결정이 반영되지 않아 "spec=닫힘, API 문서=미갱신" 비대칭이 생겼다 — 이 저장소가 반복적으로 겪는 실패 형태(코드-spec drift)의 문서-계층 변종이다.
  - 제안: 위 4개 DTO 필드의 JSDoc 에 "자격증명으로 판별된 값은 마스킹되어 반환됨(DB 원문과 다를 수 있음)" 한 줄을 추가하고, 가능하면 SoT 로 `spec/5-system/14-external-interaction-api.md#r17-...` 또는 `redact-stored-error.ts` 를 지목. 후속 커밋으로 미루면 PROJECT.md 의 "사후 보정 PR 패턴 금지" 원칙과 충돌하므로, 이 리뷰가 걸린 시점에 같은 PR 안에서 반영 권장.

- **[INFO] `1-data-model.md §2.14` 에 마스킹 정책 포인터가 없어 AuthConfig(§2.17.2)와 서술 결이 다름**
  - target 위치: `spec/5-system/14-external-interaction-api.md §R17` 신규 블록(간접 — `1-data-model.md §2.14` 를 근거로 인용)
  - 위반 규약: 명시적 강제 규약은 없음(참고 수준). `spec/1-data-model.md §2.17.2`(AuthConfig "마스킹/노출 정책" 절)가 이미 확립한 문서 패턴과의 형식 일관성 제안.
  - 상세: `1-data-model.md §2.14 NodeExecution` 의 `error` / `Execution.error` 설명에는 이번에 결정된 egress 마스킹 사실이 전혀 언급되지 않는다(§2.14 절 원문 확인 — "구조" 행만 서술, 노출 정책 없음). AuthConfig 는 §2.17.2 라는 전용 절로 마스킹/노출 정책을 데이터 모델 문서 자체에 명시하는 반면, `Execution.error`/`NodeExecution.error` 는 그 결정이 `14-external-interaction-api.md §R17` 에만 있고 `1-data-model.md` 에는 역참조가 없다. 이는 이번 diff 범위(`spec/5-system/`) 밖(`spec/1-data-model.md` 는 루트 문서)이라 CRITICAL/WARNING 으로 격상하지 않으나, 향후 `1-data-model.md` 를 단독으로 읽는 사람은 이 마스킹 사실을 놓칠 수 있다.
  - 제안: `1-data-model.md §2.14` 의 `error` 필드 설명 끝에 "응답 egress 시 자격증명 마스킹 적용 — SoT: [EIA §R17](./5-system/14-external-interaction-api.md)" 한 줄 포인터를 추가하는 것을 고려. 필수는 아니며, 규약 갱신이 아니라 target(spec/5-system) 자체의 문제도 아니므로 참고용 제안.

## 확인 완료(위반 없음) — 근거를 함께 남김

- **secret-store.md 인용 정확성**: `14-external-interaction-api.md §7.1` 이 `config.interaction.triggerToken` 평문 보관을 "`secret-store.md §1` 의 명시적 비대상 예외"라 부르는데, 실제로 같은 날짜(2026-08-16) 커밋(`4c1f89e55`)이 `secret-store.md §1` 에 "비대상 — `Trigger.config.interaction.triggerToken`" 블록을 등재했음을 확인(`spec/conventions/secret-store.md` 직접 Read). 인용이 실재하며 근거(a)~(c) 도 자기 완결적 — 위반 없음.
- **node-output.md Principle 3.2 (`output.error` 표준 형태)와의 충돌 없음**: 신규 마스킹은 `redactStoredErrorForResponse`(`deepRedactSecrets` 위임)로 "형태 보존, 값만 변경"을 명시(`toTerminalErrorPayload` 재사용을 의도적으로 회피). `message` 필드가 "영문 원문 SoT"라는 §3.2 규정은 코드 경로/로그·DB 원문에는 그대로 적용되고(§R17 "DB 는 여전히 원문"), egress 표면의 값 마스킹은 별개 축이라 규약과 상충하지 않음.
- **swagger.md §1-4 (닫힌 union vs 열린 map)**: `error?: Record<string, unknown> | null` 은 노드 타입별로 `details` 형태가 달라지는 실제 열린 필드라 `additionalProperties: true` 유지가 맞고, 이번 diff 로 스키마 자체가 바뀌지 않았으므로 §1-4 위반 아님.
- **frontmatter (`spec-impl-evidence.md`) 준수**: `14-external-interaction-api.md` 에 새로 추가된 `code:` 경로 2건(`codebase/backend/src/shared/utils/redact-stored-error.ts`, `codebase/backend/src/modules/executions/executions.service.ts`) 모두 워크트리에 실존 확인(Read/ls 성공). `status: partial` + `pending_plans:` 도 그대로 유효(대상 plan 파일 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec-sync-websocket-protocol-gaps.md` 둘 다 실존).
- **spec 서술 ↔ 구현 일치(참고 — 본 관점 밖이지만 교차 확인)**: `execution.snapshot` 이 `findById` 의 마스킹 관문을 상속한다는 WS 문서 신규 각주는 `websocket.gateway.ts:emitExecutionSnapshot` 이 `executionsService.findById()` 를 호출하는 코드와 일치 — 근거 없는 주장(문서-only 결정)이 아님.
- **문서 구조(Overview/본문/Rationale)**: 두 target 파일 모두 기존 구조(EIA: `## Overview` → 본문 §1~§12 → `## Rationale`; WS: 본문 §1~§9 → `## Rationale`)를 유지, 이번 diff 는 그 구조를 흩트리지 않고 각 절 안에 삽입됨. R17 신규 블록도 정확히 `## Rationale` 절 하위(라인 1380 근방)에 위치.

## 요약

이번 diff(spec/5-system 2개 파일)는 정식 규약 관점에서 대체로 견고하다 — secret-store 예외 인용이 실재를 정확히 반영하고, node-output/swagger 의 형태-vs-값 구분을 의식적으로 지켰으며("형태는 바꾸지 않는다" 명시), frontmatter code:/pending_plans: 도 유효하다. 다만 이 결정이 실제로 값-마스킹을 도입한 응답 필드(4개 DTO 의 `error`)의 Swagger JSDoc 이 같은 PR 안에서 갱신되지 않아, "API 문서 규약"(swagger.md §1-1/§3, PROJECT.md 변경유형 매핑) 관점에서 문서-코드 계층 간 갭이 하나 남는다. CRITICAL 은 없다.

## 위험도
LOW
