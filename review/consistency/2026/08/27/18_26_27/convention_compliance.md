# 정식 규약 준수 검토 — spec/conventions/ (impl-done, diff-base=origin/main)

## 검토 범위 요약

이 PR 이 `spec/conventions/**` 안에서 실제로 건드린 파일은 `spec-impl-evidence.md` 단 1개(§4.2
`spec-link-integrity.test.ts` 행, `scope 3` 거버넌스 문서 추가 서술)뿐이다. 나머지 diff(코드·CI·
`PROJECT.md`)는 이 convention 문서가 SoT 로 지목한 가드의 구현/전파 결과이므로, target 문서가
실제로 무엇을 "약속"했고 그 약속이 하위 문서(`PROJECT.md`)·코드(`spec-links.ts`,
`spec-link-integrity.test.ts`)에 정확히 반영됐는지를 대조했다.

- `spec/conventions/spec-impl-evidence.md` diff (`git diff origin/main...HEAD -- spec/conventions/spec-impl-evidence.md`)
- `PROJECT.md` §자동 가드 / §문서 링크 검증
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`, `spec-link-integrity.test.ts`
- `scripts/check-doc-links.py` 삭제, `.github/workflows/spec-link-checks.yml`

## 발견사항

- **[WARNING] `PROJECT.md` §자동 가드 표의 `spec-link-integrity.test.ts` 행이 target 문서(§4.2)가 이번에 확장한 scope 3 를 반영하지 않았다**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 표, `spec-link-integrity.test.ts` 행 (`code:` 로 등재된 구현 파일 자체는 정확)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 자체 서술(이번 diff 로 "**(1)** spec/**.md 본문, **(2)** codebase 소스 JSDoc, **및 (3) 거버넌스 문서**"로 3-scope 를 명시) 및 `PROJECT.md` §자동 가드 표의 기존 관행(같은 표의 `plan-frontmatter.test.ts` 행은 멀티스코프 가드를 "(1)...(2)...(3)..." 형태로 전부 나열하는 선례를 이미 세워 두었다)
  - 상세: `PROJECT.md:275` 는 여전히 `spec-link-integrity.test.ts` 를 `"spec/**.md` 본문 in-repo 링크/heading 앵커 실존 검증"으로만 서술한다. 이번 PR 이 target 문서(§4.2)에서 scope 3(루트 `*.md` + `.claude/**.md` 거버넌스 문서)을 명시적으로 추가하고, 같은 `PROJECT.md` 안의 "§문서 링크 검증" 절(`PROJECT.md:344-351`)은 3-scope 를 정확히 갱신했음에도, "§자동 가드" 표의 요약 행(`:275`)은 갱신 대상에서 빠졌다. 결과적으로 같은 파일 안에 같은 가드에 대한 **서로 다른 스코프 서술**이 공존한다 — 한쪽은 최신(3-scope), 한쪽은 구식(1-scope, scope 2 도 이미 누락돼 있던 상태). 이 표는 `.claude/tests/test_doc_sync_matrix.py` 가 "이름 dangling" 만 검증하고 "서술 정확성"은 검증하지 않아 build 가드로는 걸리지 않는다.
  - 제안: `PROJECT.md:275` 행을 `plan-frontmatter.test.ts` 행과 같은 패턴으로 "(1) spec 본문 (2) codebase JSDoc (3) 거버넌스 문서(루트 `*.md`+`.claude/**.md`)" 3-scope 요약으로 갱신. 이미 이번 PR 의 code-review 라운드(`review/code/2026/08/27/18_16_05/SUMMARY.md` INFO#3)가 `PROJECT.md:350-351` 문단의 `node_modules` 누락은 잡아 고쳤으나, 표 쪽(`:275`) 행 자체의 scope-drift 는 그 라운드의 지적 대상이 아니었다 — 즉 이번 검토에서 새로 드러난 잔여 갭이다.

## 준수가 확인된 항목 (참고)

- **문서 3섹션 구조**: `spec-impl-evidence.md` 는 `## Overview (제품 정의)` → 본문(§1~6) → `## Rationale`(R-1~R-10) 구조를 그대로 유지, 이번 body-only 편집이 구조를 깨지 않음.
- **frontmatter `code:` 정합**: 이번 PR 이 실제로 편집한 `spec-links.ts`·`spec-link-integrity.test.ts` 두 파일 모두 이미 `spec-impl-evidence.md` frontmatter `code:` 리스트에 등재돼 있어 별도 갱신 불요 (§4.2 "4개 build 가드 구현 파일" 요건 충족).
- **내용 정확성(실측 대조)**: §4.2 새 서술의 구체 주장들을 코드/실측과 대조 — `.claude/worktrees/`·`node_modules` 제외가 `GOVERNANCE_SKIP_DIRS = new Set(["worktrees", "node_modules"])` 와 일치, "루트 비재귀" 서술이 `collectGovernanceMarkdown` 의 `recurse: false` 와 일치, `.claude/**.md` 파일 수(주석 "실측 52개") 를 `find .claude -name "*.md" -not -path "*/worktrees/*"` 로 재현해 52 로 확인, `scripts/check-doc-links.py` 삭제 후 활성 참조(Makefile/hook/워크플로) 부재 확인. 모두 target 문서의 진술과 어긋나지 않음.
- **명명 규약**: 신규 함수/상수(`collectGovernanceMarkdown`, `findBrokenGovernanceLinks`, `GOVERNANCE_SKIP_DIRS`, `MIN_CLAUDE_DOCS`)가 기존 자매 식별자(`collectSpecMarkdown`, `collectCodebaseSources`, `findBrokenLinks`, `findBrokenSpecLinksInSources`)의 명명 패턴과 대칭적 — 이번 코드 리뷰 라운드(`maintainability=NONE`)도 동일하게 확인.
- **금지 항목 재현 없음**: 인라인 문자열 action 추가·prefix 미준수 등 conventions 가 명시적으로 금지한 패턴을 이번 diff 가 다시 만들지 않음 (audit-actions.md·swagger.md 등 무관 영역은 변경 없음, `chat-channel-adapter.md`·`spec-impl-evidence.md` 외 conventions 파일은 diff 대상 아님).

## 요약

`spec/conventions/` 자체에 대한 이번 PR 의 유일한 편집(`spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` 행)은 문서 구조·frontmatter·명명 규약을 모두 준수하고, 서술 내용도 실제 구현(코드·CI)과 정확히 일치한다. 다만 그 확장된 서술이 `PROJECT.md` §자동 가드 표라는 하위 요약 문서로 완전히 전파되지 않아, 같은 파일 안에서 같은 가드에 대한 스코프 서술이 최신/구식으로 나뉘는 국소적 문서 drift 가 하나 남았다 — 빌드를 막는 invariant 위반은 아니며 이미 별도 code-review 라운드가 인접 문단의 유사 누락(`node_modules`)은 고친 상태라, 남은 갭은 사소하지만 실재한다.

## 위험도
LOW
