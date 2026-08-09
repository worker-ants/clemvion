# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 안내

prompt_file 번들에 실제 diff 섹션이 누락되어 있었다(알려진 결함 — `## 관련 spec 본문` 아래
`<git diff origin/main...HEAD -- code_areas>` 가 플레이스홀더 리터럴로 남아 있음). 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 에서
`git diff origin/main...HEAD` 및 개별 커밋 diff 를 직접 실행해 대체했다.

오케스트레이터 지시대로 **직전 정합 세션(`04_07_54`) 이후의 델타만** 스코프로 잡았다 — 4개
커밋: `538e4b92f`(파싱 실패 캐너리 + spec_impact 존재 검사 강화 + danglingSpecImpact
콜백화), `4e1995cb8`(spec/ 접두 제약 + rawScalar 최상위 키 한정), `6aacded22`(경로 정규화
재검증 + 정규식 키 이스케이프 + `plan-lifecycle.md` Gate C 판정 서술 정정), `829b46890`(문서만,
review RESOLUTION).

`git log --name-only 538e4b92f^..HEAD` 로 확인한 실제 변경 파일 집합:

- `.claude/docs/plan-lifecycle.md` (Gate C 판정 서술 정정, `6aacded22`)
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
- `plan/complete/harness-line-anchors-review-classified-commit.md`,
  `plan/complete/web-chat-quality-backlog.md` (YAML 인용 수정, 데이터 fix)
- `plan/in-progress/docs-guard-walker-dedup.md` (후속 항목 등재)
- `review/**` (산출물)

이 델타 범위에는 `spec/**` 파일이 **하나도 포함되지 않는다** — `spec/conventions/spec-impl-
evidence.md` 와 `PROJECT.md` 는 이전 라운드(`5311d6b01` 등, `04_07_54` 이전)에 이미 갱신·
검토됐고 이번 델타에서는 손대지 않았다. 따라서 순수 cross-spec 관점에서는 "새 spec 서술이
다른 spec 영역과 충돌하는가" 를 물을 대상 자체가 이번 라운드엔 거의 없다 — 변경은 (a) 공정
문서(`plan-lifecycle.md`) 1곳의 서술 정정, (b) build-time 가드 코드 경화, (c) 과거 plan
frontmatter 데이터 오류 수정이다.

## 확인 사항 1 — `plan-lifecycle.md` Gate C 판정 서술 정정이 실제 동작·타 spec 과 일치하는가

`6aacded22` 가 `.claude/docs/plan-lifecycle.md:131-132` 를 다음으로 정정했다:

> 판정은 `hasValidSpecImpact` 이다 — **문자열이면 `none`/`없음`/`n/a`/`na` 어휘만**, 배열이면
> 비어있지 않고 **모든 원소가 `spec/` 하위의 실존 파일**이어야 한다.

`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 를 직접 읽어 대조한
결과:

- `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])` (L31) — 문자열 어휘 서술과 정확히
  일치 (`.trim().toLowerCase()` 로 정규화 후 비교, L73).
- `makeSpecExists()` (L112-134) — `path.resolve(root, p)` 후 `specRoot`(`spec/`) 하위인지
  재검증 + `fs.statSync(resolved).isFile()`. "`spec/` 하위의 실존 파일" 서술과 정확히 일치.
  `spec/../CLAUDE.md` 류 이스케이프도 정규화 후 거부됨을 fixture 로 확인(L329-331).
- `hasValidSpecImpact()` (L68-82) — 배열은 `length > 0 && every(...)`. "비어있지 않고 모든
  원소가" 서술과 일치.

**`spec/conventions/spec-impl-evidence.md` 와의 충돌 여부**: 없음. §4.2 표의
`spec-plan-completion.test.ts` 행(L133)은 "spec path 목록 실존, 또는 no-op sentinel
`none`/`없음`/`n/a`/`na`" 로 이미 이 어휘 4종을 정확히 반영하고 있다 — 이 서술은 이전 라운드
(`5311d6b01`)에서 갱신됐고 이번 델타로 바뀌지 않았다. R-8(L242-246)의 grandfather cutoff
`2026-06-04` 도 `plan-lifecycle.md`·`spec-impl-evidence.md`·테스트 상수(`GATE_C_CUTOFF =
"2026-06-04T00:00:00Z"`) 3곳이 정확히 일치함을 grep 으로 확인했다.

**`PROJECT.md` 와의 충돌 여부**: 없음. PROJECT.md 의 `spec-plan-completion.test.ts` 행은
"`started ≥ 2026-06-04` 완료 plan 의 `spec_impact` 선언 강제 (Gate C, date-cutoff
grandfather). SoT: `spec/conventions/spec-impl-evidence.md §4.2`" 로, 어휘·경로 세부는
서술하지 않고 SoT 를 가리키기만 한다 — 구체 서술과 모순될 표면 자체가 없다.

이 항목은 **문제 없음**으로 판정한다.

## 확인 사항 2 — Gate C 경화가 완료 plan(약 366~375건)의 판정을 바꿔 spec 약속 범위를 벗어났는가

`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 는 `enforced`
(= `started ≥ cutoff` 인 완료 plan) 집합 전원에 대해 `describe(rel, ...)` 로 개별 검증
블록을 동적으로 생성한다(L205-245) — 즉 "375건 중 강제 대상" 각각이 실제로 개별 테스트
케이스로 실행된다.

