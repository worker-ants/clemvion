# 정식 규약 준수 검토 결과

검토 대상: `impldone_scope2` (diff-base `3064c9c6`)
- `spec/data-flow/0-overview.md` (data-flow 개요)
- `spec/5-system/14-external-interaction-api.md` (EIA spec)
- `spec/data-flow/15-external-interaction.md` (EIA data-flow)

검토 기준 규약:
- `spec/conventions/swagger.md`
- `spec/conventions/error-codes.md`
- `spec/conventions/secret-store.md`
- `spec/conventions/spec-impl-evidence.md`
- CLAUDE.md 문서 구조 규약

---

## 발견사항

### [INFO] `spec/data-flow/15-external-interaction.md` — frontmatter 없음 (면제 대상)
- target 위치: `spec/data-flow/15-external-interaction.md` 파일 전체
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — frontmatter 의무 적용 대상 inclusive list 에 `spec/data-flow/**` 경로가 **포함되지 않아** 현재 기준으로는 면제.
- 상세: `spec/5-system/**.md` 등 열거된 경로와 달리 `spec/data-flow/` 는 spec-impl-evidence.md §1 의 의무 범위 밖이다. 규약 위반이 아님. 단 data-flow 문서가 5-system SoT 와 쌍으로 관리되므로, 향후 `spec/data-flow/**` 를 의무 대상에 추가하면 frontmatter 를 후급해야 한다.
- 제안: 규약 자체에 `spec/data-flow/**` 추가를 검토하되, 현재 target 문서는 수정 의무 없음.

---

### [WARNING] `spec/data-flow/15-external-interaction.md` — `## Rationale` 섹션 없음
- target 위치: `spec/data-flow/15-external-interaction.md` 전체 구조
- 위반 규약: CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 권장; `spec/data-flow/0-overview.md §3` 의 data-flow 권장 5요소.
- 상세: 문서에 `## Overview` 와 본문(Source→Sink, Schema 매핑, 상태 전이, 외부 의존) 섹션은 있으나 `## Rationale` 섹션이 없다. CLAUDE.md 는 "결정의 배경·근거는 해당 spec 문서 끝의 Rationale" 로 보관하도록 권장한다. 주요 설계 판단(예: in-process 우회 경로, outbox 패턴 미신설, 멀티 인스턴스 fan-out Planned 결정 등)이 Rationale 없이 본문 inline 주석에만 기술되어 있다.
- 제안: `## Rationale` 섹션을 문서 말미에 추가하고, 현재 inline 에 산재한 "현재 구현 한계 / Planned" 이유와 data-flow 설계 결정을 이 섹션으로 이동하거나 요약한다.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md §10.1` — swagger.md §2-1 내용 부분 재선언
- target 위치: `spec/5-system/14-external-interaction-api.md §10.1` 마지막 단락
  > "별도 `@ApiSecurity({})` 데코레이터는 두지 않는다 — [Swagger 규약 §2-1](../conventions/swagger.md) 에 따라 '보안 없음' 은 데코레이터가 아니라 설명으로 표기하며, HMAC 검증은 핸들러 내부에서 수행한다."
- 위반 규약: `spec/conventions/swagger.md §2-1` — 정식 규약을 spec 본문에서 재선언하는 것은 중복 SoT 를 만들고, 규약 갱신 시 drift 원인이 된다.
- 상세: swagger.md §2-1 의 `@ApiSecurity({})` 금지 지침을 이 spec 에서 산문으로 재기술했다. cross-link 는 올바르나 규약 문구를 인라인 선언하는 것은 conventions SoT 와의 이중 선언이다. "HMAC 검증은 핸들러 내부에서 수행한다"는 구현 사실은 정식 규약이 아니므로 spec 본문에 남겨도 무방하나, `@ApiSecurity({})` 금지 이유 자체는 swagger.md §2-1 로 위임하고 본문에서는 "참조: swagger.md §2-1" 만 남기는 것이 단일 진실 원칙에 부합한다.
- 제안: `§10.1` 의 해당 문장을 "hooks 컨트롤러는 `@Public()` 로 JWT 인증 우회; `@ApiBearerAuth` 미기입 — [swagger.md §2-1](../conventions/swagger.md)" 수준으로 압축하고 규약 재선언을 제거한다.

---

### [INFO] `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` — 존재 여부 확인 권고
- target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter
  ```yaml
  pending_plans:
    - plan/in-progress/spec-sync-external-interaction-api-gaps.md
    - plan/in-progress/fix-webchat-sse-field-map.md
  ```
- 위반 규약: `spec/conventions/spec-impl-evidence.md` — `spec-pending-plan-existence` 가드: pending_plans 에 열거된 파일은 `plan/in-progress/` 에 실제 존재해야 한다.
- 상세: 이번 diff 범위에서 두 plan 파일의 현존을 확인하지 못했다. 만약 해당 plan 이 `plan/complete/` 로 이동했다면 frontmatter 에서 제거해야 하며, 미제거 시 `spec-pending-plan-existence` 가드가 실패한다.
- 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 및 `plan/in-progress/fix-webchat-sse-field-map.md` 의 실제 존재 여부를 확인 후, 이동됐다면 frontmatter `pending_plans` 항목을 제거하고 `status` 를 `implemented` 로 갱신한다.

---

### [INFO] 에러 코드 명명 — `MESSAGE_TOO_LONG`, `STATE_MISMATCH`, `TOKEN_*` 계열 모두 규약 준수
- target 위치: `spec/5-system/14-external-interaction-api.md §5.1` 에러 표
- 위반 규약: `spec/conventions/error-codes.md §1` — `UPPER_SNAKE_CASE`, 의미 기반 명명
- 상세: 모든 EIA 전용 에러 코드(`MESSAGE_TOO_LONG`, `STATE_MISMATCH`, `EXECUTION_TERMINATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_SCOPE_MISMATCH`, `TOKEN_AUDIENCE_MISMATCH`, `IDEMPOTENCY_KEY_CONFLICT`, `TOO_MANY_CONNECTIONS`)는 `UPPER_SNAKE_CASE` + 의미 기반 명명을 준수한다. §R13 및 §R14 에 설계 근거가 명확히 기술되어 있다. 위반 없음.
- 제안: 없음.

---

### [INFO] Secret Store URI 규약 준수 — `notification-signing` ref
- target 위치: `spec/5-system/14-external-interaction-api.md §7.1` `config.notification.signing.secretRef`
- 위반 규약: `spec/conventions/secret-store.md §1` — `secret://<scope>/<resourceId>/<name>` (lower-case kebab-case)
- 상세: spec 에서 `"secret://triggers/{triggerId}/notification-signing"` 을 사용하며, `secret-store.md §1` 의 표에 `secret://triggers/{triggerId}/notification-signing` 이 명시적으로 등재되어 있다. 완전 정합. 위반 없음.
- 제안: 없음.

