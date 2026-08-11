# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** 신규 build 가드(`plan-link-integrity.test.ts`) + `spec-plan-completion.test.ts` 확장(2번째 invariant)이 이 가드 패밀리의 명시 SoT 문서 3곳을 하나도 갱신하지 않았다
  - 위치:
    - 신규/변경 코드: `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts` (파일 전체, 신규) · `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 184번째 줄부근의 `describe("완료 plan 은 미완을 주장하지 않는다", ...)` 블록(신규 invariant)
    - 갱신 누락 문서 1: `spec/conventions/spec-impl-evidence.md` 4~15번째 줄(frontmatter `code:` 목록) — `plan-link-integrity.test.ts` 가 빠져 있다
    - 갱신 누락 문서 2: `spec/conventions/spec-impl-evidence.md` §4.2 표(116번째 줄 "build 차단 4건 + advisory 1건" 서술, 131번째 줄 `spec-plan-completion.test.ts` 행) — 신규 가드 행이 없고, 기존 행 설명은 Gate C(`spec_impact`)만 언급할 뿐 같은 파일에 추가된 "완료 plan 은 미완 status 를 주장할 수 없다" invariant 는 전혀 언급이 없다. §6 rollout 3번째 줄도 "build 4건"으로 여전히 옛 개수를 적고 있다
    - 갱신 누락 문서 3: `PROJECT.md` 264~278번째 줄의 build-guard 카탈로그 — `spec-link-integrity.test.ts`(275번째 줄)·`plan-frontmatter.test.ts`(277번째 줄)·`spec-plan-completion.test.ts`(278번째 줄)는 한 줄 설명 + SoT 링크로 등재돼 있는데 그 형제인 `plan-link-integrity.test.ts` 는 통째로 빠져 있고, 278번째 줄의 `spec-plan-completion.test.ts` 설명도 Gate C만 적혀 있어 신규 invariant 를 반영하지 않는다
    - 갱신 누락 문서 4: `.claude/docs/plan-lifecycle.md` §5(84~92번째 줄, "이동 commit 자가 점검" 체크리스트) — 바로 옆 91번째 줄에 "Gate C" 체크 항목은 있는데, 같은 파일(`spec-plan-completion.test.ts`)에 새로 추가된 "완료 plan 은 미완 status 를 주장하면 안 된다" 체크 항목이 빠져 있다
  - 상세: 커밋 `62084e807` 는 `plan-link-integrity.test.ts` 를 신설(150줄)하고 `spec-plan-completion.test.ts` 에 두 번째 게이트(96줄)를 추가했지만, `PROJECT.md`/`spec/conventions/spec-impl-evidence.md`/`.claude/docs/plan-lifecycle.md` 셋 다 diff 에 없다(`git show --stat 62084e807` 로 확인). 그런데 `spec-impl-evidence.md` §6 자신이 "3. frontmatter-evidence 가드(§4) + §4.2 ... 동반 작성 ... 4. PROJECT.md §자동 가드 표에 해당 row 추가" 를 명시적 rollout 절차로 못박고 있고, §4.2 는 "본 절이 규약 SoT" 라고 스스로 선언한다. 즉 이 changeset 은 자신이 새로 만든 규약(`spec_impact`/frontmatter `code:` evidence)이 요구하는 절차를 자신에게는 적용하지 않은 셈이다 — `code:` 필드가 정확히 검증하려는 대상("이 spec 문서가 약속한 구현이 실재하는가")을 이 문서 자신이 위반한다.
  - 제안: 다음 4곳을 한 커밋에 반영. (1) `spec-impl-evidence.md` frontmatter `code:` 에 `plan-link-integrity.test.ts` 추가. (2) §4.2 표에 `plan-link-integrity.test.ts` 행 추가 + "build 4건" → "5건" + `spec-plan-completion.test.ts` 행 설명에 두 번째 invariant 한 줄 보강. (3) `PROJECT.md` 가드 카탈로그에 `plan-link-integrity.test.ts` 행 추가 + `spec-plan-completion.test.ts` 행 설명 보강. (4) `plan-lifecycle.md` §5 체크리스트에 "완료 plan 의 `status:` 가 미완 어휘(`in-progress`/`backlog`)를 주장하지 않는가" 항목 추가.

- **[INFO]** 신규 두 번째 invariant("완료 plan 은 미완을 주장하지 않는다")에는 `Gate C`/`Gate D` 와 같은 명시적 게이트 명칭이 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` — `describe("완료 plan 은 미완을 주장하지 않는다", ...)` 블록 및 `claimsUnfinished` 함수
  - 상세: 이 저장소는 `spec-impl-evidence.md`/`plan-lifecycle.md` 전반에서 가드를 "Gate A/B/C/D" 식 알파벳 명칭으로 상호 참조한다(예: `plan-lifecycle.md` 33번째 줄 "Gate C(`spec_impact`)", `spec-impl-evidence.md` 192번째 줄 "advisory Gate D"). 같은 파일에 추가된 이 두 번째 게이트만 이름이 없어, 앞으로 문서에서 "그 규칙"을 정확히 지칭하기 어렵다(실제로 이번 리뷰에서도 이름이 없어 매번 전체 문장으로 지칭해야 했다).
  - 제안: 필수는 아니지만, 향후 SoT 문서 갱신 시(위 CRITICAL 항목) 이 invariant 에도 `Gate E` 등 명칭을 부여하면 상호참조가 쉬워진다.

