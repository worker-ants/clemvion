# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 범위 확인

- 실 diff(`git diff origin/main...HEAD -- code_areas`, 워크트리 직접 재확인 완료)는
  `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
  `idempotency.interceptor.spec.ts` 두 파일뿐이다. `spec/**` 변경은 0건
  (`git diff origin/main...HEAD --stat` 로 재확인). 코드 변경 내용은 idempotency 캐시
  손상(바깥 엔트리 / 안쪽 `responseJson` 두 겹) 방어를 `discardCorruptEntry` 로 통합하고
  형태 검증(`isIdempotencyEntry`)·판정 순서(bodyHash → payload 파싱)를 고정, warn 로깅을
  추가한 방어 강화다. 신규 wire 에러 코드·API 계약 변경은 없다.
- 프롬프트 번들의 `## 정식 규약 모음` 섹션은 `error-codes.md`·`swagger.md`·`migrations.md`·
  `execution-context.md`·`interaction-type-registry.md`·`conversation-thread.md`·
  `node-output.md` 등 EIA 문서와 밀접한 conventions 파일 다수를 "컨텍스트 예산 초과"로
  본문 생략한 채 전달했다(3회차 연속 동일 절단 패턴). 판정 신뢰성을 위해 이 파일들을
  워크트리 절대경로로 직접 `Read` 해 대조했다 — `error-codes.md`(전문 135줄), `swagger.md`
  (전문 399줄), `secret-store.md` URI scheme 절, `2-api-convention.md §5.3` 에러 봉투를
  각각 원본에서 확인.
- 이 diff·target 조합에 대한 동일 관점 검토가 이전 두 회차(`review/consistency/2026/08/12/
  23_48_39/convention_compliance.md`, `review/consistency/2026/08/13/00_20_21/
  convention_compliance.md`)에서 이미 수행돼 둘 다 위험도 NONE 이었다. 본 회차는 그 결론을
  전제하지 않고 독립적으로 원본 conventions 파일과 대상 코드를 재대조했으며, 동일 결론에
  도달했다(세부 근거는 아래).

## 대조 결과

### 1. 명명 규약

- **에러 코드**: `spec/data-flow/15-external-interaction.md` 가 나열하는 `TOKEN_EXPIRED` /
  `TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH` / `TOKEN_INVALID` /
  `STATE_MISMATCH` / `EXECUTION_TERMINATED` / `VALIDATION_ERROR` / `IDEMPOTENCY_KEY_CONFLICT`
  / `TOO_MANY_CONNECTIONS` / `WEBCHAT_IDLE_TIMEOUT` 는 전부 `error-codes.md §1` 의
  `UPPER_SNAKE_CASE` + 의미 기반 명명(구현 세부·전이적 맥락을 이름에 안 박음)을 만족한다.
  diff 가 던지는 `ConflictException({ error: { code: 'IDEMPOTENCY_KEY_CONFLICT', ... } })`
  도 동일 표기이며 §3 historical-artifact 예외 레지스트리에 없는 것도 맞다(예외가 아니라
  원칙 준수 코드이기 때문). `spec/data-flow/*.md` 16개 전체에 lowercase 에러코드 패턴
  스캔(`grep -noE "'[a-z][a-z_]*_[a-z_]+'"`) 결과 15-external-interaction.md 에서는
  `'in_process_trusted'`(scope 값, 에러코드 아님) 외 후보 없음.
- **Secret URI**: `15-external-interaction.md §1.5` 의
  `secret://triggers/<id>/notification-signing` 은 `secret-store.md §1` URI Scheme
  (`secret://<scope>/<resourceId>/<name>`) 및 §2 레지스트리 행(`secret://triggers/
  {triggerId}/notification-signing` — "EIA notification HMAC signing secret")과 정확히
  일치. DB CHECK 정규식(`^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$`)도 충족.
- **BullMQ 큐 이름**: `notification-webhook` / `notification-secret-rotator` /
  `terminal-revoke-reconcile` / `webchat-idle-reaper` / `execution-continuation` 모두
  `0-overview.md §4` 큐 카탈로그에 동일 이름으로 등재.
- **Migration 인용**: `execution_token (V060)` 표기는 `migrations.md` 의 `V<번호>` 축약
  인용 관행과 충돌 없음(파일명 자체를 재선언하지 않음).
- **문서 파일 명명**: `spec/data-flow/*.md` 16개 전부 `<N>-kebab-case.md` 패턴, entry
  문서가 `0-overview.md` 로 CLAUDE.md 의 `0-` prefix 관행을 따른다.

### 2. 출력 포맷 규약

- diff 가 던지는 `{ error: { code: 'IDEMPOTENCY_KEY_CONFLICT', message } }` 형태는
  `5-system/2-api-convention.md §5.3` 이 규정한 에러 봉투(`{ error: { code, message,
  requestId, details } }` — `requestId` 는 `GlobalExceptionFilter` 가 별도 부가)와
  정합한다. 이번 diff 는 이 예외 생성부(§`cached.bodyHash !== bodyHash` 분기)를 새로
  만들지 않고 판정 순서만 옮겼다 — 형태 자체는 불변.
- HTTP status ↔ 코드 매핑(401 TOKEN_*, 409 STATE_MISMATCH/IDEMPOTENCY_KEY_CONFLICT, 410
  EXECUTION_TERMINATED, 400 VALIDATION_ERROR, 429 TOO_MANY_CONNECTIONS)은 `swagger.md
  §2-4` 상태 코드 표·`api-convention §5.3` 기본값 표와 어긋나지 않는다.
- `15-external-interaction.md §2.2` 의 idempotency 캐시 키 포맷
  (`interaction:idempotency:<executionId>:<route>:<key>`, `{bodyHash, responseJson,
  statusCode}`, 24h, `2xx`/`409`/`410` 닫힌 캐시 대상, `400 VALIDATION_ERROR` 제외)은
  diff 가 강화한 손상 처리 경로(엔트리/payload 두 겹 방어)와 그대로 정합 — 캐시 목적 값이나
  wire 포맷 변경이 없어 [Spec EIA §R8] 의 닫힌 목록을 다시 열 필요가 없다.

### 3. 문서 구조 규약

- `spec/data-flow/*.md` 16개 전체가 `^## Overview` / `^## Rationale` 둘 다 보유
  (`grep -L` 로 미보유 파일 0건 확인). `15-external-interaction.md` 는 추가로
  `0-overview.md §3` 이 규정한 도메인 spec 5요소(System role / Source→Sink / Schema 매핑
  / 상태 전이 / 외부 의존) 순서까지 그대로 따른다.

### 4. API 문서 규약 (swagger.md)

- 이번 diff 는 컨트롤러·DTO·Swagger 데코레이터를 건드리지 않는다 — 신설된
  `isIdempotencyEntry` / `describeShape` 는 인터셉터 내부 private 타입가드로 API 응답
  스키마에 노출되지 않는다. `swagger.md §1-4`(닫힌 union vs 열린 map), §5(응답 DTO 규약),
  §5-4(체크리스트), §6(레거시 패턴) 어느 항목도 적용 대상 변경분이 없다.

### 5. 금지 항목

- `swagger.md §6` "빈 껍데기 스키마"/double-wrap 페이지네이션 패턴, `error-codes.md §2`
  가 금지하는 "이름 정확성 향상만을 위한 rename"(이번 변경은 로직 리팩터이며 코드 값 자체는
  불변), `migrations.md` append-only 위반(기존 V파일 수정) — 이번 diff·대상 문서 어디에도
  해당 패턴이 관측되지 않는다.

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 찾지 못했다.

- **[INFO]** conventions 번들 절단이 3회 연속 재발
  - target 위치: 프롬프트 `## 정식 규약 모음` 섹션, `error-codes.md`·`swagger.md`·
    `execution-context.md`·`interaction-type-registry.md`·`migrations.md`·
    `conversation-thread.md`·`node-output.md` 등
  - 위반 규약: 없음(규약 위반이 아니라 검토 파이프라인 예산 배분 관찰)
  - 상세: 15-external-interaction.md 가 직접·간접 참조하는 conventions SoT 문서들이 이번
    회차에도 전부 "컨텍스트 예산 초과"로 본문 생략됐다. 이전 두 회차(23_48_39, 00_20_21)
    에서도 동일 현상이 지적됐으며 매번 원본 파일을 절대경로로 직접 대조해 보완했다 — 반복
    비용이 발생하고 있고, 대조를 생략한 checker 라면 근거 없는 PASS/BLOCK 판정 위험이 있다.
  - 제안: orchestrator 프롬프트 조립 시 target 문서 본문이 명시 링크하는 `../conventions/*.md`
    파일에 예산 우선순위를 부여(기존 `feedback_consistency_spec_mode_budget.md` 메모와
    동일 계열, 3회 연속 재확인).

## 요약

이번 PR 의 실 diff(`idempotency.interceptor.ts`/`.spec.ts` — 캐시 엔트리·payload 손상
fail-open 강화 + warn 로깅 + 판정 순서 고정)는 spec 문서를 전혀 변경하지 않았고, target 으로
지정된 `spec/data-flow/**` 16개 문서는 에러 코드 표기(`UPPER_SNAKE_CASE`, 의미 기반 명명),
secret URI scheme, BullMQ 큐 카탈로그 동기화, migration 인용, 에러 응답 봉투 형식
(`{ error: { code, message } }`), 문서 구조(Overview/본문/Rationale 3섹션, `0-` prefix,
`<N>-kebab.md` 파일명) 모두 `spec/conventions/**`(error-codes.md, swagger.md,
secret-store.md, migrations.md) 및 `5-system/2-api-convention.md` 와 정합한다. 코드
변경분에는 Swagger 데코레이터·DTO·신규 wire 에러 코드가 없어 API 문서 규약 적용 대상
자체가 없으며, 명시적 금지 패턴도 관측되지 않았다. 이전 두 회차의 NONE 판정을 독립적으로
재확인했다.

## 위험도

NONE
