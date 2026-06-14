# Plan 정합성 검토 결과

## 발견사항

### [CRITICAL] target 이 미해결 결정(결정 2·결정 3)을 plan 합의 없이 일방적으로 역방향 반영
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표, §3.4 EIA-RL-06 행, §7.3, §9.3 EIA-RL-06 절, §Rationale R14/R15
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-fix-eia-token-error-codes.md` — 결정 2(§5.1 SCOPE_MISMATCH HTTP status/code 통일)·결정 3(terminal revoke 신뢰성 명시)
- **상세**:

  **결정 2 위반**: `spec-fix-eia-token-error-codes.md` 는 결정 2 에서 옵션 A(401 `TOKEN_SCOPE_MISMATCH` 로 통일, spec 을 코드에 맞춤)를 권장안으로 명시했다. target diff 는 그 반대 방향을 선택했다:
  - 기존 spec(이미 결정 2 옵션 A 를 반영한 상태의 텍스트): `401 Unauthorized | TOKEN_SCOPE_MISMATCH`·`401 Unauthorized | TOKEN_AUDIENCE_MISMATCH` 행 존재, R14 Rationale "모두 401 TOKEN_* prefix 로 통일" 채택 서술
  - target 이 실제로 변경한 내용: 위 두 행 삭제 + `403 Forbidden | SCOPE_MISMATCH` 행으로 교체 + R14 전체(401 통일 결정 근거) 삭제
  - 즉 target 은 plan 이 "권장 기각"으로 명시한 옵션 B(spec 의 403 `SCOPE_MISMATCH` 유지)를 plan 합의 없이 실행했다. plan 의 체크박스는 아직 미완료 상태다.

  **결정 3 위반**: `spec-fix-eia-token-error-codes.md` 결정 3 은 옵션 C(fail-open·잔여 위험 명시, doc-only)를 즉시 반영하고 옵션 A(outbox 전환)를 후속 plan 으로 분리하는 것을 권장했다. target diff 는 반대 방향을 선택했다:
  - `EIA-RL-06` 행 전체 삭제(§3.4 표에서)
  - §9.3 `Terminal token revoke 의 at-least-once` 절 전체 삭제(execution_token 기반 reconciliation sweep 2경로 설계 포함)
  - §7.3 `execution_token` 테이블 영속 추적 설명 삭제
  - §10 `terminal-revoke-reconciler.service.ts` 파일 항목 삭제
  - R15(execution_token reconciliation 결정 근거) 전체 삭제
  - 결과적으로 target 은 "execution_token 테이블 존재 + reconciliation sweep 구현" 자체를 spec 에서 지웠다. plan 이 "옵션 C 반영"을 권장했는데 실제로는 해당 절을 통째로 삭제했다.

  **TOKEN_REVOKED 누락**: 결정 1 은 §5.1 에 `TOKEN_REVOKED` 행 추가를 권장(옵션 A, 전원 동의 방향)했으나 target diff 에서 `TOKEN_REVOKED` 행이 삭제된 상태다(기존 spec 에 이미 존재했던 행이 제거됨).

- **제안**: target 을 병합하기 전에 `spec-fix-eia-token-error-codes.md` 의 결정 2·결정 3 을 사용자(또는 담당 project-planner)가 공식 합의해야 한다. 합의 방향이 target 과 같다면 plan 의 권장안을 역방향으로 재기록하고 체크박스를 완료 처리해야 한다. 합의 방향이 plan 의 권장안(401 통일 + EIA-RL-06 문서화)이라면 target 을 되돌리고 plan 에 따라 재작성해야 한다.

---

### [CRITICAL] target 이 구현된 reconciliation 인프라를 spec 에서 삭제 — spec-code 드리프트 역방향 심화
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §7.3, §9.3, §10 파일 구조
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **상세**: target diff 는 §9.3 의 `terminal revoke reconciliation` 설계 설명 전체와 §10 에서 `terminal-revoke-reconciler.service.ts` 항목을 제거했다. `spec-sync-external-interaction-api-gaps.md` 는 미구현 항목을 추적하고 있으나, `terminal-revoke-reconciler.service.ts` 의 존재가 spec 에서 지워지면 spec-code 드리프트가 역방향으로 새로 생성된다. 해당 파일이 코드베이스에 존재한다면 spec 제거는 "미구현" 이 아니라 "spec 이 구현을 누락한" 새 갭이다.
- **제안**: `terminal-revoke-reconciler.service.ts` 의 코드베이스 실존 여부를 확인하고, 존재한다면 §10 항목 복원 + §9.3 절 복원(또는 Planned 로 표시). plan `spec-sync-external-interaction-api-gaps.md` 에 새로 발생한 드리프트를 반영해야 한다.

---

### [WARNING] §3.3.1 "타입 분리 권고(v2 이후)"로 격하 — 구현 완료 서술과 불일치, plan 결정 없음
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.3.1 ("v1 구현 완료" → "타입 분리 권고 (v2 이후)")
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-fix-eia-token-error-codes.md`
- **상세**: 기존 §3.3.1 은 "v1 구현 완료"로 명시하여 ExternalInteractionRequestContext/InternalInteractionRequestContext union + isInternalCtx() 가 interaction.guard.ts 에 있음을 주장했다. target 은 이를 "v2 이후 권고"로 격하했다. plan `spec-fix-eia-token-error-codes.md` 어디에도 §3.3.1 구현 완료 표기를 권고/미구현으로 변경하는 결정이 없다. 이는 결정 2(guard 코드 401/403 분기) 와 연동될 수 있어 plan 선행 합의가 필요하다.
- **제안**: 코드베이스에서 interaction.guard.ts 의 union 타입 실제 상태를 확인하고, 구현 완료라면 spec 을 복원하거나, 미구현으로 변경됐다면 그 배경을 plan 에 기록 후 spec 을 수정해야 한다.

