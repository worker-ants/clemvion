# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [SPEC-DRIFT] [WARNING] CCH-NF-03 spec 본문이 아직 "큐 적재" 정책을 기술하고 있으나 구현은 skip+degraded 로 완료됨
- 위치: `spec/5-system/15-chat-channel.md` line 112 (§3.6 CCH-NF-03)
- 상세: spec 본문은 "초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 `chat_channel_health=degraded` 표시. **미구현 (Planned)**" 를 그대로 기술하고 있다. 코드는 `ChatChannelRateLimiterService.consume` + `HooksService.markChatChannelRateLimited` 로 per-chat Redis fixed-window + skip+degraded 를 완전히 구현했다. 코드가 옳고(WH-NF-01·R9 정합의 skip 정책, `spec-draft-cch-nf-03-rate-limit.md` 에 확정 근거), spec 이 구현 완료 전 상태를 반영하지 못하고 있음.
- 제안: 코드 유지 + spec 갱신 필요. `project-planner` 가 `spec-draft-cch-nf-03-rate-limit.md §변경 surface §1` 에 따라 `spec/5-system/15-chat-channel.md §3.6 CCH-NF-03` 본문을 "초과분 버퍼링/재발사 없이 skip → 202 ignored + degraded. per-chat Redis fixed-window(기본 60/분, rateLimitPerMinute override). Redis 미가용 fail-open. (구 큐 적재 정책 → skip 변경, 근거 R-CC-19)" 로 갱신하고 "미구현 (Planned)" 주석을 제거해야 한다.

### [SPEC-DRIFT] [WARNING] spec §5.5 inbound 계약 표에 rate-limit 초과 케이스 행 미추가
- 위치: `spec/5-system/15-chat-channel.md` §5.5 (line 405–425 테이블)
- 상세: 코드(`HooksService.handleChatChannelWebhook`)는 parseUpdate+enrichInbound 직후 rate-limit 초과 시 `202 Accepted` + `{ executionId: 'ignored' }` 를 반환한다. 그러나 §5.5 inbound 계약 표에 "분당 rate-limit 초과 (per-chat)" 행이 없다. 코드 동작이 명세보다 앞서 있음.
- 제안: 코드 유지 + spec 반영. `spec-draft-cch-nf-03-rate-limit.md §변경 surface §2` 에 따라 §5.5 표에 "분당 rate-limit 초과 (per-chat) | 202 Accepted | { executionId: 'ignored' } | fixed-window 카운트 초과 시 처리 생략 + `chat_channel_health=degraded` (버퍼링 없음, CCH-NF-03)" 행을 추가한다.

### [SPEC-DRIFT] [WARNING] spec에 R-CC-19가 없음 — 코드 주석이 미존재 Rationale 를 참조
- 위치: `spec/5-system/15-chat-channel.md` Rationale 절; `codebase/backend/src/modules/hooks/hooks.service.ts` line 278, 851
- 상세: 코드 주석 `(R-CC-19)` 및 `markChatChannelRateLimited` JSDoc이 `R-CC-19` 를 참조하지만, spec 에는 R-CC-18 까지만 존재하고 R-CC-19 는 아직 추가되지 않았다. `spec-draft-cch-nf-03-rate-limit.md §변경 surface §4` 에 R-CC-19 신설 계획이 있다.
- 제안: 코드 유지 + spec 반영. `project-planner` 가 R-CC-19 를 spec Rationale 에 신설한다 (내용: skip+degraded 채택 근거, Redis fixed-window 선택, fail-open 정책, R9와의 독립성).

### [SPEC-DRIFT] [WARNING] spec-draft §결정의 "key = trigger.id + conversationKey + 분 버킷" 기술이 실제 구현과 불일치
- 위치: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` line 17 ("Redis fixed-window (key = `trigger.id` + `conversationKey` + 분 버킷)")
- 상세: 구현된 Redis 키는 `cc:rl:{triggerId}:{conversationKey}` (분 버킷 없음, EXPIRE 60s) 이다. spec-draft 에 "분 버킷" 이라고 기술되어 있으나, Rationale 에서 "기존 PublicWebhookQuotaService 동형" 이라고 명시하고 있고 실제 `PublicWebhookQuotaService.makeMinKey` 도 동일하게 분 버킷을 key 에 포함하지 않는다. "분 버킷" 표현은 "60초 TTL window" 의 의미로 쓰인 것이나 minute-aligned 버킷이라고 오해할 수 있다. 코드가 올바른 구현이다.
- 제안: 코드 유지 + spec-draft/spec 갱신. spec-draft §결정에서 "key = `cc:rl:{triggerId}:{conversationKey}`, EXPIRE 60s (first-request-anchored fixed window, PublicWebhookQuotaService 동형)" 으로 수정한다.

### [WARNING] `rateLimitPerMinute` 값 범위 (1–600) 입력 유효성 검증 미구현
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` line 71; `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` line 15 ("1–600")
- 상세: spec-draft 는 `rateLimitPerMinute` 를 1–600 범위로 명시하나, `ChatChannelConfig.rateLimitPerMinute?: number` 타입 정의에 범위 제약 없고, `HooksService` 도 `config.rateLimitPerMinute ?? CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 를 그대로 사용한다. 0 또는 음수가 설정되면 모든 요청이 차단되고, 600을 초과하면 rate-limit 의미가 없어진다. 비즈니스 규칙이 코드에 반영되지 않았다.
- 제안: setupChannel 또는 config 저장 시점에서 `rateLimitPerMinute` 가 주어지면 1–600 범위 검증을 추가하거나, `consume` 내부에서 `Math.max(1, Math.min(600, limitPerMinute))` 로 clamp 한다. 최소한 unit test 에 0/음수/601 케이스를 추가한다. 범위는 spec-draft 에 명시되어 있으므로 구현 의무.

### [WARNING] `markChatChannelRateLimited` — "이미 degraded" 분기에 대한 테스트 누락
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` line 859 (`if (trigger.chatChannelHealth === 'degraded') return;`); `hooks.service.spec.ts`
- 상세: 폭주 중 중복 write 방지 목적의 early-return 분기가 구현되어 있으나, `chatChannelTrigger` fixture 의 `chatChannelHealth` 가 `'unknown'` 으로 고정되어 이 경로가 테스트되지 않는다. 해당 분기가 잘못 삭제되어도 현재 테스트 스위트에서 검출되지 않는다.
- 제안: `hooks.service.spec.ts` 에 "rate-limit 초과이나 이미 degraded 상태인 trigger → triggerRepo.update 미호출" 케이스를 추가한다.

