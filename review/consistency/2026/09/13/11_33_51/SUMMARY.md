# Consistency Check 통합 보고서

**BLOCK: YES** — naming_collision checker 가 발견한 CRITICAL 1건(가이드가 새로 인용한 에러 코드가 실제로 방출되는 코드가 아님) 때문에 차단.

## 전체 위험도
**HIGH** — 이 PR 자체가 고치려던 "가이드가 실재하지 않는/오귀속 에러 코드를 적는다" 결함 클래스가 새로 추가한 문장 한 줄(`MAKESHOP_UNRESOLVED_PATH_PARAM`)에서 재발했고, 신규 가드도 이를 못 잡는다. 나머지 4개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence)는 LOW~NONE 으로 이 CRITICAL 을 제외하면 전반적으로 수렴 상태.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `integrations.mdx`/`.en.mdx` 가 신규로 적은 `MAKESHOP_UNRESOLVED_PATH_PARAM` 이 실제 `output.error.code` 로 방출되지 않는다 — 이 실패 경로는 일반 `Error` 로 throw 되어(`IntegrationError` 아님) catch 단에서 기존 제네릭 fallback 코드 `INTEGRATION_CALL_FAILED` 로 귀결된다. 나란히 열거된 형제 3종(`MAKESHOP_UNKNOWN_OPERATION`/`MISSING_FIELDS`/`INVALID_SHOP_UID`)은 `IntegrationError` 로 던져져 실제로 맞지만, 이 넷째만 틀렸다. | `codebase/frontend/src/content/docs/02-nodes/integrations.mdx:303`, `integrations.en.mdx:292` (이번 diff 신규 추가) | `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:435-437`(일반 `Error` throw) → `makeshop.handler.ts:358-360` catch 분기 → `integration-handler-base.ts:146`(`INTEGRATION_CALL_FAILED`, 모든 Integration 노드 공용 fallback, `spec/4-nodes/4-integration/0-common.md §4.2`). 자매 `CAFE24_UNRESOLVED_PATH_PARAM`(`cafe24.handler.ts:453`)도 동형 결함이나 `cafe24.mdx` 는 이 이름을 인용하지 않아 노출되지 않았다. | (A) 가이드 문장을 실제 방출 코드 `INTEGRATION_CALL_FAILED` 로 정정하고 "이 코드는 이 실패에 고유하지 않은 공용 fallback" 이라는 설명을 덧붙인다(codebase/frontend 내부 수정, developer 권한 내). 또는 (B) `makeshop.handler.ts`/`cafe24.handler.ts` 의 해당 `throw new Error(...)` 를 `throw new IntegrationError('MAKESHOP_UNRESOLVED_PATH_PARAM', ...)` 로 바꿔 코드를 문서에 맞춘다(이 경우 `spec/4-nodes/4-integration/*` 영역 변경이 필요 — 별도 planner 턴). 아울러 신규 가드 `guide-error-code-scan.ts` 의 "backend 소스에 UPPER_SNAKE 문자열로 존재하는가" 판정 기준을 `.code:`/`IntegrationError(` 첫 인자 위치로 좁혀 `Error` 메시지 텍스트와 실제 `.code` 방출을 구분하도록 보강 권고. |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 옵션 (A)(가이드 텍스트 정정, `codebase/frontend` 내부)로 이번 PR 안에서 developer 가 직접 해소 가능하다 — spec/ 쓰기가 필요한 옵션 (B)는 대안일 뿐 필수 경로가 아니다. 따라서 이 표는 `(없음)`.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | MakeShop/Cafe24 도메인 에러 코드 카탈로그가 자기 코드베이스 대비 1종(`*_UNRESOLVED_PATH_PARAM`)을 누락 — 위 CRITICAL 과 같은 식별자가 spec §6 표에도 없다 | `spec/4-nodes/4-integration/5-makeshop.md §6`, `4-cafe24.md §6` | 실제 backend 코드(`MAKESHOP_UNRESOLVED_PATH_PARAM`/`CAFE24_UNRESOLVED_PATH_PARAM`, `grep` 확인) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 "§1 카탈로그 누락" 항목 범위를 `4-cafe24.md §6`/`5-makeshop.md §6` 갱신까지 명시적으로 확장(developer 권한 밖, BLOCK 사유 아님 — 위 CRITICAL 해소 시 이 코드의 정확한 의미/실제 방출 여부도 함께 정리 필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `MAKESHOP_CALL_FAILED`(MCP 도구 경로) vs `INTEGRATION_CALL_FAILED`(노드 실행 경로) — 이름이 비슷한 별개 제네릭 fallback 코드가 병존, 가이드에 구분 서술 없음 | `makeshop-mcp-tool-provider.ts:686` vs `integration-handler-base.ts:146` | 후속 편집에서 두 실행 표면(노드 vs AI Agent MCP 도구)의 코드 계열이 다르다는 한 줄 추가 고려. 이번 배치 필수 처분 아님 |
| 2 | convention_compliance | `user-guide-evidence.md §2`/§2.1/frontmatter `code:` 서술이 신규 가드 3건(`guide-error-code-scan.ts` 등) 반영 안 됨(3건→5건) | `spec/conventions/user-guide-evidence.md` | 이미 `spec-draft-nullable-notation-followups.md` 에 정확히 등재됨(frontmatter 목록 갱신 포함) — 다음 planner 턴에서 처리, 추가 조치 불요 |
| 3 | convention_compliance / cross_spec | `TestConnectionResultDto.code`(열린 string) / `ModelTestConnectionResultDto.message`(`nullable:true`+`\|null` 이지만 실제는 키-생략 패턴, §5.4 형태 불일치) | `integration-response.dto.ts`, `model-config-response.dto.ts` | 위반 아님/pre-existing. 다음에 해당 DTO 만질 때 `message?: string`(`\|null` 제거)로 정리하면 §5.4 와 합치. 조치 불요 |
| 4 | rationale_continuity | "결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙이 spec Rationale 에 아직 미문서화(JSDoc 에만 존재) | `llm.service.ts` `testConnection` JSDoc | 기존 planner 백로그에 정확히 승계됨(`7-llm-client.md`/`2-api-convention.md` Rationale 명문화 대기), 유실 없음 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 이번 라운드(`137784219`) 변경분은 §1.4/§6 카탈로그와 대부분 합치. 다만 도메인 카탈로그(§6)가 `*_UNRESOLVED_PATH_PARAM` 1종을 여전히 누락(WARNING, 기존 planner 항목 범위 확장 필요) |
| rationale_continuity | NONE | 신규 위반 없음. 은퇴 코드 재도입 없음, 결정 번복(`LLM_CONNECTION_ERROR`)은 취소선+반증 근거로 모범 처리. 선행 INFO 1건 유실 없이 승계 확인 |
| convention_compliance | NONE | `error-codes.md`/`node-output.md`/`swagger.md` 전부 준수. `user-guide-evidence.md` 가드 3→5건 서술 지연은 이미 planner 백로그 등재된 상태 |
| plan_coherence | NONE | 이전 라운드(`11_08_03`) WARNING(frontmatter `code:` 목록 누락) 실제 해소 확인. 라운드 3 신규 등재 2건 중복·충돌 없음 |
| naming_collision | **HIGH** | **CRITICAL**: 신규 가이드 문장 `MAKESHOP_UNRESOLVED_PATH_PARAM` 이 실제 방출 코드가 아니라 기존 제네릭 코드 `INTEGRATION_CALL_FAILED` 로 귀결 — 이 PR 이 고치려던 결함 클래스의 재발. 신규 가드는 "존재 검사"만 해 이를 못 잡음 |

## 권장 조치사항
1. **(BLOCK 해소)** `integrations.mdx`/`integrations.en.mdx` 의 `MAKESHOP_UNRESOLVED_PATH_PARAM` 서술을 실제 방출 코드(`INTEGRATION_CALL_FAILED`, 공용 fallback임을 명시)로 정정한다. 이 수정은 `codebase/frontend` 내부라 developer 권한 내에서 이번 PR 로 바로 처리 가능.
2. 같은 결함이 있는 자매 코드 `CAFE24_UNRESOLVED_PATH_PARAM`(`cafe24.handler.ts:453`)이 향후 `cafe24.mdx` 에 인용될 경우를 대비해, 이번 기회에 handler 레벨 결함(일반 `Error` throw)도 함께 인지해 두거나 별도 항목으로 등재한다.
3. `guide-error-code-scan.ts` 의 backend 토큰 수집 기준을 `.code:` 할당/`IntegrationError(` 첫 인자 위치로 좁혀, "문자열로 존재" 와 "실제 `.code` 로 방출" 을 구분하도록 보강한다(후속 harness 개선, 이번 CRITICAL 의 직접 처방은 아니지만 재발 방지).
4. WARNING(도메인 카탈로그 §6 누락)은 기존 `spec-draft-nullable-notation-followups.md` 항목의 처리 범위에 `4-cafe24.md §6`/`5-makeshop.md §6` 갱신을 명시적으로 포함시킨다(developer 권한 밖, 차단 사유 아님).
5. INFO 4건은 이미 정확히 planner 백로그에 등재돼 있거나 조치 불요 상태 — 추가 작업 없이 다음 정기 planner 턴에서 함께 처리.