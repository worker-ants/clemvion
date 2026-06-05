# Testing Review — agent-memory admin UI (AGM-12/13)

**대상 diff**: `9f30216f..HEAD`
**리뷰 일시**: 2026-06-05
**파일 범위**: backend service/controller spec, frontend page.tsx, e2e

---

## CRITICAL

없음

---

## WARNING

### W-1: e2e 테스트 부재 — 신규 REST 엔드포인트 4개 (GET /scopes, GET /, DELETE /:id, DELETE /)
- **위치**: `codebase/backend/test/` — agent-memory 관련 파일 없음
- **상세**: `workspace-rbac.e2e-spec.ts` 등 기존 e2e 패턴 대비, `GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE /agent-memories/:id`, `DELETE /agent-memories` 엔드포인트 모두 실 DB + 인증 컨텍스트를 통한 통합 e2e 케이스가 없다. HTTP 레이어(ValidationPipe, ParseUUIDPipe, @WorkspaceId() 데코레이터, RolesGuard 실제 체인)는 단위 테스트로 커버되지 않는다. 특히 다음 경로가 누락:
  - `scopeKey` 미전달 → HTTP 400 (class-validator ValidationPipe 경로)
  - 비 UUID id로 DELETE → HTTP 400 (ParseUUIDPipe 경로)
  - viewer 계정으로 DELETE → HTTP 403 (RolesGuard 실 체인)
  - 크로스 워크스페이스 DELETE → HTTP 404 (실 DB 격리)
- **제안**: `codebase/backend/test/agent-memory-admin.e2e-spec.ts` 신규 작성. 최소 케이스: 정상 조회, viewer 403, 크로스 워크스페이스 404, scopeKey 누락 400, 비UUID id 400.

### W-2: `listScopes` / `listMemories` SQL — LIMIT/OFFSET 파라미터 바인딩 검증 누락 (kind + offset 조합)
- **위치**: `agent-memory.service.ts:521`, `agent-memory.service.ts:601`; `agent-memory.service.spec.ts:839-920`
- **상세**: `LIMIT ${limitParam} OFFSET ${offsetParam}` 패턴에서 `limitParam`/`offsetParam`은 파라미터 번호 문자열(`'$4'`, `'$5'`)로 인라인 삽입된다. kind 있는 경우의 실제 params 배열 순서(`[ws, scope, kind, limit, offset]`)가 인덱스와 일치하는지 — `kind` + `offset>0` 조합에서 `$4=limit`, `$5=offset`이 올바른지 — 단언하는 테스트가 없다. `kind` 있는 기존 테스트(line 886-900)에서는 `offset=0`만 사용해 offset 슬롯 오배치를 탐지하지 못한다.
- **제안**: `listMemories` 서비스 테스트에 `kind='fact'` + `offset=60` 조합 케이스 1건 추가 — `params.toEqual(['ws-1', 'cust-1', 'fact', 30, 60])` 형태로 명시 단언.

### W-3: `clearScope` 서비스 테스트 — 케이스 1건, 빈 결과 시나리오 미검증
- **위치**: `agent-memory.service.spec.ts:942-953`
- **상세**: `clearScope`는 서비스 레벨 테스트가 "2건 삭제" 단일 케이스만 있다. 0건 삭제(scope 내 메모리 없거나 다른 워크스페이스) 케이스가 없다. 스펙 주석("대상 없으면 0건 삭제")과 달리 서비스가 `result.length`를 반환하므로 0 반환도 가능한 경로인데 미테스트. 컨트롤러 spec에서도 `clearScope` 0건 반환 시 void 처리(에러 없음)를 단언하지 않는다.
- **제안**: 서비스 spec에 `clearScope` affected=0 케이스(빈 배열 반환 → `deleted === 0`) 추가. 컨트롤러 spec에 `service.clearScope.mockResolvedValue(0)` → `resolves.toBeUndefined()` 케이스 추가.

