# 유지보수성(Maintainability) 리뷰

## 발견사항

### loader.ts

- **[WARNING]** 매직 넘버 `32` (replay 루프 인자 개수 상한)
  - 위치: `codebase/packages/web-chat-sdk/src/loader.ts` line 139 — `(raw as ArrayLike<unknown>).length > 32`
  - 상세: `32` 가 무엇을 의미하는지 코드만 보면 즉시 파악하기 어렵다. "큐 항목당 최대 인자 수" 상한임을 알려면 주석을 읽어야 한다.
  - 제안: `const MAX_QUEUE_CALL_ARITY = 32;` 와 같이 파일 상단 또는 `installGlobal` 직전에 named constant 로 추출하고 주석으로 의도(방어적 상한) 명시.

- **[WARNING]** replay 루프 내 복합 검증 조건 — 가독성·테스트 가능성 저하
  - 위치: `loader.ts` lines 134–142 (`if (typeof raw !== "object" || raw === null || ...)`)
  - 상세: 5개 OR 조건이 단일 if 안에 인라인으로 나열되어 있다. 각 조건이 어떤 방어 목적인지 주석이 있어도, 이 블록 자체를 독립적으로 단위 테스트하거나 재사용하기 어렵다.
  - 제안: `function isValidQueueEntry(raw: unknown): raw is ArrayLike<unknown>` 헬퍼로 추출. 반환 타입을 type predicate 로 지정하면 이후 `Array.from(raw)` 캐스팅도 자연스럽게 해소된다.

- **[INFO]** `w` 변수명 — 의미가 약한 단축 이름
  - 위치: `loader.ts` line 113 — `const w = win as unknown as Record<string, unknown>;`
  - 상세: `w` 는 기능적으로 문제없지만 `winRecord` 또는 `winAsRecord` 처럼 의도를 드러내는 이름이 코드베이스 내 단축 명 사용 패턴에 더 부합한다.
  - 제안: `const winRecord = win as unknown as Record<string, unknown>;` 으로 변경.

---

### loader.spec.ts

- **[WARNING]** 부트 설정 객체 `{ apiBase: "a", triggerEndpointPath: "t" }` 10회 이상 리터럴 반복
  - 위치: `loader.spec.ts` — `describe("createGlobalApi")` 및 `describe("installGlobal")` 전체
  - 상세: 동일한 픽스처 객체가 10번 이상 인라인으로 복사되어 있다. `BootConfig` 스키마(예: 필드명 변경)가 바뀌면 전체를 일일이 수정해야 하며 누락 시 오류가 생긴다.
  - 제안: 테스트 파일 상단에 `const BOOT_CONFIG_FIXTURE = { apiBase: "a", triggerEndpointPath: "t" } satisfies BootConfig;` 상수를 선언하고 각 호출 지점에서 참조.

- **[WARNING]** `QueueStub` 스텁 초기화 패턴 2회 중복
  - 위치: `loader.spec.ts` lines 278–282, 374–377 (각 describe 내 스텁 생성 블록)
  - 상세: `stub.q = []; (window as ...).ClemvionChat = stub;` 패턴이 거의 동일하게 두 테스트에 반복된다.
  - 제안: `function makeQueueStub(): QueueStub { ... }` 헬퍼를 `fakeInstance` 와 같은 위치(파일 상단)에 두어 재사용.

- **[INFO]** 한/영 혼용 주석 — 일관성 부재
  - 위치: `loader.spec.ts` lines 378–380 (`// Queue: first boot (throws), then open`, `// will throw`, `// boot 전 no-op`)
  - 상세: 나머지 테스트 주석은 한국어인데 이 블록만 영어다. 프로젝트 전체 주석 언어 컨벤션(한국어)과 맞지 않는다.
  - 제안: 해당 주석을 한국어로 통일.

- **[INFO]** `fakeInstance` 반환 타입에 익명 교차 타입 — 내부 재사용성 한계
  - 위치: `loader.spec.ts` line 176 — `function fakeInstance(): ChatInstance & { calls: string[] }`
  - 상세: 테스트 파일 내 여러 곳에서 반환 타입을 직접 언급하지 않아 당장 문제가 없지만, 타입을 `type FakeChatInstance = ChatInstance & { calls: string[] };` 로 명명하면 이 유틸이 파일 간 이동할 때 타입 재사용이 용이해진다.
  - 제안: 파일 상단에 `type FakeChatInstance = ChatInstance & { calls: string[] };` 를 선언하고 `fakeInstance` 반환 타입을 교체.

---

## 요약

`loader.ts` 는 dispatcher 패턴을 switch 문으로 명확히 구현하고 한국어 주석이 의도를 잘 설명한다. 주요 개선 여지는 두 곳이다. 첫째, replay 루프의 `32` 매직 넘버와 5중 OR 조건 블록으로, named constant 추출과 type predicate 헬퍼 분리가 가독성·테스트 가능성 모두에 유리하다. `loader.spec.ts` 는 `fakeInstance` 팩토리를 잘 활용하나 부트 설정 픽스처 10회 이상 반복과 스텁 초기화 패턴 중복이 스키마 변경 시 유지보수 부담을 높인다. 단일 픽스처 상수와 스텁 헬퍼 함수로 해소하면 이후 `BootConfig` 필드 추가·변경에 대한 내성이 크게 높아진다.

## 위험도

LOW
