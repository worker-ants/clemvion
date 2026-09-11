# Cross-Spec 일관성 검토 — spec/5-system/ (impl-prep, chat-channel 중심)

## 검토 범위 및 방법

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/15-chat-channel.md`(87,237자, 이번 구현
대상의 핵심 파일)를 포함해 15개 파일의 본문을 생략했다. "여기 없다는 사실을 근거로 삼지
말라"는 지시에 따라, 번들에 없는 파일들을 워크트리에서 직접 `Read`/`grep` 하여 검토했다.

직접 열람·대조한 파일:
- `spec/5-system/15-chat-channel.md` (전문, 844줄)
- `spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md` (번들에 포함된 전문)
- `spec/5-system/12-webhook.md`, `14-external-interaction-api.md`, `6-websocket-protocol.md` (grep 발췌)
- `spec/1-data-model.md` (§2.8 Trigger 발췌)
- `spec/2-navigation/2-trigger-list.md` (chat-channel 관련 전 구간)
- `spec/conventions/secret-store.md`, `chat-channel-adapter.md`, `audit-actions.md`, `error-codes.md`
- `spec/4-nodes/7-trigger/providers/_overview.md`, `telegram.md`, `slack.md`, `discord.md`
- `spec/data-flow/14-chat-channel.md`
- `spec/4-nodes/3-ai/1-ai-agent.md` (§7.10 PresentationPayload 발췌)
- `plan/in-progress/impl-chat-channel-binder-t2.md` (실제 구현 대상 확인 — `spec_impact: none` 순수 리팩터)

## 발견사항

없음 (CRITICAL / WARNING 없음).

대조 결과, `spec/5-system/15-chat-channel.md` 와 위에 열거한 타 영역 문서들은 다음 항목들에서
**모두 일치**했다 (2026-09-10~11 에 걸친 선행 consistency-check 라운드 — 문서 내 인용된
`review/consistency/2026/09/10/22_04_23` · `22_14_27` · `#1311` · `#1313` · `#1315` · `#1316` ·
`#1317` · `#1318` — 가 이미 이 계열의 drift 를 다수 정정해 반영한 상태로 보인다):

- **PATCH 비밀-쓰기 차단 정책**: `15-chat-channel.md §5.4.1/§5.4.1.1/§5.4.1.2/R-CC-21` 의
  `botToken`/`inboundSigningPlaintext` PATCH 차단·telegram carve-out 서술이
  `2-navigation/2-trigger-list.md` (PATCH 설명 블록, provider 불변성 서술) 와 문구 수준까지 일치.
- **secret 회전 시맨틱**: `rotate()` UPSERT / `store()` throw 구분이 `15-chat-channel.md:373` 와
  `conventions/secret-store.md §2.1/§5.5` 사이에 일치. `inboundSigningRef` 의 provider-issued
  (slack/discord) vs server-issued (telegram) 이원 경로도 양쪽에서 동일하게 서술.
- **`hasBotToken` derived 필드 / trigger 신규 컬럼 5종**: `1-data-model.md §2.8` 의 cross-link과
  `15-chat-channel.md §4.2/§5.4.2` 가 일치 (컬럼명·enum·semantic 각주 포함).
- **`details.field`/`details[].code` 삼축 서술** (전역 파이프 vs 서비스 가드, `#1317` 배선
  전/후): `15-chat-channel.md §5.4.1/§5.4.1.1/§5.4.1.2` 의 서술이 `2-api-convention.md §5.3`
  (`field 를 실으면 code 도 싣는다`, 2026-09-11 규약화) 및 `trigger-list.md` 의 동일 서술과 일치.
- **감사 액션 명명**: `trigger.chat_channel_bot_token_rotated` 가 `conventions/audit-actions.md`
  §2.1 표·본문과 `15-chat-channel.md:378` 의 2026-08-11 정정 서술이 일치.
- **에러 코드 rename 이력**: `WORKSPACE_REQUIRED`→`WORKSPACE_ID_REQUIRED` (`#566`) 가
  `conventions/error-codes.md §5` 와 `15-chat-channel.md R-CC-18` 사이에 일치.
