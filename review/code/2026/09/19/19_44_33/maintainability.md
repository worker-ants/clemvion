# 유지보수성(Maintainability) 리뷰

## 검토 범위

실제 애플리케이션 코드(`codebase/backend/**`) 9개 파일을 중심으로 검토했다. `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`, `review/consistency/2026/09/19/**`(consistency-checker 산출물), `spec/**` 은 산문 문서·리뷰 산출물이라 "함수 길이·중첩·매직 넘버" 같은 코드 유지보수성 관점이 직접 적용되지 않는다 — 별도 결함 없이 확인만 하고 발견사항 대상에서 제외했다.

## 발견사항

- **[INFO]** 테스트 케이스 생성기의 3중 `flatMap`/`map` 중첩
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3034-3039`
  - 상세: `it.each` 인자를 `(['update','create'] as const).flatMap(m => (['driverError','top'] as const).flatMap(s => CONFLICT_NAMES.map(n => [m,s,n])))` 형태로 3중 중첩해 생성한다. 축이 3개(메서드·표면·제약이름)로 늘면서 중첩 깊이가 생겼지만, 바로 위 JSDoc 주석("이름 축: ... 서비스가 인덱스 이름만 알면 그 흔한 경우가 500 으로 나간다")이 각 축의 의도를 설명해 의도 파악은 어렵지 않다. 다만 축이 하나 더 늘면(예: 4중 중첩) 가독성이 급격히 떨어질 수 있는 지점이다.
  - 제안: 지금 상태로는 허용 범위이나, 축이 더 늘어날 경우 `cartesian(...)` 같은 이름 있는 헬퍼로 추출해 `it.each(cartesian(METHODS, SURFACES, CONFLICT_NAMES))` 형태로 평탄화할 것을 고려.

- **[INFO]** Swagger 설명 문자열의 문장 구조가 두 조건(트리거 존재 / 예약된 경로)을 서술어 없이 나열
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:51`
  - 상세: `'...트리거가 이미 존재하거나(...), 다른 워크스페이스가 예약한 경로(...). 둘을 구분하지 않는다.'` — 앞 절은 "트리거가 존재하거나"(서술어 있음), 뒤 절은 "...예약한 경로"로 명사구에서 끝나 문법적으로 어색하게 읽힐 수 있다. 이 저장소의 전반적인 telegraphic 코멘트 스타일과는 부합하지만, 이 문자열은 최종 사용자(API 소비자)가 Swagger 문서에서 그대로 읽는 문구라 내부 코드 주석보다 문장 완결성 기준이 조금 더 높아야 한다.
  - 제안: "...트리거가 이미 존재하거나, 다른 워크스페이스가 예약한 경로이거나 둘 중 하나다(...)." 처럼 서술어를 맞추는 정도의 사소한 다듬기. 차단 사유 아님.

- **[INFO]** DB 트리거 함수가 `INSERT ... ON CONFLICT DO NOTHING` 후 별도 `SELECT`로 소유자를 재조회(2회 왕복)
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:38-45`
  - 상세: `reserve_webhook_endpoint_path()` 가 INSERT 와 SELECT 두 문장으로 나뉘어 있다. `ON CONFLICT (endpoint_path) DO UPDATE SET endpoint_path = EXCLUDED.endpoint_path RETURNING workspace_id INTO reserved_by` 형태로 합치면 한 왕복으로 줄일 수 있었다. 다만 트리거 자체가 이미 행 잠금을 전제하는 짧은 함수이고, 바로 위 주석이 "예약은 지우지 않으므로 방금 넣었거나 이미 있던 행이 반드시 있다" 며 왜 두 단계인지 설명하고 있어 의도 파악에 문제는 없다. 정확성 문제는 아니고 사소한 스타일 개선 여지.
  - 제안: 필수 아님 — 참고용 기록.

## 정합성이 확인된 항목 (참고, 오탐 방지)

- **네이밍**: `webhook_endpoint_reservation`(테이블)/`WebhookEndpointReservation`(엔티티)/`reserve_webhook_endpoint_path()`(함수)/`trg_trigger_reserve_endpoint_path`(트리거) 모두 기존 `trg_<table>_updated_at`, `idx_<table>_<cols>` 명명 관례와 일치.
- **매직 넘버 없음**: `VARCHAR(255)` 는 기존 `trigger.endpoint_path VARCHAR(255)`(`V001__initial_schema.sql:151`, `trigger.entity.ts` `length: 255`)와 정확히 일치 — 임의의 숫자가 아니라 기존 컬럼 폭을 그대로 계승.
- **중복 제거(개선)**: 이번 diff 가 기존 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(단일 문자열 상수)를 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(`ReadonlySet<string>`)로 일반화해 두 제약/라벨 이름을 한 곳에서 관리하도록 리팩터링했다 — 여러 곳에 문자열을 흩뿌리는 대신 `isEndpointPathUniqueViolation()` 한 함수로 판정을 집중시켰다. 옛 상수명은 저장소 전역에서 잔존 참조 0건으로 확인(clean rename).
- **부분 인덱스 패턴**: `@Index(..., { where: 'workspace_id IS NOT NULL' })` 는 `workspace.entity.ts`(`type = 'personal'`), `model-config.entity.ts`(`is_default = true`), `node-execution.entity.ts` 와 동일한 기존 patial-index 관례를 그대로 따른다.
- **함수 길이·중첩**: `reserve_webhook_endpoint_path()`(트리거 함수), `isEndpointPathUniqueViolation()` 모두 짧고 단일 책임 — INSERT/SELECT/IF 정도의 직선적 흐름이며 과도한 중첩 없음.
- **문서화**: 마이그레이션 헤더 주석이 기존 `V131`/`V132` 파일과 동일한 형식(요약 · SoT 링크 · 왜 · 순서가 뜻을 가지는 이유 · DOWN 절)을 그대로 따른다. 서비스 계층 JSDoc 도 "이름이 바뀌면 조용히 좁아진다"는 위험을 명시적으로 문서화해 다음 편집자가 실수하기 어렵게 만든다.

## 요약

이번 diff(V133 웹훅 경로 영구 예약)는 마이그레이션 헤더 주석 형식·명명 규칙·부분 인덱스 패턴·에러 판정 로직 구조를 기존 코드베이스(V131/V132, `trigger.entity.ts`, 기존 partial index 엔티티들)와 촘촘히 맞춰 작성됐다. 특히 단일 문자열 상수를 `ReadonlySet`으로 일반화해 두 종류의 충돌 원인(실재 인덱스 vs DB 트리거가 raise 하는 논리적 라벨)을 하나의 판정 함수로 모으고, 그 함정("이름이 바뀌면 조용히 좁아진다")을 코드 자신의 JSDoc과 양방향 단위 테스트로 문서화한 점은 모범적이다. 발견된 사항은 전부 INFO 등급(테스트 케이스 생성기 3중 중첩, Swagger 문구 문장 구조, 트리거 함수의 2단계 왕복)이며 어느 것도 가독성·복잡도·유지보수성을 실질적으로 저해하지 않는다.

## 위험도
NONE
