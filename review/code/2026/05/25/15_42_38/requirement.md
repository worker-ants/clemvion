# 요구사항(Requirement) 리뷰

검토 일시: 2026-05-25  
대상 브랜치: claude/undici-autoselectfamily-b938d3  
SoT spec: `spec/4-nodes/6-presentation/0-common.md §10.9`

---

## 발견사항

### [INFO] 테스트가 `endAiConversation` 이후 `await execPromise` 로 종결 — 종료 타이밍 의존성

- **위치**: `execution-engine.service.spec.ts` 신규 테스트 line 92–93
- **상세**: 25회 button_click 루프 후 `service.endAiConversation(executionId)` 를 호출하고 곧바로 `await execPromise` 한다. 이 패턴은 동일 describe 블록의 기존 테스트(W12 unknown type 테스트 line 3092–3093)와 일관되며, bus mock 이 동기 round-trip 을 보장하는 구조 덕분에 동작한다. 그러나 `endAiConversation` 뒤에 `await flushPromises()` 를 삽입하지 않았는데, W11/W12 일부 테스트는 중간 flushPromises 를 사용하고 일부(line 3092–3093)는 생략하는 패턴이 혼재된다. 현재 mock 구조에서는 동작하지만, 향후 bus mock 이 비동기 배치로 바뀌면 race가 생길 수 있다.
- **제안**: `service.endAiConversation(executionId)` 와 `await execPromise` 사이에 `await flushPromises()` 를 추가하거나, 기존 테스트와 동일한 패턴으로 통일. 현재는 기능 이상 없음.

### [INFO] `pendingEntry?.resolve(...)` 옵셔널 체이닝으로 loop alive 검증이 약화

- **위치**: `execution-engine.service.spec.ts` line 83
- **상세**: `pendingEntry?.resolve({ type: 'button_click', buttonId: \`btn-\${i}\` })` 는 직전 `expect(pendingEntry).toBeDefined()` 가 실패해도 JS 는 계속 진행한다. Jest 의 `expect` 실패가 즉시 throw 되지 않는 모드에서는 resolve 가 호출되지 않아 루프가 멈춘다. 실제 환경에서는 throw 모드이므로 기능 이상 없으나, 명시성 측면에서 `pendingEntry!.resolve(...)` 또는 별도 null guard 가 더 안전하다.
- **제안**: `expect(pendingEntry).toBeDefined()` + non-null assertion (`pendingEntry!.resolve(...)`) 패턴 적용. 단, 현재 동작에는 영향 없음.

### [INFO] spec §10.9 line 407 인용이 코드 주석에서 "line 400/407" 로 표기 — spec 내 실제 라인 번호 불일치 가능성

- **위치**: `execution-engine.service.ts` diff 주석 (`// spec/4-nodes/6-presentation/0-common.md §10.9 line 400/407`) 및 테스트 주석 동일
- **상세**: spec 파일의 실제 라인 400은 dispatch 표 `'button_click'` 행이고 407은 invariant 설명 단락이다(실제 확인). 주석의 인용은 내용 측면에서 정확하나, spec 파일이 수정되면 line number reference 가 stale 해진다. SoT 는 §10.9 섹션 제목으로 앵커링하는 것이 더 안정적이다.
- **제안**: 주석을 `§10.9 dispatch 표 'button_click' 행 + §10.9 invariant 단락` 식의 section-level 참조로 변경. 현재 기능 이상 없음.

---

## 기능 완전성 평가

**파일 2 (`execution-engine.service.ts`) 핵심 변경:**

spec `§10.9` dispatch 표는 `waitForAiConversation` loop 가 4가지 action.type 을 명시 매칭해야 한다고 규정한다: `ai_end_conversation` / `ai_message` / `form_submitted` / `button_click`. 이 중 `button_click` 은 "AI conversation 대기 중 미도달 invariant" 이나 stale 클릭이 도달 시 "warn log + loop 재진입(graceful degradation)"으로 처리하도록 spec 이 명시하고 있다. 기존 코드는 `button_click` 을 `else` 분기(truly-unknown)로 처리해 `MAX_UNKNOWN_SKIPS` (=20) cap 에 누적시켰다. 변경된 코드는 `button_click` 을 별도 `else if` 분기로 분리하여 warn log 를 남기되 skip count 를 증가시키지 않는다. 이는 spec §10.9 line 407 의 "graceful degradation" 요건을 정확히 구현한다.

**파일 1 (`execution-engine.service.spec.ts`) 신규 테스트:**

