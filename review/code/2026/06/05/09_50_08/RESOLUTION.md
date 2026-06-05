# RESOLUTION — AI Agent 메모리 가시화/삭제 (A1) 코드리뷰 반영

대상 SUMMARY: `review/code/2026/06/05/09_50_08/SUMMARY.md` (BLOCK: NO, Critical 0).
즉시-fix 항목(F1~F7, Q1, Q2)을 적용하고 백로그는 보류했다. e2e 작성 중
`deleteMemory`/`clearScope` 의 affected 카운트 실버그(아래 F2 비고)를 추가로 발견·수정했다.

## 조치 항목

| # | reviewer 발견 | 조치 | 위치 |
|---|---|---|---|
| F1 | GET `/agent-memories(/scopes)` 에 `@Roles` 부재 → X-Workspace-Id 스푸핑으로 비멤버 cross-workspace 조회 가능 | `listScopes`/`listMemories` 에 `@Roles('viewer')` 추가 (RolesGuard 가 멤버십 검증). 컨트롤러 권한 주석 갱신 | `agent-memory.controller.ts` |
| F2 | 신규 4 엔드포인트 e2e 부재 (ValidationPipe/ParseUUIDPipe/RolesGuard 실 체인·cross-ws·viewer 403·400 미검증) | `agent-memory-admin.e2e-spec.ts` 신규 (5 시나리오 A~E). **실 인프라 e2e 로 통과** | `test/agent-memory-admin.e2e-spec.ts` |
| F2-bug | (e2e 작성 중 발견) `deleteMemory`/`clearScope` 가 `dataSource.query()` DELETE…RETURNING 결과를 rows 배열로 가정해 `result.length` 사용. TypeORM 0.3.x postgres 는 `[rows, count]` 튜플 반환 → length 가 항상 2 → 부재 id 삭제가 NotFound 로 변환 안 되고 204 로 샘 (AGM-13 위배) | `deletedRowCount()` 헬퍼 추가(튜플의 `[0]` rows 길이 사용, 비-튜플도 방어적 허용). `consumeOAuthState` 의 문서화된 동일 계약 미러. 단위테스트 mock 을 실제 튜플 shape 로 교정 + 회귀 핀 테스트 추가 | `agent-memory.service.ts`, `agent-memory.service.spec.ts` |
| F3 | `agent-memory.en.mdx` frontmatter 완전 부재 → locale title/summary·registry 가드 영향 | ko 대칭 frontmatter(title/title_en/section/order/summary/summary_en/spec/code) 추가 | `agent-memory.en.mdx` |
| F4 | ko/en mdx `<ImplAnchor kind="ui-entry">` 부재 (user-guide-evidence §3.1) | "화면 열기"/"Open the screen" 직후 `<ImplAnchor … symbol="AgentMemoryPage" />` 추가 (ko·en) | `agent-memory.mdx`, `agent-memory.en.mdx` |
| F5 | 빈 상태 "설정 안내 링크"(spec §2 약속) 가 평문 텍스트로만 | emptyHint 아래 `<Link href="/docs/06-integrations-and-config/agent-memory">` 가이드 링크 추가 + `scopes.emptyHintLink` i18n 키 신설(ko/en) | `page.tsx`, `dict/{ko,en}/agentMemory.ts` |
| F6 | service 테스트 갭: kind+offset>0 파라미터 순서, clearScope 0건 | service.spec: `LIMIT $4 OFFSET $5` + `['ws','cust-1','fact',30,60]` 순서 단언, clearScope 0건 → 0 반환. controller.spec: clearScope 0건 → resolves toBeUndefined | `agent-memory.service.spec.ts`, `agent-memory.controller.spec.ts` |
| F7 | `memoryTotal` 헤더가 `scopes.count` i18n 키 재사용 | `memories.count` 키 신설(ko/en) + page.tsx 헤더가 그것을 사용 | `page.tsx`, `dict/{ko,en}/agentMemory.ts` |
| Q1 | kind switch(badge/label) 이중 | `KIND_META: Record<MemoryKind,{labelKey;className}>` 단일 레코드로 통합, `kindLabel`/`kindBadgeClass` 가 참조 | `page.tsx` |
| Q2 | 미사용 i18n 키 `memories.title`/`memories.createdAt` | 양 키 제거 (ko/en parity 유지) | `dict/{ko,en}/agentMemory.ts` |

### F1 controller.spec 보강
`listScopes`/`listMemories` 의 `@Roles` 메타데이터 단언을 `undefined` → `['viewer']` 로 갱신.

### 신규 e2e 시나리오 (`agent-memory-admin.e2e-spec.ts`)
- **A**: GET scopes/memories 200 + 워크스페이스 격리(다른 ws 데이터 미노출) + kind 필터.
- **B**: 비멤버가 X-Workspace-Id 스푸핑으로 GET → 403 (RolesGuard 멤버십 검증).
- **C**: viewer GET 200 / viewer DELETE 403 / editor DELETE 204 (+ 실삭제 확인).
- **D**: DELETE `/:id` — 비UUID 400, 부재 UUID 404, cross-workspace 404 (+ 타 ws row 잔존).
- **E**: DELETE scope — scopeKey 누락 400, 정상 204 + scope 격리(타 scope 잔존).

agent_memory row 는 런타임 추출 큐를 우회해 DB 직접 INSERT(`seedMemory`)로 시드.

## TEST 결과

| 단계 | 결과 | 로그 |
|---|---|---|
| lint | PASS | `_test_logs/lint-20260605-102336.log` |
| unit | PASS — 316 suites / 6102 passed (1 skipped) | `_test_logs/unit-20260605-102533.log` |
| build | PASS (backend nest + frontend next, tsc 포함) | `_test_logs/build-20260605-102611.log` |
| e2e | 통과 — 28 suites / 173 passed (신규 `agent-memory-admin.e2e-spec.ts` 포함; 직전 168 → +5) | `_test_logs/e2e-20260605-102417.log` |

agent-memory 단위 스펙 단독: controller+service 2 suites / 67 passed.

## 보류·후속 항목 (백로그 — SUMMARY "defer" 분류, 미착수)
- DB perf: listScopes `MAX(updated_at)` filesort, 데이터+COUNT 이중 집계 → `COUNT(*) OVER()`, `metadata->>'kind'` 인덱스 부재 (admin 저빈도·scope당 ≤1000 → 즉시 차단 아님; 인덱스는 CONCURRENTLY 분리 배포).
- 페이지네이션 `offset` → 프로젝트 표준 `page` 전환 (현재 spec §6 limit/offset 명시 + infinite-scroll 자연).
- 동적 SQL 파라미터 번호 삼항 보간 → builder 패턴 리팩토링.
- `AgentMemoryAdminService` 분리 (런타임/admin SRP).
- `page.tsx` 412줄 컴포넌트 분해.
- `limit=30` 기본값 상수화, `AGENT_MEMORY_KINDS` 상수 파일 추출.
- clearScope 0건 멱등 toast 중립화 (또는 `X-Deleted-Count`).
- `looksLikeInstruction` 직접 테스트, 프론트 page 컴포넌트 테스트.

> 비고: `git status` 에 보이는 `execution-engine.service.spec.ts` 의 whitespace-only 변경은
> lint `--fix` 자동 reformat 산물(본 작업과 무관)이라 본 fix 커밋에서 제외했다.
