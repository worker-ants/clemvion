# Architecture Review — config-call-history (§A.3 호출 이력)

## 발견사항

### **[WARNING]** `AuthConfigsService.getUsage` 의 반환 타입이 인라인 익명 객체 — 별도 인터페이스/DTO 부재
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L391–406 (`async getUsage(...): Promise<{ totalCalls: number; lastUsedAt: ...; periodCounts: ...; recentCalls: Array<{...}> }>`)
- 상세: 서비스 레이어의 반환 타입이 인라인 리터럴로 정의돼 있다. `AuthConfigUsageDto` 계열 DTO 는 프레젠테이션 레이어(`dto/responses/`)에만 존재하고, 서비스 메서드가 반환하는 도메인 shape 과 DTO shape 이 암묵적으로 동일하다고 가정한다. 서비스·컨트롤러 중간 매핑이 없어 서비스 계층에서 DTO(프레젠테이션 관심사)를 직접 반환하는 구조가 되거나, 별도 도메인 타입 없이 타입 정보가 중복·분산된다. 향후 `/usage` 응답 shape 을 확장하거나 다른 컨트롤러가 같은 서비스 메서드를 호출할 때 계약이 암묵적으로 유지돼야 한다.
- 제안: 서비스 반환 형태를 `AuthConfigUsageResult` 등 별도 인터페이스로 명시 선언하고 해당 파일 상단 또는 `types.ts`에 배치한다. 컨트롤러에서 DTO 매핑을 명시적으로 수행하거나(현재 구조에서는 암묵 형변환), 혹은 서비스가 도메인 타입을 반환하고 컨트롤러 계층에서 `plainToInstance` 등으로 DTO 변환을 담당하도록 레이어 책임을 분리한다.

---

### **[WARNING]** `ExecuteOptions` 유니온 타입에 `sourceIp`/`responseCode` 가 `triggerId` variant 에만 속하나, 좁힘 가드가 `'in'` 연산자에 의존 — 타입 안전성 경계 취약
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L558–766, L774–781
- 상세: `ExecuteOptions` 는 세 멤버를 가진 유니온 타입이며, `sourceIp`·`responseCode` 는 두 번째 variant(`triggerId: string`) 에만 선언됐다. 서비스 구현부에서 `'sourceIp' in options` 로 variant 를 좁히는데, 이 패턴은 첫 번째(`dryRun` 포함) variant 에 우연히 `sourceIp` 속성이 붙어도 컴파일러가 잡지 못한다. 또한 `executedBy` variant 가 `triggerId?: never` 를 통해 교차 배제되는 방식이 이미 복잡하므로, 새 필드가 추가될수록 유니온 멤버 간 누설 위험이 커진다.
- 제안: 판별 유니온(discriminated union) 패턴으로 전환하거나(`kind: 'trigger'`/`'manual'`/`'rerun'` 등 리터럴 판별자 추가), `triggerId` variant 를 독립 타입으로 분리 후 `ExecuteOptions` 를 tagged union 으로 재정의한다. 단기적으로는 `'triggerId' in options && options.triggerId` 를 판별 조건으로 사용하고 `sourceIp`/`responseCode` 를 같은 블록 내에서만 참조하도록 구현부를 묶는다.

---

### **[WARNING]** `hooks.service.ts` 의 `handleChatChannelWebhook` 가 `clientIp` 를 메서드 최상단에서 추출 — 인증 실패 분기보다 앞에 위치해 불필요 계산 발생 가능
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L238 (`const clientIp = extractClientIp(input.headers)`) — `handleChatChannelWebhook` 함수 진입부
- 상세: `handleWebhook` 는 기존 인증 검증(`if (trigger.authConfigId) { ... }`) 이후에 `clientIp` 를 재사용하므로 추출 위치가 합리적이다. 반면 `handleChatChannelWebhook` 는 인증 체계가 다르거나 조기 실패 분기가 존재할 경우, `clientIp` 를 항상 추출한 뒤 사용하지 않을 수 있다. 현재는 `extractClientIp` 가 순수 함수(헤더 파싱)이므로 성능상 큰 문제가 없지만, 두 경로(인증·이력 영속)가 공유하는 사이드이펙트 없는 호출을 함수 최상단에 배치하는 것이 "단일 호출·공유 재사용" 의도임이 주석으로만 설명된다. 이는 향후 `extractClientIp` 구현이 복잡해질 경우 단일 책임 경계를 흐릴 수 있다.
- 제안: 주석(`W-9` 참조)을 유지하되, `extractClientIp` 반환값이 인증과 이력 영속 두 곳에 흐르는 흐름을 명시적으로 문서화한다. 장기적으로는 IP 추출을 미들웨어/인터셉터로 올려 `WebhookInput` 에 이미 파싱된 `clientIp?: string` 이 포함되도록 하면 서비스 레이어가 파싱 책임을 지지 않아도 된다.

---

