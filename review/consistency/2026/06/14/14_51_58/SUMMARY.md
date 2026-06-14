# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — Warning 11건(cross-spec 4, convention 3, plan 3, naming 1). Critical 0건. 주요 이슈는 규약 불일치(api-convention §5.3 details shape, requestId 누락)와 선행 plan 미해소(spec-fix-eia-token-error-codes 3건)에 집중.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `TOKEN_SCOPE_MISMATCH` vs `SCOPE_MISMATCH` 코드명 불일치 | §5.1 에러 표 403행 | 커밋된 EIA spec §5.1 (`SCOPE_MISMATCH`) | 커밋 EIA spec §5.1의 `SCOPE_MISMATCH`를 `TOKEN_SCOPE_MISMATCH`로 정정 |
| W2 | Cross-Spec | scope_mismatch HTTP 상태코드 — data-flow/15는 401 컨텍스트, EIA spec은 403 | §5.1 `TOKEN_SCOPE_MISMATCH` 행 (403) | `spec/data-flow/15-external-interaction.md` §3.1 (401 그룹 나열) | data-flow/15 §3.1에서 scope_mismatch를 401 그룹에서 분리해 "403" 명시 |
| W3 | Cross-Spec | `TOKEN_REVOKED` / `TOKEN_AUDIENCE_MISMATCH` — EIA §5.1 에러 표에 누락 | §5.1 401행 (`TOKEN_INVALID`/`TOKEN_EXPIRED`만 나열) | `spec/data-flow/15-external-interaction.md` §3.1 (5종 정의) | §5.1 401행에 `TOKEN_REVOKED`, `TOKEN_AUDIENCE_MISMATCH` 추가 또는 data-flow/15 cross-ref 명시 |
| W4 | Cross-Spec | `execution.node.cancelled` — WS §4.6 권위 표에 있으나 EIA §5.2 SSE 목록에 누락 | §5.2 SSE 이벤트 목록 | `spec/5-system/6-websocket-protocol.md` §4.6 | §5.2에 `execution.node.cancelled` 추가; §11 매핑 표 동기화 |
| W5 | Convention | `details` 필드 shape 불일치 — 배열 대신 `{ fieldErrors: [...] }` 객체 | §5.1 에러 응답 예시, EIA-IN-10 | `spec/5-system/2-api-convention.md §5.3` (배열 shape 강제) | `details`를 배열로 수정하거나 EIA-specific 예외를 Rationale에 등록 |
| W6 | Convention | `requestId` 누락 — 모든 에러 응답 예시에 없음 | §5.1 에러 응답 예시 및 에러 표 전체 | `spec/5-system/2-api-convention.md §5.3` ("항상 포함" 강제) | 에러 응답 예시에 `"requestId": "..."` 추가 또는 EIA 예외를 Rationale에 명시 |
| W7 | Convention | `@ApiSecurity({})` 처방 — swagger 규약과 상충 | §10.1 Swagger/API 문서 마지막 줄 | `spec/conventions/swagger.md §2-1` (`@ApiSecurity({})` 대신 설명 명시 지침) | `@ApiSecurity({})` 제거 후 "hooks: `@Public()` 전용 — swagger.md §2-1 준수"로 수정 |
| W8 | Plan | 미결 plan `spec-fix-eia-token-error-codes.md` — `TOKEN_SCOPE_MISMATCH` 403 vs 구현 401 불일치(결정 2 미완료) | §5.1 403 `TOKEN_SCOPE_MISMATCH` 행 | `plan/in-progress/spec-fix-eia-token-error-codes.md` §2 (결정 2 체크박스 미완) | plan 결정 2 확정(권장: 옵션 A — 401 통일) 후 §5.1 갱신 |
| W9 | Plan | 미결 plan — `TOKEN_REVOKED` 행이 §5.1에 누락(결정 1 미완료) | §5.1 에러 표 (line 331–342) | `plan/in-progress/spec-fix-eia-token-error-codes.md` §1 (결정 1 체크박스 미완) | plan 결정 1 확정(권장: 옵션 A) 후 §5.1에 `TOKEN_REVOKED` 행 추가 |
| W10 | Plan | 미결 plan — terminal revoke fail-open 정책 §3.4/§9.3에 미명시(결정 3 미완료) | §3.4 신뢰성 표, §9.3 발송 순서 | `plan/in-progress/spec-fix-eia-token-error-codes.md` §3 (결정 3 체크박스 미완) | plan 결정 3 확정(권장: 옵션 C) 후 §3.4 + §9.3에 fail-open·잔여 위험 명시 |
| W11 | Naming | `VALIDATION_FAILED` — EIA REST와 `GRAPH_VALIDATION_FAILED`(canvas 저장) 간 네임스페이스 비대칭 | §5.1 오류 표 `400 VALIDATION_FAILED` | `spec/conventions/cross-node-warning-rules.md` L96 (`GRAPH_VALIDATION_FAILED`) | §5.1 각주 또는 §R13에 "`VALIDATION_FAILED`는 EIA REST 전용, canvas 저장의 `GRAPH_VALIDATION_FAILED`와 다름" 1줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `notification_secret_v2` — data-model은 "신규 secret", EIA §7.1은 "secretRef만 보관" | §7.1 / `spec/1-data-model.md` §2.8 | data-model §2.8 설명에 "(SecretStore ref — plaintext 미저장, EIA §7.1)" 추가 |
| I2 | Cross-Spec | Rationale R13 — 내부 REST `INVALID_STATE`(422)와의 관계 미기술 | draft R13 매핑 표 | R13에 "EIA REST 외부 표면 한정 — 내부 경로는 error-handling §1.3의 `INVALID_STATE`(422)" 각주 추가 |
| I3 | Cross-Spec | WS §4.6 매핑 표의 REST URL — `/api/executions/:id/...`(내부 prefix)로 잘못 표기 | `spec/5-system/6-websocket-protocol.md` §4.6 (target 아닌 인접 spec) | WS §4.6 열 헤더를 `/api/external/executions/:id/interact` 등으로 수정 |
| I4 | Convention | api-convention §5.3 기본 에러 코드와 EIA 커스텀 코드 관계 미명시 | §5.1 에러 표 도입부 | §5.1에 "EIA 에러 코드는 api-convention §5.3 기본값을 override" 한 줄 추가 |
| I5 | Convention | 문서 구조 — `## 본문` 헤더 없어 Overview/본문 경계 불명확 | 전체 구조 | 다음 개정 시 `---` 이후 `## 본문` 또는 `## 기술 명세` 헤더 삽입 고려 |
| I6 | Plan | `fix-webchat-sse-field-map.md` — 비차단 followup 잔여로 `pending_plans` 유지 중 | frontmatter `pending_plans` | 비차단 followup 처리 또는 보류 결정 명시 후 `pending_plans`에서 제거 가능 |
| I7 | Plan | `ai-agent-tool-connection-rewrite.md` §3 — 도구 이름 규칙 TBD, EIA §5.2 payload 동기화 후속 필요 | §5.2 `tool_call_*` 이벤트 | 해당 plan 결정 확정 시 EIA §5.2 `name` 필드 동기화를 plan §3 cross-ref로 추적 |
| I8 | Naming | target §7.3 "별도 테이블 없음" — 구현 현실(`execution_token` 테이블 V060)과 불일치 | §7.3 `InteractionToken` 절 | §7.3을 "jti는 `execution_token` 테이블(V060)에 영속 추적"으로 갱신 |
| I9 | Naming | §3.3.1 타입 분리 "v2 권고" — 이미 `interaction.guard.ts`에 구현됨 | §3.3.1 | §3.3.1 문구를 "구현됨 (`interaction.guard.ts`)"으로 갱신 |
| I10 | Naming | `TOKEN_AUDIENCE_MISMATCH` — data-flow spec에만 존재, target §5.1에 없음 | §5.1 오류 표 | §5.1에 `TOKEN_AUDIENCE_MISMATCH` 행 추가 또는 `TOKEN_INVALID` 통합임을 note |
| I11 | Naming | `ALLOW_HTTP_HOOKS` inbound·outbound 양방향 재사용 미명시 | §3.1 EIA-NX-09 | EIA-NX-09 note에 "동일 env var가 inbound webhook URL의 `http://` 허용도 제어" 1줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | Warning 4건 (에러 코드명 불일치, HTTP 상태코드 모순, 누락 에러코드, SSE 이벤트 누락) |
| Rationale Continuity | NONE | 기각 대안 재도입 없음, 합의 원칙 위반 없음, 무근거 번복 없음 |
| Convention Compliance | MEDIUM | Warning 3건 (details shape 불일치, requestId 누락, @ApiSecurity 처방) |
| Plan Coherence | LOW | Warning 3건 모두 `spec-fix-eia-token-error-codes.md` 미결 체크박스에서 기인 |
| Naming Collision | LOW | Warning 1건 (`VALIDATION_FAILED` 네임스페이스 비대칭), 나머지 INFO |

