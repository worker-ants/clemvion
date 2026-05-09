## 아키텍처 리뷰 — ContinuationBusService 부팅 Race 수정

### 발견사항

---

**[WARNING]** `publisher!: Redis` 타입 선언과 런타임 가드의 불일치
- **위치**: `continuation-bus.service.ts` — 필드 선언부 (`private publisher!: Redis`)와 각 메서드 진입부 `if (!this.publisher)` 가드
- **상세**: TypeScript 의 definite assignment assertion (`!`)은 "이 필드는 사용 전 반드시 할당됨"을 컴파일러에게 약속한다. 그런데 바로 그 필드를 `undefined` 일 수 있다고 가정하는 런타임 가드를 추가함으로써 두 선언이 모순을 이룬다. 타입 시스템이 거짓을 말하게 되고, `publisher`를 직접 사용하는 다른 코드 경로(예: `onModuleDestroy` 의 `this.publisher?.quit()`)가 `?` 옵셔널 체이닝을 혼용해야 하는지 불분명해진다.
- **제안**: `private publisher: Redis | undefined` 로 선언을 솔직하게 수정하거나, 또는 `OnApplicationBootstrap` 이동으로 근본 원인이 제거된 이상 `publish`/`acquireLock`/`releaseLock` 의 가드를 제거하고 진짜 공개 API 경계(외부 모듈에서 직접 호출하는 경우)에만 가드를 남기는 방향으로 정리한다.

---

**[WARNING]** 동일 상황에 대한 로거 심각도 불일치
- **위치**: `continuation-bus.service.ts`
  - `publish` 미초기화 → `this.logger.error(...)`
  - `acquireLock` 미초기화 → `this.logger.error(...)`
  - `releaseLock` 미초기화 → `this.logger.warn(...)`
- **상세**: 세 메서드 모두 "publisher 미초기화" 라는 동일한 프로그래밍 결함을 가리킨다. 운영 중 알림 임계값이 severity 기준으로 설정되는 경우, `releaseLock` 만 `warn` 이면 같은 클래스의 동일 결함이 일관되지 않게 다루어진다.
- **제안**: 세 메서드를 모두 `error` 또는 모두 `warn` 으로 통일한다. 아직 lock 을 확보하지도 못한 `releaseLock` 이 `warn` 인 근거가 있다면 코드 주석에 명시한다.

---

**[WARNING]** 방어적 가드와 근본 수정이 동시에 존재하는 이중 방어 — 책임 경계 모호
- **위치**: `continuation-bus.service.ts` (가드) + `execution-engine.service.ts` (lifecycle 이동)
- **상세**: `OnApplicationBootstrap` 이동으로 루트 원인이 완전히 차단되면, `ContinuationBusService` 의 가드가 방어하는 대상은 오직 "다른 서비스가 `onApplicationBootstrap` 이전 단계에서 직접 이 메서드를 호출하는 경우" 다. 이 경로가 현재 코드베이스에 실재한다면 가드는 정당하지만, 그렇지 않다면 계층 경계가 모호해진 채 남아 있다. 향후 기여자가 "이 가드가 필요한가?" 를 판단하기 어려워진다.
- **제안**: 주석에 "이 가드는 `ExecutionEngineService` 이외의 다른 소비자가 부팅 중 직접 호출하는 경우를 위함" 이라고 의도를 명확히 기술하거나, 실재하는 경로가 없다면 가드를 제거하고 `publisher!` 단언을 신뢰한다.

---

**[INFO]** 테스트에서 `private` 필드를 `unknown as` 캐스팅으로 직접 조작
- **위치**: `continuation-bus.service.spec.ts` — `publisher 미초기화 가드` describe 블록
- **상세**: `(bus as unknown as { publisher?: unknown }).publisher = undefined` 패턴은 구현 내부를 테스트가 직접 건드리는 구조로, 리팩터링 시 테스트가 먼저 깨지는 fragile test 가 된다. 동시에 `finally { ref.publisher = original; }` 복원 패턴은 beforeEach/afterEach 에서 관리해야 할 테스트 픽스처 관심사가 케이스 안에 섞이는 단점이 있다.
- **제안**: 당장 수정이 필요한 수준은 아니지만, 향후 `publisher` 가드 로직이 안정화되면 테스트를 `beforeEach`/`afterEach` 로 픽스처를 관리하거나, 패키지 경계를 `@VisibleForTesting` 수준으로 공개하는 방향으로 개선을 고려한다.

---

**[INFO]** Plan 문서 상태 불일치 — `in-progress/` 에 있으나 구현이 완료됨
- **위치**: `plan/in-progress/fix-continuation-bus-bootstrap-race.md`
- **상세**: 모든 체크박스가 `[ ]` 인 채로 파일이 포함되어 있으나, 실제 코드 변경(구현, 테스트, 가드)은 이미 완료된 상태다. CLAUDE.md 규약상 모든 항목 완료 시 `plan/complete/` 로 `git mv` 해야 하며, 미체크 항목이 남아 있으면 이 폴더에서 나올 수 없다.
- **제안**: TEST WORKFLOW / REVIEW WORKFLOW / 마무리 항목을 모두 체크한 뒤 `git mv plan/in-progress/fix-continuation-bus-bootstrap-race.md plan/complete/` 로 이동한다.

---

**[INFO]** Plan 문서 내 외부 절대 경로 참조
- **위치**: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` — line 3
- **상세**: `` [`/Users/gehrig/.claude/plans/sorted-shimmying-wirth.md`](../../sorted-shimmying-wirth.md) `` 는 로컬 절대 경로를 가리키며 저장소 외부다. 다른 개발자나 CI 환경에서 이 링크를 따라갈 수 없다.
- **제안**: 저장소 내부 경로로 교체하거나, 해당 분석 문서를 `plan/` 또는 `memory/` 에 포함시킨다.

---

### 요약

이번 변경의 핵심인 `recoverStuckExecutions` 호출 시점을 `onModuleInit` → `onApplicationBootstrap` 으로 이동하는 결정은 아키텍처적으로 정확하다. NestJS 의 라이프사이클 시맨틱(`onApplicationBootstrap` = 모든 모듈의 `onModuleInit` 완료 후)을 정확히 활용해 교차 서비스 초기화 순서 문제를 프레임워크 보장으로 해결한 것이다. 추가된 방어적 가드(`!this.publisher` 체크)는 외부 소비자나 미래의 호출 경로에 대한 심층 방어(defense-in-depth)로서 가치가 있지만, `publisher!: Redis` 선언과의 타입 모순 및 `releaseLock` 의 로거 심각도 불일치를 정리하지 않으면 향후 기여자가 의도를 오해할 여지가 있다. 변경 범위는 최소화되어 있고 회귀 방지 테스트가 적절히 추가되어 있으므로 구조적 위험은 낮다.

### 위험도

**LOW**