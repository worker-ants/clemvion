# Security Review

## 발견사항

### **[WARNING]** endpoint_path UUID 생성을 클라이언트가 수행하고 서버가 형식을 강제하지 않음
- **위치**: `spec/data-flow/10-triggers.md` §4 (파일 1 변경)
- **상세**: `endpoint_path` 는 전역 고유성이 UUID 자동 발급(WH-MG-02)에 의존하는데, 이번 변경에서 "자동 발급은 서버가 아니라 클라이언트(`crypto.randomUUID()`)가 수행하며 서버는 UUID 형식을 강제하지 않는다"고 명시됨. 악의적 클라이언트가 짧거나 예측 가능한 `endpoint_path` 를 지정하면 webhook endpoint 충돌 또는 brute-force enumeration 이 가능. `(workspace_id, endpoint_path)` UNIQUE 제약은 있으나 `endpoint_path` 단독으로 조회되는 구조상, 다른 워크스페이스의 endpoint 와 충돌 시 라우팅 혼동이 생길 수 있음.
- **제안**: 서버에서 `endpoint_path` 를 UUID로 강제 발급하거나, 최소한 `@IsUUID(4)` 등 DTO 레벨 형식 검증을 추가해 비-UUID 값 입력을 거부할 것.

---

### **[WARNING]** trigger 비활성화(PATCH isActive)가 Schedule BullMQ job을 해제하지 않음 — 인가 우회 성격의 구현 갭
- **위치**: `spec/data-flow/10-triggers.md` §1.4 (파일 1 변경)
- **상세**: `PATCH /api/triggers/:id { isActive }` 는 trigger row 만 갱신하고 `scheduleRepository`·`ScheduleRunnerService.registerJob/removeJob` 를 호출하지 않는다. `process()` 는 `schedule.is_active` 만 확인하므로, 트리거 쪽 비활성화로는 schedule 발사가 멈추지 않는다. 즉 사용자가 "비활성화"를 클릭해도 스케줄 실행이 계속된다. 이는 인가(access control)와 무관한 기능 갭이지만, 관리자가 실행을 중단하려는 의도적 보안 조치를 무력화한다는 점에서 보안 속성에 직접 영향.
- **제안**: `triggers.service.ts` `update()` 에 schedule 타입 트리거의 `isActive` 변경 시 `ScheduleRunnerService.registerJob/removeJob` 를 호출하는 로직을 추가.

---

### **[WARNING]** DELETE /api/triggers/:id 이후 BullMQ job이 Redis에 잔존
- **위치**: `spec/data-flow/10-triggers.md` §1.4 (파일 1 변경)
- **상세**: `DELETE /api/triggers/:id` (`triggers.service.ts` `remove()`) 는 `removeJob` 을 호출하지 않아 BullMQ job scheduler 엔트리(`schedule:<id>`)가 Redis에 잔존한다. 실행은 안 되지만 Redis 누수 + 로그 노이즈 발생. 더 중요한 점은 같은 `scheduleId` 가 재사용될 경우(UUID 재사용 확률은 낮으나) 의도치 않은 job 이 실행될 수 있는 이론적 가능성.
- **제안**: `triggers.service.ts` `remove()` 에서 schedule 타입 트리거 삭제 시 `removeJob` 을 호출.

---

### **[WARNING]** chatChannel 비활성 트리거가 inbound 서명 검증 통과 후 조용히 무시됨 — 로그/감사 불투명
- **위치**: `spec/data-flow/10-triggers.md` §1.2, §1.5 (파일 1 변경)
- **상세**: `trigger.is_active = false` 인 chatChannel 트리거는 inbound 서명 검증을 통과한 후 `202 { executionId: 'ignored' }` 로 무시된다(R-CC-12). 이 동작 자체는 의도적이나, 비활성화된 트리거로의 지속적인 inbound 트래픽이 "성공"으로 응답되므로 공격자/오동작 탐지가 어려움. 별도 rate limit 도 없고(`rateLimitPerMinute` 구현 갭, §1.1 아래 참조) 감사 로그가 명시되지 않음.
- **제안**: 비활성 트리거로의 inbound 요청에 대해 카운터 또는 로그를 남기는 것을 권장.

---

