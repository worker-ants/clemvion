# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md`
(WARNING #1 — `4-ai-assistant.md` ↔ `4-security.md` 역참조 / WARNING #2 — WS §4.4·EIA §6.2·architecture §3
`waiting_for_input` wire 필드 drift caveat)

> 참고: 호출 payload (`_prompts/rationale_continuity.md`)에 첨부된 "관련 Rationale 발췌"는 613줄 지점에서
> `"... (truncated due to size limit) ..."`로 잘려 있어, 정작 본 target 이 건드리는 4개 spec_impact 파일
> (`3-workflow-editor/4-ai-assistant.md`, `5-system/6-websocket-protocol.md`,
> `5-system/14-external-interaction-api.md`, `7-channel-web-chat/0-architecture.md`)의 `## Rationale`
> 섹션이 발췌에 포함되지 못했다 (발췌는 `0-overview.md`→`2-navigation/4-integration.md` 순으로 잘림).
> 이 checker 는 누락을 메우기 위해 해당 4개 파일 + `7-channel-web-chat/4-security.md`의 `## Rationale`을
> 직접 Read 해 검토했다.

## 발견사항

- **[INFO]** WS §4.4 caveat 방식(직접 재작성 대신 caveat) 선택 근거를 문서 자체 `## Rationale` 에도 남기면 좋음
  - target 위치: 편집 2 (`spec/5-system/6-websocket-protocol.md §4.4` intro 뒤 caveat blockquote 삽입) — target 문서 line 104–114
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 `buttonConfig` 예시 정정 —
    타임아웃 제거 + `nodeOutput` 판별자 폐지 (2026-06-03 spec-drift 결정 C2·C3)" (같은 §4.4 절 대상, line 947–952)
  - 상세: 같은 §4.4 절에서 과거(C2·C3)에는 예시가 구현 현실과 어긋났을 때 **JSON 예시 자체를 실제 구조로 직접
    재작성**하는 방식을 택했다(`timeout` 필드 제거, `nodeOutput` 을 실제 5필드 구조로 교체). 이번 target 은 같은
    §4.4 절의 또 다른 drift(`nodeId`→`waitingNodeId` 등)에 대해서는 반대로 **예시를 그대로 두고 caveat 블록만
    추가**하는 방식을 택한다(target 문서 line 88–89 "미채택 — path A"). 두 방식이 공존하는 것 자체는 근거가
    있다 — C2/C3 는 "예시가 담고 있는 논리적 내용 자체의 오류"(존재하지 않는 timeout, 폐기된 판별자)를 고친
    것이고, 이번 건은 §2.1/§2.2 가 이미 확립한 "논리 구조 표기 + 구현현실 caveat" 패턴(Socket.IO 이벤트명·
    평면 병합 등, line 69·89)의 연장이라 그 자체로 새 원칙을 도입하는 것은 아니다. 다만 이 구분이 target 문서의
    "처분 결정" 절(plan 파일)에는 명시돼 있지만, 실제 spec 편집안(편집 2)이 삽입되는 `6-websocket-protocol.md`
    자체의 `## Rationale` 에는 반영되지 않는다 — 향후 "같은 절 안에서 왜 어떤 drift 는 직접 고치고 어떤 drift 는
    caveat 만 다는가"를 감사하는 사람이 C2/C3 항목만 보고 혼동할 여지가 있다.
  - 제안: 필수는 아니나, 편집 2 삽입 시 `## Rationale` 에 "§4.4 `waitingNodeId` wire caveat (EIA §6.2 SoT 참조,
    직접 재작성 대신 caveat 채택 — 이유: §2.1/§2.2 caveat 패턴 연장 + 3중 복제 회피)" 한 항목을 짧게 추가하면
    C2/C3 항목과의 방식 차이가 self-documenting 해진다.

- **[INFO]** WARNING #1 역참조 추가의 배경 근거가 `4-ai-assistant.md` 자체 `## Rationale` 에는 남지 않음
  - target 위치: 편집 1 (`spec/3-workflow-editor/4-ai-assistant.md` line 145 "메시지 리스트" 행에 웹챗 보안
    매트릭스 역참조 추가) — target 문서 line 95–102, "처분 결정" 근거는 line 79–80
  - 과거 결정 출처: `spec/7-channel-web-chat/4-security.md` `## Rationale` → "R4. 마크다운 sanitize —
    deny-by-default allowlist (blacklist 기각)" (line 218–222) — 두 렌더러의 "보안 동등성" 개념을 이미 공식
    Rationale 로 명문화한 절
  - 상세: 위반은 아니다 — 오히려 target 의 역참조 추가는 R4 가 이미 선언한 "두 렌더러 보안 동등성" 원칙과
    정합적이고, 그 원칙을 소유 영역(에디터) 쪽에서도 보이게 만드는 보강이다. 다만 target 이 근거로 든
    "단방향 → 양방향 전환, 소유 영역 편집자 눈앞에 트리거를 둔다"는 판단(target 문서 line 79–80)은 이 프로젝트
    관행상 각 spec 의 `## Rationale` 에 남기는 유형의 결정 서술("왜 이 위치·이 표현을 택했는가")과 결이 같은데,
    `4-ai-assistant.md` `## Rationale` 에는 이 항목이 추가되지 않는다 (편집 1은 본문 §3.2 행 수정만).
  - 제안: 필수는 아니나, 짧은 한 줄이라도 `4-ai-assistant.md` `## Rationale` 에 "markdown 렌더러 sanitize
    정책 변경 시 web-chat 보안 동등성 매트릭스(§7-channel-web-chat/4-security §1.1) 검토가 필요함을 소유
    영역에 명시 — 단방향 참조의 누락 위험 대응" 을 남기면, 이 프로젝트의 다른 cross-spec 참조 결정들
    (예: `2-trigger-list.md` R-8, `1-data-model.md` install_token 항)과 같은 패턴으로 추적 가능해진다.

