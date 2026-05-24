# Testing Review — form-resubmit-fix

## 발견사항

### [INFO] 핵심 회귀 차단 로직에 대한 테스트가 적절히 추가됨
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` lines 1658–1671, 1848–1858
- 상세: `form_submitted` 정상 경로(stub splice)와 fallback 경로(stub 없음 → push)에서 각각 `ok: true`와 `message` 필드 단언이 추가되었다. 두 분기를 별도 it 블록으로 커버한 구성은 적절하다.
- 제안: 없음 (적절히 구현됨).

### [WARNING] `message` 단언이 regex 매칭이라 실제 상수값 변경 시 무성 통과 위험
- 위치: `ai-agent.handler.spec.ts` lines 1671, 1858, 3323
- 상세: `expect(parsed.message).toMatch(/재호출|다시 호출|do not call/i)` 패턴은 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수 문자열의 변경을 일부 흡수하지만, 상수 텍스트가 정규식 패턴에 포함되지 않는 표현으로 변경되더라도 테스트가 실패하지 않을 수 있다. 실제 상수가 "같은 form 을 다시 호출하지 말고" 를 포함하므로 현재는 통과하지만, 상수가 영문 전용으로 교체될 경우 한국어 regex 가 통과 불가 상태가 된다.
- 제안: regex 를 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수를 직접 import 해 `expect(parsed.message).toBe(FORM_SUBMITTED_GUIDANCE_MESSAGE)` 로 단언하거나, 최소한 `toContain` 으로 고정 substring 을 검증하면 상수 drift 를 즉시 포착할 수 있다. (상수가 `export` 되어 있다면 import 방식 권장.)

### [WARNING] `systemPrompt` 테스트가 `handler` 인스턴스 첫 번째 chat mock call 에만 의존 — mock.calls[0] index hardcoding
- 위치: `ai-agent.handler.spec.ts` line 3314 — `mockLlmService.chat.mock.calls[0]`
- 상세: `describe('AiAgentHandler — render_* dispatch')` 블록 내 테스트들이 `beforeEach` 등에서 mock 을 reset 하는지 여부를 확인했을 때, 동일 블록의 다른 테스트가 이미 mock call 을 누적했을 경우 `[0]` 인덱스 접근이 의도와 다른 call 을 참조할 수 있다. 이전 테스트들이 `.mockResolvedValueOnce` 로만 등록되어 있고 `beforeEach` 에서 `mockClear()` / `mockReset()` 이 실행된다면 문제 없지만, mock 상태 reset 부재 시 flaky 해질 수 있다.
- 제안: `mock.calls.at(-1)` 패턴(이미 해당 spec 파일의 다른 테스트에서 사용되는 패턴)으로 통일하거나, 테스트 내 `mockLlmService.chat.mockClear()` 를 명시적으로 호출해 isolation 을 보장한다.

### [INFO] fallback 경로 (`stubIndex < 0` → push) 가드 단언이 별도 it 블록으로 분리되어 있음
- 위치: `ai-agent.handler.spec.ts` lines 1810–1858
- 상세: stub 이 없는 상태(messages 에서 tool role 행 제거)를 명시적으로 설정하고 가드 필드를 검증한다. 두 경로를 독립 케이스로 운영하는 것은 테스트 격리 면에서 올바르다.
- 제안: 없음.

### [WARNING] `userMessage` 가 plain text (JSON 아님) 인 경우 `formData.__raw__` 경로의 가드 필드 단언 미존재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` lines 1649–1652 (try/catch `__raw__` fallback)
- 상세: 구현 코드의 `try { JSON.parse } catch { formData = { __raw__: userMessage } }` 분기는 기존 동작이지만, 해당 경로에서도 동일한 `ok: true` + `message` 가드 필드가 직렬화되어 LLM 으로 전달된다. 이 경로에 대한 전용 테스트가 없어 `__raw__` 입력 시에도 가드 필드가 유지되는지 검증되지 않는다. 회귀 차단이 목적인 PR 에서 plain-text 입력 경로는 커버리지 갭이 된다.
- 제안: `userMessage` 를 plain string (`'안녕하세요'`) 으로 넣은 테스트를 1건 추가해 `parsed.ok === true`, `parsed.data.__raw__ === '안녕하세요'`, `message` 단언을 커버한다.

