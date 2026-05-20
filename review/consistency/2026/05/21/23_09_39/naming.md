STATUS: WARN

## Critical

없음.

---

## Warning

### W-1: `POST /api/executions/:id/interact` vs `POST /api/executions/:id/interactions` — 이름 유사·경로 근접 충돌

- **target 신규 식별자**: `POST /api/executions/:executionId/interact`
  (EIA-IN-01, spec/5-system/14-external-interaction-api.md §5.1)
- **기존 사용처**: `POST /api/executions/:id/interactions`
  (`spec/data-flow/3-execution.md` line 102 — 내부 클라이언트가 FormData·버튼 인터랙션 결과를 제출하는 기존 엔드포인트)
- **상세**: 경로 끝이 `interact` vs `interactions` 로 s 하나 차이. 둘 다 같은 수준(`/api/executions/:id/`) 의 서브경로. 신규는 외부 토큰 인증 경로, 기존은 내부 JWT 인증 경로로 *인증 주체가 다르다*. 그러나 같은 HTTP method + 거의 동일한 경로이므로 구현자·API 문서 독자가 혼동할 위험이 높다. 특히 `data-flow/3-execution.md §1.3` 이 기존 `/interactions` 를 내부 클라이언트(워크플로우 에디터)의 폼 제출 경로로 명시하고 있어, 신규 외부 채널과 책임이 겹쳐 보인다.
- **제안**: 신규 외부 inbound endpoint 를 별도 prefix 로 분리. 예: `POST /api/external/executions/:id/interact` 또는 신규 컨트롤러를 내부 `executions` 컨트롤러와 다른 기반 경로 `/api/interact/executions/:id` 로 분리. 최소한 spec 본문에 기존 `/interactions` 와의 관계(대체인지 병존인지)를 명시해야 한다.

---

### W-2: `GET /api/executions/:id` 신규 정의 — 기존 동일 endpoint 와 응답 shape 상이

- **target 신규 식별자**: `GET /api/executions/:executionId` (EIA-IN-04, §5.3)
  — 응답: `{ id, workflowId, status, currentNode, context, result, error, seq, updatedAt }`
- **기존 사용처**: `GET /api/executions/:id`
  (`spec/3-workflow-editor/3-execution.md` line 294, `spec/2-navigation/14-execution-history.md` line 404)
  — 응답: `{ id, workflowId, status, startedAt, finishedAt, durationMs, nodeExecutions[], … }`
- **상세**: endpoint 경로와 HTTP method 가 완전히 동일하나 인증 주체(내부 JWT vs 외부 interaction token)와 응답 shape 이 다르다. 기존 스펙은 `nodeExecutions` 배열을 포함한 완전한 실행 상세를 반환하는 반면, 신규 정의는 외부 인터랙션 전용 필드(`currentNode`, `context`, `seq`)를 반환하는 경량 view 다. 동일 경로에 두 개의 응답 계약이 병존하면 구현 라우터가 인증 방식으로 분기해야 하는데, 이 분기 정책이 어느 spec 에도 명시되어 있지 않다.
- **제안**: (a) 외부 전용 endpoint 를 `/api/external/executions/:id` 또는 `/api/executions/:id/status` 같은 별도 경로로 분리, 또는 (b) 기존 endpoint 가 외부 토큰도 수용하고 응답 필드를 통합·확장한다는 방침을 신규 spec 에 명시. 12-webhook.md §12 "호환성" 절에 두 응답 shape 의 관계를 서술 추가 권장.

---

### W-3: `POST /api/executions/:id/cancel` 신규 정의 — 기존 `/stop` 과 의미 중복

- **target 신규 식별자**: `POST /api/executions/:executionId/cancel` (EIA-IN-05, §5.4)
- **기존 사용처**: `POST /api/executions/:id/stop`
  (`spec/3-workflow-editor/3-execution.md` line 295 — 에디터의 실행 중단 버튼)
