# 변경 범위(Scope) 리뷰 — 스케줄 재계산 게이트 대조군 테스트 (2라운드)

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실제 브랜치 diff(21개 파일, 1139 insertions, 9 deletions,
전부 신규 추가/신규 파일이거나 순수 삽입-치환)를 프롬프트 번들과 대조해 누락·추가 파일이 없음을 확인했다.
커밋 경계도 직접 열어(`git show --stat`) 각 커밋이 무엇을 묶었는지 확인했다:

- `75d6b5db3` — cron/timezone happy-path 테스트 2건 + `plan/in-progress/sched-recalc-unit.md` 신설 +
  `--impl-prep` consistency-check 산출물 8개 (1라운드 scope 리뷰가 이미 검토, NONE)
- `6d5f8dd87` — plan 체크리스트 갱신만 (`plan/in-progress/sched-recalc-unit.md` 9줄)
- `ae060b266` — 1라운드 리뷰 W1·W2 조치: `scheduleRow()` 팩토리를 방어 분기 테스트 위로 이동해 그
  테스트도 재사용하게 하고(W2), 세 번째 분기("cron·timezone 둘 다 안 바꾸면 재계산 안 함") 대조군
  테스트 1건 신설(W1)
- `a7cb7f79b` — 1라운드 리뷰 세션 산출물(`review/code/2026/09/20/14_22_46/**` 11개 파일: SUMMARY·
  RESOLUTION·개별 reviewer 리포트) 커밋, 코드 변경 없음

이번 changeset 이 프로덕션 코드(`schedules.service.ts`)를 건드리지 않았음을 `git diff --stat`/
`grep import` 로 재확인했고, 리뷰 도중 저장소에 아무것도 쓰지 않았다(`git status --short` 에는 이
세션 자신의 미기록 출력 디렉터리 `review/code/2026/09/20/14_42_10/` 만 untracked 로 남는다).

## 발견사항

이번 changeset(21개 파일)에서 스코프 이탈을 찾지 못했다.

1. **의도 이상의 변경 없음** — `ae060b266` 이 손댄 것은 정확히 1라운드 리뷰가 지적한 두 항목(W1
   대조군 테스트 부재, W2 팩토리 미적용 중복)뿐이다. `git show ae060b266`로 직접 대조한 결과, diff
   는 (a) 기존 `scheduleRow()` 함수 선언을 파일 뒤쪽에서 앞쪽(방어 분기 테스트 바로 위)으로 옮기고
   그 테스트의 인라인 리터럴을 `scheduleRow()` 호출로 교체, (b) 새 `it(...)` 블록 1건 추가 —
   이 둘 외의 어떤 라인도 건드리지 않았다. RESOLUTION.md 의 서술("고침 — W1", "고침 — W2")과 실제
   diff 가 정확히 1:1 로 대응한다.
2. **불필요한 리팩토링 없음** — 팩토리 이동은 새 리팩토링이 아니라 리뷰가 지목한 정확히 그 중복을
   없애는 국소 조치다. `computeNextRuns` spy 캐스트·`saved` 캡처 패턴 등 1라운드가 INFO 로 남긴
   나머지 중복(파일 전체 패턴)은 이번 라운드에서도 손대지 않았다 — RESOLUTION.md 가 "조치 없음 —
   이 diff 에서만 바꾸면 두 양식이 공존" 이라고 명시한 판단과 실제로 일치한다.
3. **기능 확장(over-engineering) 없음** — 프로덕션 코드(`schedules.service.ts`) 변경이 여전히
   이 changeset 에 없다. 세 번째 분기 테스트는 게이트의 기존 세 갈래(cron/timezone/둘 다 아님) 중
   테스트되지 않았던 한 갈래를 고정할 뿐, 새 동작을 요구하거나 만들지 않는다.
4. **무관한 파일·영역 수정 없음** — 신규 파일 11개(`review/code/2026/09/20/14_22_46/**`)는 이번
   작업 자신의 1라운드 리뷰 세션 산출물이고, 8개(`review/consistency/2026/09/20/14_01_01/**`)는
   `--impl-prep` 사전 검토 의무 산출물이다. 둘 다 CLAUDE.md 가 규정한 developer 역할의 정당한
   쓰기 대상(`review/**`)이며, 별도 트랙·별도 작업의 코드가 섞여 들어온 흔적이 없다.
5. **포맷팅 변경 없음** — `schedules.service.spec.ts` 의 diff(128줄, +119/-9)는 팩토리 이동·
   리터럴 치환·신규 `it` 블록 삽입에 정확히 대응하며, 공백·개행만 바뀐 hunk 는 없다.
6. **주석 변경(불필요) 없음** — 새 JSDoc(세 번째 분기 테스트 바로 위)은 그 테스트의 근거(1라운드
   리뷰의 실측: 게이트를 `if (true)` 로 바꿔도 29건 전부 GREEN)를 설명하는 데 국한된다. 기존
   JSDoc·인라인 주석은 이동한 팩토리 정의 순서 변경 외에는 내용이 바뀌지 않았다.
7. **임포트 변경 없음** — `git diff origin/main...HEAD -- schedules.service.spec.ts` 에서
   `import` 라인 추가/삭제가 0건임을 grep 으로 확인했다.
8. **설정 변경 없음** — `.json` 변경은 `review/**` 산출물(`meta.json`·`_retry_state.json`, 세션
   메타데이터)뿐이며 프로젝트 설정 파일이 아니다.

## 1라운드 스코프 리뷰와의 연속성

1라운드 scope 리뷰(`review/code/2026/09/20/14_22_46/scope.md`)가 남긴 유일한 INFO — 리뷰 도중
`schedules.service.ts` 가 순간적으로 `if (true)` 로 뮤테이션됐다가 자체 원복된 관측 — 는 이번
changeset 의 diff 에 없고, 현재 저장소도 clean 하다(`git diff` 무출력). 재발 여부를 다시
확인했으며 이번 라운드에서는 그런 잔상이 관측되지 않았다.

## 요약

이번 2라운드 changeset(21개 파일, +1139/-9)은 1라운드 `/ai-review` 가 지적한 Warning 두 건(재계산
게이트의 "둘 다 거짓" 분기 커버리지 부재, `scheduleRow()` 미적용 중복)에 대한 정확히 국소적인 조치와
그 조치·1라운드 세션 자체의 산출물 커밋으로만 구성된다. `git show`로 커밋 단위까지 대조한 결과 각
커밋이 테스트/plan-체크리스트/리뷰-산출물로 깔끔히 분리돼 있고, 프로덕션 로직·설정·임포트 변경은
여전히 0건이다. 스코프 이탈, 드라이브바이 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 노이즈,
불필요한 주석·임포트·설정 변경 어느 것도 발견되지 않았다.

## 위험도

NONE
