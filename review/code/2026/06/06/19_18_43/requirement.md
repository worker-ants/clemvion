# 요구사항(Requirement) 리뷰 — exec-park B-1 `dispatchResumeTurn` 추출

리뷰 대상: 파일 1~8 (exec-park-followup-272c4f worktree)

---

## 발견사항

### [INFO] `dispatchResumeTurn` 은 spec §7.5 도식(diagram)에 미명시 — 구현이 올바르고 spec 이 낡음
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` (신규), `execution-engine.service.ts` L1000~1070
- 상세: spec §7.5 rehydration 다이어그램("form → `processFormResumeTurn`, button → …, AI → `processAiResumeTurn`")은 `driveResumeAwaited`/`driveResumeFrame` 이 직접 분기해 각 처리기를 호출하는 구조로 서술한다. 이번 변경은 그 3분기를 `dispatchResumeTurn` + `resumeTurnRegistry`(ordered first-match-wins registry)로 일원화하며, **동작 보존**(form → buttons → ai 우선순위·에러코드·PARK_RELEASED 의미)은 코드와 테스트로 보증됐다. 코드가 명백히 의도적 개선이다.
- 제안: [SPEC-DRIFT] 코드 유지. `spec/5-system/4-execution-engine.md §7.5` 다이어그램의 `driveResumeAwaited`/`driveResumeFrame` 직접 분기 서술에 `dispatchResumeTurn`(registry 위임) 주석을 추가하는 spec 갱신이 권장됨. 갱신 대상: §7.5 rehydration 다이어그램 `driveResumeAwaited`/`driveResumeFrame` 분기 설명부.

---

### [INFO] `ResumeTurnSelector.blockingInteraction` 필드가 spec §7.5 테이블에 미등장
- 위치: `resume-turn-dispatch.ts` `ResumeTurnSelector` 인터페이스
- 상세: spec은 `NodeExecution.outputData.meta.interactionType`(영속 값)만 언급하며, 핸들러 metadata의 `interaction` 필드(`blockingInteraction`)를 dispatch 신호로 쓰는 계약은 spec 본문에 없다. 이는 구현 세부 사항이고 form 선택 방식이 바뀐 것이 아니므로 spec 누락이지 불일치는 아니다.
- 제안: [SPEC-DRIFT] 코드 유지. spec §7.5 또는 §5.5 에 "form 노드는 handler metadata kind=blocking, interaction=form 으로 식별" 설명을 추가하면 명확해짐.

---

### [INFO] `ai_form_render` interaction type 에 대한 dispatch 분기 없음
- 위치: `execution-engine.service.ts` `resumeTurnRegistry` getter (L1028~1036), `ResumeTurnSelector` 주석
- 상세: `ResumeTurnContext.isAiConversation` 의 주석은 "`ai_conversation` / `ai_form_render` 여부"라고 명시한다. 그러나 `ai_form_render`는 현재 `ai_conversation` 분기(`handleAiResumeTurn`)로 흡수된다. 이것이 의도된 설계(같은 핸들러로 처리)인지, 별도 분기가 필요한지는 spec에 `ai_form_render`의 재개 경로가 명시되지 않아 판단 불가하다. 현재 코드상 `isAiConversation: true`를 충족하면 같은 핸들러로 라우팅되므로 동작상 회귀는 없다.
- 제안: spec에 `ai_form_render` 재개 경로가 명시돼 있지 않으므로 INFO. 명시적 분기 또는 주석이 의도임을 확인하면 충분.

---

### [INFO] 테스트 comment에 "spec §7.5" 참조 있으나 "B-1" 레이블은 spec 본문에 없음
- 위치: `execution-engine.service.spec.ts` L48 `// exec-park B-1 … spec §7.5`
- 상세: 테스트 describe 블록 헤더가 "spec §7.5" 를 인용하는데, `dispatchResumeTurn` 함수 자체는 spec §7.5 서술의 직접 구현 대상이 아니라 리팩터링 추출이다. 레이블 "B-1"은 plan 내부 번호다. 오해를 줄 수 있으나 기능적 문제는 없다.
- 제안: 없음(INFO). 주석을 "spec §7.5 형식 지킴, exec-park B-1 plan 항목" 정도로 구분하면 명확해지나 강제 사항 아님.

---

