# 신규 식별자 충돌 검토 결과

> 검토 모드: `--impl-done` (구현 완료 후 검토)
> Target: `spec/5-system/14-external-interaction-api.md` + `spec/data-flow/15-external-interaction.md`
> diff-base: `3064c9c6`

---

## 발견사항

### **[WARNING]** `TOKEN_INVALID` / `TOKEN_EXPIRED` — 워크스페이스 JWT 계층 코드와 동일 문자열 재사용

- **target 신규 식별자**: `TOKEN_INVALID`, `TOKEN_EXPIRED` — EIA §5.1 에서 interaction 토큰(`iext_*`/`itk_*`) 검증 실패 코드로 사용
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.2 — 워크스페이스 JWT Access Token 만료·무효 코드로 이미 정의됨 (`401 TOKEN_EXPIRED` = Access Token 만료, `401 TOKEN_INVALID` = 변조/형식 오류/refresh 토큰 미존재)
- **상세**: 동일 문자열 코드가 두 레이어(워크스페이스 JWT 인증 계층 vs EIA interaction 토큰 계층)에서 사용된다. 진입점(`/api/external/*` vs `/api/*`)과 토큰 family(`iext_*`/`itk_*` vs access_token)가 다르므로 런타임 충돌은 없다. target 의 §5.1 에서 이를 "코드 네임스페이스 주석"으로 명시(`TOKEN_INVALID`/`TOKEN_EXPIRED`는 워크스페이스 JWT 계층과 같은 문자열이나, 본 표는 interaction 토큰 검증 실패를 가리킨다)하여 의식적 재사용임을 기록하고 있다. 혼동 위험은 낮지만, `spec/5-system/3-error-handling.md`에 EIA 재사용 사실과 레이어 구분 조건이 기록되어 있지 않다.
- **제안**: `spec/5-system/3-error-handling.md` §1.2 의 `TOKEN_INVALID`/`TOKEN_EXPIRED` 항목에 "(EIA 표면의 interaction 토큰 검증 실패에도 동일 코드 재사용 — 진입점 `/api/external/*` + 토큰 family `iext_*`/`itk_*` 로 레이어 구분)" 주석을 추가해 단일 진실에서 명시적으로 기록한다. target 자체의 변경은 불필요.

---

### **[INFO]** `notification_health` 외 3개 컬럼 — `1-data-model.md` 와 정합 확인됨 (충돌 없음)

- **target 신규 식별자**: `notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at` (EIA §7.1 `trigger` 테이블 확장)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md` Trigger 엔티티 섹션 — 동일 4개 컬럼이 이미 data-model spec 에 등재됨
- **상세**: 충돌 없음. data-model spec 과 target 이 동일 컬럼명·의미를 사용하며 일관됨.
- **제안**: 해당 없음.

---

### **[INFO]** `execution_token` 테이블 — 기존 spec 과 정합 확인됨

- **target 신규 식별자**: `execution_token` 테이블 (V060, `jti PK · execution_id FK · issued_at · exp_at`)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/data-flow/15-external-interaction.md` Schema 매핑 표 — 동일 테이블명/컬럼 구조가 이미 기재됨
- **상세**: 충돌 없음.
- **제안**: 해당 없음.

---

### **[INFO]** `INTERACTION_JWT_SECRET` 환경변수 — 기존 spec 에서 이미 참조됨

- **target 신규 식별자**: `INTERACTION_JWT_SECRET` (EIA §8.3)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` production-guards 섹션 — 동일 ENV var 를 production guard 예외 항목으로 언급
- **상세**: 충돌 없음. 동일 의미로 두 spec 이 참조하고 있으며, target 이 주체 정의·fallback 체인(`JWT_SECRET` fallback)을 보유.
- **제안**: 해당 없음.

---

### **[INFO]** `interaction-token` Swagger Bearer scheme — `conventions/swagger.md` 와 정합 확인됨

- **target 신규 식별자**: `@ApiBearerAuth('interaction-token')` Swagger scheme (EIA §10.1)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` §2-1 — `interaction-token` scheme 이 이미 등록 규약으로 정의됨
- **상세**: 충돌 없음. target 과 swagger 규약이 동일 scheme 이름·의미로 정합됨.
- **제안**: 해당 없음.

