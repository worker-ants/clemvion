# 신규 식별자 충돌 검토 — `spec/5-system` (impl-prep, `impl-chat-channel-patch-token`)

## 검토 범위 및 방법

target 은 `spec/5-system` 전역이며 실질 초점은 오늘(2026-09-10) 갱신된
`spec/5-system/15-chat-channel.md`(§5.4.1 · §5.4.1.1 · R-CC-21 신설, PR #1311/#1313)와
그 뒤를 잇는 구현 plan `plan/in-progress/impl-chat-channel-patch-token.md`(D-1/D-2/D-3)이다.
같은 target 에 대해 같은 날 두 차례 naming_collision 검토(`review/consistency/2026/09/10/22_04_23`,
`22_14_27`)가 이미 수행됐으므로, 본 검토는 그 결론을 재확인하는 대신 **실제 저장소 grep** 으로
독립 검증했다.

## 발견사항

검증한 6개 관점 모두에서 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

- **[INFO] `ChatChannelUpdateConfigDto` — 명명 재확인, 충돌 없음**
  - target 신규 식별자: `ChatChannelUpdateConfigDto` (plan D-1, PATCH 전용 DTO — **spec 본문에는
    등장하지 않고 plan 문서에만 있음**)
  - 기존 사용처: 없음. 저장소 전체에서 이 식별자를 사용하는 다른 정의는 0건
    (`ChatChannelUpdateConfigDto` grep 결과는 plan 파일 자신과 `plan/complete/spec-draft-telegram-signing-carveout.md`
    의 명명 결정 기록뿐).
  - 상세: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 에 이미
    `ChatChannelUiMappingDto` · `ChatChannelBotIdentityDto` · `ChatChannelConfigDto` 가 있어
    "`ChatChannel` 접두 + 역할어 + `Dto`" 가 그 파일의 로컬 컨벤션이다. 한편 저장소 전역
    top-level 리소스 PATCH DTO 는 `Update<Entity>Dto` (동사 접두) 패턴 18건
    (`UpdateTriggerDto`/`UpdateModelConfigDto`/`UpdateAuthConfigDto`/`UpdateWorkflowDto` 등)
    — 어순만 보면 `ChatChannelUpdateConfigDto` 는 이 전역 패턴과 어순이 다르다. 다만 이 DTO 는
    top-level 리소스 DTO 가 아니라 `UpdateTriggerDto.config.chatChannel` 의 **중첩 필드용** 이라,
    적용해야 할 참조 컨벤션은 형제 클래스들이 쓰는 로컬 `ChatChannel<Role>Dto` 쪽이 맞다. 두 이전
    검토(`22_04_23`, `22_14_27`)가 이미 이 이름을 저장소 검색으로 검증해 충돌 없음을 확인했고,
    본 검토도 동일 결론에 도달했다.
  - 제안: 조치 불요. 이미 두 차례 검증된 결정이며 세 번째 독립 재검증도 같은 결론.

- **[INFO] Rationale ID 스킴 혼재 (`R1~R9` / `R-K` / `R-CC-N`) — 이미 spec 자체가 자기-설명**
  - target 신규 식별자: 해당 없음 (이번 라운드에 새로 추가된 것은 없음. `R-CC-19`~`R-CC-21` 은
    이미 커밋된 상태)
  - 기존 사용처: `spec/5-system/15-chat-channel.md` 본문 하단 "### Rationale ID 컨벤션" 절
    (line 637 부근)
  - 상세: 같은 문서 안에 prefix 없는 `R1`~`R9`, 단독 `R-K`, `R-CC-N` 세 스킴이 공존한다. 통상
    이런 혼재는 WARNING 대상이지만, 문서가 그 사실을 **스스로 인지하고** "신규 항목은 `R-CC-N`
    prefix, 기존 `R1~R9`/`R-K` 는 cross-link 파손 방지를 위해 그대로 유지" 라고 명시적으로
    정당화해 두었다. 즉 충돌이 아니라 **의도적으로 유지된 레거시 네이밍**이다.
  - 제안: 조치 불요 (문서가 이미 근거를 제시). 향후 대규모 리네임 시에만 재검토.

- **[INFO] `chat_channel_health` enum 이 `notification_health` 와 완전 동일 shape — spec 이 이미 명시**
  - target 신규 식별자: 없음 (기존 컬럼, 이번 plan 범위 밖)
  - 기존 사용처: `spec/5-system/15-chat-channel.md` §4.2 각주 — "`chat_channel_health` 의 enum
    은 `notification_health` 와 완전 동일 — 향후 공용 DB 타입 통합 검토 대상"
  - 상세: 두 컬럼이 `unknown`/`healthy`/`degraded` 를 각자 독립 정의하는 것은 의미 충돌이
    아니라(서로 다른 리소스: chat-channel trigger vs notification config) 중복 정의다. spec 이
    이미 통합 검토 대상으로 self-flag 했다.
  - 제안: 조치 불요, 기존 각주 유지.

## 확인한 영역 (충돌 없음)

- **요구사항 ID**: `CCH-*` 표 전 항목 중복 정의 없음 (동일 ID 재출현은 전부 cross-reference).
  `spec/1-data-model.md`·`2-navigation/2-trigger-list.md`·`4-nodes/7-trigger/providers/*`·
  `conventions/chat-channel-adapter.md`·`data-flow/14-chat-channel.md` 에서 `CCH-*` 참조는
  전부 같은 의미의 인용.
- **엔티티/타입명**: `ChatChannelDispatcher`/`ChannelListenerRegistry`/`ChatChannelDedupService`/
  `ChatChannelRateLimiterService`/`ChatChannelTokenRotatorService`/`ChannelConversation` 등
  전부 코드에 이미 구현된 기존 명 — 다른 의미로 재사용된 곳 없음.
- **API endpoint**: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 저장소 전체에서
  단일 정의. v2 후보로만 언급된 `rotate-inbound-signing` 은 아직 미신설(결정 보류) 상태라
  충돌 대상 자체가 없음.
- **이벤트/메시지명**: `chat_channel_unknown_failure_code` 로그 kind, `execution.node.completed`
  in-process listener 재사용 등 신규 외부 이벤트 없음(HTTP webhook 화이트리스트 불변 명시).
- **환경변수·설정키**: 이번 target 라운드에서 신규 ENV 도입 없음. Redis 키 `chat-channel:{triggerId}:…`
  / `cc:dedup:{triggerId}:…` 는 `conventions/redis-keys.md` 에 이미 등재돼 있고 다른 모듈
  prefix 와 겹치지 않음(콜론 계층 분리).
- **파일 경로**: `triggers/chat-channel-token-rotator.service.ts` 로의 이전(C-2)이 완료돼 있고,
  `chat-channel/` 아래 동명 잔존 파일 없음(중복/고아 파일 없음 확인).

## 요약

target 문서(`spec/5-system/15-chat-channel.md`, 오늘자 R-CC-21/§5.4.1.1 갱신)와 그 구현 plan
(`impl-chat-channel-patch-token.md`)이 도입/재확인하는 식별자를 요구사항 ID·엔티티/DTO명·API
endpoint·이벤트명·환경변수/설정키·파일 경로 6개 관점으로 저장소 전체 grep 검증한 결과, 다른
의미로 이미 쓰이고 있는 CRITICAL 충돌이나 혼동 유발 수준의 WARNING 은 발견되지 않았다. 유일하게
표면적으로 재확인이 필요했던 `ChatChannelUpdateConfigDto` 명명은 이미 두 차례 독립 검토를 거쳤고
본 검토도 동일하게 "충돌 없음" 으로 수렴했으며, Rationale ID 스킴 혼재와 `chat_channel_health`/
`notification_health` 중복은 spec 문서 자신이 이미 인지·정당화해 둔 사안이라 추가 조치가 필요
없다. 이번 구현 범위(D-1/D-2/D-3: PATCH DTO 분리, `setupChatChannel` 게이팅 인자, secret ref
재유도 회귀테스트)는 신규 endpoint·신규 ENV·신규 spec ID 를 만들지 않는 순수 내부 리팩터라
식별자 충돌 표면 자체가 좁다.

## 위험도

NONE
