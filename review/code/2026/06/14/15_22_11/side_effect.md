# 부작용(Side Effect) Review

## 발견사항

### 파일 1: V096__execution_source_ip_response_code.sql

- **[INFO]** DDL ALTER TABLE — 기존 행에 대한 잠금 영향
  - 위치: `ALTER TABLE execution ADD COLUMN source_ip ..., ADD COLUMN response_code ...`
  - 상세: PostgreSQL 에서 `ADD COLUMN ... NULL DEFAULT NULL` 은 테이블 재작성 없이 카탈로그 업데이트만 수행(즉시 완료, exclusive lock 은 매우 짧음). 실제 lock 위험은 낮지만, `execution` 테이블이 고빈도 write 대상이라면 마이그레이션 시 순간적 lock 경합 가능성이 있다. 두 컬럼 모두 `NULL DEFAULT NULL` 이므로 회귀 없음.
  - 제안: 운영 배포 시 low-traffic 시간대 적용 권장. 코드 측면에서는 문제 없음.

- **[INFO]** 부분 인덱스 `idx_execution_trigger_started` 생성
  - 위치: `CREATE INDEX IF NOT EXISTS idx_execution_trigger_started ON execution (trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL`
  - 상세: `CREATE INDEX` 는 기본적으로 `CONCURRENT` 가 아니므로 마이그레이션 실행 중 `execution` 테이블에 `ShareLock` 이 걸린다. `IF NOT EXISTS` 로 재실행 안전성은 보장됨.
  - 제안: 테이블 크기가 크다면 `CREATE INDEX CONCURRENTLY` 검토. Flyway 트랜잭션 내에서는 `CONCURRENT` 사용 불가이므로 별도 마이그레이션으로 분리하는 것도 고려.

---

### 파일 3: auth-configs.service.ts

- **[WARNING]** `getUsage` 반환 타입 시그니처 변경 — 기존 호출자에 컴파일 오류 가능
  - 위치: `async getUsage(...)` 반환 타입에 `periodCounts` 필드 추가, `recentCalls` 아이템에 `sourceIp: string | null`, `responseCode: string` 추가
  - 상세: 반환 타입이 확장되었다. TypeScript 에서는 반환값을 그대로 사용하는 호출자(컨트롤러, 테스트)는 새 필드를 얻으므로 호환되지만, 반환 타입을 `Pick`·구조 분해 등으로 좁혀 쓰는 곳이 있다면 문제없다. 실제로는 Controller 가 DTO 매핑 없이 직접 반환 객체를 쓴다면 DTO(`AuthConfigUsageDto`)와 불일치가 생길 수 있다. 파일 4(DTO)에서 `periodCounts`·`sourceIp`·`responseCode` 를 추가했으므로 DTO 매핑이 있는 경우엔 정합성이 맞음.
  - 제안: Controller 에서 서비스 반환값을 DTO 로 매핑하는 코드가 있는지 확인. 매핑 없이 직렬화 시 신규 필드가 자동 포함됨(OK). 기존 클라이언트가 엄격한 JSON schema 검증을 한다면 새 필드 추가로 인한 영향 확인 필요.

- **[INFO]** 모듈 스코프 상수 `USAGE_PERIOD_WINDOWS_MS` 추가
  - 위치: 파일 상단 `const USAGE_PERIOD_WINDOWS_MS = { ... } as const`
  - 상세: 새 모듈-레벨 `const` 추가. `as const` + 불변 객체이므로 공유 변경 가능 상태가 아님. 전역 변수가 아니며 모듈 내부 상수로 안전.
  - 제안: 없음.

- **[INFO]** `getUsage` 내부에서 `Date.now()` 를 한 번만 호출하고 3개 파라미터에 공용 사용
  - 위치: `const now = Date.now();` → `since24h`, `since7d`, `since30d`
  - 상세: 3개 쿼리가 `Promise.all` 로 동시 발행되므로 `now` 를 캡처해 일관된 기준 시각을 사용한다. 의도적이며 올바른 패턴. 부작용 없음.
  - 제안: 없음.

- **[INFO]** `safeCount` 클로저가 함수 내부 스코프에만 존재
  - 위치: `const safeCount = (raw) => ...` (함수 내부)
  - 상세: 외부 상태를 캡처하지 않는 순수 내부 함수. 부작용 없음.
  - 제안: 없음.

---

### 파일 4: auth-config-response.dto.ts

