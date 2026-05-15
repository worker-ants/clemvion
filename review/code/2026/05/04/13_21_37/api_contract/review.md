## 발견사항

- **[CRITICAL]** `previewTest` 응답 계약이 Spec과 불일치
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `adaptMcpTestResult()`
  - 상세: `spec/5-system/11-mcp-client.md §9`는 MCP 연결 테스트 성공 시 `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }`를 포함한 응답을 명시하지만, `adaptMcpTestResult()`는 `McpTestConnectionService.test()`가 반환한 이 모든 필드를 버리고 `{ success, message }`만 반환한다. 프론트엔드가 등록 UI의 capability 미리보기를 렌더링할 데이터가 API에서 전달되지 않는다. 코드 내 주석도 이를 명시적으로 인지하고 있으나 (`the public previewTest contract only returns { success, message }`) 이 설계 결정은 Spec의 약속을 깬다.
  - 제안: `previewTest` 반환 타입을 확장하거나, MCP에 한해 별도 응답 필드(`mcpResult`)를 추가하여 `capabilities`, `serverInfo`, `preview`를 포함시킨다.

- **[WARNING]** 오류 코드가 메시지 문자열에 임베딩됨
  - 위치: `integrations.service.ts` — `adaptMcpTestResult()` 실패 경로, `[MCP_AUTH_FAILED] bad token` 형태
  - 상세: 기존 서비스 타입의 오류는 순수 메시지 문자열이지만, MCP 실패만 `[CODE] message` 형식을 사용한다. 클라이언트가 오류 코드를 추출하려면 메시지를 파싱해야 하며, 이는 fragile한 계약이다. 서비스 타입 간 오류 응답 형식이 불일치한다.
  - 제안: 응답 타입에 `code?: string` 필드를 추가하고 `message`와 분리하거나, 기존 `previewTest` 계약이 고정이라면 적어도 Spec에서 이 변형을 명시적으로 문서화한다.

- **[WARNING]** SSRF 방어 미구현
  - 위치: `mcp-client.service.ts` — `requireHttpsUrl()` 메서드
  - 상세: `https://` 프로토콜만 검증하고 사설 IP 대역(`10.x.x.x`, `192.168.x.x`, `169.254.x.x`, `::1` 등)은 차단하지 않는다. `spec/5-system/11-mcp-client.md §3.2`는 "Spec API §SSRF 가이드와 동일하게 적용한다"고 명시하지만 구현이 이를 따르지 않는다.
  - 제안: URL 파싱 후 hostname을 검사하여 RFC 1918 및 링크-로컬 대역을 거부하는 SSRF 필터를 `requireHttpsUrl()`에 추가한다.

- **[INFO]** `McpConnectParams` 타입에서 런타임 필수 필드가 컴파일 타임에 선택적으로 선언됨
  - 위치: `mcp-client.service.ts` L14–28 — `token?`, `headerName?`, `value?` 필드
  - 상세: `bearer_token` 브랜치의 `token`은 없으면 `McpAuthError`를 던지지만 TypeScript 타입은 `optional`로 선언되어 있다. 타입 시스템이 계약을 완전히 표현하지 못하고, 잘못된 인자를 런타임에만 잡는다.
  - 제안: `token: string`(필수)으로 변경하거나, 검증 책임을 service-registry 레이어에 명확히 분리한다.

- **[INFO]** `auth_type: 'none'` 및 `service_type: 'mcp'` 추가는 하위 호환성을 유지함
  - 위치: `service-registry.ts`, `spec/1-data-model.md`
  - 상세: 두 필드 모두 String 컬럼이어서 DB 마이그레이션이 불필요하고, 기존 클라이언트가 모르는 값을 만났을 때 버그가 아닌 unknown 처리로 넘어가도록 설계되어 있다. 순수 추가적 변경이다.

---

## 요약

이번 변경은 MCP Integration을 기존 Integration 엔티티 모델에 확장하는 방식으로 구조적으로 잘 설계되어 있으나, API 계약 측면에서 핵심 갭이 하나 존재한다. `previewTest` 엔드포인트가 Spec §9에서 약속한 `capabilities` / `serverInfo` / `preview` 필드를 반환하지 않아 프론트엔드의 capability 미리보기 UI가 동작하지 않는다. 오류 코드를 메시지 문자열에 임베딩하는 패턴과 SSRF 방어 미구현도 향후 계약 안정성과 보안 측면에서 개선이 필요하다.

## 위험도

**MEDIUM**