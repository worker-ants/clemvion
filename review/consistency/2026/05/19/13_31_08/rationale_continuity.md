# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
검토 대상: Cafe24 API 호출 시 access_token 유효시간 확인·갱신 로그 보강
변경 파일: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
Plan: `plan/in-progress/cafe24-token-lifecycle-logs.md`

---

## 발견사항

### [INFO] 기존 sanitize 패턴 준수 — 신규 로그 경로 점검 필요

- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §결정 사항 — "access_token / refresh_token 자체는 절대 노출하지 않음 (이미 sanitize 가 있지만 본 PR 의 신규 로그가 새 노출 경로를 만들지 않도록 명시 점검)"
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` ## Rationale "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" — "`client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관"; `spec/4-nodes/4-integration/4-cafe24.md` §9.8 및 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS` 정의.
- **상세**: 기존 코드(`executeWithRateLimit` 의 401/403 분기, `refreshAccessToken` 의 warn)는 `sanitizeLastErrorMessage` 를 통해 Cafe24 응답 body 를 마스킹한 뒤 로그한다. 신규로 추가될 로그 라인들 (`ensureFreshToken` skip/trigger, `refreshAccessToken` 시작·성공, `executeWithRateLimit` 401 트리거)은 plan 상 `integrationId / mall_id / ttlSec / source / newExpiresAt / retryCount` 라벨만 포함하도록 설계되어 있어 token 값이 직접 노출될 경로는 없다. 다만 `refreshAccessToken` 성공 로그에 `newExpiresAt=ISO` 를 포함하는 경우, `expiresAt.toISOString()` 은 비민감 메타데이터이므로 `SECRET_LEAK_PATTERNS` 대상이 아니며 마스킹 불필요. 문제는 없으나, 구현 시 신규 로그 라인을 `sanitizeLastErrorMessage` 로 통과시키는 방어적 처리 없이 key=value pair 로 직접 구성한다면 이 패턴이 기존 warn 처리 방식과 외관상 달라진다는 점을 명시적으로 확인해야 한다.
- **제안**: 구현 시 신규 `log` / `debug` 라인에 Cafe24 응답 body 조각이 포함되지 않음을 코드 레벨에서 확인. `integrationId / mall_id / ttlSec / source` 는 운영 식별자이며 `SECRET_LEAK_PATTERNS` 대상이 아니므로 별도 sanitize 불필요. 이 판단을 코드 주석에 한 줄 명시하면 향후 검토자가 의도를 오해하지 않는다.

---

### [INFO] `debug` 레벨 선택 — 기존 debug 사용 패턴과 일관성

- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §결정 사항 — "debug — 정상 path (token fresh skip). 매 호출 발사되므로 production noise 회피."
- **과거 결정 출처**: `cafe24-api.client.ts` 기존 코드 내 `this.logger.debug` 사용 사례 2건: (1) `Cafe24 429 (attempt N) — sleeping ...` (line 1171), (2) `Cafe24 refresh worker succeeded ... but waitUntilFinished timed out — recovered via DB re-read` (line 672). 두 케이스 모두 빈도가 낮거나 비정상 경로임에도 debug 를 사용하고 있다.
- **상세**: 기존 코드의 `debug` 사용이 "빈도 낮음 또는 비정상 경로" 에도 적용되는 반면, plan 은 "정상 path (token fresh skip) — 매 호출" 에 `debug` 를 할당한다. 기존 패턴보다 엄격한 기준이라 충돌 없음. Rationale 차원의 기각된 대안 재도입이나 원칙 위반은 없다.
- **제안**: 변경 없음. 레벨 분리 근거가 plan 에 명시되어 있어 충분.

---

### [INFO] `refreshAccessToken` 성공 로그 추가 — 기존 "실패만 warn" 패턴의 보완

- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §1 `refreshAccessToken` 시작/성공 로그 — "시작 — `log` 레벨", "성공 — `log` 레벨"
- **과거 결정 출처**: `cafe24-api.client.ts` 기존 `refreshAccessToken` — warn 두 건 (401/403 분기: line 808, transport 실패: line 820 경유) 만 존재. spec 상 성공 로그 미정의.
- **상세**: 기존 코드는 `refreshAccessToken` 의 성공 경로에 로그가 없다. plan 이 추가하는 시작/성공 `log` 라인은 기존 Rationale 에서 명시적으로 기각된 대안이 아니며, 운영 진단 목적의 보강이다. `spec/2-navigation/4-integration.md` Rationale 의 어떤 항목도 "성공 로그 미추가" 를 명시적으로 강제하지 않는다. 새 Rationale 없이 도입하더라도 Rationale 연속성 위반이 아닌 신규 추가에 해당.
- **제안**: 변경 없음. 다만 구현 완료 후 plan 의 "결정 사항" 항목이 SoT 역할을 하므로 별도 spec Rationale 갱신은 불필요 (logging 은 운영 내부 결정, spec 기재 대상 아님).

---

### [INFO] `executeWithRateLimit` 401 트리거 로그 — 기존 warn 과의 중복 최소화

- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §1 `executeWithRateLimit` 401 자가회복 — "401 트리거 — `log` 레벨: `Cafe24 401 detected — performAuthRefresh + retry ...`. 이미 존재하는 warn 들과 충돌하지 않도록 message prefix 통일."
- **과거 결정 출처**: `cafe24-api.client.ts` line 1206 — 기존 `this.logger.warn(...)` 가 이미 `Cafe24 API ${response.status} mall=${mallId} ...` 메시지를 출력한다. 이 warn 은 401 / 403 모두를 덮는다.
- **상세**: 기존 warn (`Cafe24 API 401 mall=... method path: body`) 이 이미 발사된 뒤, plan 의 새 `log` 라인(`Cafe24 401 detected — performAuthRefresh + retry ...`)이 추가로 발사되면 동일 이벤트에 두 줄의 로그가 생긴다. 의미가 보완적 (warn = "Cafe24 가 401 응답", log = "자가회복 시작") 이라 중복이 아닌 분리이지만, prefix 통일 없이는 운영 grep 시 혼동 가능. plan 은 "이미 존재하는 warn 들과 충돌하지 않도록 message prefix 통일" 을 명시하고 있어 인지하고 있다. Rationale 연속성 위반은 없다.
- **제안**: 구현 시 `Cafe24 401 detected` 신규 `log` 가 기존 `Cafe24 API 401` warn **직후** 발사됨을 코드 순서로 보장하면 운영자가 자연스러운 흐름으로 읽힌다. warn 의 body 내용과 신규 log 의 retryCount 가 함께 검색 가능해 진단 가치가 높다.

---

## 요약

target 구현 계획(`plan/in-progress/cafe24-token-lifecycle-logs.md`)은 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목을 포함하지 않는다. 신규 로그 라인은 기존 `SECRET_LEAK_PATTERNS` / `sanitizeLastErrorMessage` 정책과 충돌하지 않는 `integrationId / mall_id / ttlSec / source` 식별자만 포함하도록 계획되어 있으며, 기존 Rationale 에서 확립된 "token 값 로그 노출 금지" invariant 를 우회하지 않는다. BullMQ 큐 dedup / 401 자가회복 정책 / sanitize 정책 등 주요 결정은 모두 기존 Rationale 의 방향과 일관한다. INFO 등급 4건은 모두 구현 시 유의 사항 수준으로 차단 사유가 아니다.

## 위험도

NONE
