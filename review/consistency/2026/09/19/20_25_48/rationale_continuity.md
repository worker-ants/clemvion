# Rationale 연속성 검토 — spec/2-navigation/2-trigger-list.md (webhook 경로 영구 예약)

## 검토 범위

- target: `spec/2-navigation/2-trigger-list.md` (scope 델타 1파일, §2.3.1 `endpointPath` 행 + §3 PATCH 註 2곳만 변경)
- 구현 diff: `V133__webhook_endpoint_reservation.sql`, `webhook-endpoint-reservation.entity.ts`,
  `triggers.controller.ts`, `triggers.service.ts` (+ `.spec.ts`), `webhook-endpoint-reservation.e2e-spec.ts`,
  `webhook-trigger.e2e-spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`, entity 등록 2곳 (10파일/951줄)
- 대조한 과거 Rationale: `spec/1-data-model.md`(«Webhook `endpoint_path` 전역 유일» 2026-09-18, «지운·바꾼 웹훅 경로의
  영구 예약» 2026-09-19, «`code:` 에 전용 e2e 가드 셋» 2026-09-19), `spec/5-system/12-webhook.md`(«endpointPath
  가변성»), `spec/data-flow/10-triggers.md`(«Webhook `endpoint_path` 의 UNIQUE 범위»), target 자신의 R-1~R-17

## 발견사항

없음 — CRITICAL/WARNING 없음.

target 의 변경은 §2.3.1 `endpointPath` 행과 §3 PATCH 註 두 줄에 "**또는 다른 워크스페이스가 예약한 경로**(지웠거나
바꾼 경로 — [데이터 모델 §2.8.1])" 문구만 추가한 것으로, `1-data-model.md` 의 2026-09-19 Rationale(«지운·바꾼
웹훅 경로의 영구 예약»)이 이미 확정한 결정을 그대로 반영한다. 아래 항목들을 개별 대조했고 전부 정합했다.

- **기각된 대안 재도입 없음**: `1-data-model.md` Rationale 이 명시적으로 기각한 두 대안(기간 한정 묘비, "막지
  않음") 은 diff 어디에도 나타나지 않는다. `webhook_endpoint_reservation` 테이블에 만료 컬럼이 없고(영구),
  DB 트리거(`trg_trigger_reserve_endpoint_path`)가 앱 레벨 검사가 아닌 강제 경로로 구현돼 있다 — «DB 트리거인
  이유» 절의 이유(동시 요청 경합은 앱 레벨이 못 막는다)와 일치.
- **"응답을 구분하지 않는다" 원칙 준수**: `isEndpointPathUniqueViolation` 이 `idx_trigger_endpoint_path` 와
  `webhook_endpoint_reservation_owner` 두 이름을 하나의 `Set` 으로 묶어 **동일한 409 응답**으로 던진다.
  `triggers.service.spec.ts` 에 "두 이름의 409 응답이 같고, 메시지는 «지금 쓰고 있다» 를 말하지 않는다" 는
  전용 단언까지 추가됐다(1-data-model.md Rationale 의 "«예약됨» 을 따로 알리면 그 경로가 한때 쓰였다는 사실이
  새어 나간다" 를 그대로 코드화). 메시지도 "이미 다른 트리거가 **쓰고 있어요**" → "그 엔드포인트 경로는 **쓸 수
  없어요**" 로 정정돼, 예약만 남은 경로(현재 사용 중이 아님)에 대해 거짓을 말하지 않는다.
- **사용 시점 예약(삭제 시점 아님)**: DB 트리거가 `BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id`
  에 걸려 있고 삭제 경로에는 예약 로직이 없다 — Rationale 의 "쓰기 지점이 둘(생성·경로 변경)뿐" 결정과 일치.
  `TriggersService` 의 삭제 로직(§4.3)도 diff 에 포함되지 않았다.
- **UI 고지 미추가 결정 준수**: `1-data-model.md` Rationale 이 "UI 고지(삭제 확인·경로 변경 경고)도 더하지
  않았다" 고 명시했고, target 의 실제 변경도 §4.2 삭제 confirmation 텍스트·§2.5 endpointPath 변경 경고 문구를
  건드리지 않은 채 §2.3.1/§3 의 에러 조건 설명만 갱신했다 — frontend 코드 diff 도 0파일(10개 변경 파일 전부
  backend/migration/e2e).
- **워크스페이스 삭제 시 예약 처분**: 엔티티의 `workspace_id` FK 가 `ON DELETE SET NULL` 이고 B8 e2e 가
  "워크스페이스가 지워져도 예약은 주인 없이 남아 누구도 못 쓴다" 를 검증한다 — Rationale 의 "워크스페이스가
  지워져도 예약은 남는다(주인 없음 → 누구도 못 쓴다)" 와 그대로 대응.
- **`code:` 전용 e2e 가드 원칙과의 정합**: `deletion-cascade-indexes.e2e-spec.ts` 에 V133 신규 FK 인덱스를
  추가한 것은 "쓸 인덱스가 없는 FK 서른하나의 처분" Rationale 이 세운 "새 FK 는 처음부터 인덱스와 함께" 원칙을
  스스로 인용해 따른다.
- **`endpointPath` mutable 원칙 유지**: `12-webhook.md` 의 «endpointPath 가변성 — webhook 은 mutable, schedule
  만 frozen» 을 뒤집지 않는다. B7 e2e 가 "같은 워크스페이스는 바꿨던 경로로 되돌릴 수 있다" 를 검증해 mutable
  성질을 그대로 보존한다.

## 요약

target 문서(`2-trigger-list.md`)의 변경은 이미 `1-data-model.md` §Rationale(2026-09-18/09-19)에서 사용자
결정으로 확정되고 명시적 기각 대안(기간 묘비·앱 레벨 검사·응답 구분·UI 고지)까지 적어 둔 설계를 문자 그대로
반영한 후속 배선이며, 구현 diff(V133 트리거·엔티티·서비스·e2e)도 그 결정의 각 조항(사용 시점 예약, DB 트리거
강제, 응답 비구분, 워크스페이스 삭제 시 주인 없는 예약, mutable 유지)을 하나씩 대응하는 테스트로 고정하고
있다. 과거 Rationale 을 뒤집거나 원칙을 우회하는 지점을 찾지 못했다.

## 위험도

NONE
