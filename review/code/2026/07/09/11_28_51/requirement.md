# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상
- `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-detail-page.test.tsx` (prev/next slug 회귀 테스트 추가)
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-list-page.test.tsx` (row-click slug 회귀 테스트 추가)
- `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts` (regex self-test + SRC sanity 추가)
- `codebase/frontend/src/lib/workspace/href.ts` (JSDoc 정정, 로직 무변경)

목적: 직전 리뷰(`review/code/2026/07/09/10_51_47`, Critical 0 / Warning 3)의 W1(Maintainability)·W2(Testing)·W3(Testing)
세 건을 해소하는 test-only 후속 커밋. 프로덕션 로직 변경은 `href.ts` JSDoc 텍스트 정정 1건뿐(빌드 산출물 영향 없음).

## 검증 방법
- 프로덕션 코드(`dashboard/page.tsx`, `executions/[executionId]/page.tsx`, `execution-list page.tsx`, `href.ts`)를 직접 읽어
  새 테스트가 주장하는 실제 네비게이션 배선(`buildExecutionHref(slug, workflowId, executionId?)`)과 line-level 로 대조.
- `npx vitest run` 으로 4개 대상 파일 실제 실행 — 4 files / 33 tests 전부 pass 확인.
- `spec/2-navigation/{_layout.md, 0-dashboard.md, 1-workflow-list.md, 14-execution-history.md, 9-user-profile.md}`,
  `spec/data-flow/12-workspace.md` 를 grep/Read 로 대조.
- `plan/in-progress/slug-routing-hardening.md` 로 이 커밋이 커버하려는 스코프(B-1/B-2 후속, "REVIEW WORKFLOW" 단계) 확인.

## 발견사항

- **[INFO]** 프로덕션 동작 변경 없음 확인 — 이번 diff 는 테스트 4건 추가/보강 + JSDoc 코멘트 정정 1건뿐이며, `git diff` 상
  `href.ts` 의 함수 바디(`buildWorkspaceHref`/`buildExecutionHref`)는 그대로다. 리뷰 대상 커밋이 스스로 명시한 "test-only
  후속" 성격과 실제 diff 가 일치한다.
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:26-29`(구), 신규 JSDoc
  - 상세: 특이사항 아님. 확인 목적의 기록.

