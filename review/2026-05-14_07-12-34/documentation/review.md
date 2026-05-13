## Documentation Code Review — Cafe24 Integration

### 발견사항

---

**[INFO] `application.ts` 모듈 수준 JSDoc — 명명 충돌 경고 우수**
- 위치: `metadata/application.ts` 1–9행
- 상세: "Application" 리소스가 OAuth 앱 등록이나 프로젝트 내 Application 개념과 무관함을 명시한 경고 주석이 잘 작성됨. `spec/conventions/cafe24-api-metadata.md §1` 참조도 포함.
- 제안: 유지.

---

**[INFO] `Cafe24Module` JSDoc — 의존성 방향 설명 탁월**
- 위치: `cafe24.module.ts` 8–17행
- 상세: `nodes → modules` 단방향 의존 규약 위반을 막은 설계 근거가 모듈 JSDoc에 명확히 기술됨. 미래 개발자가 잘못된 방향으로 리팩토링하지 않도록 방지.
- 제안: 유지. 단, `spec/4-nodes/4-integration/4-cafe24.md §4.1 / §8.4` 링크가 외부 파일이므로 해당 spec 문서가 실제 존재하는지 확인 권장.

---

**[WARNING] `OAuthBeginDto` — Cafe24 전용 필드가 DTO 클래스에 혼재**
- 위치: `integration.dto.ts` 262–305행
- 상세: `mallId`, `appType`, `clientId`, `clientSecret`가 범용 `OAuthBeginDto`에 추가됨. 각 필드의 JSDoc/`@ApiPropertyOptional` 설명은 충분하나, 클래스 수준에서 "Cafe24 전용 필드는 §X 참조"와 같은 안내 주석이 없어 미래 다른 provider 필드 추가 시 패턴 혼란 유발 가능.
- 제안: `OAuthBeginDto` 클래스 상단에 `// Provider-specific extension fields start here — pattern: cafe24 (§3.2), future providers follow` 한 줄 추가.

---

**[WARNING] `mcp-capable-service-types.ts` — `MCP_CAPABLE_SERVICE_TYPES_LIST` 존재 이유 불충분**
- 위치: `mcp-capable-service-types.ts` 18–21행
- 상세: `MCP_CAPABLE_SERVICE_TYPES_LIST`의 "Mutable array form for query builders that demand `string[]`" 주석은 why가 아니라 what이다. 어떤 query builder가 `string[]`을 요구하는지, `as const`를 왜 사용할 수 없는지 설명이 없음.
- 제안:
  ```ts
  // TypeORM `In()` operator infers `string[]` and rejects `readonly string[]` at the call site.
  export const MCP_CAPABLE_SERVICE_TYPES_LIST: string[] = [
    ...MCP_CAPABLE_SERVICE_TYPES,
  ];
  ```

---

**[WARNING] `HandlerDependencies.cafe24ApiClient` — spec 링크가 주석에만 존재**
- 위치: `node-component.interface.ts` 273–275행
- 상세: `spec/4-nodes/4-integration/4-cafe24.md` 링크가 인터페이스 주석에 하드코딩됨. spec 파일 경로가 바뀌면 이 주석이 썩는다. 이미 알려진 위험이지만, `see ExecutionEngineService.registerHandlers` 식으로 코드 위치를 대신 참조하는 편이 안정적.
- 제안: 주석을 `/** Optional — wired by ExecutionEngineService; consumed only by cafe24 node and Cafe24McpToolProvider. */`로 단순화.

---

**[INFO] `integration-oauth.service.cafe24.spec.ts` — 테스트 의도 설명 충분**
- 위치: 전체 파일
- 상세: 각 describe 블록명이 테스트 대상 시나리오를 명확히 기술. `OAUTH_STUB_MODE` 환경변수 설정/해제 패턴이 반복되지만 주석 없이도 의도가 명확함.
- 제안: 유지.

---

**[INFO] `Cafe24ExtraFields` 컴포넌트 JSDoc — spec 참조 포함**
- 위치: `integrations/new/page.tsx` 586–591행
- 상세: `spec/2-navigation/4-integration.md §3.2` 참조와 설계 의도(같은 `credentials` 맵에 저장하는 이유)가 컴포넌트 JSDoc에 명시됨.
- 제안: 유지.

---

