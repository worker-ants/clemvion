# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 2: execution-failure-classifier.ts

- **[INFO]** `INTERNAL_CODES` Set에 `'DB_HOST_BLOCKED'` 항목 추가
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` L424
  - 상세: 모듈-레벨 `const` Set에 값을 추가한다. Set은 선언 시 초기화되므로 런타임에 변경이 없고 immutable하게 사용된다. 기존 `classifyExecutionFailure` 함수 시그니처·반환 타입은 변경되지 않는다. `DB_HOST_BLOCKED` 코드가 unknown-fallback 경로(warn 로그 emit)로 떨어지지 않게 되는 것이 의도된 동작이며, 부작용이 아니다.
  - 제안: 없음. 의도된 변경이다.

### 파일 3: error-codes.ts

- **[INFO]** `ErrorCode` const 객체에 `DB_HOST_BLOCKED: 'DB_HOST_BLOCKED'` 속성 추가
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` L556
  - 상세: `ErrorCode`는 `as const`로 선언된 read-only 객체이다. 새 속성 추가는 `ErrorCodeValue` 타입 유니언을 확장하며, 이 타입을 exhaustive switch로 처리하는 코드가 있다면 컴파일 에러가 발생할 수 있다. 그러나 `ErrorCodeValue`는 200+ 항목의 string 유니언이고, 실제로 exhaustive switch를 강제하는 패턴은 보이지 않는다. `buildErrorEnvelope` 함수의 시그니처는 `code: ErrorCodeValue`를 받으므로 호환성 문제 없음.
  - 제안: 없음. `as const` 구조상 기존 코드에 런타임 부작용은 없다.

### 파일 5: database-query.handler.ts

- **[INFO]** SSRF 가드 catch 블록에서 `assertSafeOutboundHostResolved` 예외를 `IntegrationError('DB_HOST_BLOCKED', ...)` 로 재throw
  - 위치: L1812–L1821
  - 상세: 이전에는 `assertSafeOutboundHostResolved` 가 throw하는 plain `Error`가 catch 블록 하단의 `mapDbError` 경로로 흘러 `INTEGRATION_CALL_FAILED` 코드를 반환했다. 변경 후에는 `IntegrationError`로 승격되어 `err instanceof IntegrationError` 분기에서 `DB_HOST_BLOCKED` 코드가 직접 surface 된다. 기존 `INTEGRATION_CALL_FAILED` 코드를 기대하는 클라이언트·테스트가 있다면 동작 변경이 관찰될 수 있다.
  - 제안: 이 변경은 의도된 것이며 spec §6.2 와 일치한다. 단, 변경 전 `INTEGRATION_CALL_FAILED` 코드를 분기 조건으로 사용하는 워크플로우 정의가 사용자 데이터에 존재할 경우 분기 로직이 달라진다. 데이터 마이그레이션 또는 변경 이력에서 이 점을 명시하는 것이 권장된다.

- **[INFO]** catch 블록의 empty catch(`catch { ... }`)가 원본 예외 정보를 삭제
  - 위치: L1815
  - 상세: `catch` 바인딩 없이 원본 `Error`를 버린다. 원본 `assertSafeOutboundHostResolved`의 에러 메시지(차단 IP/호스트 정보)는 `logUsage`에도 남지 않는다 — `IntegrationError`로 교체된 후 `toLogError(err)`가 호출되기 때문이다. 서버 측 관찰가능성(Observability) 관점에서 차단 대상 host/IP 로그가 필요하다면 별도 처리가 있어야 한다.
  - 제안: 운영 디버깅을 위해 catch 블록 내에서 원본 에러를 `logger.warn` 또는 structured log로 기록하거나, `toLogError` 에 원본 에러 정보를 포함시키는 방안을 검토한다. 단, 이 정보가 외부에 노출되지 않아야 한다는 정찰 면 축소 원칙과의 균형을 고려해야 한다.

### 파일 4: database-query.handler.spec.ts

- **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수를 테스트 내에서 수정 후 `finally` 블록에서 복원
  - 위치: L744–L765
  - 상세: `process.env.ALLOW_PRIVATE_HOST_TARGETS`를 직접 조작한다. `finally` 블록에서 원래 값으로 복원하므로 동일 프로세스 내 다른 테스트에 영향을 주지 않는다. Jest의 기본 설정에서 각 test file은 별도 Worker에서 실행되므로 파일 간 경합은 없다.
  - 제안: 없음. try/finally 패턴으로 안전하게 복원된다.

### 파일 1: execution-failure-classifier.spec.ts

- **[INFO]** `Logger.prototype.warn` 을 `jest.spyOn`으로 mock 후 `mockRestore()` 호출
  - 위치: L47–L53
  - 상세: 테스트 내에서 NestJS Logger의 프로토타입 메서드를 spy하고 복원한다. `mockRestore()`로 prototype을 원상복구하므로 다른 테스트에 영향을 주지 않는다. 기존 Unknown fallback 테스트도 동일 패턴을 사용하여 일관성이 있다.
  - 제안: 없음.

### 파일 6: plan/in-progress/http-ssrf-all-auth-followups.md

- **[INFO]** plan 파일 체크박스 상태 변경(미완료 → 완료)
  - 위치: 해당 행
  - 상세: plan 파일의 `- [ ]` → `- [x]` 변경은 추적 정보 갱신이며 런타임 부작용 없음.

### 파일 7: spec/4-nodes/4-integration/2-database-query.md

- **[INFO]** SSRF 가드 설명 및 에러 코드 표 갱신
  - 위치: SSRF 가드 callout, §6.2 에러 코드 표
  - 상세: spec 문서의 prose 및 에러 코드 열거 갱신. 런타임 코드에 직접 영향 없음. 기존 spec이 SSRF 차단 시 `INTEGRATION_CALL_FAILED`(fallback)를 반환 코드로 기재했으나 이를 `DB_HOST_BLOCKED`로 교체하였으므로 spec-impl 일관성이 확보된다.
  - 제안: 없음.

---

## 요약

이번 변경은 Database Query SSRF 차단 시 반환 에러 코드를 generic `INTEGRATION_CALL_FAILED`(mapDbError fallback)에서 전용 `DB_HOST_BLOCKED` IntegrationError 로 승격하는 단일 목적 PR이다. 의도하지 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 오염, 외부 네트워크 호출, 이벤트/콜백 변경은 없다. 주목할 만한 동작 변경은 (1) SSRF 차단 경로의 에러 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED`로 바뀌어 기존에 해당 코드를 분기 조건으로 사용하는 저장된 워크플로우가 있다면 분기 동작이 달라질 수 있다는 점, (2) 원본 예외 정보(차단 host/IP)가 서버 로그에도 기록되지 않아 운영 관찰가능성에 갭이 생긴다는 점이다. 두 가지 모두 의도된 설계 결정(메시지 일반화로 정찰 면 축소, 코드 대칭성 확보)과 직결되며 스펙과 일치한다.

---

## 위험도

LOW
