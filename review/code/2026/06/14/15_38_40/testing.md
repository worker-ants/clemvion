# Testing Review — §A.3 호출 이력 (config-call-history)

리뷰 대상 파일: 15개 (SQL 마이그레이션 1, 백엔드 서비스/스펙 6, 프론트엔드 컴포넌트/테스트 4, i18n 2, plan/review 문서 2)

---

## 발견사항

### [INFO] 마이그레이션 파일(V096) 자체에 대한 테스트 없음 — 허용 수준

- **위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- **상세**: SQL 마이그레이션 파일 자체의 idempotency(재실행 시 IF NOT EXISTS 등) 및 컬럼 기본값(NULL)이 단위 테스트로 검증되지 않는다. 단, 마이그레이션 통합 테스트(e2e/DB 레벨)는 별도 워크플로에서 실행되는 구조로, 이는 프로젝트 관행상 허용 범위다. DOWN 스크립트가 주석으로만 존재해 롤백 경로 테스트 불가능하나, 이 역시 현 프로젝트 구조상 INFO 수준.
- **제안**: 없음 (현행 관행 유지).

---

### [INFO] `safeUsageCount` 함수에 대한 독립 단위 테스트 없음

- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `safeUsageCount` 함수 (파일 내 모듈 레벨 helper)
- **상세**: `safeUsageCount`는 NaN·음수·null·undefined 등 다양한 비정상 입력을 처리하는 순수 함수다. 현재 테스트는 `getUsage` 통합 경로(QB mock)를 통해 `null → 0` 폴백만 검증한다. `NaN`(예: 드라이버가 `"abc"` 반환 시)과 음수(-1) 경우는 테스트로 커버되지 않는다. 해당 함수가 export되지 않아 직접 단위 테스트가 불가능한 구조이나, 동작상 위험이 낮아 INFO로 분류한다.
- **제안**: 필요 시 `safeUsageCount`를 별도 util 파일로 export하거나, 서비스 spec에 `periodRaw.last24h = 'abc'` 시나리오 케이스를 추가해 NaN 폴백을 명시적으로 검증.

---

### [WARNING] `getUsage` — `totalCalls`와 `recentCalls` 불일치 시나리오 미테스트

- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — `getUsage` describe 블록
- **상세**: 현재 테스트는 `totalCalls=7`, `period={last24h:'2',...}`, `recent=[2건]` 의 "정상 일치" 케이스만 검증한다. 그러나 Promise.all 병렬화(W-4)로 인해 DB 상태가 세 쿼리 사이에 변경될 경우 `totalCalls > recentCalls.length`이 될 수 있다. 이는 정상 동작이지만 테스트가 해당 케이스를 문서화하지 않는다. 더 중요하게는, `periodCounts.last30d > totalCalls`가 될 수 없다는 불변식도 검증되지 않는다.
- **제안**: "totalCalls=5, period.last30d='5', recent=[]" 처럼 `recentCalls`가 비어 있어도 `totalCalls`/`periodCounts`가 독립 반환되는 케이스 1건 추가. 필수 수준은 아니나 회귀 방어에 유용.

---

### [WARNING] `hooks.service.spec.ts` — `sourceIp: undefined` 전달 시 `execute` 옵션 타입 경계 미검증

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.spec.ts`, 라인 900 (`sourceIp: undefined, responseCode: '202'`)
- **상세**: 기존 테스트(`§A.3 호출 이력 — sourceIp(헤더에 IP 없음 → undefined)`)는 `sourceIp: undefined`를 `ExecuteOptions`에 전달하는 것을 단언한다. 그런데 `execution-engine.service.ts`의 실제 처리 경로는 `'sourceIp' in options`로 narrowing하므로 `{sourceIp: undefined}`를 전달하면 `sourceIp ?? null → null`로 처리된다. 즉 hooks.service가 `sourceIp: undefined`를 넘기는 것과 `sourceIp` 키를 아예 생략하는 것이 engine 관점에서 동일하게 처리되는데, 이 동등성이 양쪽 spec 파일에 걸쳐 검증되지 않는다. `hooks.service.spec`이 `sourceIp: undefined`를 단언하는 반면 `execution-engine.service.spec`의 NULL 케이스는 `sourceIp` 키 자체를 omit(`{ triggerId: 'trg-sched' }`)하고 있어 두 spec이 서로 다른 shape을 테스트한다.
- **제안**: `execution-engine.service.spec.ts`의 "schedule/manual NULL" 케이스에 `{ triggerId: 'trg-sched', sourceIp: undefined }`도 별도 케이스로 추가해 `undefined` 전달 시에도 `null`로 영속되는 동작을 명시적으로 커버. 또는 `hooks.service`가 `sourceIp: undefined` 대신 키 자체를 omit하도록 수정 후 통일.

---

### [INFO] `auth-configs.service.spec.ts` — QB 호출 순서 의존성 잠재 위험

- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`, `makeExecutionRepo` 함수 (라인 181-186)
- **상세**: `createQueryBuilder`가 `mockReturnValueOnce(countQb).mockReturnValueOnce(periodQb).mockReturnValueOnce(recentQb)` 순서로 설정된다. 코드에 명시된 대로 W-11 해결책(각 QB 독립 체인)이 적용되어 있어 terminal 혼용 위험은 없다. 그러나 `Promise.all` 내부 세 쿼리의 `createQueryBuilder` 호출 순서가 실제로 `count → period → recent` 순임을 테스트가 암묵적으로 가정한다. TypeScript의 배열 리터럴 평가는 좌-우 순서이므로 현재 구현에서는 순서가 보장되지만, 향후 `Promise.all` 인자 순서 변경 시 테스트가 오탐 없이 깨질 수 있다. 현재 W-11 주석이 이 위험을 인식하고 있으나, 테스트가 "순서 비의존"이라고 주석을 달면서도 실제로는 `mockReturnValueOnce` 순서에 의존하는 구조적 모순이 있다.
- **제안**: 완전한 순서 독립성을 원한다면 `createQueryBuilder`의 반환 값을 QB 내부 메서드 체인 패턴(첫 `.select()` 또는 `.where()` 호출 내용)으로 구분하는 factory 방식으로 변경. 또는 현재 구조 유지 시 "Promise.all 인자 순서와 mockReturnValueOnce 순서를 일치시켜야 한다"는 주석을 보강.