- **상세**: 둘 다 실행을 종료하는 의미이나 endpoint 이름이 다르다(`cancel` vs `stop`). target spec §5.4 는 "alias" 라고 설명하지만 WS 명령 `execution.stop` 에 대응한다. 내부에서 `stop` 을 쓰고 외부에서 `cancel` 을 쓰는 것은 의도적인 split 이나, 내부 `/stop` 이 외부 토큰으로도 호출 가능한지 여부가 불명확하다. 코드베이스 `executions` 모듈에 `/stop` 경로가 이미 존재할 가능성이 높아 신규 `/cancel` 경로 등록 시 충돌 없이 병존 가능한지 확인 필요.
- **제안**: spec 에 `/stop` (내부 JWT 전용) 과 `/cancel` (외부 interaction token 전용) 의 관계를 명시. 또는 `/cancel` 이 내부 JWT 인증도 수용하는지 정책을 추가.

---

### W-4: `execution.replay_unavailable` (SSE) vs `replay.unavailable` (WS) — 네임스페이스 불일치

- **target 신규 식별자**: SSE event 이름 `execution.replay_unavailable`
  (`spec/5-system/14-external-interaction-api.md §5.2`, `spec/5-system/6-websocket-protocol.md §4.6` 매핑 표)
- **기존 사용처**: WebSocket 이벤트 타입 `replay.unavailable`
  (`spec/5-system/6-websocket-protocol.md` line 673, 677)
- **상세**: WS 채널에서는 `replay.unavailable` (언더스코어 없음, `replay.` prefix), SSE 채널에서는 `execution.replay_unavailable` (언더스코어 사용, `execution.` prefix). §4.6 매핑 표에서 이 불일치를 명시(`replay.unavailable → execution.replay_unavailable`)하고 있으므로 의도적이다. 그러나 "두 채널이 동일한 의미의 이벤트를 다른 이름으로 쓴다" 는 점은 클라이언트 코드에서 `execution.` prefix 를 붙이는 이벤트가 전부 WS 에도 동일명으로 있다는 기대를 깬다. 추후 유지보수 시 WS `replay.unavailable` 을 rename 하거나 이름을 통일할 이유가 발생할 수 있다.
- **제안**: WS spec §6.2 에 "`replay.unavailable` 의 외부 SSE 표면 이름은 `execution.replay_unavailable` 로 의도적으로 다름" 을 주석으로 추가(현재 §4.6 매핑에만 표기됨). 또는 WS 이벤트를 `execution.replay_unavailable` 로 rename 하여 두 채널을 통일.

---

### W-5: `POST /api/executions/:id/interactions` 기존 endpoint — target 과의 관계 미정의

- **target 신규 식별자**: EIA-IN-01 ~ EIA-IN-13 에서 정의하는 새 inbound 채널
- **기존 사용처**: `spec/data-flow/3-execution.md §1.3` line 102 의 `POST /api/executions/:id/interactions`
  — 내부 클라이언트(프론트엔드)가 form/button 결과를 제출하는 현행 API
- **상세**: 신규 target spec 은 기존 `/interactions` endpoint 의 존재를 언급하지 않는다. 두 endpoint 가 동일 `ExecutionEngineService` 의 continuation bus 를 거치는 동일 흐름으로 진입할 것으로 보이나, 이 관계가 spec 어디에도 없다. 구현 시 두 경로가 중복·혼합될 위험이 있다.
- **제안**: target spec §9.1 처리 흐름에 "내부 `/interactions` 경로는 기존 JWT 인증 클라이언트(에디터) 전용으로 유지되며, 본 spec 의 `/interact` 는 외부 interaction token 클라이언트 전용" 임을 명시.

---

## Info

### I-1: `EIA` prefix — 기존에 다른 용도로 사용되지 않음 (충돌 없음, 확장 여지 양호)

- target 이 도입하는 `EIA-NX-*`, `EIA-IN-*`, `EIA-AU-*`, `EIA-RL-*`, `EIA-NF-*` prefix 가 기존 spec 전체에서 `EIA` 로 시작하는 ID 를 사용하지 않음을 확인. 번호 범위(`EIA-NX-12` 까지)도 현재 12개를 초과하지 않아 미래 확장 여지 충분.

### I-2: `WH-RS-04`, `WH-MG-06`, `WH-MG-07` — 기존 WH-* 번호와 중복 없음

- 기존 `WH-RS-01~03`, `WH-MG-01~05`, `WH-SC-01~05`, `WH-EP-01~07`, `WH-NF-01~03` 에 `WH-RS-04`, `WH-MG-06`, `WH-MG-07` 은 포함되지 않아 번호 충돌 없음.

