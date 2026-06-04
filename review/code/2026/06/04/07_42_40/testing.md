# Testing Review

## 발견사항

### [INFO] 이번 PR의 테스트 변경 구조

이번 변경은 두 레이어로 구성된다:

1. **신규 gate 테스트 4종 추가** (긍정적 추가):
   - `spec-link-integrity.test.ts` — spec 내부 링크/앵커 무결성 자동 검증
   - `spec-area-index.test.ts` — 영역 index 파일 완전성 검증
   - `plan-frontmatter.test.ts` — in-progress plan frontmatter 필수 필드 검증
   - `spec-plan-completion.test.ts` — Gate C: 완료 plan의 `spec_impact` 강제화

2. **spec/*.md 앵커/링크 수정 (29개 파일)** — 기능 구현 변경 없음, `spec-link-integrity` gate가 직접 커버

이전 리뷰 세션(`review/code/2026/06/03/23_42_50/testing.md`)에서 이전 PR의 KB 파이프라인 구현 삭제 + 테스트 삭제 패턴을 CRITICAL로 분류했으나, 본 PR에는 그 패턴이 없다. 이번 PR의 codebase 변경은 신규 gate 테스트 5개 파일(`spec-links.ts` 포함)뿐이다. 따라서 본 리뷰는 신규 gate 테스트 코드 품질에 집중한다.

---

### [WARNING] `spec-plan-completion.test.ts` — `GATE_C_CUTOFF` 하드코딩으로 vacuous pass 가능성 잔존

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 24행 `const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")`
- 상세: cutoff를 2026-06-04로 설정했기 때문에 해당 날짜 이전에 `started`된 모든 기존 plan이 grandfathered 처리된다. 이 시점에서 `complete/` 디렉토리 내 cutoff 이후 `started` plan이 존재하지 않으면 `enforced` 배열이 비어 per-plan describe 블록이 하나도 생성되지 않는다. "resolves a real repo root" 테스트는 `plans.length > 10`을 체크하지만 `enforced.length`에 대한 assertion은 없으므로 실질적 gate 동작이 vacuous pass 상태일 수 있다.
- 긍정적 측면: `Gate C enforcement logic` describe 블록에 `isGateCEnforced`/`hasValidSpecImpact` 순수 함수에 대한 합성 단위 테스트 11개가 추가됐다. cutoff 전후 경계, `none`/`없음`/빈 배열/dangling path 등 핵심 경우를 모두 커버하므로 실 plan이 0건이어도 게이트 로직 자체는 검증됨.
- 제안: `enforced.length > 0` assertion을 추가하거나, 또는 cutoff 이후 시작된 픽스처 plan을 `plan/complete/` 내 테스트용으로 두어 per-plan describe가 최소 1개 이상 생성되는지 확인하는 회귀 테스트를 추가해야 한다.

### [WARNING] `spec-link-integrity.test.ts` — `findBrokenLinks` 가 내부 예외를 무시하고 0 반환 시 silent pass 가능

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 55-58행
- 상세: `findBrokenLinks(root)`는 `collectSpecMarkdown(root)` 결과로 전체 파일 목록을 얻은 후 링크를 전수 스캔한다. `collectSpecMarkdown` 내부에서 `spec/` 디렉토리가 존재하지 않으면 빈 배열을 반환(`if (!fs.existsSync(specDir)) return out`)하고 이 경우 violations도 0이 되어 "has no broken in-repo links" 테스트가 vacuous pass된다. "scans a non-trivial spec set" 테스트가 `files.length > 100`과 `spec/0-overview.md` 존재로 이 경우를 방어하는 것은 적절하다. 단, 두 테스트가 동일 `describe` 블록 내에 있어도 Vitest는 개별 `it` 블록을 독립적으로 실행 가능하므로, 실행 순서 의존성이 암묵적으로 존재한다.
- 구체적 gap: `spec-links.ts`의 `findBrokenLinks` 함수는 `collectSpecMarkdown` 결과가 0개인 경우에 대한 guard가 없다. `extractLinks` 내부의 `fs.readFileSync`가 throw해도 catch 없이 전파되어 스캔이 중단될 수 있고, 이를 탐지하는 테스트가 없다.
- 제안: `spec-links.ts`의 `findBrokenLinks` 또는 `collectSpecMarkdown`에 결과 0개 수신 시 throw하거나 명시적으로 경고하는 guard를 추가하면 silent pass를 방지할 수 있다.

### [WARNING] `spec-area-index.test.ts` — 동적 describe 블록 빈 areas로 vacuous pass 가능

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 71행 `for (const area of areas)`
- 상세: `collectAreas()`가 빈 배열을 반환하면 for 루프가 실행되지 않아 per-area describe 블록이 생성되지 않는다. 상단의 "discovers multiple spec areas" 테스트가 `areas.length > 5`와 `spec/5-system` area 존재를 guard하므로 `repoRoot()` 오해석 시 이 테스트가 실패한다. 긍정적으로 평가.
- 잔존 gap: `sys!.siblings.length > 10` assertion이 추가됐으나(`spec-area-index.test.ts` 68행), `areas.length > 5`만으로는 각 area가 의미있는 내용을 가지는지 확인이 부족하다. `spec/conventions/` 면제 로직(46행 `if (rel === "spec/conventions") continue`)이 의도적으로 동작하는지 검증하는 테스트가 없다 — 향후 `spec/conventions/_product-overview.md` 같은 index 파일이 추가되면 면제가 silently 작동하여 index-sibling 체크를 건너뛰게 된다.
- 제안: `spec/conventions` area가 `areas` 배열에 포함되지 않는다는 assertion을 추가해 면제 로직의 의도적 동작을 명시적으로 검증해야 한다.

### [WARNING] `plan-frontmatter.test.ts` — `plans.length > 20` 하한 충분하지 않음 (수정됨)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 51-55행
- 상세: 이전 리뷰(00_10_01)에서 지적한 "알려진 특정 plan 파일 존재 assertion 부재" 문제가 이번 PR에서 수정됐다 — `plans.some((p) => path.basename(p) === "knowledge-base-quality-improvements.md")` assertion이 추가됐다. 이로써 `repoRoot()` 오해석 시 탐지 가능성이 크게 향상됐다.
- 잔존 gap: `plans.length > 20`이 여전히 충분히 보수적이지 않다. 실제 plan 수가 정확히 20-21개로 줄어들면 경계 조건이 열린다. 그러나 알려진 파일 존재 assertion이 더 강한 guard이므로 위험도는 낮다.
- 평가: 대부분 수정됨. 잔존 위험도 낮음.

### [WARNING] `spec-links.ts` — catalog 면제 정규식에 대한 단위 테스트 없음 (부분 수정됨)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 125-127행 `inGeneratedCatalog` 함수
- 상세: `inGeneratedCatalog` 함수는 `relPath.includes("-api-catalog/")` 단순 문자열 포함 여부로 면제를 결정한다. `spec-link-integrity.test.ts`에 "excludes generated API catalogs from scope" 테스트가 추가되어 `cafe24-api-catalog/` 디렉토리 실재를 확인하고 `files`에 포함되지 않음을 assert한다. 이는 실 파일시스템을 통한 통합 테스트 수준의 검증이다.
- 잔존 gap: `inGeneratedCatalog` 자체의 단위 테스트가 없다. 예를 들어 `"spec/conventions/cafe24-api-catalog/products/list.md"` 같은 경로를 입력했을 때 `true`를 반환하는지, `"spec/conventions/cafe24-api-metadata.md"`(catalog가 아닌 메타데이터 파일)에 대해 `false`를 반환하는지를 검증하는 단위 케이스가 없다.
- 제안: `spec-link-integrity.test.ts`의 slugify 케이스처럼 `inGeneratedCatalog`에 대한 파라미터화된 단위 테스트 케이스를 추가하면 정규식 drift를 방지할 수 있다.

### [INFO] `spec-link-integrity.test.ts` — `slugify` pin 케이스가 이번 앵커 수정과 직접 연결, 효과적 회귀 가드

- 위치: `spec-link-integrity.test.ts` 65-85행
- 상세: `"## 1. Condition 구조" -> "1-condition-구조"` 케이스는 이번 PR에서 수정된 앵커 오류 패턴(`#1-conditiongroup-구조` → `#1-condition-구조`)과 정확히 일치한다. `"4.4 상세 (`execution.waiting_for_input`)" -> "44-상세-executionwaiting_for_input"` 케이스도 PR에서 가장 빈번하게 수정된 앵커 패턴을 커버한다. 이 pin 테스트들은 slugger 알고리즘의 향후 변경이 기존 앵커를 깨뜨리는 것을 방지하는 효과적인 회귀 가드다. 긍정적으로 평가한다.

### [INFO] `spec-links.ts` — `extractLinks` 펜스드 코드 블록 처리 엣지케이스

- 위치: `spec-links.ts` 80-104행 `extractLinks` 함수
- 상세: `extractLinks`는 `FENCE_RE` 정규식으로 펜스드 코드 블록을 skip하고 인라인 코드를 제거한 후 링크를 추출한다. 그러나 `FENCE_RE`(`/^(\s*)(```|~~~)/`)는 선행 공백이 있는 펜스에도 매칭하지만, 중첩 펜스(예: 코드 블록 안에 코드 블록 예시를 보여주는 패턴)나 `````를 닫는 위치 처리에서 `inFence` toggle 로직이 정확하지 않을 수 있다. 실제 spec 파일 구조에서는 중첩 펜스 패턴이 드물어 현실적 위험은 낮다.
- 평가: INFO 수준. 이 패턴에 대한 엣지케이스 테스트는 없으나 현 spec 파일 구조에서는 큰 문제가 없다.

### [INFO] 스펙 링크/앵커 수정 파일들(파일 12~40) — `spec-link-integrity` gate가 직접 회귀 커버

- 위치: spec/*.md 변경 파일 전체 (29개)
- 상세: 이번 PR에서 수정된 29개 spec 파일의 링크·앵커 변경은 신규 추가된 `spec-link-integrity.test.ts`의 `findBrokenLinks`가 직접 커버한다. 기능 구현 변경이 아니므로 별도 구현 사이드 테스트는 불필요하며, gate 테스트 추가로 이 링크들의 정합성이 지속적으로 검증된다.

### [INFO] `spec-plan-completion.test.ts` — Gate C 로직 단위 테스트 추가로 vacuous pass 부분 완화

- 위치: `spec-plan-completion.test.ts` 152-176행 `Gate C enforcement logic` describe
- 상세: 이전 리뷰(00_10_01)에서 지적한 "enforced.length > 0 assertion 부재" 문제에 대해, `isGateCEnforced`/`hasValidSpecImpact` 순수 함수를 별도로 추출하고 합성 픽스처 단위 테스트를 추가하는 방식으로 부분 완화했다. cutoff 전/후 경계, 날짜 형식 변형, `none`/`없음`, 빈 배열, dangling path 등 핵심 케이스를 모두 커버한다. 이는 "실 plan이 0건이어도 게이트 로직은 검증됨"이라는 설계 결정으로 이전 WARNING에서 부분 수정됨.

---

## 요약

이번 PR에서 추가된 4개의 gate 테스트는 이전에 없던 build-time 문서 정합성 가드를 제공하는 긍정적 추가다. 특히 `slugify` pin 케이스는 이번 앵커 수정과 직접 연결된 효과적인 회귀 가드이며, `Gate C enforcement logic` 합성 단위 테스트는 실 plan 0건 상황에서도 게이트 로직을 검증한다. `plan-frontmatter.test.ts`에서 알려진 특정 plan 파일 존재 assertion이 추가되어 이전 리뷰에서 지적한 repoRoot 오해석 취약점이 수정됐다. `spec-area-index.test.ts`에서 `sys!.siblings.length > 10` assertion도 추가됐다. 잔존 위험으로는 `spec-plan-completion.test.ts`의 `GATE_C_CUTOFF` 하드코딩으로 현재 모든 기존 plan이 grandfathered 상태라 `enforced` 배열이 비어 per-plan describe 블록이 하나도 생성되지 않을 수 있다는 점과, `spec-link-integrity.test.ts`의 `findBrokenLinks`가 내부 예외 발생 시 silent pass 가능성, `inGeneratedCatalog` 함수에 대한 단위 테스트 부재, `spec/conventions` 면제 로직에 대한 명시적 assertion 부재가 있다. 이전 리뷰 세션(00_10_01)에서 제기한 WARNING들 중 일부(plan-frontmatter sanity guard 강화, spec/5-system area sibling 수 assert)는 수정됐으며, 나머지(enforced 배열 vacuous pass, findBrokenLinks silent guard, catalog 면제 단위 테스트)는 부분 완화되거나 잔존한다.

## 위험도

LOW
