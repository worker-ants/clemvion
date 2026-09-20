# RESOLUTION — 00_06_01

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (testing) | `893dfeb7a` | 성공 경로 테스트에 `scheduleRepo.remove(schedule)` 호출 단언 추가 — 뮤턴트(1줄 제거)로 판별력 확인 |
| #2 | 코드 (testing) | `893dfeb7a` | `triggerId` 없는 분기의 0-affected→404 대조 테스트 추가 — 뮤턴트(1줄 제거)로 판별력 확인 |
| #3 | 코드 (maintainability) | `69889f74e` | `NotFoundException` 리터럴 3중 복제를 `throwScheduleNotFound(): never` 헬퍼로 추출 (형제 `triggers.service.ts` 선례와 동일 형태) |
| #4 | 코드 (documentation) | `131296205` | `CHANGELOG.md` `## Unreleased` 최상단에 형제 항목(#1369·#1370)과 같은 4단 구성으로 추가, CASCADE 판별자 차이 명시 + 남는 자리(`IntegrationsService.remove()`) 기재 |

INFO 9(선택 사항, race 테스트에 `triggerRepo.delete` 호출 인자 단언 추가)도 SUMMARY#1/#2 커밋(`893dfeb7a`)에 함께 반영했다.

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend `src/modules/schedules/` 52개 포함 전체 스위트)
- build : 통과 (타입체크 ratchet 포함, 신규 `DeleteResult` mock 캐스팅 문제 없음)
- e2e   : 통과 (backend Jest 371 passed + frontend Playwright 51 passed, `.claude/tools/run-test.sh e2e` duration=241s) — `_test_logs/e2e-20260921-003116.log`. `schedule-delete-concurrency.e2e-spec.ts` 포함

## 보류·후속 항목

- SUMMARY INFO 1~13 은 모두 "조치 불요" 로 SUMMARY 자체가 처분 완료 표기 — 자동 흐름 대상 아님.
  - INFO 6: `IntegrationsService.remove()` 는 이 PR 범위 밖 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 등재 확인됨(그대로 유지). 본 세션 CHANGELOG 항목(SUMMARY#4)에도 남는 자리로 다시 명시.
  - INFO 1: BullMQ `removeJob()` 이중 호출(락 밖) — 기존 잔여, defer 근거 트래커에 있음. 조치 불요.
  - INFO 4: `spec/2-navigation/3-schedule.md` §4 의 "동시 삭제→두 번째 404" 서술 침묵 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 에 등재됨(문서 갱신은 그 트래커의 별도 작업). spec 결함이 아니라 이미 추적 중인 침묵이므로 이번 세션에서 spec draft 를 새로 만들지 않았다.
- 민감 변경 가드에 해당하는 항목 없음 — DB 마이그레이션·외부 API 계약·인증·결제 변경 전무.
- spec 관련(spec 결함/SPEC-DRIFT) 항목 없음 — WARNING 4건 전부 코드 관련으로 분류, spec draft 작성 없음.
