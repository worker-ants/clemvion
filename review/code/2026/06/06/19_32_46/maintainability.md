# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `DispatchSubject` 테스트 전용 캐스팅 타입이 describe 블록 안에 중복 선언될 우려
- 위치: `execution-engine.service.spec.ts` — `dispatchResumeTurn` describe 블록 내 `DispatchSubject` type (라인 51–60)
- 상세: 기존에 상위 스코프에 `CheckpointSubject` (라인 830–848) 가 같은 `as unknown as ...` 관용구로 이미 존재한다. `DispatchSubject` 는 그 블록 전용 타입으로 내부에 두는 것이 의도이지만, 향후 `handleAiResumeTurn` / `processAiResumeTurn` 관련 새 describe 블록이 추가될 때마다 유사한 casting type 이 중복 선언될 수 있다. `CheckpointSubject` 가 이미 상위 스코프에 있는 패턴을 참고해, `DispatchSubject` 도 파일 상단(또는 적어도 `describe('ExecutionEngineService')` 직하)으로 승격하면 재사용성과 일관성이 높아진다.
- 제안: `DispatchSubject` 를 `CheckpointSubject` 와 같은 레벨(describe 바깥 상위 스코프)로 승격한다.

### [INFO] `makeCtx` 헬퍼의 스코프가 describe 내부로 제한되어 다른 describe 블록에서 재사용 불가
- 위치: `execution-engine.service.spec.ts` 라인 62–74 (`makeCtx` 함수)
- 상세: `makeCtx` 는 `dispatchResumeTurn` describe 전용이지만, `handleAiResumeTurn` 내부 로직 테스트(라인 232~282)도 동일 context shape 을 필요로 해 이미 해당 블록 내에서 `makeCtx` 를 호출한다. 현재는 같은 describe 내에 있어 작동하지만, 나중에 describe 를 분리하면 참조가 깨진다. `armSlowPathResume` 처럼 테스트 헬퍼를 describe 바깥에서 정의하는 기존 패턴(라인 862)과 일관성이 없다.
- 제안: `makeCtx` 를 `armSlowPathResume` 과 같은 수준(describe 바깥 또는 적어도 주석으로 "이 블록 전용임"을 명시)으로 옮기거나, 기존 헬퍼와 위치 규칙을 통일한다.

### [INFO] `afterEach` 의 registry 캐시 초기화(`_resumeTurnRegistry = undefined`) 주석이 테스트 의도를 잘 설명하지만, 프로덕션 private 필드명 노출이 테스트-구현 결합도를 높임
- 위치: `execution-engine.service.spec.ts` 라인 79–81
- 상세: 테스트가 `_resumeTurnRegistry` 라는 private 필드를 직접 참조해 초기화한다. lazy getter 패턴(`resumeTurnRegistry`)이 `_resumeTurnRegistry` 에 의존하므로 테스트 간 누수를 막으려는 의도는 타당하다. 그러나 내부 구현 세부사항(필드명)이 테스트에 노출돼, 차후 필드명을 바꾸면 테스트도 손봐야 한다. 주석(`// ai-review W4`)이 이를 이미 인식하고 있어 일부 완화되지만, 노출 범위가 최소화되어 있어 현재 수준은 수용 가능하다.
- 제안: 가능하다면 프로덕션 코드에 `resetRegistryForTesting()` 같은 테스트 전용 메서드를 추가하거나(테스트 프레임워크 관용구상 흔치 않음), 현 방식을 유지하되 주석으로 이유를 명시한다(현재도 주석 있음 — 현상 유지 수용).

