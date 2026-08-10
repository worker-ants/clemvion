# 정식 규약 준수 검토 — convention_compliance

> 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
> **알려진 프롬프트 결함**: 번들에 `## 구현 변경 사항` diff 섹션이 없어 워킹트리에서 직접
> `git diff origin/main...HEAD` (+ 개별 커밋 `git show`) 를 실행해 실 코드·커밋을 대조했다.
> 마지막 정합 라운드 — 직전(`02_47_31`) 이후 델타(`5311d6b01` · `be9a8fdb2` · `748f6646e`)에
> 집중.

## 발견사항

### [INFO] `spec-impl-evidence.md` 의 `code:` 목록에 fixture 증거 파일 2건 미등재

- target 위치: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (line 46-61) +
  §4.2 표의 `plan-frontmatter.test.ts` 행 (§4.2, `5311d6b01` 이 수정)
- 위반 규약: 같은 문서 §2.1 필드 정의 — `code:` = "본 spec 이 약속한 surface 의 구현 경로"
- 상세: `5311d6b01` 이 §4.2 표 셀에 "셋 다 `plan-scan.test.ts`/`spec-links.test.ts` 의 합성
  fixture 가 negative-path 를 증명한다" 는 문장을 **본문에 새로 추가**했다 — 즉 이 두
  테스트 파일이 §4.2 가드 family 의 부정경로 증거로 명시 지목됐다. 그런데 frontmatter
  `code:` 리스트는 여전히 `plan-scan.ts`(구현) 와 `spec-links.ts`(구현) 만 등재하고
  `plan-scan.test.ts`/`spec-links.test.ts` (그 증거 fixture 파일 자신)는 빠져 있다.
  같은 목록의 `spec-frontmatter-parse.ts`는 자신의 `.test.ts` 짝(`spec-frontmatter-parse.test.ts`)
  까지 등재돼 있어 패턴이 문서 안에서 갈린다.
  - 단, `spec-links.ts` 는 이 PR 이전부터 이미 `spec-links.test.ts` 없이 등재돼 있던 기존
    패턴이라(`git log -p` 확인), 이번 델타(`plan-scan.ts` 추가)는 새 불일치를 만든 게 아니라
    **기존 불일치 패턴을 답습**한 것이다. 빌드 가드는 "glob ≥1 매치" 만 요구해 이 누락으로
    깨지지 않는다(`spec-code-paths.test.ts`).
  - 직전 라운드(`02_47_31`)의 convention_compliance 도 동일 지점을 이미 관찰하고 "문언상
    요구도 저장소 관행도 위반하지 않아 조치 불요" 로 판단한 바 있다 — 그 판단에 동의하며,
    본 라운드에서도 등급을 INFO 로 유지한다(재조치 요구 아님, 참고용 기록).
- 제안: 조치 불요. 원한다면 후속 정리 시 `plan-scan.test.ts`/`spec-links.test.ts` 를
  `code:` 에 추가해 §4.2 본문 서술과 frontmatter 완전 대칭을 맞출 수 있다 — 이 라운드의
  차단 사유는 아니다.

### [WARNING] `docs-guard-legacy-fixture-coverage.md` 삭제 — plan-lifecycle 규약에 "in-progress 삭제" 경로가 성문화돼 있지 않다

- target 위치: `.claude/docs/plan-lifecycle.md` §1/§2.1/§3 (plan-scan.ts/`plan-frontmatter.test.ts`
  가 강제하는 스키마의 규약 SoT로 `spec/conventions/spec-impl-evidence.md §4.2` 가 명시
  인용). 실제 변경: 커밋 `f09b21893`(생성) → `bc10e215e`(삭제), 두 커밋 모두
  `plan/in-progress/docs-guard-legacy-fixture-coverage.md`
- 위반 규약: `plan-lifecycle.md §1` — "`plan/in-progress/`"↔"`plan/complete/`" 두 폴더만
  work-plan 의 종착점으로 규정. §2.1 은 "`research/` → `complete/` 이동은 하지 않는다.
  … 완전히 무효가 되면 삭제한다" 로 **삭제 허용을 `research/` 문서에만 명시적으로 한정**한다.
  일반 작업 plan(`in-progress/`)에 대한 삭제 경로는 §1-§5 어디에도 성문화돼 있지 않다.
