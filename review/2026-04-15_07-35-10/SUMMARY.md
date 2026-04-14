# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 타임아웃 기능 전면 제거로 인한 리소스 정리 메커니즘 공백, WebSocket 페이로드 파괴적 변경, WorkflowHandler에서 timeout 값이 실제 실행 엔진에 전달되지 않는 구조적 단절이 주요 위험 요소

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 리소스 관리 | `pendingContinuations` Map 항목이 타임아웃 제거 이후 외부 cancel 없이는 영구 잔류. 사용자가 브라우저를 닫거나 WebSocket 연결이 끊길 경우 Promise·클로저가 GC 대상에서 제외되어 장기 운영 시 메모리 누수 위험 (6개 에이전트 공통 지적) | `execution-engine.service.ts` — `waitForButtonInteraction`, `waitForAiConversation`, `waitForFormSubmission` | WebSocket `disconnect` 이벤트 핸들러에서 해당 executionId의 `pendingContinuations` 항목을 `reject(new ExecutionCancelledError())` 로 자동 정리. 또는 워크스페이스당 동시 `waiting_for_input` 실행 수 상한 설정 |
| 2 | 아키텍처 | Sub-workflow의 상위 타임아웃(기본 5분)이 내부 무한 대기 노드와 충돌. 5분 후 상위 `Promise.race` 에서 timeout 에러 발생 → sub-execution FAILED 전이 후에도 해당 노드의 pending continuation이 Map에 잔류하여 뒤늦은 사용자 클릭 시 종료된 실행 위에서 `resolve` 호출됨 | `execution-engine.service.ts:617` — `executeSubWorkflow` | sub-workflow timeout 발생 시 `pendingContinuations.get(savedExecution.id)` 를 명시적으로 reject 처리하는 정리 코드 추가 |
| 3 | 요구사항 | `WorkflowHandler`에서 `timeout` 필드가 검증은 되지만 `execute()` 메서드 내 구조분해에서 누락되어 `executeInline()` 호출 시 전달되지 않음. `timeout=0` (무제한 대기) 의도가 실제 실행 경로에 반영되지 않고 기본값 300,000ms가 항상 적용됨 | `workflow.handler.ts` — `execute()`, `execution-engine.service.ts` — `executeSubWorkflow` | `WorkflowHandler.execute()`에서 `timeout`을 구조분해하고 `executeInline()` 인터페이스에 `timeoutMs` 옵션 추가, 또는 `executeSubWorkflow()` 호출 경로와 일치시킴 |
| 4 | API 계약 | DB에 저장된 기존 `NodeExecution.interaction_data`의 `interactionType: 'button_timeout'` 레코드가 `INTERACTION_STATUSES` 화이트리스트 제거로 `'button_continue'` 폴백 처리됨. `cancel` action이었던 케이스가 "계속됨"으로 의미론적 왜곡 발생, 히스토리 실행 화면에서 잘못된 상태 표시 가능 (4개 에이전트 공통 지적) | `button.types.ts:17`, `execution-engine.service.ts` — `INTERACTION_STATUSES` (약 line 1811) | DB 마이그레이션 스크립트로 `button_timeout` → 명시적 상태로 정규화, 또는 `INTERACTION_STATUSES` 에 레거시 값 처리 주석과 `result-detail.tsx`/`page.tsx` 에 `'button_timeout'` 폴백 케이스 추가 |
| 5 | API 계약 | WebSocket `execution.waiting_for_input` 이벤트의 `convConfig` 페이로드에서 `turnTimeout` 필드 제거, `buttonConfig` 응답에서 `buttonTimeout`·`buttonTimeoutAction` 제거 — 동일 레포 외부 클라이언트(모바일 앱, 임베드 뷰어 등)가 존재하면 breaking change | `spec/5-system/6-websocket-protocol.md`, `use-execution-events.ts`, `button.types.ts` | 외부 WebSocket 구독자 존재 여부 확인 후 deprecated 필드로 잠시 유지하거나 마이그레이션 가이드 제공 |
| 6 | 보안 | `carousel.handler.ts`의 `sanitizeUrl()` 함수가 `javascript:` 스킴만 차단하고 `data:`, `vbscript:` 등 다른 위험 스킴 미차단. 같은 파일의 `validateItemButtons`는 세 스킴 모두 검사하여 불일치 (기존 이슈) | `carousel.handler.ts` — `sanitizeUrl()` | `sanitizeUrl`을 `/^(javascript\|data\|vbscript):/i` 패턴으로 통일 |
| 7 | 보안 | `__continue__` 센티널 ID가 서버 측에서 해당 executionId의 버튼 구성이 link-only인지 검증하지 않을 경우, 인증된 사용자가 port-type 버튼 노드에서도 `__continue__`를 전송하여 의도치 않은 포트로 분기 가능 | `use-execution-interaction-commands.ts` — `CONTINUE_BUTTON_ID = "__continue__"`, 서버 측 `execution.click_button` 핸들러 | 서버 측 핸들러에서 `__continue__` 수신 시 해당 노드의 버튼 구성이 link-only인지 검증 로직 확인·추가 |
| 8 | 요구사항 | `MergeHandler` 프론트엔드(`min={0}`, "0 = no timeout" 힌트)와 스펙은 업데이트되었으나, 백엔드 MergeHandler 구현이 diff에 미포함 — `timeout=0` 처리 여부 불명확 | `logic-configs.tsx:532`, `spec/4-nodes/1-logic-nodes.md` | MergeHandler 백엔드에서 `timeout=0`을 무제한 대기로 처리하는 로직 명시적 추가 및 관련 테스트 작성 |
| 9 | 테스트 | `timeoutMs === 0` 시 `Promise.race` 없이 직접 실행되는 핵심 코드 경로에 대한 서비스 레벨 단위 테스트 부재 (2개 에이전트 공통 지적) | `execution-engine.service.ts` — `executeSubWorkflow`, `workflow.handler.spec.ts` | `executeSubWorkflow({ timeoutMs: 0 })` 호출 시 무제한 대기로 완료되는 시나리오 단위 테스트 추가 |
| 10 | 테스트 | `INTERACTION_STATUSES`에서 `'button_timeout'` 제거 후 레거시 값이 폴백 처리되는 회귀 테스트 부재 | `execution-engine.service.ts` — `INTERACTION_STATUSES`, 테스트 파일 없음 | `interactionType: 'button_timeout'` 입력 시 `resolvedStatus`가 `'button_continue'`로 처리되는지 검증 테스트 추가 |
| 11 | 문서화 | 프론트엔드 설정 컴포넌트에서 타임아웃 UI 제거 이유가 주석으로 설명되지 않아, 의도적 제거인지 실수인지 판단 불가. 백엔드 `execution-engine.service.ts`에는 명확한 인라인 주석이 추가된 것과 대비됨 | `ai-configs.tsx`, `presentation-configs.tsx`, `flow-configs.tsx`, `logic-configs.tsx` | 제거된 `NumberField` 위치에 `{/* Timeout removed: interactions wait indefinitely; only external cancel exits */}` JSX 주석 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스 | 서버 재시작 시 `waiting_for_input` 상태의 Execution 레코드가 자동 정리 없이 DB에 영구 잔류 가능 | `execution-engine.service.ts` — `OnModuleInit` 없음 | `OnModuleInit`에서 stale `waiting_for_input` 레코드를 `failed`/`cancelled`로 전이시키는 startup cleanup 추가 또는 주기적 스케줄러 구성 |
| 2 | 유지보수성 | `executeSubWorkflow` 내 `runExecution` 호출이 if/else 두 브랜치에 중복 존재 — 향후 signature 변경 시 한쪽만 수정하는 실수 위험 | `execution-engine.service.ts:640-650` | `const executionPromise = this.runExecution(savedExecution, input); await (timeoutPromise ? Promise.race([executionPromise, timeoutPromise]) : executionPromise);` 패턴으로 중복 제거 |
| 3 | 유지보수성 | `use-execution-events.ts`의 `convConfig` 인라인 익명 타입이 `execution-store.ts`의 `waitingConversationConfig`와 개념적으로 중복. 명명된 인터페이스 부재로 향후 필드 추가 시 동기화 실수 위험 | `frontend/src/lib/websocket/use-execution-events.ts` ~line 192 | 공유 타입 파일에 `ConversationConfig` 인터페이스 정의 후 두 곳에서 참조 |
| 4 | 테스트 | `carousel-buttons.handler.spec.ts`는 갱신됐으나 chart/table/template 핸들러의 `buttonConfig` 구조 관련 spec 파일 갱신 여부 미확인 | `chart.handler.spec.ts`, `table.handler.spec.ts`, `template.handler.spec.ts` (존재 여부 확인 필요) | 해당 핸들러 spec 파일에서 `buttonTimeout`/`buttonTimeoutAction` 관련 기대값 확인 및 업데이트 |
| 5 | 동시성 | 동일 executionId로 두 번 대기 진입 시 첫 번째 Promise가 Map에서 덮어써져 영구 미결 상태 — 타임아웃 제거로 기존보다 누수 영향 확대 | `execution-engine.service.ts` — 모든 `pendingContinuations.set()` 호출부 | `set` 호출 전 기존 엔트리 존재 확인 후 `reject()` 처리하는 방어 코드 추가 |
| 6 | 문서화 | `validateButtons` JSDoc의 `spec §1.7` 참조가 타임아웃 규칙 삭제 후 폐기된 내용을 가리킬 가능성 | `button.types.ts` — `validateButtons` JSDoc | 참조 섹션 실제 존재 및 내용 일치 여부 확인, 필요 시 `spec §1.6`으로만 수정 |
| 7 | 문서화 | `MultiTurnState` 인터페이스에 JSDoc 부재 — `turnTimeout` 재추가 시도를 방지하는 설계 의도 설명 없음 | `information-extractor.handler.ts` — `interface MultiTurnState` | `/** Multi-turn conversation state. User responses are awaited indefinitely; only external cancel exits the wait. */` 수준 JSDoc 추가 |
| 8 | 테스트 | `ButtonBar` 컴포넌트 자체 단위 테스트 부재 — 카운트다운 타이머 제거라는 큰 변경에도 기본 동작(버튼 클릭, link-only Continue 노출 등)이 검증되지 않음 | `frontend/src/components/editor/run-results/button-bar.tsx` | 버튼 클릭 → `onPortButtonClick` 호출, 클릭 후 "clicked" 상태, link-only 시 Continue 버튼 노출 등 기본 동작 테스트 추가 |
| 9 | 테스트 | AI 핸들러에서 `turnTimeout` 제거를 명시적으로 문서화하는 테스트 부재. `button.types.spec.ts`의 `"should ignore unknown buttonTimeout field (no longer supported)"` 패턴과 불일치 | `ai-agent.handler.spec.ts`, `information-extractor.handler.spec.ts` | `'should ignore turnTimeout field if provided (no longer supported)'` 패턴 테스트 추가 |
| 10 | 문서화 | `button.types.spec.ts` 테스트 이름 `"(no longer supported)"` 표현이 하위 호환성을 기대하게 오해를 줄 수 있음 | `button.types.spec.ts` | `'should ignore unrecognized buttonTimeout field'` 또는 `'should pass when unknown buttonTimeout field is present (timeout no longer enforced)'`로 변경 |
| 11 | 보안 | `table.handler.ts` `safeEvaluate()` catch 블록에서 `ctx.$sourceItem`, `ctx.$var` 전체를 `console.error`로 JSON 직렬화 출력 — 개인정보·업무 데이터 노출 위험 (기존 이슈) | `table.handler.ts` — `safeEvaluate()` catch 블록 | 프로덕션 환경에서 에러 요약만 로깅하거나 민감 필드 마스킹 적용 |
| 12 | 문서화 | `ButtonInteractionData.interactionType` 필드에 각 값(`button_click`, `button_continue`)의 사용 맥락 설명 JSDoc 부재 | `button.types.ts` — `ButtonInteractionData` 인터페이스 | `interactionType` 필드 또는 인터페이스 레벨에 각 값의 발생 조건을 JSDoc으로 명시 |
| 13 | 유지보수성 | `pendingContinuations` 선언부 또는 각 `set()` 호출부에 cleanup 전략("어디서 삭제되는지") 주석 없어 메모리 누수 오판 가능 | `execution-engine.service.ts` — `pendingContinuations.set()` 호출부 | `// Cleared in: cancelExecution(), onDisconnect()` 형태의 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | MEDIUM | WebSocket 페이로드 파괴적 변경, `button_timeout` DB 데이터 의미론적 왜곡 |
| architecture | MEDIUM | `pendingContinuations` 자기-청소 제거, sub-workflow timeout과 무한 대기 충돌 |
| security | MEDIUM | `pendingContinuations` 리소스 고갈, URL 새니타이징 불완전, `__continue__` 센티널 검증 |
| requirement | MEDIUM | `WorkflowHandler` `timeout` 미전달 구조적 단절, MergeHandler 백엔드 미확인 |
| performance | LOW | `pendingContinuations` 무한 성장 가능성 (카운트다운 제거는 긍정적 변경) |
| maintainability | LOW | `pendingContinuations` 생명주기 미문서화, `timeoutMs=0` 서비스 레벨 테스트 부재 |
| testing | LOW | `timeoutMs=0` 분기 테스트 부재, chart/table/template 핸들러 spec 미갱신 가능성 |
| concurrency | LOW | `pendingContinuations` 무한 대기, 덮어쓰기 위험 |
| side_effect | LOW | `pendingContinuations` 메모리 누수, `button_timeout` 폴백 의미론 |
| documentation | LOW | 프론트엔드 컴포넌트 타임아웃 제거 이유 미설명, `MultiTurnState` JSDoc 부재 |
| database | LOW | 서버 재시작 시 stale `waiting_for_input` 레코드 누적 |
| scope | LOW | 경미한 주석 정리, import 재정렬, MergeConfig min 값 변경 |
| dependency | NONE | 외부 의존성 변경 없음, 내부 의존성 체인 일관성 양호 |

