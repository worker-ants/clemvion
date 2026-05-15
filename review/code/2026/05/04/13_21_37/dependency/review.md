### 발견사항

---

**[WARNING] `@modelcontextprotocol/sdk`가 사용하지 않는 서버 프레임워크 의존성을 대량 견인**
- 위치: `package-lock.json` — `node_modules/@modelcontextprotocol/sdk`
- 상세: 구현체(`mcp-client.service.ts`)는 `client/index.js`와 `client/streamableHttp.js`만 import하지만, SDK 패키지는 서버 기능용 의존성(`hono: 4.12.16`, `@hono/node-server: 1.19.14`, `express: ^5.2.1`, `express-rate-limit: 8.4.1`)을 production 의존성으로 포함한다. 이 패키지들은 런타임에 실제로 로드되지는 않지만 컨테이너 이미지 크기와 공급망(supply chain) 공격 표면을 수십 MB 늘린다.
- 제안: npm `overrides` 또는 `.npmrc`의 `ignore-scripts` 등으로 완화할 수는 없다. 공식 SDK를 사용하는 한 불가피한 trade-off임을 팀에 공유하고, CI에 `docker image size` 게이트를 추가해 향후 증가를 모니터링하는 것을 권장한다.

---

**[WARNING] `jose: 6.2.3`이 프로덕션 의존성으로 추가됨 — JWT 라이브러리 이중화**
- 위치: `package-lock.json` — `node_modules/jose`
- 상세: 프로젝트는 이미 `@nestjs/jwt`(내부적으로 `jsonwebtoken` 사용)를 통해 JWT를 처리한다. MCP SDK가 OAuth 2.1 지원을 위해 `jose: 6.2.3`을 끌어들이면서 JWT 구현체가 두 개가 된다. 현재 MCP 구현에서 OAuth auth_type은 지원하지 않으므로 `jose`는 사실상 미사용이다.
- 제안: 기능상 문제는 없으나, 향후 MCP OAuth 흐름 추가 시 `@nestjs/jwt`와 `jose` 중 하나를 일원화하는 방향을 검토하도록 TODO 주석 또는 스펙 노트로 남겨둘 것을 권장한다.

---

**[WARNING] `pkce-challenge: 5.0.1`이 production deps에 포함되나 현재 구현에서 미사용**
- 위치: `package-lock.json` — `node_modules/pkce-challenge`
- 상세: `McpConnectParams`의 `authType`은 `bearer_token`, `api_key`, `none`만 지원하며 OAuth/PKCE 흐름은 MVP 범위 밖(`spec/5-system/11-mcp-client.md §12`)이다. `pkce-challenge`는 실행 경로에 진입하지 않지만 설치된다.
- 제안: MCP SDK의 패키징 결정으로 제어 불가. 단, spec §12에 명시된 대로 OAuth 2.1 도입 전까지 해당 auth_type을 service-registry에서 제외한 현재 설계는 적절하다.

---

**[INFO] `ajv`, `ajv-formats`, `fast-deep-equal`, `fast-uri`, `require-from-string`이 devDependencies → dependencies로 이동**
- 위치: `package-lock.json` diff
- 상세: `@modelcontextprotocol/sdk`가 런타임에 이 패키지들을 의존하므로 `"dev": true` 플래그가 제거된 것은 npm의 올바른 resolution 동작이다. 변경 자체는 정확하다.
- 제안: 없음.

---

**[INFO] MCP SDK의 중첩 `ajv: 8.20.0` vs 루트 `ajv: 8.18.0` — 버전 분기**
- 위치: `node_modules/@modelcontextprotocol/sdk/node_modules/ajv`
- 상세: SDK가 자체 `ajv: 8.20.0` 사본을 중첩 설치한다. 루트의 `8.18.0`과 동시 존재하는 minor 버전 차이이므로 npm 중첩 resolution으로 안전하게 격리된다. 기능적 충돌 없음.
- 제안: 없음. `overrides`로 강제 통일할 수 있으나 SDK의 호환성 검증 없이 적용하면 역효과 가능.

---

**[INFO] `@modelcontextprotocol/sdk: ^1.29.0` caret 범위 — MCP 스펙이 활발히 진화 중**
- 위치: `package.json`
- 상세: MCP 프로토콜은 2024~2025년에 걸쳐 빠르게 개정 중이다. `^1.29.0`은 `1.x` 내 minor·patch 자동 수용을 허용한다. SDK가 transport API나 Client 인터페이스를 minor 버전에서 변경할 경우 `McpClientService`의 type assertion(`as Promise<...>`) 부분이 silent breaking point가 될 수 있다.
- 제안: CI에 `npm outdated` 또는 Dependabot을 설정하고, SDK 업그레이드 시 `mcp-client.service.spec.ts`의 전체 통과 여부를 반드시 확인한다. 현재 테스트 커버리지가 잘 갖춰져 있으므로 위험이 완화된다.

---

**[INFO] 라이선스 호환성**
- 상세: 신규 추가된 모든 패키지(`@modelcontextprotocol/sdk`, `hono`, `@hono/node-server`, `eventsource`, `eventsource-parser`, `express-rate-limit`, `jose`, `pkce-challenge`, `json-schema-typed`, `zod-to-json-schema`) 는 MIT 또는 BSD-2-Clause 라이선스. 프로젝트의 `UNLICENSED` private 패키지와 충돌 없음.

---

### 요약

이번 변경의 핵심은 `@modelcontextprotocol/sdk: ^1.29.0` 단일 패키지 추가이며, 이 자체는 기능적으로 정당하다. 주된 의존성 리스크는 SDK가 MCP 서버 호스팅 기능을 위해 포함하는 `hono`, `@hono/node-server`, `express: ^5`, `express-rate-limit` 등 서버 프레임워크 의존성이 클라이언트 전용 구현에서도 `node_modules`에 설치된다는 점이다. 이 패키지들은 실제로 import되지 않아 런타임 영향은 없지만 컨테이너 이미지 크기를 늘리고 공급망 공격 표면을 확대한다. 모든 신규 패키지의 라이선스는 MIT/BSD로 호환되며, 버전 충돌은 없고, `devDependencies → dependencies` 이동은 npm resolution의 올바른 반영이다. `pkce-challenge`·`jose` 등 현재 미사용 OAuth 관련 패키지들은 SDK 패키징 결정으로 제어 불가하며 스펙에 명시된 MVP 외 항목과 일치하므로 설계 의도에 부합한다.

### 위험도

**LOW**