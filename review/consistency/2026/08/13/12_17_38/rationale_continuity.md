# Rationale 연속성 검토 결과

## 검토 범위 확인

- 리뷰 세션 워크트리(`eia-r8-cache-scope-4ae434`)의 실제 HEAD 는 branch `claude/redis-keys-pointer-integrity` (5d4655ceb), `origin/main` 대비 **1 커밋** 만 ahead.
- 해당 커밋(`5d4655ceb`, "인벤토리가 가리키는 절에 키가 없었다 — 빈 포인터가 하나가 아니라 둘")이 이번 target 의 실질 diff다. 변경 파일:
  `spec/5-system/12-webhook.md`(+11) · `spec/conventions/redis-keys.md`(±5) · `spec/4-nodes/4-integration/4-cafe24.md`(+5) · `spec/4-nodes/7-trigger/providers/{discord,slack}.md`(±) · `spec/data-flow/14-chat-channel.md`(+4) · `plan/in-progress/backend-lint-gate-broken-on-main.md`(+42, 백로그 기록).
- 코드 변경 없음 — 순수 spec/plan 문서 커밋 (Redis 키 인벤토리 포인터 정합화).
- `spec/5-system/14-external-interaction-api.md` §R8 (Idempotency-Key 캐시 스코프) 은 이번 diff 의 대상이 아니며(무변경), origin/main 에 이미 R8 관련 일련의 수정(a80599700~6b76a1dfe)이 전부 병합되어 있다. R8 본문·Rationale 을 대조했으나 이번 diff 와 직접 접점이 없다.

## 발견사항

없음.

검토한 잠재 충돌 지점과 판정:

1. **`12-webhook.md` §6 신규 "Redis 키" 표(WH-SC-05 관련)** — `conventions/redis-keys.md` 자신의 Rationale("왜 인벤토리가 포인터만 갖나": "키별 용도·TTL·fail 정책은 각 소유 문서가 SoT")이 명시적으로 요구하는 패턴 그대로다. `redis-keys.md` §3 인벤토리는 `wh:rl:min:<ip>`·`wh:rl:hour:<ip>` 의 상세 SoT 를 이미 `12-webhook.md` 로 지목하고 있었으므로, 상세 표를 그 문서에 채우는 것은 원칙 준수이지 위반이 아니다.
2. **`redis-keys.md` 인벤토리 포인터 이동** (chat-channel 두 계열: `5-system/15-chat-channel.md` → `data-flow/14-chat-channel.md §2.2`; cafe24: `2-navigation/4-integration.md §5.8` → `4-nodes/4-integration/4-cafe24.md §9.8`) — 두 경우 모두 대상 문서를 직접 열어 실측 대조한 결과 (a) `data-flow/14-chat-channel.md §2.2` 에 4개 키 전부(용도·producer·consumer·TTL·fail 정책)가 이미 SoT 로 명시돼 있고 같은 커밋에서 "위 4개 키의 용도·TTL·fail 정책은 이 표가 SoT" 문구를 함께 추가해 원본과 포인터가 동시 갱신됐다. (b) `2-navigation/4-integration.md` §5.8 은 이미 여러 곳(L664/L808/L858)에서 "[Cafe24 §9.8] 이 SoT" 라고 스스로 위임하고 있었으므로, 인벤토리 포인터를 그쪽으로 옮긴 것은 기존에 성립해 있던 위임 체인을 뒤늦게 반영한 정정이지 새로운 결정 번복이 아니다. 과거 다른 Rationale 이 `5-system/15-chat-channel.md`/`2-navigation §5.8` 을 Redis 키 상세 SoT 로 명시한 근거는 찾지 못했다(그 문서들은 스키마 구조 설명만 포함).
3. **`cafe24:install:nonce:<mall_id>:<ts>:<hmac>` → `...:<hmac 앞 8자>` 표기 정정** — `4-cafe24.md §9.8`(코드 상수 표 + `Cafe24InstallNonceCache.buildKey` 설명)과 실측 일치. 정확도 보정이며 결정 번복 아님.
4. **`public-webhook-quota.service.ts` 의 "슬라이딩 윈도우" 주석 ↔ 신규 spec 표기 "fixed-window" 불일치** — 이 diff 가 새로 만든 모순이 아니라 기존 코드 주석의 오기이며, 커밋 메시지가 부수 발견으로 명시하고 `plan/in-progress/backend-lint-gate-broken-on-main.md:918` 에 실제로 백로그 등재까지 확인됨(공수 미룸이 아니라 그 자리에서 기록됨 — `feedback_rationale_rejected_alternatives_need_history`/`feedback_stale_plan_claims_and_checklist_sync` 교훈과 부합하는 처리).
5. **slack.md/discord.md dedup 서술 갱신** — `15-chat-channel.md` CCH-SE-02 요구사항 및 그 Rationale("전용 `ChatChannelDedupService`, `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<idempotencyKey>`")과 정합. 이미 별도 선행 커밋(`2a698f360`, origin/main 병합됨)에서 구현된 동작을 provider별 문서에 뒤늦게 반영한 것이며, 새 구현을 주장하며 실체가 없는 경우가 아님을 코드/spec 대조로 확인했다.

CRITICAL/WARNING 급 "기각된 대안 재도입", "합의 원칙 위반", "무근거 결정 번복", "invariant 우회" 패턴은 발견되지 않았다.

## 요약

이번 target 커밋(5d4655ceb)은 Redis 키 인벤토리의 포인터 정합화 + 소유 문서 상세 보강을 목적으로 한 순수 문서 커밋이다. 모든 변경이 `conventions/redis-keys.md` 자신의 기존 Rationale("인벤토리는 포인터만, 상세는 소유 문서가 SoT")을 그대로 따르고 있고, 포인터 이동 두 건 모두 이동 대상 문서가 이미 자신을 상세 SoT 로 선언하고 있었음을 실측으로 확인했다. 발견된 유일한 실질적 불일치(코드 주석의 "슬라이딩 윈도우" 오기)는 이번 diff 가 만든 것이 아니라 기존 코드 결함이며, 고치지 않고 방치한 것이 아니라 plan 백로그에 명시 등재되어 있다. Rationale 연속성 관점에서 문제 없음.

## 위험도
NONE
