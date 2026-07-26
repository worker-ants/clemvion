# 변경 범위(Scope) Review — linear-cancel-mechanism (4R)

## 리뷰 대상의 성격 (선행 확인)

이번 프롬프트에 담긴 "diff" 11개 파일은 전부 `review/code/2026/07/26/13_47_42/` 아래
신규 추가된 리뷰 산출물(`_routing_decision.json`, `meta.json`, 9개 관점별 `.md`)이다 —
`codebase/**` 실제 소스 변경은 이번 diff 에 전혀 포함돼 있지 않다(`git diff` 상 소스
변경은 이미 3R 커밋 `10b27c320`/`dceaa8ca9` 로 완료·커밋됐고, 그 자체의 스코프 적합성은
같은 세트 안의 `13_47_42/scope.md` 가 이미 위험도 NONE 으로 판정 — **재론하지 않는다**,
지시대로).

따라서 이번(4R) 스코프 리뷰의 실질 대상은 **"3R 리뷰가 낸 신규 발견사항(W14~W18 후보)의
내용이 '직전 라운드(2R)가 제기한 결함(C5/W9-W13) 해소 검증'이라는 위임 범위 안에
머물렀는가"** 이다. 파일 자체(신규 `.md`/`.json` 추가)는 `review/code/<date>/<time>/`
관례(CLAUDE.md 명시)에 정확히 부합해 그 자체로는 스코프 위반이 아니다 — 문제가 있다면
**내용 층위**에서다.

## 발견사항

- **[WARNING]** `security.md` 가 이번 라운드 위임 범위(2R 항목 C5/W9-W13 해소 검증) 밖의
  **미변경 파일 2건**에 대해 신규 코드 수정을 제안한다 — 스스로 "이 파일은 이번 PR 의
  diff 에 없다"고 인정하면서도
  - 위치: `review/code/2026/07/26/13_47_42/security.md:34`(`executeNode` generic catch
    WARNING 헤더, 상세 인용 소스 라인은 `execution-engine.service.ts:5758`-`:5905` —
    **이번 3라운드 어느 diff 에도 포함되지 않은 기존 코드 영역**), `security.md:84`
    (`RetryTurnService.failRetryExecution` WARNING 헤더, 상세 인용 소스는
    `retry-turn.service.ts:636`-`:651` — 이 파일 자체가 `13_47_42/meta.json`의 files 목록
    14개 코드/plan/CHANGELOG 파일에 **아예 없음**, 직접 대조 확인).
  - 상세: 두 발견 모두 논거 자체는 타당하다 — `ExecutionCancelledError` 생성자를
    "항상 고정 문자열"에서 "executionId 를 담는 동적 문자열"로 바꾼 이번 3R 의 계약
    변경(`workflow-errors.ts`)이, 이전에는 무해했던 두 기존 소비 지점(`executeNode`
    catch, `RetryTurnService.failRetryExecution`)에서 새로 정보 노출 위험을 만든다는
    "ripple effect" 분석이다. 그러나 이는 **2R 가 제기한 C5/W9-W13 어느 항목의 해소
    검증도 아니고, 이번 3R 코드 diff(6개 소스/테스트 파일 + plan/CHANGELOG)가 건드린
    영역도 아니다** — 완전히 새로운 결함 클래스 발견이며, 제안된 조치(`executeNode`
    catch 에 `instanceof` 가드 추가, `retry-turn.service.ts` 로직 변경)를 그대로
    받아들이면 이번 PR 이 3라운드 내내 지켜온 "6개 파일" 스코프 규율이 **이번 세트
    안의 `scope.md` 자신이 방금 칭찬한 바로 그 규율**(W6/W8/shutdown-FAILED 를 매
    라운드 일관되게 백로그·위임으로 분리)과 모순되게 깨진다. 즉 같은 라운드의 산출물
    내에서 `scope.md`(NONE, "확장 없음")와 `security.md`(신규 결함 2건, diff 밖 파일
    포함)가 서로 다른 전제를 갖고 있다 — `scope.md` 작성 시점에 `security.md` 의
    이 발견이 반영되지 않았을 가능성이 높다(교차 인용 없음).
  - 제안: 이 2건을 이번 결함 해소 사이클(가칭 W14~W18)에 자동으로 편입시키지 말 것.
    같은 defect class(취소를 실패로 오분류 + 내부 sentinel message 노출)이므로 코드
    품질상 유의미하지만, 지금까지 이 PR 이 유지해 온 스코프 분리 원칙(developer 권한
    밖·별도 규모 항목은 백로그/`project-planner` 위임)에 맞춰 **별도 후속 항목으로
    명시 분리**(plan 백로그 또는 별도 PR)할지, 이번 라운드에 의도적으로 편입할지
    orchestrator/사용자가 명시적으로 판단하게 할 것 — 침묵 편입은 이번 PR 의 지금까지
    스코프 규율과 불일치한다.

