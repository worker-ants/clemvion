# Requirement Review: Agent Memory Admin UI (AGM-12/13, NAV-AM-01~06)

**diff**: `git diff 9f30216f..HEAD`
**worktree**: `.claude/worktrees/agent-memory-admin-ui-455467`
**spec 기준**: `spec/5-system/17-agent-memory.md §6` (AGM-12/13), `spec/2-navigation/16-agent-memory.md §2`, `spec/2-navigation/_product-overview.md §3.13` (NAV-AM-01~06)

---

## CRITICAL

없음.

---

## WARNING

### W1: 빈 상태 "설정 안내 링크" 미구현 (NAV-AM-06 / spec §2 부분 미충족)

- **위치**: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` L187–198
- **spec 인용**: `spec/2-navigation/16-agent-memory.md §2` — "persistent 메모리를 한 번도 쌓지 않은 워크스페이스는 '아직 메모리가 없습니다' 안내와 함께 AI Agent 노드 `memoryStrategy` 설정 안내 링크."
- **상세**: 빈 상태에서 `emptyHint` 는 단순 `<p>` 텍스트로 렌더링된다. spec이 명시한 "안내 링크"(클릭 가능한 링크 — 문서 `/docs` 경로 또는 AI Agent 노드 설정 화면으로의 앵커)가 없다. `agent-memory.en.mdx` / `agent-memory.mdx` 가이드 문서는 이미 존재하므로 링크 대상은 확보돼 있다.
- **제안**: `emptyHint` 를 `<p>` 대신 `<p>... <Link href="/docs/...">링크 텍스트</Link></p>` 형태로 교체하거나, 별도 링크 요소를 추가한다.

---

## INFO

### I1: `listMemories` 서비스에 empty scopeKey 방어 없음 — DTO 검증에 의존

- **위치**: `agent-memory.service.ts` L553 `listMemories`
- **상세**: 서비스 `listMemories`는 빈 scopeKey를 직접 막지 않고 DTO `@IsNotEmpty()` (컨트롤러 레이어) 에 전적으로 의존한다. `saveMemories`(L378)와 `recall`(L293)은 서비스 레벨에서 직접 빈값 방어를 갖추고 있어 관행이 일관되지 않다. 런타임 안전에 현재 문제는 없으나(GlobalValidationPipe가 먼저 400 처리), 서비스 직접 호출 테스트나 향후 리팩터 시 방어 누락이 될 수 있다.
- **제안**: `listMemories` 상단에 `if (!workspaceId || !scopeKey) return { items: [], total: 0 };` 방어 추가 고려.

### I2: 만료된 메모리(expires_at < now)가 admin 조회에 포함됨 — spec 침묵 영역

- **위치**: `agent-memory.service.ts` L553 `listMemories` SQL
- **상세**: `listMemories` SQL에는 `(expires_at IS NULL OR expires_at > now())` 필터가 없다. 따라서 TTL이 지난(이미 만료) 메모리도 admin 뷰에 표시된다. spec §6은 조회 응답 필드로 `expiresAt`을 노출하라고만 명시하며 만료 row를 admin 조회에서 제외하라는 요구는 없다. 회수(recall)에서만 만료 row를 제외한다 — 이는 관리자가 만료 임박/만료된 항목도 보고 수동 정리하는 시나리오에 합리적이다.
- **제안**: spec이 침묵한 영역으로 INFO 수준. 만료 row를 admin에서도 숨길지는 향후 명시적 요구사항으로 결정.

### I3: `listScopes` COUNT(*) 가 만료된 메모리를 포함

- **위치**: `agent-memory.service.ts` L509 `listScopes`
- **상세**: scope당 건수(COUNT(*))는 만료된 row를 포함한 전체 row 수를 센다. 반면 실제 recall 가능한 메모리 수는 그보다 적을 수 있다. spec §6은 "메모리 건수"라고만 명시하고 만료 row 포함 여부를 지정하지 않는다. 사용자에게 "12건"이라 보이지만 실제 활성 메모리는 더 적을 수 있어 혼란을 줄 수 있다.
- **제안**: spec 침묵 영역으로 현재는 INFO. 향후 spec에서 "활성 건수"로 명시할 경우 `WHERE expires_at IS NULL OR expires_at > now()` 추가 필요.

### I4: 사이드바 Agent Memory 항목이 role-filter 없이 전체 멤버에게 표시됨

- **위치**: `codebase/frontend/src/components/layout/sidebar.tsx` L123
- **상세**: `navItems` 배열에 `{ labelKey: "sidebar.agentMemory", href: "/agent-memory", icon: BrainCircuit }` 가 role 조건 없이 포함돼 있어, 워크스페이스 멤버 전원에게 사이드바 메뉴가 노출된다. spec NAV-AM-01 — "워크스페이스 멤버(viewer+)"이므로 이는 올바른 구현이다. 확인 사항으로만 기록.

### I5: expiresAt 표시가 이미 만료된 항목에 동일 스타일로 렌더링

- **위치**: `page.tsx` L334–338
- **상세**: `memory.expiresAt`이 과거 시각이어도 `timeAgo()`로 표기하며 동일한 빨간색(`text-[hsl(var(--destructive))]`)으로 표기된다. "만료 예정"이 아니라 "이미 만료됨"인 항목이 동일 표현(예: "3일 전 만료")으로 나타난다. spec §2는 "TTL 만료 예정(expiresAt) 표기"라고 하여 "예정" 포커스지만, 이미 만료된 row도 admin 뷰에서 조회된다면 구분 표시가 UX상 바람직할 수 있다. 기능 요구사항은 아님.

### I6: `listMemories` 컨트롤러에서 `scopeKey`를 `as string`으로 타입 캐스팅

- **위치**: `page.tsx` L80 `scopeKey: selectedScope as string`
- **상세**: `selectedScope`는 `string | null` 타입이지만 `enabled: selectedScope !== null` 조건으로 null 상태에서 쿼리가 실행되지 않으므로 런타임 안전에 문제없다. TypeScript 타입 안전성만의 이슈.

---

## 요약

AGM-12/13 (4 엔드포인트: GET scopes, GET memories, DELETE 단건, DELETE scope), NAV-AM-01~06 의 핵심 요구사항은 전반적으로 충실히 구현됐다. 백엔드 4 엔드포인트 모두 구현, embedding 제외, kind 필터, scopeKey 필수 검증, editor+ 게이팅(RoleGate + @Roles), workspace_id 격리, hard delete, 페이지네이션, 단건/scope 삭제 확인 모달(건수 경고 포함)이 spec과 일치한다. 빈 상태 안내 텍스트와 클릭 가능한 "설정 안내 링크"(spec §2 명시)가 단순 텍스트로만 구현된 점이 WARNING으로 기록된다.

---

## BLOCK: NO

WARNING 1건(빈 상태 안내 링크)은 기능 미완이지만 핵심 기능(조회·삭제·권한·격리)에 무관하며, 기존 텍스트 안내가 있어 운영 불능 수준이 아니므로 릴리스를 차단하지 않는다.
