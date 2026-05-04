## 발견사항

### [INFO] `ai-agent.handler.ts` — `processMultiTurnMessage` 메서드 분리
- **위치**: `ai-agent.handler.ts`, `processMultiTurnMessage` / `processMultiTurnMessageInner`
- **상세**: 기존 `processMultiTurnMessage`가 cleanup wrapper + inner 메서드로 분리되었습니다. 이 구조적 변경은 MCP 세션 cleanup 수행을 위해 **직접적으로 필요**한 리팩토링으로 over-engineering이 아닙니다. multi-turn `waiting_for_input` 경로에서도 cleanup이 실행되어야 하기 때문입니다.
- **제안**: 현재 구현 유지. 단, `processMultiTurnMessageInner`는 `private` 접근제어자가 명시되어 있어 외부 노출 우려 없음.

### [INFO] `mcp-tool-provider.ts` — `withTimeout` 중복 구현
- **위치**: `mcp-tool-provider.ts:142-160`
- **상세**: `McpTestConnectionService`와 동일한 `withTimeout` 헬퍼가 복사되어 있으며, 주석에 그 이유(향후 retry/abort 동작 분기 가능성)가 명시되어 있습니다. 현재 범위에서 허용되지만, 장기적으로는 공통 유틸리티로 추출 대상입니다.
- **제안**: 현재는 허용. follow-up 이슈로 추적 권장.

### [INFO] `execution-engine.service.spec.ts` — `McpClientService` mock의 최소화
- **위치**: `execution-engine.service.spec.ts:258-263`
- **상세**: `{ connect: jest.fn() }` 만 mock 처리되어 있습니다. `ExecutionEngineService`가 `mcpClientService`를 컨텍스트에 전달만 하고 직접 사용하지 않으므로 DI 충족 목적의 최소 mock으로 충분합니다.
- **제안**: 현재 구현 적절.

---

## 요약

총 14개 파일 변경은 모두 "AI Agent에 MCP Tools/Resources/Prompts 통합" 기능 범위 안에 있습니다. 백엔드 DI 연결(Module/Service/Context), 스키마 정의(`mcpServerRefSchema`), 핵심 Provider 구현(`McpToolProvider`), 핸들러 수명주기 관리(cleanup 패턴), 프론트엔드 UI 위젯(`McpServerSelector`)까지 하나의 기능 단위를 구성합니다. `ai-agent.handler.ts`의 `processMultiTurnMessage` 분리와 `execute()` 내 `try/finally` 추가는 MCP 세션 cleanup을 위해 필수적인 최소 구조 변경이며, 범위를 벗어난 무관한 수정은 없습니다.

## 위험도

**LOW**