---

## 발견 없는 에이전트
- **dependency** — 외부 패키지 변경 없음, 내부 의존성 계층 전반 일관성 확인 완료

---

## 권장 조치사항

1. **[즉시] `pendingContinuations` WebSocket disconnect 정리 확인·보강** — WebSocket `disconnect` 이벤트 핸들러에서 해당 클라이언트의 모든 pending continuation을 `reject(new ExecutionCancelledError())`로 정리하는 로직이 존재하는지 확인하고, 없다면 추가. 현재 코드베이스에서 이 경로가 보장되지 않으면 서비스 장기 운영 시 메모리 누수 발생

2. **[즉시] `WorkflowHandler` `timeout` 값 실제 전달 수정** — `execute()` 메서드에서 `timeout`을 구조분해하고 `executeInline()` 호출 시 `timeoutMs` 옵션으로 전달하는 코드 추가. `timeout=0` 검증 변경의 의도가 실행 엔진에 도달하지 않는 구조적 버그

3. **[즉시] Sub-workflow timeout 시 pending continuation 정리** — `executeSubWorkflow`에서 timeout 에러 발생 시 `pendingContinuations.get(savedExecution.id)` 항목을 명시적으로 reject 처리하는 코드 추가

4. **[단기] `button_timeout` 레거시 DB 데이터 처리** — `result-detail.tsx` 및 `page.tsx`에서 `interactionType: 'button_timeout'` 폴백 케이스 명시적 처리 추가, 또는 DB 마이그레이션 스크립트로 기존 데이터 정규화

