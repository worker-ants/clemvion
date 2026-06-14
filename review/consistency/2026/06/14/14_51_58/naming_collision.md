# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md

## 발견사항

### 1. 요구사항 ID 충돌 — 없음

target 이 도입하는 `EIA-NX-01~12`, `EIA-IN-01~13`, `EIA-AU-01~08`, `EIA-RL-01~05`, `EIA-NF-01~05` prefix 는 다른 spec 파일에서 독립 사용되지 않는다. 참조(`EIA §3.3 EIA-AU-08` 등)는 모두 해당 ID 를 정의한 본 파일을 가리키는 순방향 참조이다.

### 2. 엔티티·타입명 충돌

- **[INFO]** `§7.3` 의 "별도 테이블 없음" 기술 vs 실제 `execution_token` 테이블 존재
  - target 신규 식별자: §7.3 `InteractionToken (in-memory + Redis)` 절 — "별도 테이블을 만들지 않고 JWT 자체에 모든 정보를 담는다"
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/data-flow/15-external-interaction.md` L21, L29, L59, L232–233 — `execution_token` 테이블(V060) 및 `entities/execution-token.entity.ts` 가 실제로 존재한다고 기술
  - 상세: 식별자 이름 자체의 충돌은 아니나, target §7.3 이 구현 현실을 반영하지 않은 stale 기술로 독자 혼선을 유발한다.
  - 제안: target §7.3 을 "jti 는 `execution_token` 테이블(V060)에 영속 추적" 으로 갱신하거나, data-flow 를 권위 문서로 명시하는 note 추가.

- **[INFO]** `InteractionRequestContext` 타입 분리 — "v2 권고"로 기술되지만 이미 구현됨
  - target 신규 식별자: §3.3.1 — `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` union 분리를 "v2 이후 권고"로 표기
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/codebase/backend/src/modules/external-interaction/interaction.guard.ts` L44, L54, L61–63 — 이미 union 타입으로 구현됨
  - 상세: spec 과 구현 간의 상태 불일치. 식별자 충돌 아님.
  - 제안: target §3.3.1 "타입 분리 권고 (v2 이후)" 문구를 "구현됨 (`interaction.guard.ts`)" 으로 갱신.

### 3. API endpoint 충돌 — 없음

- `/api/external/executions/:id/*` 신규 prefix 는 기존 `/api/executions/*` 와 routing prefix 와 인증 family 가 분리됨을 target §12 및 §R11 에서 명시 인식하고 기술. 실제 중복 정의 없음.
- `POST /api/triggers/:id/notification/rotate-secret` (EIA-NX-12) 및 `POST /api/triggers/:id/interaction/revoke-token` (EIA-AU-07) 은 webhook spec 에서 정의하지 않고 EIA cross-link 만 존재. 중복 없음.

### 4. 이벤트·메시지명 충돌

- **[INFO]** `execution.replay_unavailable` (SSE) vs `replay.unavailable` (WS 내부)
  - target 신규 식별자: `execution.replay_unavailable` SSE 이벤트 (§5.2, §11 매핑 표)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/5-system/6-websocket-protocol.md` L800, L867 — `replay.unavailable` (WS), `execution.replay_unavailable` (SSE) 대응 기술
  - 상세: 두 이름이 다른 이유(SSE namespace 컨벤션)를 target §5.2 와 WS spec §6.2 양쪽에서 명시. 의도된 분기. 충돌 아님.
  - 제안: 없음.

- **[INFO]** `execution.ai_message` SSE 의 어시스턴트 텍스트 필드 — `message` vs WS 의 `text`
  - target 신규 식별자: §6.5 SSE wire 에서 어시스턴트 텍스트 필드를 `message` 로 지정
  - 기존 사용처: WS 이벤트가 `text` 필드를 사용할 수 있으며, target §6.5 에서 "SSE 는 `message` 를 읽어야 한다(`text` 필드 아님)" 로 주의 명시
  - 상세: 표면별 필드명 차이로 의도 명시됨. 충돌 아니나 SDK 구현 시 혼선 가능.
  - 제안: WS spec §4.4 와 EIA §6.5 에 서로 cross-ref 주석 추가.

### 5. 환경변수·설정키 충돌

- **[INFO]** `ALLOW_HTTP_HOOKS=1` — inbound·outbound 양방향 재사용이 target 에 미명시
  - target 신규 식별자: §3.1 EIA-NX-09 에서 notification outbound URL 의 `http://` 예외 조건
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/codebase/backend/src/common/utils/ssrf-safe-url.util.ts` L84 — 기존에 이미 inbound webhook URL 검증에 동일 env var 사용 중
  - 상세: 동일 env var 가 inbound(hooks URL 등록)와 outbound(notification URL 등록) 양쪽에서 `ssrf-safe-url.util.ts` 를 통해 작동한다. 기능적 오작동 없음. target 이 이 공유를 명시하지 않아 독자가 중복 선언으로 오해할 수 있음.
  - 제안: target EIA-NX-09 note 에 "동일 `ALLOW_HTTP_HOOKS` 가 inbound webhook URL 의 `http://` 허용도 제어" 1줄 추가.

