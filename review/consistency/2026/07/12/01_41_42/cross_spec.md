### 발견사항

없음 (검토 결과 CRITICAL/WARNING/INFO 없음).

**검토 범위 메모**: 본 impl-done 검토의 실제 코드 diff(`git diff origin/main`)는 `spec/7-channel-web-chat` 을 전혀 건드리지 않는다 —
변경분은 `codebase/channel-web-chat/src/lib/widget-state.test.ts`(신규 characterization test), `use-widget-eager-start.test.ts`(신규
복원 통합 test), `widget-state.ts`(로직 무변경, `mergeMessages` JSDoc 정정)뿐이며 `plan/in-progress/webchat-multiturn-restore-test.md`
가 이를 "test-only, 제품 코드 무변경"으로 명시한다. 따라서 cross-spec 관점에서 새로 도입된 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임은 없다. 본 검토는 `spec/7-channel-web-chat` 전체 번들(0-architecture~5-admin-console)이 다른 spec 영역과
정합한지를 재확인하는 형태로 수행했다.

target 이 참조하는 다른 영역의 주요 계약을 실제 spec 원문과 대조해 검증했다(모두 일치, 충돌 없음):

- `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07(idle-wait reaper, `cancelledBy='timeout'`/`error.code='WEBCHAT_IDLE_TIMEOUT'`, grace `WEBCHAT_IDLE_REAP_GRACE_MS`), §5.4 cancel, §5.5 refresh-token, §6.2 SSE wire 필드명 drift 각주(`waitingNodeId`/`interactionType`/`nodeOutput.*`/`buttonConfig`/`conversationThread`), §8.5 CORS `interactionAllowedOrigins`, §R10 단일 sink 정책(위젯=facade 미신설) — target 의 §3 EIA 매핑·§R2·§R9, `3-auth-session.md` §R6, `4-security.md` §2 서술과 정확히 대응.
- `spec/conventions/conversation-thread.md` §1.1 5-value `ConversationTurnSource`, §2.1 "`turn.presentations[]` 는 `source: 'ai_assistant'` 한정" 제약 — target `1-widget-app.md` §2 메시지 리스트 행·§R8 "durable 복원 범위" 서술과 정확히 대응(양쪽 문서가 서로를 상호 링크).
- `spec/1-data-model.md` §2.2 `Workspace.settings.interactionAllowedOrigins`, `spec/2-navigation/9-user-profile.md` §347-348 `PATCH /api/workspaces/:id/settings`(Admin+) — target `4-security.md` §2.1 편집 표면 서술과 일치.
- `spec/2-navigation/_product-overview.md` NAV-WC-01..06, `spec/2-navigation/10-auth-flow.md` §435 `/_widget` proxy 예외(0-architecture §4.1 역참조) — target `5-admin-console.md`·`0-architecture.md` §4.1 서술과 일치.
- `spec/5-system/12-webhook.md` WH-SC-01(`auth_config_id IS NULL`, endpointPath CSPRNG UUID) — target `3-auth-session.md` §1 서술과 일치.

target 내부에서도 이미 자체적으로 두 건의 알려진 drift(SSE wire 필드명 ≠ EIA §6.2/WS §4.4 표기, EIA-NF-03 `replay_unavailable` 이벤트
소비 미배선)를 "별도 backlog"/"TODO" 로 명시 등재해 두었다 — 이는 신규 발견이 아니라 target 이 이미 정직하게 노출한 기존
사안이므로 별도 항목으로 보고하지 않는다.

### 요약
이번 diff 는 `spec/7-channel-web-chat` 을 변경하지 않는 test-only PR(위젯 multi-turn 히스토리 복원 characterization test + `mergeMessages` JSDoc 정정)이며, spec-linked 코드(`1-widget-app.md` code glob)라 가드 의무로 cross-spec 검토가 트리거됐다. target 스펙 번들(0-architecture~5-admin-console) 6개 문서를 EIA·webhook·conversation-thread convention·data-model·2-navigation 등 실제 원문과 대조한 결과 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 모순을 발견하지 못했다. 참조된 요구사항 ID(EIA-RL-07/IN-02/IN-12/AU-04/AU-05/NF-03, WH-SC-01, NAV-WC-01..06 등)는 모두 대상 문서에 정의된 그대로 사용되고 있으며 재정의·충돌이 없다.

### 위험도
NONE
