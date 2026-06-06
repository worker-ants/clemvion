# 유지보수성(Maintainability) 리뷰

리뷰 대상: `execution-engine.service.ts` + `execution-engine.service.spec.ts` (PR-B2 변경분)
리뷰 기준일: 2026-06-06

---

## 발견사항

### **[WARNING]** `processAiResumeTurn` 의 `payload: unknown` → `as ContinuationPayload` 강제 캐스트 — 타입 안전성·유지보수성 갭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 5293
- 상세: `payload: unknown` 으로 받은 값을 곧바로 `payload as ContinuationPayload` 로 단언하고, 이후 `action.type === 'ai_message'` 등 구조 검증을 분기한다. 이 패턴은 `runAiConversationLoop` 의 `action = userData as ContinuationPayload` 와 동일한 선행 관행을 따른 것이나, `processAiResumeTurn` 은 외부 BullMQ payload 가 직접 도달하는 새 진입점이므로 `action.type` 이 `undefined` 이거나 payload 자체가 `null` 인 경우 런타임 오류 없이 fallthrough 해 의도치 않은 재파킹이 발생할 수 있다. 구 루프의 `userData as ContinuationPayload` 패턴을 그대로 복사했으나, 새 단발 처리기는 단독 `public` 진입점(`applyContinuation`)을 통해 더 다양한 호출자에 노출된다.
- 제안: 최소한 `action.type` 이 `string` 인지 런타임 guard(`typeof action?.type === 'string'`)를 추가하거나, `driveResumeDetached` 에서 전달 전 `opts.payload` 가 `ContinuationPayload` shape 를 만족하는지 좁혀서 전달한다. 또는 `isValidContinuationPayload(payload)` 타입 가드 함수를 추출해 `processAiResumeTurn` 진입부에서 실패 시 warn + re-park 처리한다.

---

### **[WARNING]** `driveResumeDetached` 의 `opts` 인라인 타입에 `payload: unknown` 추가 — 옵셔널이어야 할 필드가 필수
- 위치: `execution-engine.service.ts` line 1941-1942
- 상세: `driveResumeDetached` 의 `opts` 타입에 `payload: unknown` 이 non-optional 로 추가됐다. form/button 재개 경로에서 이 필드는 실제로 사용되지 않는다(`isAiConversation` 분기 안에서만 `opts.payload` 가 접근된다). 모든 호출자가 `payload` 를 명시적으로 전달해야 해 form/button 재개 경로에서 의미 없는 `payload: opts.payload` 포워딩 코드가 생긴다(line 1906). 미래에 `driveResumeDetached` 를 수정하는 개발자가 AI 경로가 아닌 데서도 `payload` 를 읽어야 한다고 오해할 가능성이 있다.
- 제안: `payload?: unknown` 로 옵셔널화하고 `isAiConversation` 분기 안에서만 `opts.payload ?? null` 로 접근. 또는 AI 특화 opts 를 별도 타입으로 분리(`AiResumeOpts`)해 `driveResumeDetached` 오버로드나 discriminated union 을 사용한다.

---

### **[WARNING]** `processAiResumeTurn` 7개 파라미터 — 장거리 파라미터 목록
- 위치: `execution-engine.service.ts` line 5283-5291
- 상세: `processAiResumeTurn(savedExecution, executionId, node, context, nodeExec, resumeState, payload)` — 7개 인자. `savedExecution.id === executionId` 중복(파생 가능)이며, `finalizeAiNode` 시그니처와도 5개가 겹친다. 기존 메서드(`finalizeAiNode`, `handleAiMessageTurn`, `reparkAiResumeTurn`) 들이 이미 유사한 파라미터 집합을 반복적으로 받고 있어 이 패턴이 확산 추세다.
- 제안: 단기적으로는 현 상태 유지 가능(기존 패턴 일관성 측면). 중기적으로 `AiTurnContext { savedExecution, executionId, node, context, nodeExec }` value object 를 추출해 5개 호출부를 일원화한다. 이 PR 범위에서 강제하기보다 리팩터링 백로그로 기록 권장.

---