---

### **[INFO]** `terminal-revoke-reconcile` BullMQ 큐 — `data-flow/0-overview.md` 카탈로그와 정합 확인됨

- **target 신규 식별자**: BullMQ 큐 `terminal-revoke-reconcile` (EIA §9.3 R15, `TerminalRevokeReconcilerService`)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` §4 큐 카탈로그 — `terminal-revoke-reconcile` 이 이미 등재됨 (등록 모듈 `external-interaction.module.ts`)
- **상세**: 충돌 없음.
- **제안**: 해당 없음.

---

### **[INFO]** `execution.replay_unavailable` SSE 이벤트명 — WS spec 의 `replay.unavailable` 과 의도적 분기

- **target 신규 식별자**: SSE 이벤트 `execution.replay_unavailable` (EIA §5.2)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §6.2 — WS 내부 이벤트 이름은 `replay.unavailable`
- **상세**: 충돌 없음. target 이 §5.2 에서 namespace 분기 이유를 명시하고 있으며, `6-websocket-protocol.md` §6.2 매핑 표에도 `replay.unavailable` ↔ `execution.replay_unavailable` 가 기록됨.
- **제안**: 해당 없음.

---

### **[INFO]** EIA 전용 에러 코드 (`STATE_MISMATCH`, `EXECUTION_TERMINATED` 등) — `3-error-handling.md` 미등재

- **target 신규 식별자**: REST 에러 코드 `STATE_MISMATCH` (409), `EXECUTION_TERMINATED` (410), `TOO_MANY_CONNECTIONS` (429), `IDEMPOTENCY_KEY_CONFLICT` (409), `INVALID_COMMAND` (400), `MESSAGE_TOO_LONG` (400) — EIA 표면 전용 코드
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` — 위 코드들이 직접 등재되어 있지 않음. `EXECUTION_MESSAGE_TOO_LONG`(WS 계층 코드)은 §1.4 에 있으나 `MESSAGE_TOO_LONG`(EIA REST 코드)은 별도 항목 없음
- **상세**: 충돌은 없다. target §5.1 과 §Rationale R13 에서 "EIA 표면 전용 코드로 규약 기본값을 의도적으로 override 한다"고 명시하고 WS ↔ EIA 코드 동치 관계도 매핑 표로 고정되어 있다. 다만 프로젝트 전체 에러 코드 카탈로그(`3-error-handling.md`)에 EIA 전용 코드가 없어 신규 개발자·리뷰어가 코드 출처를 발견하기 어렵다.
- **제안**: `spec/5-system/3-error-handling.md` 에 "EIA 외부 표면 전용 코드 (`/api/external/*` 한정)" 섹션을 추가하거나 기존 에러 코드 표에 "(EIA 전용)" 주석 행으로 6개 코드를 등재. 강제 사항이 아닌 일관성 보완 제안.

---

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md`)가 도입하는 신규 식별자 중 실제 충돌(동일 식별자·다른 의미)은 발견되지 않았다. `TOKEN_INVALID`/`TOKEN_EXPIRED` 에러 코드가 워크스페이스 JWT 계층(`spec/5-system/3-error-handling.md`)과 동일 문자열을 공유하지만, target 자체가 §5.1 "코드 네임스페이스 주석"에서 의도적 재사용임을 명시하고 진입점·토큰 family 로 레이어를 구분하고 있어 런타임 혼선 위험은 낮다. BullMQ 큐 이름(`terminal-revoke-reconcile`), DB 컬럼(`notification_health` 등), `execution_token` 테이블, Swagger scheme(`interaction-token`), SSE 이벤트명(`execution.replay_unavailable`) 모두 기존 spec 과 정합 확인됨. 가장 실질적인 개선 항목은 `3-error-handling.md` 에 (a) `TOKEN_INVALID`/`TOKEN_EXPIRED` 의 EIA 재사용 레이어 구분 주석, (b) EIA 전용 에러 코드 목록 등재 두 가지이며, 이는 단일 진실 원칙의 완결성 관점에서 권장한다.

---

## 위험도

LOW
