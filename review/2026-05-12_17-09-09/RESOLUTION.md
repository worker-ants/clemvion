# RESOLUTION — 2026-05-12_17-09-09

리뷰 대상: commit `8b865cc8` (NAV-WF-07 소유 필터 + 워크스페이스 매뉴얼 + spec ✅ flip).
조치 commit: 이 RESOLUTION 과 함께 커밋되는 후속 변경.

## 요약

Critical 1건 + Warning 12건 + INFO 10건. 사실 점검 결과 **C1·W1·W2·W7 은 false positive** 였고, 진짜 조치 대상 8건 + INFO 2건 해결. 나머지 INFO 8건은 별도 plan 또는 현행 유지.

검증: backend lint 0 errors / 186 suites / 3251 tests, frontend lint 0 errors / 105 suites / 1250 tests, build OK.

## False positive (사실 점검 결과)

| # | 리뷰 지적 | 실제 |
|---|----------|------|
| C1 | `mockQueryBuilder` mock 격리 결함 | `workflows.service.spec.ts:124` 의 `beforeEach` 가 이미 `jest.clearAllMocks()` 호출 — 모든 `jest.fn()` call history 가 매 it 마다 초기화됨. 단, 'all' 케이스의 추가 `expect.not.toHaveBeenCalledWith('created_by'...)` 어서션을 보강해 안정성 강화 |
| W1 | `shared` 필터의 `!= :userId` 가 NULL 행 누락 | DB schema (`V001__initial_schema.sql:88`) 에 `created_by UUID NOT NULL REFERENCES "user"(id)` — DB 레벨 NOT NULL 강제. entity 의 `@Column({ name: 'created_by' })` 도 nullable false (TypeORM 기본). 따라서 NULL 행이 존재할 수 없어 SQL NULL 처리는 over-engineering |
| W2 | `WorkflowsModule` 의 `WorkspacesModule` import 누락 | `WorkspacesModule` 이 `@Global()` (workspaces.module.ts) 로 export — NestJS DI 컨테이너가 명시적 import 없이도 inject 가능. backend build/test 통과로 검증됨 |
| W7 | `registry.ts` 의 섹션 키 변경과 실제 디렉토리 불일치 | `ls frontend/src/content/docs/` 결과 — 01-getting-started, 02-nodes, 03-workflow-editor, 04-expression-language, 05-run-and-debug, 06-integrations-and-config, 07-faq, 08-workspace-and-team. `SECTION_LABELS` 의 8개 키가 모두 1:1 매칭. 이전 변경은 stale 라벨을 실제 디렉토리에 맞춘 정합성 정리였음 |

## Warning 조치 (진짜 8건)

| # | 항목 | 조치 |
|---|------|------|
| 5 | 워크스페이스 전환 시 ownership state 미초기화 | `workflows/page.tsx` — `useWorkspaceStore.subscribe()` 콜백으로 `currentWorkspaceId` 변경 감지 시 `setOwnership('all')`. React 19 의 `react-hooks/set-state-in-effect` 룰을 우회하는 외부 store 이벤트 패턴 |
| 6 | EmptyState 분기 조건이 `ownership !== "all"` 누락 | `description` 과 `action` 분기에 `(isTeamWorkspace && ownership !== "all")` 항을 추가 — 소유 필터 결과 0건일 때 "조정 hint" 가 표시되고 "첫 워크플로우 만들기" 가 잘못 노출되지 않음 |
| 8 | 컨트롤러 단위 테스트 부재 | `workflows.controller.spec.ts` 에 새 describe `findAll — ownership wiring` 추가 (2 케이스: `user.sub` 가 service 의 3번째 인자로 전달 / `ownership='mine'` 그대로 전달) |
| 9 | DTO 유효성 실패 케이스 테스트 부재 | `workflow-dto-validation.spec.ts` 에 새 describe `QueryWorkflowDto (ownership)` 추가 (3 케이스: 유효 / 미설정 / invalid → IsIn 에러) |
| 10 | `workspacesService.findById` 예외 전파 미검증 | `workflows.service.spec.ts` 에 `propagates workspacesService.findById rejection` 케이스 추가 |
| 11 | pagination describe 의 workspace store 초기화 누락 | `workflows-page.test.tsx` 의 pagination `beforeEach` 에 `useWorkspaceStore.setState({...})` 명시 + ownership describe 에 `afterEach` cleanup 도 추가 — 테스트 간 store/DOM 누수 차단 |
| 12 | `backend/package-lock.json` 변경 미설명 | 본 PR 의 의도된 변경 아님 — 이전 작업 세션부터 dirty 상태로 유지된 무관 파일. 본 commit 에서는 stage 하지 않아 그대로 둠 |

## INFO 조치 (2건)

| # | 항목 | 조치 |
|---|------|------|
| 3 | DTO 의 ownership 허용 값이 3 곳에 중복 | `OWNERSHIP_VALUES = ['mine','shared','all'] as const` 단일 출처화. `@IsIn`·`@ApiPropertyOptional.enum`·`Ownership` union 타입 모두 이를 참조 |
| 4 | MDX `/docs/spec` 링크가 실제 라우트와 불일치 | 두 mdx 모두 raw 경로 텍스트(`spec/2-navigation/9-user-profile.md`) 로 변경 — 사용자가 IDE/저장소에서 직접 열도록 안내 |
| 5 | RESOLUTION 미작성 | 본 파일이 그 결과물 |
| 7 | 'all' 케이스에 not-called-with(created_by) 어서션 누락 | service.spec 에 `expect.not.toHaveBeenCalledWith(stringContaining('created_by'),...)` 추가 |

## 별도 plan / 현행 유지 (INFO 7건)

| # | 항목 | 사유 |
|---|------|------|
| W3 | cross-module 순환 의존 위험 | 실제 점검 결과: `workspaces.service` 가 `workflows.service` 를 import 안 함. 순환 없음. 향후 양방향 의존 추가 시 재검토 |
| W4 | `(workspace_id, created_by)` 복합 인덱스 | 별도 plan: `plan/in-progress/team-workspace-e2e.md` 다음 단계의 성능 튜닝 plan 으로 분리 가능 |
| I1 | workspace.type 을 JWT/middleware 로 상향 이동 | 별도 architecture 개선 plan 으로 분리. 현 시점은 `mine`/`shared` 경로에서만 1회 추가 쿼리 |
| I2 | `workspace?.type` 옵셔널 체이닝과 `findById` 계약 | `findById` 가 null 반환 가능(현재 service 의 시그니처)이므로 옵셔널 체이닝은 정당. 변경 없음 |
| I6 | `ownershipButtons` 매 렌더 재생성 | 작은 array 재할당이라 성능 영향 무시할 만함. 현행 유지 |
| I8 | URL 직렬화 | `search`·`filter` 와 동일하게 state-only — 일관성 유지. 딥링크 요구 시 별도 enhancement |
| I9 | 이중 방어 (클라이언트 미전송 + 서버 무시) | 현행 유지 — 리뷰도 정상 패턴이라 확인 |
| I10 | TOCTOU (workspace type 변경) | 읽기 전용 분기, 실질 무결성 영향 없음. 현행 유지 |

## 검증

- backend
  - `npm run lint` → 0 errors (1 pre-existing warning in `variable-modification.handler.ts`)
  - `npm test` → 186 suites / 3251 tests (+6 신규 cases: ownership 'all' no-created_by · findById rejection · controller user.sub · DTO 3 cases)
  - `npm run build` → OK
- frontend
  - `npm run lint` → 0 errors
  - `npm test` → 105 suites / 1250 tests
  - `npm run build` → OK