### **[WARNING]** `authentication/page.tsx` 에 차트 렌더링(recharts)·테이블·데이터 페칭이 단일 컴포넌트에 공존 — 이미 파악된 God Component 문제 계속 심화
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L931–1544 (BarChart 섹션 및 recentCalls 테이블 추가)
- 상세: 이번 변경으로 `AuthenticationPage` 에 `recharts` BarChart 렌더링(~70줄), source IP / response code 컬럼, 기간별 카운트 표시가 추가됐다. 이미 이전 ai-review(WARNING 1·4) 와 plan(`후속 — God Component 분리`)에서 인식한 문제지만, 이번 PR 에서 동일 파일이 다시 확장됐다. `UsagePeriodCounts` 인터페이스, 차트 data 조합, i18n 키, 테이블 컬럼이 모두 한 파일에 밀집되어 있어 변경 이유(SRP 위반)가 복수다. plan 에서 "I-11 메모: usage drawer 만 수정 — 후속 God Component 분리 스코프와 충돌 없음"이라 기재했지만, 동일 파일 수정이 반복되면 분리 비용이 회차마다 증가한다.
- 제안: 차트 섹션을 `UsagePeriodChart` 컴포넌트로 추출하고, 테이블 행 매핑을 `UsageCallRow` 컴포넌트로 분리하여 `page.tsx` 가 조합만 담당하도록 한다. `plan/in-progress/spec-sync-config-gaps.md` 의 God Component 분리 후속 항목 우선순위를 현 "저"에서 "중"으로 상향 재검토를 권장한다.

---

### **[INFO]** `safeUsageCount` 가 모듈 레벨 유틸리티이지만 파일 로컬 함수로 존재 — 재사용 가능성 고려
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L361–364
- 상세: DB `getRawOne` 의 숫자 문자열 폴백 처리는 다른 집계 쿼리(Integration 등)에서도 동일하게 필요할 수 있다. 현재 파일 스코프 함수로 두어 재사용 불가한 상태다.
- 제안: 즉시 이동이 강제될 이유는 없으나, `shared/utils/db-utils.ts` 류의 위치로 이동하면 다른 서비스가 동일 패턴을 별도로 구현하지 않아도 된다.

---

### **[INFO]** `response_code VARCHAR(10)` 타입 — HTTP 상태 코드·status enum 혼합 저장으로 도메인 의미 혼재
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` L57, `codebase/backend/src/modules/executions/entities/execution.entity.ts` L824–830
- 상세: 동일 컬럼이 webhook 경로에서는 HTTP 코드 문자열(`'202'`), 비-HTTP 트리거에서는 NULL로 남고 서비스 계층에서 status enum 으로 폴백된다. 즉 DB 레벨에서 의미가 "HTTP 응답 코드 또는 NULL", 서비스 출력에서는 "HTTP 코드 또는 status enum 문자열"이 되어 컬럼의 도메인 의미가 소비 경로에 따라 달라진다. 이는 의도된 설계(migration 주석, spec §A.3, WH-MG-05 명시)이며 현재 규모에서 수용 가능하나, 향후 응답 코드 기반 필터링이 필요해질 경우 `NULL vs '202' vs 'completed'`를 구분하는 쿼리가 복잡해진다.
- 제안: 현재 접근(NULL = 비-HTTP, 서비스 폴백)을 문서화된 설계 결정으로 유지하되, migration 주석과 entity 주석이 이미 이를 잘 설명하고 있으므로 별도 조치 없이 허용 가능. 확장 시 `source_type ENUM('webhook','chat','schedule','manual')` 컬럼 추가를 고려한다.

---

### **[INFO]** `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` — 상수가 hooks.service 로컬에만 존재
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1031
- 상세: `handleWebhook`·`handleChatChannelWebhook` 두 경로 모두 동일 상수를 사용하므로 파일 내 재사용은 적절하다. 그러나 향후 다른 서비스(예: 이벤트 소스 트리거)가 응답 코드를 기록해야 할 경우 같은 `202` 리터럴이 여러 곳에 재정의될 수 있다.
- 제안: 중기적으로 `shared/constants/webhook.constants.ts` 에 이동하거나 현행 유지 모두 수용 가능.

---

## 요약

이번 변경은 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 기능을 DB 마이그레이션 → 엔티티 → 실행 엔진 → hooks 서비스 → auth-configs 서비스 → DTO → 프론트엔드까지 수직으로 관통하는 슬라이스로 구현했다. 레이어 간 데이터 흐름(`extractClientIp` → `execute()` options → `Execution` 행 → `getUsage` → DTO → UI)은 명확하고 순환 의존성은 없다. `Promise.all` 병렬화, partial index, `safeUsageCount` 방어 로직 등 구현 품질은 양호하다. 아키텍처 관점의 주요 우려는 두 가지다. 첫째, `getUsage` 서비스 메서드의 반환 타입이 인라인 익명 객체여서 서비스·프레젠테이션 레이어 간 계약이 암묵적이다. 둘째, `authentication/page.tsx` God Component 문제가 이번 PR 에서 차트·컬럼 추가로 다시 심화됐으며, plan 상 "저우선순위 후속" 으로 미루는 사이 파일이 계속 커지고 있다. `ExecuteOptions` 유니온 타입의 variant 판별 방식도 복잡도가 누적되고 있어 중기적으로 discriminated union 으로 전환이 권장된다. 전반적으로 기능 정합성은 높고 SOLID 중 단일 책임 원칙의 일부 침식이 프론트엔드 레이어에서 관찰되는 수준이다.

## 위험도

MEDIUM
