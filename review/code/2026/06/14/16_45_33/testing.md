# Testing Review — spec-sync-602-followup (fresh re-review)

## 발견사항

### [INFO] DTO Swagger 메타데이터 변경 — 테스트 영향 없음
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 상세: `AuthConfigUsagePeriodCountsDto` 의 `last24h`/`last7d`/`last30d` 에 `type: Number` 추가, `last24h` description 에 "(캘린더 일 경계 아님)" 추가, `AuthConfigUsageCallDto.sourceIp` 에 `type: String` 추가, `responseCode` 에 `type: String` 추가는 모두 Swagger 메타데이터 전용 변경이다. 런타임 직렬화 동작을 변경하지 않으므로 별도 단위 테스트 추가 불필요. `auth-configs.service.spec.ts` 의 `getUsage` describe 블록(라인 754~940)이 `periodCounts: { last24h: 2, last7d: 5, last30d: 7 }` 및 `sourceIp`/`responseCode` 값을 단언하며 DTO 형태를 간접 커버한다.
- 제안: 현 상태 유지.

### [INFO] spec/1-data-model.md 인덱스 행 추가 — 테스트 대상 아님
- 위치: `spec/1-data-model.md` 인덱스 테이블 신규 행 (`idx_execution_trigger_started`, V096)
- 상세: 마크다운 스펙 변경이므로 직접 테스트 대상이 아니다. 대응하는 마이그레이션 `V096__execution_source_ip_response_code.sql` 이 이미 존재한다. 프로젝트 관례상 SQL 마이그레이션 자체의 단위 테스트는 없고 e2e 레벨에서 DB 스키마를 간접 검증한다. 이번 diff 에서 인덱스 코드 자체는 변경되지 않았다.
- 제안: 없음.

### [INFO] spec/5-system/12-webhook.md 처리 흐름 변경 — 단위 커버리지 충분
- 위치: `spec/5-system/12-webhook.md` §7 처리 흐름 step 7e·8b
- 상세: `ExecutionEngineService.execute()` 호출에 `sourceIp`·`responseCode: '202'` 추가를 문서화한 spec 변경이다. 대응 구현은 이미 `hooks.service.spec.ts` 에서 커버된다: 기본 경로(IP 헤더 없음) `sourceIp: undefined, responseCode: '202'` 단언(라인 194~195), X-Forwarded-For 경로(라인 199~220), chat-channel 분기 소스 IP 전달(라인 606~653), CF-Connecting-IP TRUST 환경변수 분기(라인 296~332). spec ↔ 테스트 갭 없음.
- 제안: 없음. 단위 커버리지는 충분하다.

### [WARNING] e2e 레벨 `GET /api/auth-configs/:id/usage` 커버리지 갭 — 이전 리뷰 W-2 승계
- 위치: `codebase/backend/test/` (e2e 테스트 디렉터리)
- 상세: 이전 리뷰(16_34_50)에서 W-2 로 식별된 갭이 이번 fix commit 에서도 해소되지 않았다. `webhook-trigger.e2e-spec.ts` 및 기타 e2e 파일에 `/usage` 엔드포인트 호출이 없다. 단위 테스트(`auth-configs.service.spec.ts`)는 `getUsage` 서비스 로직을 충분히 커버하지만, 실제 DB(V096) 환경에서 webhook 호출 → Execution 행 생성 → `/usage` 응답의 `recentCalls[0].sourceIp`·`responseCode` 를 통합 수준에서 검증하지 못한다. TypeORM Entity의 `source_ip`/`response_code` 컬럼 매핑 오류를 mock 이 가려줄 수 있어 e2e 검증이 특히 중요하다.
- 제안: `webhook-trigger.e2e-spec.ts` 또는 `auth-configs.e2e-spec.ts` 에 (1) webhook 호출로 Execution 생성 → (2) `GET /api/auth-configs/:id/usage` 응답의 `recentCalls[0].sourceIp`·`recentCalls[0].responseCode` 검증 흐름 추가. 우선순위 MEDIUM. 단, 이 갭은 본 슬라이스(doc/swagger 메타데이터)가 아니라 #602 기능 PR 의 후속 과제이며 RESOLUTION.md 에 비조치 사유가 이미 기록되어 있다.

### [INFO] `periodCounts` null 폴백 회귀 테스트 유지됨
- 위치: `auth-configs.service.spec.ts` 라인 899~912
- 상세: `getRawOne` 이 null 반환 시 `periodCounts` 가 `{ last24h: 0, last7d: 0, last30d: 0 }` 으로 폴백하는 케이스 단언이 존재한다. 이번 `type: Number` 추가 변경과 무관하게 서비스 파싱 로직 회귀 테스트가 유효하다.
- 제안: 없음.

### [INFO] `responseCode` null → status enum 폴백 케이스 커버됨
- 위치: `auth-configs.service.spec.ts` 라인 886~889
- 상세: `responseCode: null` 인 비-HTTP 트리거(schedule) 행이 `recentCalls[1].responseCode` 에 `status` enum 값(`'failed'`)으로 폴백되는 것을 단언한다. DTO 의 `responseCode: string` non-null 약속과 서비스 폴백 로직의 정합성이 테스트에 명확히 드러난다. 이번 `type: String` 추가 후에도 이 테스트는 유효하다.
- 제안: 없음.

## 요약

이번 re-review 대상은 이전 리뷰(16_34_50) 의 RESOLUTION.md 에 따른 fix commit 이다. 변경 내용은 (1) `AuthConfigUsagePeriodCountsDto` `last24h` description 보완·`type: Number` 추가, (2) `AuthConfigUsageCallDto.responseCode` 에 `type: String` 추가, (3) webhook spec §7 양 분기에 schedule/manual optional 명세 추가 등 순수 문서·메타데이터 보강이다. 런타임 동작을 변경하는 코드가 없으며 기존 단위 테스트(`auth-configs.service.spec.ts` getUsage describe, `hooks.service.spec.ts` §A.3 케이스)는 변경 후에도 그대로 유효하다. `/usage` 엔드포인트 e2e 커버리지 갭(W-2 승계)은 본 슬라이스 범위 밖으로 RESOLUTION.md 에 비조치 사유가 기록되어 있으며 별도 MEDIUM 우선순위 후속 과제다. 전반적으로 테스트 격리·회귀 안전성은 양호하고, 이번 변경이 기존 테스트를 무효화하는 요소는 없다.

## 위험도

LOW

STATUS=success ISSUES=1