---

### [INFO] swagger.md §2-1 `interaction-token` Bearer scheme — 규약 준수
- target 위치: `spec/5-system/14-external-interaction-api.md §10.1`
- 위반 규약: `spec/conventions/swagger.md §2-1`
- 상세: swagger.md §2-1 은 이미 `interaction-token` scheme 등록 및 `@ApiBearerAuth('interaction-token')` 사용 패턴을 규약으로 수록하고 있다("main.ts 에 신규 Bearer scheme 등록: `interaction-token`"). `§10.1` 의 기술이 swagger.md §2-1 과 완전히 일치한다. 위반 없음.
- 제안: 없음.

---

### [INFO] swagger.md §5-1 응답 DTO 위치 — spec 본문에 명시적 `responses/` 구조 미표기
- target 위치: `spec/5-system/14-external-interaction-api.md §10` 구현 파일 구조
- 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
- 상세: §10 의 `dto/` 항목에 `responses/` 하위 구조가 명시되지 않고 `dto/*.dto.ts` 로 표기됐다. 단 §10.1 에서 swagger.md §5 전체를 cross-link 하며 "적용 대상" 이라 명시하므로, 구현 코드가 `dto/responses/` 를 따르는 한 spec 표기상 누락이 가이던스를 해치지는 않는다.
- 제안: §10 의 `dto/` 구조 예시에 `responses/` 하위를 추가 표기해 swagger.md §5-1 의 디렉토리 규약이 이 모듈에 적용됨을 명시한다. 강제 위반 아님.

---

### [INFO] `spec/data-flow/0-overview.md` BullMQ 큐 카탈로그 — `terminal-revoke-reconcile` 큐 추가 확인
- target 위치: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 표
- 위반 규약: `spec/data-flow/0-overview.md §4` 주석 — "큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신한다. 코드 측 큐 모니터링 레지스트리 `MONITORED_QUEUES` 는 본 표를 SoT 로 삼는다 — 큐 추가/삭제 시 본 카탈로그를 먼저 갱신하고 그 레지스트리를 동기화한다."
- 상세: `terminal-revoke-reconcile` 큐가 새로 추가됐고 카탈로그 표(`§4`)에 정상 등재됐다. 큐 이름은 기존 패턴(kebab-case, `<domain>-<verb-noun>`)을 따른다. 위반 없음. 단 `system-status.constants.ts` 의 `MONITORED_QUEUES` 레지스트리 동기화 여부는 코드 리뷰 범위이며 본 검토에서 확인 불가.
- 제안: 구현 PR 에서 `MONITORED_QUEUES` 에 `terminal-revoke-reconcile` 가 추가됐는지 코드 리뷰 시 확인한다.

---

## 요약

세 대상 문서(`spec/data-flow/0-overview.md`, `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md`)는 전반적으로 정식 규약(`spec/conventions/**`)을 준수하고 있다. CRITICAL 위반은 없다. 주요 권고 사항은 두 가지다: (1) `spec/data-flow/15-external-interaction.md` 에 `## Rationale` 섹션이 없어 CLAUDE.md 의 3섹션(Overview/본문/Rationale) 권장을 미충족하며, (2) `spec/5-system/14-external-interaction-api.md §10.1` 에서 swagger.md §2-1 내용을 부분 재선언해 단일 진실 원칙과 거리가 있다. 에러 코드 명명(`MESSAGE_TOO_LONG`, `STATE_MISMATCH`, `TOKEN_*` 계열)은 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반 원칙에 완전 부합하고, secret-store URI scheme 도 `secret-store.md §1` 과 정합한다. `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 의 plan 파일 실존 여부를 커밋 전 확인하도록 권고한다.

## 위험도

LOW