- 상세: 실측 결과 이 삭제 자체는 **실질적으로 정당**하다 — 근거를 모두 코드로 확인했다:
  - `f09b21893` 가 등재한 할 일 3개(순수 함수 추출 · placeholder/ISO 부정경로 fixture ·
    뮤테이션 확인)는 `bc10e215e`(+후속 `plan-scan.ts`/`plan-scan.test.ts`)에서 실제로
    구현됐다 — `checkPlanFrontmatter()`, `WORKTREE_PLACEHOLDER` 정규식(`TBD`/`assigned at
    impl`/`미정`/`착수 시`/`pending` 매칭), `isIsoDate()` 라운드트립 비교,
    `plan-scan.test.ts` 의 negative-path fixture(`for (const bad of ["TBD", "미정",
    "pending", "assigned at impl-start", "착수 시 지정"])` 등)로 1:1 대응 확인.
  - 삭제된 plan 은 체크박스가 하나도 `[x]` 로 거짓 완료 처리되지 않았다(그냥 파일째
    사라졌다) — "체크박스 = 실제 상태" 원칙을 어기지 않는다.
  - 살아있는 문서(`spec/**`, `plan/in-progress/**`, `.claude/docs/**`) 어디에도 이 경로를
    가리키는 dangling 참조가 없다(`grep -rl` 로 전수 확인, 0건).
  - 유사 선례가 이미 이 저장소에 있다 — `1493b5ae9`(`docs(plan): #1024 머지 후 후속 위생
    정리`)가 "`harness-consistency-impl-done-bundle-sort.md` 가 …와 같은 결함이었다 … 새
    진단만 흡수하고 폐기" 라며 in-progress plan 을 `complete/` 로 옮기지 않고 그대로
    삭제한 전례(중복 흡수 케이스)가 있다.
  - `docs-guard-legacy-fixture-coverage.md` 의 삭제 커밋(`bc10e215e`) 본문도 "등재는
    조치가 아니다" 라는 `developer/SKILL.md §ISSUE FIX 정책`(실제 원문: "TEST·REVIEW
    WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도 조치") 인용을 근거로 들었는데,
    해당 인용문은 실제로 그 문서에 그대로 존재해(§ISSUE FIX 정책, line 133) 날조가 아니다.
  - 다만 이 판단 전체가 **커밋 메시지 산문에만** 남아 있다 — `plan-lifecycle.md` 자체는
    "완료 전 superseded 판단이 나면 in-progress plan 을 어떻게 종결하는가" 를 규정하지
    않는다. 문면만 보면 §3 "이동 규칙" 은 in-progress→complete 이동만 말하고, work-plan
    삭제 자체를 침묵으로 남긴다 — 다음 두 사례가 뒤섞일 여지가 생긴다: (a) 실제로 항목이
    다른 곳(코드 또는 다른 plan)에 흡수돼 문서가 무의미해진 경우(정당한 삭제, 이번 케이스)
    vs (b) 단순히 완료 이동 의식(`spec_impact` 선언·`chore(plan): mark … complete` 커밋 ·
    Gate C 강제)을 건너뛰기 위한 삭제(회피). 규약이 (a)를 명시하지 않으면 향후 (b) 사례가
    같은 논리로 정당화되기 쉽다.
- 제안: 이번 PR 을 이 사유로 차단할 근거는 없다(실질 피해 0, 기존 관행과 정합). 다만
  `plan-lifecycle.md §2` 또는 §3 에 "아직 착수되지 않은(worktree: (unstarted)) in-progress
  plan 이 다른 plan/커밋에 완전 흡수되거나 그 PR 안에서 직접 해소돼 항목이 전부 소멸하면,
  `complete/` 이동(Gate C 포함) 대신 삭제할 수 있다 — 단 삭제 사유를 삭제 커밋 메시지에
  남긴다" 류의 문장을 추가해 이미 두 차례(`1493b5ae9`, `bc10e215e`) 반복된 이 관행을
  성문화하는 편을 후속 정리로 권장한다.