## 권장 조치사항

1. **(BLOCK 없음 — Warning 해소 우선순위)** `plan/in-progress/spec-fix-eia-token-error-codes.md` 결정 1·2·3을 각 권장 옵션(A/A/C)으로 확정한 뒤 EIA spec §5.1·§3.4·§9.3을 일괄 갱신한다 (W8/W9/W10 + W2/W3 동시 해소).
2. `details` 필드를 `api-convention §5.3` 배열 shape로 수정하거나 EIA-specific 예외를 Rationale에 등록하고, 에러 응답 예시에 `"requestId"` 필드를 추가한다 (W5/W6).
3. §10.1의 `@ApiSecurity({})` 처방을 `swagger.md §2-1` 준수 기술로 교체한다. 기존 구현 코드에 `@ApiSecurity({})` 가 있으면 구현 fix도 병행한다 (W7).
4. §5.2 SSE 목록에 `execution.node.cancelled` 추가 및 §11 매핑 표 동기화 (W4).
5. 커밋 EIA spec §5.1의 `SCOPE_MISMATCH`를 `TOKEN_SCOPE_MISMATCH`로 정정 (W1).
6. §5.1 각주 또는 §R13에 `VALIDATION_FAILED` vs `GRAPH_VALIDATION_FAILED` 구분 1줄 추가 (W11).
7. WS §4.6 매핑 표의 열 헤더 URL을 `/api/external/executions/:id/...`로 수정 (I3 — 인접 spec 문서 수정).
8. I1·I8·I9 (data-model secretRef 기술, §7.3 execution_token 반영, §3.3.1 타입 분리 상태 갱신)는 다음 개정 시 순서대로 처리.

