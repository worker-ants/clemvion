# 정식 규약 준수 검토 — External Interaction API (§7.5.1 대기 표면 매트릭스 PR)

- target: `spec/5-system/14-external-interaction-api.md`
- diff-base: `52f46f95f` → HEAD (worktree `elegant-driscoll-eebdd6`)
- 검토 범위 지시: error-codes 규약(기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 재사용, 신규 코드 없음), API 응답 shape(§5.3), client-safe message/serverDetail 분리(§7.5.2), spec-impl-evidence frontmatter 준수

## 결론 요약 (핵심 4항목)

| 항목 | 판정 | 근거 |
|---|---|---|
| error-codes 규약 — 신규 코드 없음 | **준수** | `assertCommandMatchesWaitingSurface` 는 신규 `InvalidExecutionStateError`(기존 `INVALID_EXECUTION_STATE`)만 throw. `interaction.service.ts#dispatchContinuation` 은 변경 없이 이를 기존 409 `STATE_MISMATCH` 로 매핑. `error-codes.md` §1/§2 상 신규 코드 신설 없음 |
| API 응답 shape (§5.3) | **준수** | `readErrorBody()`(hooks.service.ts) 가 읽는 `{ error: { code, message } }` 및 e2e `rejected.body.error.code` 단언 모두 `2-api-convention.md §5.3` 의 `{error:{code,message,requestId,details}}` 봉투와 일치 |
| client-safe message / serverDetail 분리 (§7.5.2) | **준수** | `InvalidExecutionStateError(detail?)` 생성자가 `super('Execution is not waiting for input.', detail)` — 신규 throw 3곳(`assertCommandMatchesWaitingSurface` 2곳 + 기존 0건/다건 케이스) 모두 노드ID·표면 정보를 **첫 인자(detail→serverDetail)** 로만 전달하고 `.message` 는 고정 문자열 유지. `dispatchContinuation` 도 `err.message`(고정값)만 client 에 전달. 신규 unit(`거부 메시지는 client-safe 고정 문자열...`)·e2e(`JSON.stringify(rejected.body)).not.toContain(form.id)`) 가 이를 회귀 가드 |
| spec-impl-evidence frontmatter | **준수** | `id: external-interaction-api`(kebab-case) · `status: partial` · `code:` ≥1 glob(실제 매치) · `pending_plans:` 1건, 대상 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 실존 + `worktree/started/owner` frontmatter 정상 |

핵심 4항목은 모두 규약을 준수한다. 다만 아래 2건은 이번 변경이 만든 **문서-코드 정합 갭**으로, "정식 규약이 요구하는 표/레지스트리가 실제 변경분을 반영하지 못한 상태"라는 점에서 WARNING 으로 별도 보고한다.

---

## 발견사항

- **[WARNING] §5.1 `STATE_MISMATCH` 행이 신규 "표면 불일치" 트리거를 반영하지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 (라인 341) — `409 Conflict | STATE_MISMATCH | 현재 노드/실행 상태와 명령 불일치 (예: completed 상태에서 submit_message, 또는 다른 nodeId)...`
  - 위반 규약: 해당 표는 `error-codes.md` §Overview "카탈로그·분류·트리거" 책임과 `2-api-convention.md §5.3` 이 요구하는 에러 카탈로그 완전성(각 코드가 언제 발생하는지)을 EIA 표면에서 문서화하는 권위 표다. Swagger 문서 규약(`swagger.md §5-5` 에러 응답 참조)상 API 문서와 spec 표는 같은 사실을 표현해야 한다.
  - 상세: 이번 diff 는 `interaction.controller.ts` 의 `@ApiConflictResponse` 설명을 `'STATE_MISMATCH (waiting_for_input 아님, 또는 명령이 현재 대기 노드의 인터랙션 표면과 불일치 — 예: Form 대기 중 end_conversation) 또는 IDEMPOTENCY_KEY_CONFLICT.'` 로 갱신해 신규 표면-불일치 케이스를 Swagger 표면에 반영했다. 그러나 target spec §5.1 의 `STATE_MISMATCH` 행 본문은 그대로이며 "표면 불일치"(form/buttons 대기 중 이종 명령 거부) 케이스를 전혀 언급하지 않는다. 동일 갭이 이 행이 인용하는 SoT [`4-execution-engine.md §7.5.1`](../../../spec/5-system/4-execution-engine.md) 표에도 있다 — 그 표는 여전히 "매칭 row 0건" / "매칭 row 2건 이상" 두 케이스만 나열하고, 코드 JSDoc 이 스스로 인용하는 "spec §7.5.1 — 변경 2.3. 아래 **세** 케이스는..." 의 세 번째 케이스(표면 불일치)가 §7.5.1 표에 없다. 즉 코드 주석이 가정하는 spec 상태와 실제 spec 본문이 어긋난다.
  - 제안: target §5.1 `STATE_MISMATCH` 행에 "표면(interactionType) 불일치 — 예: Form 대기 중 `end_conversation`" 사례를 추가하고, `4-execution-engine.md §7.5.1` 표에도 세 번째 행(표면 불일치 → `INVALID_EXECUTION_STATE`)을 추가해 코드 JSDoc·Swagger 설명·두 spec 표를 1:1 정합시킨다. (본 항목은 `4-execution-engine.md` 가 이번 checker 의 1차 target 범위 밖이라 별도 스코프로 처리 필요.)