### I-3: 토큰 prefix `wsk_*`, `iext_*`, `itk_*` — 기존 토큰 family 와 충돌 없음

- `spec/5-system/1-auth.md` 의 Access Token / Refresh Token / invite token / WebAuthn optionsToken 등 어느 것도 `wsk_`, `iext_`, `itk_` prefix 를 사용하지 않음. 충돌 없음.

### I-4: DB 컬럼 `notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at` — 기존 Trigger 테이블과 충돌 없음

- `spec/1-data-model.md §2.8 Trigger` 의 현재 컬럼 목록에 `notification_*` 컬럼이 없음. 다른 plan 문서에서도 해당 컬럼 추가 사실 없음. 충돌 없음.
- 단, `spec/data-flow/8-notifications.md` 의 `user.notification_preferences` 컬럼과는 이름 공간이 다른 테이블이므로 의미 충돌 없음.

### I-5: `ALLOW_HTTP_HOOKS=1` — 기존 환경변수와 충돌 없음

- `spec/5-system/1-auth.md` 에서 정의된 `WEBAUTHN_*` 환경변수들과 이름 공간이 전혀 다름. `spec/5-system/4-execution-engine.md` 의 `MAX_NODE_ITERATIONS` 와도 충돌 없음. 기존 spec 전체에서 `ALLOW_HTTP_HOOKS` 를 사용하는 곳 없음.

### I-6: HTTP 헤더 `X-Clemvion-*` 계열 — 기존 `X-Hub-Signature-256` 과 네임스페이스 분리 명확

- `X-Hub-Signature-256` 은 인바운드 webhook 수신 시 외부 서비스(GitHub 등)가 보내는 헤더. `X-Clemvion-Signature` 는 서버가 아웃바운드 notification 발송 시 직접 서명하여 추가하는 헤더. 방향과 주체가 다르므로 혼동 위험 낮음. `X-Refresh-Token-Url` 은 기존 spec 어디에도 없는 신규 헤더.

### I-7: `codebase/backend/src/modules/external-interaction/` 신규 모듈명 — 기존 모듈과 충돌 없음

- 기존 모듈: `hooks`, `triggers`, `execution-engine`, `executions`, `websocket` 등 확인. `external-interaction` 이라는 이름의 기존 모듈 없음.

### I-8: `workspace_settings.notification_url_allow_pattern`, `interactionAllowedOrigins` 설정 키 — 기존 `settings` JSONB 키와 확인 필요

- `spec/1-data-model.md §2.2 Workspace.settings` 에 `timezone` 만 "알려진 키" 로 명시. 신규 키 `notification_url_allow_pattern` 과 `interactionAllowedOrigins` 는 Workspace.settings JSONB 에 추가될 키인데, spec 에서 JSONB 키 목록을 관리하는 규약이 없으므로 충돌 위험은 낮으나 데이터 모델 spec 에 신규 키 2개를 명시 추가하는 것을 권장.

### I-9: `spec/5-system/14-external-interaction-api.md` 파일 번호 — 현재 13까지 있음, 14는 다음 자리로 정상

- `spec/5-system/` 디렉토리에 `13-replay-rerun.md` 가 마지막. `14-external-interaction-api.md` 는 번호 연속성 기준으로 유효한 다음 자리.

---

## 요약

요구사항 ID prefix(`EIA-*`), 토큰 prefix(`wsk_*`/`iext_*`/`itk_*`), DB 컬럼 4개, 환경변수, HTTP 헤더, 모듈명, 파일 경로 모두 기존 식별자와 충돌하지 않는다. 위험은 API endpoint 수준에 집중된다: 신규 `POST /api/executions/:id/interact` 가 기존 `POST /api/executions/:id/interactions` 와 경로·method·의미가 근접하고, 신규 `GET /api/executions/:id` 가 기존 동일 경로와 응답 shape 이 다르며, 신규 `POST /api/executions/:id/cancel` 이 기존 `/stop` 과 의미가 겹친다. 이 세 endpoint 는 구현 시 라우터 충돌 또는 계약 혼동으로 이어질 수 있어 spec 에 명시적 관계 정의가 필요하다. SSE 이벤트 `execution.replay_unavailable` 과 WS 이벤트 `replay.unavailable` 의 네임스페이스 불일치는 의도적이나 주석 보완이 권장된다.

## 위험도

MEDIUM
