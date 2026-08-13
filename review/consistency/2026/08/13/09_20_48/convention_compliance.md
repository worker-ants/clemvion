# 정식 규약 준수 검토 — spec/5-system/ (impl-done, CCH-SE-02 dedup)

## 검토 범위 안내

프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md` 및
`<git diff origin/main...HEAD -- code_areas>` 를 포함한 17개 파일을 절단했다. 실제 diff
(`git diff origin/main...HEAD --stat`)를 워킹트리에서 직접 재확인한 결과, 이번 변경의
실질 범위는 다음으로 좁다 — EIA 본문은 이번 diff 에 포함되지 않는다:

- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel.module.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts`
- `spec/5-system/15-chat-channel.md` (CCH-SE-02 요구사항 갱신 + `R-CC-20` 신설)
- `spec/4-nodes/7-trigger/providers/telegram.md` (§8 비기능 — "미구현 (Planned)" → "구현됨")
- `spec/data-flow/14-chat-channel.md` (§2.2 Redis 표 — `cc:dedup:` 키 행 추가)

이 좁은 실질 diff 를 대상으로 `spec/conventions/**` 준수를 점검했다.

## 발견사항

- **[INFO]** `R-CC-20` 이 `R-CC-19` 보다 앞자리(오름차순 역행)에 삽입됨
  - target 위치: `spec/5-system/15-chat-channel.md` L706–L720 (`### R-CC-18` → `### R-CC-20` → `### R-CC-19` 순)
  - 위반 규약: 명시적 `spec/conventions/**` 항목은 없음 — CLAUDE.md/SKILL.md 의 "각 spec 문서는 3섹션(Overview/본문/Rationale)" 구조 규약의 하위 관례(같은 파일 내 `R-CC-N` 넘버링은 지금까지 항상 오름차순 append)가 이번에 처음 깨졌다.
  - 상세: `origin/main` 시점에 이미 `R-CC-19`(CCH-NF-03)가 Rationale 섹션의 마지막 항목이었다. 이번 diff 는 신규 `R-CC-20`(CCH-SE-02 dedup 근거)을 파일 끝에 append 하지 않고 `R-CC-18`과 `R-CC-19` 사이에 삽입해, 파일 내 유일하게 번호가 등장 순서와 어긋나는 지점을 만들었다. `R-CC-10`~`R-CC-18`까지는 (`R-CC-14` 결번을 빼면) 항상 오름차순이었다.
  - 제안: `R-CC-20` 섹션을 `R-CC-19` 뒤로 옮겨 등장 순서를 번호와 일치시키거나(선호), 혹은 이 상황이 반복될 여지가 있다면 project-planner SKILL 에 "Rationale 항목은 파일 끝에 append" 규칙을 명문화하는 것도 고려할 수 있음(선택 사항 — 강제할 정도는 아님).

- **[INFO]** `구현됨` 상태 주석의 날짜 표기가 같은 파일 안에서 비일관
  - target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` L235 (`**구현됨 (2026-08-13)**: update_id 기반 dedup …`)
  - 위반 규약: 없음 — `spec/5-system/13-replay-rerun.md` L469 에 `**구현됨 (2026-06-15)**` 선례가 있어 날짜 표기 자체는 스타일로서 존재한다.
  - 상세: 다만 같은 파일 `telegram.md` L233 의 인접 `구현됨` 항목("`telegram-client.ts` `call` — 구현됨.")은 날짜가 없다. 같은 `## 8. 비기능` 목록 안에서 한쪽만 날짜를 붙여 표기 형식이 섞였다.
  - 제안: 사소한 가독성 사안이라 필수 수정은 아님. 굳이 통일한다면 L233 도 날짜를 소급하거나 L235 의 날짜를 빼는 방향.

## 준수 확인 (위반 아님 — 참고용 근거)

다음은 위반 후보로 조사했으나 실측 결과 규약을 정확히 따르고 있어 CRITICAL/WARNING 대상에서 제외한 항목이다 (오탐 방지를 위해 근거를 남긴다):

