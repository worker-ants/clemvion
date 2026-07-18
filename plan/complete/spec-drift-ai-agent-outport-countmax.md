---
worktree: zealous-benz-96022b
started: 2026-07-16
owner: project-planner
spec_impact:
  - spec/4-nodes/_product-overview.md
  - spec/4-nodes/3-ai/_product-overview.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/4-nodes/3-ai/0-common.md
  - spec/4-nodes/4-integration/4-cafe24.md
  - spec/2-navigation/4-integration.md
  - spec/0-overview.md
---

# Spec drift — AI Agent: multi-turn `out` 포트 + `AI_AGENT_TOOL_COUNT_MAX` vs 카탈로그

> **성격**: `spec/` 내부 자기모순 2건 (코드가 아니라 spec 문서끼리 어긋남). project-planner 가
> 실제 코드 동작을 SoT 로 확정 후 한쪽 spec 을 정정해야 한다. **durable 추적 앵커** — 원래
> `ai-agent-tool-payload-budget-followups.md`(PR #955·후속 W4/W2)의 backlog 로만 적혀 있었으나,
> 그 plan 이 complete 로 이동하면 유일한 durable 텍스트가 소실되므로(consistency plan_coherence
> 4회 연속 WARNING) 별도 in-progress 앵커로 분리한다. 최초 발견: consistency `--impl-prep`
> 10:41 → 12_22_49 → 13_55_11 → 14_46_28 cross_spec Critical.

> ephemeral task 참조: `task_3ac39ebd` (session-scoped, 재시작 시 소실 가능 — 본 문서가 durable SoT).

## Critical 1 — Multi Turn `out` 포트 유무가 요구사항 vs 기술 spec 정반대

- `spec/4-nodes/3-ai/1-ai-agent.md:216` "Multi Turn 모드에는 **`out` 포트가 존재하지 않는다**", `:231-232` (조건 0개 multi_turn 의 `out` 엣지 dangling 처리 — 마이그레이션 절)
- vs `spec/4-nodes/3-ai/_product-overview.md:84` (ND-AG-24 "조건 0개 시 `out` + `error` 제공 (하위 호환)"), `spec/4-nodes/_product-overview.md:215` (동일 ND-AG-24 "하위 호환") — **정반대 서술**
- [x] 처분 **완료 (2026-07-18)**: 코드 SoT 양축 확정 — frontend `resolve-dynamic-ports.ts`(`aiAgentConditionalPorts` 0-조건 multi_turn = `user_ended`/`max_turns`/`error`, `out` 미발행; 테스트 `resolve-dynamic-ports.test.ts`) + backend `ai-turn-executor.ts` `multiTurnPortForEndReason`(`out` 미귀결) → **기술 spec §3.2 정본 확정**. (a) 두 `_product-overview.md` ND-AG-24 의 "조건 0개 하위호환 out" 문구 삭제(조건 0개도 `out` 없음), `1-ai-agent.md §12.17` Rationale 에 근거(=미실현 잔재 삭제, 번복 아님) 명문화. consistency `--spec`(12_26_31) BLOCK:NO 통과. `1-ai-agent.md` frontmatter `pending_plans` 에서 본 plan 제거(→ `node-output-redesign/ai-agent.md` 로 대체).

## Critical 2 — `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24/MakeShop 기본 연결 상시 초과

> **✅ 해소 (2026-07-17)** — 처분 (1)(2)(3) 전부 이행. 아래 체크박스 참조.
>
> **사용자 결정 (2026-07-17)**: **경고 명문화만** 한다 — `AI_AGENT_TOOL_COUNT_MAX` **기본값 조정·런타임 변경은 하지 않는다**. 근거: bytes(`AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`)가 실 안전망이고 count 는 2차 sanity cap 이라 count 상향의 실익이 제한적이며, allowlist 사용이 payload·도구 선택 정확도 양쪽에서 정상 사용 방식이기 때문. (기본값 자체의 타당성 재검토는 필요 시 별건 plan.)
>
> **⚠ 본 plan 의 수치 오류 정정 (2026-07-17)**: 아래 처분 (1) 원문은 "실제 카탈로그 수(**383**)로 정정" 이라 적었으나 **383 은 카탈로그 총량이 아니다** — 2026-07-13 장애 당시 **그 계정의 granted scope 로 필터된** 실측치다. 카탈로그 총량은 **485** 이며(3중 교차검증: 카탈로그 `supported` 행 = 백엔드 metadata operation = `catalog-sync.spec.ts` 양방향 강제, + `cafe24-api-catalog/_overview.md` §5 Coverage Matrix 합계가 독립 4번째 확인), 485(카탈로그 상한)와 383(계정별 실측)은 **레이어가 다르다**. spec 에는 485 를 기재했다.

- `spec/4-nodes/3-ai/1-ai-agent.md:329` (기본 128, 초과 시 hard 취급), `:1346` (§12.15 Rationale, Cafe24 383개 실측 ← granted-scope 필터값)
- vs `spec/0-overview.md` §6.1 (79-80, "모두 구현 완료"), `spec/4-nodes/4-integration/4-cafe24.md:29`·`:446` ("~180")
- [x] 처분 (1): `4-cafe24.md` "~180" → 실제 카탈로그 수로 정정 또는 집합 차이 명시. **완료** — `4-cafe24.md:29`(지원 범위)·`:446`(Rationale) 을 **485**/"카테고리당 평균 ~27" 로 정정 + §Rationale 에 3중 교차검증 근거·측정 주의(`grep -c` 오차)·383 vs 485 레이어 구분 기록. **checker 가 화석 2곳을 추가 발견**해 함께 정정: `spec/2-navigation/4-integration.md:1110`, `spec/4-nodes/3-ai/0-common.md:63` (그대로 뒀으면 spec 안에 485 와 ~180 이 공존).
- [x] 처분 (2): `1-ai-agent.md` §1/§2 에 "Cafe24/MakeShop 은 기본값 초과 → allowlist 설정 사실상 필수" 경고 명문화. **완료** — 본체 경고는 예산 표 바로 아래 **§4.2**(예산 SoT 절)에 두고, **§1 `mcpServers` config 행에 교차링크 1줄**을 넣어 설정 시점 discoverability 를 확보했다. *(원 처분이 지정한 §1/§2 대신 §4.2 를 본체로 택한 이유: 경고의 근거가 되는 예산 표·에러코드가 §4.2 에 있어 중복 서술 없이 한 곳에서 유지되고, §1 은 config 필드 표라 긴 서술을 담기에 부적합. consistency `00_35_59` plan_coherence WARNING#3 지적 반영 — 링크로 discoverability 는 보존.)*
- [x] 처분 (3): `spec/0-overview.md` §6.1 "구현 완료" 서술에 제약 각주. **완료** — Cafe24 행에 규모(485) 병기 + **§4.2 경고로의 제약 각주** 동반(규모만 병기하면 §6.1 만 읽고 제약을 알 수 없다는 plan_coherence WARNING#2 반영). MakeShop 행(161 > 128)도 동일 제약이라 **대칭 추가**.

## 범위 밖 (별도 task)

- `task_07c120ce` — `LlmService.embed()` withTimeout leak (item B chat fix 와 동형). 코드 결함이라 본 spec-drift 와 무관.

## Rationale

W4/W2 리팩터(`operation-tool-schema.ts` 공유 추출)는 이 두 drift 와 무관하지만, 그 작업의 consistency 게이트가 반복 노출시켰다. 코드 변경 없이 spec 문서만 정정하는 project-planner 작업이므로 developer 구현 PR 과 분리해 durable 추적한다.