### **[WARNING]** `finalizeAiNode` 내 상태 분기 — 인라인 코멘트 의존 흐름
- 위치: `execution-engine.service.ts` line 6355-6380 (`finalizeAiNode` 내부, PR-B2 추가 분기)
- 상세: `if (savedExecution.status === ExecutionStatus.RUNNING)` 분기가 추가됐다. 이 분기는 `driveResumeDetached` 가 `processAiResumeTurn` 을 통해 오는 경우 "이미 RUNNING 이므로 전이 건너뜀" 을 처리한다. 로직 자체는 타당하나, `savedExecution.status` 가 RUNNING 인지는 외부 흐름(누가 updateExecutionStatus 를 먼저 호출했는지)에 전적으로 의존한다. `finalizeAiNode` 의 의미가 "WAITING 을 RUNNING 으로 전이해 finalize" 에서 "이미 RUNNING 이면 NodeExecution 만 저장" 으로 분기되면서 단일 함수가 두 가지 다른 책임을 가진다.
- 제안: 호출자(`processAiResumeTurn`)에서 이미 RUNNING 임을 알고 있으므로, `finalizeAiNode` 에 boolean 파라미터 `skipExecutionTransition: boolean` 또는 별도 메서드 `finalizeAiNodeInRunning` 을 두는 편이 더 명시적이다. 현재는 장황한 주석이 분기의 의도를 보완하고 있어 가독성이 낮다.

---

### **[INFO]** `Phase B (PR-B2, exec-park D4)` 인라인 코멘트 20여 개 — 구현 완료 후 맥락 설명 과잉
- 위치: `execution-engine.service.ts` 전체 diff (20개 Phase B 코멘트)
- 상세: PR 단위 변경 맥락 설명("Phase B (PR-B2, exec-park D4) — ...") 이 구현 주석으로 코드베이스에 영구 내장됐다. 이들은 현재 이해에 도움이 되지만 머지 이후에는 PR 이력 참조 코멘트가 돼 기능 목적보다 역사적 맥락을 서술한다. 코드베이스 전체에 "PR-B1", "PR-B2" 레퍼런스가 혼재하면 신규 기여자가 어떤 맥락인지 파악하기 어렵다.
- 제안: PR 머지 시 "Phase B (PR-B2, exec-park D4) —" 접두어를 제거하거나 기능 목적 중심("turn-park: 초기 AI 응답 emit 후 세그먼트 종료 —") 으로 정리한다. 스펙 참조(`exec-park D4`, `§7.5`)는 유지 가치가 높으므로 접두어만 제거해도 충분하다.

---

### **[INFO]** `waitForAiConversation` — `parkMode = 'await'` 기본값과 `'release'` 분기의 반환 타입 불일치
- 위치: `execution-engine.service.ts` line 4968-5036
- 상세: `waitForAiConversation` 의 반환 타입이 `Promise<void | ParkSignal>` 로 확장됐으나, `parkMode = 'await'` (기본값) 경로는 `void` 만 반환하고 `'release'` 경로만 `ParkSignal` 을 반환한다. 즉 기본 호출자(`executeInline` 내부, line 2968)는 `await this.waitForAiConversation(...)` 의 반환값을 버리고 있다 — 기본 경로에서는 여전히 정상이지만, 반환 타입이 `void` 에서 `void | ParkSignal` 로 넓어져 호출자가 반환값 확인을 생략할 수 있다.
- 제안: 두 모드를 별도 private 메서드로 분리(`startAiTurnPark` / 기존 `runAiConversationLoop` 직접 호출)해 반환 타입을 각각 명확히 한다. 또는 `parkMode='await'` 경로 호출자가 반환값을 처리하지 않아도 됨을 `@returns` JSDoc 에 명시한다.

---

### **[INFO]** `void pendings` — 사용하지 않는 변수 참조 (lint suppression 패턴)
- 위치: `execution-engine.service.spec.ts` line 5322
- 상세: `driveLoopButtonClick` 내부에서 `const pendings = getPendings(service)` 로 선언 후 `void pendings` 로만 참조한다. ESLint `no-unused-vars` 를 우회하기 위한 관용이나, 변수를 선언만 하고 `void` 연산자로만 소비하는 패턴은 코드 의도를 혼란스럽게 한다.
- 제안: `pendings` 변수 자체를 제거하거나(`getPendings` 직접 호출로 교체), 실제 검증에 사용한다. 현재 `driveLoopButtonClick` 내부에서 `getPendings(service).get(executionId)` 를 직접 호출하므로 `pendings` 변수는 불필요하다.