### [WARNING] spec-draft의 enforcement 위치가 "parseUpdate 직후"로 명시되어 있으나 코드는 enrichInbound 이후에 위치
- 위치: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` line 19 ("parseUpdate 직후(conversationKey 확정 후)"); `codebase/backend/src/modules/hooks/hooks.service.ts` line 272–283
- 상세: spec-draft 는 enforcement 위치를 "parseUpdate 직후(conversationKey 확정 후)" 로 기술하지만 실제 코드는 `enrichInbound` 이후에 rate-limit check 를 수행한다. `enrichInbound` 는 Slack file_upload 등 외부 API 호출을 포함할 수 있어 추가 latency 가 발생하고, WH-NF-01 200ms 예산 소비가 그 만큼 더 늘어난다. enrichInbound 전에 rate-limit 을 먼저 확인해야 한도 초과 시 불필요한 외부 API 호출을 방지할 수 있다. 단, `conversationKey` 는 `parseUpdate` 결과인 `parsed` 에 이미 있으므로 enrichInbound 이전에도 rate-limit key 구성이 가능하다.
- 제안: 코드에서 rate-limit check 를 `enrichInbound` 이전(parseUpdate 직후)으로 이동하고, spec-draft 기술과 일치시킨다. 혹은 현재 위치가 의도적(enrichInbound 후에야 conversationKey 가 최종 확정되는 provider 존재 여부)이라면 spec-draft 를 "enrichInbound 이후(conversationKey 최종 확정 후)"로 교정한다.

### [INFO] `chatChannelLastError` 필드 갱신이 spec §4.2 DB 컬럼 정의에는 있으나 §5.5 rate-limit 케이스 설명에 미언급
- 위치: `spec/5-system/15-chat-channel.md` §4.2 (line 267); `hooks.service.ts` line 864–869
- 상세: `markChatChannelRateLimited` 는 `chatChannelHealth=degraded` 와 함께 `chatChannelLastError` 에 "Inbound rate limit exceeded (N/min, chat=X)" 를 설정한다 (최대 1024자 슬라이스). 이는 운영자에게 유용한 정보이나, spec-draft §변경 surface §1에 `chatChannelLastError` 갱신 동작이 명시되지 않았다. spec §4.2 에 컬럼은 정의되어 있고 코드 동작도 합리적이므로 spec 누락 수준.
- 제안: R-CC-19 또는 CCH-NF-03 갱신 문구에 "초과 시 `chatChannelLastError` 에 "Inbound rate limit exceeded (N/min, chat=X)" 기록 (1024자 한도)" 를 추가한다.

### [INFO] `config.rateLimitPerMinute` 의 override 경로(기본 60이 아닌 값)에 대한 integration 테스트 부재
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` line 621 (60 고정 검증)
- 상세: spec-draft 에서 `rateLimitPerMinute` 를 override 가능하다고 명시하고, 코드도 `config.rateLimitPerMinute ?? CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 로 구현되어 있으나, 기본값 60 이 아닌 override 값(예: 30)을 사용하는 경우의 테스트가 없다.
- 제안: `chatChannelTrigger` 에 `rateLimitPerMinute: 30` 을 포함한 config 로 fixture 를 만들고, `consume(triggerId, conversationKey, 30)` 이 호출되는지 검증하는 케이스를 추가한다.

---

## 요약

CCH-NF-03 per-chat Redis fixed-window rate-limit 의 핵심 기능(INCR+EXPIRE+fail-open, skip+degraded, 기본 60/분, chatChannelRateLimiterService 모듈 등록)은 완전히 구현되어 있고 spec-draft 의 주요 설계 결정(skip 채택, fail-open, PublicWebhookQuotaService 동형 패턴, 자동 비활성화 금지)과 부합한다. 그러나 spec 본문(`spec/5-system/15-chat-channel.md`) 이 아직 구현 전 상태("큐 적재", "미구현 Planned", §5.5 rate-limit 행 없음, R-CC-19 미신설)를 유지하고 있어 복수의 SPEC-DRIFT 가 발생하고 있다. 코드 측 리스크로는 `rateLimitPerMinute` 값 범위(1–600) 검증 미구현이 비즈니스 규칙 누락에 해당하고, enforcement 위치가 spec-draft 기술(parseUpdate 직후)과 달리 enrichInbound 이후에 있어 불필요한 외부 API 호출 발생 가능성이 있다. "이미 degraded" early-return 분기의 테스트 공백도 회귀 위험이 있다.

## 위험도

MEDIUM
