# 부작용(Side Effect) 리뷰

리뷰 대상: §A.3 호출 이력 구현 (config-call-history PR)
파일 수: 17

---

## 발견사항

### **[INFO]** `ExecuteOptions` triggerId 유니언 variant 시그니처 확장 — 기존 호출자 영향 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L558–684
- 상세: `ExecuteOptions` 유니언의 `{ triggerId: string }` variant 에 `sourceIp?: string` / `responseCode?: string` 두 필드가 추가됐다. 두 필드 모두 `optional` 이고 기존 코드는 `{ triggerId: trigger.id }` 형태로만 전달해왔으므로, 이 variant 를 사용하는 모든 기존 호출자는 수정 없이 컴파일되며 `null` 이 영속된다. 소비 측(`execute()` 내부)은 `'sourceIp' in options` 가드로 안전하게 내로잉하므로 타입 좁히기 오류 없음.
- 제안: 없음. 하위 호환 확장.

### **[INFO]** `getUsage()` 반환 타입에 `periodCounts` 필드 추가 — 구조적 타입 시스템에서 기존 소비자에게 안전
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L521–358
- 상세: 반환 객체 타입에 `periodCounts` 가 추가됐다. TypeScript 의 구조적 타이핑 상 반환 값을 수신하는 쪽이 `periodCounts` 를 destructure 하지 않으면 영향이 없다. 반환 객체를 직접 참조하는 컨트롤러·DTO 매퍼 레이어(`AuthConfigUsageDto`)가 동시에 갱신됐으므로 불일치 없음. 단, 이 함수를 의존하는 타 서비스(현 코드 범위 내 없음)가 있다면 재컴파일 필요.
- 제안: 없음. 동기화 확인 완료.

