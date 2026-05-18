### 발견사항

- **[INFO]** `isCafe24RefreshCapable` 의 `credentials` JSON 필드 직접 캐스팅
  - 위치: `integration-expiry-scanner.service.ts` — `isCafe24RefreshCapable` 함수 (diff +277~+282)
  - 상세: `integration.credentials` 를 `Record<string, unknown>` 으로 캐스팅한 뒤 `refresh_token` 키를 직접 읽는다. 이 값은 TypeORM `jsonb` 컬럼에서 가져온 동적 데이터이므로 런타임 타입이 보장되지 않는다. 현재 `typeof rt === 'string' && rt.length > 0` 가드가 있어 실질적 위험은 낮지만, `credentials` 스키마가 묵시적이고 DB 레벨 검증이 없어 향후 컬럼 구조 변경 시 guard 누락 가능성이 있다.
  - 제안: `Cafe24Credentials` 같은 공유 타입으로 `credentials` 를 파싱하는 헬퍼를 단일화하고, 동일 패턴이 `tryRecoverExpired` 에도 중복(`cafe24-mcp-tool-provider.ts` diff +1167~+1173)되어 있으므로 공통 유틸로 추출하면 일관성이 높아진다.

- **[INFO]** `tryRecoverExpired` 내 순차적 외부 호출 2회 (refresh → re-read)
  - 위치: `cafe24-mcp-tool-provider.ts` — `tryRecoverExpired` 메서드 (diff +1175~+1208)
  - 상세: `refreshTokenViaQueue` 호출(BullMQ enqueue + wait) 후 `integrationsService.getForExecution` 으로 DB를 재조회한다. 이 재조회는 BullMQ worker 가 `connected` 상태로 갱신한 row 를 읽어야 하므로, worker 완료 직후 타이밍에 따라 DB replica lag 환경에서 여전히 stale row(`expired`)를 읽을 수 있다. 현재 코드는 이 경우 `expired_refresh_failed` 로 처리하며 다음 buildTools 호출에서 재시도한다 — 결과적으로 안전하나, replica lag 가 있는 프로덕션 환경에서 간헐적 false-skip 이 관측될 수 있다.
  - 제안: 재조회 시 primary(write) DB 커넥션을 강제하거나, 짧은 retry(예: 1~2회, 100ms 간격)를 추가하는 것을 고려한다. 또는 spec 주석처럼 "다음 buildTools 재시도" 정책을 명시적으로 로그에 남겨 운영 관측을 돕는다.

- **[INFO]** `integrationRepo.find` 쿼리의 인덱스 의존성 (기존 코드, 변경 영역 주변)
  - 위치: `integration-expiry-scanner.service.ts` — `run` 메서드의 `integrationRepo.find` (전체 파일 컨텍스트)
  - 상세: 이번 변경 자체는 쿼리를 추가하지 않는다. 그러나 `connected-expiry` pass 에서 `token_expires_at IS NOT NULL` / `status NOT IN (expired, error, pending_install)` 으로 조회 후, 새 분기에서 `service_type='cafe24'` 행을 인메모리로 필터한다. `service_type` 인덱스가 없다면 대용량 `integrations` 테이블에서 full scan 이 발생할 수 있다. 변경 코드 자체가 인덱스를 수정하지 않으므로 기존 성능 프로파일을 유지하지만, cafe24 행 비율이 높아지면 서버 측 필터(`WHERE service_type='cafe24'`)가 더 효율적이다.
  - 제안: `integration-expiry-scanner` 의 find 조건에 `serviceType: In(['cafe24'])` 같은 서버 측 조건을 추가하거나, `(status, service_type, token_expires_at)` 복합 인덱스를 검토한다. (현재 트래픽·데이터 규모에 따라 우선순위 결정)

### 요약

이번 변경은 DB 스키마 변경·마이그레이션·새 쿼리 추가 없이, 기존 `integrations` / `integration_expiry_dispatch` 테이블에서 읽어온 데이터에 분기 로직을 추가하는 서비스 레이어 수정이다. 트랜잭션 경계는 기존 BullMQ worker(`Cafe24TokenRefreshProcessor`)에 위임되어 있고, `jobId` dedup 을 통한 멀티 인스턴스 race 해소 패턴은 스펙 설계와 일치한다. DB 직접 관련 위험 요소는 `credentials` JSONB 캐스팅 중복과 replica lag 환경에서의 재조회 타이밍 이슈로 한정되며, 모두 INFO 수준이다. SQL 인젝션 위험은 없고, 커넥션 관리는 NestJS/TypeORM DI 구조 내에서 기존 방식 그대로다.

### 위험도
LOW
