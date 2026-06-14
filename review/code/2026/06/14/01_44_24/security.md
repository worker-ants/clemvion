# Security Review

## 발견사항

### [INFO] 테스트 픽스처 내 더미 자격증명 (정상)
- 위치: `mcp-tool-provider.spec.ts` L102–105 (`makeIntegration()`)
- 상세: `credentials: { url: 'https://mcp.example.com', token: 'tok' }` 가 테스트 헬퍼에 하드코딩되어 있음. `'tok'` 은 의도된 더미값이며 실 시크릿이 아님. `example.com` 도메인은 RFC 2606 예약 도메인으로 프로덕션 노출 가능성 없음.
- 제안: 현 상태 유지 가능. 단, CI에서 secret-scanning 패턴이 단어 `token` 을 기준으로 스캔할 경우 false-positive 우려가 있으면 값을 `PLACEHOLDER` 등으로 변경하는 것을 고려.

### [INFO] `skipped` 진단 push 시 에러 원인 메시지 미포함 (의도된 설계)
- 위치: `mcp-tool-provider.ts` L1118–1127 (`openServer` catch 블록)
- 상세: 외부 MCP connect/list 실패 시 `pushMcpServerSummary`에 `skipReason: 'error'` 만 push하고 구체적인 에러 메시지는 포함하지 않는다. 에러 세부사항은 `McpToolProvider.logger.warn`(L1444–1449)에서 서버 측 로그로만 남긴다. 이는 클라이언트 응답(`meta.mcpDiagnostics`)에 내부 에러 스택·SDK 메시지를 노출하지 않으려는 의도적 설계로 보이며 보안 관점에서 올바른 방향이다.
- 제안: 현 설계를 명시적으로 주석에 기록해 두면 추후 `errors[]` 필드 도입 시 실수로 raw error 메시지를 클라이언트에 노출하는 것을 방지할 수 있음. `sanitizeMcpErrorMessage`가 이미 존재하므로 `errors[]` 도입 시 해당 함수를 경유하도록 강제하는 것을 권장.

### [INFO] `MCP_ALLOW_INSECURE_URL` 우회 경로의 URL 검증 누락 범위
- 위치: `mcp-tool-provider.ts` L1305–1323 (`assertHttpsUrl`)
- 상세: `MCP_ALLOW_INSECURE_URL=true` 시 `http://` URL을 허용하지만 SSRF 호스트 블록리스트 우회는 이 함수 수준이 아닌 `McpClientService` 수준에서 처리된다. `assertHttpsUrl`은 protocol 체크만 하므로 `http://127.0.0.1/` 같은 URL이 여기서는 통과된다. spec §3.2에 "escape hatch는 절대 운영 환경 비활성화 + production에서 부팅 거부(`assertProductionConfig`)" 가 명시되어 있어 방어 레이어가 존재하나, provider 레이어 자체에서 SSRF 체크를 재수행하지는 않는다.
- 제안: 현행 defense-in-depth 구조(provider protocol check + client SSRF check + production boot guard) 는 합리적이며 즉각적 취약점은 아님. 다만 `assertHttpsUrl` 함수 주석에 "SSRF 호스트 블록리스트는 McpClientService 레이어에서 이중 수행됨"을 명기하면 독립적 코드 리뷰 시 오해를 줄일 수 있음.

### [INFO] `inputSchema: unknown` 의 LLM 전달 — 스키마 검증 없음
- 위치: `mcp-tool-provider.ts` L1797–1798, L1862
- 상세: MCP 서버가 `tools/list`에서 반환한 `inputSchema` 를 타입 검사 없이 `unknown`으로 저장한 후 `parameters: (def.inputSchema as Record<string, unknown>)` 캐스팅으로 LLM에 그대로 전달한다. 악의적이거나 비정상 MCP 서버가 `inputSchema`에 거대 객체, 순환 참조, 또는 JSON Schema injection 페이로드를 삽입할 경우 LLM API 요청 페이로드가 오염될 수 있다.
- 제안: 신뢰하지 않는 MCP 서버에서 수신한 `inputSchema`에 대해 최소한 타입(`type === 'object'`), 깊이 제한, 최대 크기 검증을 수행하거나, `JSON.stringify` → `JSON.parse` 사이클로 순환 참조를 제거하는 것을 권장. 단, 이 변경은 현재 diff 범위 밖의 기존 코드 경로이므로 이번 PR이 아닌 후속 이슈로 트래킹 권장.

### [INFO] `reuse session` 경로의 진단 중복 push 가능성
- 위치: `mcp-tool-provider.ts` L1676–1681 (`materializeServer`, 재사용 세션 분기)
- 상세: 이번 변경에서 추가된 로직으로, 캐시된 세션이 `sessions.get(ref.integrationId)` 에서 히트하면 `pushConnectedSummary`를 호출한다. 동일 `buildTools` 호출 내에서 같은 `integrationId`가 `mcpServers` 배열에 중복 등록된 경우, 두 번째 항목은 이미 `sessions`에 존재하므로 재사용 분기로 진입하여 `mcpDiagnostics`에 동일 `integrationId`에 대한 `connected` 항목이 두 번 push된다. 보안 취약점이 아니나 진단 데이터 신뢰성 문제로 연결될 수 있다.
- 제안: `pushMcpServerSummary` 내부 또는 `pushConnectedSummary` 호출 전에 같은 `integrationId`에 대한 summary가 이미 존재하는지 de-dup 체크를 추가하는 것을 권장. 또는 `mcpServers` 배열에서 중복 `integrationId` 를 `parseRefs` 단계에서 제거.

---

## 요약

이번 변경(`§6.2 McpToolProvider diagnostics push`)은 보안 관점에서 전반적으로 안전하다. 기존의 핵심 보안 제어(HTTPS 강제·SSRF 방어·authType 화이트리스트·credential 검증·에러 메시지 sanitization·MCP 응답 크기 제한·세션 격리)는 모두 이번 변경으로 약화되지 않았으며, 추가된 코드(`pushConnectedSummary`·`openServer` catch 내 skipped push)는 단순 진단 배열 push만 수행하고 인증·인가·입력 검증 경로를 변경하지 않는다. 테스트 파일의 더미 자격증명은 RFC 2606 예약 도메인과 명확한 placeholder 값을 사용하며 실 시크릿 하드코딩이 아니다. 신규 발견된 보안 우려사항은 없고, 기존 코드 경로에서 관찰된 `inputSchema` 미검증 및 진단 중복 push 가능성은 이번 PR 범위 밖의 후속 이슈로 트래킹을 권장한다.

## 위험도

NONE
