## 발견사항

---

### [WARNING] Express v5가 MCP SDK 트랜지티브 의존성으로 설치됨
- **위치**: `package-lock.json` — `node_modules/@modelcontextprotocol/sdk` dependencies
- **상세**: MCP SDK는 `express: ^5.2.1`을 의존하지만, NestJS는 `@nestjs/platform-express`를 통해 Express v4 계열을 기대한다. npm은 두 버전을 병렬 설치하며, 현재 코드는 클라이언트 transport 경로(`client/index.js`, `client/streamableHttp.js`)만 import하므로 런타임 충돌은 없다. 그러나 MCP SDK의 서버 기능(hono, express-rate-limit 등)이 프로덕션 node_modules에 포함되어 공격 표면과 디스크 사용량이 불필요하게 증가한다.
- **제안**: 필요 시 `package.json`의 `overrides` 섹션에 `"express": "^4"` 고정 추가를 검토한다. 또는 장기적으로 MCP SDK의 클라이언트 모듈만 별도 경량 패키지로 분리된 버전이 나오면 교체한다.

---

### [WARNING] SSRF 방어 미구현 — URL 검증이 HTTPS 프로토콜 체크에서 멈춤
- **위치**: `mcp-client.service.ts` — `requireHttpsUrl()` (라인 ~166–175)
- **상세**: `https://` 프로토콜만 강제하지만 `127.0.0.1`, `169.254.x.x`, `10.x.x.x`, `172.16–31.x.x` 등 내부 주소를 차단하지 않는다. spec의 §3.2에서 "사내 IP / localhost 차단 정책은 Spec API §SSRF 가이드와 동일하게 적용"이라고 명시하나 구현이 없다. 공격자가 임의 MCP URL을 등록해 내부 서비스를 탐색할 수 있다(SSRF 프리미티브).
- **제안**: `requireHttpsUrl()` 내에서 parsed URL의 hostname을 DNS resolve 후 block-list(RFC 1918, 링크-로컬, loopback) 검사 로직을 추가한다.

```typescript
// 예시
const resolved = await dns.promises.lookup(parsed.hostname);
if (isPrivateIp(resolved.address)) throw new McpHttpsRequiredError(raw);
```

---

### [WARNING] `MCP_INITIALIZE_FAILED` 코드가 선언되었으나 실제로 발급되지 않음
- **위치**: `mcp-test-connection.service.ts` — `McpFailureCode` 타입 (라인 ~36) / `classifyConnectError()` (라인 ~75–93)
- **상세**: `McpFailureCode`에 `'MCP_INITIALIZE_FAILED'`가 선언되어 있지만, `McpClientService.connect()`는 initialize 실패를 별도 에러 타입으로 구분하지 않는다. `initialize` RPC 실패는 `McpHttpsRequiredError`·`McpAuthError`가 아닌 일반 Error로 throw되어 `classifyConnectError`에서 `MCP_CONNECT_FAILED`로 분류된다. 사용자·모니터링 시스템에 잘못된 에러 코드 vocabulary가 노출된다.
- **제안**: `McpClientService.connect()` 내에서 `client.connect(transport)` 이후 `McpInitializeFailedError`를 별도로 catch-rethrow하거나, 해당 코드를 제거하고 spec §8.2를 업데이트한다.

---

### [WARNING] `IntegrationsService` 생성자 시그니처 변경 — 테스트 외 수동 인스턴스화 위험
- **위치**: `integrations.service.ts` — 라인 ~68, `integrations.service.spec.ts` — 라인 ~129
- **상세**: `IntegrationsService` 생성자에 `McpTestConnectionService` 파라미터가 추가되었다. NestJS DI 컨텍스트에서는 자동 주입이므로 문제없으나, spec.ts 외 다른 테스트에서 `new IntegrationsService(...)` 형태로 직접 생성하는 코드가 있을 경우 컴파일 오류 또는 런타임 오류가 발생한다. 또한 `dispatchTest`가 `mcp` 서비스 타입에 대해 처음으로 **실제 외부 네트워크 호출**을 수행하는 변경이 있는데, 이는 `previewTest` 엔드포인트의 동작을 근본적으로 바꾼다(기존: 구조 검증만, 변경 후: mcp는 transport probe 포함).
- **제안**: 변경 후 테스트 실행(`npm test`)으로 미처리 호출지 확인 필요. 또한 `previewTest` API 문서/클라이언트에 mcp 타입의 응답 시간이 늘 수 있음을 명시한다.

---

### [INFO] dev→prod으로 승격된 패키지들 (의도된 부작용)
- **위치**: `package-lock.json` — `ajv`, `ajv-formats`, `fast-deep-equal`, `fast-uri`, `json-schema-traverse`, `require-from-string`, `uglify-js`
- **상세**: MCP SDK의 의존성과 겹치면서 이들 패키지가 `"dev": true` 태그 없이 재등록되었다. 런타임 영향은 없으나 프로덕션 번들 크기가 증가하고, npm audit의 dev/prod 취약성 분류가 달라질 수 있다. `uglify-js`는 `optional: true`이므로 영향 미미.

---

### [INFO] `@nestjs-modules/mailer`의 선택적 피어 의존성 제거 (자동 중복 제거)
- **위치**: `package-lock.json` — `chokidar`, `glob-parent`, `readdirp` 제거
- **상세**: 이들은 `optional: true, peer: true` 였으므로 npm이 중복 제거 과정에서 상위 버전으로 호이스팅했다. 실제 코드 동작에는 영향이 없다.

---

### [INFO] `SessionImpl.close()` 오류 묵시적 억제
- **위치**: `mcp-client.service.ts` — `SessionImpl.close()` (라인 ~277–285)
- **상세**: close 실패 시 warn 로그만 남기고 에러를 삼킨다. spec §8.1의 "best-effort close" 원칙에 부합하지만, 연결 풀 소진 시나리오에서 디버깅을 어렵게 만들 수 있다. `MCP_MAX_CONCURRENT_CONNECTIONS` 상한이 있으므로 허용 가능한 트레이드오프다.

---

## 요약

이번 변경은 MCP Foundation 레이어를 기존 Integrations 모듈에 결합하는 작업으로, NestJS DI 패턴을 올바르게 따르고 있으며 기존 인터페이스에 대한 파괴적 변경은 없다. 주요 부작용 위험은 두 가지다: (1) `previewTest`가 `mcp` 타입에 대해 처음으로 실제 외부 네트워크를 호출하게 되었으나 SSRF 방어가 spec 수준에만 선언되고 코드에 반영되지 않은 점, (2) MCP SDK가 Express v5·hono 등 서버 사이드 프레임워크를 트랜지티브 의존성으로 끌어들여 불필요한 공격 표면이 추가된 점. `MCP_INITIALIZE_FAILED` 코드가 발급되지 않는 vocabulary 불일치는 사용자 노출 에러 메시지의 신뢰성을 낮춘다.

## 위험도

**MEDIUM** — SSRF 방어 미구현이 핵심 위험이며, 나머지는 코드 품질/관리성 수준의 문제다.