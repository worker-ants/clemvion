# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/4-integration/1-http-request.md`
검토 일시: 2026-06-11

---

## 발견사항

### 요구사항 ID 충돌

target 문서는 자체 `id: http-request` 이외에 새로운 요구사항 ID를 부여하지 않는다. 문서 내 `D4`, `NF-SC-05`, `§105` 는 기존 결정·요구사항을 참조하는 레퍼런스이며 신규 부여가 아니다. 충돌 없음.

### 엔티티/타입명 충돌

target 문서가 참조하는 식별자(`httpRequestNodeConfigSchema`, `httpRequestNodeMetadata`, `http-request.schema.ts`, `http-safety.ts`, `sanitize-response-headers.util.ts`)는 기존에도 같은 의미로 사용 중이며, 신규 도입이 아니다. `assertSafeOutboundUrl` / `assertSafeOutboundHostResolved` 함수명도 `2-database-query.md` 에서 이미 동일 의미로 참조된다. 충돌 없음.

### API endpoint 충돌

target 문서는 새 API endpoint를 정의하지 않는다. 충돌 없음.

### 이벤트/메시지명 충돌

target 문서는 새 이벤트·큐·SSE 이름을 도입하지 않는다. 충돌 없음.

### 환경변수·설정키 충돌

- **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` — 기존에 이미 정의된 ENV var 이며 신규 도입이 아니다. target 문서는 해당 플래그가 `none`/`integration`/`custom` 전 인증 방식에 공통 적용됨을 명시하고, §105 블록에서 DB Query·Send Email 과의 공유를 재확인한다. 기존 `2-database-query.md`·`3-send-email.md`·`5-system/11-mcp-client.md` 가 모두 동일 플래그를 같은 의미로 참조하고 있어 충돌 없음. `MCP_ALLOW_INSECURE_URL`(별개 정책)과의 분리도 target 문서 §105 블록 및 `11-mcp-client.md` L139 에서 명시적으로 구분되어 있어 혼동 가능성 없음.

### 에러 코드 충돌

- **[INFO]** `HTTP_BLOCKED` — target 문서가 기존에도 사용하던 코드이며, `D4` 이후 throw → error 포트 전환으로 사용 범위가 확대되는 것이 변경 내용이다. `2-navigation/4-integration.md` L1122 및 `3-send-email.md` L218 이 이미 `HTTP_BLOCKED` 를 같은 의미(HTTP Request 의 SSRF 차단 코드)로 참조한다. 이름 자체의 의미 변경은 없으며 충돌 없음.
- `INTEGRATION_SERVICE_UNAVAILABLE` — target 문서의 §6 / §5.8 정의는 `2-database-query.md`, `4-cafe24.md`, `5-makeshop.md` 의 동일 코드 사용과 의미가 동일하다. 충돌 없음.
- `HTTP_SSRF_BLOCKED` — §5.8 에서 "종전 코드명 후보 `HTTP_SSRF_BLOCKED` 는 폐기, `HTTP_BLOCKED` 유지" 를 명시한다. 코드베이스·다른 spec 어디에도 `HTTP_SSRF_BLOCKED` 가 등장하지 않아 dead 식별자를 정리하는 것이며, 충돌 없음.

### 파일 경로 충돌

`spec/4-nodes/4-integration/1-http-request.md` 는 기존 파일이며 신규 파일 생성이 아니다. 컨벤션(`N-name.md` 패턴)에 부합하며 충돌 없음.

---

## 요약

target 문서(`spec/4-nodes/4-integration/1-http-request.md`)가 이번 개정에서 도입하는 식별자는 모두 기존에 동일 의미로 사용 중인 이름들이다. `ALLOW_PRIVATE_HOST_TARGETS` ENV var 의 적용 범위 확대(none/custom 포함)는 의미 변경이 아니라 기존 플래그의 enforcement 범위 명확화이며, 다른 노드 spec 들도 같은 플래그를 같은 의미로 참조하고 있어 충돌이 없다. `HTTP_BLOCKED` 에러 코드 역시 기존 이름이 그대로 유지된다. 신규 ENV var·요구사항 ID·엔티티 명·API endpoint·이벤트명이 도입되지 않으므로, 식별자 충돌 관점에서 우려 사항이 없다.

---

## 위험도

NONE