- **[INFO]** W2 회귀 테스트 3건이 실제 프로덕션 배선과 line-level 로 일치.
  - `dashboard/page.tsx:283-291` 이 `onClick={() => router.push(buildExecutionHref(slug, execution.workflowId, execution.id))}` 를
    이미 사용 중이며, 신규 `dashboard-page.test.tsx` 의 두 케이스(slug 존재 시 `/w/team-x/...`, 미존재 시 bare)가 이 실제
    조건 분기와 정확히 대응.
  - `[executionId]/page.tsx:296-320` 의 Prev/Next 버튼이 `buildExecutionHref(slug, workflowId, adjacentQuery.data.prev|next)` 를
    사용하며, 신규 테스트의 prev=index+1(더 오래됨)/next=index-1(더 최신) 매핑이 `adjacentQuery.queryFn`(`page.tsx:163-170`)의
    `prev: items[currentIndex+1]`, `next: items[currentIndex-1]` 정의와 정확히 일치. 페이지는 API 응답 순서를 그대로 신뢰하고
    프런트에서 재정렬하지 않으므로(코드에 정렬 로직 없음), 테스트가 `list` 배열을 `[new, current, old]` 순서로 직접 배치해
    이 신뢰 관계를 정확히 모델링한 것도 타당.
  - `execution-list-page.test.tsx` 신규 케이스도 같은 패턴으로 정합.
  - 위치: 위 3개 파일 각각
  - 상세: 세 "latent broken-link" 사이트(PR #865 회귀) 모두 실제로 프로덕션 코드에서 이미 수정돼 있었고, 테스트가 그
    수정된 배선을 정확히 커버한다. 회귀 시 즉시 포착 가능.

- **[INFO]** W3 regex self-test 가 실제로 의도한 true/false-positive 를 정확히 구분함을 실행으로 확인.
  - `RAW_EXECUTION_HREF = /`\/workflows\/\$\{[^`]*?\}\/executions/` 에 대해 3개 참-양성(백틱 리터럴)과 4개 참-음성(헬퍼 호출,
    비-executions 경로, 문자열 연결식)을 vitest 로 직접 실행 — 전부 기대대로 통과.
  - `SRC`/`HELPER` 경로 조립 sanity(`collectSourceFiles(SRC).length > 50`)도 실측(454개 소스 파일)으로 임계값이 안전함을 확인.
  - 위치: `no-raw-execution-href.test.ts:1131-1156`
  - 상세: "문자열 연결식은 탐지 대상 밖(의도적 한계)" 이라는 주석대로 실제 정규식이 그 케이스에 non-match 함을 self-test 가
    고정 — guard 의 fail-open 위험을 낮추는 목적에 정확히 부합.

- **[INFO]** W1 JSDoc 정정이 실제 메커니즘과 일치.
  - 새 JSDoc: "`__tests__/no-raw-execution-href.test.ts` guard 가 ... 소스텍스트 스캔으로 대체" — 실제로 ESLint 룰이 아닌
    vitest 테스트 파일(`no-raw-execution-href.test.ts`)이 `fs.readFileSync` 기반 소스텍스트 스캔으로 강제하고 있음을 코드로
    확인. 이전 JSDoc 의 "실재하지 않는 ESLint `no-restricted-syntax` 룰" 서술 오류가 해소됨.
  - 위치: `href.ts:26-29`(신규)
  - 상세: 함수명·주석과 구현의 괴리(점검관점 4) 해소 확인.

- **[INFO] spec fidelity** — `spec/2-navigation/0-dashboard.md:96`("행 클릭 → 실행 상세 페이지 이동"), `1-workflow-list.md:103`,
  `14-execution-history.md:20`, `_layout.md:85,126`, `9-user-profile.md:154-156` 모두 "실행 경로는 활성 워크스페이스
  slug 기준 `/w/<slug>/...`, 에디터 canvas 만 예외" 로 일관 서술 — `href.ts` JSDoc 의 "에디터 canvas 와 달리 bare 예외가
  없다" 주장과 spec 본문이 line-level 로 일치. spec-drift 나 코드 불일치 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음 (grep 결과 없음, diff 상 미완성 시사 주석 부재).

## 요약
이번 커밋은 직전 `/ai-review` 에서 지적된 Warning 3건(W1 JSDoc 오기술·W2 slug 회귀 테스트 부재·W3 guard self-test 부재)을
정확히 겨냥한 test-only 보강이다. 실제 프로덕션 코드(`dashboard/page.tsx`, `[executionId]/page.tsx`, `execution-list
page.tsx`)를 직접 읽어 대조한 결과 새로 추가된 slug 회귀 테스트들이 실제 네비게이션 배선(`buildExecutionHref(slug, ...)`)과
정확히 대응했고, `RAW_EXECUTION_HREF` self-test 도 vitest 실행으로 참/거짓 양성 케이스를 정확히 구분함을 확인했다.
`href.ts` 의 JSDoc 정정도 실제 메커니즘(vitest 소스텍스트 guard)과 일치하며, 관련 spec 본문(`0-dashboard.md`,
`1-workflow-list.md`, `14-execution-history.md`, `_layout.md`, `9-user-profile.md`)과도 line-level 로 어긋남이 없다.
4개 테스트 파일을 `npx vitest run` 으로 직접 실행해 33/33 pass 를 확인했으며, 프로덕션 로직 변경이 없어(코멘트 1건 제외)
회귀 위험도 없다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도
NONE
