# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`

검토 범위: 이번 라운드는 draft 의 「변경 F. 구현 착수 뒤 추가」 두 줄이 신규 판정 대상이고, 변경 A~E 는 이미
planner 커밋(`c8dd613e0`)으로 `spec/1-data-model.md` 등에 반영되어 있어 그 결과물을 실제로 열어 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 나온 INFO 뿐이다.

- **[INFO]** 신규 식별자가 기존 코드베이스와 이미 정합됨(선반영 확인)
  - target 신규 식별자: `webhook_endpoint_reservation_owner`(제약 라벨) · `idx_trigger_endpoint_path`(V132, 기존) ·
    `isEndpointPathUniqueViolation`(서비스 판정 함수)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:216-245`,
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3025-3031`
  - 상세: draft 의 설계(§ "강제는 DB 가 한다")가 지목한 두 제약 이름이 이미 `triggers.service.ts` 의
    `CONFLICT_NAMES`/`isEndpointPathUniqueViolation` 구현과 정확히 일치한다. V133 마이그레이션·엔티티는 아직 없지만
    서비스 판정 함수 쪽은 선구현되어 있고, 이름이 draft 와 문자 그대로 일치해 충돌이 아니라 정합이다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 신규 엔티티/테이블/트리거명 — 코드베이스 전역에 선점 없음
  - target 신규 식별자: 엔티티 `WebhookEndpointReservation`, 테이블 `webhook_endpoint_reservation`, DB 트리거
    `trg_trigger_reserve_endpoint_path`, 마이그레이션 `V133`
  - 기존 사용처: 없음 — `codebase/backend/src`(entities 포함) · `codebase/frontend` · `codebase/packages` ·
    `codebase/backend/migrations/` 전체를 grep 했으나 어느 것도 기존에 다른 의미로 쓰이지 않는다.
    `V133` 마이그레이션 파일도 아직 존재하지 않아 버전 번호 선점 충돌이 없다(`V132` 다음 순번, sequential).
  - 상세: 트리거명은 draft 스스로 `trg_trigger_updated_at`(V001, `codebase/backend/migrations/V001__initial_schema.sql:380`)과
    별개임을 명시했고 실제로도 이름이 다르다(`_updated_at` vs `_reserve_endpoint_path`).
  - 제안: 없음.

- **[INFO]** `§2.8.1` 앵커·서브 엔티티 번호 — 기존 컨벤션과 일치
  - target 신규 식별자: `spec/1-data-model.md` 헤딩 `### 2.8.1 WebhookEndpointReservation`
  - 기존 사용처: 같은 문서의 `2.9.1`(Trigger↔Schedule 동기화), `2.10.1`(IntegrationUsageLog), `2.12.1~2.12.4`,
    `2.13.1~2.13.3`, `2.18.1`, `2.18.2`, `2.21.1` — 부모 엔티티(`2.8 Trigger`) 아래 관련 서브 엔티티를 `N.1` 로 붙이는
    기존 패턴과 동일하다. 번호 중복(기존에 `2.8.1`이 다른 의미로 쓰인 적) 없음.
  - 제안: 없음 — 컨벤션 준수 확인.

- **[INFO]** 신규 e2e 파일 경로 — 명명 컨벤션·경로 겹침 없음
  - target 신규 식별자: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts`(변경 F, 아직 미생성 —
    같은 PR 의 developer 단계에서 생성 예정)
  - 기존 사용처: 없음(`ls codebase/backend/test/` 확인). 이름 패턴은 형제 파일
    `trigger-endpoint-path-dedupe.e2e-spec.ts`(V131 전용 가드) · `deletion-cascade-indexes.e2e-spec.ts` ·
    `entity-schema-declarations.e2e-spec.ts` 와 동일한 `<feature-kebab>.e2e-spec.ts` 규약을 따른다.
  - 상세: 현재 `spec/1-data-model.md` frontmatter `code:` 리스트에는 아직 이 파일이 없다(변경 F 미반영 상태 확인) —
    반영 시 기존 3개 항목에 한 줄 추가하는 순수 additive 변경이라 리스트 내 항목과의 충돌도 없다.
  - 제안: 없음.

- **[INFO]** 에러 코드 재사용 — 신규 코드 아님, 의도된 통합
  - target: `TRIGGER_ENDPOINT_PATH_CONFLICT`(변경 D)
  - 기존 사용처: `spec/5-system/3-error-handling.md:238` — 기존 코드를 예약 위반까지 포괄하도록 의미를 확장한다.
    draft 본문이 "이름이 부정확한 코드가 아니라 의도한 통합"이라 명시하고 `error-codes.md` 레지스트리 신규 행이
    필요 없다고 밝혔다 — 신규 식별자가 아니라 기존 식별자의 의도적 재사용이므로 충돌 범주에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** 변경 F 두 줄의 삽입 지점 — 기존 불릿과 병합이 아니라 첨언
  - target: `spec/1-data-model.md` Rationale "지운 · 바꾼 웹훅 경로의 영구 예약" 안의 기존 `**하지 않은 것**:` 불릿
    (현재 `spec/1-data-model.md:1045`, "예약을 풀어 주는 운영 기능…")
  - 상세: draft 변경 F 는 이 불릿에 "UI 고지를 더하지 않았다" 한 줄을 추가하라고 지시한다. 같은 라벨(`하지 않은 것`)이
    이미 한 항목을 담고 있어 두 사실(운영 기능 미제공 · UI 고지 미제공)이 한 불릿에 합쳐지는 형태다 — 식별자 충돌은
    아니지만 같은 문서 안에 `넣지 않은 것`(1057) · `통일하지 않은 것`(1072) · `대조하지 않은 것`(1076) 등 비슷한
    prose 라벨이 여러 Rationale 절에 반복돼 있다. 구조적 명명 규칙(정식 컨벤션)은 없으므로 WARNING 은 아니다.
  - 제안: 없음 — 정보성 확인.

## 요약

이번 draft 가 새로 도입하는 식별자(엔티티/테이블 `webhook_endpoint_reservation`(`WebhookEndpointReservation`) ·
DB 트리거 `trg_trigger_reserve_endpoint_path` · 제약 라벨 `webhook_endpoint_reservation_owner` · 마이그레이션 `V133` ·
spec 헤딩 `§2.8.1` · e2e 파일 `webhook-endpoint-reservation.e2e-spec.ts`)을 `codebase/backend/src` · `codebase/frontend` ·
`codebase/packages` · `codebase/backend/migrations` · `spec/**` 전역에서 grep 했으나 다른 의미로 이미 쓰이는 동일 식별자는
없었다. 오히려 서비스 판정 함수 쪽(`triggers.service.ts`)은 draft 의 이름과 문자 그대로 이미 정합돼 있어 선행 구현과의
불일치도 없다. 재사용하는 유일한 기존 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 draft 가 의도적 재사용임을 명시적으로
근거를 남겼다. 이번 라운드의 신규 대상인 변경 F(frontmatter `code:` 한 줄, Rationale "하지 않은 것" 한 줄)는 기존 목록·불릿에
대한 순수 첨언이라 구조적 충돌도 없다.

## 위험도

NONE