기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다. 구체적으로 확인한 사항:

- WS §4.4 의 `{ type, payload }` "논리 구조 + 실제 wire 는 다름" 캐비어트 패턴(§2.1/§2.2, line 69·89)과
  EIA §6.2 의 기존 "SSE 스트림 wire 형태 주의" blockquote(line 585–593, 2026-06-03 계열 정정 이후 이미 존재)는
  target 이 재도입하는 게 아니라 **동일 패턴을 §4.4 로 확장**하는 것 — 신규 원칙 도입이나 과거 대안 재부활이
  아니다.
- target 이 "미채택"으로 명시한 두 대안(JSON 예시 전체 재작성 / 신규 backlog plan 파일)은 모두 근거를 갖춘
  명시적 기각이며, 기존 Rationale (R9/R10 의 "단일 SoT, 중복 회피" 원칙, `spec/5-system/14-external-interaction-api.md`
  line 1017 "새 counter 도입 시 두 채널 간 정합성 검증이 별도 필요해짐 → 비용 크고 이득 없음")과 방향이 일치한다.
- `plan/complete/fix-webchat-sse-field-map.md` 가 이 drift 를 "web-chat 코드 범위 PR이라 본격 처리는 미룸"이라고
  이월한 사실(target 문서 line 68–72)을 직접 대조 확인했다 — 그 plan 의 실제 문구(line 38–40, 57)와 target 의
  요약이 정확히 일치한다. 지금 그 제약(코드 범위 한정)이 없다는 target 의 판단도 사실관계상 타당 — **결정 번복이
  아니라 이월된 미해결 항목의 완결**이며, 이 완결 사유가 "처분 결정" 절에 이미 명문화돼 있어 기준 3
  ("결정의 무근거 번복") 을 충족한다.
- `spec/7-channel-web-chat/0-architecture.md §3` line 82 의 dangling "별도 backlog" 문구, `14-external-interaction-api.md
  §6.2` line 593 의 동일 문구를 직접 대조해 target 의 "미등재" 주장(WARNING #2)이 사실과 일치함을 확인했다.
- 편집 2 캐비어트가 서술하는 실제 필드명(`waitingNodeId`/`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`)은
  `form-interaction.service.ts`/`button-interaction.service.ts`/`ai-turn-orchestrator.service.ts` 의
  `emitExecution(EXECUTION_WAITING_FOR_INPUT, …)` 호출부와 `codebase/channel-web-chat/src/lib/eia-events.ts` 를
  직접 grep 해 일치를 확인했다 — 이미 확립된 EIA §6.2 caveat/architecture §3 caveat 의 매핑과도 정합한다.

## 요약

target 은 두 독립 WARNING 을 처리하는 spec-only draft로, 두 건 모두 **이미 존재하는 Rationale·caveat 패턴(§2.1/§2.2
"논리 구조 + 구현현실" 캐비어트, EIA §6.2 blockquote, R4 "보안 동등성", R9/R10 "단일 SoT")을 확장·완결**하는 성격이며,
기각된 대안을 이유 없이 되살리거나 합의된 설계 원칙을 우회하는 지점은 발견되지 않았다. 유일한 사각지대는 payload
자체에 포함된 "관련 Rationale 발췌"가 정작 target 이 손대는 4개 spec 파일의 `## Rationale` 을 truncation 으로
누락했다는 점이었는데, 직접 원본을 대조한 결과 target 의 사실관계 서술(과거 completed plan 인용, EIA/architecture
dangling 문구, 코드상 실제 wire 필드명)은 모두 정확했다. 남은 두 건은 실질적 리스크가 아니라, target 이 plan
문서 안에서만 남긴 "왜 caveat 인가 / 왜 역참조인가" 근거를 대상 spec 파일 자체의 `## Rationale` 에도 짧게
반영하면 향후 감사자가 같은 절 안의 다른 방식(C2/C3 직접 재작성 vs 이번 caveat)이나 단방향→양방향 참조 전환의
이유를 spec 만 보고도 추적할 수 있다는 완결성 제안이다.

## 위험도

LOW