**[WARNING] `Cafe24Config` 컴포넌트 — Operation 필드에 드롭다운 없음, 문서만으로 유도**
- 위치: `integration-configs.tsx` 313–320행
- 상세: Operation 필드가 `ExpressionInput` (자유 텍스트)으로 구현되고, `hint`에 `spec/conventions/cafe24-api-metadata.md`를 참조하도록 안내함. 런타임에 유효하지 않은 operation id 입력 가능성이 있고, 사용자가 spec을 직접 찾아봐야 하는 UX 부담이 있음. 문서화 관점에서는 hint 텍스트가 지나치게 장황하며 실제 operation 목록 중 일부 예시만 제공해 오해 유발 가능.
- 제안: hint를 `"Operation id — e.g. product_list, order_get. Full list: Cafe24 node settings panel → Resource 선택 후 자동완성 예정"` 수준으로 축약하거나, 백엔드 메타데이터에서 operation 목록을 동적으로 조회하는 방향 고려.

---

**[WARNING] `normalizeCafe24Fields` 함수 — 두 개의 `shape`를 허용하는 이유가 인라인 주석과 함수 위에 모두 기술되어 중복**
- 위치: `integration-configs.tsx` 275–296행
- 상세: 함수 상단 블록 주석과 내부 인라인 주석이 같은 내용을 두 번 설명. "Accept both shapes so the panel doesn't crash on its second render" 설명이 반복됨.
- 제안: 함수 상단 주석만 남기고 내부 인라인 주석 제거.

---

**[INFO] `metadata/index.ts` — 새 엔드포인트 추가 절차 문서화 우수**
- 위치: `metadata/index.ts` 1–9행
- 상세: "Adding a new endpoint: refer to `spec/conventions/cafe24-api-metadata.md` §4 for the procedure (1 row in the matching resource file)" 안내가 모듈 JSDoc에 포함되어 기여자 가이드 역할을 충실히 수행.
- 제안: 유지.

---

**[INFO] `V041` 마이그레이션 파일 — SQL 주석 품질 탁월**
- 위치: `V041__integration_oauth_state_provider_meta.sql` 전체
- 상세: 마이그레이션 의도(Cafe24 OAuth state에 암호화된 provider_meta 저장), 암호화 방식(AES-256-GCM), TTL 정책, 기존 흐름(google/github) 무영향 여부가 모두 SQL 주석에 기술됨. `COMMENT ON COLUMN`까지 활용.
- 제안: 유지.

---

**[WARNING] 환경변수 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` — 문서화 누락**
- 위치: `integration-oauth.service.cafe24.spec.ts` 44–45행 (`process.env.CAFE24_CLIENT_ID = 'test-...'`)
- 상세: 테스트 파일에서 두 환경변수가 처음 등장. 실제 서비스 코드(`integration-oauth.service.ts`)에서도 사용될 것으로 보이나, `.env.example` 또는 `README`에 이 환경변수들이 추가되었는지 확인되지 않음.
- 제안: `.env.example`에 다음 항목 추가 여부 확인:
  ```
  # Cafe24 Public App credentials (required for app_type=public OAuth flows)
  CAFE24_CLIENT_ID=
  CAFE24_CLIENT_SECRET=
  ```

---

**[INFO] `Cafe24McpToolProvider` 등록 순서 — 코드 주석으로 설계 제약 명시**
- 위치: `ai-agent.component.ts` 25–29행
- 상세: "Cafe24 Internal Bridge MUST come BEFORE the external HTTP MCP provider" 이유와 `matches()` 우선순위 충돌 위험이 주석으로 명시됨. 순서 의존성이라는 비직관적 제약을 정확히 문서화.
- 제안: 유지.

---

### 요약

Cafe24 통합 PR의 문서화 수준은 전반적으로 높다. SQL 마이그레이션 주석, 모듈 JSDoc의 spec 참조, 설계 결정 근거(의존성 방향, 제공자 순서) 등이 잘 작성되어 있다. 주요 개선 포인트는 세 가지다: (1) 범용 `OAuthBeginDto`에 Cafe24 전용 필드가 추가되면서 패턴 안내 주석 미흡, (2) `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 환경변수가 `.env.example`이나 README에 등재되었는지 불확실, (3) `integration-configs.tsx`의 Operation 필드 hint가 지나치게 장황하거나 실제 값 목록 없이 spec 파일만 참조해 UX 관점의 문서 실효성이 낮다.

### 위험도

**LOW** — 기능 동작에 영향을 주는 문서 오류는 없으나, 환경변수 누락 문서화는 신규 개발자의 온보딩 장애로 이어질 수 있다.