# 변경 범위(Scope) 리뷰 — schedule-dup-delete (3라운드, 00_56_52)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실측한 변경 파일 42개가 프롬프트에 나열된 파일 42개(`파일 1`~`파일 42`)와 1:1 정확히 일치한다. `git log --oneline origin/main..HEAD` 로 6개 커밋(`eb94361cc` fix → `893dfeb7a` test → `69889f74e` refactor(헬퍼) → `131296205` docs(CHANGELOG) → `030299603` docs(RESOLUTION) → `2879e88c7` refactor(=== 0 비교)+docs(CHANGELOG 각주 정정))을 각각 확인했고, 핵심 코드 diff(`schedules.service.ts`, `schedules.service.spec.ts`)는 현재 워킹트리에서 직접 재확인해 프롬프트 내용과 일치함을 확인했다. `git status --short` 는 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/21/00_56_52/`) 외 잔여가 없음(clean) — 저장소에 뮤테이션을 가하지 않았다.

## 발견사항

- **[INFO]** 실질 코드 변경은 4개 파일뿐이고 나머지 38개는 plan/review 산출물이다
  - 위치: 전체 diff (`git diff --stat origin/main...HEAD`)
  - 상세: 로직 변경은 `codebase/backend/src/modules/schedules/schedules.service.ts`(핵심 수정) · `schedules.service.spec.ts`(단위 테스트) · `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`(신규 e2e) · `CHANGELOG.md` 뿐이다. 나머지는 `plan/in-progress/schedule-dup-delete.md`(신규 작업 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md`(공유 백로그 트래커 갱신), 그리고 직전 두 `/ai-review` 라운드(`review/code/2026/09/21/00_06_01/**` 14개, `review/code/2026/09/21/00_37_06/**` 13개)와 `--impl-prep` consistency-check 산출물(`review/consistency/2026/09/20/23_37_12/**` 8개)이다. 이는 `CLAUDE.md` "정보 저장 위치" 표 및 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 절이 명시한 이 저장소의 표준 워크플로(리뷰/consistency 산출물을 세션과 함께 커밋)와 정확히 일치한다 — 스코프 이탈이 아니다.
  - 제안: 조치 불요(정보 제공용).

- **[INFO]** `throwScheduleNotFound(): never` 헬퍼 추출은 임의 리팩토링이 아니라 이 PR 자신이 만든 중복에 대한 명시적 응답
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (헬퍼 정의부, `findById` 호출부, 트리거 삭제 판정부, 방어 분기 판정부)
  - 상세: 1라운드 리뷰(`review/code/2026/09/21/00_06_01/maintainability.md` WARNING #3)가 이 PR 자신이 새로 추가한 두 판정 지점이 기존 `findById` 의 `NotFoundException` 리터럴과 합쳐 한 파일에 3중 복제를 만든다고 지적했고, 형제 파일 `triggers.service.ts` 의 `throwTriggerNotFound()` 선례를 그대로 따라 별도 커밋(`69889f74e`)으로 추출했다. `remove()`·`findById` 를 벗어난 다른 메서드·클래스에 대한 변경은 없다. 무관한 코드 정리가 아니라 이 PR 이 스스로 만든 부채를 그 자리에서 닫은 것이다.
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md` 의 기존 트리거 항목(`#1370`, 이 PR 이전에 존재)에 각주 한 줄을 추가한 것은 이 PR 자신의 변경이 유발한 모순의 최소 정정
  - 위치: `CHANGELOG.md` — 기존 트리거 항목 "남는 것" 문단 끝 (`**2026-09-21 해소**: 위 스케줄 항목이 그 잔여를 닫았다...`)
  - 상세: 이 PR 이 새로 추가한 스케줄 항목(파일 최상단)이 "스케줄 결함을 닫았다"고 적는데, 그 결함을 처음 남겼다고 적어 둔 옛 트리거 항목의 "남는 것" 문단이 그대로 있으면 같은 파일 안에서 인접 모순이 생긴다. 2라운드 리뷰(`review/code/2026/09/21/00_37_06/documentation.md` WARNING #1)가 이를 지적했고, 원문을 지우지 않고(취소선/삭제 없음) 각주만 덧붙이는 이 저장소의 기존 관례(`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "**2026-09-20 해소**" 각주 선례)를 그대로 따랐다 — 다른 PR 의 항목을 재작성하거나 삭제하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `affected` 판정을 `!affected` → `affected === 0` 로 바꾼 것(마지막 커밋)은 기능 확장이 아니라 같은 락 서브시스템의 기존 결정에 맞춘 좁은 정정
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` 게이트 342행(`if (affected === 0) this.throwScheduleNotFound();`), 게이트 381행(같은 형태)
  - 상세: 2라운드 리뷰(`review/code/2026/09/21/00_37_06/concurrency.md` WARNING #2)가 이 PR 의 두 판정 지점이 같은 파일이 잠그는 advisory lock 을 공유하는 자매 함수 `rewriteTriggerConfigLocked` 의 기존 결정(`affected === 0` 명시 비교, `null`/`undefined` 는 판정하지 않음)과 다르다고 지적했고, 정확히 그 두 지점만 `=== 0` 으로 바꿨다. 새 기능이나 새 판정 대상을 추가한 것이 아니라 기존 두 판정 지점의 비교 연산자만 좁게 고쳤다.
  - 제안: 조치 불요.

- **[INFO]** 포맷팅·불필요한 임포트·설정 파일 변경 없음
  - 위치: 전체 diff
  - 상세: `schedules.service.spec.ts` 의 유일한 import 변경(`Repository` → `DeleteResult, Repository`)은 신규 테스트 두 건의 `{ affected: 0, raw: [] } as DeleteResult` 캐스팅에 실제로 쓰인다 — 미사용 임포트 아님. `package.json`/`tsconfig`/CI 설정 등 무관 설정 파일 변경은 diff 에 없다. 공백/줄바꿈만 바뀐 hunk 도 없다.
  - 제안: 조치 불요.

## 요약

`git diff --stat origin/main...HEAD` 실측 42개 파일이 프롬프트 파일 목록과 정확히 1:1 대응하며, 6개 커밋 각각이 좁은 단일 목적(버그 수정 → 방어 분기 테스트 보강 → 헬퍼 추출 → CHANGELOG 추가 → RESOLUTION 기록 → 2라운드 WARNING 2건 조치)을 갖는다. 실질 코드 변경(`schedules.service.ts`/`.spec.ts`/e2e/`CHANGELOG.md`)은 "동시 DELETE 두 건이 `schedule.deleted` 감사를 두 번 남기는" 단일 결함에 끝까지 좁게 집중돼 있다. 헬퍼 추출, CHANGELOG 각주, `=== 0` 비교 전환은 모두 이 PR 자신에 대한 직전 두 리뷰 라운드의 명시적 WARNING 에 대한 응답이지 임의의 추가 리팩토링·기능 확장이 아니며, 각각 별도 커밋으로 버그 수정 커밋과 분리돼 있다. `plan/**` 2건은 이번 세션이 실제로 발견·확인한 사실(다섯 번째 남은 자리 `IntegrationsService.remove()`, 스케줄 문서 격차)만 등재했을 뿐 코드로 구현하지 않았다. 나머지 절반 이상을 차지하는 `review/code/**`·`review/consistency/**` 신규 파일은 `CLAUDE.md` 가 규정한 이 저장소의 표준 워크플로 산출물이다. 의도 이상의 변경, 무관한 파일 수정, 기능 확장(over-engineering), 포맷팅/주석/임포트/설정의 부적절한 혼입은 발견되지 않았다.

## 위험도

NONE
