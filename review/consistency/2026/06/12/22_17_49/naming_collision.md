# 신규 식별자 충돌 검토 — spec-draft-cch-nf-03-rate-limit

## 발견사항

- **[INFO]** R-CC-19 신설 — 기존 시퀀스 갭(R-CC-14 미사용) 이지만 충돌 없음
  - target 신규 식별자: `R-CC-19`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/spec/5-system/15-chat-channel.md` Rationale 절에 `R-CC-10` ~ `R-CC-18` 존재. `R-CC-14` 는 미사용(시퀀스 건너뜀). `R-CC-19` 는 현재 spec 어디에도 정의되지 않음.
  - 상세: 기존 Rationale ID 시퀀스는 R-CC-10 ~ R-CC-18 까지 연속(R-CC-14 결번). target 이 `R-CC-19` 를 신설하는 것은 다음 미할당 번호를 사용하는 것이므로 충돌 없음. R-CC-14 결번은 이미 기존 spec 상태이며, target 이 R-CC-19 를 도입해도 R-CC-14 의 의미에 영향을 주지 않음. 단, 검토자가 R-CC-14 결번을 인지하지 못할 경우 혼동 가능성은 낮게 존재.
  - 제안: 변경 불필요. R-CC-19 는 안전하게 사용 가능. (필요 시 Rationale ID 컨벤션 절 — 기존 `spec/5-system/15-chat-channel.md §Rationale ID 컨벤션` — 에 R-CC-14 결번 주석을 추가하면 혼동 여지를 없앨 수 있음.)

- **[INFO]** `rateLimitPerMinute` config 키 — 기존 식별자이며 충돌 없음
  - target 신규 식별자: `config.chatChannel.rateLimitPerMinute` 의 "범위·기본값 보강 주석"
  - 기존 사용처: `spec/5-system/15-chat-channel.md` §4.1 (line 214), `spec/conventions/chat-channel-adapter.md` (line 282), `spec/data-flow/14-chat-channel.md` (line 88), `spec/2-navigation/2-trigger-list.md` (line 79, 111) — 모두 동일 의미(CCH-NF-03 per-chat 분당 한도 override)로 사용 중.
  - 상세: target 은 새로운 config 키를 도입하는 것이 아니라 **기존 키** `rateLimitPerMinute` 에 명확화 주석을 추가하는 것이므로 충돌 없음. 여러 spec 파일에서 이미 동일 의미로 참조되고 있으며 target 의 의미("기본 60, 1–600, per-chat 분당 한도")와 완전히 일치.
  - 제안: 변경 불필요.

- **[INFO]** `{ executionId: 'ignored' }` 응답 body — 기존 패턴이며 충돌 없음
  - target 신규 식별자: rate-limit 초과 케이스에서 `202 Accepted + { executionId: 'ignored' }` 사용
  - 기존 사용처: `spec/5-system/15-chat-channel.md` §5.5 Inbound HTTP Contract 표 (group chat, bot, 비활성 trigger, parseUpdate null 등 다수 행), `spec/5-system/12-webhook.md` WH-EP-07, `spec/data-flow/10-triggers.md` §1.2·§1.5 — 이미 다수 케이스에서 동일 shape 으로 정의되어 있음.
  - 상세: target 이 rate-limit 초과를 `{ executionId: 'ignored' }` 로 처리하는 것은 기존 spec 의 기확립 sentinel 패턴을 재사용하는 것이므로 충돌 없음. 의미 확장(rate-limit 케이스 추가)이지만 sentinel 자체의 의미("execution 미생성·무시")와 정합.
  - 제안: 변경 불필요. §5.5 표에 rate-limit 초과 행 추가 시 기존 행들과 동일 shape 을 유지하면 됨.

- **[INFO]** `ChatChannelDispatcher.markDegraded` 동형 경로 참조 — spec 에는 없는 코드 레벨 이름이나 의미 충돌 없음
  - target 신규 식별자: `ChatChannelDispatcher.markDegraded` 동형 경로를 rate-limit 초과 degraded 갱신 경로로 참조
  - 기존 사용처: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` line 221, 298, 328 — `markDegraded` 는 어댑터 외부 API 호출 실패(CCH-SE-01) 시 `chat_channel_health=degraded` 로 갱신하는 private 메서드.
  - 상세: target 은 rate-limit 초과 시 "동형 경로"를 사용한다고 기술하지만, 기존 `markDegraded` 는 **어댑터 외부 API 호출 실패** 경로에서만 호출된다. rate-limit 초과는 inbound 단계(parseUpdate 직후, execution 시작 전)이고, 이 시점은 `ChatChannelDispatcher` 의 outbound 구독 루프가 아니라 `HooksService.handleChatChannelWebhook` 이다. target 이 "동형 경로"라고 표현하지만 동일 메서드 호출을 의미하는지, 동일 DB 갱신 로직을 의미하는지 spec 초안이 모호하다. spec 본문에 `markDegraded` 는 현재 등장하지 않으며(`grep` 결과 없음) 코드 레벨 이름이 spec 에 노출된 것도 아니므로 식별자 충돌 자체는 없음. 다만 구현 시 어느 service 레이어에서 `chat_channel_health=degraded` 를 갱신할지 명확히 해야 한다 — `HooksService` 에서 직접 DB 갱신 vs `ChatChannelDispatcher` 의 헬퍼 추출 여부는 구현 결정 사항.
  - 제안: spec 본문에 "동형 경로" 대신 "동일 DB 갱신 동작(`chat_channel_health=degraded`, `chat_channel_last_error` 갱신)" 으로 구체화하면 구현 지시가 명확해짐.

- **[INFO]** CCH-NF-03 요구사항 ID — 기존 ID 재활용(refine)이며 충돌 없음
  - target 신규 식별자: CCH-NF-03 (문구 교체)
  - 기존 사용처: `spec/5-system/15-chat-channel.md` line 112 — "초과분은 chat 단위 큐에 적재 … degraded" 문구로 이미 정의됨. `spec/5-system/12-webhook.md`, `spec/data-flow/14-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`, `spec/conventions/chat-channel-adapter.md`, `plan/in-progress/spec-sync-chat-channel-gaps.md` 등 다수 참조.
  - 상세: target 은 CCH-NF-03 을 신규 도입하는 것이 아니라 **기존 ID 의 문구를 refine** 하는 것이므로 충돌 없음. 다수 참조처에서 이 ID 를 이미 알고 있으며, 문구 변경 후 참조 링크는 그대로 유효하다.
  - 제안: 변경 불필요. 단, `spec/data-flow/14-chat-channel.md` §1.1 의 구현 갭 주석(rateLimitPerMinute 미구현 설명)도 spec-draft 적용 시 함께 갱신해야 문서 내 일관성이 유지됨(target 변경 surface §1~§4 가 해당 파일을 포함하지 않아 draft 에서 누락 가능).

## 요약

target 이 도입하는 신규 식별자는 `R-CC-19`(Rationale ID 신설) 하나이며, 이는 기존 R-CC-18 의 다음 미할당 번호로 어떤 기존 식별자와도 충돌하지 않는다. 나머지 식별자(`rateLimitPerMinute`, `{ executionId: 'ignored' }`, `CCH-NF-03`)는 모두 기존 spec 에서 동일 의미로 이미 사용 중인 이름을 재활용하거나 refine 하는 것으로 신규 충돌이 없다. `markDegraded` 동형 경로 표현은 spec 레벨 식별자가 아니라 구현 힌트 수준의 언급이어서 명명 충돌보다는 구현 모호성 주의가 필요하다.

## 위험도

NONE
