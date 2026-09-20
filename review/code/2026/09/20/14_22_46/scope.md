# 변경 범위(Scope) 리뷰 — 스케줄 재계산 happy-path 단위 테스트 추가

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실제 브랜치 diff(10개 파일, 465 insertions, 0 deletions,
전부 신규 추가/신규 파일)를 프롬프트 번들과 대조해 누락·추가 파일이 없음을 확인했다.

## 발견사항

- **[INFO]** 리뷰 도중 `codebase/backend/src/modules/schedules/schedules.service.ts` 에 순간적으로
  미커밋 뮤테이션이 관측됨 — 이 changeset 과는 무관
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:266` (함수: `SchedulesService.update()`)
  - 상세: 리뷰 중 `git status --short` 를 두 차례 실행했다. 첫 호출에서 `M codebase/backend/src/modules/schedules/schedules.service.ts` 가 보였고 `git diff` 로 확인하니 `if (dto.cronExpression || dto.timezone)` 이 `if (true)` 로 바뀌어 있었다(재계산 조건 뮤턴트 — 이번 plan 의 체크리스트가 언급하는 세 뮤턴트: 재계산 블록 삭제·`timezone` 항 제거·갱신 전 cron 사용, 중 어느 것과도 일치하지 않는 형태). 두 번째 호출 시점에는 `git status --short` 에 이 파일이 더 이상 나타나지 않았고 `git diff` 도 비어 있었다 — **원복까지 이미 끝난 상태**였다. 이 파일은 애초에 이번 프롬프트 번들(리뷰 대상 10개 파일)에 포함돼 있지 않다.
  - 해석: 프롬프트가 경고한 "동시에 다른 reviewer 가 같은 워킹트리를 읽는다" 상황의 실례로 보인다 — 다른 병렬 세션(또는 뮤턴트 판별력 검증 스크립트)이 `service.ts` 를 잠깐 뮤테이션했다가 자체적으로 원복한 것으로 판단된다. 나 자신은 이 파일에 어떤 Write/Edit 도 수행하지 않았다(읽기·`git diff`/`git status` 만 실행). 현재 저장소 상태는 clean(`git status --short` 에는 리뷰 산출물 디렉터리만 untracked 로 남음)하므로 **이번 changeset 의 스코프 판정에는 영향 없음** — 다만 다음 리뷰어가 같은 잔상을 결함으로 오인하지 않도록, 그리고 "관측한 이상 상태는 보고하라"는 규약에 따라 기록해 둔다.
  - 제안: 조치 불요(자체 원복 완료, 이 changeset 의 diff 에도 없음). 향후 유사 관측이 반복되면 병렬 세션 격리 강화를 고려.

이 changeset(10개 파일, 전부 추가) 자체에서는 스코프 이탈을 찾지 못했다:

1. **의도 이상의 변경 없음** — `schedules.service.spec.ts` 는 `@@ -416,6 +416,92 @@` 순수 삽입 한 덩어리뿐이고, 기존 테스트·비관련 코드에는 손대지 않았다. `plan/in-progress/sched-recalc-unit.md` 의 "할 것"(cron 변경 케이스, timezone 변경 케이스) · "비대상"(서비스 로직 변경 없음, e2e 유지, BullMQ/감사 로그 제외)과 실제 diff 가 1:1 로 대응한다.
2. **불필요한 리팩토링 없음** — 새로 추가한 `scheduleRow()` 헬퍼는 새 테스트 두 건에만 쓰이고, 바로 위에 있는 기존 "다음 실행 계산이 비면 …" 테스트(그 안의 인라인 객체 리터럴)는 그대로 남겨 손대지 않았다. 기존 코드를 새 헬퍼로 갈아치우는 드라이브바이 리팩토링이 없다.
3. **기능 확장(over-engineering) 없음** — production 코드(`schedules.service.ts`) 변경이 이 changeset 에 전혀 없다(`git diff --stat origin/main...HEAD` 로 확인). 테스트 추가만.
4. **무관한 파일·영역 수정 없음** — `review/consistency/2026/09/20/14_01_01/**` 8개 산출물은 CLAUDE.md 가 요구하는 `--impl-prep` 사전 검토 의무 산출물이며, `spec/2-navigation/` 폴더 스코프로 끌려온 무관 항목(예: `pending_plans` 잔존, 응답 형태 미기재 WARNING)은 각 checker 리포트 스스로가 "이번 작업 범위 밖 · 이미 별도 planner 트랙에 등재"라고 명시해 정리해 두었다 — checker 산출물 자체에 이번 작업과 무관한 코드 변경이 섞여 있지 않다.
5. **포맷팅 변경 없음** — 삽입 블록 외 diff 없음(공백·개행 변경 없음).
6. **주석 변경(불필요) 없음** — 새로 추가된 JSDoc/인라인 주석은 모두 새 테스트 두 건의 근거(연말 창 e2e 플레이키, `||` 조건의 두 항 표면성)를 설명하는 데 국한되고, 기존 주석은 건드리지 않았다.
7. **임포트 변경 없음** — `UpdateScheduleDto`/`Schedule` 등 기존에 이미 import 돼 있던 타입만 재사용, 새 import 문 없음.
8. **설정 변경 없음** — `.json`/설정 파일 변경 없음(`review/consistency/**` 의 `meta.json`·`_retry_state.json` 은 checker 세션 산출물이지 프로젝트 설정 파일이 아니다).

## 요약

리뷰 대상 10개 파일은 전부 추가(insertion)이며, `schedules.service.spec.ts` 에 대한 변경은 plan(`sched-recalc-unit.md`)이 명시한 cron/timezone 재계산 happy-path 단위 테스트 2건 + 그 전용 헬퍼로 정확히 국한된다. production 로직 변경은 이 changeset 에 없고, 함께 커밋된 `plan/in-progress/sched-recalc-unit.md` 와 `review/consistency/2026/09/20/14_01_01/**` 는 각각 작업 계획 문서와 CLAUDE.md 가 의무화한 `--impl-prep` 사전 검토 산출물로 모두 정당한 스코프 안 파일이다. 리뷰 도중 무관한 production 파일(`schedules.service.ts`)에서 순간적인 미커밋 뮤테이션을 관측했으나 자체 원복이 끝난 상태였고 이 changeset 의 diff 에도 포함돼 있지 않아 판정에는 영향이 없다(투명성을 위해 INFO 로 기록).

## 위험도

NONE
