---
worktree: conversation-thread-secret-hardening-6477bb (branch claude/eia-secret-masking-followup)
started: 2026-07-10
completed: 2026-07-10
owner: developer
---

> **완료 (2026-07-10)**: 코드 항목(P1-2·P2-6·P3-7) 구현+검증, 결정 항목(P1-1 현행유지·P1-3 보류) 확정. 잔여(observer-vs-participant 분리·일반 nodeOutput allowlist·DB-at-rest·author-config 값-embedded)는 spec §R17 에 문서화.

# EIA 공개 표면 secret 마스킹 — 잔여 하드닝

> 작성일: 2026-07-10
> 선행: PR #876 (`9ef97854f`) — `conversationThread`·`ai_message`·`nodeOutput.conversationConfig` egress 마스킹 강제 (EIA §R17).
> SoT: `spec/5-system/14-external-interaction-api.md` §R17 (잔여 항목 명문화), `spec/conventions/conversation-thread.md` §8.4.

## 배경

PR #876 이 conversation turn 텍스트 불변식을 공개 EIA egress(getStatus REST + SSE + ai_message + nodeOutput.conversationConfig)에서 런타임 마스킹으로 강제했다. 그 과정의 2 라운드 리뷰에서 **의도적으로 미룬 잔여 표면·개선**을 본 plan 으로 추적한다. 공용 SoT 는 `shared/utils/sanitize-error-message.ts` (`redactSecrets`·`deepRedactSecrets`·`redactSecretsInJsonString`·`SECRET_LEAK_PATTERNS`·`CREDENTIAL_KEY_PATTERN`).

## 항목

### P1-2. 일반 `nodeOutput` / terminal `outputData` 마스킹 — **구현 대상**
원 §R17 "허용 키 allowlist" backlog. conversationConfig 은 닫았으나:
- `getStatus` `result`(COMPLETED)·`error`(FAILED) = `execution.outputData` **무마스킹** (`interaction.service.ts:319-325` 확인).
- SSE waiting emit 의 non-conversationConfig `nodeOutput`(config/meta) = `sanitizePayloadForWs` **키 기반**만 방어 → 값-embedded secret gap.

**접근**: `getStatus` result/error 에 `deepRedactSecrets` 적용(deepRedactSecrets 는 secret-shape 만 마스킹 → 정상 결과 데이터 보존). SSE waiting emit 의 나머지 nodeOutput 은 범위·회귀 리스크 평가 후 결정(에디터 전용 `turnDebug.llmCalls` 보존 필수). 테스트 + spec §R17 갱신.

### P1-1. participant-vs-observer 분리 egress — **결정 필요(설계/제품)**
`ai_message` emit-site 마스킹이 Chat Channel 능동 발송(텔레그램/슬랙/디스코드) + 위젯 라이브 전달에도 적용 → 보수적 패턴 FP 시 **이미 전달된 대화 응답이 `***`로 손상**.

**핵심 결정**: "AI 가 실수로 응답에 담은 secret 을 대화 participant(고객)에게 전달하는 것이 leak 인가?"
- **예 → 현행 유지**(모든 표면 마스킹, rare FP 수용). 추가 작업은 패턴 정밀화(shared SoT, 광범위 영향)로 FP 감소.
- **아니오 → observer 표면만 마스킹**(webhook fanout + 재노출 getStatus/thread), 라이브 participant 전달(chat-channel·위젯 SSE)은 faithful. `websocket.service.emitExecutionEvent` 의 wire vs fanout 경계 활용.

두 원 리뷰(security=마스킹 요구 / side-effect=발송 손상 경고)가 정면 충돌하는 지점이라 제품 판단 없이는 단정 불가.

