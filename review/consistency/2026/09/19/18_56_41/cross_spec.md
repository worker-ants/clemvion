# Cross-Spec 일관성 검토 — 웹훅 경로 영구 예약 draft

대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` (spec_impact: `spec/1-data-model.md` ·
`spec/5-system/12-webhook.md` · `spec/2-navigation/2-trigger-list.md` · `spec/5-system/3-error-handling.md` ·
`spec/data-flow/10-triggers.md`)

## 발견사항

- **[WARNING]** 새 DB 트리거 예외를 409 로 옮기는 서비스 계층 predicate 가 **이름 하나로 좁혀진 기존 코드**이고, draft 는 이를
  "변경" 목록에 명시하지 않았다
  - target 위치: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` §설계 "강제는 DB 가 한다" 불릿 —
    "제약 이름 `webhook_endpoint_reservation_owner` — 서비스가 기존 `idx_trigger_endpoint_path` 위반과 함께 위의 409 로
    옮긴다"
  - 충돌 대상: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_endpoint_path'` 상수 + `isEndpointPathUniqueViolation()` +
    `rethrowEndpointPathConflict()` (228~239행, 1654~1679행). 이 predicate 는 SQLSTATE 23505 **이면서 인덱스/제약
    이름이 정확히 `idx_trigger_endpoint_path` 일 때만** true 를 돌려준다. false 면 `rethrowEndpointPathConflict` 는
    **원본 에러를 그대로 다시 던진다** (409 로 매핑되지 않음) — 함수 자신의 JSDoc 이 "이름이 바뀌면 이 술어는 조용히
    false 를 돌려주고… 계약이 조용히 좁아진다" 고 스스로 경고하고 있다.
  - 상세: draft 가 새로 도입하는 DB 트리거는 `trigger` 테이블이 아니라 새 `webhook_endpoint_reservation` 테이블에서
    발생하는, **제약 이름이 다른** `unique_violation` 이다. 현재 코드의 predicate 는 정확히 하나의 이름만 인식하도록
    의도적으로 좁혀져 있으므로, `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 를 두 이름(또는 새 predicate)을 모두 인식하도록
    넓히지 않으면 예약 충돌은 409 `RESOURCE_CONFLICT` 가 아니라 **처리되지 않은 예외(사실상 500)** 로 나가, draft 가
    §D 에서 쓰려는 `spec/5-system/3-error-handling.md` §1.10 의 "두 원인을 구분하지 않고 같은 409 로 응답한다" 는
    문서화된 계약을 실제 코드가 충족하지 못한다. draft 의 "변경" A~E 목록과 "체크리스트" 는 "서비스의 409 매핑" 이라고만
    적어 이 구체적 코드 지점(이름 하드코딩·자기 경고 주석이 있는 지점)을 짚지 않는다.
  - 제안: draft 의 "설계" 또는 "변경" 절에 이 predicate 를 명시적으로 지목 — 예: "`isEndpointPathUniqueViolation` 이
    `idx_trigger_endpoint_path` **또는** `webhook_endpoint_reservation_owner` 를 모두 인식하도록 넓힌다(또는 새
    predicate 를 추가해 `rethrowEndpointPathConflict` 에서 함께 검사한다)". 구현 시작 전 이 파일이 이미 --impl-prep
    스코프에 들어가도록 plan 에 남겨 두면 좋다.

- **[INFO]** `spec/data-flow/10-triggers.md` §2.1 "Schema 매핑" 표에 `webhook_endpoint_reservation` 행이 없다
  - target 위치: draft "변경" E — `spec/data-flow/10-triggers.md` 의 "정정 (2026-09-18)" 인용 블록 아래에 추가
    문단만 넣는다
  - 충돌 대상: `spec/data-flow/10-triggers.md` §2. Schema 매핑 §2.1 Postgres 표 (173행 `trigger` 생성 행, 그 아래
    `schedule` 생성 행 등)
  - 상세: 이 표는 "트리거 생성" 이벤트가 건드리는 **모든** 테이블(같은 트랜잭션에서 함께 쓰이는 `schedule` 포함)을
    sink 단위로 나열하는 것이 기존 관례다. draft 의 설계상 트리거 생성·`endpoint_path` 변경 시 DB 트리거가
    `webhook_endpoint_reservation` 에 `INSERT … ON CONFLICT DO NOTHING` 을 수행하는데, 이 표에는 그 sink 가
    행으로 등재되지 않는다 — 인용구 추가만으로는 "Schema 매핑" 표 자체의 완결성이 깨진 채 남는다.
  - 제안: §2.1 표에 `webhook_endpoint_reservation | 트리거 생성·endpoint_path 변경(DB 트리거) | INSERT …
    ON CONFLICT DO NOTHING | PK (endpoint_path) · 소유 불일치 시 unique_violation(제약 `webhook_endpoint_reservation_owner`)`
    형태의 행을 함께 추가.

- **[INFO]** 새 엔티티가 이 문서의 모든 다른 엔티티와 달리 UUID 대리키 없이 자연키(`endpoint_path`)를 PK 로 쓴다
  - target 위치: draft §설계 "`webhook_endpoint_reservation` — 경로의 소유 기록. `endpoint_path` PK …"
  - 충돌 대상: `spec/1-data-model.md` §2 의 엔티티 25개 전부 — 예외 없이 `id | UUID | PK` 행이 첫 줄이다(59, 102,
    115, 126, 143, 161, 220, 239, 265… 등 grep 결과 전부)
  - 상세: 자연키 PK 선택 자체는 이 엔티티의 성격(경로 문자열이 곧 예약의 유일 식별자)에 맞고 기술적으로 문제는
    없다. 다만 이 저장소는 최근에도(6f9c0f1c1, 53335867a) "선언이 실제 DB 와 다른가" 를 촘촘히 잡는 관행이 있고,
    이 파일의 25개 엔티티가 예외 없이 UUID 대리키를 쓰는 강한 패턴이 있어, `id` 컬럼이 없는 것이 **의도**인지
    **누락**인지 다음 리뷰어가 헷갈릴 수 있다.
  - 제안: §2.8.1 신설 시 "이 엔티티만 UUID 대리키가 없다 — PK 가 곧 예약 대상 경로이므로 별도 id 가 무의미하다"
    한 줄을 Rationale 또는 필드 표 옆에 명시.

## 요약

draft 는 기존 spec 다섯 파일의 정확한 위치(줄·앵커·인용문)를 짚고 있고, V132 전역 UNIQUE·FK 인덱스 원칙·트리거
삭제 4경로·`endpointPath` mutable 규칙·웹챗 공개 UUID 서술 등 최근에 막 확정된 인접 결정들과 모두 정합한다 —
직접적인 spec-vs-spec 모순(CRITICAL)은 발견되지 않았다. 가장 중요한 리스크는 spec 텍스트 자체가 아니라, draft 가
전제하는 "두 종류의 DB 위반이 같은 409 로 합쳐진다" 는 계약이 실제로는 이름 하나로 좁혀진 기존 predicate
(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)를 명시적으로 넓혀야만 성립한다는 점이다 — 이 코드는 스스로 "이름이
바뀌면 계약이 조용히 좁아진다" 고 경고하고 있어, 구현 단계에서 놓치면 spec 이 약속한 응답 계약(§1.10)이
깨진다. 나머지 두 건은 완결성·명명 관례 수준의 INFO 다.

## 위험도
LOW
