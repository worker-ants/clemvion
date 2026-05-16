# 보안(Security) 리뷰

세션: `review/code/2026/05/16/11_04_17`

---

### 발견사항

- **[WARNING]** `OAuthBeginResultDto` — state 필드가 optional 로 변경되어 CSRF 방어 의무가 느슨해짐
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `OAuthBeginResultDto.state?: string`
  - 상세: 기존에는 `state: string` (필수)였으므로 모든 OAuth 시작 응답에 CSRF 방지 토큰이 반드시 포함되었다. 이번 변경으로 `state?: string` (optional)로 바뀌었다. Cafe24 Private 분기에서는 state가 생략되는 것이 설계상 의도이나, 일반 흐름(google/github/cafe24 Public)에서도 DTO 타입 계층에서는 state 부재가 허용된다. 만약 서비스 레이어나 컨트롤러에서 분기 조건을 잘못 판단하여 일반 흐름에서 state 없이 authUrl만 반환하는 경우, 클라이언트가 state 부재를 에러로 처리하지 않으면 CSRF 공격에 노출될 수 있다. DTO 자체는 UI와 문서 목적의 타입이지만, 실제 서비스 응답 구성 로직이 분기 조건을 정확히 강제하는지 확인이 필요하다.
  - 제안: 일반 흐름(`mode !== 'cafe24_private_pending'`)에서 `state`와 `authorizeUrl`이 반드시 채워지도록 서비스 레이어에서 런타임 단언(assertion) 또는 타입 가드를 추가한다. 통합 테스트에서 일반 흐름 응답에 `state`가 항상 존재함을 명시적으로 검증하는 케이스를 추가한다.

- **[WARNING]** `sanitizeLastErrorMessage` 패턴 범위 — 새 마스킹 패턴이 추가되었으나 포괄성 점검 필요
  - 위치: `backend/src/modules/integrations/integration-oauth.service.spec.ts` — SEC-C2 테스트 블록 (lines ~491–512)
  - 상세: 이번 변경에서 `client-secret`, `secret:`, `access-token`, `refresh-token`, `api-key` 의 변형을 마스킹하는 패턴이 추가·테스트되었다. 이는 긍정적인 개선이다. 다만 Cafe24 OAuth 에러 응답에는 `client_secret`(언더스코어 형태) 나 `token` 단독 키워드, `bearer <token>` 형식의 인증 헤더가 에러 메시지에 포함될 수 있다. 현재 추가된 패턴이 하이픈 형태에만 집중되어 있어, 언더스코어 변형(`client_secret`, `access_token`, `refresh_token`)이 마스킹되는지 불명확하다.
  - 제안: `sanitizeLastErrorMessage` 의 기존 구현(diff에서 확인 불가)이 언더스코어 형태도 커버하는지 확인한다. 미커버 시 `access_token`, `refresh_token`, `client_secret` 패턴도 테스트 케이스로 추가하거나 구현에 반영한다.