- **[INFO]** `INTERACTION_JWT_SECRET` — 정의처 분산이나 충돌 없음
  - target 신규 식별자: §8.3 에서 정의 및 fallback 체인 명시
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/5-system/1-auth.md` L642, L645 — production guard 예외 사례로 ref 만 존재
  - 상세: target §8.3 이 권위. 충돌 없음.
  - 제안: 없음.

### 6. 파일 경로 충돌 — 없음

`spec/5-system/14-external-interaction-api.md` 는 `13-replay-rerun.md` 다음 자리이며, 기존 `14-` prefix 파일 없음. `N-name.md` naming convention 준수. 충돌 없음.

### 7. 에러 코드 잠재 혼동

- **[WARNING]** `VALIDATION_FAILED` — EIA REST 와 그래프 저장 컨텍스트 간 네임스페이스 비대칭
  - target 신규 식별자: §5.1 오류 표 `400 VALIDATION_FAILED` (submit_form field 검증 실패)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/conventions/cross-node-warning-rules.md` L96 — `GRAPH_VALIDATION_FAILED` (canvas 저장 검증 실패)
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/4-nodes/7-trigger/providers/slack.md` L116, `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/conventions/chat-channel-adapter.md` L428, L449 — EIA `VALIDATION_FAILED` 재인용
  - 상세: 이름이 완전 동일하지는 않으나(`GRAPH_VALIDATION_FAILED` vs `VALIDATION_FAILED`), prefix 없는 `VALIDATION_FAILED` 가 단독 사용되면 두 컨텍스트 혼동 가능. chat-channel-adapter.md 와 slack.md 는 이미 EIA 의 `VALIDATION_FAILED` 를 재사용하여 일관. 실제 코드 충돌은 아니나 명확성 보완 권장.
  - 제안: target §5.1 표 각주 또는 §R13 에 "`VALIDATION_FAILED` 는 EIA REST surface 전용이며 canvas 저장의 `GRAPH_VALIDATION_FAILED` 와 다른 컨텍스트임" 1줄 추가.

- **[INFO]** `TOKEN_AUDIENCE_MISMATCH` — data-flow spec 에만 존재, target 에 없음
  - target 신규 식별자: target §5.1 오류 표는 `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_SCOPE_MISMATCH` 를 나열. `TOKEN_AUDIENCE_MISMATCH` 없음.
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-recon-spechygiene-dc750a/spec/data-flow/15-external-interaction.md` L269 — `audience_mismatch→TOKEN_AUDIENCE_MISMATCH` 매핑 기술
  - 상세: data-flow spec 이 target 에 정의되지 않은 에러 코드를 언급. target 이 이 케이스를 `TOKEN_INVALID` 로 통합하는지 명확하지 않아 구현자 혼선 가능.
  - 제안: target §5.1 표에 `TOKEN_AUDIENCE_MISMATCH` 행 추가(또는 `TOKEN_INVALID` 로 통합됨을 note)하거나, data-flow L269 를 target 과 통일.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 가 도입하는 신규 식별자(요구사항 ID `EIA-*`, API endpoint `/api/external/executions/*`, SSE 이벤트 `execution.*`, 토큰 접두 `iext_`·`itk_`·`wsk_`, env var `INTERACTION_JWT_SECRET`, 타입명 `InteractionRequestContext` union 등)는 기존 다른 spec 에서 다른 의미로 사용된 사례가 없으며 CRITICAL·HIGH 등급 충돌은 없다. 다만 (1) `VALIDATION_FAILED` 코드가 EIA REST 와 canvas 저장의 `GRAPH_VALIDATION_FAILED` 사이에 네임스페이스 비대칭이 있어 명확화 권장(WARNING), (2) `TOKEN_AUDIENCE_MISMATCH` 가 data-flow spec 에만 존재하고 target 에 없어 에러 코드 목록 불일치(INFO), (3) `ALLOW_HTTP_HOOKS` 의 inbound·outbound 양방향 재사용이 target 에 미명시(INFO), (4) target §7.3 의 "별도 테이블 없음" 기술이 구현 현실(`execution_token` 테이블)과 불일치(INFO) 하다.

## 위험도

LOW