---

### [WARNING] EIA-IN-10·§5.1 validation 에러 코드·shape 변경 — plan 결정 없음
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.2 EIA-IN-10, §5.1 에러 표, §9.1 step 11d
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-fix-eia-token-error-codes.md`, `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **상세**: target 은 `VALIDATION_ERROR` → `VALIDATION_FAILED`, `details[]` 배열 → `details.fieldErrors[]`, `{ field, message, code }` → `{ field, reason, expected, actual }` 로 에러 코드·페이로드 shape 를 전면 변경했다. 두 plan 어디에도 이 변경에 대한 결정·체크박스·권장안이 없다. API 규약 §5.3 의 기본값(`VALIDATION_ERROR`·`details[]`)과도 이탈한다. 외부 클라이언트(channel-web-chat, 외부 SDK)에 직접 영향을 주는 wire 변경이다.
- **제안**: `spec/5-system/14-external-interaction-api.md` 의 변경 근거를 plan 에 기록하거나(project-planner 트랙), 기존 형식을 유지하고 구현에 맞추는 방향으로 재검토해야 한다. `spec-sync-external-interaction-api-gaps.md` 에 구현 완료 여부 표기 필요.

---

### [WARNING] §5.2 SSE 이벤트 목록에서 `execution.node.cancelled` 제거 — §11 표와 불일치
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.2 SSE 이벤트 종류 목록
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **상세**: target 이 SSE 이벤트 종류 목록에서 `execution.node.cancelled` 를 제거했으나, §11 이벤트 매핑 표에는 `execution.node.cancelled` 가 여전히 존재한다. spec 내 두 절 간 불일치가 발생했다. plan 에 이 이벤트 제거에 대한 결정이 없다.
- **제안**: §5.2 목록과 §11 표를 일치시켜야 한다. plan `spec-sync-external-interaction-api-gaps.md` 에 이벤트 제거 여부 결정을 기록해야 한다.

---

### [INFO] spec/1-data-model.md·spec/2-navigation/6-config.md 변경 — 후속 developer 구현 plan 미생성
- **target 위치**: `spec/1-data-model.md` §2.13 Execution 컬럼(source_ip/response_code V096), `spec/2-navigation/6-config.md` §A.3, R-6
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/auth-config-webhook-followups.md` §3
- **상세**: V096 마이그레이션·source_ip/response_code 컬럼 추가·periodCounts 구현을 spec 에 반영했으나, 이를 직접 추적하는 developer 구현 plan 이 없다. `auth-config-webhook-followups.md` §3 는 spec 보완 항목을 project-planner 위임으로 열거했으나 spec 이 먼저 갱신된 상황이다.
- **제안**: `auth-config-webhook-followups.md` §3 에 V096 spec 변경 완료 체크 + 후속 developer 구현(마이그레이션·getUsage periodCounts·sourceIp/responseCode 저장) 필요 항목을 체크리스트로 추가 권장.

---

## 요약

target 은 `plan/in-progress/spec-fix-eia-token-error-codes.md` 가 "결정 필요" 또는 "권장안 확정"으로 남긴 세 가지 핵심 결정(①TOKEN_REVOKED 추가, ②SCOPE_MISMATCH 401 통일 vs 403, ③terminal revoke 신뢰성 문서화)에 대해 plan 합의 없이 일방적으로 반대 방향 결정을 spec 에 반영했다. 결정 2 는 plan 에서 권장·채택된 R14(401 통일)와 TOKEN_SCOPE_MISMATCH/TOKEN_AUDIENCE_MISMATCH 행을 삭제하고 403 SCOPE_MISMATCH 로 되돌렸고, 결정 3 은 plan 이 "옵션 C 문서화 + 옵션 A 후속 plan"을 권장했음에도 EIA-RL-06·§9.3 reconciliation·R15 전체를 삭제하는 반대 방향을 취했다. 추가로 VALIDATION_ERROR→VALIDATION_FAILED shape 변경과 execution.node.cancelled 이벤트 제거는 어느 plan 에도 결정 기록이 없는 미해결 항목이다. 병합 전에 spec-fix-eia-token-error-codes.md 의 미완료 체크박스들을 사용자 합의로 먼저 확정해야 한다.

## 위험도

CRITICAL
