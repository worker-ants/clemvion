파일 쓰기 권한이 필요합니다. 아래에 통합 보고서를 직접 출력합니다.

---

# Code Review 통합 보고서

> 브랜치: `team-workspace-followups`
> 대상: NAV-WF-07 소유 필터(ownership filter) + 워크스페이스 매뉴얼
> 리뷰 일시: 2026-05-12
> 에이전트 수: 13개

---

## 전체 위험도

**MEDIUM** — 기능 동작은 전반적으로 올바르나, 테스트 격리 결함(mock 누적)·SQL NULL 처리 누락·DI 모듈 등록 미확인·워크스페이스 전환 시 상태 미초기화 등 4개 영역에서 실질적 조치가 필요한 발견사항이 존재한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `mockQueryBuilder`가 `describe` 공유 객체이고 `beforeEach`에서 call history가 초기화되지 않아, `not.toHaveBeenCalledWith` 어서션이 이전 테스트 호출 기록에 오염될 수 있음 (false negative/positive) | `workflows.service.spec.ts` — `ownership is ignored in personal workspace` 테스트 | `beforeEach` 상단에 `jest.clearAllMocks()` 추가, 또는 jest 설정에 `clearMocks: true` 적용 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database / Requirement | `shared` 필터의 `w.created_by != :userId` 조건이 SQL NULL 의미론상 `created_by IS NULL` 행을 결과에서 누락시킴. 레거시 데이터나 직접 DB 조작 시 silent filtering bug | `workflows.service.ts` L94 | `(w.created_by != :userId OR w.created_by IS NULL)` 로 수정하거나 마이그레이션에서 `created_by NOT NULL` 제약 강제 |
| 2 | Dependency / Architecture | `WorkflowsService`에 `WorkspacesService`가 신규 주입되었으나, `WorkflowsModule`의 `imports`에 `WorkspacesModule` 추가 여부가 diff에 없음. 누락 시 NestJS 부트업 시 런타임 에러 발생 (단위 테스트는 mock으로 우회되어 감지 불가) | `workflows.module.ts` (diff 미포함) | `backend/src/modules/workflows/workflows.module.ts`에서 `WorkspacesModule` import 여부 즉시 확인 |
| 3 | Dependency / Architecture | `WorkflowsService` → `WorkspacesService` 단방향 cross-module 의존 신규 추가. 역방향 의존이 이미 있거나 향후 생길 경우 NestJS 순환 의존성 에러 발생 가능 | `workflows.service.ts` L21, L47 | `WorkspacesService` 모듈 트리에 역방향 의존이 없는지 확인. 순환 발견 시 `forwardRef()` 적용 또는 workspace type을 컨트롤러에서 파라미터로 전달 |
| 4 | Database | `(workspace_id, created_by)` 복합 인덱스 부재 가능성. 팀 워크스페이스에 워크플로 수백~수천 건 이상 시 `mine`/`shared` 필터 쿼리 성능 저하 | `workflows` 테이블 스키마 | 마이그레이션에 `CREATE INDEX CONCURRENTLY idx_workflows_workspace_created_by ON workflows (workspace_id, created_by)` 추가 권장 |
| 5 | UX / Requirement | 팀 워크스페이스에서 `ownership='mine'` 선택 후 개인 워크스페이스로 전환해도 `ownership` state가 `'mine'`으로 유지됨. 다시 팀 워크스페이스로 전환 시 이전 필터 복원으로 사용자 혼란 유발 | `page.tsx` L48 | `useEffect(() => { setOwnership("all"); }, [currentWorkspaceId])` 추가 |
| 6 | UX / Requirement | EmptyState 분기 조건이 `debouncedSearch \|\| filter !== "all"`만 검사하고 `ownership !== "all"`을 누락. `ownership='mine'`에서 결과 없을 때 "첫 워크플로우 만들기" 메시지·버튼이 잘못 표시됨 | `page.tsx` — EmptyState 분기 | 조건에 `(isTeamWorkspace && ownership !== "all")` 추가 |
| 7 | Documentation / Scope | `registry.ts` `SECTION_LABELS`에서 기존 섹션 키가 일괄 리넘버링·리네임되었으나, 실제 `src/content/docs/` 디렉터리 변경이 diff에 없음. 불일치 시 섹션 문서 무음 누락 및 기존 URL 404 | `frontend/src/lib/docs/registry.ts` | `frontend/src/content/docs/` 하위 디렉터리명 실제 상태 확인. 변경된 경우 `next.config.js`에 리다이렉트 규칙 추가 |
| 8 | Testing | 컨트롤러 `findAll`에 `@CurrentUser()` 추가·`user.sub` 서비스 전달 변경이 있으나 컨트롤러 단위 테스트 없음 | `workflows.controller.ts` — `findAll` | `user.sub`가 서비스 세 번째 인자로 전달되는지, 미인증 시 401 반환 케이스 추가 |
| 9 | Testing | `@IsIn(['mine', 'shared', 'all'])` 추가에 대한 DTO 유효성 실패 케이스 테스트 없음 | `query-workflow.dto.ts` | invalid 값 → 400 검증 케이스 추가 |
| 10 | Testing | `workspacesService.findById`가 예외를 던지거나 null을 반환하는 경우 테스트 없음 | `workflows.service.spec.ts` | `mockRejectedValueOnce(new Error(...))` 케이스 추가 |
| 11 | Testing | pagination 테스트 `beforeEach`에서 `useWorkspaceStore` 상태가 초기화되지 않아 이전 테스트 suite의 팀 워크스페이스 상태가 잔류 가능 | `workflows-page.test.tsx` — `pagination` describe | `useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null, loaded: true })` 추가 |
| 12 | Dependency | `backend/package-lock.json`이 수정 상태이나 diff 미포함. 의도치 않은 패키지 변경 가능성 | `backend/package-lock.json` | `git diff backend/package-lock.json \| grep '"version"' \| head -40`으로 실제 변경 내용 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / DB | `ownership=mine`/`shared` 요청마다 `workspacesService.findById` 추가 DB 쿼리 발생 (2회 → 3회). `all` 경로는 스킵됨 | `workflows.service.ts` L86–97 | 중기: workspace type을 JWT 클레임 또는 미들웨어 request context로 이동해 쿼리 제거 |
| 2 | Architecture | `workspace?.type` 옵셔널 체이닝이 `findById`의 실제 반환 계약(항상 entity 또는 throw)과 불일치 | `workflows.service.ts` L89 | null 반환 계약을 명시하거나 `workspace.type`으로 변경. 의도적 폴백이면 주석 명시 |
| 3 | Maintainability | DTO에서 `ownership` 허용 값이 `@IsIn(...)`, `@ApiPropertyOptional.enum`, TypeScript union 세 곳에 중복 정의됨 | `query-workflow.dto.ts` | `const OWNERSHIP_VALUES = ['mine', 'shared', 'all'] as const` 단일 출처화 |
| 4 | Documentation | MDX "See also" 링크 3개가 `/docs/spec` 형식으로 실제 문서 경로와 불일치. 404 반환 가능 | `workspaces-and-members.{en.}mdx` | 실제 docs 경로로 교체하거나 텍스트만 표기 |
| 5 | Documentation | plan 문서에 "3차 ai-review 후 RESOLUTION 첨부" 항목이 `[x]` 체크되었으나 RESOLUTION.md 없음 | `plan/in-progress/team-workspace-followups.md` §4 | 본 리뷰 결과로 `review/<timestamp>/RESOLUTION.md` 작성 후 plan 정리 |
| 6 | Performance | `ownershipButtons` 배열이 컴포넌트 inline 선언으로 매 렌더마다 새 객체 생성 (현재 규모에서 실질 영향 미미) | `page.tsx` L257–273 | 컴포넌트 외부 상수 또는 `useMemo`로 추출 |
| 7 | Testing | `ownership='all'` no-DB-hit 테스트가 `andWhere`에 created_by predicate 미추가도 함께 검증하지 않음 | `workflows.service.spec.ts` | `expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('created_by'), expect.anything())` 추가 |
| 8 | UX | `ownership` 상태가 URL에 반영되지 않아 새로고침·북마크 시 초기화됨. `search`·`filter`도 동일 패턴이므로 내부 일관성은 유지 | `page.tsx` L48 | 딥링크 요구사항 발생 시 별도 enhancement로 URL 직렬화 검토 |
| 9 | Security | 이중 방어 패턴 정상: 클라이언트는 개인 워크스페이스에서 파라미터 미전송, 서버는 수신해도 무시 | `page.tsx` L100–103, `workflows.service.ts` L86–97 | 현행 유지 |
| 10 | Concurrency | TOCTOU: `findById` 후 `workspace.type` 분기 사이 워크스페이스 타입이 변경될 이론적 가능성. 읽기 전용이므로 실질적 무결성 영향 없음 | `workflows.service.ts` — ownership 필터 블록 | 현행 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | MEDIUM | mock 누적으로 인한 false negative/positive 위험, 컨트롤러·DTO·예외 경로 테스트 누락 |
| Side Effect | MEDIUM | `WorkflowsModule` DI 등록 미확인(런타임 부트업 실패 위험), `findAll` 시그니처 변경 |
| Database | MEDIUM | `created_by` NULL 처리 누락, 복합 인덱스 부재 가능성 |
| Requirement | LOW | SQL NULL 누락, ownership 상태 미초기화, 빈 상태 메시지 미반영 |
| Dependency | LOW | 순환 의존성 잠재 위험, `package-lock.json` 변경 내용 미확인 |
| Architecture | LOW | cross-module 의존 추가, 추가 DB 쿼리 구조 |
| Documentation | LOW | 섹션 리넘버링 URL 안정성, MDX 링크 불일치, RESOLUTION 미첨부 |
| Maintainability | LOW | ownership 값 삼중 중복, 워크스페이스 전환 시 상태 미초기화 |
| Performance | LOW | `mine`/`shared` 경로 추가 DB 쿼리, 배열 매 렌더 재생성 |
| Scope | LOW | `registry.ts` 섹션 리넘버링 디렉터리 동기화 미확인 |
| API Contract | LOW | `mine`/`shared` 필터 사용 시 추가 DB 쿼리 (성능 관점) |
| Security | LOW | 신규 취약점 없음, 이중 방어 패턴 정상 확인 |
| Concurrency | LOW | TOCTOU 이론적 가능성 (읽기 전용이므로 실질 위험 없음) |

