# Cross-Spec 일관성 검토 — 웹훅 경로 영구 예약 (변경 F 라운드)

대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`. 이번 라운드의 신규 판정 대상은 **변경 F**(`spec/1-data-model.md` frontmatter `code:` 한 줄 + Rationale «하지 않은 것» 한 줄) 두 곳이며, 변경 A~E 는 이미 커밋 `c8dd613e0` 으로 반영된 spec 본문(`spec/1-data-model.md` §2.8.1·§1·§3·Rationale, `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md` §2.3.1·§3, `spec/5-system/3-error-handling.md` §1.10, `spec/data-flow/10-triggers.md`)과의 정합만 확인했다.

## 확인한 것

- **entity·FK 정의**: `spec/1-data-model.md` §2.8.1 `WebhookEndpointReservation`(PK `endpoint_path`, `workspace_id UUID? FK→Workspace SET NULL`, `reserved_at`)이 §1 ER 다이어그램·§3 인덱스 표와 정확히 일치. `spec/data-flow/10-triggers.md` §2.1 Postgres 표의 `webhook_endpoint_reservation` 행(`INSERT … ON CONFLICT DO NOTHING`, PK, partial index)도 같은 정의를 그대로 재진술.
- **anchor 정합**: `#281-webhookendpointreservation` 앵커를 참조하는 4곳(`spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md` ×2, `spec/5-system/3-error-handling.md`)이 모두 실제 heading(`### 2.8.1 WebhookEndpointReservation`)의 slug 와 일치.
- **API 계약**: 409 `RESOURCE_CONFLICT` / `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT` / `details.field='endpoint_path'` 3요소가 `2-trigger-list.md` §2.3.1·§3, `3-error-handling.md` §1.10 사이에서 문자열 그대로 일치. 기존 트리거와의 전역 UNIQUE 충돌과 같은 코드로 묶은 결정(«구분 안 함»)도 두 문서에서 동일하게 서술.
- **error-codes 레지스트리 예외 판단**: `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 [`error-codes.md §3`](../../../../../../spec/conventions/error-codes.md) historical-artifact 레지스트리에 올리지 않기로 한 draft 의 판단은 §3 의 실제 스코프("이름이 부정확한데 유지되는 코드"만 등재)와 부합 — 이 코드는 이름이 부정확한 것이 아니라 의미상 통합이므로 등재 불요라는 draft 의 근거가 §3 원문과 어긋나지 않음.
- **RBAC**: 트리거 생성/`PATCH endpointPath` 는 기존과 동일하게 `editor+` 게이트(`2-trigger-list.md` §2.3.1)이며, 예약 충돌은 그 위에 얹힌 DB 제약일 뿐 권한 모델을 바꾸지 않음. 웹챗 콘솔의 트리거 재사용 경로(`5-admin-console.md` §2.1)도 같은 `TriggersService` 를 타므로 자동으로 보호 대상에 포함 — 새 RBAC 예외 없음.
- **삭제 UI 서술과 변경 F 의 "UI 고지 안 함" 근거**: `2-trigger-list.md` §4.2 webhook 삭제 확인 문구("`{url}` 로 들어오는 모든 호출이 즉시 404")와 §2.3.1 `endpointPath` 편집 행("변경 시 옛 URL 은 즉시 404 — 다이얼로그 경고 후 진행")은 예약 도입 이후에도 그대로 참이다(소유 워크스페이스 안에서는 동작 변화가 없다는 draft 의 전제와 일치). 다른 워크스페이스로 그 경로를 옮기려는 시도는 같은 §2.3.1 행에 이미 있는 409 서술이 알린다. 변경 F 가 "UI 고지를 추가하지 않았다"고 적으며 가리키는 두 절(§4.2·§2.3.1)의 현재 문구와 모순되는 지점 없음.
- **code: frontmatter 신규 e2e 항목**: `spec/1-data-model.md` frontmatter 는 아직 변경 F 를 반영하지 않은 상태(A~E 만 반영)이며, `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` · `codebase/backend/migrations/V133__*.sql` 모두 아직 존재하지 않음 — draft 의 "F 는 --spec 후 반영, 구현은 같은 PR" 순서 서술과 저장소 실측이 일치. 선례 `trigger-endpoint-path-dedupe.e2e-spec.ts`(V131 을 임시 스키마에서 파일 그대로 실행)와 같은 패턴을 재사용하겠다는 서술도 실제 파일 구조와 부합.
- **FK 삭제 동작 표기**: `WebhookEndpointReservation.workspace_id` 는 데이터 모델 전체에서 `FK → Workspace` 중 **유일하게 SET NULL**(다른 20여 곳은 전부 CASCADE) — 그러나 이는 draft 의 «영구 예약» 결정에 따른 의도된 예외이며 Rationale(«지운 · 바꾼 웹훅 경로의 영구 예약», «§2 FK 삭제 동작 · 빠진 컬럼» 양쪽)이 이미 설명·근거를 남겨 두어 서술 불일치가 아님.

## 발견사항

없음 — CRITICAL·WARNING 대상 충돌을 찾지 못했다.

- **[INFO]** `data-flow/12-workspace.md` §2.1 cascade 표에 `webhook_endpoint_reservation` 미등재
  - target 위치: 변경 F 범위 밖(참고용 확인) — draft 자체는 이 파일을 건드리지 않음
  - 충돌 대상: `spec/data-flow/12-workspace.md` §2.1 Postgres 표(워크스페이스 삭제 시 sink 목록)
  - 상세: 워크스페이스 삭제로 `webhook_endpoint_reservation.workspace_id` 가 SET NULL 되는 새 부수효과가 이 표에는 없다. 다만 이 표는 애초에 `workspace` 를 참조하는 전체 테이블(~20여개, 같은 문서 Rationale 에서 스스로 인정)을 나열하지 않고 핵심 4개 sink 만 다루는 문서라, 이번 draft 가 새로 만든 갭이 아니라 기존 문서 스코프의 연장이다. 조치 불요 — 향후 그 표를 전체 FK 목록으로 확장하는 별도 작업이 있다면 그때 함께.
- **[INFO]** `spec/1-data-model.md` L1049 의 `plan/complete/spec-draft-webhook-endpoint-reservation.md` 인용
  - target 위치: draft 자체가 아니라 이미 반영된 변경 A 의 Rationale(«지운 · 바꾼 웹훅 경로의 영구 예약» 근거 줄)
  - 충돌 대상: 같은 draft 의 체크리스트(아직 `plan/in-progress/` — `plan/complete/` 이동 전)
  - 상세: 완료 전 경로를 앞당겨 인용한 상태라 지금 그 링크를 열면 착지하지 않는다. draft 체크리스트 자체가 "`plan/complete/` 이동 전 경로 인용(마무리에서 해소)"로 이미 인지하고 있는 항목(`--impl-prep 19_11_16` INFO 이월)이라 신규 발견이 아니며 cross-spec 충돌도 아니다(spec→plan 포인터 위생 문제).

## 요약

변경 F 두 줄(`spec/1-data-model.md` frontmatter `code:` 예고, Rationale «하지 않은 것» UI 고지 미채택 근거)은 이미 반영된 변경 A~E(§2.8.1 엔티티, 409 에러 코드 통합, `2-trigger-list` 필드 매트릭스·삭제 다이얼로그, `data-flow/10-triggers` 흐름표) 및 이들이 참조하는 웹챗 콘솔·인증·RBAC spec 과 데이터 모델·API 계약·에러 코드·권한 어느 축에서도 모순을 만들지 않는다. 신규 엔티티는 데이터 모델 전체에서 유일하게 `workspace_id` 를 SET NULL 로 두는 FK 이지만 그 예외는 draft 자신의 설계 의도이자 이미 Rationale 로 근거가 남아 있어 불일치가 아니다. 두 INFO 는 각각 기존 문서 스코프의 연장(워크스페이스 cascade 표 미확장)과 이미 인지된 완료 전 경로 인용이라 조치를 요구하지 않는다.

## 위험도

NONE