- **[WARNING]** `@ApiPropertyOptional` → `@ApiProperty` 변경 — OpenAPI 스키마 변경으로 기존 API 클라이언트에 영향
  - 위치: `AuthConfigDto.lastUsedAt` 과 `AuthConfigUsageDto.lastUsedAt` 의 데코레이터 변경
  - 상세: `@ApiPropertyOptional`(Swagger `required: false`) 에서 `@ApiProperty`(기본 `required: true`)로 변경됨. Swagger/OpenAPI 스펙 상 `lastUsedAt` 이 required 필드로 승격된다. 실제 타입은 `string | null` 이고 `nullable: true` 가 유지되므로 JSON 직렬화 결과는 동일하다(null 포함). 그러나 자동 생성된 클라이언트(e.g. openapi-generator)가 이 필드를 optional 처리하던 경우 regenerate 시 타입 변경이 발생할 수 있다.
  - 제안: 클라이언트가 OpenAPI 스키마 기반 코드 생성을 사용한다면 regenerate 후 타입 확인 필요. `nullable: true` + `required: true` 조합은 "값은 반드시 존재하되 null 허용" 의미이므로 실제 응답이 항상 `lastUsedAt` 키를 포함하는지 서비스 레이어에서 보장되어야 함. `getUsage` 의 early return 경로(`config.lastUsedAt` 직접 반환)는 null 이 가능하므로 키 자체는 포함됨 — 실제 행동은 스키마와 정합.

- **[INFO]** `ApiPropertyOptional` import 제거
  - 위치: `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'` → `import { ApiProperty } from '@nestjs/swagger'`
  - 상세: 미사용 import 제거. 부작용 없음.
  - 제안: 없음.

- **[INFO]** 새 공개 DTO 클래스 추가: `AuthConfigUsagePeriodCountsDto`
  - 위치: 파일 4 신규 export 클래스
  - 상세: 새 공개 타입이 추가됨. 기존 코드에 영향 없음. `AuthConfigUsageDto.periodCounts` 필드가 신규 필수 필드로 추가되어 이 DTO 를 응답으로 내려받는 프론트엔드는 새 필드를 받게 됨(하위 호환: 추가만).
  - 제안: 없음.

---

### 파일 6: execution-engine.service.ts

- **[WARNING]** `ExecuteOptions` union 타입 변경 — triggerId variant 에 optional 필드 추가
  - 위치: `| { executedBy?: never; triggerId: string }` → `| { executedBy?: never; triggerId: string; sourceIp?: string; responseCode?: string }`
  - 상세: 기존 호출자(`{ triggerId: '...' }`)는 새 optional 필드를 미전달 시 `undefined` → `null` 영속으로 처리된다. `'sourceIp' in options` narrowing 으로 안전하게 분기됨. 기존 `hooks.service.ts` 이외에 다른 곳에서 triggerId variant 를 사용하는 호출자가 있다면 신규 필드는 선택적이므로 컴파일 오류 없음.
  - 제안: 코드베이스 내 `execute(...)` 의 triggerId variant 호출자 전체 확인 권장(hooks.service spec 에서만 호출하는지). `hooks.service.ts` 가 유일한 호출자라면 영향 없음.

- **[INFO]** `sourceIp`, `responseCode` 를 `executionRepository.create({...})` 에 추가
  - 위치: `execution-engine.service.ts` L2851-L2852 (diff L778-L780)
  - 상세: `create()`에 두 컬럼을 전달. `executionRepository.save()` 로 DB 에 영속. 의도된 부작용(목적이 영속). null 기본값으로 기존 실행 경로(schedule/manual)는 변경 없음.
  - 제안: 없음.

---

### 파일 7: execution.entity.ts

- **[INFO]** 엔티티에 `sourceIp`, `responseCode` 컬럼 추가
  - 위치: `@Column({ name: 'source_ip', nullable: true })`, `@Column({ name: 'response_code', nullable: true })`
  - 상세: TypeORM 엔티티에 nullable 컬럼 추가. 기존 쿼리 빌더가 `SELECT *` 또는 `getMany()` 를 쓰는 경우 새 컬럼이 자동 포함된다. 두 컬럼 모두 `nullable: true` 이므로 기존 insert/save 코드는 컴파일 오류 없이 동작(미전달 시 TypeORM 이 null 로 처리).
  - 상세: `hooks.service.ts` 이외의 코드가 `Execution` 을 생성할 때 두 필드가 없어도 기본 null 로 저장됨 — 회귀 없음.
  - 제안: 없음.

---

### 파일 9: hooks.service.ts

- **[INFO]** `extractClientIp` 호출 위치 이동 — 인증 검증 전으로 앞당김
  - 위치: `handleWebhook` 내 `const clientIp = extractClientIp(input.headers);` (인증 블록 앞)
  - 상세: 기존에는 인증 블록(`if (trigger.authConfigId)`) 내부에서 `extractClientIp` 를 inline 호출했다. 이제 인증 블록 밖에서 한 번 호출해 `clientIp` 변수에 저장한다. `extractClientIp` 는 헤더 파싱 순수 함수이므로 부작용 없음. 인증 실패 시에도 `clientIp` 가 추출되지만, 인증 실패는 `execute()` 이전에 throw 되어 Execution 행이 생성되지 않으므로 데이터 누설 없음.
  - 제안: 없음.

- **[INFO]** `HttpStatus` import 추가 및 `WEBHOOK_ACCEPTED_RESPONSE_CODE` 모듈 상수 추가
  - 위치: `@nestjs/common` 에서 `HttpStatus` import; `const WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED);`
  - 상세: `HttpStatus.ACCEPTED === 202`. `String(202) === '202'`. 모듈 레벨 상수이며 변경 불가. 부작용 없음.
  - 제안: 없음.