### **[WARNING]** chatChannel inbound rate limit 미구현 (구현 갭)
- **위치**: `spec/data-flow/14-chat-channel.md` §1.1 (파일 5 변경)
- **상세**: `config.chatChannel.rateLimitPerMinute` (CCH-NF-03, default 60)는 DTO·타입 필드로만 존재하며 inbound hot path에 적용하는 코드가 없음. chatChannel 트리거는 inbound 서명 인증을 쓰므로 `PublicWebhookThrottleGuard`(공개 webhook IP rate-limit) 의 보호도 받지 않는다. 봇 token이 유출된 경우 무제한 inbound 트래픽으로 execution을 생성할 수 있음.
- **제안**: `handleChatChannelWebhook` 경로에 `rateLimitPerMinute` config 값 기반의 per-conversationKey(또는 per-triggerId) rate limit을 구현.

---

### **[WARNING]** Notification signing secret 승격 후 secretRef 우선순위 충돌 — 구 secret으로 서명 지속
- **위치**: `spec/data-flow/15-external-interaction.md` §1.5 (파일 6 변경)
- **상세**: `promoteRotatedNotificationSecrets` 가 v2 평문을 `config.notification.signing.secret` 에 쓰면서 기존 `signing.secretRef` 를 제거하지 않는다. `resolveSigningSecret` 은 `secretRef` 가 존재하면 그것을 우선 resolve 하므로, secret store ref를 가진 trigger는 승격 후에도 구 secret으로 서명을 계속한다. 이는 secret rotation의 핵심 목적(구 secret 무효화 후 신 secret으로 전환)을 달성하지 못하는 보안 결함.
- **제안**: `promoteRotatedNotificationSecrets` 에서 v2 를 `signing.secretRef` 로 승격하거나, 승격 시 기존 `secretRef` 를 반드시 제거하도록 수정.

---

### **[WARNING]** iext_* JWT blacklist가 Redis 미가용 시 fail-open — 토큰 revoke 무효화
- **위치**: `spec/data-flow/15-external-interaction.md` §3.1, Rationale (파일 6 변경)
- **상세**: interaction 토큰 blacklist(Redis `iext:blacklist:<jti>`)와 jti 추적(`execution_token`) 모두 Redis 미가용 시 fail-open(기능 저하 + warn 로그)으로 동작. 이는 execution 종료 또는 refresh 후 revoke된 토큰이 Redis 장애 중에 계속 valid로 검증될 수 있음을 의미. 짧은 JWT exp(1h)가 완화책이나, Redis 장애가 1시간을 초과하면 취소된 토큰으로 interaction이 가능.
- **제안**: 보안 요건에 따라 fail-open vs fail-closed를 명시적으로 결정하고, Redis 장애 시 최소한 경고 알림을 운영자에게 즉시 전달하는 메커니즘을 갖출 것. 현재 스펙 수준에서는 trade-off가 명시(`spec/5-system/14-external-interaction-api.md §8.3`)되어 있어 인지된 위험임.

---

### **[INFO]** OAuth 이메일 링크 조건부 UPDATE — 다른 provider 덮어쓰기 방지 확인됨
- **위치**: `spec/data-flow/2-auth.md` §1.3 (파일 7 변경)
- **상세**: `UPDATE user SET oauth_provider, oauth_provider_id WHERE id=? AND oauth_provider IS NULL` 조건부 링크가 이번 변경에서 명시됨. 이미 다른 provider에 바인딩된 계정을 OAuth 이메일 매칭으로 덮어쓰는 것을 방지하는 올바른 패턴. 긍정적 변경.
- **제안**: 없음.

---

### **[INFO]** OAuth state 원자적 one-shot DELETE로 replay/CSRF 방어 강화
- **위치**: `spec/data-flow/2-auth.md` §1.3 (파일 7 변경)
- **상세**: `DELETE FROM auth_oauth_state WHERE state=? AND expires_at > now RETURNING *` 단일 원자 쿼리로 변경. 이전의 SELECT + DELETE 두 쿼리 트랜잭션 대비 동시 callback 경합에서 정확히 한 요청만 state를 얻게 되어 CSRF/replay 방어가 강화됨. 긍정적 변경.
- **제안**: 없음.

---

### **[INFO]** refresh token reuse 탐지 분기 명확화
- **위치**: `spec/data-flow/2-auth.md` §1.4 (파일 7 변경)
- **상세**: 이번 변경에서 `is_revoked=true` (reuse 탐지 → family 전체 revoke + 이력 기록)와 `expires_at < now` (단순 만료 → 401만 반환, 부작용 없음) 분기가 명확히 분리됨. reuse 탐지를 단순 만료와 구분하는 올바른 보안 설계가 spec에 반영됨.
- **제안**: 없음.

---

