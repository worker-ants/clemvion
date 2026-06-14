# 신규 식별자 충돌 검토 결과

target: `spec/5-system/14-external-interaction-api.md`

---

## 발견사항

### 요구사항 ID 충돌

target 이 도입하는 `EIA-NX-*`, `EIA-IN-*`, `EIA-AU-*`, `EIA-RL-*`, `EIA-NF-*` 시리즈를 기존 spec 파일에서 검색한 결과, 다른 의미로 먼저 정의된 사례가 없다. `spec/5-system/15-chat-channel.md` 등 참조 문서는 이 ID 를 역참조(인용)할 뿐 재정의하지 않는다. 충돌 없음.

---

### 에러 코드 식별자

- **[WARNING]** `MESSAGE_TOO_LONG` — EIA REST 레이어 전용 코드 vs 내부 `EXECUTION_MESSAGE_TOO_LONG` 카탈로그 누락
  - target 신규 식별자: `MESSAGE_TOO_LONG` (§5.1 에러 표, HTTP 400)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/3-error-handling.md` 104행: `EXECUTION_MESSAGE_TOO_LONG` — WS ack 전용 코드로 카탈로그 등재
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/6-websocket-protocol.md` 312행: `EXECUTION_MESSAGE_TOO_LONG` — WS ack 에러 코드
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/4-execution-engine.md` 1013행: "WS 평면 ack `EXECUTION_MESSAGE_TOO_LONG` 와 동일 의미를 REST layer 코드 `MESSAGE_TOO_LONG` 으로 표기" 로 명시
  - 상세: `3-error-handling.md` §1.5 의 공용 에러 코드 카탈로그에 `EXECUTION_MESSAGE_TOO_LONG` 만 등재되어 있고, EIA REST 표면의 `MESSAGE_TOO_LONG` 은 별도 등재가 없다. 의미 충돌은 아니지만 카탈로그 검색 시 target 의 코드를 찾을 수 없다.
  - 제안: `3-error-handling.md` 에 EIA REST 전용 에러 코드 섹션을 추가하거나 `MESSAGE_TOO_LONG` 을 각주로 언급해 카탈로그 가시성을 확보한다.

- **[WARNING]** `SCOPE_MISMATCH` (target §5.1) vs `TOKEN_SCOPE_MISMATCH` (data-flow SoT) — 동일 조건에 다른 코드명
  - target 신규 식별자: `SCOPE_MISMATCH` (§5.1 에러 표, 403 "토큰 scope 가 해당 execution 에 일치하지 않음")
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/data-flow/15-external-interaction.md` 269행 — `scope_mismatch→TOKEN_SCOPE_MISMATCH` 로 403 코드를 `TOKEN_SCOPE_MISMATCH` 로 표기
  - 상세: target §5.1 에서는 `SCOPE_MISMATCH`, data-flow SoT 에서는 `TOKEN_SCOPE_MISMATCH`. 같은 조건에 대해 두 문서가 다른 코드 문자열을 제시하여 실제 HTTP 응답 body 에 어떤 값이 들어갈지 모호하다. 구현자가 어느 쪽을 따를지 결정하지 못하거나 클라이언트가 잘못된 코드로 분기할 수 있다.
  - 제안: 하나로 통일한다. target 이 공개 API 표면 정의이므로 `SCOPE_MISMATCH`(target)를 권위로 하고 data-flow 를 정정하거나, data-flow 의 `TOKEN_SCOPE_MISMATCH` 를 권위로 하고 target 을 수정한다.

