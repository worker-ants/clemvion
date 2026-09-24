# 테스트(Testing) 리뷰 — `isPendingPlanPath` 가드 보강 (2라운드, 20_19_10)

## 검증 방법

- 대상 테스트 두 파일을 직접 재실행: `npx vitest run spec-frontmatter-parse.test.ts
  spec-pending-plan-existence.test.ts` → **70/70 PASS** (`isApplicable` 7 + `isPendingPlanPath`
  8 + 가드 55) — 1라운드 testing 리뷰(`review/code/2026/09/24/19_57_00/testing.md`)가 지적한
  INFO 2건(비-string 방어 부재, look-alike 캐너리 부재)이 이번 라운드 코드에 **실제로 반영돼
  있음**을 소스(`spec-frontmatter-parse.ts:97-101`, `spec-frontmatter-parse.test.ts:124-129,
  131-136`)로 직접 확인.
- 판별 뮤테이션 재현: `spec-frontmatter-parse.ts` 의 `isPendingPlanPath` 본문을 scratch 백업 후
  `return true;` 로 교체(plan §D의 M5)하여 재실행 → **단위 7개 RED · 가드 55개 GREEN**
  (아래 상세). `cp` 로 원복 후 `git status --short` 로 워킹트리 무변경 확인.
- 이 라운드에서 실제로 바뀐 코드(테스트 대상)는 `codebase/frontend/src/lib/docs/__tests__/`
  3파일뿐이며, 파일 5~32(`plan/**`, `review/code/19_57_00/**`, `review/consistency/19_35_41/**`)는
  전부 plan 문서 또는 이전 라운드 리뷰 산출물(markdown/json) 이라 "테스트 존재 여부" 관점이
  적용되지 않음 — 해당 파일들은 이번 리뷰에서 코드로 취급하지 않았다.

## 발견사항

- **[INFO]** plan 문서 §D의 M5 뮤테이션 실측치가 재현 결과와 다르다 — "단위 5 RED" vs 실제 **7 RED**
  - 위치: `plan/in-progress/pending-plan-is-plan.md:64` (`| M5 술어가 항상 true | ... | **단위 5
    RED · 가드 55 초록** |`)
  - 상세: 동일 뮤턴트(`isPendingPlanPath` 를 `return true;` 로)를 직접 재현하니
    `isPendingPlanPath` describe 블록의 8개 `it` 중 "accepts plan files..." 를 제외한 **7개**가
    RED 였다(`rejects the incident shape`, `rejects plan/ locations`, `rejects non-markdown and
    bare directories`, `rejects paths that escape`, `rejects spec paths`, `rejects look-alike
    directories`, `answers false for non-string`). "가드는 초록(55 PASS)" 이라는 정성적 결론
    자체는 내 재현과 정확히 일치해 신뢰할 수 있지만, 판별력의 근거로 제시한 정량 수치(5)는
    틀렸다 — 이 프로젝트가 반복해서 강조해 온 "실측 주장은 그 자체로 검증돼야 한다" 는 교훈이
    이 PR 의 자기 증거에도 적용된다.
  - 제안: plan 문서의 M5 행 수치를 실측대로(7 RED) 정정. `--impl-done` 이 이 spec 외 plan 파일도
    스코프에 넣는 라운드가 있다면 그때 함께 고칠 것 — 이 자체가 머지를 막을 사안은 아니다.

- **[INFO]** CHANGELOG 가 판별 부담을 "단위 테스트 15개" 로 서술해 실제 판별 대상보다 부풀렸다
  - 위치: `CHANGELOG.md:25-26` (`판별의 부담은 단위 / 테스트 15개가 진다.`)
  - 상세: `spec-frontmatter-parse.test.ts` 의 `it` 총 개수는 정확히 15개이지만, 그중 **7개는
    `isApplicable` 을 검사**하는, 이번 결함(`pending_plans` 경로 검증)과 무관한 기존 테스트다
    (`grep -c` 로 직접 확인: `describe("isApplicable")` 7개 + `describe("isPendingPlanPath")` 8개
    = 15개). "`isPendingPlanPath` 가 깨져도 가드만으로는 못 잡는다" 는 문장이 말하는 판별 부담은
    실제로 **8개**가 지는 것이지 15개가 아니다 — 관련 없는 테스트를 분모에 넣어 판별력을
    과장하는 형태.
  - 제안: "판별의 부담은 (해당 predicate 를 검사하는) 단위 테스트 8개가 진다" 로 정정하거나,
    "이 파일의 단위 테스트 15개 중 `isPendingPlanPath` 전담 8개" 처럼 분모를 명확히 할 것.

