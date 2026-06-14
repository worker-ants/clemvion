# Maintainability Review

## 발견사항

### **[INFO]** `pushConnectedSummary` 메서드 추출은 적절하나 메서드 javadoc이 §6.2 spec 태그에 의존함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1700-1711
- 상세: `/** §6.2 — 외부 MCP connected serverSummary push (toolCount = catalog 도구 수). */` 주석이 spec 절 번호에만 의존한다. spec 번호를 모르는 독자가 "§6.2" 만으로는 이 메서드가 무엇을 왜 push 하는지 즉각 이해하기 어렵다. 코드 자체는 단 4줄로 이미 충분히 명료하지만, 주석을 메서드 목적으로 보완하면 가독성이 높아진다.
- 제안: `/** Push a 'connected' serverSummary entry for the given entry to ctx.mcpDiagnostics (§6.2). toolCount = catalog tool count at connect time. */` 형태로 목적 문장을 앞에 두고 spec 태그를 보조로 배치.

---

### **[INFO]** `openServer`의 이중 try-catch 중첩이 의도를 다소 가린다
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1747-1829
- 상세: 변경 후 구조가 `outer-try(status check → connect → inner-try(listTools … return) catch(close session) → return) catch(push skipped summary + rethrow)`다. 내부 try는 "세션 누수 방지(close on listTools failure)", 외부 try는 "진단 push + rethrow"로 역할이 다르다. 이 두 목적이 주석으로 설명되어 있어 이해는 가능하지만, 중첩 깊이 4단계(메서드 본문 → outer-try → connect → inner-try)가 `openServer` 전체를 추적하는 인지 부담을 높인다.
- 제안: 당장 리팩터가 필요한 수준은 아니다(기존 구조를 최소 변경한 이번 PR 목표에 부합). 향후 `performConnect`(`status check + connect + listTools, throws on failure`) / `closeOnError` helper 등으로 분리하면 중첩 수준을 줄일 수 있다는 주석을 남겨두는 것을 고려.

---

### **[INFO]** `materializeServer`에서 재사용 세션 분기의 `pushConnectedSummary` 호출이 매 `buildTools` 호출 시 중복 push될 수 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1676-1681 (재사용 분기) 및 L1693-1696 (신규 연결 분기)
- 상세: `buildTools` 가 동일 `executionId`로 두 번 이상 호출되면(세션 캐시 테스트 케이스 "caches the session for reuse" 참조) 재사용 경로에서 `pushConnectedSummary`가 매번 실행된다. `pushMcpServerSummary` 함수가 중복 push를 방어하는지 여부가 이 코드만 보아서는 불명확하다. 함수 계약이 "중복 허용" 또는 "idempotent"인지가 `mcp-diagnostics.ts`에 있어야 호출부 독자가 별도 파일 없이 이해할 수 없다.
- 제안: `materializeServer` 의 재사용 분기 주석에 "diagnostics는 buildTools 호출마다 현 snapshot을 append — pushMcpServerSummary 가 dedup 담당" 같이 계약을 명시하거나, `pushMcpServerSummary` 시그니처/JSDoc에 idempotency/append 정책을 기술.

---

### **[INFO]** 테스트 케이스 이름에 spec 절 번호 접두(`§6.2`)와 자연어 설명이 혼용됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L271, L289 (추가된 두 it 블록)
- 상세: 기존 테스트는 `'connects via Integration credentials...'`, `'skips a tool not in enabledTools...'` 등 순수 기능 서술 방식이다. 신규 테스트는 `'§6.2 connect+list 성공 → connected serverSummary push (toolCount)'` 처럼 spec 절 번호를 prefix로 달아 스타일이 불일치한다. 기능 설명 자체는 명확하지만, 팀 내 컨벤션과 어긋나면 테스트 결과 출력에서 이질감이 생긴다.
- 제안: 기존 스타일(`'connect 성공 시 mcpDiagnostics에 connected serverSummary를 push한다'`)로 통일하거나, 팀이 spec 태그 style을 채택한다면 기존 테스트에도 소급 적용 여부를 결정한다.

---

### **[INFO]** `as unknown as Parameters<typeof provider.buildTools>[0]` 타입 단언이 두 테스트에 반복됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L278, L296
- 상세: `mcpDiagnostics` 필드가 `ProviderBuildCtx` 타입에 없거나 optional이어서 타입 단언이 필요한 것으로 보인다. 동일한 `as unknown as Parameters<typeof provider.buildTools>[0]` 패턴이 두 테스트에 복붙되어 있다. 타입이 업데이트되면 두 곳을 모두 바꿔야 한다.
- 제안: `ProviderBuildCtx`에 `mcpDiagnostics?: Array<Record<string, unknown>>` 필드가 있는지 확인하고, 있다면 단언 불필요 — 없다면 타입을 확장하거나 헬퍼 `buildCtx({...overrides})` 팩토리를 spec 파일 상단에 두어 단언을 한 곳에서 관리.

---

### **[INFO]** plan 파일의 구현 진척 노트가 두 위치(blockquote + 목록)에 중복 서술됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-mcp-client-gaps-5caaad/plan/in-progress/spec-sync-mcp-client-gaps.md` L10-20 (blockquote 요약) 및 L23 (`[x]` 완료 항목)
- 상세: blockquote의 "§6.2 외부 MCP serverSummaries push(항목 2) 구현" 설명과 `[x]` 완료 항목의 본문이 사실상 같은 내용을 두 번 서술한다. 계획 문서이므로 큰 문제는 아니지만, 향후 변경 시 두 곳을 동기화해야 하는 유지보수 부담이 생긴다.
- 제안: blockquote를 "완료 항목은 아래 `[x]` 체크로 표시됨" 정도의 한 줄 포인터로 줄이고, 상세 내용은 `[x]` 항목에 집중.

---

## 요약

변경 범위는 `McpToolProvider`에 `pushConnectedSummary` private 메서드를 추출하고, `openServer`의 실패 경로에 외부 try-catch를 덧씌워 skipped 진단을 push하는 최소 패치다. 코드 추가량이 적고, 추출된 메서드는 4줄로 단일 책임을 명확히 지킨다. `openServer`의 이중 try-catch 중첩이 인지 부담을 다소 높이지만 기존 구조를 최소 변경한 이번 PR의 목적에 부합하며 과도하지 않다. 테스트 스타일이 기존 파일과 미세하게 다르고, `mcpDiagnostics` 타입 단언이 두 테스트에 복붙된 점, 그리고 재사용 세션 분기의 `pushConnectedSummary` 중복 push 계약이 호출부에서 불명확한 점이 향후 확장 시 주의 포인트다. 전반적으로 유지보수성에 심각한 문제 없이 기존 코드베이스 스타일을 준수하는 변경이다.

## 위험도

LOW