실행 결과 확인:

```
$ npx vitest run spec-plan-completion
 Test Files  1 passed (1)
      Tests  805 passed (805)
```

전원 GREEN. 이는 이번 델타가 조인 세 방향의 경화 — (a) 존재 검사를 `isFile()` 로 좁힘,
(b) `spec/` 접두 + 경로 정규화 재검증, (c) 문자열 어휘를 `none` 류 4종으로 한정 — 가 실제
`plan/complete/` 데이터를 하나도 깨지 않았음을 실측으로 확인한 것이다. 커밋 메시지 자체도
"실데이터 실측: none류 72 · 리스트 233 라서 조여도 안전하다"(`4e1995cb8`)로 이 사실을 미리
검증했고, 이번 세션에서 최신 HEAD 기준으로 재실행해도 동일하게 전원 통과함을 확인했다.

`spec/conventions/spec-impl-evidence.md §4.2`(Gate C 행) 와 `plan-lifecycle.md §5`(Gate C
섹션)가 약속하는 범위 — "완료 plan 은 spec 경로 목록 또는 `none`류 sentinel 을 선언해야
하고, 목록 원소는 실존 spec 파일이어야 한다" — 는 코드가 그대로 구현·강제하고 있고, 실 데이터
전수가 그 범위 안에 있다. **spec 문서가 약속한 범위를 벗어나는 판정 변화는 발견되지 않았다.**

## 발견사항

- **[INFO]** `spec-impl-evidence.md` Gate C 행의 서술 정밀도가 `plan-lifecycle.md` 보다 낮다
  - target 위치: (이번 델타 target 은 `spec/conventions/` 이나, 해당 파일 자체는 이번 라운드
    미변경) `spec/conventions/spec-impl-evidence.md:133` (§4.2 표, `spec-plan-completion.test.ts` 행)
  - 충돌 대상: `.claude/docs/plan-lifecycle.md:131`(`6aacded22` 로 갱신된 서술)
  - 상세: `plan-lifecycle.md` 는 이번 델타로 "배열 원소는 **`spec/` 하위**의 실존 파일" 이라고
    경로 스코프까지 명시했다. `spec-impl-evidence.md` §4.2 표는 여전히 "spec path 목록 실존"
    으로만 적혀 있어 `spec/` 접두 제약이 문면에 드러나지 않는다. 두 서술이 모순되진 않는다 —
    `spec-impl-evidence.md` 쪽이 덜 구체적일 뿐, 코드 동작과 반대되는 주장을 하지 않는다
    (실제 `makeSpecExists` 는 `spec/` 접두를 강제하고, 이는 §1 "적용 대상"·R-7 등 문서 전반의
    "spec path" 관용과도 자연스럽게 부합한다).
  - 제안: 급하지 않음. 다음에 `spec-impl-evidence.md` 를 편집할 기회가 있으면 §4.2 표의
    해당 셀에 "(`spec/` 하위)" 를 덧붙여 두 문서 서술의 정밀도를 맞추면 향후 재-drift 를
    예방할 수 있다. Gate C 판정 자체의 SoT 는 여전히 코드(`hasValidSpecImpact`/
    `makeSpecExists`)이므로 정정 안 해도 강제력에는 영향 없음.

## 요약

이번 델타(4개 커밋)는 `spec/**` 파일을 전혀 건드리지 않았고, 변경 표면은 (1) 공정 문서
`plan-lifecycle.md` 의 Gate C 판정 서술 정정 1곳, (2) build-time 가드(`plan-scan.ts`/
`spec-plan-completion.test.ts`) 경화, (3) 과거 plan frontmatter YAML 인용 오류 데이터 수정
2건으로 한정된다. 정정된 서술(`none`/`없음`/`n/a`/`na` 어휘 + `spec/` 하위 실존 파일)을 코드와
1:1 대조한 결과 정확히 일치했고, `spec-impl-evidence.md`·`PROJECT.md` 의 기존 서술과도
모순이 없었다(둘 다 더 이전 라운드에 이미 이 어휘를 반영해 두었다). Gate C 경화가 완료 plan
판정을 실제로 바꿨는지는 실측 스위트(805 테스트, 강제 대상 전원 개별 `describe` 블록 포함)로
전수 검증했고 전원 GREEN — spec 이 약속한 범위를 벗어나는 사례는 없다. 유일한 발견은 INFO
등급의 문서 정밀도 비대칭 하나로, 강제력이나 정합성에 실질 영향이 없다. Cross-Spec 관점에서
이번 델타는 **깨끗하다**.

## 위험도

LOW
