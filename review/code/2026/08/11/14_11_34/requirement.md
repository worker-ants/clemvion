# 요구사항(Requirement) Review — 후속 확인 라운드

대상: `claude/docs-guard-walker` (커밋 `5c5bd8c40` 까지, `13_51_44` 라운드 처분 `bafa7c007` 포함).
`review/code/2026/08/11/13_51_44/{requirement.md,RESOLUTION.md}` 를 선독하고, orchestrator 가 지정한
4가지 확인 항목을 코드/문서 직접 대조로 재검증했다.

## 검증 방법

- `spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`,
  `plan/complete/docs-guard-walker-dedup.md` 를 `Read`/`grep` 으로 직접 열람.
- `git diff origin/main..HEAD -- spec/ .claude/docs/plan-lifecycle.md` 로 spec 영향 범위 실측.
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__` (2892 passed) ·
  `npx vitest run src/lib/docs/__tests__/spec-plan-completion.test.ts` (818 passed) ·
  `npx tsc --noEmit -p .` (오류 0) 직접 재현.
- `grep -rn "SpecMdFile" codebase/`, `grep -n isAbsolute tree-walk.ts` 등으로 `13_51_44` RESOLUTION 의
  개별 처분(W1·W2·W6)이 실제 코드에 반영됐는지 대조.
- plan 13개 체크박스를 diff 및 `grep -c '\[x\]'`/`'\[ \]'` 로 전수 대조.

## 확인 결과 (orchestrator 지정 4항목)

### 1. plan 문구 정정("원리상 불가능")이 정직한가

**대체로 정직하지만 표현이 과장됐다.** "옛 구현이 지워지면 비교 대상이 사라진다" 는 사실관계는 맞고,
실제로 landed 된 것(일회성 dump 대조 + 새 구현의 합성 fixture forward 고정)을 숨기지 않고 그대로
적었다는 점에서 회피는 아니다. 다만 "원리상 불가능"은 과장이다 — **대안이 실재한다**: 옛 구현을
삭제 직전에 테스트 전용 fixture 로 박제해두고(예: 함수 바디를 복사해 `*.legacy-fixture.ts` 로 남기거나,
`git show <pre-commit>:<path>` 로 옛 구현을 추출해 CI 에서 새 구현과 diff), 영구 회귀 테스트로 삼는
방법은 기술적으로 가능하다. 이건 추측이 아니라 **이 PR의 리뷰어 자신이 `13_51_44` 라운드에서 정확히
이 방법(`git show <pre>:...` 로 옛 구현 5개를 나란히 실행)을 써서 7/7 byte-identical 을 증명**했다 —
즉 "불가능"이 아니라 "리뷰 시점에 1회 했고, CI 에 영구히 박아두지는 않았다"가 정확한 서술이다.
다만 그 대안을 실제로 채택하지 않은 것 자체는 합리적이다 — 이 PR 의 목적이 "손수 짠 DFS 6벌 제거"인데
옛 구현을 테스트 전용으로 영구 보존하면 그 자체가 7번째 중복이 되고, `git show` 기반 추출은 향후 이력
재작성(rebase/squash)에 취약해 fragile SoT 가 된다. 즉 **결론(하지 않기로 한 선택)은 옳지만, 정정된
plan 문구가 그 트레이드오프("가능하지만 이 PR 의 목적과 상충")를 감추고 "원리상 불가능"이라는 더 강한
주장으로 단순화**했다.

- **[WARNING]** plan 문구 "전후 동일은 원리상 테스트로 고정할 수 없다"가 과장이다 — 가능한 대안(레거시
  구현 fixture 박제 또는 git-show 추출 후 CI 고정)이 있고 이 PR의 리뷰 라운드가 그 방법을 직접
  써서 증명까지 했다. 실제로 안 한 이유(중복 재도입·git 이력 결합의 fragility)는 합리적이지만 그
  근거가 plan 문구에 없다.
  - 위치: `plan/complete/docs-guard-walker-dedup.md:58-62`
    (`> **표현 정정 (ai-review requirement WARNING)**: "전후 동일" 은 원리상 테스트로 고정할 수 없다 ...`)
  - 상세: 위 서술.
  - 제안: "원리상 불가능" → "가능하지만(예: 옛 구현을 fixture 로 박제하거나 git 이력에서 추출) 그러면
    이 PR 이 없애려는 중복을 되살리거나 git 이력에 fragile 하게 결합되므로 하지 않았다"로 정정. 코드
    변경은 불필요 — plan 문서 문구만의 문제이며 지금 상태로도 실질적 위험(회귀 미탐지)은 없다(mutation
    8건 RED + 합성 fixture + 독립 byte-diff 재현으로 이미 충분히 방어됨). CRITICAL 로 올릴 사안 아님.

### 2. `code:` 등재가 정확한가 — 자매 항목과 같은 축인가

`tree-walk.ts` 자체는 정확하다 — `plan-scan.ts`/`spec-links.ts` 와 같은 "여러 가드가 공유하는 구현
모듈" 축이다. 다만 `tree-walk.test.ts` 를 함께 등재한 것은 **기존에 확립된 다수 패턴과 어긋난다**:
같은 `code:` 목록에서 `plan-scan.ts`/`spec-links.ts`(공유 구현 모듈, 각각 `plan-scan.test.ts`/
`spec-links.test.ts` 라는 자기 unit test 를 갖고 있음)는 그 자기 test 파일이 목록에 없는 반면,
`spec-frontmatter-parse.ts`+`spec-frontmatter-parse.test.ts` 쌍만 예외적으로 둘 다 있다. 이번 PR 은
소수 패턴(파일+자기 test 쌍)을 따랐지만 다수 패턴(공유 구현 모듈만 등재, 자기 test 는 미등재)을
따르지 않았다. spec 본문(`spec-impl-evidence.md §4.2`)은 "4개 build 가드 구현 파일은 code: 에 등재"
라고만 말하고 이 axis(구현 모듈의 자기 단위 테스트도 등재하는지)를 명시하지 않아 **회색지대**다 —
`spec-code-paths.test.ts` 는 목록 완전성을 강제하지 않으므로 build 는 깨지지 않는다.

- **[INFO]** `tree-walk.test.ts` 등재가 `code:` 목록 내부의 기존 다수 패턴(`plan-scan.ts`/
  `spec-links.ts` 는 자기 `.test.ts` 미등재)과 다르고 소수 패턴(`spec-frontmatter-parse.ts` 쌍)만
  따랐다 — spec 본문이 이 axis 를 명문화하지 않은 회색지대라 CRITICAL/WARNING 은 아니다.
  - 위치: `spec/conventions/spec-impl-evidence.md:5-6`(다수 패턴 예외인 `spec-frontmatter-parse.*`
    쌍) vs `:15-16`(`plan-scan.ts`/`spec-links.ts`, 자기 test 미등재) vs `:17-18`(신규
    `tree-walk.ts`+`tree-walk.test.ts`).
  - 상세: `13_51_44` 라운드 requirement reviewer 의 INFO("`tree-walk.ts` 가 `code:` 에 없다")가
    요구한 "등재" 자체는 이행됐다. 다만 그 INFO 는 `tree-walk.test.ts` 까지 등재하라고 명시하지
    않았는데(`code:` 에 tree-walk.ts + tree-walk.test.ts 추가"라는 처분 자체가 그렇게 확장 해석한
    것) 이는 리뷰어 재량 판단으로, 틀렸다고 할 근거는 없으나 목록 내부 일관성 관점에서 완전히
    깔끔하지는 않다.
  - 제안: 조치 불필요(회색지대). 다음에 이 문서를 손댈 때 §4.2 에 "공유 구현 모듈의 자기 unit test
    는 등재 대상인가"를 한 줄 명문화하면 이런 판단 분기가 사라진다.

### 3. `spec_impact: none` → `[spec/conventions/spec-impl-evidence.md]` 가 Gate C 계약에 맞는가

**맞다.** 직접 확인:
- `git diff origin/main..HEAD -- spec/` 결과 이 PR 이 건드린 `spec/` 하위 파일은
  `spec/conventions/spec-impl-evidence.md` **단 1개**뿐이다(`.claude/docs/plan-lifecycle.md` 는
  `spec/` 밖이라 Gate C 대상이 아님 — `hasValidSpecImpact`/`makeSpecExists` 는 `spec/` 하위만 인정).
  목록이 실제로 건드린 spec 파일과 정확히 일치한다(과다·과소 없음).
  - 위치: `plan/complete/docs-guard-walker-dedup.md:8-9` (`spec_impact:\n  - spec/conventions/spec-impl-evidence.md`).
- 리스트 포맷 준수: `.claude/docs/plan-lifecycle.md:134`("단일 경로라도 반드시 리스트로 쓴다")대로
  bare string 이 아니라 `- path` 리스트로 선언됐다.
- `makeSpecExists`(`plan-scan.ts:430-451`) 기준 `spec/conventions/spec-impl-evidence.md` 는
  `spec/` 하위 실존 `.md` 파일이라 `isFile()` 을 통과한다 — 직접 `Read` 로 실존 확인.
- Gate C 강제 여부: `started: 2026-08-10` ≥ `GATE_C_CUTOFF`(2026-06-04) 이므로 강제 대상이고,
  `spec_impact: none` 이 남아 있었다면 이 PR 자체가 `spec/` 을 건드리면서 `none` 선언과 모순돼
  거짓이 됐을 것 — 정정이 필요했다는 RESOLUTION.md 의 판단(W6 부수)도 맞다.
- Gate C 스위트 재실행 결과 **818 passed**(RESOLUTION.md 주장과 정확히 일치, 직접 재현).

### 4. plan 13개 항목이 빠짐없이 이행됐는가 (전수 점검)

`plan/complete/docs-guard-walker-dedup.md` 체크박스 `grep -c '\[x\]'` = **13**, `'\[ \]'` = **0**.
각 항목을 코드 상태와 대조:

| # | 항목 | 확인 |
|---|---|---|
| 1 | 3(→6)벌 필터 차이 표로 실측 | `tree-walk.ts` 헤더 + plan "대상" 표에 반영 확인 |
| 2 | 의도/사고 판정 | "결정 — 통합했다" 절, 전부 의도로 판정 |
| 3 | 통합 구현 + 집합 고정 | `walkTree` 구현 확인, 문구는 위 §1 WARNING 대상이나 기능은 이행 |
| 4 | `collectCompletePlanMarkdown` 재사용 판정 | `spec-plan-completion.test.ts:38-40` 이 3줄 위임으로 실제 확인(선행 PR #1123 이 이미 이행, 이 PR 은 재확인만) |
| 5 | `spec-frontmatter-parse.ts` 캐시 우회 | `matterNoCache` 사용 확인(`spec-frontmatter-parse.ts` diff) |
| 6 | `extractLinks` 사전 필터 | `cannotContainLink` 구현 확인, mutation 1건 RED 재현 근거 있음 |
| 7 | `collectCompletePlans` negative fixture | "이미 닫혀 있던 항목" 으로 문서화 — 위임 3줄이라 fixture 불필요, 타당 |
| 8 | `NONE_VALUES` 정규화 fixture | `spec-plan-completion.test.ts:193-207` 신규 `it` 확인 |
| 9 | `danglingSpecImpact`→`findDanglingSpecImpact` 개명 | 코드 전수 grep 결과 구 이름 잔존 0건 |
| 10 | `fm`/`frontmatter` fixture 통합 | `plan-scan.test.ts` diff 확인, 단일 빌더로 축소 |
| 11 | `spec-links.ts` DFS 중복 통합 | `collectSpecMarkdown`/`collectCodebaseSources` 가 `walkTree` 위임으로 전환 확인 |
| 12 | Gate C 판정 함수 `plan-scan.ts` 이동 | `spec-plan-completion.test.ts` import 문 확인, 8개 함수 전부 이동 |
| 13 | `SpecMdFile` 타입명 정리 | `grep -rn SpecMdFile codebase/` 결과 **주석 3곳만 남고 타입 자체는 삭제** — 판정에 그치지 않고 실제 제거까지 완료(`13_51_44` W2 처분과 일치) |

추가로 `13_51_44` RESOLUTION.md 의 W1(`walkTree` 죽은 `isAbsolute` 분기 제거)·W6(plan 이동)도
코드/파일시스템에서 직접 재확인 — `tree-walk.ts:82` 에 무조건 `path.join(root, base)` 만 남아 있고,
`plan/in-progress/docs-guard-walker-dedup.md` 는 존재하지 않으며 `plan/complete/docs-guard-walker-dedup.md`
로 정확히 이동했다. `plan/in-progress/harness-env-value-subpattern-dedup.md:113` 의 상대링크도
`../complete/docs-guard-walker-dedup.md` 로 갱신돼 dangling 없음.

전체 재현: `vitest run src/lib/docs/__tests__` **2892 passed**, `spec-plan-completion.test.ts`
**818 passed**, `tsc --noEmit` **오류 0** — 전부 문서 주장과 정확히 일치.

**13개 항목 전부 이행 확인. 누락 없음.**

## 새 CRITICAL

없음.

## 요약

4가지 확인 항목 중 3개(§2 code: 등재, §3 Gate C 계약, §4 13개 항목 전수)는 코드/문서 직접 대조로
**정확함**을 확인했다(§2 는 사소한 목록-내부 비일관성이 있으나 spec 이 침묵하는 회색지대라 INFO).
§1(plan 문구 정정의 정직성)만 새로운 WARNING 이다 — "원리상 불가능"이라는 표현이 실제보다 강한 주장이고,
대안(레거시 구현을 fixture 로 박제하거나 git 이력에서 추출해 영구 CI 회귀 테스트로 삼는 것)이 기술적으로
존재하며 이 PR의 리뷰 라운드 자신이 그 방법으로 이미 동등성을 증명했다. 다만 그 대안을 채택하지 않은
실질 판단(중복 재도입·git 이력 결합의 fragility 회피)은 타당해서, 이는 코드 수정이 아니라 plan 문구를
한 문장 더 정밀하게 다듬으면 해소되는 사안이다. 기능적 위험은 없다 — 이 gap 은 mutation 8건 RED,
합성 fixture 회귀, 독립 byte-diff 재현으로 이미 충분히 상쇄돼 있다. 새 CRITICAL 은 없다.

## 위험도

LOW

STATUS: OK
