# 변경 범위(Scope) 리뷰 — schedule-dup-delete (4라운드, 01_16_46)

## 검증 방법

프롬프트에 나열된 55개 파일을 `git diff --stat origin/main...HEAD` 실측과 대조해 1:1 일치를 확인했다. `git log --oneline origin/main..HEAD` 로 7개 커밋(`eb94361cc` fix → `893dfeb7a` test → `69889f74e` refactor(헬퍼) → `131296205` docs(CHANGELOG) → `030299603` docs(RESOLUTION) → `2879e88c7` refactor(`=== 0` 비교)+docs(CHANGELOG 각주) → `210808701` test(대조군))을 각각 확인했다. 핵심 코드 diff(`schedules.service.ts`, `schedules.service.spec.ts`, 신규 e2e)는 `git diff origin/main...HEAD -- <path>` 로 직접 재확인해 프롬프트 내용과 완전히 일치함을 확인했다. `plan/in-progress/spec-draft-nullable-notation-followups.md` diff 도 직접 열어 대조했다. `git status --short` 는 이 세션 자신의 출력 디렉터리(`review/code/2026/09/21/01_16_46/`) 외 잔여가 없음(clean) — 리뷰 중 저장소에 뮤테이션을 가하지 않았다.

## 발견사항

- **[INFO]** 실질 코드 변경은 4개 파일뿐이고 나머지 51개는 plan/review 산출물이다
  - 위치: 전체 diff(`git diff --stat origin/main...HEAD`)
  - 상세: 로직 변경은 `codebase/backend/src/modules/schedules/schedules.service.ts`(핵심 수정) · `schedules.service.spec.ts`(단위 테스트) · `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`(신규 e2e) · `CHANGELOG.md` 뿐이다. 나머지는 `plan/in-progress/schedule-dup-delete.md`(신규 작업 plan), `plan/in-progress/spec-draft-nullable-notation-followups.md`(공유 백로그 트래커 갱신), 그리고 이전 세 `/ai-review` 라운드(`review/code/2026/09/21/00_06_01/**` 14개, `00_37_06/**` 13개, `00_56_52/**` 13개)와 `--impl-prep` consistency-check 산출물(`review/consistency/2026/09/20/23_37_12/**` 8개)이다. `CLAUDE.md` "정보 저장 위치" 표와 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 절이 규정한 이 저장소의 표준 워크플로(리뷰/consistency 산출물을 세션과 함께 커밋)와 정확히 일치 — 스코프 이탈 아니다.
  - 제안: 조치 불요.