테스트는 25회 연속 `button_click` payload 를 `pendingContinuations` Map 에 직접 주입하는 방식으로 회귀 시나리오를 재현한다. MAX_UNKNOWN_SKIPS (=20) 초과 횟수인 25회를 선택한 것은 적절하며, 루프가 살아 있음을 매 iteration 의 `expect(pendingEntry).toBeDefined()` 로 검증한다. `endAiConversation` 으로 정상 종결 후 "unknown skip limit" warn 이 없음을 확인하는 부정 어서션도 올바르다.

**엣지 케이스 처리:**

- `buttonId` 가 string 이 아닌 경우 빈 문자열로 처리 (`typeof buttonIdRaw === 'string' ? buttonIdRaw.slice(0, 64) : ''`) — 적절.
- `buttonId` 가 64자 초과 시 truncate — 로그 인젝션 방어, 적절.
- `button_click` 이 무한 반복되어도 `conversationEnded = false` 유지 + `finalStatus = 'PENDING_INIT'` 유지 — loop 가 종료되지 않음, spec 의도에 부합.

**에러 시나리오:**

`button_click` 분기는 `conversationEnded` 를 true 로 설정하지 않고 어떤 예외도 throw 하지 않는다. loop 종료 조건이 변경되지 않으므로 정상 흐름(`ai_end_conversation` 또는 `endMultiTurnConversation` 반환 `ended`)이 loop 를 종료한다. maxTurns cap 과의 상호작용은 별도 layer 에서 처리되며 본 변경으로 영향받지 않는다.

**데이터 유효성:**

`buttonId` 의 타입 및 길이 검증은 서비스 레이어에서 처리된다. 테스트에서 `buttonId: \`btn-\${i}\`` 형태를 사용하므로 string 케이스만 커버한다. `buttonId: undefined` 케이스(null-ish)는 기존 테스트(`applyContinuation button_click — payload 누락 시 buttonId: undefined` line 1124)에서 이미 커버된다.

**비즈니스 로직 정확성:**

spec §10.9 표의 `button_click` 행은 "별도 경로(§3 Blocking Mode). AI conversation 대기 중 미도달 invariant" 라고 기술하고 있으며, 이어 §10.9 line 407 단락이 "만약 향후 UI 변경으로 도달하게 되면 `else` 분기(warn log + loop 재진입)가 graceful degradation 으로 동작한다"고 명시한다. 구현은 이를 별도 `else if` 분기로 격리하여 skip count 비누적을 보장하므로 spec 과 line-level 로 일치한다.

**반환값:**

`waitForAiConversation` 의 모든 코드 경로에서 `finalizeAiNode` 가 호출된다. `button_click` 분기는 `conversationEnded` 와 `finalStatus` 를 변경하지 않으므로 loop 가 계속 다음 resolve 를 기다리게 된다. `execPromise` 의 종결은 `endAiConversation` 또는 다른 종료 신호에 의존한다.

---

## Spec Fidelity 점검

관련 spec: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/0-common.md §10.9`

| spec 요건 | 구현 | 일치 여부 |
|---|---|---|
| `button_click` 케이스 명시 매칭 (dispatch 표 4행) | `else if (action.type === 'button_click')` 분기 추가 | 일치 |
| 도달 시 warn log | `this.logger.warn(...)` 호출 | 일치 |
| 도달 시 loop 재진입 (graceful degradation) | 분기 내 `conversationEnded` / `finalStatus` 무변경 → 루프 재진입 | 일치 |
| skip count 에서 제외 | `unknownSkipCount` 증가 없음 | 일치 |
| `else` 분기 (truly-unknown) 는 cap 카운트 대상 유지 | `else` 분기 `unknownSkipCount += 1` 그대로 | 일치 |

spec §10.9 본문과 구현 사이에 CRITICAL/WARNING 등급의 불일치는 없다.

---

## 요약

이번 변경은 `waitForAiConversation` loop 에서 `button_click` action.type 을 truly-unknown `else` 분기에서 분리하여 별도 `else if` 분기로 처리함으로써, 텔레그램 stale inline_keyboard 클릭이 `MAX_UNKNOWN_SKIPS` cap 에 누적돼 대화가 FAILED 종결되는 회귀를 정확히 차단한다. spec `§10.9` dispatch 표와 line 407 invariant 단락이 명시하는 "warn log + loop 재진입(graceful degradation, skip count 비누적)" 요건을 line-level 로 충족한다. 신규 테스트는 MAX_UNKNOWN_SKIPS(=20) 를 초과하는 25회 button_click 시나리오를 검증하며, 루프 alive 확인 + 정상 종결 + cap warn 부재 어서션의 세 축을 모두 커버한다. 발견된 3건은 모두 INFO 수준의 코드 스타일·주석 개선 사항으로, 기능 동작과 요구사항 충족에 영향을 주지 않는다.

---

## 위험도

LOW