- **[INFO]** 리뷰 대상 코드 자체(주석/독스트링)는 이례적으로 충실함 — 별도 지적 없음
  - 위치: `.claude/_shared/git_probe.py`, `.claude/skills/code-review-agents/lib/session.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, 6개 테스트 파일, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
  - 상세: 각 함수·모듈에 "왜 이렇게 됐는지"(근거 라운드, 실측 수치, 반례)를 담은 독스트링이 붙어 있고, 교차검증도 통과했다(예: `git_probe.py` 의 "`_origin_default_branch` 가 `_shared` 로 이동했다" 서술을 `hooks/_lib/branch_guard.py` 의 실제 import 로 확인, `consistency_orchestrator.py` 의 "`report_paths` 는 더 이상 import 되지 않는다" 서술을 grep 으로 확인, `plan-link-integrity.test.ts` 의 "76건/61쌍/45파일, 5건 즉시 수정 후 56쌍 남음" 을 `KNOWN_BROKEN` 배열 실제 원소 수(56)와 대조). 코드 변경분 자체에서는 stale 주석·누락 JSDoc 을 찾지 못했다.

## 요약

리뷰 대상 코드 파일들(하네스 스크립트·테스트) 자체의 인라인 문서화 수준은 매우 높아 문제가 없다. 그러나 이 changeset 이 신설한 build 가드(`plan-link-integrity.test.ts`)와 확장한 가드(`spec-plan-completion.test.ts` 의 두 번째 invariant)가, 바로 그 가드 패밀리를 관장하는 프로젝트 자체의 SoT 문서 3곳(`spec/conventions/spec-impl-evidence.md` §4.2 + frontmatter `code:`, `PROJECT.md` 가드 카탈로그, `.claude/docs/plan-lifecycle.md` §5 체크리스트) 중 어디에도 반영되지 않았다. 이는 이 changeset 자신이 강제하려는 규약(“구현에는 spec 문서상의 증거가 있어야 한다”)을 스스로 위반하는 자기지시적 결함이며, `spec-impl-evidence.md` §6 이 명시한 rollout 절차(“PROJECT.md 에 row 추가”)를 건너뛴 결과다. 코드 리뷰 통과 전에 문서 3곳을 갱신할 것을 권한다.

## 위험도

CRITICAL