### [INFO] `makeCtx` 기본값 `node.type: 'form'` 과 테스트 시나리오 불일치 없음 — 확인 완료
- 위치: `execution-engine.service.spec.ts` L58~70 (`makeCtx`)
- 상세: `makeCtx`의 기본 `persistedInteractionType: undefined`·`isAiConversation: false`·`resumeCheckpoint: undefined` 조합은 AI/form/buttons 어느 selector도 충족하지 않으며, 각 테스트가 필요한 필드를 `overrides`로 주입하므로 기본값 문제 없음.

---

### [INFO] `process-turn-result.ts` 신규 파일의 `PARK_RELEASED` 심볼이 이전 `execution-engine.service.ts` 내 지역 상수와 다른 객체 — 동일성 검증 완료
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts`
- 상세: 이전 `const PARK_RELEASED = Symbol('park_released')` 는 service 모듈 스코프에서 생성됐으나, 이제 shared 모듈에서 단일 export 된다. 심볼의 `===` 동일성은 모듈 캐시 단위이므로 같은 Node.js 프로세스에서 단일 인스턴스가 보장된다. 테스트 파일도 동일 경로에서 import 하므로 불일치 없음.

---

## 기능 완전성 평가

변경의 핵심 목표(중복 제거 + extension seam 확립)는 완전히 달성됐다.

1. **기능 완전성**: `driveResumeAwaited`(top-level)과 `driveResumeFrame`(중첩) 양쪽의 form/buttons/AI 분기가 `dispatchResumeTurn` 단일 경로로 일원화됐다. 우선순위(form → buttons → ai) 및 에러 코드(`RESUME_CHECKPOINT_MISSING`) 동작 보존이 코드와 7개 단위 테스트로 확인됐다.

2. **엣지 케이스**: 체크포인트 없는 AI 재개, 알 수 없는 interaction type, form이 buttons보다 우선하는 충돌 케이스가 모두 테스트됐다. `PARK_RELEASED` 전파도 검증됐다.

3. **TODO/FIXME**: 없음.

4. **의도와 구현 간 괴리**: `handleAiResumeTurn`이 `ResumeTurnContext`를 받아 내부적으로 `buildRetryReentryState` + `processAiResumeTurn`을 호출하는 흐름이 JSDoc과 일치한다.

5. **에러 시나리오**: 매칭 처리기 없을 때 `RehydrationError(RESUME_CHECKPOINT_MISSING)` throw, AI 재구성 실패 시 `RESUME_INCOMPATIBLE_STATE` throw — spec §7.5 에러 코드 표와 일치.

6. **데이터 유효성**: `resumeCheckpoint`의 타입 캐스팅(`as Record<string, unknown>`)은 `hasResumeCheckpoint` 게이팅으로 null이 아님이 보장된 뒤 이뤄지므로 안전하다.

7. **비즈니스 로직**: spec §7.5 가 명시하는 form/button/AI 처리기 직접 호출 계약이 registry를 통해 보존된다.

8. **반환값**: `PARK_RELEASED`(AI re-park) vs `void`(노드 완료) 모든 경로에서 `ProcessTurnResult` 타입으로 명시.

9. **Spec fidelity**: spec §7.5는 `driveResumeAwaited`/`driveResumeFrame`이 처리기를 "직접" 호출한다고 서술하지만, `dispatchResumeTurn` registry 위임이 동작 보존을 하면서 추출된 것이므로 [SPEC-DRIFT]이다(코드가 옳고 spec 서술이 낡음).

---

## 요약

이번 변경은 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 중복됐던 form/buttons/AI 분기 로직을 `dispatchResumeTurn` + `resumeTurnRegistry` 단일 진입점으로 추출한 리팩터링이다. 선택 우선순위·에러 코드·`PARK_RELEASED` 전파 등 모든 동작 계약이 보존됐으며, 7개의 전용 단위 테스트가 라우팅·우선순위·재파킹·에러를 망라한다. spec §7.5는 처리기 직접 호출 구조를 서술하지만 이는 낡은 서술이며 코드가 올바른 방향으로 개선됐다(SPEC-DRIFT). `PARK_RELEASED`·`ProcessTurnResult`·`ParkSignal` 공유 타입의 `shared/execution-resume/process-turn-result.ts` 이관도 단일 인스턴스 심볼 보장과 타입 통일 목적에 부합한다. 기능 누락·비즈니스 로직 오류·에러 코드 불일치 없음.

---

## 위험도

NONE
