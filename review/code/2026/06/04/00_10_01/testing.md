# Testing Review

## 발견사항

### [INFO] 이번 PR 의 테스트 관련 변경 이중 구조 이해

이번 PR 의 변경은 두 레이어로 구성된다.

1. **신규 gate 테스트 4종 추가** (긍정적 추가):
   - `spec-link-integrity.test.ts` — spec 내부 링크/앵커 무결성 자동 검증
   - `spec-area-index.test.ts` — 영역 index 파일 완전성 검증
   - `plan-frontmatter.test.ts` — in-progress plan frontmatter 필수 필드 검증
   - `spec-plan-completion.test.ts` — Gate C: 완료 plan 의 `spec_impact` 강제화

2. **KB 파이프라인 구현 단순화 + 기존 테스트 삭제** (이전 ai-review 세션에서 이미 CRITICAL/WARNING 으로 분류됨):
   - `parseMdSegments`, `parsePdfSegments`, `parseDocumentSegments` 삭제 + spec 파일 전체 삭제
   - `chunkText` 의 `baseMetadata` 파라미터 제거 + 검증 테스트 삭제
   - `embedding.service.spec.ts` 에서 multi-segment 경로 테스트 삭제
   - `$itemIsFirst`/`$itemIsLast` 표현식 변수 삭제 + 관련 테스트 삭제
   - `summaryTemplate` 4개 노드에서 삭제 + 각 spec 파일 테스트 삭제
   - `NodeSettingsPanel` 에러 핸들링 테스트 파일 전체 삭제

이전 리뷰 세션(`review/code/2026/06/03/23_42_50/testing.md`)에서 해당 삭제 패턴을 이미 상세 분석했으므로, 이번 리뷰에서는 **신규 추가된 gate 테스트** 코드 품질 분석에 집중한다.

---

### [WARNING] `plan-frontmatter.test.ts` — `plans.length > 20` 하한이 충분히 보수적이지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 45행 `expect(plans.length).toBeGreaterThan(20)`
- 상세: `repoRoot()` 가 잘못된 경로를 반환하더라도, 테스트 실행 시 현재 디렉토리에 우연히 20개 이상의 `plan/in-progress/*.md` 파일이 있으면 sanity guard 가 통과해 버린다. 현재 실제 plan 수가 20이 넘으면 heuristic 이 맞지만, 파일이 이동·삭제되어 정확히 20개가 되면 guard 가 열린다. 아울러 spec 파일 존재 assertion (`fs.existsSync(path.join(root, "plan", "in-progress"))`) 은 있으나, 예상 구조 (`plan/in-progress/*.md` 가 특정 파일을 포함) 에 대한 추가 assert 가 없다.
- 제안: 알려진 특정 plan 파일(예: `plan/in-progress/knowledge-base-quality-improvements.md`)이 존재하는지 assertion 을 추가하면 repoRoot 오해석을 더 확실하게 탐지할 수 있다.

### [WARNING] `spec-area-index.test.ts` — 동적 describe 블록 생성 시 빈 areas 로 vacuous pass 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 69행 `for (const area of areas) { describe(area.rel, () => { ... }) }`
- 상세: `collectAreas()` 가 빈 배열을 반환하면 `for` 루프가 실행되지 않아 describe 블록이 하나도 생성되지 않는다. 이 경우 "discovers multiple spec areas" 하나의 assertion (`areas.length > 5`) 만 있으므로 repoRoot 가 빈 디렉토리를 반환할 때 테스트가 5개 미만 areas 로 실패하지 않으면 완전 vacuous pass 다. 현재 sanity guard (`areas.length > 5`, `areas.some(a => a.rel === 'spec/5-system')`) 는 이를 어느 정도 방어하지만, `collectSpecMarkdown` 자체가 0을 반환하면 areas 가 0이 되어 하한 5 미충족으로 실패한다. 그러나 `collectSpecMarkdown` 가 **catalog-only 파일만** 반환하는 엣지케이스에서는 areas 가 0 이면 하한 guard 가 잡지만 0이 아니면 area 내용 assert 가 없을 수 있다.
- 제안: `areas.length > 5` 외에 대표 area 의 sibling 수를 추가 assert 하면 방어가 강화된다. 예: `spec/5-system` area 의 siblings 가 10개 이상이어야 한다.

### [WARNING] `spec-link-integrity.test.ts` — `slugify` 단위 테스트는 충분하나 `findBrokenLinks` 통합 테스트는 실 파일시스템 완전 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 43-46행
- 상세: `findBrokenLinks(root)` 는 실제 파일시스템을 전수 스캔한다. CI 환경에서 `spec/` 가 checkout 되지 않았거나 상이한 경로에 있을 경우 `findBrokenLinks` 내부에서 예외가 발생하거나 violations 가 0으로 리턴되어 vacuous pass 가 발생할 수 있다. 현재 "resolves a real repo root and scans a non-trivial spec set" 테스트가 `files.length > 100` 과 `spec/0-overview.md` 존재로 guard 하는 것은 적절한 방어이나, 이 두 테스트의 실행 순서가 Vitest 에서 보장되지 않으면 (describe 내부에서는 순서 보장됨) 의존성이 발생할 수 있다.
- 평가: 현재 구현에서 두 `it` 블록이 동일 `describe` 안에 있으므로 순서는 보장된다. 실제 문제는 낮지만 `findBrokenLinks` 가 내부에서 예외를 무시하고 0을 리턴하는 경우에 대한 방어가 없다.
- 제안: `spec-links.ts` 의 `findBrokenLinks` 가 `collectSpecMarkdown` 호출 결과 0개를 받았을 때 throw 하거나 명시적으로 경고하는 guard 를 추가하면 silent pass 를 방지할 수 있다.

