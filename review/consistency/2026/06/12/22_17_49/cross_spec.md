# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md`
**변경 대상 spec**: `spec/5-system/15-chat-channel.md` (§3.6 CCH-NF-03, §5.5 inbound 계약, §4.1 config, Rationale)

---

## 발견사항

### [WARNING] CCH-NF-03 "초과 시 degraded" 트리거 의미가 CCH-SE-01 정의와 혼재될 수 있음
- **target 위치**: draft §결정 (v1 정책) — "per-chat Redis fixed-window 카운터... 초과 시 202 Accepted + chat_channel_health=degraded 갱신 (`ChatChannelDispatcher.markDegraded` 동형 경로)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-01` — "어댑터의 외부 API 호출(sendMessage 등) 에 5초 타임아웃 + 3회 지수 백오프 재시도. 최종 실패 시 `chat_channel_health`를 `degraded`로 갱신"
- **상세**: 현재 spec 에서 `chat_channel_health=degraded` 는 **어댑터 외부 API 호출 실패** 신호로 단일 정의되어 있다. `R-CC-15 (d)` 가 "execution 자체의 실패 안내"와 "어댑터 외부 호출 실패"를 직교 자원으로 분리하고, CCH-ERR-05 도 "sendMessage 최종 실패 시에만 health=degraded" 원칙을 명시한다. draft 는 "rate-limit 초과(외부 사용자 폭주 방어 신호)" 라는 제3 트리거를 추가하면서 spec 본문에 별개 degraded 트리거로 정의한다. 이것이 새로운 의미 확장이라는 점은 draft §결정 본문에서 "별개의 degraded 트리거" 로 설명하고 있어 충돌은 아니나, **CCH-SE-01 이 "어댑터 외부 API 호출 실패" 를 유일 원인으로 읽힐 수 있는 상태** 이므로, §3.4 CCH-SE-01 본문 혹은 §3.6 CCH-NF-03 에 "degraded 는 CCH-SE-01(외부 API 실패) 과 CCH-NF-03(rate-limit 초과) 두 경로로 갱신될 수 있음"을 명시하지 않으면 CCH-SE-01 단독 읽기 시 오독이 발생한다.
- **제안**: 최종 spec 변경 시 §3.4 CCH-SE-01 에 "degraded 설정 경로는 CCH-NF-03(rate-limit 초과) 도 포함" 또는 신규 R-CC-19 에 이 직교 관계를 명시. draft 는 이미 R-CC-19 신설을 계획하고 있으므로 R-CC-19 본문에 CCH-SE-01 과의 관계("두 경우 모두 동일 health 자원, 자동 비활성화 금지 동일")를 명시적으로 포함할 것.

---

### [WARNING] §5.5 inbound 계약 표에 "rate-limit 초과" 행 삽입 시 R-CC-12 의 2xx 고정 근거와 응답 body 형식 동기화 필요
- **target 위치**: draft §변경 surface "2. §5.5 inbound 계약 표 (신규 행)" — `202 Accepted` + `{ executionId: 'ignored' }`
- **충돌 대상**: `spec/5-system/15-chat-channel.md §5.5 + R-CC-12`
- **상세**: draft 가 추가하는 202 + `{ executionId: 'ignored' }` 응답은 §5.5 기존 행 패턴과 형식상 일치하고 R-CC-12 의 2xx 고정 정책과도 부합한다. 그러나 draft 표의 "어댑터 행동" 열 설명에 "버퍼링 없음, CCH-NF-03" 이 기재되는데, §5.5.1 의 "provider-specific 응답 예외 정책" 정의와 간섭하지 않으며 동일 sentinel 문자열(`'ignored'`) 을 재사용함이 명확히 확인된다. 충돌은 없지만, §5.5 표 하단의 "구현 메모" 주석 ("새 execution 미생성 케이스의 본문은 `executionId: 'ignored'`") 이 rate-limit 초과 케이스도 동일 sentinel 임을 커버하는지 명시적으로 확장이 필요하다.
- **제안**: §5.5 표 신규 행 추가 시 기존 구현 메모 주석("state?.executionId ?? 'ignored'")이 rate-limit 초과 경로도 동일 sentinel을 사용함을 언급하거나, 메모를 "세 케이스 공통: group/bot skip, rate-limit 초과, unsupported update type" 으로 확장.

---