- **[INFO]** `consecutiveNetworkFailures` 카운터 — 상태 전이 시 카운터 리셋의 원자성 확인 필요
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql`, `backend/src/modules/integrations/entities/integration.entity.ts`
  - 상세: 신규 컬럼 `consecutive_network_failures`는 3회 연속 실패 시 `status='error'` 로 전이하는 설계다. 마이그레이션 자체에는 보안 문제가 없다. 그러나 카운터 증가(`+1`)와 상태 전이(`markStatus('error', 'network')` + 카운터 리셋) 작업이 개별 DB 쓰기로 분리되는 경우, 동시 요청에서 카운터가 3을 초과하거나 상태 전이 없이 카운터만 리셋될 수 있다. 이는 의도적인 error 상태 전이를 우회하거나 반복적인 자동 복구를 허용할 수 있다.
  - 제안: 카운터 업데이트와 상태 전이가 단일 트랜잭션 또는 원자적 UPDATE(`UPDATE integration SET consecutive_network_failures = CASE WHEN ... END, status = CASE WHEN ... END WHERE id = $1`)로 처리됨을 서비스 코드에서 확인한다.

- **[INFO]** Cafe24 Token Refresh — 상태 검증 우회 레이스 패치 (긍정적 변경)
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (CONC H-2)
  - 상세: `source === 'background'` 조건부 검증에서 source 무관 검증으로 변경한 것은 BullMQ jobId dedup 레이스로 인한 reauthorize 흐름 우회 가능성을 차단하는 올바른 보안 강화다. 문제없음.
  - 제안: 없음.

- **[INFO]** Plaintext credentials 거부 — 암호화 invariant 강화 (긍정적 변경)
  - 위치: `backend/src/modules/integrations/integration-oauth.service.spec.ts` — SEC-C1/H-5 테스트 (lines ~523–543)
  - 상세: `enc:` prefix 없는 plaintext credentials를 `JSON.parse` 하여 통과시키던 legacy 경로를 `INTEGRATION_CREDENTIALS_INVALID` hard-fail로 변경한 것은 암호화 invariant를 강제하는 중요한 보안 개선이다. 테스트도 명확하게 작성되었다.
  - 제안: 없음.

- **[INFO]** `pending_install` 상태 만료 알림 필터 추가 (긍정적 변경)
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `status: Not(In(['expired', 'error', 'pending_install']))`
  - 상세: `pending_install` 상태의 통합을 만료 알림 대상에서 명시 제외한 것은 REQ-C1에 따른 방어적 처리로 적절하다. 엣지 케이스(tokenExpiresAt이 의도치 않게 보존된 경우)에서 잘못된 만료 알림 또는 자동 처리가 발생하지 않도록 한다. 문제없음.
  - 제안: 없음.

- **[INFO]** `lastRotatedAt` NULL 초기화 이슈 수정 — 신규 통합 background refresh 누락 방지
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `lastRotatedAt: new Date()`
  - 상세: `lastRotatedAt = null`로 저장 시 background refresh에서 영원히 제외되어 refresh_token이 만료될 수 있었던 회귀가 수정되었다. 직접적인 보안 취약점은 아니지만, refresh_token 만료 방치는 OAuth 흐름의 연속성을 깨뜨려 의도치 않은 `expired` 상태로 이어질 수 있다. 수정 방향은 올바르다.
  - 제안: 없음.

- **[INFO]** SQL 마이그레이션 (V049, V050) — 인젝션 취약점 없음
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql`, `backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql`
  - 상세: 두 마이그레이션 모두 DDL 전용(`ALTER TABLE`, `CREATE INDEX CONCURRENTLY`)이며 사용자 입력을 직접 포함하지 않는다. SQL 인젝션 위험 없음. `CONCURRENTLY` 옵션으로 zero-downtime을 보장한다.
  - 제안: 없음.

- **[INFO]** 경고 메시지 영문 전환 — 보안 관련 정보 노출 없음
  - 위치: 파일 20~94 (각종 schema.ts / schema.spec.ts 한→영 메시지 전환)
  - 상세: 노드 설정 검증 메시지를 한국어에서 영문으로 전환한 변경들이다. 에러 메시지에 내부 경로, DB 스키마, 토큰, 인증 정보 등 민감한 정보가 노출되는 내용은 없다. 메시지 내용은 설정 누락을 알리는 UI 힌트로 적절한 수준이다.
  - 제안: 없음.

- **[INFO]** `aria-label` i18n 추가 (`shared.tsx`) — 보안 관련 없음
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx`
  - 상세: 버튼에 접근성 레이블을 추가하는 변경으로 XSS 등 보안 관점에서 문제 없음. `t("editor.sharedRemoveRow")`는 번역 키를 통해 렌더되므로 사용자 제공 데이터가 아니다.
  - 제안: 없음.

---

### 요약

이번 변경의 핵심 보안 관련 항목을 종합하면 다음과 같다. 가장 주의가 필요한 사항은 `OAuthBeginResultDto.state` 가 optional 로 변경된 점으로, CSRF 방지 토큰이 일반 OAuth 흐름에서도 타입 수준에서 생략 가능해졌다. 서비스/컨트롤러 레이어에서 분기 조건이 정확히 강제되고 있는지 확인이 필요하다. `sanitizeLastErrorMessage` 에 새 마스킹 패턴이 추가된 것과 plaintext credentials hard-fail 전환, reauthorize 흐름 우회 레이스 패치, `pending_install` 만료 필터 추가는 모두 올바른 보안 강화 방향이다. DB 마이그레이션에는 SQL 인젝션 위험이 없으며, 대규모 경고 메시지 영문 전환에서도 민감 정보 노출 문제는 발견되지 않았다.

---

### 위험도

LOW
