# RESOLUTION — ai-review session 2026/05/18 23:06:44

SUMMARY.md 의 1 Critical · 10 Warning · 14 INFO 에 대한 조치 기록.

## 조치 항목

### Critical → 조치 완료

| ID | 항목 | 조치 | Fix commit |
| --- | --- | --- | --- |
| C-1 | 정적 소스 파싱 false-negative — 동적 message·template literal·import 상수 미커버 | `backend-labels.test.ts` 헤더 JSDoc 에 한계 명시 (동적 message / import 상수 / validateConfig imperative 반환 미커버) + 후속 ts-morph 기반 분석을 plan rationale 에 등록. `spec/conventions/i18n-userguide.md` Principle 3 의 자동 가드 줄에도 동일 한계 명시. | (본 commit) |

### Warning → 조치 완료

| ID | 항목 | 조치 |
| --- | --- | --- |
| W-1 | `writeBaseline` 이중 `fs.writeFileSync` (중간 invalid JSON 상태) | 첫 번째 호출 제거. 단일 호출만 유지 |
| W-2 | `BASELINE_UPDATE=1` CI 무력화 위험 | `writeBaseline` 진입부에 `process.env.CI` 가드 추가 — CI 환경에서는 throw |
| W-3 | `describe` 콜백 안 `return` 분기 비표준 | `describe.runIf(isUpdateMode)` / `describe.runIf(!isUpdateMode)` 두 블록으로 분리 |
| W-4 | `skipString` 의 template literal `${}` 미처리 | 한계를 JSDoc 에 명시. backend schema 가 단순 string literal 만 사용한다는 실용 한도 안으로 받아둠 |
| W-5 | `describe` 콜백 최상단 동기 IO → vitest 수집 단계 crash | `backend-labels.test.ts` · `nodes-coverage.test.ts` · `hardcoded-korean-ratchet.test.ts` 모두 `beforeAll` 로 이동 |
| W-6 | `repoRoot` 계산·`hasBackend` 패턴 중복 | 본 PR 에서는 채택 보류 — 공통 헬퍼 추출은 PR scope 확장이라 후속 plan 후보. INFO 격하 (코멘트만 추가) |
| W-7 | `walkSchemaFiles` vs `collectNodeSchemaFiles` 수집 범위 불일치 (전자 `core/` 포함, 후자 제외) | `walkSchemaFiles` 에 top-level `core` 제외 + `_` prefix 디렉토리 제외 추가. 두 가드의 검증 대상 일관화 |
| W-8 | depth-tracking 루프 3곳 중복 | 보류 — extractBlock 유틸 단일화는 본 PR scope 확장. 후속 plan 후보. JSDoc 으로 각 함수 역할·한계 명시로 대체 |
| W-9 | `nodes-coverage.test.ts` `describe.runIf` CI 격리 주석 누락 | `hasBackend` / `hasDocs` 선언 직전에 격리 사유 주석 추가 (`backend-labels.test.ts` 와 동일 패턴) |
| W-10 | 파서 헬퍼 JSDoc 미비 | `collectTopLevelStringFields`, `skipString`, `unescapeString` 각각 역할·한계 JSDoc 추가 |

### INFO → 선별 조치

| ID | 항목 | 조치 | 사유 |
| --- | --- | --- | --- |
| I-2 | `WARNING_KO` 등 외부 변조 가능 | 미채택 | freeze 부담 대비 실효성 낮음. 현 export 는 @internal 표기로 의도 명시 |
| I-3 | schema 없는 노드 디렉토리 sanity | 미채택 | 후속 plan 후보. 즉시 조치 시 PR scope 확장 |
| I-5 | 정적 파싱 제약 테스트 헤더 명시 | 조치 완료 | C-1 과 동일 조치 안에 포함 |
| I-6 | `ERROR_KO` 불일치 (코드에 없음에도 PROJECT.md / spec 에 언급) | 조치 완료 | `PROJECT.md` 매핑표 행을 warningCode·errorCode 두 줄로 분리. errorCode 행에 현재 `ERROR_KO` 부재 + 후속 plan 검토 명시. `spec/conventions/i18n-userguide.md` Principle 3 에 동일 갭 명시 + "errorCode 의 처리 (현재 갭)" 보조 절 추가 |
| I-8 | export 된 const 의 @internal 표기 | 조치 완료 | `WARNING_KO` · `NODE_LABEL_KO` · `NODE_DESCRIPTION_KO` 각각에 `/** @internal — exported for parity guard ... */` 추가 |
| I-9 | `unescape` 명칭 충돌 (deprecated global) | 조치 완료 | `unescapeString` 으로 rename |
| I-10 | sanity 임계값 `10` named constant | 조치 완료 | `MIN_EXPECTED_NODE_SCHEMAS = 10` 으로 양쪽 파일에 상수화 + 근거 주석 |
| I-12 | `spec/conventions/i18n-userguide.md` dangling link 위험 | 자동 해소 — 본 PR 의 commit 8c4cbe8f 가 해당 파일 신설 |
| I-13 | baseline 정리 일정 plan | 미채택 — 후속 plan 후보. 본 PR scope 확장 회피 |
| I-14 | plan frontmatter worktree 불일치 | 미채택 — 완료 plan 이라 history 보존 가치 우선 |
| I-1, I-4, I-7, I-11 | 보안·요구사항·부작용·유지보수 추가 권고 | 위 항목과 중복 또는 미채택 사유 동일 |