---

## 발견 없는 에이전트

모든 에이전트에서 최소 1건 이상의 발견사항이 보고되었다. Security 에이전트는 신규 취약점 없음을 확인하고 이중 방어 패턴 정상 동작을 긍정적으로 검증했다.

---

## 권장 조치사항

### 즉시 (Blocking)
1. **`WorkflowsModule` DI 등록 확인** — `workflows.module.ts`에 `WorkspacesModule` import가 없으면 앱 부트업 자체가 실패한다. 배포 전 반드시 확인.
2. **테스트 mock 격리 수정** — `workflows.service.spec.ts`의 `beforeEach`에 `jest.clearAllMocks()` 추가. CI 신뢰성에 직결.
3. **`shared` 필터 NULL 처리** — `w.created_by != :userId` → `(w.created_by != :userId OR w.created_by IS NULL)` 수정. 데이터 정합성 직결.

### 단기 (이번 PR 또는 즉시 후속 PR)
4. **빈 상태 메시지 `ownership` 조건 추가** — EmptyState 분기에 `(isTeamWorkspace && ownership !== "all")` 추가.
5. **워크스페이스 전환 시 `ownership` 리셋** — `useEffect(() => { setOwnership("all"); }, [currentWorkspaceId])` 추가.
6. **`registry.ts` 섹션 키 동기화 확인** — `frontend/src/content/docs/` 실제 디렉터리명이 레지스트리 키와 일치하는지 검증. 불일치 시 디렉터리 리네임 또는 리다이렉트 추가.
7. **컨트롤러·DTO 테스트 추가** — `@CurrentUser()` 추출 검증, `ownership=invalid` 400 케이스, `findById` 예외 전파 케이스.
8. **pagination 테스트 workspace store 초기화** — `useWorkspaceStore.setState(...)` 추가로 테스트 격리 보장.

### 중기 (별도 태스크)
9. **`(workspace_id, created_by)` 복합 인덱스 추가** — 팀 워크스페이스 규모 성장에 대비. `CREATE INDEX CONCURRENTLY`로 무중단 추가 가능.
10. **workspace type을 request context로 상위 이동** — `WorkflowsService`의 cross-module 의존 제거 및 `mine`/`shared` 경로 추가 DB 쿼리 해소.
11. **`ownership` DTO 값 단일 출처화** — `OWNERSHIP_VALUES as const` 상수화로 삼중 중복 제거.
12. **RESOLUTION.md 작성 및 plan 문서 정리** — 본 리뷰 결과 반영 후 완료된 항목은 `plan/complete/`로 `git mv`.