- **[INFO]** 마지막 커밋(`210808701`)의 신규 유닛 테스트 2건은 직전 라운드(`00_56_52` testing WARNING 1)가 실측한 판별력 공백(`affected===0` → `!affected` 뮤턴트가 32건 전건 GREEN)에 대한 정확한 응답
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `'삭제 — affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다 (트리거 경로)'`, `'삭제 — 같은 대조군 (triggerId 없는 방어 분기)'`
  - 상세: 새 판정 로직(`affected === 0`)이 존재하는 **이유**(`null`/`undefined` 는 "모른다"이지 "없다"가 아니다)를 검증 대상으로 좁게 겨냥한 대조군이며, 자매 함수 `rewriteTriggerConfigLocked` 의 기존 대조군과 같은 형태(`for (const affected of [undefined, null])`)를 재사용했다. 새 프로덕션 코드나 새 기능은 추가되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `throwScheduleNotFound(): never` 헬퍼 추출, `CHANGELOG.md` 트리거 항목 각주, `!affected`→`affected===0` 전환은 모두 이 PR 자신에 대한 이전 리뷰 라운드의 명시적 WARNING 에 대한 좁은 응답이지 임의의 추가 리팩토링이 아니다
  - 위치: `schedules.service.ts`(헬퍼 정의 + 3개 호출부), `CHANGELOG.md`(트리거 항목 "남는 것" 문단 끝 각주 한 줄), `schedules.service.ts` 게이트 342·381행
  - 상세: 각각 `00_06_01/maintainability.md` WARNING 3, `00_37_06/documentation.md` WARNING 1, `00_37_06/concurrency.md` WARNING 2 에 정확히 대응한다. 헬퍼는 형제 `triggers.service.ts` 의 `throwTriggerNotFound()` 선례를 그대로 따랐고, CHANGELOG 각주는 원문을 지우지 않고(취소선/삭제 없음) 이 저장소의 기존 관례(plan 트래커의 "해소" 각주)를 따랐으며, `=== 0` 전환은 같은 락 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 의 기존 결정에 맞춘 것이다. `remove()`/`findById` 를 벗어난 다른 메서드·클래스·파일에 대한 손질은 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집은 코드 구현이 아니라 이번 세션이 실제로 발견·확인한 두 사실의 등재/스코프 확장뿐이다
  - 위치: 게이트 4785행 부근(`IntegrationsService.remove()` 신규 항목), 4795행 부근(기존 문서-격차 항목의 스코프에 `3-schedule.md §4` 추가)
  - 상세: `IntegrationsService.remove()` 항목은 착수 전 전수 조사(`grep AUDIT_ACTIONS.*_DELETED`)로 찾은, 이 PR 이 명시적으로 손대지 않기로 한(락 없음 → 처방이 다름) 다섯 번째 자리를 등재한 것이고, 두 번째 편집은 이미 존재하던 planner 소유 항목의 스코프 목록에 이번 수정으로 새로 생긴 비대칭(`3-schedule.md`)을 추가한 것뿐이다. 둘 다 `plan/**` 이라 developer 쓰기 권한 범위 안이며, 코드로 구현하지 않고 "이 PR 이 하지 않는 것"으로 명시적으로 스코프 아웃했다.
  - 제안: 조치 불요.

- **[INFO]** 포맷팅·불필요한 임포트·설정 파일 변경 없음
  - 위치: 전체 diff
  - 상세: `schedules.service.spec.ts` 의 유일한 import 변경(`Repository` → `DeleteResult, Repository`)은 신규 테스트의 `{ affected: 0, raw: [] } as DeleteResult` 캐스팅에 실제로 쓰인다. `package.json`/`tsconfig`/CI 설정 등 무관 설정 파일 변경은 diff 에 없다. 공백/줄바꿈만 바뀐 hunk 도 없다.
  - 제안: 조치 불요.

## 요약

`git diff --stat origin/main...HEAD` 실측 55개 파일이 프롬프트 파일 목록과 정확히 1:1 대응하며, 7개 커밋 각각이 좁은 단일 목적(버그 수정 → 방어 분기 테스트 보강 → 헬퍼 추출 → CHANGELOG 추가 → RESOLUTION 기록 → 판정 비교연산자 정정+CHANGELOG 각주 → 판별력 대조군 테스트)을 갖는다. 실질 코드 변경(`schedules.service.ts`/`.spec.ts`/신규 e2e/`CHANGELOG.md`)은 "동시 DELETE 두 건이 `schedule.deleted` 감사를 두 번 남기는" 단일 결함에 4라운드 내내 좁게 집중돼 있고, 각 라운드에서 추가된 헬퍼 추출·연산자 정정·대조군 테스트·CHANGELOG 각주는 전부 이 PR 자신에 대한 직전 리뷰의 구체적 WARNING 에 대한 응답이지 임의의 확장이 아니다. `plan/**` 2건은 코드로 구현하지 않은 순수 등재/스코프 확장이다. 전체 diff 의 절반 이상을 차지하는 `review/code/**`·`review/consistency/**` 신규 파일은 `CLAUDE.md` 가 규정한 이 저장소의 표준 워크플로 산출물이며 스코프 이탈이 아니다. 의도 이상의 변경, 무관한 파일 수정, 기능 확장(over-engineering), 포맷팅/주석/임포트/설정의 부적절한 혼입은 발견되지 않았다.

## 위험도

NONE
