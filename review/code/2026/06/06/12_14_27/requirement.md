# 요구사항(Requirement) 리뷰 결과

리뷰 대상: webchat eager start (§R6 — open 시 execution 시작, firstMessage 폐기)

---

## 발견사항

### **[CRITICAL]** 런처 추천질문(launcher.suggestions) 탭 시 메시지 유실

- 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx` 35–38행
- 상세:
  런처(collapsed) 추천질문 버블 탭 핸들러:
  ```
  actions.open();
  actions.submitMessage(text);
  ```
  `open()` 내부에서 `void start()` 를 비동기로 호출하고 즉시 반환한다. 그 직후 동기로 `submitMessage(text)` 가 실행되지만, 이 시점 `sessionRef.current` 는 아직 `null` (webhook 202 응답 미도달)이므로 `submitMessage` 는 `if (!sessionRef.current) return` 조건에서 **텍스트를 조용히 버린다**. 사용자가 탭한 추천 질문 텍스트는 전송되지 않으며 어떤 에러·피드백도 없다.

  spec `1-widget-app §2` 는 "버블 탭 → 패널 open + 해당 텍스트를 first message 로 제출" 이라 명시하며, eager start 이후에도 이 동작은 유지되어야 한다. 현재 구현은 이를 완전히 깨뜨린다.

- 제안:
  `open()` 또는 `start()` 가 세션을 확보한 뒤 전달할 수 있도록 "pre-fill 메시지 큐"를 도입하거나, 혹은 세션 확보 후 자동으로 `submit_message` 를 재전송하는 메커니즘이 필요하다. 예:
  - `pendingFirstMessageRef = useRef<string | null>(null)` 을 두고 `start()` 성공 후 (세션 확보 직후) `awaiting_user_message` 진입 시 자동 전송.
  - 또는 `open(text?: string)` 시그니처 확장으로 pre-fill 텍스트를 start 흐름 안에서 처리.

---

### **[WARNING]** 패널 welcome.suggestions 탭 중 `booting` 단계 메시지 유실

- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` 82–86행
- 상세:
  패널 내부 welcome suggestions(`fresh && welcomeSuggestions.length > 0` 조건)은 메시지가 없는 동안 렌더된다. 이 조건은 `phase` 를 체크하지 않으므로, `booting` 또는 `streaming` 단계에서도 버튼이 보인다. 사용자가 webhook 응답 도달 전(`sessionRef.current === null`)에 탭하면 `submitMessage` 가 `!sessionRef.current` 조건에서 조용히 드롭한다.

  launcher.suggestions 과 동일한 근본 문제이며, 가시 시간이 짧아 발생 빈도는 낮지만 재현 가능한 race 다. `Composer` 는 `awaiting_user_message` 에서만 활성화하는 가드가 있는 반면, 추천질문 버튼에는 이에 상응하는 가드가 없다.

- 제안:
  panel suggestions 버튼을 `phase !== "awaiting_user_message"` 또는 `!sessionRef.current` 시 비활성(disabled) 처리하거나, 위 CRITICAL 아이템에서 도입한 pre-fill 큐 메커니즘으로 함께 처리.

---

### **[WARNING] [SPEC-DRIFT]** spec `1-widget-app §2` 런처 버블 설명이 구 lazy 동작 기준

- 위치: `spec/7-channel-web-chat/1-widget-app.md` 30–31행
- 상세:
  ```
  런처(collapsed): 우하단 플로팅 런처 버튼 + 추천 질문 버블 N개(launcher.suggestions). 버블 탭 → 패널 open +
  해당 텍스트를 first message 로 제출.
  ```
  이 설명은 lazy 시작 모델("첫 입력 시 execution 시작 + firstMessage 동봉")을 전제한 것으로, eager start 채택 후 갱신되지 않았다. 코드 변경은 의도적이고 합리적이지만 spec 본문이 낡은 기술을 유지 중이다.
- 제안: 코드 유지 + spec §2 런처 설명을 eager start 기준으로 갱신. "버블 탭 → 패널 open + 워크플로우가 이미 시작됐으므로 해당 텍스트를 `submit_message` 로 전송(pre-fill)" 방향으로 수정. 대상 spec: `spec/7-channel-web-chat/1-widget-app.md §2` 30–31행.

