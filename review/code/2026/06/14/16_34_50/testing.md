# Testing Review — spec-sync-602-followup

## 발견사항

### [INFO] DTO 메타데이터 변경은 테스트 영향 없음 — 커버리지 갭 없음
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 상세: `AuthConfigUsagePeriodCountsDto` 에 `type: Number` 추가, `AuthConfigUsageCallDto.sourceIp` 에 `type: String` 추가는 Swagger 메타데이터 전용 변경이다. 런타임 직렬화 동작에 영향을 주지 않으므로 별도 단위 테스트가 필요하지 않다.
- 제안: 현 상태 유지. DTO 형태는 `auth-configs.service.spec.ts` 의 `getUsage` describe 블록(라인 754~940)이 `periodCounts: { last24h: 2, last7d: 5, last30d: 7 }` 및 `sourceIp`/`responseCode` 값을 단언하며 간접 커버한다.

### [INFO] spec/1-data-model.md 인덱스 추가 — 마이그레이션 단위 테스트는 관례상 없음, 회귀 위험 없음
- 위치: `spec/1-data-model.md` 인덱스 테이블 신규 행 (`idx_execution_trigger_started`, V096)
- 상세: 마크다운 스펙 변경이므로 직접 테스트 대상이 아니다. 대응하는 마이그레이션 `V096__execution_source_ip_response_code.sql` 이 이미 존재하며(라인 35~37) `WHERE trigger_id IS NOT NULL` partial 인덱스가 정의돼 있다. 프로젝트 관례상 SQL 마이그레이션 자체의 단위 테스트는 없고, e2e 레벨에서 DB 스키마를 검증한다.
- 제안: 없음.

### [INFO] spec/5-system/12-webhook.md 처리 흐름 변경 — 단위/e2e 커버 확인됨
- 위치: `spec/5-system/12-webhook.md` §7 처리 흐름 스텝 7e·8b
- 상세: `ExecutionEngineService.execute(...)` 호출 시그니처에 `sourceIp`·`responseCode: '202'` 추가를 문서화한 변경이다. 대응 구현 커버 상태:
  - `hooks.service.spec.ts` 라인 194~195 — 기본 경로(IP 헤더 없음) `sourceIp: undefined, responseCode: '202'` 단언.
  - `hooks.service.spec.ts` 라인 199~220 — X-Forwarded-For 경로 `sourceIp: '198.51.100.9', responseCode: '202'` 단언.
  - `hooks.service.spec.ts` 라인 606~653 — chat-channel 분기 (W-12) 소스 IP 전달 단언.
  - CF-Connecting-IP TRUST 환경변수 분기 단언(라인 296~332).
- 제안: 없음. 단위 커버리지는 충분하다.

### [WARNING] e2e 레벨에서 `GET /api/auth-configs/:id/usage` 엔드포인트 커버리지 갭
- 위치: `codebase/backend/test/` (e2e 테스트 디렉터리)
- 상세: `webhook-trigger.e2e-spec.ts` 및 기타 e2e 파일 어디에도 `/usage` 엔드포인트가 호출되지 않는다 (`grep` 결과 0건). 단위 테스트(`auth-configs.service.spec.ts`)는 `getUsage` 서비스 로직을 충분히 커버하지만, 실제 DB 에 `source_ip`/`response_code` 컬럼(V096)이 올라간 상태에서 webhook 호출 → Execution 행 생성 → `/usage` 응답의 end-to-end 흐름을 검증하는 테스트가 없다. V096 이후 환경에서 `source_ip`/`response_code` 컬럼 매핑이 TypeORM Entity 에 올바르게 반영됐는지, 실제 쿼리가 기대한 값을 반환하는지 확인하지 못한다.
- 제안: `webhook-trigger.e2e-spec.ts` 또는 별도 `auth-configs.e2e-spec.ts` 에 다음 흐름을 추가한다: (1) webhook 호출로 Execution 생성, (2) `GET /api/auth-configs/:id/usage` 응답의 `recentCalls[0].sourceIp` · `recentCalls[0].responseCode` 검증. 우선순위: MEDIUM — V096 컬럼이 신규이므로 Entity 매핑 오류 시 서비스 레이어 목(mock)이 가려주기 때문.

### [INFO] `periodCounts` 문자열→숫자 파싱 회귀 안전
- 위치: `auth-configs.service.spec.ts` 라인 899~912
- 상세: `getRawOne` 이 null 을 반환할 때 `periodCounts` 가 `{ last24h: 0, last7d: 0, last30d: 0 }` 으로 폴백하는 케이스가 단언돼 있다. `AuthConfigUsagePeriodCountsDto` 의 `type: Number` 추가와 무관하게 서비스의 파싱 로직 회귀 테스트가 존재한다.
- 제안: 없음.

### [INFO] `responseCode` null → status enum 폴백 케이스 커버됨
- 위치: `auth-configs.service.spec.ts` 라인 886~889
- 상세: `responseCode: null` 인 비-HTTP 트리거(schedule) 행이 `recentCalls[1].responseCode` 에 `status` enum 값(`'failed'`)으로 폴백되는 것을 단언한다. DTO 의 `responseCode: string` non-null 약속과 서비스 폴백 로직의 정합성이 테스트에 명확히 드러난다.
- 제안: 없음.

## 요약

이번 변경은 크게 세 부분으로 구성된다: (1) DTO의 Swagger 메타데이터 보강(`type: Number`/`type: String` 추가), (2) 데이터 모델 스펙에 `idx_execution_trigger_started` partial 인덱스 행 추가, (3) Webhook 처리 흐름 스펙에 `sourceIp`·`responseCode` 전달 명문화. 런타임 동작을 변경하는 코드가 없으며 대응 단위 테스트(`auth-configs.service.spec.ts`의 `getUsage` describe, `hooks.service.spec.ts`의 §A.3 케이스들)는 이미 이 변경사항을 커버하고 있다. 다만 `GET /api/auth-configs/:id/usage` 엔드포인트에 대한 e2e 테스트가 전무해, V096에서 새로 추가된 `source_ip`/`response_code` DB 컬럼-Entity 매핑과 실제 쿼리 결과를 통합 수준에서 검증하지 못하는 갭이 존재한다. 이를 제외하면 테스트 격리·가독성·회귀 안전성은 양호하다.

## 위험도

LOW
