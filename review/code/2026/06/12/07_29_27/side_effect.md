# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 3: error-codes.ts

- **[INFO]** `ErrorCode` const 객체에 `DB_HOST_BLOCKED` 속성 추가
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (DB 섹션 내 4줄 추가)
  - 상세: `ErrorCode`는 `as const`로 선언된 read-only 객체다. 새 속성 추가는 `ErrorCodeValue` 타입 유니언을 확장하며, 이 타입을 exhaustive switch로 처리하는 코드가 있다면 컴파일 에러가 발생할 수 있다. 그러나 `ErrorCodeValue`는 200+ 항목의 string 유니언이고, 실제로 exhaustive switch를 강제하는 패턴은 보이지 않는다. `buildErrorEnvelope` 함수의 시그니처는 `code: ErrorCodeValue`를 받으므로 호환성 문제 없음.
  - 제안: 없음. `as const` 구조상 기존 코드에 런타임 부작용은 없다.

### 파일 2: execution-failure-classifier.ts

- **[INFO]** `INTERNAL_CODES` Set에 `'DB_HOST_BLOCKED'` 항목 추가
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (INTERNAL_CODES Set 내 추가)
  - 상세: 모듈-레벨 `const` Set에 값을 추가한다. Set은 선언 시 초기화되므로 런타임에 변경이 없고 immutable하게 사용된다. 기존 `classifyExecutionFailure` 함수 시그니처·반환 타입은 변경되지 않는다. 이전에는 `DB_HOST_BLOCKED` 코드가 존재하지 않았으므로 기존 동작에 실질적 변화는 없다.
  - 제안: 없음. 의도된 변경이다.

### 파일 5: database-query.handler.ts

- **[WARNING]** SSRF 가드 에러 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`로 변경
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` SSRF 가드 catch 블록
  - 상세: 이전에는 `assertSafeOutboundHostResolved`가 throw하는 plain `Error`가 catch 블록 하단의 `mapDbError` 경로로 흘러 `INTEGRATION_CALL_FAILED` 코드를 반환했다. 변경 후에는 `IntegrationError('DB_HOST_BLOCKED', ...)`로 승격되어 `err instanceof IntegrationError` 분기에서 `DB_HOST_BLOCKED` 코드가 직접 surface된다. 이는 기존에 `INTEGRATION_CALL_FAILED`를 분기 조건으로 사용하는 저장된 워크플로우 정의가 사용자 데이터에 존재할 경우 분기 로직이 달라지는 의미있는 동작 변경이다.
  - 제안: 이 변경은 의도된 것이며 spec §6.2와 일치한다. 단, 변경 이력/릴리스 노트에 "Database Query 노드 SSRF 차단 시 에러 코드가 `INTEGRATION_CALL_FAILED`에서 `DB_HOST_BLOCKED`로 변경됨"을 breaking change로 명시하는 것이 권장된다.

- **[INFO]** catch 블록의 empty catch(`catch { ... }`)가 원본 예외 정보를 삭제
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` SSRF 가드 catch 블록
  - 상세: `catch` 바인딩 없이 원본 `Error`를 버린다. 원본 `assertSafeOutboundHostResolved`의 에러 메시지(차단 IP/호스트 정보)는 서버 로그에도 남지 않는다 — `IntegrationError`로 교체된 후 `toLogError(err)`가 호출되기 때문이다. 이는 의도적인 정찰 면 축소 설계지만, 운영 관찰가능성(Observability) 관점에서 차단 대상 host/IP 로그가 필요하다면 별도 처리가 있어야 한다.
  - 제안: 운영 디버깅을 위해 catch 블록 내에서 원본 에러를 structured log로 기록하는 방안을 검토한다. 단, 이 정보가 클라이언트에 노출되지 않아야 한다는 정찰 면 축소 원칙과의 균형을 고려해야 한다. 현재 설계는 의도된 것이므로 필수 수정 아님.

### 파일 4: database-query.handler.spec.ts

- **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수를 테스트 내에서 수정 후 `finally` 블록에서 복원
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` lines 228–249
  - 상세: `process.env.ALLOW_PRIVATE_HOST_TARGETS`를 직접 조작한다. `finally` 블록에서 원래 값으로 복원하므로 동일 프로세스 내 다른 테스트에 영향을 주지 않는다. Jest의 기본 설정에서 각 test file은 별도 Worker에서 실행되므로 파일 간 경합은 없다. 다만 이 테스트가 비동기(`async`)이므로 Promise resolve 전에 동일 파일 내 다른 비동기 테스트가 env를 읽는 경우 이론적 간섭 가능성이 있으나, Jest는 동일 파일 내 테스트를 직렬 실행하므로 실질 위험은 없다.
  - 제안: 없음. try/finally 패턴으로 안전하게 복원된다.