### W-4: 프론트엔드 `page.tsx` — 컴포넌트 테스트 전혀 없음
- **위치**: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` — 대응 `__tests__/*.test.tsx` 없음
- **상세**: `useInfiniteQuery` + `useMutation` 조합, RoleGate 표시/숨김, ConfirmModal 트리거, kindFilter 변경 시 쿼리 키 변경 등 UI 로직이 전혀 테스트되지 않는다. 기존 `components/llm-config/__tests__/`, `components/integrations/__tests__/` 등 컴포넌트 단위 테스트 패턴이 있어 일관성 위반이기도 하다. 특히 다음 분기는 회귀 테스트 없이 변경 시 발견하기 어렵다:
  - `selectedScope === null` → 빈 상태 UI (선택 유도 메시지)
  - clearScope 성공 후 `if (selectedScope === scopeKey) setSelectedScope(null)` 자동 해제
  - kindFilter 변경 시 `memoriesQuery.queryKey` 갱신
- **제안**: `codebase/frontend/src/app/(main)/agent-memory/__tests__/page.test.tsx` 작성. MSW 또는 React Query `QueryClient` mock으로 API 레이어를 대체하고 최소 케이스(빈 상태, scope 선택, 삭제 확인 모달, kindFilter 변경) 커버.

---

## INFO

### I-1: 컨트롤러 spec — `listMemories` scopeKey 미지정 경로 미테스트
- **위치**: `agent-memory.controller.spec.ts:99-132`
- **상세**: `scopeKey`가 빈 문자열/미전달인 경우는 class-validator(`@IsNotEmpty()`)가 ValidationPipe 레이어에서 차단하지만, 컨트롤러 단위 테스트는 ValidationPipe 없이 직접 생성자 주입하므로 이 경로를 테스트할 수 없다. 문서화된 400 동작이 컨트롤러 레벨에서 검증되지 않음을 명시적으로 주석 처리하거나 e2e에서 보완 필요.

### I-2: `looksLikeInstruction` 필터 — 서비스 테스트에 직접 케이스 없음
- **위치**: `agent-memory.service.ts:87-89`; `agent-memory.service.spec.ts` 전체
- **상세**: `saveMemories`에서 instruction-style content를 걸러내는 `looksLikeInstruction` 호출에 대한 테스트가 없다. "ignore all previous instructions" 같은 패턴이 실제로 필터링되는지 검증 안 됨. 현재 "빈 content 항목 걸러내기" 테스트(line 542)는 trim/empty만 커버. `looksLikeInstruction`은 `saveMemories` 외부에서 호출할 수 없는 private-inline 함수이므로 `saveMemories` 테스트에서만 커버 가능.

### I-3: `listScopes` 서비스 테스트 — q 공백 trim 분기 미검증
- **위치**: `agent-memory.service.ts:503`; `agent-memory.service.spec.ts:767-837`
- **상세**: 서비스에서 `opts.q?.trim()`을 하므로 공백만인 q는 filterSql이 빈 문자열이 된다. 이 분기(q 있지만 trim 후 falsy → ILIKE 필터 미적용)를 별도로 테스트하지 않는다. 실질적 위험 낮음.

### I-4: `agentMemoriesApi` 클라이언트 — 단위 테스트 없음
- **위치**: `codebase/frontend/src/lib/api/agent-memories.ts`
- **상세**: listScopes, listMemories, remove, clearScope 함수들의 응답 매핑(`totalItems`, `items` 등)에 대한 별도 테스트가 없다. 응답 shape 변경 시 무음 실패 위험. 우선순위 낮음.

---

## 요약

신규 admin API(AGM-12/13)의 서비스 레벨 단위 테스트는 SQL 파라미터 바인딩·격리·dedup·TTL 경로를 폭넓게 커버하며 품질이 높다. 컨트롤러 spec도 @Roles 메타데이터, offset→page 파생, affected=0 NotFoundException 등 핵심 흐름을 검증한다. 그러나 HTTP 레이어(ValidationPipe, ParseUUIDPipe, RolesGuard 실 체인)를 실 인프라에서 확인하는 e2e 테스트가 완전히 부재하며, 이는 기존 프로젝트의 `workspace-rbac.e2e-spec.ts` 등 e2e 패턴과의 일관성 위반이다. 프론트엔드 `page.tsx`도 컴포넌트 단위 테스트 관행에 맞지 않게 테스트 없이 추가됐다. 단위 수준 커버리지 갭(clearScope 빈 결과, kind+offset 조합, looksLikeInstruction)은 낮은 위험이지만 보완이 권장된다.

---

## 위험도

**MEDIUM**

기능 로직 단위 테스트는 충분하나 HTTP/인증/DB 통합 레이어 e2e 부재로 인해 실 인프라에서의 400/403/404 계약이 미검증 상태임. 특히 크로스 워크스페이스 격리(W-1)와 viewer 403(W-1)은 보안 관련 케이스로 e2e 검증이 권장된다.

---

BLOCK: NO