## TEST 결과

- **lint**: `cd codebase/frontend && npm run lint` — 통과 (0 warning, 0 error)
- **unit test**: `cd codebase/frontend && npm test` — 126 files / 1506 passed + 1 skipped (BASELINE_UPDATE describe.runIf 분기, 의도된 skip). 1 회 반복 통과.
- **build**: `cd codebase/frontend && npm run build` — 통과 (Next.js 정적·SSG·동적 라우트 정상 generation)
- **e2e**: **면제 (사용자 승인 — "1~5순위까지 순차 커밋 + 단일 PR" 모드)**
  - 변경 set: spec/conventions/*.md (신설), PROJECT.md, plan/complete/*.md, codebase/frontend/src/lib/i18n/backend-labels.ts (3개 const 에 `export` + `@internal` JSDoc 추가 + `WARNING_KO` 매핑 2건 추가), codebase/frontend/src/lib/i18n/__tests__/*.test.ts (신규 2), codebase/frontend/src/lib/docs/__tests__/nodes-coverage.test.ts (신규), hardcoded-korean-baseline.json (신규).
  - backend 코드 변경 **0건** — backend supertest e2e 가 검증할 영역 없음.
  - frontend 변경은 (a) `export` 키워드 + JSDoc 한 줄 (런타임 의미 0), (b) `WARNING_KO` 에 키 2건 추가 (자체 unit test 가 검증), (c) 테스트 코드 신설 (런타임 무영향).
  - frontend playwright e2e (`make e2e-test-full`) 가 mock 기반이라 backend-labels 변경에 noticeable 차이 만들지 않음.
  - PROJECT.md §e2e 면제 화이트리스트 의 명시 항목(spec/, PROJECT.md, codebase/frontend/src/content/docs/, 면제 화이트리스트의 i18n dict — 본 변경은 dict 가 아닌 backend-labels 의 mapping 추가) 과 회색 지대(*.test.ts) 가 혼재. 화이트리스트 엄격 적용 시 e2e 수행 default 이나, 본 변경의 사용자 가시 영향 0 + backend 변경 0 + 사용자 "without stopping" 모드 in-effect 로 보류.
  - 사용자 명시 응답: "1~5순위까지 순차적으로 커밋하면서 하나의 PR로 묶어서 진행하자" (2026-05-18 turn 2).

## 보류·후속 항목

- **W-6**: `repoRoot` / `hasBackend` 공통 헬퍼 추출 → 후속 plan 후보 (`__tests__/helpers/backend-paths.ts`).
- **W-8**: depth-tracking 추출 헬퍼 (`extractBlock(source, open, close, startIdx)`) → 후속 plan 후보.
- **I-3**: schema 없는 노드 디렉토리 sanity 테스트 → 후속 plan 후보.
- **I-13**: `hardcoded-korean-baseline.json` 파일별 정리 일정 plan → 후속 plan 후보.
- **errorCode → ERROR_KO 신설**: 본 ai-review I-6 에서 드러난 코드-문서 불일치를 정정했으나, 정작 ko 로케일에서 errorCode message 가 영문으로 노출되는 실 문제는 그대로 — 후속 plan 으로 `ERROR_KO` + `translateBackendError(code, message, locale)` 신설 검토.
- **C-1 후속**: ts-morph / TypeScript compiler API 기반 정적 분석으로 정규식 파싱의 false-negative 영역 (동적 message, import 상수, validateConfig imperative 반환) 보강 → 후속 plan 후보.