## 점검 항목별 확인 결과 (지시 3건)

1. **세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`)와
   현재 코드 정합** — **정합 확인**. `5311d6b01` 이 PROJECT.md/`spec-impl-evidence.md` 를
   "plan-scan.ts(수집·status)" → "plan-scan.ts(수집·frontmatter·status)" 로 함께 정정했고,
   `plan-lifecycle.md` 에도 §4(테스트 이관 서술)·§5(체크리스트 두 항목 추가) 반영이
   모두 있었다(이전 커밋 `bc10e215e`/`9e880e908` 가 이미 §4/§5 본문을 신설). 실제
   `plan-frontmatter.test.ts` 를 읽어 (1) `checkPlanFrontmatter`/`collectLivePlanMarkdown`/
   `collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans` 가 모두 `plan-scan.ts` 에서
   import (2) 링크 검사는 `spec-links.ts` 의 `findBrokenPlanLinks` 를 import 하는 것을
   직접 확인 — 세 문서가 말하는 "판정 로직 = plan-scan.ts(+frontmatter) / spec-links.ts(링크),
   이 파일은 호출부일 뿐" 서술과 정확히 일치한다. `TERMINAL_PLAN_STATUSES` 값 4개
   (`complete`/`implemented`/`applied`/`superseded`)도 코드·세 문서 모두 동일.
2. **`docs-guard-walker-dedup.md` 의 plan 문서 규약 준수 (2026-08-10 절 포함)** —
   **정합**. frontmatter 스키마(`title`/`worktree: (unstarted)`/`started: 2026-08-10`(ISO)/
   `owner: developer`/`status`/`priority`/`spec_impact: none`)가 §4 요구 3필드(worktree·
   started·owner) + 허용 부가 필드 규칙을 만족한다. `spec_impact: none` 은 Gate C 가
   요구하는 no-op sentinel 리터럴 형태(bare string 이되 실제 경로가 아닌 `none`)로 올바르다
   (Gate C 자체는 아직 `complete/` 가 아니므로 강제 대상은 아니다). 신설 "2026-08-10 추가"
   절은 기존 절 구조(Overview → 대상 표 → 착수 전 필수 → 함께 볼 것 → Rationale)를 깨지
   않고 dated addendum 관용구로 삽입됐고, 상호 참조하는
   `harness-env-value-subpattern-dedup.md` 링크도 실존(양방향 상호링크 확인) — dangling
   없음.
3. **`docs-guard-legacy-fixture-coverage.md` 삭제의 lifecycle 규약 정합** — 위 WARNING
   항목 참조. 실질적으로는 정당하나 규약 문서가 이 케이스를 명시하지 않는 문서 공백.

## 요약

이번 라운드의 델타(`5311d6b01`/`be9a8fdb2`/`748f6646e`)는 `spec/conventions/spec-impl-evidence.md`
와 그 미러(`PROJECT.md`·`plan-lifecycle.md`) 사이의 서술을 실제 코드(`plan-scan.ts`/
`spec-links.ts` 로의 판정 로직 이관)와 정확히 재동기화했고, 직접 코드를 읽어 세 문서의
모든 구체적 주장(함수 소재·상수 값·스코프 제외 규칙)이 사실임을 확인했다 — CRITICAL
없음. `docs-guard-walker-dedup.md` 는 plan frontmatter·구조 규약을 그대로 지킨다. 유일한
남는 지점은 (a) `code:` 목록의 fixture 파일 미등재(INFO, 기존 패턴 답습·조치 불요)와
(b) 항목이 PR 내에서 전부 해소된 in-progress plan 을 `complete/` 이동 없이 삭제하는
관행이 실질적으로는 정당하지만 `plan-lifecycle.md` 에 아직 성문화돼 있지 않다는
문서화 공백(WARNING, 차단 사유 아님) 뿐이다.

## 위험도

LOW

STATUS=success ISSUES=2 PATH=/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates/review/consistency/2026/08/10/04_07_54/convention_compliance.md RESET_HINT=
