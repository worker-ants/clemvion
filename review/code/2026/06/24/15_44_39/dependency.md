# 의존성(Dependency) 리뷰 결과

리뷰 대상 커밋: `ecd70dd` — refactor(execution-engine): M-4 park-진입 dispatch 를 ParkEntryDispatch registry 로 추출

---

## 발견사항

### [INFO] 신규 외부 패키지 없음 — 내부 모듈 재구성만 수행
- 위치: `park-entry-dispatch.ts` 전체
- 상세: 이번 변경은 순수 내부 리팩토링이다. `park-entry-dispatch.ts` 가 import 하는 5개 모듈 (`Node` 엔티티, `Execution` 엔티티, `ExecutionContext`, `ProcessTurnResult`, `GraphEdge`) 은 모두 프로젝트 내부 경로(`../`, `../../shared/`)이며, npm 패키지를 신규 추가하지 않는다. `package.json` / `package-lock.json` 변경 없음.
- 제안: 없음.

### [INFO] 내부 의존 방향 — leaf 모듈로 추출, 순환 없음
- 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts`
- 상세: 신규 `park-entry-dispatch.ts` 는 엔티티·인터페이스·공유 타입만 import 하며, `execution-engine.service.ts` 나 다른 서비스를 역참조하지 않는다. 이는 기존 `resume-turn-dispatch.ts` 선례와 동일한 leaf 모듈 구조다. `execution-engine.service.ts` → `park-entry-dispatch.ts` 단방향만 존재한다. ES module 순환 우려 없음.
- 제안: 없음.

### [INFO] NestJS DI forwardRef 사용 지속 — 의존성 선례 내 범위
- 위치: `execution-engine.service.ts` constructor, `@Inject(forwardRef(() => AiTurnOrchestrator))` 등
- 상세: `forwardRef` 사용은 이번 변경에서 신규 추가된 것이 아니라 C-1 step2/step3 에서 이미 도입된 기존 패턴이다. M-4 는 `forwardRef` 주입 대상을 추가하거나 변경하지 않는다. `parkEntryRegistry` getter 는 `this`-bound 클로저로 `waitForX` 를 전달하며, DI 컨테이너 외부에서 의존성을 구성하는 방식이 `resumeTurnRegistry` 의 기존 패턴과 동일하다.
- 제안: 없음.

### [INFO] 테스트 파일 의존성 — 프로젝트 내부 단일
- 위치: `park-entry-dispatch.spec.ts` import
- 상세: `jest.fn()` 은 프로젝트 전체가 이미 채택한 Jest 테스트 프레임워크를 사용한다. 추가 `devDependencies` 없음. `PARK_RELEASED` 는 `../../shared/execution-resume/process-turn-result` 내부 경로이며 외부 패키지가 아니다.
- 제안: 없음.

---

## 요약

M-4 변경은 `execution-engine.service.ts` 내부의 park 진입 분기(form/buttons/ai) 삼중 중복을 `park-entry-dispatch.ts` leaf 모듈로 추출한 behavior-preserving 리팩토링이다. 신규 외부 npm 패키지·라이브러리 추가가 전혀 없으며, 모든 import 는 프로젝트 내부 경로다. 신규 파일은 엔티티와 공유 타입만 참조하는 순수 leaf 구조로 ES module 순환을 도입하지 않는다. NestJS `forwardRef` 사용은 기존 C-1 단계에서 확립된 패턴을 그대로 유지하며 변경이 없다. 의존성 관점에서 이 변경은 위험 요소가 없다.

---

## 위험도

NONE