- **[WARNING] `interaction-type-registry.md` 의 "4→3 통합 책임" 진술이 신규 3번째 사이트를 반영하지 못함**
  - target 위치: (간접) `spec/5-system/14-external-interaction-api.md` 가 의존하는 대기-표면 판정 로직 — 신규 `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 의 `resolveWaitingSurface()`
  - 위반 규약: `spec/conventions/interaction-type-registry.md §1.1` — "**내부 4값 ↔ EIA 외부 3값 매핑**: ... 이 4→3 통합은 **`chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses.dto.ts`) 계층의 책임**이다." 같은 문서 §1.2 는 "신규 enum 값은 본 문서 매트릭스에 반드시 등록한다" 는 원칙을 명시.
  - 상세: 신규 `resolveWaitingSurface()` 는 `interactionType === 'ai_conversation' || interactionType === 'ai_form_render'` 를 동일하게 `'ai_conversation'` 표면으로 흡수한다 — `interaction-type-registry.md §1.1` 이 규정한 "4→3 통합" 과 정확히 같은 판정을 **세 번째 위치**(`execution-engine/waiting-surface-guard.ts`, publisher 사전검증)에서 수행한다. 이 사이트는 `interaction-type-registry.md` 의 `code:` frontmatter 목록(`park-entry-dispatch.ts`/`resume-turn-dispatch.ts` 등은 이미 등재됨)에도, §1.1/§1.2 본문에도 등재돼 있지 않다. 코드 자체의 JSDoc·전용 회귀 테스트(`waiting-surface-guard.spec.ts` 의 "registry 대칭" describe)는 `resumeTurnRegistry`/`parkEntryRegistry` 와의 판정 일치를 unit 레벨에서 가드하고 있어 **동작 drift 위험은 낮지만**, 컨벤션 문서 자체는 "책임 소재가 chat-channel.dispatcher/EIA DTO 뿐" 이라고 단정해 stale 상태다. 이 규약 문서의 존재 목적이 "enum 처리 분기 사이트 누락 방지" 이므로, 신규 사이트 추가 시 §1.1/§1.2 갱신 또는 `code:` 등재가 규약 스스로의 요구사항이다.
  - 제안: `interaction-type-registry.md §1.1` 의 "4→3 통합 책임" 문장에 `execution-engine/waiting-surface-guard.ts`(publisher 사전 검증용 판정)를 세 번째 사이트로 추가하고, frontmatter `code:` 에도 경로를 등재한다. (본 항목도 대상 컨벤션 문서가 `14-external-interaction-api.md` 밖이라 별도 스코프.)

## 참고 — 확인했으나 문제 없음 (근거 기록용)

- `error-codes.md` §3/§5 예외 레지스트리에 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 신규 등재 불필요 — 두 코드 모두 기존 카탈로그 값 그대로 재사용, rename/신설 없음.
- Swagger 데코레이터 패턴(`@ApiConflictResponse` 설명 텍스트 갱신)은 `swagger.md §2-4` 범위 내 — 데코레이터 종류 자체는 변경되지 않았고 `description` 텍스트만 보강돼 패턴 위반 아님.
- 신규 파일 `waiting-surface-guard.ts`/`waiting-surface-guard.spec.ts` 는 `4-execution-engine.md` frontmatter `code: codebase/backend/src/modules/execution-engine/**` 글로브에 매치 — `spec-code-paths.test.ts` 가드 통과.
- target 문서 자체 구조는 CLAUDE.md 컨벤션대로 `## Overview` (L23) → 본문 → `## Rationale` (L917) 3섹션 유지, `0-`/`_product-overview.md` 등 명명 컨벤션과 무관(정규 spec 파일).
- 신규 e2e/unit 테스트가 클라이언트 응답에서 `nodeId`/표면 값 미노출을 직접 단언(`not.toContain(form.id)`, `err.message).not.toContain('n-wait')`) — §7.5.2 정보노출 차단 원칙을 코드 레벨에서 이중 검증.

## 요약

이번 변경(대기 표면 ↔ 명령 매트릭스, publisher 사전 검증)은 정식 규약이 명시한 **핵심 불변식 4가지**(에러 코드 재사용·API 에러 응답 봉투 shape·client-safe message/serverDetail 분리·spec frontmatter lifecycle)를 모두 정확히 준수한다 — 특히 `InvalidExecutionStateError` 생성자를 경유해 신규 진단 상세(노드ID·표면·명령)가 `serverDetail` 로만 흐르고 client `.message` 는 고정 문자열을 유지하도록 한 설계는 §7.5.2 정책의 모범적 적용이다. 다만 이번 diff 가 실제로 새로 만든 동작(표면 불일치 거부)이 target spec §5.1 의 에러 카탈로그 표와, 그 표가 인용하는 SoT(`4-execution-engine.md §7.5.1`)에 반영되지 않아 API 문서-spec 정합 갭이 남았고, 동일한 enum 흡수 로직이 `interaction-type-registry.md` 가 규정한 "책임 사이트" 밖에 새로 생겨 그 레지스트리 문서가 stale 하다. 두 건 모두 코드의 정합성(구현 자체·client 보안 경계)을 해치지 않는 문서 완전성 수준의 갭이라 WARNING 으로 등급했다.

## 위험도

LOW
