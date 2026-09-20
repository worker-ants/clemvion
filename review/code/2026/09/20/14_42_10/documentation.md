# 문서화(Documentation) 리뷰 — sched-recalc-unit (2라운드, 누적 diff)

## 검토 범위

이번 diff 는 `origin/main` 대비 누적분이라 1라운드 리뷰 산출물(`review/code/2026/09/20/14_22_46/*`)과
consistency-check 산출물(`review/consistency/2026/09/20/14_01_01/*`)까지 포함한다. 그중 문서화 관점에서
실질적으로 새로 볼 대상은 다음 셋이다.

- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 1라운드 WARNING 조치로 추가된 **네 번째 테스트**
  (`cron · timezone 을 안 바꾸면 재계산하지 않는다`)와 그 JSDoc
- `plan/in-progress/sched-recalc-unit.md` — 그 조치 이후에도 갱신되지 않은 상태로 남아 있는지 확인
- `review/code/2026/09/20/14_22_46/RESOLUTION.md` — 조치 서술이 실제 커밋과 일치하는지

1라운드 documentation 리뷰(`14_22_46/documentation.md`)가 지적한 "JSDoc 이 `scheduleRow()` 함수가 아니라
테스트를 문서화해 배치가 모호하다"(INFO)는 이번 라운드의 리팩터링(`ae060b266`, 팩토리를 테스트들보다 위로 이동)으로
**실제로 해소됐음을 직접 파일을 열어 확인**했다 — 각 JSDoc 블록이 이제 자신이 설명하는 `it(...)` 바로 위에 온다.

## 발견사항

- **[WARNING]** plan 문서의 뮤턴트 목록·체크리스트가 같은 작업의 라운드1 조치(`ae060b266`)로 늘어난 네 번째
  표면(재계산 게이트를 통째로 무력화하는 뮤턴트)을 반영하지 않는다 — "뮤턴트 셋 전부" 서술이 실제보다 좁다
  - 위치: `plan/in-progress/sched-recalc-unit.md:45-47` (`## 테스트` 뮤턴트 목록), `:54-55` (체크리스트 항목)
  - 상세: 이 plan 의 `## 할 것` 은 재계산 조건 `dto.cronExpression || dto.timezone` 이 "**두 항이 각각 표면**"이라는
    설계로 시작한다(`:31`). `## 테스트`(`:45-47`)는 그 설계에 맞춰 뮤턴트 3개(재계산 블록 삭제 / timezone 항 제거 /
    갱신 전 값으로 계산)만 나열하고, 체크리스트(`:54-55`)는 "뮤턴트 셋 **전부** RED"·"각 표면이 하나씩 갈린다"고
    확정 서술한다. 그런데 1라운드 리뷰(`14_22_46/SUMMARY.md` WARNING 1)가 바로 이 설계의 빈틈 — 게이트를
    `if (true)` 로 통째로 무력화해도 29건 전부 GREEN — 을 실측했고, `ae060b266` 로 네 번째 테스트(대조군)를
    추가해 고쳤다. `RESOLUTION.md:10`(`review/code/2026/09/20/14_22_46/RESOLUTION.md`)도 스스로
    "**내 plan 의 «각 항이 표면» 이 반쪽이었다**"고 명시한다. 즉 plan 원문이 틀렸다는 사실이 RESOLUTION 과 새 테스트의
    JSDoc(`schedules.service.spec.ts` 「게이트의 세 번째 분기」)에는 기록됐는데, **정작 plan 원문 자체는 고쳐지지
    않고 옛 프레이밍 그대로 남아 있다.** `git grep`(`if (true)`, `통째`, `대조군`, `세 번째`)으로 확인한 결과 이
    plan 파일 59줄 전체에 새 표면에 대한 언급이 전혀 없다. 이 plan 은 아직 `plan/complete/` 로 옮겨지지 않았고
    체크리스트에 `[ ] /ai-review 수렴` · `[ ] --impl-done` 이 남아 있어 **아직 고칠 기회가 있는 문서**다 — 이대로
    완료 처리되면 "이 항목이 무엇을 판별하는지"의 기록이 RESOLUTION.md 한 곳에만 남고, plan 이 원래 의도한
    "완료 시점의 단일 진실"에는 반영되지 않는다.
  - 제안: `## 할 것`의 "두 항이 각각 표면" 뒤에 "(1라운드 리뷰로 드러남: 이것만으로는 게이트 자체를 무력화하는
    회귀를 못 잡는다 — 셋째 분기 「둘 다 아님」도 표면화해야 함)" 같은 정정을, `## 테스트` 뮤턴트 목록에 네 번째
    항목("게이트 조건 자체를 `if (true)` 로 무력화 → 대조군 테스트 RED")을, 체크리스트 항목에 `ae060b266` 커밋
    해시를 추가한다. `CLAUDE.md` 의 plan 라이프사이클 규약상 원문을 지우기보다 **정정을 덧붙이는** 방식이 이
    프로젝트의 기존 관례(취소선 보존)와 맞다.