5. **[단기] `MergeHandler` 백엔드 `timeout=0` 지원 구현** — 프론트엔드·스펙과 일치하도록 MergeHandler 백엔드에서 `timeout=0` = 무제한 대기 처리 추가 및 테스트 작성

6. **[단기] `carousel.handler.ts` URL 새니타이징 보완** — `sanitizeUrl()`을 `/^(javascript|data|vbscript):/i` 패턴으로 수정하여 `validateItemButtons`와 일치시킴

7. **[단기] `timeoutMs === 0` 서비스 레벨 단위 테스트 추가** — `executeSubWorkflow({ timeoutMs: 0 })` 시 `Promise.race` 없이 직접 실행되는 코드 경로 검증

8. **[단기] `button_timeout` 폴백 회귀 테스트 추가** — 레거시 `interactionType: 'button_timeout'` 값이 `'button_continue'`로 폴백 처리되는 동작 검증

9. **[단기] DB startup cleanup 또는 스케줄러 추가** — 서버 재시작 시 장시간 `waiting_for_input` 상태 레코드를 `failed`/`cancelled`로 전이시키는 정리 로직 구성

10. **[후속] `__continue__` 센티널 서버 측 검증 확인** — `execution.click_button` 핸들러에서 `__continue__` 수신 시 해당 노드 구성이 link-only인지 검증 로직 존재 여부 확인