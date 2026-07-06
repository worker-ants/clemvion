# RESOLUTION — 스케줄 triggerId 서버 필터 (cross-page 딥링크)

리뷰: `review/code/2026/07/06/12_52_39/`(api-contract·database·requirement·testing 4인) + `review/consistency/2026/07/06/12_52_39/`(cross-spec·convention-compliance 2인).

**전체 위험도 NONE/LOW. Critical 0, Warning 0** — 6인 전원. 필수 조치 없음. 고가치 INFO만 반영.

## 반영한 INFO
- **requirement INFO(dead-end 커버리지)**: triggerId 가 0건 매칭(서버 빈 결과)일 때도 "전체 보기" 해제 링크가 유지되는지 고정하는 테스트 추가 — 빈 필터 결과에서 사용자가 갇히지 않음을 보장. (FE 23 tests)
- **convention INFO(swagger 일관성)**: `QueryScheduleDto.triggerId` `@ApiPropertyOptional` 에 `example` UUID 추가(자매 QueryTriggerDto 필드와 형식 통일).

## 미반영 INFO(근거)
- **database**: `idx_schedule_trigger_id` 이미 존재(V106, #818) — 마이그레이션 불필요. 결함 아님(확인).
- **api-contract**: `@ApiBadRequestResponse` 가 UUID 검증을 반영 안 함 — workflows folderId 에도 있는 **pre-existing** 갭이라 본 PR 범위 밖.
- **requirement/testing(calendar 뷰)**: 배너의 `viewMode==="list"` 가드는 자명하고, calendar 전환은 상호작용 필요 — 저위험 gray-zone, 테스트 생략.
- **testing(controller/e2e)**: DTO 검증·실 SQL 필터는 unit(service spec)만 커버. e2e 는 Docker 필요·비용 대비 낮아 생략(unit 이 andWhere 계약 검증).
- **cross-spec**: 2-trigger-list §2.1 재서술 권고 — 3-schedule 가 SoT라 모순 아님, 생략.

## 검증
- vitest schedules-page.test.tsx: **23 passed** · backend schedules.service.spec: **11 passed**
- frontend·backend(변경파일) tsc/eslint clean · spec-link·status-lifecycle·i18n parity 가드 통과
