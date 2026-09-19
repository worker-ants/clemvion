# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done)

대상 델타: `spec/2-navigation/2-trigger-list.md` §2.3.1(`endpointPath` 행) · §3(PATCH 註 · 409 매핑)에 추가된
"다른 워크스페이스가 예약한 경로(지웠거나 바꾼 경로)" 문구 — 웹훅 경로 영구 예약(V133,
`webhook_endpoint_reservation`) 기능 도입에 따른 변경.

## 발견사항

- **[INFO]** 완료 전 plan 경로를 이미 완료된 것처럼 인용
  - target 위치: 없음(target 문서 자체에는 해당 문구 없음) — 구현 diff 쪽:
    `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` 헤더,
    `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts`,
    `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` 파일 상단 주석
  - 충돌 대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` (frontmatter
    `status: in-progress`)
  - 상세: 세 파일 모두 근거 문서를 `plan/complete/spec-draft-webhook-endpoint-reservation.md` 로
    인용하지만, 실제 plan 파일은 아직 `plan/in-progress/` 에 있다(`status: in-progress`). 이번
    라운드가 1차 리뷰(SUMMARY·RESOLUTION) 단계이므로 작업 완료 시 plan 이 `complete/` 로 이동하면
    자연히 해소되는 통상적 워크플로 상태로 보이나, 지금 시점에는 존재하지 않는 경로를 가리킨다.
  - 제안: 이 작업 세션 마무리(plan 체크리스트 완료 + `complete/` 이동) 시점에 위 세 인용이 실제로
    가리키는 파일이 있는지만 확인하면 된다. 스펙 내용 자체의 모순은 아니므로 별도 스펙 수정은 불필요.

교차 검증한 나머지 항목은 모두 일치했다:

- `spec/1-data-model.md` §2.8.1 `WebhookEndpointReservation` 정의(PK `endpoint_path`, FK
  `workspace_id` `SET NULL`, 409 매핑, "지우지 않는다" 의미론) — target 의 §2.3.1/§3 서술과 정확히 일치.
- `spec/5-system/3-error-handling.md` §1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 항목 — target 이
  링크하는 SoT 이며 문구·조건이 동일(둘을 구분하지 않는다는 서술 포함).
- `spec/5-system/12-webhook.md` "endpointPath 가변성" 절 — 영구 예약 서술이 이미 반영돼 있고
  target 의 인용과 모순 없음.
- `spec/data-flow/10-triggers.md` — `webhook_endpoint_reservation` 데이터 흐름 표·"Webhook
  `endpoint_path` 의 UNIQUE 범위" 절의 2026-09-19 추가 문단이 target/데이터모델과 정합.
- `codebase/backend/src/modules/triggers/triggers.service.ts` 의 이름 상수화
  (`TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`)·응답 메시지 변경("쓰고 있어요" → "쓸 수 없어요")도
  스펙이 요구하는 "두 경우를 구분하지 않는다"·"한때 쓰였다는 사실을 알리지 않는다" 요구와 부합하며,
  변경 전 메시지 문자열이 다른 spec 문서에 리터럴로 박혀 있지도 않아 stale 텍스트 문제 없음.
  마이그레이션 번호(V133)도 기존 V130~V132 와 충돌 없음.
  `spec/5-system/1-auth.md` §3.2 Trigger CRUD 권한 행(viewer=R, editor+=CRUD)도
  target §4.1 표와 일치.
  `CHANGELOG.md` 에도 동일 결정(영구 예약·같은 워크스페이스 재사용 가능·배포 후 잔여 갭)이 반영됨.

## 요약

이번 라운드의 실질 target 델타(`2-trigger-list.md` 의 웹훅 경로 예약 관련 두 문구)는 data-model·
error-handling·webhook·data-flow 네 영역 모두와 정확히 정합하며, API 계약(409 코드·details 필드)·
RBAC(Trigger CRUD 권한)·상태 전이(예약은 지우지 않음, 워크스페이스 삭제 시 주인 없음) 어느 축에서도
모순을 찾지 못했다. 유일한 지적은 구현 코드 주석 3곳이 아직 `in-progress` 인 plan 을 `complete/`
경로로 선인용한 것으로, 스펙 내용의 모순이 아니라 작업 마무리 시점에 자연히 해소될 워크플로 상태다.

## 위험도
NONE