- **[INFO]** `TOKEN_INVALID` / `TOKEN_EXPIRED` — 기존 auth 에러 코드 재사용
  - target 신규 사용처: §5.1 에러 표 (401)
  - 기존 정의: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/3-error-handling.md` §1.2 — "Access Token 만료", "변조/형식 오류·refresh 토큰 미존재" 로 정의 (워크스페이스 JWT 문맥)
  - 상세: interaction token (`iext_*`/`itk_*`) 검증 실패에 동일 코드를 재사용한다. 의미 확장이며 충돌은 아니다. 단 `spec/data-flow/15-external-interaction.md` 268~270행에는 `TOKEN_REVOKED`, `TOKEN_SCOPE_MISMATCH`, `TOKEN_AUDIENCE_MISMATCH` 도 언급되어 있으나 target §5.1 에서는 `TOKEN_INVALID`/`TOKEN_EXPIRED` 만 노출해 data-flow 와 코드 집합 불일치가 있다.
  - 제안: EIA 에러 표에 `TOKEN_REVOKED` 를 추가하거나, data-flow 의 세분화 코드를 target 에러 표와 통합 정렬한다.

- **[INFO]** `EXECUTION_NOT_FOUND` — 기존 동명 코드와 인증 체계 차이
  - target 신규 사용처: §5.1 에러 표, 404
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/3-workflow-editor/4-ai-assistant.md` 277행, `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/4-nodes/1-logic/12-background.md` 300행 — 워크스페이스 JWT 문맥에서 "executionId 없음 또는 workspace 경계 밖"
  - 상세: EIA 는 interaction token 기반이라 workspace 경계 개념이 다르다(executionId scope 가 토큰에 포함). 동일 코드가 다른 인증 체계에서 재사용되어 의미상 경계가 모호할 수 있다. 실질적 충돌보다는 설명 명확화 필요.
  - 제안: target 에 "executionId 없음 또는 토큰 scope 에 포함되지 않는 execution" 으로 설명을 보강한다.

---

### API endpoint 충돌

신규 엔드포인트(`/api/external/executions/*`, `POST /api/triggers/:id/notification/rotate-secret`, `POST /api/triggers/:id/interaction/revoke-token`)는 기존 `/api/executions/*` 경로 및 이전 예약 후 폐기된 `/api/triggers/:id/auth/rotate-secret` 과 routing prefix·인증 family 모두 분리되어 충돌 없음. `spec/5-system/2-api-convention.md` §예외 표에 RPC-style sub-channel action URL 형태가 이미 허용 예시로 등재되어 있어 컨벤션 정합.

---

### 이벤트/메시지명 충돌

`execution.replay_unavailable`(SSE) vs `replay.unavailable`(WS)는 target §5.2 에서 의도적 분리임을 명시하고 있어 충돌 아님. 계획·미구현 상태이므로 구현 시점에 두 이벤트의 emit 경로를 혼동하지 않도록 주의 필요.

---

### 환경변수·설정키 충돌

- `ALLOW_HTTP_HOOKS`: target §3.1 EIA-NX-09 에서 언급하는 기존 환경변수. 코드베이스 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/codebase/backend/src/common/utils/ssrf-safe-url.util.ts` 84행에 동일 이름·동일 의미로 구현됨. 신규 도입이 아닌 재사용. 충돌 없음.
- `INTERACTION_JWT_SECRET`: 신규 ENV var. `spec/5-system/1-auth.md` 628행에서 언급되며, 기존 `JWT_SECRET` fallback 체인이 명시됨. 이름 충돌 없음.
- `interactionAllowedOrigins`: target §8.5 CORS 에서 사용. `spec/1-data-model.md §2.2` / `spec/7-channel-web-chat/4-security.md` 에 이미 정의된 동일 키. 신규 도입이 아닌 재사용. 충돌 없음.

---

### DB 컬럼 충돌

target §7.1 `notification_health` / `notification_last_error` / `notification_secret_v2` / `notification_rotated_at` 4개 컬럼은 `spec/1-data-model.md` 230~233행에 이미 동일 이름·동일 의미로 등재되어 있다. target 이 data-model 정의를 ALTER TABLE 문으로 재서술하는 구조이며 내용이 일치해 충돌 없음.

---

### 파일 경로 충돌

`spec/5-system/14-external-interaction-api.md` 번호 순서상 13(`replay-rerun`) 다음이 적합하고, 기존 파일과 이름이 겹치지 않는다. 충돌 없음.

---

## 요약

target `spec/5-system/14-external-interaction-api.md` 가 도입하는 신규 식별자 중 다른 의미로 이미 사용 중인 항목은 없다. 다만 두 가지 WARNING 이 있다. (1) `MESSAGE_TOO_LONG` 은 공개 API 에러 코드이지만 `spec/5-system/3-error-handling.md` 의 공용 에러 코드 카탈로그에 등재되지 않아 검색 가시성이 없다. (2) `SCOPE_MISMATCH`(target §5.1)와 `TOKEN_SCOPE_MISMATCH`(data-flow SoT)가 동일 조건을 지칭하는 서로 다른 이름으로 두 문서에 공존하여, 구현 및 클라이언트 분기 혼선이 우려된다. 두 항목은 공개 API 에러 코드이므로 조기 정렬을 권장한다.

## 위험도

LOW