### [INFO] `dispatchResumeTurn` 내부에서 `resumeTurnRegistry` lazy getter 가 `this` 바인딩 closure 를 포함하는 점이 JSDoc 에 설명되어 있으나, getter 와 backing field 의 이름 규칙(`_resumeTurnRegistry` / `resumeTurnRegistry`)이 TypeScript private 관례(`#field`)와 다름
- 위치: `execution-engine.service.ts` 라인 977–1020
- 상세: 프로젝트 코드베이스에서 true private(`#`) 대신 `private` modifier + `_` prefix 를 사용하는 관례가 이미 확립돼 있어 비일관성은 아니다. 다만 `_resumeTurnRegistry` 가 테스트에서 직접 접근되므로, `private` 가 실질적으로 private 이 아닌 상황이다. 이는 `DispatchSubject` 캐스팅 패턴과 같은 맥락이며 프로젝트 전반의 기존 관행과 일치한다.
- 제안: 기존 관행이므로 현상 유지. 별도 이슈 없음.

### [INFO] `handleAiResumeTurn` 메서드가 `dispatchResumeTurn` registry 의 'ai_conversation' entry 에서만 호출되지만, `dispatchResumeTurn` 과 별도 메서드로 추출된 점은 테스트 가능성(spy 대체) 측면에서 적절한 분리
- 위치: `execution-engine.service.ts` 라인 1066–1105
- 상세: 함수 길이(40줄)는 적정하고 단일 책임(AI resume state 재구성 + seed + 단발 처리)을 가진다. JSDoc 이 의도를 명확히 설명한다. 유지보수성 관점에서 이 추출은 긍정적이다.
- 제안: 현상 유지.

### [INFO] `resume-turn-dispatch.ts` 의 인터페이스 파일 주석 분량이 구현 코드보다 많음 — 설명 충실도는 긍정적이나 중복 설명 일부 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-followup-272c4f/codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` — 파일 전체
- 상세: `ResumeTurnDispatch` 인터페이스 상단 JSDoc(40줄)이 실제 인터페이스 정의(5줄)의 8배다. 맥락 설명이 충실한 것은 긍정적이지만, `"동작 보존: 선택 우선순위(form → buttons → ai)·에러 코드·PARK_RELEASED 조기반환 의미는 추출 전과 동일하다"` 같은 히스토리 설명은 spec 문서나 커밋 메시지로 분리하고 코드 주석은 현재 계약에 집중하는 게 장기 유지보수성에 유리하다. 현재 수준은 이 코드베이스의 다른 파일과 유사한 밀도이므로 관행과 일치한다.
- 제안: 현상 유지 수용. 단, 히스토리 설명("과거엔 두 곳에 동일하게 하드코딩됐다")은 추후 관련 코드 정리 시 삭제 후보로 표시해둘 것.

### [INFO] `process-turn-result.ts` 의 파일이 34줄 전체가 상수 1개 + 타입 2개이며 설명이 충실 — 단일 책임 측면에서 적절한 분리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-followup-272c4f/codebase/backend/src/shared/execution-resume/process-turn-result.ts`
- 상세: `shared/execution-resume/` 경로에 위치해 top-level 과 중첩 재개 양쪽이 import 하는 어휘 파일이다. 기존 `park-release-signal.ts` 와 이 파일이 같은 디렉터리에 공존하는 것은 관련 개념의 응집도를 높인다. "두 가지 park 전파 채널" 구분 설명이 혼동하기 쉬운 개념을 명확히 한다.
- 제안: 현상 유지.

## 요약

이번 변경은 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 중복돼 있던 form/buttons/AI resume 분기를 `resumeTurnRegistry` (ordered first-match registry)와 `dispatchResumeTurn` 단일 진입점으로 추출한 리팩터링이다. 중복 제거 및 extension seam 확보라는 목적이 명확하고, `resume-turn-dispatch.ts` / `process-turn-result.ts` 신규 파일이 단일 책임을 지키며 적절한 경로에 배치됐다. 함수 길이·중첩 깊이·순환 복잡도 모두 양호하며, JSDoc 과 인라인 주석이 의도를 충분히 설명한다. 테스트 코드의 `DispatchSubject` / `makeCtx` 가 describe 블록 내부에 선언돼 기존 `CheckpointSubject` 상위-스코프 패턴과 미세한 불일치가 있으나, 기능상 문제는 없고 향후 describe 분리 시 이동 대상이 될 정도의 INFO 수준 지적이다. 전반적으로 유지보수성이 개선됐다.

## 위험도

LOW