---

### [INFO] 프론트엔드 테스트 — `periodCounts` 개별 숫자값 렌더링 미검증

- **위치**: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx`, 라인 1239-1246
- **상세**: "기간별 호출 수 섹션이 렌더된다" 테스트는 `"Calls by Period"` 헤더 텍스트 존재만 검증한다. `USAGE.periodCounts = { last24h: 2, last7d: 5, last30d: 7 }`의 실제 숫자(2, 5, 7)가 차트 내에 렌더되는지, 또는 XAxis label("Last 24h", "Last 7d", "Last 30d")이 표시되는지는 검증하지 않는다. recharts를 passthrough stub으로 처리했기 때문에 Bar의 `data` prop에 올바른 값이 전달되는지도 확인할 수 없다.
- **제안**: recharts stub에서 `BarChart`의 `data` prop을 캡처하거나, XAxis label 텍스트를 `screen.getByText("Last 24h")` 등으로 추가 단언. 또는 `periodCounts` 숫자가 DOM 어딘가에 렌더되면 `screen.getByText("2")` 등으로 검증.

---

### [INFO] 프론트엔드 테스트 — `recentCalls` 빈 배열 케이스 미테스트

- **위치**: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx`
- **상세**: 현재 테스트 fixture(`USAGE`)는 항상 2건의 `recentCalls`를 제공한다. `recentCalls: []`(호출 이력 없음) 시 `"No recent calls."` 메시지가 표시되는지, 그리고 `periodCounts`가 모두 0이어도 차트 섹션이 crash 없이 렌더되는지는 검증되지 않는다.
- **제안**: `USAGE`의 변형으로 `recentCalls: []`, `periodCounts: { last24h: 0, last7d: 0, last30d: 0 }` 케이스를 추가. "No recent calls." 메시지 렌더링을 단언.

---

### [INFO] `response_code VARCHAR(10)` 길이 제약 — 테스트 미검증

- **위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` (length 10), `codebase/backend/src/modules/executions/entities/execution.entity.ts` (length: 10)
- **상세**: HTTP 응답 코드는 3자리 숫자지만 컬럼이 `VARCHAR(10)`으로 정의되어 있다. 비정상적으로 긴 `responseCode` 문자열(예: 11자 이상)이 service layer에서 트리밍 없이 그대로 `create()`에 전달될 경우 DB 레벨에서 오류가 발생할 수 있다. 단위 테스트는 QB mock을 사용하므로 이 제약을 검증할 수 없다.
- **제안**: e2e 또는 통합 테스트 레벨에서 컬럼 길이 검증 필요. 또는 service 레이어에서 `responseCode`를 10자로 trim하는 방어 코드 추가 후 단위 테스트.

---

## 요약

테스트 커버리지는 전반적으로 양호하다. 핵심 기능(sourceIp/responseCode 영속, NULL 폴백, periodCounts 파싱, status enum 폴백, orphan trigger, XFF 추출, chat-channel 대칭)이 각 계층(execution-engine, hooks, auth-configs, frontend drawer)에 걸쳐 독립적으로 테스트되고 있다. QB 독립 분리(W-11)와 Promise.all 병렬화(W-4) 테스트 설계도 의도가 명확하다. 주요 갭은 두 가지다: (1) `hooks.service.spec`이 `sourceIp: undefined`를 단언하는 반면 `execution-engine.service.spec`의 NULL 케이스는 키 자체를 omit하는 구조적 불일치(WARNING), (2) QB mock 순서와 "순서 비의존" 주석 간 모순(INFO). 프론트엔드 테스트는 recharts passthrough stub으로 차트 데이터 검증이 제한적이며, 빈 이력 케이스와 periodCounts 실제 값 검증이 누락되어 있다. `safeUsageCount`의 NaN/음수 경로는 직접 커버되지 않으나 실운영 위험은 낮다.

---

## 위험도

LOW