---

### **[INFO] [SPEC-DRIFT]** spec 상태기계 다이어그램 — `[collapsed]→[booting]` 직접 전이 vs 코드의 중간 `panel` 단계

- 위치: `spec/7-channel-web-chat/1-widget-app.md` 53행 (다이어그램)
- 상세:
  spec 다이어그램: `[collapsed] ──open──▶ [booting]`
  실제 코드 흐름: `OPEN` dispatch(→ `panel`) 후 즉시 `START` dispatch(→ `booting`). `panel` 단계가 순간적으로 존재한다. 이는 `widget-state.ts` 에서 `WidgetPhase` 유니온에 여전히 `"panel"` 이 포함되어 있고 `NEW_CHAT`·`CLOSE` 처리에도 사용된다.

  코드 동작은 의도적이며(open 이벤트와 start 이벤트를 분리된 dispatch 로 처리하는 구조적 이유), 기능 오류는 아니다.
- 제안: 코드 유지 + spec 다이어그램에 `[panel]` 중간 단계 표시 또는 주석 추가. 대상 spec: `spec/7-channel-web-chat/1-widget-app.md §3` 다이어그램.

---

### **[INFO] [SPEC-DRIFT]** phase 이름: spec 은 `awaiting_user_input`, 코드는 `awaiting_user_message`

- 위치: `spec/7-channel-web-chat/1-widget-app.md` 53행 vs `codebase/channel-web-chat/src/lib/widget-state.ts` 13행
- 상세:
  신규 spec 다이어그램에 `[awaiting_user_input]` 으로 표기됐지만 코드 `WidgetPhase` 는 `"awaiting_user_message"` 를 유지한다. 공개 계약(SDK 이벤트 타입 등)에 노출될 경우 명칭 불일치가 혼란을 야기할 수 있다.
- 제안: 코드 유지(기존 `awaiting_user_message` 명칭이 더 명확) + spec 다이어그램 수정 (`awaiting_user_input` → `awaiting_user_message`). 대상 spec: `spec/7-channel-web-chat/1-widget-app.md §3` 다이어그램.

---

### **[INFO]** `start` 가 `actions` 반환 객체에 노출

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 414행
- 상세:
  `actions: { open, close, start, submitMessage, ... }` — `start` 가 외부 공개 actions 에 포함되어 있다. eager start 이후 `start` 는 `open()` 내부에서만 호출되어야 하는 내부 함수인데, 외부에서 직접 호출 가능한 상태다. `start` 를 직접 호출하면 `startedRef` 가드가 있어 중복 시작은 방지되지만, 의도하지 않은 API surface 가 된다.
- 제안: `start` 를 `actions` 에서 제거하거나, 필요하다면 명시적으로 public API 범위를 문서화. 기능 오류는 아니며 INFO 수준.

---

## 요약

eager start(§R6) 핵심 동작 — 패널 open 시 execution 시작, firstMessage 폐기, `startedRef` 중복 가드, 세션 복원 시 재시작 방지 — 은 `use-widget.ts`, `widget-state.ts`, `eia-client.ts`, `panel.tsx` 에서 일관되게 구현되었으며 spec(`1-widget-app §3`, `3-auth-session §3`)과 line-level 로 정합한다. 그러나 **런처(collapsed) 추천질문 탭 시 텍스트가 유실되는 CRITICAL 회귀**가 있다: `open()`이 비동기 `start()`를 non-await으로 호출하는 사이 동기 `submitMessage(text)`가 `sessionRef.current === null` 조건에서 조용히 드롭된다. spec `§2` 런처 설명과 구현 간 괴리가 동시에 존재한다. 패널 welcome.suggestions 의 동일한 race 조건은 발생 빈도가 낮지만 동일 메커니즘으로 유실 가능하다. 나머지 발견사항은 spec 다이어그램 문구 갱신 누락(SPEC-DRIFT) 및 INFO 수준이다.

## 위험도

**HIGH** — launcher suggestions 텍스트 유실은 사용자 입력이 에러 없이 소실되는 기능 회귀이며, 비AI-first 워크플로우(buttons/form-first)를 사용하는 경우에도 welcome suggestions race 조건이 존재한다.
