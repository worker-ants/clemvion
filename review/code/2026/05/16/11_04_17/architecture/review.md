### 발견사항

- **[INFO]** 경고 메시지 문자열이 각 schema 파일에 직접 하드코딩됨 (분산된 단일 진실)
  - 위치: `backend/src/nodes/*/schema.ts` 26+ 파일, `backend/src/nodes/ai/llm-provider-rule.ts`
  - 상세: `llm-provider-rule.ts`에 `AI_NO_LLM_PROVIDER_MESSAGE` 같은 공유 상수가 이미 존재하여 일부 중복 방지 패턴을 보여주고 있다. 그러나 나머지 node-level warning 메시지들은 각 schema 파일의 `warningRules[].message` 에 리터럴 문자열로 분산되어 있고, 프론트엔드 `backend-labels.ts`에서 역매핑이 일어나는 구조다. English SoT 전환 자체는 올바른 방향이나, 메시지 문자열이 소스와 역매핑 양쪽에 중복 관리될 경우 장기적으로 typo나 매핑 누락이 발생할 여지가 있다.
  - 제안: `llm-provider-rule.ts`의 상수 패턴을 node 그룹 단위로 확장하거나, 공유 상수 모듈에 `nodeWarningMessages` 객체를 두고 각 schema가 import해서 참조하도록 하면 SoT가 단일 파일로 수렴된다. 현 규모에서는 즉시 변경 부담이 크므로 향후 message 변경 시 점진적 통합을 권장.

- **[INFO]** `OAuthBeginResultDto`가 두 분기(일반 OAuth / Cafe24 Private)를 단일 클래스로 표현하는 Union-in-class 패턴
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L299-347
  - 상세: 모든 필드가 `optional`로 선언되어 있고 `mode` 필드로 분기를 식별하는 구조다. 이는 타입 시스템에서 두 케이스를 구분하지 못해 컴파일 타임 안전성이 낮다. `mode === 'cafe24_private_pending'`일 때 `integrationId`, `appUrl`, `callbackUrl`이 반드시 있어야 함을 타입으로 보장할 수 없다.
  - 제안: NestJS/class-validator 생태계에서 discriminated union을 완전히 표현하기 어려운 제약이 있으므로 현 구조를 유지하되, Swagger 설명에 각 케이스별 필수 필드를 명시하는 현재의 접근은 적절하다. 향후 Cafe24 Private 분기 필드가 더 늘어난다면 별도 응답 DTO 클래스로 분리하고 `@ApiExtraModels` + `oneOf` Swagger 표현을 검토할 것.

- **[INFO]** `consecutive_network_failures` 카운터의 증가/리셋 책임이 `Cafe24ApiClient`에 직접 위임된 구조
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql` + `backend/src/modules/integrations/entities/integration.entity.ts` L369-382
  - 상세: API 클라이언트(네트워크 계층)가 도메인 상태(Integration 엔티티의 `consecutiveNetworkFailures`, `markStatus`) 를 직접 변경하는 구조다. 이는 네트워크/인프라 계층이 도메인 레이어의 책임을 지게 되어 레이어 책임 분리(레이어 아키텍처 관점)에서 경계가 다소 흐릿하다. 현 규모와 단방향 의존성(ApiClient → IntegrationRepository)을 감안하면 실용적 선택이지만 아키텍처적 주의가 필요하다.
  - 제안: 카운터 관련 로직을 `IntegrationNetworkHealthService`처럼 도메인 서비스에 캡슐화하고, `Cafe24ApiClient`는 실패/성공 이벤트를 던지거나 콜백으로 알리는 패턴을 고려할 수 있다. 현 구현이 단순하고 테스트 커버리지가 있는 상태라면 리팩터링은 선택적으로 판단.

- **[INFO]** `Cafe24TokenRefreshProcessor`의 상태 검증 로직 강화가 메서드 본문에 직접 인라인
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` L1250
  - 상세: `source` 조건을 제거하고 `connected` 상태에 한해 처리하도록 강화한 변경(CONC H-2)은 race-safe 설계를 위한 올바른 방향이다. BullMQ jobId dedup의 부수 효과를 처리하는 방어 코드가 주석으로 잘 문서화되어 있다. 이 로직은 processor 안에 명확하게 위치하고 있어 책임 분리 측면에서 문제없다.
  - 제안: 특이사항 없음. 현행 유지 적절.