- **[INFO]** `handleChatChannelWebhook` 에서 `extractClientIp` 인라인 재호출
  - 위치: `handleChatChannelWebhook` 내 `const clientIp = extractClientIp(input.headers);`
  - 상세: `handleWebhook` 과 별개 함수이므로 별도 호출이 필요함. 중복이지만 코드 공유 없이 각 핸들러가 독립적으로 IP 추출 — 의도된 패턴(코드 주석 W-9 언급). 순수 함수이므로 부작용 없음.
  - 제안: 없음.

---

### 파일 10: usage-drawer.test.tsx (신규)

- **[INFO]** 모듈 레벨 `getMock` 변수 + `vi.mock` 호출
  - 위치: `const getMock = vi.fn();` + `vi.mock("@/lib/api/client", ...)`
  - 상세: 테스트 파일 모듈 스코프에 `getMock` 이 선언됨. `afterEach`에서 `vi.clearAllMocks()` 로 정리되고 `beforeEach`에서 재설정됨. 테스트 간 상태 오염 없음.
  - 제안: 없음.

- **[INFO]** `useLocaleStore.setState({ locale: "en" })` 전역 스토어 변경
  - 위치: `beforeEach` 내
  - 상세: Zustand 스토어를 `setState` 로 직접 변경. `afterEach`에 `cleanup()` 만 있고 스토어 복원 코드가 없다. 동일 테스트 스위트 내 다른 테스트와 격리는 `beforeEach` 재설정으로 보장됨. 그러나 `vi.clearAllMocks()` 는 스토어를 초기화하지 않으므로, 다른 test suite 파일이 같은 스토어를 read-only 로 쓴다면 영향이 없지만, locale 를 다른 값으로 쓰는 suite 가 parallel 실행된다면 race condition 가능.
  - 제안: Vitest 기본 격리(workers)로 테스트 파일 간 스토어 공유는 없으므로 실제 문제 없음. 단, 동일 파일 내 future 테스트가 `en` 이외의 locale 을 필요로 하는 경우를 위해 `afterEach` 에 `useLocaleStore.setState({ locale: "en" })` (reset) 명시를 고려.

---

### 파일 11: authentication/page.tsx

- **[INFO]** `recharts` import 추가 — 번들 크기 증가
  - 위치: `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";`
  - 상세: 런타임 side effect 는 없으나 `recharts` 가 사전 등록된 종속성인지 확인 필요. 번들 크기가 늘어남. jsdom 테스트 환경에서는 레이아웃 측정이 없어 테스트 파일에서 stub 처리(`vi.mock("recharts", ...)`)함.
  - 제안: `recharts` 가 `package.json` dependencies 에 이미 포함된 경우 부작용 없음. 없다면 런타임 오류.

- **[INFO]** `periodCounts` 접근이 `usageData?.periodCounts` 없이 직접 참조
  - 위치: `usageData.periodCounts.last24h` 등 (diff L1456-1468)
  - 상세: `usageData` 가 있는 조건 블록 내부에서만 렌더되는지 확인 필요. 상위 코드에서 `usageData &&` 가드 없이 접근하면 `undefined.periodCounts` 런타임 오류 발생. (페이로드 컨텍스트 상 `usageData` 가 존재할 때만 이 JSX 블록이 렌더된다고 가정하나 확인 필요.)
  - 제안: `usageData?.periodCounts?.last24h ?? 0` 형태로 optional chaining 적용 권장.

---

## 요약

이번 변경은 `execution` 테이블에 `source_ip`/`response_code` nullable 컬럼을 추가하고, webhook/chat-channel 발화 시 두 값을 캡처해 영속하며, `getUsage` API 가 기간별 호출 수(`periodCounts`)와 소스 IP·응답 코드를 반환하도록 확장한다. 부작용 관점에서 주요 위험은 두 가지다. (1) `getUsage` 반환 타입 확장과 `AuthConfigUsageDto` 에 `periodCounts` 신규 필수 필드 추가는 기존 API 응답을 파싱하는 클라이언트에 영향을 줄 수 있으나, 필드 추가(하위 호환)이고 프론트엔드는 이미 대응됨. (2) `lastUsedAt` 데코레이터를 `@ApiPropertyOptional` → `@ApiProperty` 로 변경하면 OpenAPI 스키마의 `required` 여부가 바뀌어 자동 생성 클라이언트에 영향을 줄 수 있다. SQL 마이그레이션(`ALTER TABLE ... ADD COLUMN NULL`) 자체는 회귀 없이 안전하지만, `CREATE INDEX` 가 `CONCURRENT` 가 아닌 점은 운영 환경에서 고려가 필요하다. `extractClientIp` 호출 위치 이동, 모듈 상수 추가, 엔티티 컬럼 추가는 모두 의도된 범위 내에 있으며 의도치 않은 전역 상태 변경이나 네트워크 호출은 없다.

## 위험도

LOW
