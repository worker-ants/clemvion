# 변경 범위(Scope) Review

## 검토 방법

`git diff origin/main...HEAD` 전수(163 files: 코드/plan/CHANGELOG 19개 + `review/code/**`·
`review/consistency/**` 산출물 144개)를 확인했다. 프롬프트가 크기 제한으로 diff 를 생략한
파일(6·7·10·11·12·13·18·19번)은 `git show`/`git diff origin/main...HEAD -- <path>` 로 직접
열어 확인했다. `review/**` 하위 144개 파일은 이 저장소 컨벤션(developer 가 매 `/ai-review`·
`/consistency-check` 라운드 산출물을 커밋해 축적)에 따른 정상 절차물이며, `review/**` 는
developer 의 write 권한 범위다 — 범위 이탈 대상이 아니다. 스코프 판단은 실제 코드
변경분(17개 backend 파일, `+1936/-159`) + `CHANGELOG.md` + `plan/in-progress/*.md` 에 집중했다.

이 리뷰 라운드(`23_01_18`)는 직전 라운드(`22_24_35`)의 scope 리뷰 이후 새로 커밋된
`bcba1dc5d`(1건) 만큼의 델타를 추가로 확인했다. 직전 라운드 scope 리뷰(NONE)가 이미 지적한
두 개의 편승 항목(`endpoint-path-conflict-wrap-guard` 갱신, `TriggersService` not-found 헬퍼
추출)은 이번 커밋에서 재발생하지 않았고, 신규로 유입된 코드 변경(`CHANGELOG.md`,
`schedules.service.spec.ts`, `triggers.service.spec.ts`, `triggers.service.ts`,
`plan/in-progress/trigger-config-lost-update.md`)을 `git show bcba1dc5d -- <path>` 로 개별
확인했다.

## 발견사항

- 검토했으나 문제 없음: 최신 커밋(`bcba1dc5d`)이 도입한 `mergeIntoFreshSubKey` 헬퍼는 직전
  라운드가 지적한 CRITICAL(하위 키까지 스냅샷으로 되쓰는 재발 패턴)을 3개 호출부
  (`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`·
  `revokePerTriggerToken`)에서 동시에 닫기 위한 것으로, 이번 PR 이 다루는 결함 클래스(lost
  update)의 직접 파생물이다. 기능 확장이 아니라 같은 버그의 세 번째 재발을 시그니처로
  막는 방어적 수정이다.

- 검토했으나 문제 없음: `triggers.service.spec.ts` 안의 `at()` 선언 재배치(세 provider 교체가
  같은 helper 를 쓰도록 순서만 이동, ~10줄)는 커밋 메시지가 "W7·3라운드 연속 지적"이라고
  명시한 근거가 있는 소규모 테스트 중복 제거다. diff 자체도 코드 이동만이고 로직 변경은
  없다 — 별도 PR 로 분리할 만큼의 무게가 아니다.

- 검토했으나 문제 없음: `CHANGELOG.md` 정정("한 곳도 남지 않는다" → "의도치 않게 엔티티
  전체를 저장하던 경로는 한 곳도 남지 않는다")은 직전 라운드가 지적한 자기모순(같은 항목
  안에서 "save 가 없다"와 "저장 동사는 그대로 둔다"가 공존)을 좁히는 문서 정정이며, 인접
  서술을 건드리지 않고 해당 문장에 국한됐다.

- 검토했으나 문제 없음: `plan/in-progress/trigger-config-lost-update.md` 에 추가된 "8라운드
  리뷰 처분" 섹션은 이 저장소의 plan 라이프사이클 관례(라운드별 처분·근거·뮤턴트 실측 기록)를
  따르며, 후속으로 미룬 항목(W1·W2·W4·W5·W6)을 이번 PR 로 끌어들이지 않고 표로만 등재했다 —
  스코프를 넓히지 않고 정직하게 유예한 사례다.

- 검토했으나 문제 없음: `schedules.service.spec.ts` 에 추가된 두 테스트(쓰기 방식 단언 +
  name-only 분기 대조군)는 직전 라운드가 실측한 CRITICAL(21건 전건 GREEN — 유일한 단언이
  in-memory 재부착만 봄)에 대한 회귀 테스트로, PR 이 이미 변경한 `SchedulesService.update`
  경로 안에 한정된다. 새 프로덕션 코드 변경은 없다.

- (직전 라운드에서 이미 INFO 로 등재·수용된 항목, 재확인만) `endpoint-path-conflict-wrap-guard`
  계열 3파일과 `TriggersService` 의 `assertTriggerFound`/`throwTriggerNotFound`/
  `findByIdForUpdate` 소규모 헬퍼 추출은 이번 라운드에서 추가 변경이 없었다 — 새로운 지적
  사항 없음.

- 전체 PR 범위에서 재확인: `package.json`/lockfile/`tsconfig`/`.eslintrc` 등 설정 파일 변경은
  0건(`git diff origin/main...HEAD --stat -- codebase/` 로 확인한 17개 파일 모두 `hooks/`·
  `schedules/`·`triggers/`·`repo-guards/__tests__` 소속). 미사용 임포트나 순수 포맷팅-only
  hunk 는 관찰되지 않았다 — 모든 hunk 가 실질 코드·주석·테스트 변경을 동반한다.

## 요약

이번 라운드에서 새로 유입된 변경(`bcba1dc5d` 1커밋)은 직전 라운드(`22_24_35`)가 실측으로
지적한 4개 CRITICAL(하위 키 재발·delete-race 게이트 미검증·schedules 쓰기 방식 미검증·
CHANGELOG 자기모순)에 대한 직접 수정과 회귀 테스트로만 구성돼 있으며, "trigger.config
lost-update" 라는 단일 결함 클래스의 경계를 벗어나지 않는다. 유일하게 눈에 띄는 편승성
변경(`at()` 선언 재배치)도 커밋 메시지에 근거(3라운드 연속 지적)가 명시된 10줄 미만의
비-로직 이동이라 스코프 이탈로 보기 어렵다. `package.json`/설정 파일 변경, 미사용 임포트,
포맷팅-only 변경은 이번 라운드에도 발견되지 않았다. `review/**` 산출물 144개 파일은 저장소
컨벤션에 따른 정상 축적물로 스코프 판단 대상이 아니다.

## 위험도

NONE
