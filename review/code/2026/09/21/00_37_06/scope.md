# 변경 범위(Scope) 리뷰 — schedule-dup-delete (`SchedulesService.remove()` 동시 DELETE 중복 감사)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실측한 변경 파일 29개와 프롬프트에 나열된 파일 29개(`파일 1`~`파일 29`)를 1:1 대조했다 — 완전히 일치한다. 추가·누락된 파일 없음.

## 발견사항

- **[INFO]** 실질 코드 변경은 4개 파일뿐이고 나머지 25개는 plan/review 산출물이다
  - 위치: 전체 diff (`git diff --stat origin/main...HEAD`)
  - 상세: 실제 로직 변경은 `codebase/backend/src/modules/schedules/schedules.service.ts`(핵심 수정) · `schedules.service.spec.ts`(단위 테스트) · `test/schedule-delete-concurrency.e2e-spec.ts`(신규 e2e) · `CHANGELOG.md` 뿐이다. 나머지는 `plan/in-progress/schedule-dup-delete.md`(신규 작업 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md`(공유 백로그 트래커 갱신), `review/code/2026/09/21/00_06_01/**`(직전 `/ai-review` 세션 산출물 14개), `review/consistency/2026/09/20/23_37_12/**`(impl-prep consistency-check 세션 산출물 8개)다. 이는 이 저장소의 확립된 관례(`CLAUDE.md` "정보 저장 위치" 표, `review/` 는 gitignore 대상이 아니며 세션 산출물을 커밋하는 것이 표준)와 일치한다 — 스코프 이탈이 아니다.
  - 제안: 조치 불요(정보 제공용).

- **[INFO]** 핵심 로직 변경(`schedules.service.ts`)은 `remove()` 메서드와 그 보조 헬퍼 추출에만 국한된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — 첫 번째 hunk(`findById` 의 `NotFoundException` 인라인 throw → `throwScheduleNotFound()` 헬퍼 호출 + 헬퍼 정의), 두 번째 hunk(`remove()` 내부의 트리거 삭제 `affected` 판정 + `triggerId` 없는 방어 분기의 `scheduleRepository.delete` 판정)
  - 상세: 두 hunk 모두 이번 작업이 대상으로 삼은 "동시 DELETE 중복 감사" 결함과 직접 관련된다. `throwScheduleNotFound(): never` 헬퍼 추출은 임의 리팩토링이 아니라 직전 `/ai-review` 라운드(`review/code/2026/09/21/00_06_01`)의 maintainability WARNING #3(형제 파일 `triggers.service.ts` 의 동일 선례를 인용한 리터럴 3중 복제 지적)에 대한 명시적 응답이며, 별도 커밋(`69889f74e`)으로 분리되어 버그 수정 커밋(`eb94361cc`)과 섞이지 않았다. `remove()` 를 벗어난 다른 메서드·다른 클래스에 대한 변경은 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신은 이번 작업에서 발견한 사실만 반영한다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4782~4803행대(diff 상 `- [ ]` 항목 하나 추가, 기존 `- [ ]` 항목 한 곳에 `3-schedule.md §4` 한 구 추가)
  - 상세: 신규 항목은 이번 세션이 착수 전 전수조사(`grep -rn "AUDIT_ACTIONS\..*_DELETED"`)로 찾은 다섯 번째 자리(`IntegrationsService.remove()`)를 등재하는 것이고, 기존 항목 수정은 이번 세션이 impl-prep consistency-check(W2)에서 지적받아 스케줄 문서 격차를 같은 목록에 추가한 것이다. 둘 다 이번 작업 도중 실제로 확인된 사실의 기록이며, 이 항목들 자체를 지금 구현하지는 않았다(등재만) — 기능 확장이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 포맷팅·불필요한 임포트·설정 파일 변경 없음
  - 위치: 전체 diff
  - 상세: `schedules.service.spec.ts` 의 유일한 import 변경(`Repository` → `DeleteResult, Repository`)은 신규 테스트에서 `mockResolvedValueOnce({affected: 0, raw: []} as DeleteResult)` 캐스팅에 실제로 쓰인다 — 미사용 임포트 아님. 공백·줄바꿈만 바뀐 hunk, `package.json`/`tsconfig`/CI 설정 등 무관 설정 파일 변경 없음.
  - 제안: 조치 불요.

## 관측된 이상 상태 (참고)

리뷰 도중 `git status --short` 를 연속 두 차례 실행했는데, 첫 실행에서 `codebase/backend/src/modules/schedules/schedules.service.ts` 가 잠깐 ` M`(수정됨)으로 표시됐다가 바로 다음 실행에서는 다시 clean 으로 돌아왔다(그 사이 `git diff` 로 본 실제 변경 내용은 비어 있었다). 이 세션은 해당 파일에 어떠한 write/edit 도 수행하지 않았다 — 프롬프트가 경고한 대로 병렬로 도는 다른 reviewer 가 가설 검증을 위해 순간적으로 파일을 건드렸다가 스스로 원복한 것으로 추정된다. 최종 확인 시점(`git status --short`)은 clean 했고 이 리뷰의 판정에는 영향이 없었다.

## 요약

29개 변경 파일이 `git diff --stat` 실측과 정확히 1:1 대응하며, 실질 코드 변경(`schedules.service.ts`/`.spec.ts`/e2e/CHANGELOG)은 "동시 DELETE 두 건이 `schedule.deleted` 감사를 두 번 남기는" 결함 하나에 좁게 집중돼 있다. 유일하게 "리팩토링"으로 보일 수 있는 `throwScheduleNotFound()` 헬퍼 추출은 직전 리뷰 라운드가 형제 파일 선례를 근거로 명시 요청한 항목이고 별도 커밋으로 분리돼 있어 임의 리팩토링이 아니다. plan 트래커 갱신 2건도 이번 세션이 실제로 발견·확인한 사실(다섯 번째 자리, 문서 격차 확장)만 등재한 것이고, 나머지 절반 이상을 차지하는 `review/code/**`·`review/consistency/**` 신규 파일은 이 저장소의 표준 워크플로가 요구하는 산출물이다. 의도 이상의 변경, 무관한 파일 수정, 기능 확장, 포맷팅/주석/임포트/설정의 부적절한 혼입은 발견되지 않았다. 리뷰 도중 다른 reviewer 로 추정되는 일시적 파일 터치를 관측했으나 자체 원복되어 저장소는 clean 상태다.

## 위험도

NONE