### [WARNING] enforcement 위치(`parseUpdate` 직후)가 CCH-NF-01(50ms 예산)에 미치는 영향 미기술
- **target 위치**: draft §결정 — "enforcement 위치: `HooksService.handleChatChannelWebhook` 의 `parseUpdate` 직후(conversationKey 확정 후) — execution 시작/forwarding 분기 이전"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-04 / CCH-NF-01` — `parseUpdate` 50ms + 트리거 조회 + 202 Accepted 반환의 순서로 WH-NF-01(200ms) 안에서 처리
- **상세**: CCH-NF-01 은 `parseUpdate` 을 50ms 이내로 제한하고, WH-NF-01(200ms) 전체 예산 안에 인증·trigger 조회·parseUpdate·202 반환이 포함된다. draft 가 `parseUpdate` **직후** Redis INCR+EXPIRE 를 추가하는데, Redis 왕복 지연(보통 < 1ms, 장애 시 수 ms ~ 수십 ms)이 이 예산에 추가된다. fail-open(Redis 미가용 시 바이패스) 정책이 있어 blocking 은 아니지만, spec 본문에 "Redis INCR+EXPIRE 의 latency 는 WH-NF-01 200ms 예산 안에 포함된다" 를 명시하지 않으면 CCH-NF-01/WH-NF-01 읽는 구현자가 Redis 호출을 예산 밖으로 오해할 수 있다.
- **제안**: draft 의 §5.5 inbound 계약 행 또는 CCH-NF-03 본문에 "Redis INCR+EXPIRE 는 WH-NF-01 200ms 예산 안 (fail-open 이므로 Redis 장애 시 latency 추가 없음)" 주석 추가.

---

### [INFO] `PublicWebhookQuotaService.incrWithWindow` 재사용 언급 — 해당 서비스의 스코프가 IP 단위임을 주의
- **target 위치**: draft §결정 — "기존 `PublicWebhookQuotaService.incrWithWindow` 패턴 재사용 (INCR + EXPIRE pipeline)"
- **충돌 대상**: `spec/5-system/12-webhook.md §8 Rate Limiting` + `spec/7-channel-web-chat/4-security.md §4` — `PublicWebhookQuotaService` 는 공개 webhook 전용 **IP 단위** 한도(분당 10·시간당 20) 서비스
- **상세**: 기존 `PublicWebhookQuotaService` 는 IP 단위 공개 webhook 방어용이고, chatChannel 트리거는 inbound 서명 인증을 사용하므로 이 가드의 대상이 아니다(`data-flow/14-chat-channel.md §88 "공개(auth 없음) 조건에 의존할 수 없다"` 명시). draft 가 "패턴 재사용" 이라고 표현하는 것은 INCR+EXPIRE Redis pipeline 구현 패턴을 차용한다는 의미이나, 동일 서비스 클래스를 그대로 사용한다고 오독하면 IP 단위 카운터와 per-chat 카운터가 혼용된다. 실제 충돌은 아니지만 spec 본문에서 "별도 per-chat 카운터"임을 명확히 해야 오독이 없다.
- **제안**: CCH-NF-03 변경 문구에서 "PublicWebhookQuotaService 재사용" 표현을 "PublicWebhookQuotaService 와 **동일 Redis INCR+EXPIRE pipeline 패턴** 을 별도 per-chat 카운터로 구현" 으로 구체화.

---

### [INFO] R-CC-19 신설 ID — 기존 Rationale ID 체계와 충돌 없음 확인
- **target 위치**: draft §변경 surface "4. Rationale R-CC-19 신설"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §Rationale ID 컨벤션`
- **상세**: 기존 ID 체계를 확인하면 R-CC-18 (`rotate-bot-token` workspace 검증) 까지 존재하며, R-CC-19 는 미사용 상태. "R-CC-N prefix (`CC` = Chat Channel)" 컨벤션 정의(Rationale ID 컨벤션 절)와 완전 정합. R9 와의 직교성 언급이 포함되는데 기존 R9("CCH-CV-03 running 케이스의 큐잉 vs 즉시 안내") 가 rate-limit 큐와 lifecycle 큐를 이미 구분하고 있으므로 R-CC-19 가 R9 를 보강(외부 폭주 방어 vs lifecycle 정합)하는 구조가 일관됨.
- **제안**: 충돌 없음. R9 본문 마지막 문장 "CCH-NF-03 의 rate-limit 큐 정책은 다른 트리거 조건으로, 본 케이스와 정책 방향이 다른 것은 정당하다" 에 "이에 대한 상세 rationale 은 R-CC-19" cross-link 추가를 권장.

---

### [INFO] `spec-sync-chat-channel-gaps.md` #3 항목 — draft 가 참조하는 plan 파일 정합성 확인 권장
- **target 위치**: draft §plan 정합 — "spec-sync-chat-channel-gaps.md #3 항목: 메커니즘 확정 반영(문구 갱신), 구현은 여전히 `[ ]`(후속 PR)"
- **충돌 대상**: `plan/in-progress/spec-sync-chat-channel-gaps.md` (직접 읽지 않음)
- **상세**: draft 가 해당 plan 의 #3 항목을 "메커니즘 확정 반영" 으로 체크하고 구현은 미체크로 두겠다는 의도를 밝히고 있다. 이는 spec 변경과 구현을 분리한 명시적 결정으로 plan-lifecycle 규약에 부합한다. 다만 해당 plan 파일의 현재 상태(체크박스 현황)가 draft 기술과 일치하는지 최종 커밋 전 확인 권장.
- **제안**: 최종 spec PR 커밋 시 `spec-sync-chat-channel-gaps.md` #3 의 spec 확정 체크박스만 갱신하고 구현 체크박스는 미체크 상태 유지.

---

## 요약

draft 가 제안하는 CCH-NF-03 v1 정책(per-chat Redis fixed-window + skip + degraded + fail-open) 은 WH-NF-01(200ms 응답 시한), R9(lifecycle 큐 기각), R-CC-12(2xx 고정), CCH-SE-01(degraded 정책) 등 기존 spec 과 직접 모순되는 항목은 없다. 주요 주의 사항은 두 가지다: (1) `chat_channel_health=degraded` 의 설정 경로가 CCH-SE-01(외부 API 호출 실패) 에 이어 CCH-NF-03(rate-limit 초과) 로 확장되는 것이 CCH-SE-01 본문에 명시되지 않아 오독 가능성이 있으므로 R-CC-19 또는 CCH-SE-01 에서 다중 경로를 명시해야 한다. (2) `PublicWebhookQuotaService` "패턴 재사용" 표현이 동일 서비스 재사용으로 오독될 수 있어 "별도 per-chat 카운터" 명확화가 필요하다. 그 외 latency 예산 주석, sentinel 문자열 주석, R9 cross-link 등은 INFO 수준 개선 사항이다.

## 위험도

**LOW**

STATUS: SUCCESS
