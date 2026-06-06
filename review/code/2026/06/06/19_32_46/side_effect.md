# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `PARK_RELEASED` / `ProcessTurnResult` 모듈 이관 — 전역 Symbol 정체성 보존 확인
- 위치: `shared/execution-resume/process-turn-result.ts` (신규), `execution-engine.service.ts` diff
- 상세: `PARK_RELEASED = Symbol('park_released')` 가 service 로컬 상수에서 공유 모듈로 이관됐다. Symbol 은 모듈 인스턴스당 한 번만 생성되며 Node.js 모듈 캐시가 싱글턴을 보장하므로, `service.ts` 와 `spec.ts` 에서 동일 경로를 import 하면 동일 Symbol 인스턴스를 참조한다. `Symbol.for` 가 아닌 로컬 `Symbol()` 이지만 단일 모듈 파일이므로 정체성 파편화 위험 없음. 이 점은 테스트의 `expect(out).toBe(PARK_RELEASED)` 가 동일 import 를 사용하고 있어 올바르다.
- 제안: 현재 구조 유지 — 부작용 없음.

### [INFO] `_resumeTurnRegistry` 인스턴스 필드 — 지연 초기화 캐시
- 위치: `execution-engine.service.ts` L977, getter `resumeTurnRegistry`
- 상세: `_resumeTurnRegistry` 는 `private _resumeTurnRegistry?: readonly ResumeTurnDispatch[]` 로 선언되어 서비스 인스턴스가 살아있는 동안 유지된다. `resumeTurnRegistry` getter 가 처음 호출될 때 `this` 의 메서드들(`processFormResumeTurn`, `processButtonResumeTurn`, `handleAiResumeTurn`, `isCheckpointEligibleNodeType`)을 캡처하는 closure 배열을 생성한다. 서비스가 NestJS DI 싱글턴이므로 인스턴스당 한 번만 생성되며, 이 자체는 의도된 동작이다.
- 주의: 테스트 `afterEach` 에서 `(service as unknown as DispatchSubject)._resumeTurnRegistry = undefined` 로 registry 캐시를 명시 리셋하고 있어, 테스트 간 레지스트리 상태 누수 방지가 잘 처리됐다. 단, 프로덕션에서는 registry 항목이 `this` 바인딩이므로 서비스 메서드를 monkey-patch 해도 이미 캐시된 registry 의 closure 는 갱신되지 않는다 — 그러나 프로덕션에서 monkey-patch 는 발생하지 않으므로 무해.
- 제안: 현재 구조 유지.

### [INFO] `handleAiResumeTurn` 의 `contextService.setNodeOutput` 호출 — 공유 상태 변경
- 위치: `execution-engine.service.ts`, `handleAiResumeTurn` 내부
- 상세: `this.contextService.setNodeOutput(...)` 이 호출되어 실행 컨텍스트의 `nodeOutputCache` 를 변경한다. 이는 추출 전 `driveResumeAwaited` 내의 동일 코드에서도 발생하던 부작용이며, 기능 변경이 아니라 단순 이동이다. `dispatchResumeTurn` 을 통해 AI 경로에서만 도달하므로 form/button 재개 시에는 이 side-effect 가 발생하지 않는다. 동작 보존 확인됨.
- 제안: 현재 구조 유지.

### [INFO] `driveResumeFrame` 에서 `dispatchResumeTurn` 위임 — `isAiConversation` 기본값 처리
- 위치: `execution-engine.service.ts` diff, `driveResumeFrame` 내부 `dispatchResumeTurn` 호출
- 상세: 추출 전 `driveResumeFrame` 에서는 `opts.isAiConversation` 을 직접 비교했고, 추출 후에는 `isAiConversation: opts.isAiConversation ?? false` 로 `null/undefined` 를 `false` 로 coerce 한다. `opts.isAiConversation` 이 `boolean | undefined` 타입이면 `undefined` 시 AI 경로로 오진입하지 않으므로 안전하다. 타입 단언 없이 `?? false` 를 사용한 것은 방어적으로 올바르다.
- 제안: 현재 구조 유지.

### [INFO] 테스트 파일 — 전역 변수(`resolvedService`) lazy reference 패턴
- 위치: `execution-engine.service.spec.ts` L388, ContinuationBusService mock 의 `publish` closure
- 상세: `resolvedService` 가 모듈 스코프 변수로 선언되고 `beforeEach` 에서 설정된다. `publish` mock 의 closure 가 이 변수를 참조한다. `dispatchResumeTurn` 테스트 suite(`describe('dispatchResumeTurn…')`)는 별도 `beforeEach` 없이 외부 `beforeEach` 로 초기화된 `service` 를 `svc` 로 캐스팅해 사용하므로, `resolvedService` 가 매 테스트 전에 최신 인스턴스로 갱신됨을 확인해야 한다. 외부 `beforeEach` 가 `resolvedService = service` 를 명시 설정하고 있어 올바름.
- 제안: 현재 구조 유지.

### [INFO] 신규 파일 `resume-turn-dispatch.ts` — 순수 타입 정의, 런타임 부작용 없음
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`
- 상세: `interface` 와 `type`(export)만 포함하며, 런타임에는 타입 소거되어 빈 모듈로 남는다. 글로벌 상태 변경, 파일시스템 접근, 네트워크 호출, 이벤트 등록 없음. 부작용 없음.

### [INFO] plan/complete/*.md 신규 파일 — 파일시스템 부작용 의도적
- 위치: `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md`, `plan/complete/spec-draft-exec-park-b2-durable.md`
- 상세: plan/complete 디렉토리에 완료된 작업 추적 문서를 추가하는 것은 프로젝트 규약(CLAUDE.md §정보 저장 위치)에 따른 의도된 파일시스템 부작용이다. 코드 동작에 영향 없음.

## 요약

이번 변경은 `execution-engine.service.ts` 내에 두 곳에 중복돼 있던 `form/buttons/ai_conversation` 분기 로직을 `dispatchResumeTurn` + `resumeTurnRegistry` 로 추출한 리팩터링이다. `PARK_RELEASED` Symbol 과 `ProcessTurnResult` 타입을 공유 모듈(`process-turn-result.ts`)로 이관하고, dispatch 추상화 인터페이스를 신규 파일(`resume-turn-dispatch.ts`)에 분리했다. 부작용 관점에서 핵심 위험인 Symbol 정체성 파편화는 단일 모듈 파일 참조로 안전하게 처리됐으며, `_resumeTurnRegistry` 지연 초기화 캐시가 서비스 인스턴스 변수를 변경하나 이는 의도된 최적화이며 테스트 `afterEach` 에서 리셋된다. `contextService.setNodeOutput` 을 통한 공유 상태 변경은 추출 전 코드에서도 동일하게 발생하던 부작용으로 동작 보존 확인됨. plan 파일 추가는 프로젝트 규약에 따른 의도된 파일시스템 변경이다. 전반적으로 새로운 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