### 파일 1: execution-failure-classifier.spec.ts

- **[INFO]** `Logger.prototype.warn`을 `jest.spyOn`으로 mock 후 `mockRestore()` 호출
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` lines 47–53
  - 상세: 테스트 내에서 NestJS Logger의 프로토타입 메서드를 spy하고 복원한다. `mockRestore()`로 prototype을 원상복구하므로 다른 테스트에 영향을 주지 않는다. spy 생성과 복원이 동일 `it` 블록 내에서 이루어지므로 격리가 완전하다.
  - 제안: 없음.

### 파일 6: frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `ERROR_KO` Record에 `DB_HOST_BLOCKED` 키-값 쌍 추가
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` ERROR_KO 테이블 (HTTP_BLOCKED 바로 뒤)
  - 상세: `ERROR_KO`는 모듈-레벨 `const Record<string, string>` 객체다. 새 키 추가는 순수 추가(additive)이며 기존 키의 값을 변경하지 않는다. 기존 `DB_HOST_BLOCKED` 키가 없었으므로 이전에는 한국어 UI에서 영문 message 원문이 노출됐다. 이제 한국어 매핑이 생기므로 사용자 가시 동작이 개선된다. 의도치 않은 부작용 없음.
  - 제안: 없음.

### 파일 7: plan/in-progress/http-ssrf-all-auth-followups.md

- **[INFO]** plan 파일 체크박스 상태 변경(미완료 → 완료)
  - 위치: `plan/in-progress/http-ssrf-all-auth-followups.md` DB_HOST_BLOCKED 항목
  - 상세: plan 파일의 `- [ ]` → `- [x]` 변경은 추적 정보 갱신이며 런타임 부작용 없음.
  - 제안: 없음.

### 파일 28-30: spec 파일들

- **[INFO]** spec 문서 업데이트 (`spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/2-database-query.md`, `spec/5-system/3-error-handling.md`)
  - 상세: spec 문서의 prose 및 에러 코드 열거 갱신. 런타임 코드에 직접 영향 없음. 기존 spec이 SSRF 차단 시 `INTEGRATION_CALL_FAILED`(fallback)를 반환 코드로 기재했으나 이를 `DB_HOST_BLOCKED`로 교체하였으므로 spec-impl 일관성이 확보된다.
  - 제안: 없음.

---

## 요약

이번 변경은 Database Query SSRF 차단 시 반환 에러 코드를 generic `INTEGRATION_CALL_FAILED`(mapDbError fallback)에서 전용 `DB_HOST_BLOCKED` IntegrationError로 승격하는 단일 목적 PR이다. 의도하지 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 오염, 외부 네트워크 호출, 이벤트/콜백 변경은 없다. 주목할 만한 동작 변경은 SSRF 차단 경로의 에러 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`로 바뀌어 기존에 해당 코드를 분기 조건으로 사용하는 저장된 워크플로우가 있다면 분기 동작이 달라질 수 있다는 점(WARNING)이다. `ErrorCode` const 객체와 `INTERNAL_CODES` Set 모두 additive 변경으로 기존 동작을 깨지 않으며, 테스트 내 `process.env` 및 `Logger.prototype.warn` spy 조작은 모두 적절히 복원된다. 원본 예외의 차단 host/IP 정보가 서버 로그에도 남지 않는 관찰가능성 갭은 의도된 정찰 면 축소 설계이며, 이 트레이드오프는 릴리스 노트에 명시하는 것이 권장된다.

---

## 위험도

LOW
