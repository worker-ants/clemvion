# 보안(Security) Review

**대상 PR**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정

**리뷰 파일**:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts`
- `spec/4-nodes/6-presentation/0-common.md`
- `spec/4-nodes/3-ai/1-ai-agent.md`
- `spec/5-system/6-websocket-protocol.md`
- 기타 review/consistency 산출물

---

## 발견사항

### [INFO] Unknown action.type warn log — executionId 포함

- **위치**: `execution-engine.service.ts` diff hunk (else 분기 신설), 라인 약 L2055
- **상세**: `logger.warn(...)` 에 `execution=${executionId}` 가 포함된다. 이 `executionId` 는 외부 클라이언트가 제공한 값이다. 현재 구현에서는 로그 스트림(운영자 가시)에만 기록되므로, 그 자체로 외부 노출은 없다. 그러나 `action.type` 도 함께 로그에 포함되는데, 이는 클라이언트가 제어하는 값(external bus message 의 type 필드)이다. 악의적 클라이언트가 매우 긴 문자열이나 민감 패턴을 `action.type` 에 심어 로그 스트림을 오염시키는 **Log Injection** 시나리오가 가능하다. 단, 이 bus 이벤트는 서버 내부 pub/sub (Redis continuation bus) 를 통해 전달되므로, 외부 클라이언트가 직접 `action.type` 을 임의로 주입하려면 내부 bus 에 publish 권한이 있어야 한다. 외부 WS wire 의 `continueExecution` 진입점에서 `formData` 를 sentinel wrap 하므로 정상 흐름에서는 `action.type` 이 서버 코드가 고정 설정한 `'form_submitted'` 문자열이다. 위협 surface 는 낮으나 로그 레벨에서의 입력 값 raw 출력 패턴 자체가 기록됨.
- **제안**: `String(action.type)` 을 그대로 로그에 직렬화하기 전, 최대 길이를 `slice(0, 64)` 등으로 잘라내는 처리를 추가하면 방어적으로 충분하다. 현재 위협 등급은 낮으나 운영 관례상 권장.

---

### [INFO] formData 가 `undefined` 일 때 JSON.stringify 결과 검증 부재

- **위치**: `execution-engine.service.ts` diff hunk, `waitForAiConversation` 내 `form_submitted` 분기 (L2217 영역, `JSON.stringify(formData)` 호출)
- **상세**: sentinel unwrap 후 `formData` 가 `undefined` 인 경우 `JSON.stringify(undefined)` 는 JavaScript 에서 `undefined` (= string이 아님)를 반환하며, 이를 `handleAiMessageTurn` 에 전달하면 해당 함수 내부에서 예외가 발생하거나 `"undefined"` 문자열로 LLM 에 전달될 가능성이 있다. 테스트(`null / undefined payload 도 wrap` 케이스)가 이 경로를 커버하고 있으나, `handleAiMessageTurn` 수신 지점에서의 검증이 diff 에 없으므로, `formData ?? {}` 처리 (diff 에서 `action.formData ?? {}` 형태로 이미 적용됨)가 실제 코드에서 일관적으로 적용되는지 확인 필요.
- **제안**: diff의 `const formData = action.formData ?? {};` 패턴은 올바르다. `JSON.stringify({})` 는 `'{}'` 로 안전하게 직렬화된다. 기존 `formData` unwrap 경로도 동일 패턴 적용 여부를 한 번 더 확인 권장.

---

### [INFO] 프론트엔드 error toast — 서버 에러 메시지 원문 노출

- **위치**: `use-execution-interaction-commands.ts` L718 영역, `toast.error(error)` 호출부
- **상세**: `emitWithAck` 의 `onFailure` 콜백에서 `response.error` 문자열을 `toast.error(error)` 로 그대로 사용자에게 표시한다. 이 패턴은 기존 `sendMessage` 와 동일하게 유지된 것으로, 이번 변경이 새로 도입한 패턴은 아니다. 단, `response.error` 가 서버 내부 에러 메시지(예: DB 에러 내용, 스택 트레이스 일부, 내부 식별자) 를 포함할 경우 민감 정보가 사용자 UI 에 직접 노출된다. 이번 diff 에서는 `"form rejected"` 와 같은 짧은 메시지로 테스트되고 있어 현재 구현에서의 실제 서버 응답 형식이 통제되고 있다면 낮은 위험이다.
- **제안**: 서버 게이트웨이 측에서 `InteractionAck.error` 를 사용자용 안전 메시지만 담도록 정책적으로 보장하고 있는지 확인. 내부 에러 상세가 흘러나올 수 있는 경로라면 frontend 에서 generic fallback 메시지를 표시하고 원문은 `console.error` 로 격리하는 것이 안전.

---

### [INFO] optimistic UI 의 formData 원문 store 저장 — 민감 폼 필드 메모리 잔류

- **위치**: `use-execution-interaction-commands.ts` `addConversationMessage` 호출부, `data: formData` 슬롯
- **상세**: 사용자가 제출한 `formData` 전체가 `conversationMessages` store 에 `presentation` item 의 `data` 슬롯으로 저장된다. 이 store 는 React 상태로 브라우저 메모리에 유지되며, 이후 백엔드의 authoritative snapshot 이 도착하면 덮어쓰인다고 주석에 명시되어 있다. 비밀번호, 주민등록번호 등 민감 필드를 폼이 포함하는 경우, 그 값이 UI state 에 일시 잔류하는 것은 불가피한 tradeoff 다. 이 자체는 이번 PR 신규 위험이나, 민감 정보 폼의 경우 별도 마스킹 처리(예: `type: 'password'` 필드는 `data` 슬롯에 `'***'` 로 치환) 정책이 장기적으로 필요하다.
- **제안**: 현재 단계에서 blocking 이슈는 아니다. 민감 폼 필드 유형이 있을 경우 추후 `interactionType: 'form_submitted'` 렌더 컴포넌트에서 password 타입 필드 마스킹을 별도 작업으로 계획하도록 plan 에 기록 권장.

---

### [INFO] `useExecutionStore.getState()` 직접 접근 — 잠재적 stale closure 상태 읽기

- **위치**: `use-execution-interaction-commands.ts` `submitForm` callback 내 `useExecutionStore.getState()` 호출
- **상세**: 이 패턴은 이번 PR 에서 신규 도입된 것으로, 기존 `sendMessage` 도 동일 패턴을 사용한다. 보안 측면보다는 correctness 에 가깝지만, `nodeResults.find(...)` 과정에서 `nodeResults` 배열이 클라이언트 제어 하에 있는 값임을 감안할 때, 악의적 사용자가 `waitingNodeId` 를 조작하거나 `nodeResults` 를 예기치 않은 형태로 채울 가능성은 이 frontend 코드 수준에서는 없다(서버가 push 한 값). 위협 없음.
- **제안**: 보안 관점 해당 없음. 코드 correctness 관점에서만 주의.

---

## 요약

이번 PR 은 backend dispatch 의 `!('type' in action)` 휴리스틱을 sentinel wrap(`{type:'form_submitted', formData}`) 과 명시 매칭으로 교체하고, frontend 의 optimistic UI 를 보강하는 기능 수정이다. 보안 관점에서 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증/인가 우회, 평문 암호화, OWASP 주요 취약점은 발견되지 않았다. 변경 대상이 모두 내부 bus dispatch 로직과 프론트엔드 store 업데이트에 국한되어 있으며, 외부 WS wire 는 변경되지 않아 기존 인증 경계가 유지된다. INFO 4건은 모두 장기적 개선 권장 또는 기존 패턴 계승에 대한 주의 환기이며, 이번 PR 을 블록할 만한 보안 취약점은 없다.

---

## 위험도

**LOW**