- **WH-EP-07 / WH-MG-08/09 / WH-NF-01 chat-channel 예외**: `12-webhook.md` 의 비활성 트리거
  202 예외, `chatChannel` config 필드 안내, health 배지 안내가 `15-chat-channel.md §5.5` /
  `R-CC-12` 와 정확히 일치 (처리 순서 — `isActive` 검사보다 chatChannel 분기 선행 — 포함).
- **EIA 관계** (`EIA-AU-08` in-process trusted caller, `§3.3.1` discriminated union
  `InteractionRequestContext`, `R10` 단일 sink 확장, `§6.1` outbound whitelist 불변,
  `execution.node.completed` 의 chat-channel-internal 전용 사용): `14-external-interaction-api.md`
  본문과 `15-chat-channel.md §3.2/§3.3/§5.1/§6/R-CC-16` 사이에 상호 인용까지 정확히 일치.
- **`llmCalls` strip-only / `NodeHandlerOutput` 래퍼 정정** (2026-08-24): `6-websocket-protocol.md`
  §4.1/§4.4/Rationale 이 `15-chat-channel.md CCH-MP-01/CCH-MP-06` 의 서술과 일치 (취소선 처리된
  구 서술 `~~output.rendered~~` 포함).
- **provider 카탈로그**: `providers/_overview.md §1` 의 `telegram`/`slack`/`discord` = `supported
  (v1)` 가 `15-chat-channel.md CCH-AD-01` 및 `providers/{telegram,slack,discord}.md` 각 파일의
  `status: implemented` frontmatter 와 일치. Discord R-D-3 (Gateway 미사용 → CCH-MP-01 inbound
  부분 유예) 도 양쪽에서 동일하게 유예 범위(outbound 완전 충족, inbound 만 유예)를 서술.
- **Redis dedup 키 스키마** (`cc:dedup:{triggerId}:{idempotencyKey}`, `SET NX EX 30`, rate-limit
  게이트 앞, fail-open): `data-flow/14-chat-channel.md §2.2` 와 `15-chat-channel.md CCH-SE-02 /
  R-CC-20` 이 일치.
- **`PresentationPayload` 단일 진실**: `4-nodes/3-ai/1-ai-agent.md §7.10` 의 type 정의가
  `15-chat-channel.md CCH-MP-01` 의 참조와 일치.

### 참고 — 스코프 밖 관찰 (그레이드하지 않음)

`15-chat-channel.md:68` (CCH-CV-04)의 `§3.4.3` 앵커는 현재 문서 구조상 존재하지 않는 절이다
(실제 Redis `ChannelConversation` 정의는 `§4.3`에 있다). 이는 **문서 내부** 앵커 오류로,
"target 이 다른 spec 영역과 충돌"하는 cross-spec 사안이 아니라 intra-document 정밀도 이슈이므로
본 리포트의 등급 대상에 넣지 않는다 (내부 일관성 검토자 영역에 가깝다). 참고로만 남긴다.

## 요약

`spec/5-system/15-chat-channel.md` 를 축으로 데이터 모델(`1-data-model.md`), 트리거 UI 스펙
(`2-navigation/2-trigger-list.md`), API/에러 규약(`2-api-convention.md`/`3-error-handling.md`),
webhook/EIA/WebSocket 시스템 스펙, secret-store/chat-channel-adapter 컨벤션, audit-actions/
error-codes 컨벤션, provider 구체 스펙(telegram/slack/discord), data-flow 스펙까지 실제 파일을
직접 열어 대조했으나 **데이터 모델·API 계약·요구사항 ID·상태 전이·권한 모델·계층 책임 어느
관점에서도 모순을 발견하지 못했다.** 이는 이 영역이 최근(2026-09-10~11) PATCH 비밀-쓰기
차단을 둘러싼 여러 라운드의 집중적인 cross-spec 정합화 작업(`#1311`~`#1318`)을 거쳐 이례적으로
높은 동기화 상태에 있기 때문으로 보인다. 대상 작업(`impl-chat-channel-binder-t2` — `spec_impact:
none` 인 순수 코드 리팩터, `TriggersService.setupChatChannel/teardownChatChannel` 을
`ChatChannelBinderService` 로 이동)은 spec 문면을 변경하지 않으므로, 위 정합 상태를 그대로
전제로 착수해도 안전하다.

## 위험도

NONE
