# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation/6-config.md` (구현 완료 후 검토, diff-base=origin/main)
검토 범위: diff 에 포함된 구현 변경이 `spec/**` 다른 영역과 충돌하는지 분석.

---

## 발견사항

### [INFO] chat-channel `{ executionId: 'ignored' }` 경로에서 response_code 기록 여부 미명시

- **target 위치**: `hooks.service.ts` diff — `handleChatChannelWebhook` 에서 `sourceIp: clientIp ?? undefined, responseCode: WEBHOOK_ACCEPTED_RESPONSE_CODE` 를 `execute()` 호출 시 항상 전달
- **충돌 대상**: `spec/5-system/15-chat-channel.md §5.5` Inbound HTTP Contract 표 — rate-limit 초과(CCH-NF-03) / 비활성 trigger(WH-EP-07) / parseUpdate null(group chat, bot 메시지 등) 등 `{ executionId: 'ignored' }` 를 반환하는 케이스에서는 `execute()` 자체를 호출하지 않으므로 Execution row 가 생성되지 않는다
- **상세**: 구현은 `execute()` 를 호출하는 성공 경로에만 `responseCode: '202'` 를 전달하므로 실제로 Execution row 가 생성되는 경우에만 영속된다. 이는 정상이고 `spec/1-data-model.md §2.13` 의 "인증/검증 실패는 execute 전에 throw 라 row 미생성" 설명과 일치한다. 그러나 `spec/2-navigation/6-config.md §R-6` 과 `spec/5-system/15-chat-channel.md §5.5` 어느 쪽에도 "rate-limit skip / ignored 경로에서는 Execution row 자체가 생성되지 않으므로 호출 이력에 집계되지 않는다" 는 명시가 없다. 이는 `getUsage` 의 `totalCalls` 가 "chat-channel 로 들어온 전체 webhook 요청 수" 가 아니라 "실제 Execution 이 생성된 건수" 임을 의미하는데, 두 spec 중 어디에도 이 차이를 설명하지 않는다.
- **제안**: `spec/2-navigation/6-config.md §A.3` 호출 이력 표 또는 `spec/5-system/15-chat-channel.md §5.5` 의 비고에 "rate-limit skip(CCH-NF-03) · 비활성 trigger silent skip · ignored 경로는 Execution row 미생성이므로 인증 설정 사용 내역의 `totalCalls` 집계에서 제외됨" 을 한 줄 추가하면 INFO 수준 혼동을 제거할 수 있다. 동기화 우선순위는 낮음.

---

### [INFO] Discord Interactivity / Slack URL Verification 경로에서 response_code = '202' 가 아닌 케이스

- **target 위치**: `hooks.service.ts` diff — `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` (='202') 를 모든 chat-channel execute 호출에 사용
- **충돌 대상**: `spec/5-system/15-chat-channel.md §5.5` 표 — Slack URL Verification → `200 OK`, Discord PING/Interactivity → `200 OK`, Slack Interactivity → `200 OK`. 이 케이스들은 `parseUpdate` 가 `null` 을 반환해 `execute()` 호출 자체가 없으므로 Execution row 가 생성되지 않는다
- **상세**: 모순이 아님. `execute()` 를 호출하지 않는 경로에서는 `responseCode` 인자도 전달하지 않는다. `response_code` 컬럼에 '200' 이 저장되는 경우는 없다. 다만 `spec/1-data-model.md §2.13` 의 `response_code` 컬럼 설명이 "execution 생성 성공 경로 = '202' Accepted" 라고만 기술하고 `200 OK` 예외 케이스를 명시하지 않는다. 실질적 모순은 없지만 설명이 불완전하다.
- **제안**: `spec/1-data-model.md §2.13` response_code 컬럼 설명에 "(Discord PING·Slack URL Verification 등 execute 호출이 없는 케이스는 row 미생성)" 를 추가하면 이해를 돕는다. 현행 설명만으로도 암묵적으로 커버되므로 낮은 우선순위.

---

### [INFO] `spec/1-data-model.md §2.13` source_ip 컬럼 설명 — CF-Connecting-IP 신뢰 시 경로 묘사가 `spec/5-system/1-auth.md §2.3` 와 표현 차이

- **target 위치**: 구현 `hooks.service.ts` — `extractClientIp(input.headers)` 사용 (변경 없음, 기존 코드 재사용)
- **충돌 대상**: `spec/1-data-model.md §2.13` source_ip 컬럼 설명 "CF-Connecting-IP 신뢰 시 → X-Forwarded-For 첫 IP" vs `spec/5-system/1-auth.md §2.3` "CF-Connecting-IP 는 TRUST_CF_CONNECTING_IP=true 일 때만 1순위; off 면 X-Forwarded-For 첫 IP → req.ip(trust proxy) → req.socket.remoteAddress 순"
- **상세**: `spec/1-data-model.md §2.13` 의 source_ip 설명은 "CF-Connecting-IP 신뢰 시 → X-Forwarded-For 첫 IP" 로 기술되어 CF-Connecting-IP 를 신뢰하는 경우와 X-Forwarded-For 첫 IP 가 마치 다른 값인 것처럼 읽힐 수 있다. 실제 `spec/5-system/1-auth.md §2.3` 및 `spec/data-flow/1-audit.md §85` 의 Rationale 에 따르면 CF 뒤 배포에서 `TRUST_CF_CONNECTING_IP=true` 시 CF-Connecting-IP 를 1순위로 쓰고, off 시 X-Forwarded-For 첫 IP 를 쓴다. 즉 두 값은 상호 대체 경로이지 연쇄가 아니다.
- **제안**: `spec/1-data-model.md §2.13` source_ip 설명을 `spec/5-system/1-auth.md §2.3` 에서 정의한 `extractClientIp` 를 참조하는 방식으로 단순화하여 drift 를 방지한다. 명명 비일관성 수준으로 실제 동작은 코드가 올바르게 수행하므로 낮은 우선순위.

---

## 요약

이번 구현(V096 마이그레이션 + auth-configs.service `getUsage` 확장 + hooks.service IP/응답코드 영속 + 프런트엔드 드로어)은 `spec/1-data-model.md §2.13`, `spec/2-navigation/6-config.md §A.3·R-6`, `spec/5-system/12-webhook.md WH-MG-05` 세 영역과 완전히 일치한다. DB 스키마(VARCHAR(45)/VARCHAR(10) nullable), API 응답 shape(`periodCounts`/`recentCalls`/`sourceIp`/`responseCode`), 롤링 윈도 정의(캘린더 버킷이 아닌 rolling), 폴백 로직(비-HTTP 트리거 → status enum), 최근 20건 제한, chat-channel 경로 동일 처리 등 핵심 결정이 spec 과 모두 정합한다. CRITICAL 또는 WARNING 등급의 교차-영역 모순은 발견되지 않았다. INFO 3건은 모두 spec 설명의 완전성·표현 일관성 개선 권고이며 구현 정합성에는 영향 없다.

## 위험도

NONE