### **[INFO]** itk_* (per_trigger) 토큰 비교 시 timing-safe equal 사용 확인
- **위치**: `spec/data-flow/15-external-interaction.md` §3.2 (파일 6 변경)
- **상세**: `itk_*` Guard가 매 요청마다 `timingSafeEqual` (SHA-256 후 constant-time 비교)을 사용해 timing attack을 방어함이 명시됨.
- **제안**: 없음.

---

### **[INFO]** Agent Memory scopeKey에 제어문자 제거 및 512자 SHA-256 축약 적용
- **위치**: `spec/data-flow/13-agent-memory.md` §1.2 (파일 4 변경)
- **상세**: `resolveScopeKey` 가 제어문자 제거 + 512자 초과 시 SHA-256 결정적 축약을 적용함이 명시됨. memoryKey가 사용자 입력에서 유래할 경우의 injection 방어가 되어 있는 구조. 다만 scopeKey가 Redis 키의 일부로 사용되므로 제어문자 외에도 Redis 키 구분자(`:`) 등 특수문자 처리 여부를 확인 권장.
- **제안**: Redis key 구분자 `:` 가 scopeKey에 포함될 때의 동작을 명시하거나 escape 처리 확인.

---

### **[INFO]** workflow import 시 AI 노드 llmConfigId 미지정 시 워크스페이스 기본 LLM 주입
- **위치**: `spec/data-flow/11-workflow.md` §1.5 (파일 2 변경)
- **상세**: `POST /api/workflows/import` 에서 AI 노드의 `llmConfigId` 미지정 시 워크스페이스 기본 LLM을 주입. 악의적 export JSON에 특정 `llmConfigId` 가 포함될 경우 다른 워크스페이스의 LLM Config를 참조하는지 여부는 import 로직의 workspace 스코프 검증에 달려 있음. 명시적 검증이 spec에 기술되지 않음.
- **제안**: import 시 payload 내 모든 외부 참조(`llmConfigId` 등)가 현재 워크스페이스 소속인지 검증하는 로직을 명시적으로 spec에 기술.

---

### **[INFO]** workflow version restore 시 INVALID_VERSION_SNAPSHOT 검증 있음
- **위치**: `spec/data-flow/11-workflow.md` §1.0 (파일 2 변경)
- **상세**: restore 전 snapshot의 `nodes`/`edges` 배열 누락 등 malformed 입력을 `INVALID_VERSION_SNAPSHOT` 400으로 거부하는 검증이 명시됨. JSONB snapshot을 그대로 실행하는 것이 아니라 `saveCanvas` 경로를 재사용해 동일한 검증을 거치는 구조는 적절.
- **제안**: 없음.

---

### **[INFO]** Alert window ISO 8601 파싱 fallback이 DTO 미검증 문자열에 적용됨
- **위치**: `spec/data-flow/9-observability.md` §1.3 (파일 14 변경)
- **상세**: `rule.window` 는 `@IsString` 만 검증하므로 임의 문자열이 저장될 수 있고, 파싱 불가 시 PT1H로 묵묵히 fallback. 이는 기능 오동작이나 직접적 보안 취약점은 아니나, window 를 매우 크게(`P999Y` 등) 지정했을 때 regex 파서 동작을 확인 필요.
- **제안**: `alert_rule.window` DTO에 ISO 8601 duration 패턴 `@Matches(/^P(?:\d+Y)?.../)` 등 형식 검증 추가.

---

## 요약

이번 변경은 주로 spec 문서(data-flow MD 파일들)의 코드 정합성 갱신이며 실제 코드 변경이 아니다. 직접적인 코드 인젝션·하드코딩 시크릿·암호화 알고리즘 취약점은 발견되지 않았다. 가장 중요한 보안 관련 발견사항은 두 개의 구현 갭이다: (1) `PATCH /api/triggers/:id { isActive }` 가 schedule BullMQ job을 해제하지 않아 비활성화 의도가 실행을 멈추지 못하는 점, (2) notification signing secret rotation 후 `secretRef` 우선순위로 인해 구 secret이 계속 사용되는 점. 또한 chatChannel inbound rate limit 미구현과 iext_* Redis fail-open의 보안 trade-off가 명시되어 있으나 운영 위험으로 인식·추적이 필요하다. endpoint_path 클라이언트 생성 + 서버 미검증은 enumeration 방어를 클라이언트 선의에 의존하는 구조로 개선이 권장된다. 긍정적으로는 OAuth state 원자적 소비, refresh token reuse 탐지 분기 명확화, timing-safe token 비교, chatChannel 비활성 트리거 서명 선행 검증 등 여러 보안 강화 사항이 spec에 정확히 반영되었다.

## 위험도

MEDIUM
