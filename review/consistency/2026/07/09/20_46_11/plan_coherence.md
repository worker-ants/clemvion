# Plan 정합성 검토 — spec/7-channel-web-chat/ (--impl-done)

## 검토 방법

- 구동 plan `plan/complete/webchat-session-controls-history-restore.md`(이번 diff 로 in-progress→complete 이관, frontmatter `spec_impact: [14-external-interaction-api.md, 1-widget-app.md, 2-sdk.md, 3-auth-session.md]`)를 diff(`git diff origin/main -- spec/7-channel-web-chat/1-widget-app.md spec/7-channel-web-chat/2-sdk.md spec/7-channel-web-chat/3-auth-session.md spec/5-system/14-external-interaction-api.md spec/conventions/conversation-thread.md`)와 문면 대조.
- `plan/in-progress/**` 전수(`web-chat`/`webchat`/`channel-web-chat`/`external-interaction-api`/`EIA` grep + "결정 필요" grep)를 재스캔해 이번 target 과 겹치는 미해결 결정·선행조건이 있는지 확인.
- 같은 세션의 선행 라운드(`review/consistency/2026/07/09/18_27_06`, `20_19_59`, `20_32_24`)의 plan_coherence/cross_spec findings 와 그 반영 커밋(`e3357d518`, `382e3a89d`)을 재검증해 residual 이 남았는지 확인.

## 발견사항

- **[INFO]** `4-security.md` interact rate-limit "Planned" stale 서술 — pre-existing, 이번 PR 스코프 밖으로 이미 문서화된 defer
  - target 위치: `spec/7-channel-web-chat/4-security.md:136`(§4 공개 webhook 남용 방어) — "interact 분당 60/execution 은 **Planned(미구현)**"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목 3(`[x]` 완료, `InteractionRateLimiterService`+`RATE_LIMITED 429` 구현됨) — 그리고 이미 flip 된 `spec/5-system/14-external-interaction-api.md:734`("Inbound 명령(`/interact`)... **구현됨**")
  - 상세: 이 stale 서술은 선행 라운드(`20_19_59/plan_coherence.md`)에서 WARNING 으로 이미 보고됐고, 다음 라운드 커밋(`e3357d518`, 메시지: "defer(pre-existing): 4-security.md §4 rate-limit "Planned" stale(본 PR 무관, 별도 spec-sync)")에서 **의도적으로 defer**됐다. 구동 plan(`webchat-session-controls-history-restore.md`)의 `spec_impact` 도 `4-security.md` 를 포함하지 않아 이번 PR 의 diff 범위 밖임이 frontmatter 로도 확인된다. 이번 라운드(`382e3a89d`)의 diff 도 `4-security.md` 를 건드리지 않아 여전히 stale 상태로 남아 있다 — 실제 동작(`구현됨`)과 문서(`Planned`)의 모순 자체는 유효하지만, 발생 원인·책임 소재가 본 PR 이 아니므로 CRITICAL/WARNING 승격보다는 추적 표면 보존이 적절하다.
  - 제안: `spec-sync-external-interaction-api-gaps.md` 에 항목을 추가하거나 별도 spec-only 소품 plan 으로 `4-security.md §4` 의 "interact 분당 60/execution 은 Planned" → "구현됨"으로 flip(SSE 동시 3/execution 행과의 "두 제한 구현 상태가 다르다" 전제 문장도 함께 정리). 본 PR 의 커밋 범위에 포함할 필요는 없음(이미 두 차례 defer 로 명시적 결정됨).

## 비고 — 정합 확인 (충돌·선행조건 미해소 없음)

