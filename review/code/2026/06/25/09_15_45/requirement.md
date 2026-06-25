# 요구사항(Requirement) 리뷰

검토 대상 커밋: `cbb39decd1f547865175da4a9afd0eacb3cc7795`

---

## 발견사항

### [INFO] [SPEC-DRIFT] `execution.message` 이벤트가 EIA §5.2 SSE 이벤트 목록에 누락

- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §5.2 "이벤트 종류" 열거 (line 386–387)
- 상세: spec §5.2는 SSE 이벤트 종류를 열거한다: `execution.node.started` / `execution.node.completed` / ... / `execution.ai_message` / `execution.user_message` / `execution.tool_call_started` / `execution.tool_call_completed` / `execution.resumed`. 이번 커밋이 새로 도입한 `execution.message` 이벤트는 이 목록에 없다. 코드 구현(`ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'`)과 `EiaEventName` 타입에 `"execution.message"` 추가는 명백히 의도적이고 합리적인 신설이다. spec이 낡아서 반영이 누락된 것.
- 제안: 코드 유지 + spec 갱신. `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §5.2 이벤트 목록에 `execution.message` 추가, payload 형태(`{ nodeId, nodeType, presentations: [{config, output}] }`)와 발행 조건(non-blocking presentation 4종 완료) 명시. 신규 §6.x 절 추가 또는 §6.5 확장. 대상: `project-planner`.

---

### [INFO] [SPEC-DRIFT] `wc:command` payload 목록에 `resetSession` 누락

- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` §3 postMessage 프로토콜 표 (line 86)
- 상세: spec §3 표의 `wc:command` 페이로드 열은 `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 7가지만 열거한다. 이번 구현에서 추가된 `resetSession` 명령(`live-preview.tsx`에서 전송, `use-widget.ts`의 `bridge.onCommand` switch에서 처리)은 이 목록에 없다. 구현이 합리적이고 의도적이며, 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 갱신. `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` §3 `wc:command` 페이로드 목록에 `resetSession` 추가 및 동작(closeStream→clearSession→start) 설명. 대상: `project-planner`.

---

### [INFO] [SPEC-DRIFT] `admin-console §6`에 2-column 레이아웃 및 "새 세션" 버튼 미반영

- 위치: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/5-admin-console.md` §1 화면 구조 + §6 라이브 미리보기
- 상세: spec §1 화면 구조 다이어그램은 외형/콘텐츠와 라이브 미리보기가 나란한 2-column 구조를 의도하고 있고 이번 구현이 그 의도를 정합하였다. 그러나 §6에는 "새 세션" 리셋 버튼, `postCommand` 메커니즘, `xl:sticky` 2-column 배치 동작에 대한 명시적 기술이 없다.
- 제안: 코드 유지 + spec 갱신. `/Volumes/project/private/clemvion/spec/7-channel-web-chat/5-admin-console.md` §6에 "새 세션" 버튼(`wc:command resetSession` 경유), 2-column 레이아웃(xl+ 기준), sticky 미리보기 패널 기술 추가. 대상: `project-planner`.

---

### [INFO] 커밋 메시지의 "EIA §5.2 execution.message + R18, 2-sdk §3 resetSession, admin-console §6/R7" — R18·R7 미존재

- 위치: 커밋 메시지 spec 레퍼런스 라인
- 상세: 커밋 메시지가 "EIA §5.2 execution.message + **R18**" 및 "admin-console §6/**R7**"를 spec 근거로 명시하지만, `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md`에는 R18 항목이 없고, `/Volumes/project/private/clemvion/spec/7-channel-web-chat/5-admin-console.md`에는 R7 항목이 없다(R5·R6만 존재). 아직 spec에 추가되지 않은 Rationale 섹션을 미리 참조한 것이다. 코드 구현 자체의 결함이 아니라 spec 선행 미갱신 상태다.
- 제안: spec 갱신 시 R18(EIA execution.message Rationale)·R7(admin-console 2-column 레이아웃 + resetSession Rationale)을 정식 추가. 대상: `project-planner`.

---

### [INFO] `execution.message` 발행 시 `adapted.config` / `adapted.output` 의 undefined 가능성

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 4588–4589
- 상세: `adapted = adaptHandlerReturn(output)` 반환의 `adapted.config`와 `adapted.output`은 핸들러 구현 의존. PRESENTATION_NODE_TYPES 4종 핸들러는 `{ config, output }` 반환이 명세된 경로이나, 비정상 핸들러 반환 시 `{ config: undefined, output: undefined }`가 포함된 presentations가 위젯에 전달된다. 현재 테스트는 정상 케이스만 검증한다.
- 제안: INFO 수준. 현재 명세된 핸들러 경로에서는 충족. 필요 시 emit 전 `adapted.config != null && adapted.output != null` 가드 추가 고려.

---

### [INFO] `ParsedMessage` 타입에 `nodeId`·`nodeType` 미노출

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/channel-web-chat/src/lib/eia-events.ts` line 811–826
- 상세: `parseMessage` 반환 타입 `ParsedMessage`는 `presentations?` 만 포함한다. `nodeId`와 `nodeType`은 파싱 후 버려진다. 현재 소비처(`use-widget.ts`)는 presentations만 사용하므로 동작 무관하나, 향후 nodeId 기반 렌더 순서 제어·디버깅 확장 시 제한이 될 수 있다.
- 제안: INFO 수준. 현 단계 요구사항 충족. 향후 확장 시 `nodeId?: string; nodeType?: string` 추가 고려.

---

## 요약

3가지 핵심 요구사항(① non-blocking presentation 노드 `execution.message` 발행·위젯 렌더, ② 미리보기 세션 초기화 `resetSession`, ③ 2-column 레이아웃)은 모두 완전히 구현돼 있다. 공용 상수 `PRESENTATION_NODE_TYPES` 신설로 중복 정의 제거·의존방향 위반 방지가 올바르게 처리됐다. 백엔드 단위 테스트(emit 발행/미발행 2케이스)와 위젯 `parseMessage` 4케이스 테스트가 핵심 경로를 커버한다. 기능·엣지케이스·에러 시나리오·비즈니스 로직 측면에서 코드 수준 결함은 없다. 발견사항은 전부 spec이 코드를 따라가지 못한 [SPEC-DRIFT] + INFO이며, 코드 되돌리기 대상이 아닌 spec 갱신 대상이다.

## 위험도

LOW