- **[INFO]** `integration-expiry-scanner.service.ts`의 쿼리 조건이 서비스 레이어에 직접 인라인
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` L437-445, L457
  - 상세: TypeORM의 `Or(LessThan(cutoff), IsNull())` 조건과 `Not(In([...]))` 필터가 서비스 레이어에 직접 작성되어 있다. 데이터 접근 패턴이 서비스에 노출되는 구조로, Repository 패턴의 추상화가 충분히 활용되지 않고 있다. 다만 현재 코드베이스가 TypeORM Repository를 직접 inject하는 thin repository 방식을 일관적으로 사용하고 있으므로 이는 코드베이스 전반의 일관된 패턴이다.
  - 제안: 복잡한 쿼리 조건(`enqueueCafe24BackgroundRefresh`, `scanExpiringTokens`의 필터링 로직)은 커스텀 Repository 메서드로 추출하면 서비스 레이어가 도메인 로직에 집중할 수 있다. 현재는 주석이 충분히 의도를 설명하고 있어 긴급 변경 필요성은 낮다.

- **[INFO]** 노드 스키마 파일과 테스트 파일이 완전 대칭적으로 관리되고 있음 (긍정적 관찰)
  - 위치: `backend/src/nodes/` 하위 26+ 노드 모듈
  - 상세: 각 노드 디렉토리가 `*.schema.ts`, `*.schema.spec.ts`, `*.handler.ts`, `*.handler.spec.ts` 쌍으로 일관되게 구성되어 있다. 이 패턴은 테스트 커버리지와 파일 탐색성을 동시에 확보하는 좋은 모듈 경계 설계다. 이번 English SoT 전환도 schema+spec 쌍을 동시 변경하는 방식으로 일관성을 유지하고 있다.
  - 제안: 현행 유지 권장.

- **[INFO]** `node-config-summary.ts`가 `locale` 파라미터를 선택적으로 받아 프론트엔드 UI 레이어에서 번역을 적용하는 구조
  - 위치: `frontend/src/lib/utils/node-config-summary.ts` L62-L313, `frontend/src/lib/i18n/backend-labels.ts`
  - 상세: 백엔드에서 English 메시지를 SoT로 관리하고, 프론트엔드가 `translateBackendWarning()`로 locale별 번역을 적용하는 설계는 레이어 책임을 명확히 분리한 적절한 패턴이다. `DEFAULT_LOCALE` fallback도 있어 locale 미전달 시 영문 원본이 그대로 노출된다. `custom-node.tsx`에서 `useLocale()` 훅으로 locale을 주입하는 흐름도 React 관례에 맞다.
  - 제안: 현행 구조 유지. `translateBackendWarning`의 역매핑 테이블이 schema 파일의 메시지와 동기화가 깨지지 않도록 CI 에서 exhaustive 검증을 추가하면 장기 안전성이 높아진다.

- **[INFO]** 마이그레이션 V050에 `.conf` 파일로 `executeInTransaction=false` 별도 관리
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`, `backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql`
  - 상세: `CREATE INDEX CONCURRENTLY`는 트랜잭션 외부에서 실행해야 하므로 `.conf` 파일을 통해 Flyway 설정을 분리한 것은 올바른 접근이다. 마이그레이션 파일 쌍(.sql + .conf)이 명확한 네이밍으로 짝을 이루고 있어 혼동 여지가 없다.
  - 제안: 현행 유지 적절.

### 요약

이번 변경의 핵심 축은 세 가지다. (1) 26+ 노드 핸들러 경고 메시지의 English SoT 전환 — 각 schema 파일과 테스트 파일이 쌍으로 일관되게 변경되었으며 `translateBackendWarning` 역매핑을 통해 프론트엔드 다국어 표시를 유지하는 레이어 분리가 적절하다. (2) Cafe24 통합 강화 — `consecutive_network_failures` 카운터 추가(V049), 부분 인덱스(V050), `OAuthBeginResultDto` 분기 확장, `IntegrationExpiryScannerService` 쿼리 강화가 모두 spec 참조와 함께 명확하게 문서화되어 있다. (3) 동시성 안전성 개선 — `Cafe24TokenRefreshProcessor`의 source 무관 status 검증 강화(CONC H-2)는 BullMQ jobId dedup race를 올바르게 방어한다. 전반적으로 SOLID 원칙 중 단일 책임과 개방-폐쇄 원칙이 잘 지켜지고 있으며, 모듈 경계가 명확하다. API 클라이언트가 도메인 상태를 직접 변경하는 구조와 OAuthBeginResultDto의 union-in-class 패턴은 현 규모에서 실용적 선택으로 수용 가능하나, 장기 확장 시 도메인 서비스 위임 및 discriminated union DTO로의 진화를 권장한다.

### 위험도

LOW
