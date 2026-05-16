# 아키텍처(Architecture) 리뷰

리뷰 대상:
- `backend/src/modules/integrations/integrations.service.ts` (변경)
- `backend/src/modules/integrations/integrations.service.spec.ts` (변경)
- `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx` (변경)

---

### 발견사항

- **[INFO]** `IntegrationsService` 내 best-effort audit 방어선의 이중 레이어 설계는 의도된 방어적 프로그래밍
  - 위치: `integrations.service.ts` L538–144 (diff 기준)
  - 상세: `AuditLogsService.record` 자체가 이미 내부 try/catch로 swallow하고 있음에도, 상위 서비스 레이어인 `IntegrationsService.create`에 추가 try/catch를 배치했다. 이는 "내부 구현이 향후 변경되어 throw하도록 바뀌어도 호출자가 안전하게 유지된다"는 의도로, 주석에 명확히 문서화되어 있다. 아키텍처 관점에서는 이중 방어선이 인터페이스 계약(AuditLogsService는 절대로 throw하지 않아야 한다)을 코드 레벨에서 강제하지 않고 주석으로만 약속하는 구조로, 계약이 흐려질 수 있다.
  - 제안: `AuditLogsService`의 `record` 메서드 시그니처 또는 JSDoc에 "이 메서드는 절대 throw하지 않음(never throws)"을 명시적으로 선언하고, 실제 구현도 그 계약을 단언(assert)하는 형태로 강화하면 `IntegrationsService` 측의 방어 try/catch를 제거하거나 lint 예외로 처리할 수 있다. 현재 이중 방어 자체는 기능상 문제없으나, 장기적으로 서비스 계약(interface contract)을 타입/주석으로 더 명확하게 표현하는 것이 바람직하다.

- **[INFO]** `create` 메서드 내 단계별 try/catch 분리로 흐름 가독성이 향상됨
  - 위치: `integrations.service.ts` L538–544 (save 블록), L549–143 (audit 블록)
  - 상세: 이전 구현은 save와 audit을 동일 try/catch로 묶어, uniqueness 위반 감지 로직(`throwIfUniqueViolation`)이 실제로는 audit 실패 경로와 혼재될 위험이 있었다. 리팩토링 후 save 블록과 audit 블록을 명확히 분리하여 각 구역의 에러 처리 의도가 명확해졌다. 단일 책임 관점에서 긍정적인 변경이다.
  - 제안: 현재 구조 유지. 추가로 향후 audit 외 부작용(예: 이벤트 발행, 알림 등)이 생길 경우, 별도 서비스 메서드로 추출하거나 파이프라인 패턴(observer/event emitter)을 고려할 수 있다.

- **[INFO]** `EntityAwareTester`의 out-of-band 등록 패턴은 의존성 역전의 적절한 응용
  - 위치: `integrations.service.ts` L365–372 (`registerEntityTester`)
  - 상세: `IntegrationsModule`이 `nodes/*`나 `Cafe24Module`을 직접 import하지 않고, 외부 모듈이 `onModuleInit`에서 tester를 주입하는 구조는 의존성 역전 원칙(DIP)과 개방-폐쇄 원칙(OCP)을 잘 따른다. 새로운 서비스 타입을 추가할 때 `IntegrationsService` 코드를 수정하지 않아도 되므로 확장성이 높다.
  - 제안: 현재 구조 유지. 단, 주석의 calling contract("invoke once per service_type")가 런타임에 강제되지 않고 경고 로그로만 처리되므로, 향후 복수 모듈이 동일 service_type에 대해 실수로 중복 등록하는 경우를 방지하기 위해 프로덕션 환경에서는 중복 등록 시 예외를 던지도록 강화를 고려할 수 있다(현재 테스트 편의를 위해 경고만 발행하는 것은 이해 가능한 절충).

- **[INFO]** 테스트 파일의 `advanceDebounce` 헬퍼 함수 추출은 DRY 원칙 준수
  - 위치: `cafe24-precheck.test.tsx` L584–590 (추가된 헬퍼)
  - 상세: 8개 이상의 테스트 케이스에서 반복되던 `await act(async () => { vi.advanceTimersByTime(360); })` 패턴을 `advanceDebounce()` 함수와 `DEBOUNCE_ADVANCE_MS` 상수로 추출하여 매직 넘버 분산을 제거했다. 프로덕션 debounce 값(350ms)이 변경될 때 테스트 코드도 한 곳만 수정하면 되므로 유지보수성이 향상된다. 테스트 레이어의 추상화 수준이 적절하게 정리되었다.
  - 제안: `DEBOUNCE_ADVANCE_MS`가 프로덕션 코드의 debounce 상수와 별도로 관리되고 있어, 프로덕션 측 debounce 값이 변경될 때 테스트의 `DEBOUNCE_ADVANCE_MS`가 자동으로 동기화되지 않는다. 가능하다면 프로덕션 코드에서 debounce 값을 상수로 export하고 테스트에서 그 값을 import하여 +10ms 버퍼만 추가하는 방식을 고려할 수 있다. 현재 주석으로 연결 관계를 문서화한 것은 차선책으로 적절하다.

- **[INFO]** `PublicIntegration` 타입을 spec 파일에서 test 파일로 import하는 구조
  - 위치: `integrations.service.spec.ts` L35 (`import type { PublicIntegration }`)
  - 상세: 테스트 코드가 서비스 구현 파일(`integrations.service.ts`)에서 직접 `PublicIntegration` 타입을 import한다. 이 타입은 공개 API 계약을 나타내므로 서비스 구현 파일에 위치하는 것이 자연스럽고, 현재 배치는 레이어 경계를 위반하지 않는다. 다만 타입이 서비스 구현 파일에 함께 있어 나중에 타입만 분리하고 싶을 때 import 경로를 수정해야 한다.
  - 제안: 현재 구조 유지. 타입 수가 늘어날 경우 `integrations.types.ts`와 같은 전용 파일로 분리를 검토할 수 있으나, 현 시점에서 조기 분리는 과도한 추상화에 해당한다.

---

### 요약

이번 변경은 `IntegrationsService.create` 내의 save 단계와 audit 단계를 명확히 분리하여 에러 처리 의도를 코드 구조로 표현한 것이 핵심이다. best-effort audit 방어선의 이중 레이어는 의도적이고 명확하게 문서화되어 있으며, `AuditLogsService`의 내부 계약 변화에 대한 회귀 방지 목적으로 합리적이다. `EntityAwareTester`의 out-of-band 등록 패턴은 DIP/OCP를 잘 따르며 모듈 경계가 명확하다. 프론트엔드 테스트의 `advanceDebounce` 헬퍼 추출은 소규모지만 DRY 원칙 관점에서 의미 있는 개선이다. 전반적으로 아키텍처 상의 중대한 결함은 없으며, 발견된 사항은 모두 향후 개선을 위한 제안 수준이다.

### 위험도

LOW