- **Redis 키/서비스 네이밍**: `ChatChannelDedupService` / `makeChatDedupKey` / `CHAT_DEDUP_WINDOW_SEC` / DI 토큰 `CHAT_CHANNEL_DEDUP_REDIS` 는 형제 서비스 `ChatChannelRateLimiterService` / `makeChatRateLimitKey` / `CHAT_RATE_LIMIT_WINDOW_SEC` / `CHAT_CHANNEL_RATE_LIMIT_REDIS` 패턴을 그대로 미러링한다 (`codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` vs `chat-channel-rate-limiter.service.ts`). 키 prefix `cc:dedup:` 는 기존 `cc:rl:` 계열과 정합 — `chat-channel:`/`chat-channel-lock:` 전체어 prefix 계열과는 다르지만, 이 분기는 이번 diff 가 새로 만든 것이 아니라 `cc:rl:`(CCH-NF-03, 이전 PR) 이 이미 만든 전례를 따른 것.
- **`spec/data-flow/14-chat-channel.md` §2.2 Redis 표**: 신규 `cc:dedup:{triggerId}:{idempotencyKey}` 행이 기존 4열 포맷(key/producer/consumer/내용, TTL 명시)을 그대로 따름.
- **frontmatter `code:` 글로브**: `spec/5-system/15-chat-channel.md` 의 `code: codebase/backend/src/modules/chat-channel/**` 가 신규 `chat-channel-dedup.service.ts` 를 이미 포괄 — frontmatter 갱신 불요 ([spec-impl-evidence.md §2.1](../../../../spec/conventions/spec-impl-evidence.md)).
- **`pending_plans` 실존성**: frontmatter 의 `plan/in-progress/spec-sync-chat-channel-gaps.md` 참조는 실제로는 `plan/complete/spec-sync-chat-channel-gaps.md` 로 이미 이동했으나, `spec-pending-plan-existence.test.ts` 가드는 in-progress→complete 치환 후 실존을 확인하므로 build-gate 상 위반 아님. 나머지 `pending_plans` 3건(discord-gateway/slack-socket-mode/visual-ssr-png)이 여전히 in-progress 라 `status: partial` 유지도 규약대로(3.1 전이 규칙 — 모든 pending_plans 가 complete 로 이동해야 `implemented` 승격).
- **Rationale 배치**: `R-CC-20` 은 `## Rationale` 섹션(L512) 안에 있어 CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규칙을 따른다. 서술된 "옛 CCH-SE-02 원문이 EIA `Idempotency-Key` 자동 발급을 전제했다"는 주장도 diff 상 실제로 제거된 원문과 일치 — 지어낸 이력 아님(기억 노트의 "Rationale 기각된 대안은 실제 이력 필수" 기준 통과).
- **출력 포맷**: 재도착 시 반환값 `{ executionId: 'ignored' }` 는 CCH-NF-03 이 이미 확립한 skip sentinel 을 그대로 재사용 — 신규 응답 포맷을 발명하지 않음.
- **API 문서 규약(Swagger/OpenAPI)**: 이번 diff 는 controller/DTO/엔드포인트를 추가하지 않아 `spec/conventions/swagger.md` 적용 대상 자체가 아님.
- **금지 항목**: `spec/conventions/chat-channel-adapter.md` §1.1 의 `parseUpdate` side-effect-free 계약을 이번 변경이 건드리지 않음 — dedup 게이트는 `parseUpdate` 반환 이후 `HooksService.handleChatChannelWebhook`(private, 실체 확인됨) 안에 위치.

## 요약

이번 diff(CCH-SE-02 update dedup 구현)는 정식 규약 관점에서 실질적 위반이 없다. 신규 `ChatChannelDedupService` 는 명명·Redis 키 패턴·DI 배선·fail-open 정책 모두 직계 형제 서비스(`ChatChannelRateLimiterService`)를 정밀하게 미러링했고, spec 문서 갱신(`15-chat-channel.md`, `telegram.md`, `data-flow/14-chat-channel.md`)도 frontmatter·Rationale 배치·Redis 표 포맷 등 기존 구조 규약을 그대로 따른다. 발견한 두 건은 모두 INFO 수준(파일 내부의 Rationale 번호 순서 역행, `구현됨` 주석의 날짜 표기 비일관)으로, 어떤 `spec/conventions/**` 문서도 명시적으로 금지하지 않는 사소한 형식 일관성 사안이다. 프롬프트 번들이 예산 초과로 EIA 본문과 실제 diff 청크를 절단했으나, 워킹트리에서 직접 diff 를 재확인해 검토 대상(실질 변경 파일 7개)을 정확히 특정했으므로 이 절단이 판정에 영향을 주지 않았다.

## 위험도

LOW