- **[INFO]** `testing.md` 의 `LoopExecutor` 관련 발견사항은 미변경 코드에 대한 신규 테스트
  인프라 추가를 제안하지만, 심각도·성격상 `security.md` 항목과는 구분된다
  - 위치: `review/code/2026/07/26/13_47_42/testing.md:54`(`LoopExecutor` WARNING 헤더).
  - 상세: `loop-executor.ts` 는 `13_47_42/meta.json` 의 files 목록에 포함돼 있어(3R 가
    검토 대상으로 삼은 파일 — 다만 실제 코드 변경은 없음, "무변경 근거" 확인용)
    완전히 무관한 파일은 아니다. 또한 이 WARNING 은 실제 프로덕션 코드 변경을 요구하지
    않고 "회귀 테스트 부재"만 지적하며, 같은 라운드에 실제로 변경된 자매 실행기
    (ForEachExecutor/ParallelExecutor)가 대칭적으로 `describe.each` 테스트를 받았다는
    점과의 **일관성 지적**이라는 논리적 연결고리가 있다 — `security.md` 의 두 항목처럼
    "완전히 다른 파일의 완전히 다른 결함 클래스"는 아니다. 그럼에도 엄밀히는 "2R 가
    제기한 결함의 해소 검증"이 아니라 "3R 자신이 새로 제안하는 테스트 커버리지
    확장"이므로, 향후 라운드에서 이 항목이 실제 코드(신규 `loop-executor.spec.ts`)로
    편입될 경우 그 자체가 스코프 확장이 됨을 인지해 둘 필요가 있다.
  - 제안: 별도 조치 불요(이미 WARNING/제안 수준으로 적절히 등급화됨). 다음 라운드에서
    이 항목을 실제로 구현할 때는 "2R 결함 해소"가 아니라 "3R 이 새로 제안한 커버리지
    보강"으로 명확히 라벨링해 스코프 추적이 흐려지지 않게 할 것.

- **[INFO]** 그 외 신규 발견사항(concurrency.md의 `executeBackgroundSubgraph` Map 누수 —
  `concurrency.md:10`/`side_effect.md:26`, documentation.md의 §5→§2.2 인용 오류 —
  `documentation.md:52`, requirement.md의 W10 테스트 flake — `requirement.md:39`,
  testing.md의 `containerCancelCheckedAtMs` cleanup 미검증 — `testing.md:47`)는 전부
  **이번 3R 코드 diff 가 새로 도입한 코드/문서(W10 스로틀 Map, 그 JSDoc, 그 회귀 테스트,
  3R 가 신설한 plan 트레이드오프 절)** 를 대상으로 하며, 실제 diff 범위 안에서의 정합성
  검증이다 — 위임 범위("2R 항목 해소 검증")의 자연스러운 연장으로 판단하고 스코프
  위반으로 보지 않는다.

## 요약

이번 4R 대상 diff(review/code/2026/07/26/13_47_42/* 11개 신규 리뷰 산출물 파일) 자체는
`review/code/<date>/<time>/` 관례에 정확히 부합하는 정상적인 리뷰 라운드 출력물이며,
소스 코드·설정·임포트·포맷팅 층위의 스코프 위반은 없다. 내용 층위에서도 신규 발견사항
대부분(concurrency/documentation/requirement/testing 의 cleanup 미검증)은 3R 코드 diff
가 새로 도입한 W10 스로틀·문서를 대상으로 한 정당한 검증 연장이다. 다만 **`security.md`
가 낸 2건의 신규 WARNING(`executeNode` Sub-Workflow 오분류, `RetryTurnService` message
노출)은 스스로 "이번 PR 의 diff 밖" 이라 명시하면서도 미변경 파일(특히
`retry-turn.service.ts`, 3라운드 어느 diff 목록에도 없음)에 대한 코드 수정을 제안**한다
— 논거는 타당한 ripple-effect 분석이지만, 같은 라운드의 `scope.md` 가 "3라운드 내내
스코프 분리 규율이 흔들리지 않았다"고 자평한 것과 정면으로 긴장 관계에 있다. 이 2건이
다음 라운드에 아무 명시적 판단 없이 "결함 해소" 사이클로 조용히 편입되면, 지금까지
이 PR 이 지켜온 스코프 규율(developer 권한 밖·별도 규모 항목은 백로그/위임 분리)이
깨진다 — orchestrator 가 별도 백로그 분리 여부를 명시적으로 판단해야 한다. `LoopExecutor`
테스트 갭(INFO)은 상대적으로 경미하고 이미 적절히 등급화돼 있다.

## 위험도

LOW