### **[INFO]** `AuthConfigUsageCallDto.recentCalls` 항목에 `sourceIp?` / `responseCode` 추가 — API 응답 계약 확장
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` L454–502
- 상세: `AuthConfigUsageCallDto` 에 `sourceIp?` (optional, nullable) 와 `responseCode` (required) 가 추가됐다. 기존 API 소비자(프론트엔드, 외부 클라이언트)가 응답 JSON 에서 이 필드를 무시하면 동작에 영향이 없다. `responseCode` 는 `required` 이나 서비스 레이어에서 `e.responseCode ?? e.status` 폴백이 보장돼 절대 `undefined` 가 아니다. `AuthConfigUsageDto` 에 `periodCounts` 필드도 추가됐으며, 기존 클라이언트가 이를 처리하지 않아도 JSON 역직렬화 과정에서 무시된다.
- 제안: 없음. 추가(additive) 변경이므로 호환.

### **[WARNING]** `hooks.service.ts` — `handleChatChannelWebhook` 에서 `extractClientIp` 를 별도 호출 (이중 추출)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L599–1076, 특히 L1073
- 상세: `handleWebhook` 에서는 `const clientIp = extractClientIp(input.headers)` 로 한 번만 추출해 인증·이력 영속 양쪽에 재사용한다(주석 "한 번만 추출"). 그런데 `handleChatChannelWebhook` 에서는 `extractClientIp(input.headers) ?? undefined` 를 execute 호출 시 인라인으로 새로 호출하며, 이 함수가 호출 경로 앞쪽에서 인증용으로 이미 한 번 호출됐는지 명확하지 않다. 순수 함수라면 부작용은 없지만, 두 경로 간 일관성이 깨져 있다. `handleWebhook` 의 패턴처럼 지역 변수에 한 번만 추출하는 방식으로 통일하지 않으면, 향후 `extractClientIp` 가 부수효과를 갖게 될 때 회귀 위험이 있다.
- 제안: `handleChatChannelWebhook` 에서도 `const clientIp = extractClientIp(input.headers)` 를 상단에 추출 후 재사용하도록 통일.

### **[INFO]** `WEBHOOK_ACCEPTED_RESPONSE_CODE` 모듈 상수 추가 — 전역 아님
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1027
- 상세: `const WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` 는 파일 스코프 상수다. 전역 변수 아님. `HttpStatus.ACCEPTED` (NestJS 열거형 값 `202`) 를 문자열화 하므로 평가 결과가 고정된다. 런타임에 `HttpStatus` 열거형 값이 변경되지 않으므로 부작용 없음.
- 제안: 없음.

### **[INFO]** `USAGE_PERIOD_WINDOWS_MS` 모듈 상수 추가 — 전역 아님
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L279–284
- 상세: `as const` 객체로 선언된 파일 스코프 상수. 변경 불가능하며 전역 상태 없음.
- 제안: 없음.

### **[INFO]** V096 마이그레이션 — 스키마 변경 (파일시스템 아님, DB)
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- 상세: `execution` 테이블에 `source_ip VARCHAR(45) NULL` 과 `response_code VARCHAR(10) NULL` 컬럼을 `ADD COLUMN` 한다. 두 컬럼 모두 `NULL` 기본값이므로 기존 행에 값이 삽입되지 않는다. `ALTER TABLE ... ADD COLUMN ... NULL` 은 PostgreSQL 에서 테이블 재작성(table rewrite) 없이 카탈로그 메타데이터만 변경하는 경량 연산이다. 기존 쿼리가 `SELECT *` 를 사용할 경우 결과셋에 새 컬럼이 추가되지만, 현 코드베이스는 `createQueryBuilder` 의 명시적 select 또는 TypeORM 엔티티 매핑을 사용해 와일드카드 `SELECT *` 노출이 없다. DOWN 스크립트가 주석으로 제공되어 롤백 가능.
- 제안: 없음.

### **[INFO]** 프론트엔드 `recharts` 신규 import — 번들 사이즈 증가, 런타임 부작용 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L1386–1394
- 상세: `recharts` 패키지에서 7개 컴포넌트를 named import 한다. 이미 `package.json` 의존성에 포함된 패키지라면 새로운 npm 네트워크 호출은 없다. 클라이언트 번들 크기가 증가하나 런타임 전역 상태 오염이나 의도치 않은 네트워크 호출은 없다.
- 제안: 없음.

### **[INFO]** `useLocaleStore.setState` 테스트 픽스처 — 전역 zustand store 변이 (테스트 환경 한정)
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` L1189
- 상세: `beforeEach(() => { useLocaleStore.setState({ locale: "en" }); })` 가 zustand 전역 스토어를 직접 변이한다. 테스트 환경에서의 의도적 패턴이며, `afterEach` 에서 `cleanup()` / `vi.clearAllMocks()` 를 호출하나 스토어 상태 복원(`useLocaleStore.setState(initialState)`) 은 명시되지 않았다. 동 파일 내 테스트 간 격리는 모든 테스트가 동일하게 `en` 으로 세팅하므로 문제없다. 그러나 병렬 테스트 파일 간 스토어 공유가 있을 경우 잔류 상태(state leak) 가능성이 있다. Vitest 기본 격리 모드가 파일 단위라면 영향 없음.
- 제안: 타 테스트 파일과의 공유 여부를 확인. 필요 시 `afterEach` 에 스토어 초기값 복원 추가.

---

## 요약

이번 변경은 §A.3 호출 이력 기능 추가를 위한 additive(추가 전용) 변경이 주를 이룬다. DB 스키마(`V096`)는 nullable 컬럼 추가라 기존 행에 영향이 없고, `ExecuteOptions` 유니언 확장은 optional 필드라 기존 호출자가 수정 없이 동작한다. 공개 API 응답 DTO 에 새 필드가 추가됐지만 모두 additive 이며 기존 클라이언트가 무시해도 무방하다. 주목할 부작용 후보는 `handleChatChannelWebhook` 에서 `extractClientIp` 가 `handleWebhook` 과 다르게 인라인 중복 호출되는 패턴 비일관성이나, 현재 `extractClientIp` 가 순수 함수라면 실질적 부작용은 없다. 테스트 픽스처의 zustand 전역 스토어 직접 변이는 파일 간 격리가 보장된 환경에서는 무해하다. 전역 변수 신규 도입 없음, 의도치 않은 파일시스템 변경 없음, 의도치 않은 네트워크 호출 없음.

---

## 위험도

LOW
