# 요구사항(Requirement) 리뷰 결과

검토 대상: Channel Web Chat — 위젯 리팩터(B) + 테스트 보강(C)
검토 일시: 2026-06-27
관련 spec: `spec/7-channel-web-chat/1-widget-app.md` (§2·§3·§3.1·§R6)

---

## 발견사항

### [INFO] `isTextInputSurface` 적용이 `submitMessage` 즉시전송 경로에는 미적용

- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` L305–309
- 상세: `isTextInputSurface` 헬퍼는 C1 flush effect(L330)와 `panel.tsx` Composer disabled 조건에 적용됐다. 그러나 `submitMessage` 즉시전송 조건(L305–309)은 구 denylist 방식(`state.pending?.type !== "buttons" && state.pending?.type !== "form"`)을 그대로 유지한다. 이 PR 의 목표(B2/B5: 텍스트표면 판정 3중 중복 제거)는 세 곳 모두 교체하는 것이었으나 즉시전송 경로 한 곳이 누락됐다.
- 영향: 동작은 동일하다(denylist와 `isTextInputSurface`의 논리가 현재는 동등). 그러나 새 표면 타입(예: `voice`, `image_upload`)이 추가될 때 `isTextInputSurface`만 업데이트하면 되는 단일화 목표를 달성하지 못한다. 리팩터 의도와 구현의 괴리.
- 제안: `submitMessage` 즉시전송 조건도 `isTextInputSurface(state.pending)`로 교체해 3중 중복을 실제로 1곳(헬퍼 정의)으로 통일한다.

---

### [INFO] C1 flush effect 에서 `isTextInputSurface` 미적용 — 동일 패턴 잔존

- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` L330
- 상세: C1 flush effect(`useEffect`, L323–339) 역시 `state.pending?.type !== "buttons" && state.pending?.type !== "form"` 직접 비교를 유지한다. 헬퍼로 교체된 것은 `panel.tsx` Composer disabled 조건(파일 4)뿐이다. 이로 인해 `isTextInputSurface` 헬퍼 추출 작업의 중복 제거 목표가 완전히 달성되지 않았다.
- 제안: L330 조건도 `if (isTextInputSurface(state.pending))` 로 교체.

---

### [INFO] 토큰 refresh fake-timer 테스트가 `getStatus` mock 경로를 처리하지 않아 예외를 던질 수 있음

- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L918–966
- 상세: fake timer 테스트 내부 fetchMock은 `/embed-config`, `/api/hooks/`, `/refresh-token` 세 패턴을 처리하고 나머지를 `Promise.resolve({ ok:true, status:200, json: … })` 로 처리한다. `getStatus`(GET `/api/external/executions/e1`)는 네 번째 분기에 해당하며 non-waiting 응답(`status: "streaming"`)으로 처리돼 시드 dispatch를 막는다. 이는 의도적 설계이고 주석에도 명시됐다. 특이사항 없음 — 기록만.

---

### [INFO] `installControllableSse` 에서 `EventSource` 래퍼 클래스의 `addEventListener`/`close`가 no-op

- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L862–870
- 상세: 글로벌 stub `EventSource` 클래스가 constructor에서 `ControllableEventSource` 인스턴스를 반환하지만, 클래스 자체의 `addEventListener()`/`close()`는 no-op이다. `EiaClient.openStream`이 constructor 이후 반환된 인스턴스에 `addEventListener`를 호출하는 경우(생성자가 다른 객체를 반환하면 인스턴스 메서드가 아닌 constructor 반환값에 접근) 동작이 올바를 수 있으나, 이 패턴은 TypeScript에서 constructor가 `this`가 아닌 다른 객체를 반환하는 것으로, 런타임 동작이 명확하게 맞으면 무관하다. 실제 테스트가 green이므로 기능 문제는 없음.

---

### [INFO] `web-chat-quality-backlog.md §B` 체크박스가 완료 항목임에도 미완료로 표시

- 위치: `/Volumes/project/private/clemvion/plan/in-progress/web-chat-quality-backlog.md` §B
- 상세: 백로그 문서의 §B 항목들(`isTextInputSurface`, `teardownSession`, `TERMINAL_EVENTS` 등)이 `[ ]` 미완료 상태로 남아있다. 본 PR이 이 항목들을 구현했으나 backlog 체크박스를 갱신하지 않았다. plan 체크박스는 실제 상태를 반영해야 한다는 프로젝트 규약(MEMORY: plan 체크박스 = 실제 상태)에 따르면 갱신이 필요하다.
- 제안: 완료된 §B 항목들을 `[x]`로 표시하고 §C 항목도 동일하게 갱신.

---

### [INFO] [SPEC-DRIFT] `isTextInputSurface` allowlist 의미와 `null` 처리가 spec 본문에 미기재

- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/lib/widget-state.ts` L260–262
- 상세: 코드 주석은 `null`(ai_conversation 진입 전 등)도 텍스트 표면으로 본다고 명시한다("현행 동작 보존"). 이는 의도적 결정이다. 그러나 `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 조건("awaiting_user_message + ai_conversation 표면일 때만 자유 텍스트 입력 활성")에서 `pending=null` 상태를 텍스트 표면으로 취급하는 이유가 명시되지 않는다. spec 은 pending 타입을 `ai_conversation`/`buttons`/`form`으로만 언급하며, null 취급이 "ai_conversation 도달 전 과도 상태" 임을 명문화하지 않는다.
- 판단: 코드 동작이 합리적이고 의도적이며(테스트 `pending=null → Composer enabled` 검증), spec을 되돌리는 것이 오답인 경우. spec 갱신 누락.
- 제안: 코드 유지 + spec 반영. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행에 `pending=null`을 `ai_conversation` 과도 상태로 허용하는 이유 한 줄 추가 (planner 위임).

---

## 요약

본 PR은 `isTextInputSurface` 헬퍼 추출(B2/B5), `TERMINAL_EVENTS` 배열 파생(B6), `clearRefreshTimer`+`teardownSession` 헬퍼 추출(B3), 테스트 보강(C) 의 네 가지 작업으로 구성된 behavior-preserving 리팩터다. spec `1-widget-app §2·§3·§R6`의 eager-start 상태기계·Composer 게이팅·C1 flush/폐기·terminated 이벤트 정리 등 핵심 비즈니스 규칙이 코드에 올바르게 유지·반영됐다. 발견된 이슈는 두 가지 INFO급 불완전성이다: (1) `isTextInputSurface` 헬퍼가 `submitMessage` 즉시전송 경로(L305–309)와 C1 flush effect(L330)에서 아직 denylist 방식으로 남아 있어 "3중 중복 제거" 목표를 부분적으로만 달성했다. (2) `web-chat-quality-backlog.md §B·§C` 체크박스가 구현 완료 항목임에도 미갱신됐다. 동작 정확성(비즈니스 로직·에러 시나리오·엣지케이스)에는 이상이 없으며 테스트 커버리지가 적절히 확보됐다. CRITICAL/WARNING 없음.

## 위험도

LOW