### [WARNING] `spec-plan-completion.test.ts` — `GATE_C_CUTOFF` 날짜 하드코딩으로 모든 기존 plan 이 grandfathered
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 24행 `const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")`
- 상세: cutoff 를 오늘 날짜(2026-06-04)로 설정했기 때문에 `started` 가 그 이전인 모든 기존 plan 이 grandfathered 되어 현재 시점에서 `enforced` 배열이 사실상 비어있을 가능성이 매우 높다. "resolves a real repo root with a complete plan dir" sanity test 는 `plans.length > 10` 을 assert 하지만 `enforced.length` 에 대한 assertion 은 없다 — `enforced` 가 0이면 동적 describe 블록이 생성되지 않아 gate 가 항상 vacuous pass 상태다.
- 제안: `enforced.length` 가 일정 수 이상(예: > 0 또는 > 3) 이어야 한다는 assertion 을 추가하거나, 아니면 이 상황("현재 모두 grandfathered라 enforced 없음")을 테스트 output 에 명시적으로 출력해 리뷰어가 알 수 있게 해야 한다. 또는 알려진 cutoff 이후 started plan 이 존재할 때 enforce 동작을 검증하는 픽스처 테스트를 추가해야 한다.

### [WARNING] `spec-links.ts` — `spec/conventions/` 안의 `*-api-catalog/` 면제 패턴이 정규식으로만 정의, 테스트 커버 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (링크 수집 로직) 및 `spec-frontmatter-parse.ts` 71-72행 `CATALOG_FIELD_FILE` 정규식
- 상세: `collectSpecMarkdown` 에서 catalog 파일 면제 로직이 존재하지만 해당 면제 패턴이 올바르게 작동하는지 단위 테스트가 없다. 정규식 `^spec\/conventions\/[^/]+-api-catalog\/[^/]+\/.+\.md$` 에서 nesting depth 를 잘못 산정하면 상위 index 파일이 제외되거나 field 파일이 포함될 수 있다. `spec-link-integrity.test.ts` 의 slugify 케이스들처럼 catalog 면제 패턴도 단위 테스트가 있어야 한다.
- 제안: `isApplicable()` 또는 `collectSpecMarkdown()` 의 catalog 면제 패턴에 대한 단위 테스트 케이스를 `spec-frontmatter.test.ts` 또는 `spec-link-integrity.test.ts` 에 추가해야 한다.

### [INFO] `spec-link-integrity.test.ts` — `slugify` pin 케이스가 현재 변경과 직접 연결되어 회귀 방지 효과 있음
- 위치: `spec-link-integrity.test.ts` 55-73행
- 상세: `slugify` 케이스 중 `"## 1. Condition 구조" -> "1-condition-구조"` 는 이번 PR 에서 수정된 앵커 오류 패턴(`#1-conditiongroup-구조` → `#1-condition-구조`)과 정확히 일치한다. 이 pin 테스트는 slugger 알고리즘의 향후 변경이 기존 앵커를 깨뜨리는 것을 방지하는 효과적인 회귀 가드다. 긍정적으로 평가한다.

### [INFO] `spec-area-index.test.ts` — `spec/conventions/` 면제 하드코딩은 의도적이나 주석으로만 설명됨
- 위치: `spec-area-index.test.ts` 46행 `if (rel === "spec/conventions") continue;`
- 상세: conventions 폴더가 flat reference collection 으로 index 없이 운영되는 설계 결정을 코드 주석으로만 설명한다. 이 면제가 의도적임을 검증하는 테스트가 없다. 향후 `spec/conventions/_product-overview.md` 같은 index 파일이 추가되면 면제가 silently 작동하여 index-sibling 체크를 건너뛰게 된다. 낮은 위험이나 면제 로직이 바뀌면 탐지 가능성이 없다.

### [INFO] 스펙 링크/앵커 수정 파일들(파일 4~29) — spec-link-integrity gate 가 직접 회귀 커버
- 위치: spec/*.md 변경 파일 전체
- 상세: 이번 PR 에서 수정된 29개 spec 파일의 링크·앵커 변경은 신규 추가된 `spec-link-integrity.test.ts` 의 `findBrokenLinks` 가 직접 커버한다. 기능 구현 변경이 아니므로 별도 구현 사이드 테스트는 불필요하다.

---

## 요약

이번 PR 에서 신규 추가된 `spec-link-integrity`, `spec-area-index`, `plan-frontmatter`, `spec-plan-completion` 4개의 gate 테스트는 이전에 없던 build-time 문서 정합성 가드를 제공하는 긍정적 추가다. 특히 `slugify` pin 케이스는 이번 앵커 수정과 직접 연결된 효과적인 회귀 가드다. 그러나 모든 gate 테스트가 공통적으로 `repoRoot()` 의 실제 파일시스템에 완전 의존하고, `spec-plan-completion.test.ts` 의 `GATE_C_CUTOFF` 가 현재 날짜로 설정되어 사실상 모든 기존 plan 이 grandfathered 상태라 `enforced` 배열이 비어있을 가능성이 높아 gate 가 vacuous pass 상태일 수 있다. KB 파이프라인 구현 삭제와 함께 삭제된 테스트들(이전 세션에서 CRITICAL 분류)은 이번 변경에도 여전히 미해결 상태로 남아 있다.

## 위험도

MEDIUM

STATUS=success
