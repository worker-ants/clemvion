---
worktree: render-form-submit-fix-3f10bf
started: 2026-05-23
owner: resolution-applier
---
# Spec Fix Draft — form submission wire format spec 명확화 (W1/W2/W15)

## 원본 발견사항

SUMMARY#W1: `'button_click'` dispatch 케이스가 `waitForAiConversation` 에 없음 — spec §10.9 4-케이스 표와 불일치. AI conversation 대기 중 button_click 미도달 (자연스러운 invariant) 임을 spec 에 명시 권장.

SUMMARY#W2: `formData ?? {}` fallback spec §10.9 미명시. spec 보강 — project-planner 위임.

SUMMARY#W15: spec §10.9 본문 + §Rationale SSOT 4-layer 목록 중복 (`spec/4-nodes/6-presentation/0-common.md`). §Rationale 의 목록 제거 + §10.9 cross-ref 로 대체.

## 제안 변경

### W1 — button_click 미도달 invariant 명시

`spec/4-nodes/6-presentation/0-common.md §10.9` 의 dispatch 표 (4-케이스 표)에 주석 추가:

```markdown
| `'button_click'` | — | `waitForAiConversation` 진입 전 `continueButtonClick` 가 `button_click` 이벤트를 publish 하지 않으므로 본 dispatch 에 도달하지 않는 invariant. AI conversation 대기 중 버튼 클릭이 라우팅되는 경로는 존재하지 않음. (미도달 invariant 명시) |
```

또는 §10.9 본문에:

> **`button_click` AI conversation 내 미도달 invariant**: `waitForAiConversation` loop 는 `ai_end_conversation` / `ai_message` / `form_submitted` 3케이스만 수신하도록 설계됐다. `button_click` 이벤트는 `continueButtonClick → bus.publish({type:'button_click'})` → `'button_click'` listener → `resolvePending` 경로로 전달되나, `waitForAiConversation` 이 실행 중이면 `pendingContinuations` 에 이미 등록된 resolve 가 `button_click` payload 로 호출된다. 그러나 `waitForAiConversation` 의 dispatch 표에 `button_click` 케이스가 없으므로 `else` 분기(warn log + loop 재진입)로 처리된다. 현재 UI 가 AI conversation 대기 중 버튼 클릭을 허용하지 않으므로 자연스러운 invariant. spec 에 명시해 구현과 명세 일치.

### W2 — formData ?? {} fallback spec 명시

`spec/4-nodes/6-presentation/0-common.md §10.9` 의 `form_submitted` dispatch 케이스 설명에:

> `action.formData ?? {}` — formData 가 `null` / `undefined` 인 경우 빈 객체로 fallback. spec §10.9 back-compat. 이는 `continueExecution(executionId, undefined)` 호출 시 (빈 form 제출) 에도 `handleAiMessageTurn` 이 `JSON.stringify({})` 를 인자로 받아 정상 처리되도록 한다.

### W15 — §Rationale SSOT 4-layer 목록 중복 제거

`spec/4-nodes/6-presentation/0-common.md §Rationale` 의 "form submission wire format wrap" 절에서 4-layer SSOT 목록 (layer 1~4 표)을 제거하고 `§10.9` cross-ref 만 남긴다:

변경 전:
```
| (1) … | (2) … | (3) … | (4) … |
```

변경 후:
```
4-layer 분리는 [§10.9 Form submission wire format](#109-form-submission-wire-format-internal-bus-sentinel) 참고.
```