- **[INFO — 재확인, 이미 완화됨]** 코퍼스 기반 가드(`spec-pending-plan-existence.test.ts`)는
  현재 위반 0건이라 그 자체로는 predicate 파손을 잡지 못한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:51-58`
  - 상세: 1라운드 testing 리뷰가 이미 지적했고, plan §D M5 가 스스로 실측·문서화했으며, 판별
    책임을 순수 단위 테스트로 명시적으로 이전해 둔 상태다. 새로운 조치는 불필요 — 이번 라운드
    재검증으로 그 완화가 유효함(가드 55/55 GREEN 임에도 단위가 실제로 RED 를 낸다)을 다시
    확인했을 뿐이다.

## 긍정적 관찰

- `isPendingPlanPath` 는 순수 함수(`unknown → boolean`, 부작용 없음)라 mock 없이 직접 테스트
  가능 — 테스트 용이성이 높고 실제로 mock 을 전혀 쓰지 않았다.
- 엣지 케이스 커버리지가 촘촘하다: 사고 재현 케이스(실재하는 비-plan 파일), `plan/research/`,
  `..` 탈출, 비-마크다운/bare 디렉터리, look-alike 디렉터리(`plan/in-progress-archive/`), 비-string
  입력(숫자·undefined·null) 을 모두 별도 `it` 로 분리해 실패 시 원인을 명확히 좁힌다.
- 가드 통합 테스트(`spec-pending-plan-existence.test.ts`)가 두 단언("is a work plan" / "path
  resolves")의 책임을 주석으로 명시해 다음 편집자가 둘 중 하나를 다른 하나로 오인하지 않게
  해뒀다.
- 기존 27개 spec × pending_plans 항목 순회 구조를 건드리지 않고 새 `it` 를 루프 앞에 추가하는
  방식이라 회귀 위험이 낮다 — 직접 재실행으로 기존 "path resolves" 55개 중 어느 것도 깨지지
  않음을 확인.
- 개발자가 스스로 판별 뮤테이션(M2~M5, M1→M1b 재수행 포함)을 수행하고 무효 뮤턴트(M1)를 스스로
  발견해 정정한 기록이 plan 문서에 남아 있다 — 드문 수준의 자기 검증. 단, 그 결과표의 숫자
  하나(M5)는 위 INFO 처럼 재현치와 어긋난다.

## 요약

이번 라운드에서 실제로 테스트 대상이 되는 코드(`isPendingPlanPath` 와 그 단위/통합 테스트)는
1라운드 이후 변경되지 않았고, 1라운드 testing 리뷰가 지적한 INFO 2건(비-string 방어, look-alike
캐너리)이 이미 코드에 반영돼 70/70 PASS 로 재확인됐다. 직접 재현한 판별 뮤테이션도 plan 문서의
정성적 결론("코퍼스 가드는 predicate 파손을 못 잡고, 판별 부담은 단위 테스트가 진다")과 일치한다.
다만 그 결론을 뒷받침하는 자기-보고 수치 두 곳 — CHANGELOG 의 "단위 테스트 15개"(실제 판별
대상은 8개)와 plan §D M5 행의 "단위 5 RED"(실제 7 RED) — 가 실측과 어긋나, 이 PR 이 스스로 강조한
"실측으로 검증했다" 는 근거의 신뢰도를 부분적으로 깎는다. 코드/테스트 자체의 결함은 아니며 머지를
막을 사안은 없다.

## 위험도
NONE
