### 발견사항

없음.

target(`spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4)의
이번 변경분(diff: `origin/main...HEAD`)을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
(정본 트래커) 및 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 와 대조 검증했다. 세 관점 모두
충돌·누락을 발견하지 못했다:

1. **미해결 결정과의 충돌** — 없음. 이번 diff 는 `waiting_for_input` 표면(SSE/fanout 의 `nodeOutput` /
   `buttonConfig.nodeOutput`)에 fail-closed allowlist 를 적용하는 것으로 스코프를 명시적으로 좁혔고,
   `execution.node.completed`/`.failed` 의 `envelope.output` 은 "shape 판별이 먼저인 별건" 이라며 **의도적으로
   미해결로 남겼다** — 이는 임의 결정이 아니라 정본 트래커(`spec-sync-external-interaction-api-gaps.md:136-166`)에
   CRITICAL 로 등재된 상태와 정확히 일치한다. `websocket.service.spec.ts:931` 의 `[잔여]` 캐너리 테스트가
   실측으로 그 미해결 범위를 고정하고 있음을 확인했다 (`grep` 으로 직접 확인).
2. **선행 plan 미해소** — 없음. 이번 변경이 전제하는 선행 조건(`allowlistNodeOutputKeys` 헬퍼, EIA §R17
   REST `getStatus` allowlist, `NODE_OUTPUT_ALLOWED_KEYS` 8키 정의)은 모두 같은 날(2026-08-23) 선행 PR
   (#1205, `16f3e3625`)과 직전 커밋들에서 이미 완료돼 있다. `node-output-allowlist.ts` 의 실제 wire-only
   키 집합(위젯 4 + chat-channel 4 = 8)을 직접 읽어 plan 이 기록한 "8키" 와 diff 의 표가 서로 일치함을
   확인했다.
3. **후속 항목 누락** — 없음(단, 이미 트래커에 정확히 반영돼 있음을 확인). 이번 diff 가 만든 잔여 갭
   3건 — (a) `execution.node.*` 의 `envelope.output` (CRITICAL, 정본 트래커에 신규 등재됨) (b)
   `spec/conventions/egress-masking.md` §2 파이프라인 순서가 3단계로 낡음(`toFanoutEnvelope` 실제 코드는
   `strip → nodeOutput allowlist → routing` 3단계로 이미 바뀌어 있음을 코드에서 확인, 문서만 미반영·
   planner 소관으로 위임 명시) (c) `spec/conventions/node-output.md` Principle 0 의 닫힌 레지스트리가
   EIA wire-only 8키를 모른다(planner 소관 명시) — 모두 트래커(`spec-sync-external-interaction-api-gaps.md`
   L120-134, L176-180)에 "planner 소관" 태그와 함께 등재돼 있어 개발자 권한 밖 항목으로 적절히 위임됐다.
   `conversation-thread.md` frontmatter `code:` 누락(WS L168-174) 도 같은 트래커에 INFO 로 별도 등재돼
   있고 실제로 `spec/conventions/conversation-thread.md` frontmatter 를 확인해 `websocket.service.ts` 가
   빠져 있음을 재확인했다 — 지적이 정확하고 이번 diff 스코프 밖이라 손대지 않은 것도 타당하다.

부가 확인: `spec-draft-eia-62-waiting-payload.md`(체크리스트 항목 (7))에 이미 "후속 (2026-08-23,
`sse-nodeoutput-allowlist` PR)" 각주가 달려 있어, 이번 PR 이 그 항목의 완료를 형제 plan 에 정확히
반영했음을 확인했다(`feedback_review_fix_stale_loop`/`project_router_trust...` 교훈이 지적해 온 "자매
plan 이 서로의 완료를 못 보는" 패턴이 이번엔 발생하지 않았다).

### 요약

이번 diff(`spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md`
§4.4)는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)와 완전히 정합한다.
스코프를 `waiting_for_input` 표면으로 명시적으로 좁히고 `execution.node.*` 의 `envelope.output` 잔여를
CRITICAL 로 신규 등재 + 캐너리 테스트로 고정한 점, 파생 갭(egress-masking.md 파이프라인 순서·
node-output.md 레지스트리·conversation-thread.md frontmatter)을 모두 "planner 소관" 으로 명시적으로
위임하고 임의 결정을 내리지 않은 점을 코드·plan 문서 양쪽에서 직접 대조해 확인했다. 미해결 결정을
우회하거나 선행 plan 을 무시하거나 후속 항목을 누락한 사례를 찾지 못했다.

### 위험도

NONE
