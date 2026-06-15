# Resolution — ai-review 00_24_26 (§7 인-에디터 실행 히스토리)

리뷰 결과: **Critical 0 / Warning 9 / INFO 8**, risk MEDIUM. Critical 없음. 아래 disposition.

## Warning

| # | 카테고리 | 처분 | 조치 |
|---|----------|------|------|
| 1 | SPEC-DRIFT | **반증(FP)** | requirement-reviewer 가 spec §7 이 "미구현/계획" 이라 보고했으나 **이미 갱신됨**. `git show HEAD:spec/3-workflow-editor/3-execution.md` 확인 — `## 7. 실행 히스토리 (인-에디터)`, `### 7.1 접근`(계획 태그 없음), `status: implemented`, Rationale R-7 + partial→implemented 복귀 노트 모두 존재. 리뷰어가 merge-base(구버전) 측을 읽은 stale-read FP (ai-review 알려진 함정). 조치 불필요. |
| 2 | 유저 가이드 | **FIX** | `run-results.mdx`/`run-results.en.mdx` "실행 이력 조회" 절이 "⋮ → 실행 히스토리 = 페이지 이동" 으로 기술돼 신규 인-에디터 패널 동작과 불일치. user-guide-writer 로 KO/EN 동시 재작성: 인-에디터 패널(빠른 조회·드로어 적재·캔버스 오버레이·Re-run) vs 전용 페이지(상세 탐색) 분리 + `<ImplAnchor>` 동반. |
| 3 | 테스트 | **FIX** | `historyQuery.isError` 경로 테스트 추가 (`execution-history-panel.test.tsx` — getByWorkflow rejected → "Failed to load execution history" 렌더). |
| 4 | 테스트 | **FIX** | `loadingId` disabled 상태 테스트 추가 (미해소 getById Promise 로 클릭 후 항목 버튼 전부 disabled 검증). |
| 5 | 테스트 | **FIX** | toolbar 통합 테스트에 항목 클릭 → loadHistoricalExecution 호출 → 패널(dialog) 닫힘 케이스 추가 (`editor-toolbar-run-input.test.tsx`, apply-execution-snapshot mock 추가). |
| 6 | 테스트 | **FIX** | `loadHistoricalExecution` orchestration 단위 테스트 추가 (`apply-execution-snapshot.test.ts` — 실 store 로 executionId 세팅·과거 startedAt 보존·terminal status·nodeResults/nodeStatuses hydrate 검증). |
| 7 | 유지보수성 | **DEFER** | `editor-toolbar.tsx` 900줄+ 비대화. 리뷰어 명시 "이번 PR 단독 문제 아님". 본 PR 은 메뉴 항목 1개 + boolean state 1개 + 패널 렌더만 추가(최소 침습). MoreMenu 컴포넌트 추출은 별도 리팩토링 plan 대상. |
| 8 | 유지보수성 | **FIX** | ⋮ 메뉴 `Play` 아이콘 / 패널 헤더 `History` 아이콘 불일치 → 양쪽 `Activity` 로 통일 (Version History 의 `History` 와도 구분). |
| 9 | 문서화 | **FIX** | `editor-toolbar-run-input.test.tsx` 헤더 주석에 §7 패널 진입점 커버리지 명시. |

## INFO

| # | 처분 | 근거 |
|---|------|------|
| 1 | DEFER | `workflowId` href 삽입 — 라우트 파라미터(신뢰 source) + React escape 로 XSS 없음. UUID 정규식 강제는 over-engineering. |
| 2 | **의도된 설계(문서화)** | Viewer 의 히스토리 패널 접근은 의도적 — 실행 내역은 read-only 조회이며 Viewer 는 이미 전용 실행 내역 페이지를 본다. 재실행(Re-run)은 드로어에서 권한 게이트(`allowReRun` hidden)로 이미 차단. 추가 gate 불필요. |
| 3 | **이미 문서화** | spec §7.3 "엣지 데이터 미리보기" 는 본문에 v1 제외로 명시(라이브 실행에도 미구현). R-7 범위 한계 절 참조. |
| 4 | **FIX** | limit 20 vs 10 차이 근거를 패널 쿼리에 인라인 주석으로 명시. |
| 5 | **FIX** | `loadingId != null` → `!== null` (strict). |
| 6 | DEFER | 테스트 pagination mock 헬퍼 추출 — 가독성 nit, 회귀 위험 없음. |
| 7 | **확인·유지** | `pending_plans` + `status: implemented` — `spec-status-lifecycle.test.ts` 가드는 implemented 에 대해 **idle**(pending_plans 제약 없음, partial 만 제약). 통과 확인. plan/in-progress 이동(→complete)은 planner 라이프사이클 소관이라 그때 pending_plans 정리. |
| 8 | **해소(moot)** | W-8 아이콘 통일로 Play 미사용 → 주석 불요. |

## 검증
- lint(eslint) PASS / tsc PASS / 영향 suite(panel·apply-snapshot·store·toolbar·rbac) PASS / docs 가드(ImplAnchor·spec-status-lifecycle) PASS / 전체 frontend unit PASS (단 `schedules-page.test.tsx` 1건은 isolation 재실행 시 통과하는 기존 flaky — 본 변경 무관).
- e2e(backend) 게이트: 본 슬라이스는 backend 무변경 frontend-only — 회귀 위험 없음. 게이트 실행 결과는 PR 본문에 반영.

## 잔여(미차단)
- W-7 editor-toolbar 분리 리팩토링(별도 plan), INFO-1/6 nit. 모두 비결함·후속.
