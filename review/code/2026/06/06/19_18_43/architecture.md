# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] PARK_RELEASED / ProcessTurnResult 의 shared 레이어 이관 — 긍정적 변경
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규)
- 상세: 이전에 `execution-engine.service.ts` 내부에 로컬로 선언돼 있던 `PARK_RELEASED` 심볼, `ParkSignal` 타입, `ProcessTurnResult` 타입 별칭을 `shared/execution-resume/` 하위로 추출했다. `shared/` 레이어는 여러 모듈이 공유하는 순수 타입·상수의 적합한 위치이고, `resume-turn-dispatch.ts`·spec·test 모두 동일한 경로에서 import하므로 단일 진실 원칙(SRP 지원)이 잘 지켜진다.
- 제안: 없음 (긍정적 변경).

### [INFO] ResumeTurnDispatch / ResumeTurnSelector / ResumeTurnContext 인터페이스 분리 — 개방-폐쇄 원칙 개선
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-followup-272c4f/codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`
- 상세: 기존에 `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩) 두 곳에 동일한 form/buttons/ai if-else 분기가 하드코딩돼 있던 구조를 ordered registry + 인터페이스(`ResumeTurnDispatch`)로 교체했다. 새 blocking 노드 타입 추가 시 서비스 메서드를 수정하지 않고 registry 항목 1개 추가로 확장 가능하다는 점에서 OCP를 잘 준수한다. `ResumeTurnSelector`·`ResumeTurnContext` 분리도 ISP 측면에서 선택 책임과 실행 책임을 명확히 분리한다.
- 제안: 없음.

### [WARNING] `resumeTurnRegistry` 의 AI handler closure 가 `this` 를 직접 캡처 — 레이어 경계 약화
- 위치: `execution-engine.service.ts`, `resumeTurnRegistry` getter, `ai_conversation` 항목의 `selects` 함수
- 상세: `selects: (sel) => sel.isAiConversation && sel.hasResumeCheckpoint && this.isCheckpointEligibleNodeType(sel.node.type)` 에서 `this.isCheckpointEligibleNodeType`을 클로저로 직접 호출한다. `ResumeTurnDispatch` 인터페이스는 플러그인 가능한 독립 항목을 의도하지만, 실제 ai 항목의 `selects`는 서비스 인스턴스에 강하게 결합돼 있다. 외부 코드가 이 registry를 직접 조작하거나 대체하려 할 때 `this` 바인딩 문제가 잠재적으로 발생할 수 있다. 현재는 `_resumeTurnRegistry`가 `private`이므로 실제 문제는 아니지만, 확장 seam으로서의 인터페이스 독립성이 부분적으로 훼손된다.
- 제안: `isCheckpointEligibleNodeType`을 `ResumeTurnSelector` 계산 시점(즉 `dispatchResumeTurn` 내부에서 selector 빌드 시) 미리 평가해 `hasCheckpointEligibleType: boolean`으로 selector에 포함시키면, ai handler의 `selects`가 순수 값 비교로 단순화된다. 이렇게 하면 registry 항목이 서비스 인스턴스에 의존하지 않게 된다.

### [INFO] `dispatchResumeTurn`의 단일 책임 및 레이어 구분 — 양호
- 위치: `execution-engine.service.ts`, `dispatchResumeTurn` (lines ~1061–1083)
- 상세: 이 메서드는 routing 역할만 담당하고 실제 처리는 `processFormResumeTurn`, `processButtonResumeTurn`, `handleAiResumeTurn`에 위임한다. SRP 준수가 명확하다. `handleAiResumeTurn`의 분리 추출도 AI 재개의 복잡한 checkpoint 재구성 로직을 단일 메서드로 캡슐화해 가독성과 테스트 가능성을 높인다.
- 제안: 없음.

### [INFO] `ResumeTurnContext` 의 `payload: unknown` 타입 — 추상화 수준 적절하지만 미래 타입 안전성 개선 여지
- 위치: `resume-turn-dispatch.ts`, `ResumeTurnContext.payload`
- 상세: `payload: unknown`으로 선언돼 있어 각 handler가 내부에서 assertion 또는 cast를 사용해야 한다. 현재 구조에서 form/buttons/ai 의 payload shape이 서로 다르므로 union discriminated type으로 좁히기 어렵지는 않다. 단, 새 blocking 타입 추가 시 payload 타입 계약이 암묵적으로 남아 있어 컴파일 타임 보호가 부재하다.
- 제안: 즉각 수정 필요는 아니지만, 향후 `payload: FormPayload | ButtonPayload | AiPayload` 형태의 union 또는 generic `ResumeTurnContext<P>` 타입화를 고려하면 extension seam의 타입 안전성이 강화된다. 현재 규모에선 수용 가능한 트레이드오프.

### [INFO] 테스트에서 `as unknown as DispatchSubject` 패턴 사용 — private 접근 우회
- 위치: `execution-engine.service.spec.ts`, `dispatchResumeTurn` describe 블록 내 모든 테스트
- 상세: `private dispatchResumeTurn`, `private processFormResumeTurn` 등을 `as unknown as DispatchSubject`로 캐스팅해 접근한다. 이 패턴은 이 코드베이스에서 기존에도 사용하던 established 패턴(주석에도 언급)으로, 단위 테스트에서 private 메서드의 라우팅 로직을 격리 검증하는 데 실용적인 접근이다. 아키텍처 관점에서 `dispatchResumeTurn`이 충분히 중요한 계약(form→buttons→ai 우선순위, PARK_RELEASED 전파, 미지원 throw)을 가지므로 단위 테스트 당위성이 있다.
- 제안: 현재 패턴 유지. `DispatchSubject` 타입을 describe 블록 내부 지역 선언으로 둔 것도 scope 오염을 피하는 적절한 선택이다.

### [INFO] 순환 의존성 — 없음
- 위치: 전체 변경 파일
- 상세: `process-turn-result.ts`(`shared/`) ← `resume-turn-dispatch.ts`(`execution-engine/`) ← `execution-engine.service.ts` 방향의 단방향 의존성. `shared/`에서 `modules/`를 import하지 않는다. 순환 참조 없음.

## 요약

이번 변경은 두 곳에 중복 하드코딩돼 있던 form/buttons/ai 3분기 resume 라우팅 로직을 ordered registry(`resumeTurnRegistry`) + 단일 진입점(`dispatchResumeTurn`) 패턴으로 일원화하고, park sentinel 타입(`PARK_RELEASED`, `ProcessTurnResult`)을 `shared/` 레이어로 이관한 리팩터링이다. OCP(새 blocking 타입 추가 시 registry 항목 1개 추가로 충분), SRP(`dispatchResumeTurn`은 라우팅만, `handleAiResumeTurn`은 AI 재구성만), ISP(`ResumeTurnSelector` vs `ResumeTurnContext` 분리) 측면에서 명확한 개선이다. 순환 의존성 없음. 유일한 경미한 주의점은 `ai_conversation` registry 항목의 `selects` 클로저가 `this.isCheckpointEligibleNodeType`을 캡처해 registry 항목이 서비스 인스턴스에 묵시적으로 결합된다는 점이며, 이는 현재 `private` 가시성으로 제어되고 있어 실용적 위험은 낮다.

## 위험도

LOW
