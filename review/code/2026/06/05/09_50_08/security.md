# Security Review — AI Agent Memory Admin API + UI

리뷰 대상 diff: `git diff 9f30216f..HEAD`
리뷰 일시: 2026-06-05
리뷰어: security subagent

---

## INFO

### 1. `WorkspaceId` 데코레이터: X-Workspace-Id 헤더 우선 순위
- **위치**: `codebase/backend/src/common/decorators/workspace.decorator.ts` L14–15
- **문제**: `workspaceId` 를 결정할 때 `request.headers['x-workspace-id']` 헤더가 JWT `user.workspaceId` 보다 **우선**한다. `JwtAuthGuard` (전역 APP_GUARD) 가 먼저 실행되어 `req.user` 가 설정되므로 JWT 자체는 유효해야 한다. 그러나 JWT 에 workspaceId 가 포함되지 않은 구현(예: 단순 user sub 만 포함)이라면, 클라이언트가 임의 헤더를 전달해 다른 워크스페이스 컨텍스트로 전환할 여지가 있다.
- **근거**: 헤더 기반 컨텍스트 스위칭은 설계 의도(멀티-워크스페이스 클라이언트 지원)일 수 있다. 단, `RolesGuard` 도 동일한 헤더에서 workspaceId 를 읽어 `getMemberRole` 을 조회하므로, 유효한 JWT 소유자가 자신이 멤버인 다른 워크스페이스를 헤더로 명시하면 그 워크스페이스 데이터를 조회할 수 있다. **이는 의도된 동작이라 판단하나**, 헤더 허용 범위에 대한 명시적 검토가 권장된다.
- **제안**: JWT payload 에 workspaceId 를 포함해 헤더 의존성을 제거하거나, 헤더 허용 워크스페이스 목록을 사용자 멤버십으로 검증하는 미들웨어를 추가하는 것을 중기 과제로 등록할 것. 본 diff 의 신규 코드 자체는 기존 패턴을 따를 뿐 이 취약점을 신규 도입하지 않는다.

---

### 2. `listScopes` LIMIT/OFFSET 파라미터: SQL 리터럴 보간 패턴
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L521
- **문제**: `LIMIT ${q ? '$3' : '$2'} OFFSET ${q ? '$4' : '$3'}` — LIMIT/OFFSET 플레이스홀더 번호를 템플릿 리터럴로 동적으로 선택한다. 실제로 보간되는 값은 `'$3'`, `'$2'` 같은 **파라미터 레퍼런스 문자열**이며, 실제 사용자 데이터가 보간되지 않는다. 파라미터 배열의 `limit`/`offset` 값은 DTO 에서 `@IsInt @Min(1) @Max(100)` / `@Min(0)` 으로 검증된 정수이므로 SQL 인젝션 위험은 없다.
- **근거**: 코드 가독성 관점에서 조건 분기를 별도 쿼리 빌더 또는 상수로 추출하면 향후 유지보수 시 실수 위험을 낮출 수 있다.
- **제안**: 리뷰 차원의 메모. 인젝션 위험 없음.

---

### 3. `q` 검색어: ILIKE 와이드카드 페이로드 (ReDoS/성능)
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L507
- **문제**: `q` 는 `MaxLength(512)` 로만 제한되며 `%` 문자를 포함한 임의 패턴을 허용한다. `ILIKE '%user_input%'` 에 `%` 를 포함한 긴 패턴은 PostgreSQL full-scan 을 유발할 수 있다. SQL 인젝션은 파라미터 바인딩으로 완전 차단되어 있다.
- **근거**: 내부 admin surface + 인증된 워크스페이스 멤버만 접근하므로 DoS 위협 수위는 낮다. 그러나 과도한 ILIKE 패턴이 DB 부하를 높일 수 있다.
- **제안**: `q` 값에서 앞뒤 `%` 를 서버 측에서 제거하거나(이미 SQL 측에서 `'%' || $2 || '%'` 를 고정으로 붙이므로 사용자가 `%` 를 추가 전달해도 실효 없음), `scope_key` 컬럼에 트라이그램(pg_trgm) 인덱스 추가를 권장. 보안 위험은 LOW.

---

### 4. 응답 DTO — `metadata` 전체 누출 없음 확인
- **위치**: `codebase/backend/src/modules/agent-memory/dto/responses/agent-memory-response.dto.ts`, `agent-memory.service.ts` L489–496
- **문제**: SELECT 목록에 `embedding` 컬럼 및 `metadata` JSON 전체가 포함되지 않는다. `metadata->>'kind'` 만 추출한다. 임베딩 벡터 누출 없음 확인.
- **근거**: spec §6 "embedding 은 반환하지 않는다" 요건을 코드가 정확히 이행하고 있다.
- **제안**: 이상 없음.

---

### 5. 프론트엔드 삭제 버튼: RoleGate 는 UI 차단만
- **위치**: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` L1036, L1155
- **문제**: `<RoleGate minRole="editor">` 는 **UI 요소 렌더링 조건**이지 API 호출을 막지 않는다. 클라이언트에서 직접 DELETE 요청을 발행하면 서버 인가 계층을 통과해야 한다.
- **근거**: 서버 측에서 `@Roles('editor')` 가 `RolesGuard` 로 전역 APP_GUARD 등록되어 있으므로 실질적인 인가 강제는 백엔드에서 이루어진다. 프론트 RoleGate 는 UX 용도로만 사용되는 것이 표준 패턴이다. 보안 갭 없음.
- **제안**: 이상 없음.

---

### 6. 에러 응답: 민감 정보 노출 없음
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` L310–313
- **문제**: `NotFoundException` 메시지는 `'Agent memory not found'` — 내부 구조 노출 없음. `BadRequestException` 도 `'scopeKey query parameter is required'` 수준으로 제한.
- **근거**: 글로벌 `HttpExceptionFilter` 가 스택 트레이스를 차단하는 구조이므로 DB 에러 세부사항이 노출될 위험은 없다.
- **제안**: 이상 없음.

---

## 종합 평가

신규 Admin REST API(listScopes / listMemories / deleteMemory / clearScope)와 프론트엔드 화면은 보안 관점에서 전반적으로 견고하게 구현되었다. SQL 쿼리는 모든 사용자 입력(`workspaceId`, `scopeKey`, `q`, `kind`, `id`, `limit`, `offset`)을 파라미터 바인딩(`$1`, `$2`, …)으로 처리하여 SQL 인젝션 위험이 없다. 워크스페이스 격리는 모든 쿼리에 `workspace_id = $N` 조건을 강제하고, 단건 삭제 시 `WHERE id = $1 AND workspace_id = $2` 로 cross-workspace 삭제를 구조적으로 차단한다. 인가는 전역 APP_GUARD `RolesGuard` + `@Roles('editor')` 로 삭제 경로를 보호하며, `@WorkspaceId()` 는 항상 인증 컨텍스트에서만 workspaceId 를 주입한다. 임베딩 벡터는 조회 응답에서 완전히 제외된다. 하드코딩된 시크릿, 인증 우회, 커맨드 인젝션, XSS(React JSX 자동 이스케이프) 등의 취약점은 발견되지 않았다. `WorkspaceId` 데코레이터의 헤더 우선 순위 패턴은 기존 코드베이스 전반에 걸친 설계이며 이번 diff 가 신규 도입한 위험이 아니다.

BLOCK: NO
