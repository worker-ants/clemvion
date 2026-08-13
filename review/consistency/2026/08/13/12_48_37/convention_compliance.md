# 정식 규약 준수 검토 — spec/4-nodes/

## 검토 범위 및 방법 메모

- 검토 모드: `--impl-done`, scope=`spec/4-nodes/`, diff-base=`origin/main`.
- 실제 `git diff origin/main...HEAD` 는 `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 의 **주석 2줄 변경**("슬라이딩 윈도우" → "fixed-window" 설명 정정) 이 전부이며, `spec/4-nodes/**` 를 직접 건드리지 않는다. 따라서 이번 diff 자체가 신규로 유발한 명명/출력포맷/금지패턴 위반은 없다.
- prompt 번들이 컨텍스트 예산을 초과해 **target scope 자체 파일 24개**와 **spec/conventions/ 8개 문서**가 절단(stub)된 상태로 전달됐다(§아래 WARNING 참고). 절단된 부분 중 판정에 관련될 수 있는 항목(`spec/conventions/node-output.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/error-codes.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 등)은 CWD 가 검토 대상과 동일한 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)임을 확인하고 **절대경로 Read 로 직접 열어 대조**했다.

## 발견사항

- **[WARNING]** 컨텍스트 예산 초과로 target scope 자체 파일 24개 + 핵심 conventions 8개가 프롬프트에서 절단됨
  - target 위치: `## Target 문서` 번들 전체 — 특히 "⚠️ 컨텍스트 예산 초과로 생략된 파일 24개" 목록(`spec/4-nodes/3-ai/1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`, `_product-overview.md`, `4-integration/0-common.md`·`1-http-request.md`·`2-database-query.md`·`3-send-email.md`·`5-makeshop.md`·`_product-overview.md`, `5-data/*`, `6-presentation/*`, `7-trigger/0-common.md`·`1-manual-trigger.md`·`providers/_overview.md`, `4-nodes/_product-overview.md`, `1-logic/6-split.md`)와 `spec/conventions/chat-channel-adapter.md`·`conversation-thread.md`·`error-codes.md`·`execution-context.md`·`interaction-type-registry.md`·`node-output.md`·`swagger.md`·`migrations.md`·`rag-evaluation.md`·`spec-impl-evidence.md` 등
  - 위반 규약: 규약 위반이라기보다 **검토 프로세스 자체의 완전성 문제**다. 다만 이 문서들은 정확히 §1(명명)·§2(출력 포맷)·§4(API 문서 규약) 관점에서 대조해야 할 1차 SoT(`node-output.md`, `chat-channel-adapter.md`, `error-codes.md`, `swagger.md`)라서 이번 항목의 심각도를 WARNING 으로 표기한다.
  - 상세: `_prompts` 조립기가 24개 target 파일과 8개 convention 파일을 "본문 생략됨" stub 으로 대체했다(예: `1-ai-agent.md` 원본 119,526자, `chat-channel-adapter.md` 원본 46,101자). 절단된 파일이 없다는 사실을 "위반 없음"의 근거로 삼으면 거짓 음성이 된다(과거 동일 패턴: `feedback_consistency_spec_mode_budget.md`).
  - 완화 조치: 위 절단분 중 판정 위험이 가장 큰 4건을 CWD 워킹트리에서 절대경로로 직접 Read 해 대조했다 — `spec/conventions/node-output.md`(Principle 0–11 전체), `spec/conventions/chat-channel-adapter.md` §2.3/§2.4, `spec/conventions/error-codes.md` §1–§5, `spec/4-nodes/3-ai/{1-ai-agent,2-text-classifier,3-information-extractor}.md` 의 `retryable`/`retryAfterSec` invariant(§3.2.1). 결과는 모두 준수(아래 요약). 그러나 나머지 절단분(특히 `6-presentation/*`, `4-integration/1-http-request.md`·`2-database-query.md`·`3-send-email.md`·`5-makeshop.md`)은 이번 턴에서 전수 대조하지 못했다.
  - 제안: 다음 회차 실행 시 `spec/4-nodes/` 를 하위영역(logic / ai / integration / presentation / trigger)으로 분할해 재실행하거나 `related_specs` 예산을 늘려 재조립할 것. orchestrator 쪽 조치가 필요하며 target 문서 자체의 수정 사항은 아니다.

- **[INFO]** Cafe24 4xx 에러 코드가 HTTP status 숫자를 이름에 직접 노출 (`CAFE24_404`/`CAFE24_422`/`CAFE24_4XX`/`CAFE24_5XX`)
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §6 "에러 코드" 표
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" — "구현 세부(...)를 이름에 박지 않는다"
  - 상세: §1 원칙은 "조건의 의미"를 이름에 담으라고 하는데 `CAFE24_404`/`CAFE24_422` 는 Cafe24 서버가 돌려준 raw HTTP status 를 그대로 코드명에 실었다. 다만 이는 이번 diff 로 신규 도입된 것이 아니라 기존부터 있던 pass-through 분류(485개 Cafe24 endpoint 각각의 실패 사유를 개별 이름으로 열거할 수 없어 status 기반으로 묶은 설계, cafe24.md §6 문맥상 의도적)이고, HTTP status 자체가 "무엇이 잘못됐는가"의 최소 의미 단위로 읽힐 여지도 있어 명백한 위반으로 단정하기는 어렵다. `error-codes.md` §3 historical-artifact 레지스트리에는 이 패턴이 등재돼 있지 않다.
  - 제안: 위반으로 단정하지 않되, `error-codes.md` §3(예외 레지스트리) 또는 §1 본문에 "raw status 기반 pass-through 코드(`<DOMAIN>_<STATUS>`, 예: `CAFE24_404`)는 §1 원칙의 별도 허용 범주"라는 한 줄을 명시하면 향후 checker 가 매번 재검토하지 않아도 된다. target 수정은 불필요, conventions 쪽 명확화가 더 적절.

## 준수 확인 (spot-check, 위반 없음)

- `spec/4-nodes/4-integration/4-cafe24.md` §4.4 Redis 키(`cafe24:install:nonce:<mall_id>:<ts>:<hmac 앞 8자>`, `cafe24:install:fail:<ip>`) — `spec/conventions/redis-keys.md` §1 형태 규칙(`{도메인}:{용도}[:{식별자}...]`)·§3 전역 인벤토리 엔트리와 정확히 일치.
- `spec/4-nodes/7-trigger/providers/{discord,slack,telegram}.md` 의 `secret://triggers/{id}/bot-token`·`secret://triggers/{id}/inbound-signing` 참조 — `spec/conventions/secret-store.md` §1 URI Scheme(`secret://<scope>/<resourceId>/<name>`, kebab-case) 및 `spec/conventions/chat-channel-adapter.md` §2.3/§2.4 (`ChatChannelConfig.inboundSigningRef`, `SetupResult.issuedInboundSigning`)와 완전히 정합.
- `spec/4-nodes/3-ai/{1-ai-agent,2-text-classifier,3-information-extractor}.md` 의 `output.error.details.{retryable, retryAfterSec}` 예시 — `spec/conventions/node-output.md` §3.2.1 invariant("`retryAfterSec` 는 `retryable === true` 일 때만 set")를 모든 JSON 예시에서 만족(`retryable: true` 와 `retryAfterSec` 가 항상 함께 등장, `false` 와 동시 등장하는 사례 없음).
- 문서 구조 — `4-cafe24.md`/`discord.md`/`slack.md`/`telegram.md` 는 frontmatter(`id`/`status`/`code`) + `## Overview (제품 정의)` + 본문 + `## Rationale` 3-섹션 구성을 준수. `1-logic/*` 등 단순 노드 spec 은 Overview 섹션을 생략하지만 이는 CLAUDE.md 상 "진입 문서 또는 `_product-overview.md`" 한정 요구와 상충하지 않는 기존 패턴(제품 정의는 `_product-overview.md`/영역 진입 문서에 집중, 개별 leaf 노드 문서는 기술 명세 본문 위주)으로 판단해 위반으로 분류하지 않았다.
- 파일 명명 — `0-common.md`/`N-<slug>.md`/`_product-overview.md`/`_overview.md` 패턴이 `spec/4-nodes/` 전역에서 일관.

## 요약

이번 diff(웹훅 쿼터 서비스의 주석 정정 2줄)는 `spec/4-nodes/` 를 건드리지 않아 새로 유발된 정식 규약 위반은 없다. `spec/4-nodes/` 전반을 대상으로 한 정적 감사에서도, 확인 가능했던 범위 내에서는 Redis 키 명명(`redis-keys.md`), Secret Store 참조(`secret-store.md`), Chat Channel Adapter 타입 계약(`chat-channel-adapter.md`), 노드 출력 `retryable`/`retryAfterSec` invariant(`node-output.md` §3.2.1) 모두 규약과 정합했다. 다만 프롬프트 조립 예산 초과로 target scope 자체 파일 24개와 핵심 conventions 8개가 절단된 채 전달됐고, 그중 판정 위험이 가장 큰 4건만 CWD 워킹트리 직접 Read 로 보완 확인했다 — 나머지(특히 `6-presentation/*`, 일부 `4-integration/*`)는 이번 턴에서 전수 대조하지 못했으므로 "위반 없음"을 그 부분까지 확정적으로 보증할 수는 없다. Cafe24 에러 코드의 status-숫자 기반 명명(`CAFE24_404` 등)은 애매 지대이나 기존부터 있던 패턴이라 이번 diff 의 신규 위반은 아니다.

## 위험도

LOW