- **[INFO]** 새 네 번째 테스트의 JSDoc 이 인용 경로를 생략해, 같은 블록의 다른 JSDoc 과 인용 스타일이 어긋난다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 게이트 425-428 (`* 게이트의
    **세 번째 분기**...1라운드 리뷰가 실측: 29건 전부 GREEN`) — 실제 파일에서 `Read` 로 직접 대조한 현재 줄
    번호는 494-497
  - 상세: 바로 위 두 테스트의 JSDoc 은 근거를 `plan/complete/schedule-cron-flake.md`, `review/code/2026/09/20/12_45_31`
    처럼 **구체적 경로**로 인용한다. 반면 이 네 번째 테스트의 JSDoc 은 "1라운드 리뷰가 실측"이라고만 적어
    어느 세션인지(`review/code/2026/09/20/14_22_46`) 명시하지 않는다. 실측 수치("29건 전부 GREEN")는 그
    세션의 `SUMMARY.md` WARNING 1 문구와 정확히 일치함을 확인했지만, 경로가 없어 다음 사람이 원 근거를
    찾으려면 날짜로 `review/code/2026/09/20/` 아래를 뒤져야 한다.
  - 제안: `(review/code/2026/09/20/14_22_46 W1)` 형태로 세션 경로를 덧붙이면 이 파일의 다른 JSDoc 과 인용
    형식이 통일된다. 필수는 아님.

- **[INFO]** `RESOLUTION.md` 의 조치 서술이 실제 diff·커밋과 일치함을 확인
  - 위치: `review/code/2026/09/20/14_22_46/RESOLUTION.md:10-11`
  - 상세: W1 행이 설명하는 "대조군 테스트 추가·`|| true` 형태로 재현해 RED 확인"과 W2 행의 "팩토리를 방어
    분기 테스트 위로 이동"을 실제 커밋(`ae060b266`)의 diff·현재 파일 구조와 대조했다 — 서술과 실제 변경이
    일치한다. 커밋 해시도 실재(`git log`로 확인).

## 요약

프로덕션 코드 변경은 없고 테스트 커버리지 보강만 있는 diff 라 README/API 문서/CHANGELOG/환경변수 문서 갱신
필요성은 이번 라운드에도 없다. 1라운드 documentation INFO(JSDoc 배치 모호)는 팩토리 이동으로 실제 해소됐음을
확인했다. 다만 이 세션이 스스로 "내 plan 의 설계가 반쪽이었다"고 인정한 정정이 RESOLUTION.md 와 새 테스트
주석에만 남고 **정작 그 설계를 원래 선언한 plan 문서 자체에는 반영되지 않은** 갭이 하나 있다 — 이 plan 은 아직
`--impl-done`·`plan/complete/` 이전 단계라 고칠 여지가 남아 있으므로 WARNING 으로 표시한다. 그 외에는 새 테스트
JSDoc 의 인용 경로 생략(INFO) 정도만 남는다.

## 위험도

LOW
