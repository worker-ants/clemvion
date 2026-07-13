# Cross-Spec 일관성 검토 — spec-draft-webchat-crossref-ws-wire-drift

- 검토 모드: spec draft 검토 (`--spec`)
- Target: `plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md`
- 영향 영역: `spec/3-workflow-editor/4-ai-assistant.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/5-system/14-external-interaction-api.md` · `spec/7-channel-web-chat/0-architecture.md`

## 사실관계 검증 요약

target 이 인용하는 line 번호·인용문·앵커를 실제 spec 파일과 대조했다:

- `spec/3-workflow-editor/4-ai-assistant.md:145` "메시지 리스트" 행 — target 인용과 일치. `sanitizeAssistantText` 만
  언급하고 markdown XSS sanitize 는 미언급 — target 의 gap 진단 정확.
- `spec/3-workflow-editor/**` 에 `7-channel-web-chat/4-security` 역참조 0건 — grep 으로 재확인, target 주장과 일치.
- `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 에 이미
  `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` 포함, §1.1 매트릭스도 이미 존재 —
  편집 1 은 단방향→양방향 전환이며 신규 모순 없음. `4-ai-assistant.md` 자체 `code:` glob(`assistant-panel/*.tsx`)이
  이미 해당 파일을 커버하므로 frontmatter 갱신 불요 — 이 부분도 정확.
- `spec/5-system/6-websocket-protocol.md` §2.1/§2.2(line 71–106), §4.4(line 378–), §4.1(line 188) 확인.
- `spec/5-system/14-external-interaction-api.md` §6.2 caveat blockquote(line 585–593) 확인 — target 인용과 정확히 일치.
- `spec/7-channel-web-chat/0-architecture.md` §3 line 82 dangling 문구 확인 — target 인용과 일치.
- 코드 근거(`form-interaction.service.ts` / `button-interaction.service.ts` / `ai-turn-orchestrator.service.ts`)의
  `waitingNodeId`/`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId` emit, `eia-events.ts parseWaitingForInput`
  이 `ev.waitingNodeId` 만 소비하는 점도 직접 grep 으로 재확인 — target 의 코드 조사 결과와 일치.
- `plan/complete/fix-webchat-sse-field-map.md` 내용 확인 — "WS §4.4 / EIA §6.2 drift 는 더 광범위 — 본 PR 에선
  web-chat note + 플래그만" 인용 정확, `plan/in-progress/**` 어디에도 후속 backlog 파일 미등재 확인.
  `spec-sync-websocket-protocol-gaps.md` / `spec-sync-external-interaction-api-gaps.md` (기존 in-progress plan) 도
  확인했으나 이 필드명 drift 항목과는 무관한 별개 갭 목록이라 중복/충돌 없음.

이 검증들은 target 의 사실 기반이 정확함을 뒷받침한다. 아래는 **target 의 4개 편집이 적용된 이후** 발생/잔존하는
cross-spec 관점 이슈다.

## 발견사항

- **[WARNING]** 편집 2 가 EIA §6.2 를 "전체 필드 매핑 SoT" 로 지칭하지만 실제로는 불완전 — 편집 자체가 그 불완전성의 증거를 포함
  - target 위치: 편집 2 (`spec/5-system/6-websocket-protocol.md §4.4` 신규 caveat), 문구
    `"전체 필드 매핑 SoT: [EIA §6.2 ... blockquote]"`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §6.2` line 585–593 기존 caveat blockquote
    (편집 3 은 이 blockquote 의 매핑 목록 자체는 수정하지 않고 line 593 의 dangling 문구만 정정)
  - 상세: 편집 2 본문은 실제 wire 가 `waitingNodeId` 외에도 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`
    를 포함한다고 명시한다(코드로 확인됨: `form-interaction.service.ts:120-123` 등). 그런데 EIA §6.2 의 기존
    blockquote(line 586–591)는 `node.id → waitingNodeId` 와 `node.interactionType → interactionType` 만 매핑하며,
    **`node.type → waitingNodeType` 매핑조차 누락**돼 있고 `waitingNodeLabel`/`nodeExecutionId` 는 전혀 언급하지
    않는다(위젯이 이 필드들을 소비하지 않기 때문 — `eia-events.ts parseWaitingForInput` 은 `waitingNodeId` 만 읽음).
    즉 편집 2 는 "매핑을 복제하지 않고 EIA §6.2 를 가리킨다(단일 SoT 유지)"는 target 자신의 처분 결정 취지와 달리,
    EIA §6.2 에 없는 사실(3개 필드)을 새로 진술하면서 동시에 그 문서를 "전체" SoT 라고 단언한다 — 편집이 적용된
    후에도 두 문서가 서로 다른 완결성 수준의 필드 목록을 보유하게 되어, "전체" 라는 표현이 독자를 오도할 수 있다.
    `spec/7-channel-web-chat/0-architecture.md §3` 도 동일하게 3개 필드를 언급하지 않아 세 문서 중 WS §4.4 만
    유일하게 완전한 목록을 갖는 비대칭이 생긴다.
  - 제안: 다음 중 하나. (a) 편집 3 에서 EIA §6.2 blockquote 자체에도 `node.type → waitingNodeType` /
    `waitingNodeLabel` / `nodeExecutionId` 행을 추가해 실제로 "전체" 매핑 SoT 로 만든다(권장 — target 이 이미
    "3중 복제 회피·단일 SoT" 를 목표로 명시했으므로, SoT 문서 쪽을 완전하게 만드는 편이 그 목표에 부합). 또는
    (b) 편집 2 의 "전체 필드 매핑 SoT" 문구를 "id 재매핑 SoT"처럼 범위를 좁히고, `waitingNodeType`/
    `waitingNodeLabel`/`nodeExecutionId` 는 "WS 내부 전용 부가 식별자(외부 EIA 표면 caveat 목록엔 없음)"라고
    명시적으로 구분한다.

- **[WARNING]** 편집 2 인용 blockquote 원문에 깨진 상대경로 — 문자 그대로 복붙 시 dead link
  - target 위치: 편집 2 본문 중 `[EIA §6.2 ...](../5-system/14-external-interaction-api.md#62-...)`
  - 충돌 대상: 삽입 위치가 `spec/5-system/6-websocket-protocol.md` (즉 `spec/5-system/` 내부)이므로 `../5-system/…`
    는 `spec/5-system/../5-system/14-external-interaction-api.md` = `spec/14-external-interaction-api.md` 로
    resolve 되어 **존재하지 않는 경로**를 가리킨다(정답은 `./14-external-interaction-api.md`).
  - 상세: target 문서 자신도 편집 2 바로 아래 "(경로 주의: … EIA 링크는 `./14-external-interaction-api.md#…`.)"
    라는 각주로 이 오류를 인지하고 있다. 그러나 "적용할 편집" 섹션은 관례상 그대로 복사해 넣는 블록으로 취급되기
    쉬우므로, 각주를 놓치면 깨진 링크가 spec 에 들어갈 위험이 실질적이다.
  - 제안: 편집 2 blockquote 원문 자체를 `./14-external-interaction-api.md#62-...` 로 이미 수정된 최종형으로
    교체해 각주에 의존하지 않게 한다. (편집 3·4 의 링크는 상대경로 검증 결과 모두 정확 — `./6-websocket-protocol.md`
    from `14-external-interaction-api.md`, `../7-channel-web-chat/4-security.md` from `3-workflow-editor/`.)

- **[INFO]** §4.1 이벤트 목록 표(line 188)와 §4.4 JSON 예시 간 기존(target 무관) 필드 노출 격차 — 인접 기회
  - target 위치: 편집 2 삽입 지점 바로 위, `spec/5-system/6-websocket-protocol.md §4.1` line 188
  - 충돌 대상: 같은 문서 §4.4 의 Form/버튼/AI Multi Turn 세 JSON 예시(line 384–462)
  - 상세: §4.1 표는 `execution.waiting_for_input` 의 논리 payload 를
    `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, ... }` 로 요약해 `nodeExecutionId` 를 이미
    포함하지만, §4.4 의 세 JSON 예시는 `nodeExecutionId` 를 전혀 보여주지 않는다(코드 확인상 실제로는 세 서비스
    모두 emit). target 편집 2 는 이 gap 을 다루지 않는다 — 이 draft 의 책임 범위는 아니지만, 같은 절을 편집하는
    김에 함께 정리하면 §4.1 ↔ §4.4 ↔ 실제 wire 3자 간 정합이 한 번에 완결된다.
  - 제안: 필수 아님 — 이번 draft 범위 유지도 무방. 후속 caveat 강화 시 반영 고려.

데이터 모델(요구사항 ID·API endpoint·상태 전이·RBAC·계층 책임) 관점에서는 신규 엔티티·필드·endpoint·권한 구조 도입이
없고, target 은 4개 문서 모두 기존 caveat 패턴("논리 구조 표기 + 구현현실 caveat")을 그대로 답습하는 순수 문서
정합화이므로 이 축에서는 충돌을 발견하지 못했다.

## 요약

target 의 배경 조사(코드 grep·line 번호·기존 plan 인용)는 실제 spec/코드와 대조한 결과 모두 정확했고, 4개 편집
자체는 spec 트리 다른 영역과 새로운 데이터 모델·API·RBAC·상태 전이 충돌을 일으키지 않는다. 다만 편집 2(WS §4.4
caveat)가 스스로 "EIA §6.2 = 전체 필드 매핑 SoT" 라고 선언하면서 그 SoT 문서에 없는 3개 필드
(`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`)를 함께 진술해, 편집 적용 직후에도 WS/EIA/architecture
세 문서 간 필드 목록 완결성이 어긋나는 자기모순적 SoT 주장을 새로 만든다. 또한 편집 2 원문에 삽입 위치 기준으로
깨지는 상대경로가 포함돼 있어(각주로 인지는 돼 있음) 문자 그대로 적용 시 dead link 위험이 있다. 두 건 모두 편집
텍스트를 소폭 조정하면(EIA §6.2 매핑 완성 또는 SoT 범위 문구 축소, 그리고 상대경로 직접 수정) 해소되는 수준으로,
전체 draft 를 막을 사유는 아니다.

## 위험도

MEDIUM