### [INFO] e2e fixture SQL 스키마 동기화 변경 (chat-channel-discord/slack) — 테스트 정합성 확보
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `chat-channel-slack.e2e-spec.ts`
- 상세: `role` 컬럼 제거 → `email_verified` 추가, `workflow` 테이블에 `is_active`, `current_version`, `created_by` 추가, `trigger` 테이블에 `name` 컬럼 추가. 이 변경은 실제 DB 스키마 변경을 e2e fixture 에 반영한 것으로, 이전 fixture 가 e2e 에서 INSERT 실패를 유발하는 상황을 수정한 것이다.
- 제안: 없음 (스키마 동기화가 목적인 변경으로 적절함). 단, `trigger.name` 에 하드코딩된 `'discord-e2e-trigger'` / `'slack-e2e-trigger'` 가 DB unique constraint 에 걸리지 않도록 setup 함수가 매 테스트 실행마다 새 workspace + trigger 를 생성하는지 확인 권장 (`workspaceId = randomUUID()` 로 이미 격리되어 있으면 문제 없음).

### [INFO] `PRESENTATION_TOOLS_GUIDANCE` systemPrompt 포함 여부를 검증하는 테스트가 신설됨
- 위치: `ai-agent.handler.spec.ts` lines 3290–3324
- 상세: `presentationTools: [{ type: 'form' }]` 옵션으로 `handler.execute` 를 호출해 system 메시지에 `form_submitted` 텍스트와 재호출 금지 안내가 포함되는지 단언한다. `PRESENTATION_TOOLS_GUIDANCE` 상수가 수정되거나 system 메시지 조립 로직이 변경될 때 빠르게 실패할 것이므로 회귀 방지 목적에 적합하다.
- 제안: `presentationTools` 를 제공하지 않은 경우 (`presentationTools` 미전달 또는 빈 배열) system 메시지에 `PRESENTATION_TOOLS_GUIDANCE` 가 포함되지 않아야 하는 반대 케이스 검증이 없다. 의도적으로 생략된 것이라면 문제없으나, 가드 텍스트가 모든 system 메시지에 누출되는 회귀를 막으려면 `expect(systemMsg!.content).not.toContain('form_submitted')` 케이스를 1건 추가하면 완결된다.

### [INFO] 테스트 격리 — `baseState()` factory 패턴 사용으로 테스트 간 state 오염 없음
- 위치: `ai-agent.handler.spec.ts` lines 1632, 1813 등 (각 it 블록 첫 줄 `baseState()` 호출)
- 상세: `const state = baseState()` 로 매 테스트마다 신선한 상태 객체를 생성하므로 테스트 간 상태 공유로 인한 오염이 없다.
- 제안: 없음.

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수가 `private const` 로 모듈 내부에만 존재하여 spec 파일에서 import 불가
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 144
- 상세: `const FORM_SUBMITTED_GUIDANCE_MESSAGE` 가 `export` 없이 선언되어 있어 테스트 파일에서 직접 import 해 단언하는 것이 불가능하다. 때문에 spec 파일은 regex 패턴 단언으로 우회하고 있다. 이는 상수 내용 변경을 즉시 포착하지 못하는 구조적 원인이다.
- 제안: 상수를 `export const` 로 노출하거나, 별도 constants 파일로 추출해 테스트에서 import 하면 타입 안전성과 정확한 값 단언이 가능해진다. 단, 현재 구현이 동작하는 데는 문제가 없으므로 이는 개선 권장이다.

---

## 요약

이번 변경에서 핵심인 `form_submitted` 경로의 `ok: true` + `message` 가드 필드 보강은 정상 경로(stub splice)와 fallback 경로(stub push) 양쪽에 테스트가 추가되었고, `PRESENTATION_TOOLS_GUIDANCE` 의 system 메시지 포함 여부도 별도 it 블록으로 검증되어 기본적인 회귀 차단 커버리지는 충족된다. 다만 세 곳의 `message` 단언이 모두 regex 기반이어서 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수 내용이 바뀌어도 테스트가 통과할 가능성이 있으며(상수 unexported 로 인한 구조적 제약), plain-text 입력 시 `__raw__` 경로에 대한 가드 필드 단언이 없는 커버리지 갭과 `mock.calls[0]` 인덱스 하드코딩으로 인한 테스트 격리 불안 요소가 존재한다. e2e fixture 의 스키마 동기화 변경은 구조적으로 적절하며 별도 문제 없음.

## 위험도

LOW
