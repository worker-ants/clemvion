# 변경 범위(Scope) 리뷰

## 변경 요약

이번 변경의 의도: `dispatchResumeTurn` 단일 진입점 추출(B-1) — `driveResumeAwaited`(top-level)와 `driveResumeFrame`(중첩) 양쪽에 중복 하드코딩된 form/buttons/ai if/else 분기를 `resumeTurnRegistry` ordered-registry 로 일원화.

대상 파일 4개:
1. `execution-engine.service.spec.ts` — `dispatchResumeTurn`/`handleAiResumeTurn` 단위 테스트 추가 (B-1)
2. `execution-engine.service.ts` — `resumeTurnRegistry`·`dispatchResumeTurn`·`handleAiResumeTurn` 메서드 추가, 기존 두 곳의 if/else 제거, `PARK_RELEASED`/`ProcessTurnResult` 로컬 선언 제거 후 shared 모듈 import
3. `resume-turn-dispatch.ts` — 신규 파일, `ResumeTurnDispatch`/`ResumeTurnSelector`/`ResumeTurnContext` 인터페이스 정의
4. `process-turn-result.ts` — 신규 파일, `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` shared 이관
5. `plan/complete/exec-park-b2a-followup.md` — 완료된 작업 plan 파일 (신규 complete)
6. `plan/complete/exec-park-polish.md` — 완료된 작업 plan 파일 (신규 complete)
7. `plan/complete/spec-draft-exec-park-b2-durable.md` — 완료된 spec draft plan 파일 (신규 complete)
8. `plan/in-progress/exec-park-durable-resume.md` — umbrella plan 진행 상태 업데이트

---

## 발견사항

### [INFO] `PARK_RELEASED`/`ProcessTurnResult` shared 이관은 범위 내 작업
- 위치: `execution-engine.service.ts` diff `-const PARK_RELEASED = ...` / `+import { PARK_RELEASED, ... } from '../../shared/execution-resume/process-turn-result'`
- 상세: 로컬 선언 제거 + 신규 파일로 이관은 `exec-park-polish.md`의 C1 항목("ProcessTurnResult = void | ParkSignal named type alias 신설")이 명시적으로 계획한 내용이며, plan 완료 메모에도 "C1 ProcessTurnResult alias 신설 + waitForX 3종·processAiResumeTurn·executeInline 지역변수 적용"으로 기록돼 있다. `resume-turn-dispatch.ts`의 `ResumeTurnContext`/`ResumeTurnSelector` 인터페이스 신설도 `dispatchResumeTurn` 추출(B-1)에 필요한 타입 정의로 직접 연관된다.
- 제안: 해당 없음 (범위 내)

### [INFO] `handleAiResumeTurn` private 메서드 신설 — dispatch 분리의 자연스러운 추출
- 위치: `execution-engine.service.ts` 신규 `handleAiResumeTurn` 메서드 (약 40줄)
- 상세: `driveResumeAwaited`에 있던 AI 분기 코드를 `dispatchResumeTurn`의 registry handler 로 위임할 때 그 handler 가 호출하는 private 메서드로 추출된 것이다. 기능 추가가 아닌 기존 코드의 재구성이다. diff에서 동일한 로직(`buildRetryReentryState` 재구성 → `setNodeOutput` seed → `processAiResumeTurn` 호출)이 제거되고 새 메서드에 이동했음을 확인할 수 있다.
- 제안: 해당 없음 (범위 내)

### [INFO] 테스트 파일에 `DispatchSubject` 타입 + `makeCtx` 헬퍼 + `afterEach` 추가
- 위치: `execution-engine.service.spec.ts` lines 51~81
- 상세: `dispatchResumeTurn`/`handleAiResumeTurn`(private) 을 직접 spy/호출하기 위한 테스트 전용 캐스팅 타입 및 헬퍼. 이는 B-1 테스트 블록에서만 사용되며 기존 테스트와 격리돼 있다(`afterEach` 내 `_resumeTurnRegistry = undefined` 캐시 리셋 포함). 현재 작업 목적인 테스트 커버리지 추가의 직접 수단이다.
- 제안: 해당 없음 (범위 내)

### [INFO] plan 파일 3개 신규 추가(complete) + 1개 상태 업데이트
- 위치: `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md`, `plan/complete/spec-draft-exec-park-b2-durable.md`, `plan/in-progress/exec-park-durable-resume.md`
- 상세: 완료된 작업의 plan 파일을 complete 로 이동하고 umbrella plan 체크박스를 업데이트하는 것은 CLAUDE.md의 plan lifecycle 규약에 따른 정상 범위다. `exec-park-durable-resume.md` 의 변경도 PR-B2a follow-up / polish / doc polish 항목을 `[x]`로 표시하고 umbrella 잔여를 정리하는 상태 업데이트에 한정됐다.
- 제안: 해당 없음 (범위 내)

---

## 요약

이번 변경은 `exec-park B-1 — dispatchResumeTurn` 추출이라는 명확한 단일 목적에 집중돼 있다. 핵심 변경(두 곳에 중복된 form/buttons/ai if/else → registry 일원화)과 그것이 필요로 하는 타입 파일 2개 신설, shared 이관, 단위 테스트 추가, plan 상태 업데이트가 모두 해당 작업의 직접 구성 요소다. 의도 이상의 변경(무관한 리팩토링·기능 확장·설정 변경·불필요한 포맷팅·무관한 임포트)은 발견되지 않았다. `PARK_RELEASED`/`ProcessTurnResult` shared 이관은 직전 완료 단계(exec-park-polish C1)에서 이미 계획·기록된 내용이며, 이번 B-1 추출이 그것을 소비(import)하는 자연스러운 연장이다.

## 위험도

NONE