- **구동 plan 과 diff 의 문면 일치**: `webchat-session-controls-history-restore.md` §"작업 A(스펙 재조정)"이 명시한 3개 스펙 변경(EIA §5.3/R17 getStatus durable thread 노출, 1-widget-app §2/§3.1 헤더 세션 컨트롤+메시지 role 매핑, 3-auth-session §3.1 복원 시퀀스)이 실제 diff 와 정확히 대응한다. "사용자 결정(2026-07-09): 새 대화+대화 종료 둘 다 헤더 노출, 가벼운 확인"은 이미 확정된 결정이며 target 이 그 위에 우회 결정을 내리지 않는다.
- **잔여/후속 항목의 durable 인코딩**: 구동 plan 의 "잔여/후속" 절(presentation shape 매핑, `resetSession`-during-`booting` 중복 webhook, thread redaction 하드닝·orphan 관련)은 이번 diff(`382e3a89d`)로 각각 `1-widget-app.md §2`(presentation 행 "알려진 제약(Planned)")·`§3.1`(새 대화 행 "알려진 제약(Planned)")·`14-external-interaction-api.md §R17`(허용 키 allowlist "후속 하드닝")에 명문화됐다 — plan 이 complete 로 이관되며 별도 backlog plan 파일 없이 spec Planned 마커로 추적 표면을 보존한 패턴이며, plan-lifecycle 관례와 일치한다. 새로 만들거나 무효화해야 할 다른 plan 의 후속 항목은 없다.
- **`spec-sync-external-interaction-api-gaps.md` 와의 교차 검증**: 항목 17("`GET /:id` currentNode/context 실값", 2026-07-08 재검증 완료)·항목 19("(후속) web-chat 위젯 클라이언트 소비 — `execution.replay_unavailable` no-op")는 이번 diff 의 `1-widget-app.md §3.1` SSE 재연결 단락("소비 분기는 아직 미배선(no-op)... 클라이언트 측 후속 — EIA-NF-03 연계 TODO")과 문면 그대로 일치한다. 항목 3(interact rate-limit)만 위 INFO 로 별도 보고. 그 외 미체크(`[ ]`) 항목(분산 SSE fan-out §R10)은 이번 diff(단일 인스턴스 DB 컬럼 read-only 노출)와 무관한 축이라 선행조건 위반이 없다.
- **선행 plan(`plan/complete/webchat-session-storage.md`) 과의 일치**: sessionStorage 채택·`3-auth-session §R6`·`1-widget-app §3.1` storage 문구는 이 선행(이미 complete) plan 이 확정한 결정을 그대로 전제하며 재번복하지 않는다.
- **`plan/in-progress/**` 전수 재스캔**: `web-chat`/`webchat`/`channel-web-chat` 를 언급하는 문서는 `spec-sync-external-interaction-api-gaps.md`(위에서 다룸)와 `rag-dynamic-cut.md`(완료 항목의 e2e flake 각주, 무관) 뿐이다. "결정 필요" 마커가 있는 6개 plan(`chat-channel-discord-gateway`·`chat-channel-slack-socket-mode`·`chat-channel-visual-ssr-png`·`competitive-analysis-n8n-flowise`·`node-cancellation-inflight-followups`·`spec-sync-workflow-list-gaps`)은 모두 채널·주제가 달라 이번 target 과 겹치는 미해결 결정이 없다.

## 요약

이번 target(`spec/7-channel-web-chat/1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` + cross-cutting `spec/5-system/14-external-interaction-api.md`·`spec/conventions/conversation-thread.md`)은 이를 구동한 `plan/complete/webchat-session-controls-history-restore.md`(같은 diff 로 in-progress→complete 이관)의 작업 항목과 문면·의도가 정확히 일치하며, `plan/in-progress/**` 의 어떤 "결정 필요" 항목도 우회하지 않는다. 선행 plan(`webchat-session-storage.md`)의 전제를 재번복하지 않고, 구동 plan의 잔여/후속 항목은 spec Planned 마커로 durable 하게 인코딩돼 후속 항목 누락도 없다. 유일한 참고 사항은 이 PR 과 무관한 pre-existing stale 서술(`4-security.md` interact rate-limit "Planned" 표기)로, 이미 두 차례(WARNING 보고 → 명시적 defer 결정)를 거쳐 out-of-scope 로 확정된 사안이라 INFO 로 하향 보고한다.

## 위험도
NONE
