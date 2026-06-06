# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `PARK_RELEASED` Symbol 이관 — 동일 JS 심볼 동일성 유지 여부
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` L22, `execution-engine.service.ts` L273 (구 로컬 선언 제거 + import 대체)
- 상세: `PARK_RELEASED`를 `Symbol('park_released')`로 service 내부에 선언하던 것을 shared 파일로 이관했다. TypeScript/Node.js 모듈 시스템에서 동일 파일에서 export된 Symbol은 싱글톤(하나의 모듈 인스턴스 = 하나의 Symbol)이므로, 이전 로컬 선언이 동시에 제거(`const PARK_RELEASED = Symbol(...)` 삭제 확인)된 경우 `=== PARK_RELEASED` 비교는 계속 정확히 동작한다. 변경 diff에서 구 로컬 선언 삭제가 명시되어 있고 plan에도 "로컬 선언 동일 커밋 삭제"가 기록되어 있으므로 이중 선언 위험은 없다.
- 제안: 별도 조치 불필요. 빌드 후 `grep -n "Symbol('park_released')" execution-engine.service.ts` 가 0건이어야 함을 CI에서 확인하는 것을 권고.

### [INFO] `_resumeTurnRegistry` — 서비스 인스턴스 레벨 변경 가능 필드
- 위치: `execution-engine.service.ts` — `private _resumeTurnRegistry?: readonly ResumeTurnDispatch[]`
- 상세: lazy 초기화(`??=`)로 첫 접근 시 배열을 생성한다. NestJS의 `ExecutionEngineService`는 기본적으로 싱글톤 스코프이므로 인스턴스가 단 하나이고, 이후 할당은 발생하지 않는다. 테스트에서는 `beforeEach`마다 `Test.createTestingModule`이 새 인스턴스를 생성하므로 테스트 간 오염은 없다.
- 제안: 문제 없음. 다만 향후 테스트에서 registry를 교체/확장하는 시나리오가 생긴다면 `_resumeTurnRegistry = undefined`로 리셋하는 헬퍼가 필요할 수 있다.

### [INFO] `handleAiResumeTurn`에서 `contextService.setNodeOutput` 호출 — 공유 상태 변경
- 위치: `execution-engine.service.ts` L1925 (새로 추출된 `handleAiResumeTurn` 메서드 내부)
- 상세: `handleAiResumeTurn`은 `_resumeState`를 nodeOutputCache에 seed하는 `setNodeOutput` 호출을 포함한다. 이 동작은 구 `driveResumeAwaited`의 인라인 코드와 완전히 동일하게 추출된 것으로, 동작 변경이 아닌 이관이다. 단, `driveResumeFrame`(중첩)에서도 동일한 `dispatchResumeTurn`→`handleAiResumeTurn` 경로가 사용되므로 이제 중첩 재개 시에도 동일한 `setNodeOutput`이 실행된다. 중첩 재개에서의 context 키(`contextKeyOf`)가 올바른 scope를 가리키는지 기존 코드에서 보장된다면 부작용 없음.
- 제안: 기존 `driveResumeFrame`의 AI 분기 로직(추출 전)에도 `setNodeOutput`이 있었는지 확인 필요. diff 분석 결과 추출 전 `driveResumeFrame` AI 분기(L1300–1304)에도 동일하게 `setNodeOutput`이 있었으므로 동작 보존이 확인된다. 부작용 없음.

### [INFO] `dispatchResumeTurn` 시그니처 — `private` 메서드, 외부 노출 없음
- 위치: `execution-engine.service.ts` — `private async dispatchResumeTurn(ctx: ResumeTurnContext): Promise<ProcessTurnResult>`
- 상세: 새로 추가된 `dispatchResumeTurn`과 `handleAiResumeTurn` 모두 `private`으로 선언되었다. 공개 API에 변경이 없으며, 기존 public 메서드(`driveResumeAwaited`, `driveResumeFrame`)의 시그니처도 변경되지 않았다.
- 제안: 문제 없음.

### [INFO] 테스트 파일 — `as unknown as DispatchSubject` 패턴으로 private 메서드 접근
- 위치: `execution-engine.service.spec.ts` L76, L97, L120 등
- 상세: private 메서드를 `as unknown as DispatchSubject`로 타입 캐스팅하여 직접 호출하는 패턴이다. 테스트 파일에 국한된 패턴이고 런타임 부작용은 없다. `afterEach(() => jest.restoreAllMocks())`가 spy를 올바르게 복원하므로 다른 `describe` 블록에 오염이 없다.
- 제안: 문제 없음.

### [INFO] 새 파일 `process-turn-result.ts` — 순환 의존 없음
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts`
- 상세: 파일이 다른 모듈에 의존하지 않는다(모듈 import 0개, 순수 Symbol/type 정의). 기존 `park-release-signal.ts`(throw 기반)와는 다른 계층(return 기반)을 담당하므로 혼동은 주석으로 설명되어 있다. shared 계층의 순수성 유지 확인됨.
- 제안: 문제 없음.

### [INFO] 새 파일 `resume-turn-dispatch.ts` — 타입 전용 파일, 런타임 부작용 없음
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`
- 상세: 파일은 `import type` 만 사용하고 interface/type 선언만 포함한다. 런타임에 코드가 전혀 실행되지 않으며(타입만 트리 쉐이킹됨) 어떤 전역 상태도 건드리지 않는다.
- 제안: 문제 없음.

### [INFO] plan/complete 문서 파일들 — 코드 실행과 무관
- 위치: `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md`, `plan/complete/spec-draft-exec-park-b2-durable.md`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/exec-park-resume-dispatch-registry.md`
- 상세: 마크다운 문서 파일들로, 코드 실행·상태 변경·파일시스템 부작용과 무관하다.
- 제안: 문제 없음.

---

## 요약

이번 변경은 `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult`를 service 내부 로컬 선언에서 `shared/execution-resume/process-turn-result.ts`로 이관하고, `driveResumeAwaited`와 `driveResumeFrame` 두 곳에 중복돼 있던 form/buttons/ai 분기 블록을 `resumeTurnRegistry` + `dispatchResumeTurn` 단일 진입점으로 추출한 순수 구조 리팩토링이다. 공개 API 시그니처 변경 없음, 전역 변수 도입 없음, 파일시스템·네트워크·환경변수 부작용 없음. `_resumeTurnRegistry`는 서비스 인스턴스 필드이나 NestJS 싱글톤 스코프로 단 하나 생성되고 이후 변경되지 않으므로 공유 상태 오염 위험이 없다. `handleAiResumeTurn`이 `setNodeOutput`으로 context를 변경하는 것은 추출 전 두 호출 지점 모두에 동일하게 존재하던 동작이므로 의도치 않은 부작용이 아니다. 발견된 모든 사항은 INFO 수준으로, 동작 보존이 확인된다.

## 위험도

NONE