### P1-3. DB-at-rest 최소화 (append-time redaction) — **보류 권고**
현재 egress-only → durable `Execution.conversation_thread` 컬럼 + LLM 주입 경로는 faithful 저장. 데이터 최소화 요구 시 append 시점 redaction. **단** 보수적 패턴(`Bearer\s+\S+`)의 prose FP 가 LLM 컨텍스트를 조용히 손상 → 요구가 명확해지기 전엔 도입하지 않음이 권고.

### P2-6. `deepRedactSecrets` 캐시 — **구현 대상(저위험)**
sibling `sanitizePayloadForWs` 는 `SANITIZE_CACHE`(WeakMap) 로 반복 deep-walk 를 회피하나 `deepRedactSecrets` 는 미적용. 매 emit/getStatus deep-walk 비용. WeakMap 캐시 도입(입력 object identity 키).

### P2-4/5. 정밀도 — **수용/문서화**
- P2-4: credential-key 이름의 정당한 필드(`token`/`secret`) 과잉 마스킹 — 보안 우선 수용.
- P2-5: `redactSecretsInJsonString` 의 JSON round-trip 정규화(키순서/공백/escape) — 의미 동일, 형식 의존 소비처 없음 확인 시 수용.

### P3-7. e2e wire 마스킹 assertion — **구현 대상**
현재 unit only. `test/external-interaction.e2e-spec.ts` 에 실제 getStatus/SSE wire 로 secret 이 `***` 로 나가는지 end-to-end 1건.

### P3-8. 중복 sanitizer 조사 — **조사 후 결정**
`modules/execution-engine/sanitize-error-message.ts` 가 `shared/utils/sanitize-error-message.ts` 와 별개 존재 — 패턴/placeholder drift 위험. 내용 대조 후 dedup 또는 무관 확인.

## 진행 결과 (2026-07-10 세션)

- **P3-8 (조사) → 종결(무관)**: `modules/execution-engine/sanitize-error-message.ts` 는 `sanitizeErrorMessage(err)` — stack trace + connection-string URI(`[REDACTED_URI]`) strip 으로 **다른 concern**(토큰 마스킹 아님). 중복 아님, dedup 불필요. (경미: error 알림 경로의 Bearer 토큰 미마스킹 가능성은 pre-existing·별도 backlog 감.)
- **P1-2 (구현) → 완료**: `getStatus` `result`(COMPLETED)·`error`(FAILED) `outputData` 를 `deepRedactSecrets` 로 마스킹. SSE waiting emit 의 non-conversationConfig nodeOutput 은 sanitizePayloadForWs(키) + conversationConfig(값+키) 로 충분 판단 → author-config 값-embedded gap 은 저위험, 미확장.
- **P2-6 (구현) → 완료**: `deepRedactSecrets` 에 depth-0 WeakMap 캐시(`DEEP_REDACT_CACHE`, sibling `sanitizePayloadForWs` 동형).
- **P3-7 (구현) → 완료**: `external-interaction.e2e-spec.ts` 에 getStatus wire 마스킹 e2e(I) 추가 — 실 DB seed → 실 응답 secret `***` 검증.
- **P1-1 (결정) → 현행 유지**: *전 표면 마스킹*. AI 응답의 secret 이 participant 채널로도 안 나가는 보안 우선. rare prose FP 수용(spec §R17 명문). observer-only 분리는 미채택.
- **P1-3 (결정) → 보류**: egress-only 유지. append-time redaction 은 LLM 컨텍스트 FP 손상 리스크로 데이터 최소화 요구 명확화 전 미도입(spec §R17 명문).
- **P2-4/5 → 수용**: credential-key 과잉 마스킹·JSON round-trip 정규화는 보안 우선 수용.

**남은 잔여(문서화)**: SSE author-config 값-embedded 마스킹(저위험), observer-vs-participant 분리 egress(P1-1 미채택분), DB-at-rest(P1-3), error-알림 경로 토큰 마스킹(P3-8 경미).

완료 시: test → `/ai-review` → fix → 본 plan `plan/complete/` 이동.
