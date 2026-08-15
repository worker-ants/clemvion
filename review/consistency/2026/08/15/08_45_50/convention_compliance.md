# 정식 규약 준수 검토 — spec/5-system/

## 방법론 노트

전달된 prompt bundle 은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md` 등
16개 파일과 `spec/conventions/**` 271개 파일 **전체**가 본문 없이 생략되어 있었다. 생략을
"위반 없음"의 근거로 삼지 않고, 관련 파일(`14-external-interaction-api.md` 전문,
`spec/conventions/swagger.md`, `error-codes.md`, `redis-keys.md`, `node-output.md` 등)을
저장소에서 직접 `Read` 해 대조했다. `spec/5-system/2-api-convention.md` ·
`6-websocket-protocol.md` 는 bundle 에 전문이 포함되어 있었다.

---

## 발견사항

- **[CRITICAL] 외부 노출 API 경로에 금지된 URL 버전 세그먼트 `/v1/` 혼입**
  - target 위치: `spec/5-system/14-external-interaction-api.md:1102` (§12 호환성)
    ```
    - Re-run API (`POST /api/v1/executions/:id/re-run`, [Spec Re-run](./13-replay-rerun.md)) 는 워크스페이스 JWT 전용. ...
    ```
  - 위반 규약: `spec/5-system/2-api-convention.md §1 기본 원칙` — "버전 | URL 경로에 포함하지 않음
    (Accept 헤더 또는 단일 버전 운영)". 같은 문서 §2.1/§2.2 의 URL 패턴·명명 규칙에도 버전
    세그먼트가 전혀 등장하지 않는다.
  - 상세: 실제 Re-run API 의 SoT 는 `spec/5-system/13-replay-rerun.md:38` 이며 거기서 계약은
    `POST /api/executions/:executionId/re-run` (버전 세그먼트 없음) 로 명시된다. 같은
    `14-external-interaction-api.md` 안에서도 바로 윗줄(§12:1101)은 "기존 `/api/executions/*`"
    라고 정확히 적으면서, 바로 다음 줄(1102)에서만 `/api/v1/executions/...` 로 잘못 적는
    자기모순이다. `spec/5-system/7-llm-client.md`·`_product-overview.md` 의 `/v1/` 는 OpenAI·
    Anthropic·OTel 등 **제3자 provider** URL이라 이 규약의 적용 대상이 아니지만, 본 라인은
    자사 API 를 가리키므로 규약이 그대로 적용된다. (`grep -rn "api/v1" spec/5-system/` 로
    전수 확인 — 자사 API 참조 중 이 1곳만 위반.)
  - 제안: `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run` 로 정정해
    `13-replay-rerun.md` 의 SoT 표기와 일치시킨다. 이 문서를 그대로 신뢰해 외부 연동을 구현하는
    독자가 존재하지 않는 엔드포인트(`/api/v1/...`)를 호출하도록 유도하는 결함이라 CRITICAL 로
    분류했다.

- **[INFO] `/api/external/*` 네임스페이스 접두가 §2.2 명명 규칙 표에 예시로 등재돼 있지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5 전역 (`/api/external/executions/:id/interact` 등)
  - 위반 규약: 없음 (참고용) — `spec/5-system/2-api-convention.md §2.2` 의 "예외 — RPC-style
    sub-channel action" 행이 이미 `/api/auth/workspaces/:id/switch` (네임스페이스 접두 + 자원 +
    id + 단일 action) 를 허용 예시로 들고 있어, `/api/external/executions/:id/{interact,cancel,
    stream,refresh-token}` 는 그 예외 패턴과 구조적으로 동일하다 — 실질 위반은 아니다.
  - 상세: 다만 §2.2 표의 예시 목록에 `external` 네임스페이스가 직접 등장하지 않아, 이 표만
    읽는 독자는 EIA 의 경로 구조가 예외에 해당하는지 스스로 유추해야 한다.
  - 제안: (선택) §2.2 예외 행의 예시에 `/api/external/executions/:id/interact` 한 줄을 추가하면
    독자가 유추할 필요가 없어진다. 강제 사항 아님.

---

## 요약

`spec/5-system/2-api-convention.md` · `6-websocket-protocol.md` · `14-external-interaction-api.md`
는 전반적으로 정식 규약을 신중하게 준수한다 — 문서 구조(도입부/본문/`## Rationale`), 에러 코드
`UPPER_SNAKE_CASE` 명명(`error-codes.md`), null-vs-키생략 구분과 그 근거 명시(§5.4,
`swagger.md §1-3`), Redis 키 형태·인벤토리 등재(`redis-keys.md`), Swagger DTO/래퍼 패턴
(`dto/responses/*-response.dto.ts` + `*.literal.ts`, 실제 코드로 확인)까지 규약과 실장이 촘촘히
교차 검증되어 있다. 다만 `14-external-interaction-api.md` §12 의 Re-run API 경로 표기가 자사
API 에 금지된 `/v1/` 버전 세그먼트를 담고 있고, 이는 같은 절 바로 위 줄·`13-replay-rerun.md`
의 SoT 표기와도 모순되는 명백한 오탈자성 위반이다. 이번 PR 이 실제로 다루는 변경 대상(EIA
종결 이벤트 `durationMs` 필드 추가, `plan/in-progress/eia-terminal-payload.md`)은 아직 spec 에
"미구현 (Planned)" 으로만 남아 있어 현재 시점 규약 위반은 없으나, 구현 시 §5.4 의 null 기본값
원칙(present-when-available 은 (a)/(b) 근거 명시 필수)을 그대로 따르는 것이 안전하다.

## 위험도

MEDIUM