---

### **[INFO]** `armSlowPathResume` 의 코멘트 블록 길이 — 헬퍼 함수 추출 후보
- 위치: `execution-engine.service.spec.ts` line 583-650
- 상세: `armSlowPathResume` 함수가 약 67줄이고, 내부에서 mock 무장 로직(flat output 변환, 4개 mock 설정)이 모두 한 곳에 집중됐다. 테스트 파일 내 헬퍼이므로 프로덕션 코드보다 기준이 낮으나, mock 무장 로직이 4가지 독립 관심사(Execution lookup / NE find / NE findOneBy / Node findOneBy)를 한 함수에서 처리해 디버깅 시 어떤 mock 이 문제인지 추적하기 어렵다.
- 제안: 단기적으로 현 상태 유지. 나중에 이 파일의 테스트 헬퍼를 정비할 때 mock 무장을 관심사별로 분리하거나, 각 mock 설정 라인에 한 줄 주석을 달아 디버깅 가시성을 확보한다.

---

### **[INFO]** `LoopSubject` 타입이 `describe` 블록 내부에 선언 — 재사용성 제한
- 위치: `execution-engine.service.spec.ts` line 5256
- 상세: `LoopSubject` 타입이 `W5` `describe` 블록 내부에 선언돼 있어, 다른 블록에서 `runAiConversationLoop` 를 직접 구동해야 할 경우 복사-붙여넣기가 필요하다. 현재는 이 블록만 사용하므로 문제 없으나, 향후 중첩 executeInline 테스트 확장 시 중복 가능성이 있다.
- 제안: 최상위 `describe` 스코프 또는 파일 상단으로 이동. 단기적으로는 현 위치도 무방.

---

### **[INFO]** `flushResumeDrive(ms = 200)` — 실제 타이머 의존 테스트 도입
- 위치: `execution-engine.service.spec.ts` line 84-86
- 상세: `flushResumeDrive` 는 `setTimeout(resolve, ms)` 로 200ms 를 기다린다. 이는 `flushPromises`(마이크로태스크 소진) 대신 실제 시간을 사용하는 것으로, CI 환경 부하에 따라 sporadic false negative 가 발생할 수 있다. 주석에 "기존 40ms 는 CI 고부하 시 sporadic false negative" 언급이 있어 이미 한 번 조정됐음을 보여준다. 200ms 가 마법 숫자로 코드 상단에 상수화 없이 기본값으로만 존재한다.
- 제안: `const RESUME_DRIVE_TIMEOUT_MS = 200;` 를 파일 상단에 선언하고 `flushResumeDrive(ms = RESUME_DRIVE_TIMEOUT_MS)` 로 참조. 또는 `fake timers` + `jest.runAllTimersAsync()` 패턴으로 전환해 실제 시간 의존을 제거한다(더 크지만 장기적으로 안정적).

---

## 요약

이번 변경(PR-B2 AI turn-park 단발 처리)은 장수 루프(`waitForAiConversation`)를 단발 처리기(`processAiResumeTurn` + `reparkAiResumeTurn`)로 교체한 의도가 명확하고, 신규 메서드의 JSDoc 품질이 높으며, 기존 패턴(ParkSignal sentinel, PARK_RELEASED 확인)과의 일관성도 잘 유지된다. 그러나 `driveResumeDetached` opts 타입의 `payload: unknown` 필수 필드화, `finalizeAiNode` 내 경로 분기의 암묵적 호출자 의존, `payload as ContinuationPayload` 단언의 런타임 방어 부재 등이 유지보수 시 잠재적 혼란 지점이다. 테스트 측면에서는 `armSlowPathResume` 과 `flushResumeDrive` 의 도입이 새 slow-path 를 잘 가드하나, 200ms 실제 타이머 의존과 `void pendings` 같은 minor 코드 스멜이 존재한다. 전체적으로 복잡도가 높은 변경에 비해 가독성·일관성이 잘 관리되고 있으며, 주요 리스크는 `payload` 타입 경계와 `finalizeAiNode` 의 조건부 책임 분기다.

## 위험도

MEDIUM

STATUS: OK