---

## main Claude 후속 처리 (resolution, 2026-06-14)

> 본 consistency-check 는 **본 hygiene 작업 무관한 선존 EIA nit** 다수를 surface 했다. 본 PR(refactor-04 후속 B)은 그중 본 PR 가 직접 유발/교정 가능한 항목만 처리하고, 나머지는 owner plan/후속으로 분리한다.

- **W1/W2/W8/W9/W10 (EIA 토큰 에러 코드 정합)** → **본 PR 에서 §5.1 `SCOPE_MISMATCH`→`TOKEN_SCOPE_MISMATCH` 변경을 revert**. 이 영역(코드명 + HTTP status 403 vs 구현 401 + `TOKEN_REVOKED`/`TOKEN_AUDIENCE_MISMATCH` 추가 + terminal revoke fail-open)은 in-progress plan [`spec-fix-eia-token-error-codes.md`](../../../../../plan/in-progress/spec-fix-eia-token-error-codes.md) (planner owner, 결정 1/2/3 사용자 미확정) 의 단독 소유다. 본 hygiene PR 이 코드명만 바꾸고 status(403)를 그대로 두면 **구현(401)과 새 drift** 가 생기고 그 plan 의 결정 2 를 선점하므로, 전체를 그 plan 에 위임한다.
- **I2 (R13 내부 REST core 관계)** → **본 PR 반영**. R13 에 "외부 표면 한정 — 내부 REST core 는 error-handling §1.3 `INVALID_STATE`(422)" 범위 note 추가.
- **W3/W4/W5/W6/W7/W11 + I1/I3/I4/I8/I9/I10/I11** → 본 hygiene PR 범위 밖 **선존 EIA nit**. 변경하지 않음. 다수는 위 token-error-codes plan 또는 별도 EIA spec 정비 후속으로 처리 권장.
- **Rationale Continuity = NONE, BLOCK = NO** → push 진행.
