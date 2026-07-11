### 발견사항

- **[WARNING]** 후속 plan(`webchat-widget-presentation-followups.md`) 항목 갱신 지시 누락
  - target 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` §"후속 구현 (developer, 같은 PR)" (및 §"스코프 경계 (명시)")
  - 관련 plan: `plan/in-progress/webchat-widget-presentation-followups.md` §미구현 항목 1 "위젯 truncation 배너에 총 개수 노출" (`TableData`/`CarouselData` 에 `totalCount?: number` 추가 여부는 표면 확장이라 planner 결정 선행 — 문구)
  - 상세: target 은 followups plan 이 요구한 "planner 결정 선행" 조건을 정확히 충족하고(§2/§R8 표시 계약 정의), table 스코프 한정임을 명시적으로 경계 짓는 점(스코프 경계 절)까지는 정합하다. 그러나 target 의 "후속 구현" 목록(`presentation.ts`/`presentations.tsx`/테스트)에는 `webchat-widget-presentation-followups.md` 항목 1 자체를 갱신하는 작업이 빠져 있다. 이 PR 이 머지되면 항목 1 은 table 부분이 해소되는데도 followups.md 는 여전히 "TableData/CarouselData 에 totalCount 추가 여부는 표면 확장이라 planner 결정 선행"이라는 미해결 문구를 그대로 유지해 stale 해진다. 후속 작업자가 항목 1 을 전부 미해결로 오독하거나(중복 작업 위험), 반대로 carousel 부분(여전히 미구현)까지 이미 끝났다고 오판할 위험이 있다.
  - 제안: target(또는 이를 이어받는 developer PR)의 후속 구현 목록에 `plan/in-progress/webchat-widget-presentation-followups.md` 항목 1 갱신을 명시적으로 추가 — 구현 완료 시 "table 부분 해소(본 PR), carousel 잔여(item 2 와 병합/의존)"로 재기술하거나 체크 표시. (project-planner 규약상 실제 완료 전 체크 표시는 금지되므로, target 문서 자체에 "구현 완료 후 이 항목을 갱신할 것"이라는 지시를 남기는 것이 적절.)

### 요약
Target 문서는 정확히 `webchat-widget-presentation-followups.md` 가 요구한 "표시 계약 planner 결정 선행" 조건을 충족하는 결정이며, 실측(백엔드/와이어 무변경, dead field 확인)과 spec 앵커(§2 L48, §R8, `0-common.md` §4/§10.4)가 모두 현재 코드·spec 상태와 정확히 일치한다. `§R8` 대상도 실제로 truncation 흡수를 다루는 섹션이라 번호·내용 충돌이 없고, carousel 스코프 배제 논리도 followups plan 의 항목 2("카루셀 잘림 배너 미구현")와 모순 없이 정합하다. 다만 target 이 부분적으로 해소하는 followups plan 항목 1 을 갱신하도록 지시하지 않아 plan 이 stale 해질 여지가 있다(WARNING 1건). 참고로 orchestrator 가 이번 검토에 번들한 in-progress plan 목록(`ai-agent-tool-connection-rewrite`/`cafe24-backlog-residual`/`chat-channel-discord-gateway`/`chat-channel-slack-socket-mode`/`chat-channel-visual-ssr-png`)에는 target 이 직접 인용하는 `webchat-widget-presentation-followups.md` 가 빠져 있어, 본 검토는 해당 파일을 직접 읽어 보완했다.

### 위험도
LOW
