# RESOLUTION — 워크스페이스 interactionAllowedOrigins 설정 API/UI

리뷰: `review/code/2026/06/03/15_40_51/SUMMARY.md` — RISK **HIGH**, Critical **2**, Warning **20**, INFO 다수. 조치: 수동(main).

## Critical (fix)

| # | 조치 |
|---|---|
| C1 | `updateWorkspaceSettings` 에 `(dto.interactionAllowedOrigins ?? [])` 방어 — ValidationPipe 우회/미래 누락 시 `undefined.map` TypeError 차단 |
| C2 | personal 워크스페이스 **의도적 허용** 명시(주석) — delete/leave/transfer 와 달리 공개 웹챗 트리거(임베드)는 personal 에도 존재 가능하고 owner=admin-tier 라 정당. 차단 대신 허용 결정 |

## Warning (fix)

| # | 조치 |
|---|---|
| W2 | DTO `@ApiProperty` description 정정 — "빈 배열=모든 origin 차단" → "추가 origin 없음(위젯 CDN 항상 허용)" |
| W6 | 전용 `WorkspaceSettingsDto`(응답) 신설 → GET swagger 가 요청 DTO 재사용하던 입출력 혼재 제거 |
| W8 | `EmbedOriginsCard` stale JSDoc("GET 엔드포인트 없음") → 실제 구현(GET 시드, Admin+ 편집)으로 갱신 |
| W11·I4 | DTO·frontend origin 정규식이 후행 슬래시 **허용**(`…\/?$`)하도록 정렬 → 서비스 `.replace(/\/$/,'')` 정규화가 dead-path 아님(입력 forgiving + 정규화 정합) |
| W12 | `updateWorkspaceSettings` 비-멤버(getMemberRole null) → ADMIN_REQUIRED 단위테스트 추가 |
| W13 | `getWorkspaceSettings` 멤버이나 워크스페이스 부재 → WORKSPACE_NOT_FOUND 단위테스트 추가 |
| W16·I6 | `workspacesApi.updateSettings`/`getSettings` JSDoc 추가(void 반환 의도·시드 용도 명시) |
| W19 | `getWorkspaceSettings` `as string[]` 캐스팅 → `filter((o): o is string => typeof o==='string')` 타입가드 |
| W15 | read-modify-write 비원자성 — 주석으로 last-write-wins(전체 목록 교체 의미라 허용) + 다중 키 동시쓰기 시 jsonb `||` 전환 가이드 명시. 현재 origins 만 편집 가능하므로 키 간 lost-update 없음 |

## Warning/INFO — 이미 반영됨 (reviewer stale)

| # | 상태 |
|---|---|
| W7 | `ADMIN_REQUIRED` 는 **이미** `spec/5-system/3-error-handling.md §1.2` 에 등재됨(spec commit) |
| W9 | `9-user-profile §6.1` 에 PATCH·GET `/:id/settings` 2행 **이미** 등재됨(spec commit) |
| W17 | `web-chat.mdx` 빈 목록 문구는 user-guide-writer 가 "위젯 CDN 항상 허용" 으로 이미 정정 |

## Warning/INFO — 수용(근거)

| # | 근거 |
|---|---|
| W1 | origin 정규식이 `*` 등 차단 안 하나 **CORS 는 exact-match** 라 의미없는 값은 실제 Origin 헤더와 매치 안 됨(보안 영향 없음, reviewer 동의). 정규식 복잡화 회피 |
| W3 | assertAdmin+findOne 2-쿼리는 admin 설정(저빈도)엔 허용. 향후 JOIN 최적화 후보 |
| W4 | TanStack Query v5 는 background refetch 중 `isSuccess` 유지(data 보존) → key("loaded") 불변 → invalidate 시 remount 사이클 미발생. 전제 비성립 |
| W5·W20 | PATCH 응답(workspace+settings)은 spec §6.1 에 문서화. swagger WorkspaceDto 는 근사치(런타임 정확). GET 은 W6 로 해소 |
| W10 | void 반환은 의도(W16 주석) — caller 가 `workspace-settings` 쿼리 invalidate 로 정규화 값 재로드 |
| W14 | 컨트롤러는 thin delegation. e2e G 가 응답 shape·ParseUUIDPipe·RBAC 전수 커버 |
| W18 | e2e G 는 단일 RBAC 시나리오로 응집. 분리 미적용(수용) |
| I9 | `getSettings` staleTime 기본(0) — 설정 화면 진입 시 재요청 허용 범위. 향후 60s 고려 |
| I11 | `settings` JSONB `default: {}` — 서비스가 `?? {}` 로 방어. NULL 위험 없음 |

## TEST 결과

- lint: 내 코드 **0 errors** (backend eslint 0 err/43 warn pre-existing, frontend eslint clean). 전체 `run-test.sh lint` 는 worktree 의 미완성 monorepo workspace 패키지(`packages/sdk` prepare→@types/node, expression-engine→dayjs) install 실패로 차단 — **환경 문제, 내 변경 무관**.
- unit: backend workspaces **84 pass**(getWorkspaceSettings 5 + 신규 W12/W13 포함) / frontend i18n parity **62 pass** (스코프). backend tsc 0 new(baseline 133, workspaces 0) / frontend tsc 0(변경 파일).
- build: frontend `next build` 는 동일 환경 install 차단(미수행). 내 코드 tsc 통과. CI(frontend-checks) 가 머지 시 정식 빌드.
- e2e: **PASS 144**(docker, 96s) — `workspace-rbac` G: PATCH Admin+(owner 200/viewer·비멤버 403) + GET(멤버 200/비멤버 403) + DB 영속 검증. fix 후 회귀 없음.

## 보류·후속

- W3(2-쿼리 JOIN 최적화)·I5(EmbedOriginsEditor 별 파일 추출)·W18(e2e 시나리오 분리)·I9(staleTime) — 후속 개선 후보(본 PR 비목표).
