# Rationale 연속성 검토 — V-05 실행 상세 노드 서브탭 (`spec/2-navigation/`, --impl-done)

## 발견사항

- **[INFO]** R-3(LLM 탭 평탄화) 계승 확인 — 재사용 구현이 실제로 준수함을 코드로 검증
  - target 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (`NodeResultsTab`), 재사용 대상 `codebase/frontend/src/components/editor/run-results/result-detail.tsx`
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` `## Rationale` R-3 "LLM 탭을 단일 `LLM Information` 탭에서 최상위 평탄화로 바꾼 이유" — 이전 중첩 구조(`LLM Information` → `Response`/`Request`/`Usage` 하위 탭)는 명시적으로 폐기됨.
  - 상세: 이번 커밋(`a32327074`)은 실행 상세 페이지의 로컬 4탭(preview/input/output/error) 구현과 중복 waiting 핸들러 전체를 제거하고, 에디터 `ResultDetail` 컴포넌트를 그대로 import(`import { ResultDetail } from "@/components/editor/run-results/result-detail"`)해 우측 패널을 위임한다. `result-detail.tsx` 의 `detailTabs` 배열(L255-272)을 직접 확인한 결과, 노드 레벨에서는 `llm_usage` 탭 하나만(`aiNode && (!messageLevel || isAssistantSelected)`), 메시지 레벨(assistant 선택)에서는 `response`/`request`/`llm_usage` 최상위 탭이 노출되는 평탄화 구조가 그대로 구현돼 있다 — R-3 이 요구하는 구조와 정확히 일치. 폐기된 중첩 `LLM Information` 구조의 재도입은 없다.
  - 제안: 없음(계승 확인 완료). PR 설명(plan `V-05` 항목)에도 "재사용 방침으로 §3.4.2 R-3 평탄화 자동 상속" 이 명시돼 있어 후속 검토자가 근거를 추적할 수 있다.

- **[INFO]** R-1(목록 nodeExecutions 미포함)·R-4(Skipped 노드 제외) — 영향 없음, 회귀 없음 확인
  - target 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` L211-214 (`sortedNodeExecutions`), `spec/2-navigation/14-execution-history.md` `## Rationale` R-1·R-4
  - 과거 결정 출처: R-1(목록 API 는 배치 집계 3카운트만, `nodeExecutions` 본문 미포함 — 상세 API 전용), R-4(Skipped 상태 노드는 상세 좌측 목록에서 제외).
  - 상세: 이번 diff 는 상세 페이지 우측 노드-detail 패널만 교체했고, `sortedNodeExecutions = nodeExecutions.filter((ne) => ne.status !== "skipped")` (좌측 목록 필터링, R-4 이행부)는 diff 범위 밖에서 그대로 유지된다. 목록 페이지(`GET /api/executions/workflow/:workflowId`, R-1 경량 응답)와의 데이터 소스 혼선도 없음 — 상세 페이지는 여전히 `GET /api/executions/:id` 단건 조회만 사용한다. 신규 테스트(`execution-detail-waiting.test.tsx` V-05 케이스 2건)는 완결 AI/비-AI 노드의 Config·LLM Usage 탭 노출만 검증하며 R-1/R-4 관련 회귀는 발생하지 않았다.
  - 제안: 없음(선행 --impl-prep 검토의 우려가 실제로는 발생하지 않았음을 --impl-done 시점에 재확인).

- **[INFO]** Config 탭 신규 노출의 권한 전제 — 이전 검토의 가정("editor+ 게이트")은 부정확했으나, masking 메커니즘이 실질 위험을 이미 흡수
  - target 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L63-88 (`GET /executions/:id`, `@Roles` 데코레이터 없음) vs 동일 컨트롤러 L253 (`@Roles('editor')`, 다른 라우트); `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` L27-49 (`maskSensitiveFields` 적용)
  - 과거 결정 출처: 직전 `--impl-prep` 단계 rationale_continuity 리뷰(`review/consistency/2026/07/05/16_27_37/rationale_continuity.md`)의 INFO #3 — "실행 상세 페이지도 이미 `@Roles('editor')` 로 게이트되어 있어 권한 레벨 자체는 일치"라는 전제 하에 Config 탭 노출을 낮은 위험으로 평가.
  - 상세: 코드 직접 확인 결과 `GET /api/executions/:id`(이 페이지가 소비하는 단건 조회 엔드포인트)에는 `@Roles` 데코레이터가 없다 — `RolesGuard` 의 doc comment "`@Roles()`가 없는 라우트는 자동 통과 (default Allow)" 에 따라 **워크스페이스 멤버라면 `viewer` 역할도 접근 가능**하다. 즉 직전 impl-prep 리뷰가 전제한 "editor+ 게이트" 는 사실이 아니었고, 이번 V-05 로 신규 노출되는 Config 탭은 실제로는 `viewer` 역할에게도 열려 있다. 다만 `handler-output.adapter.ts` 의 `adaptHandlerReturn` 이 엔진 boundary(핸들러 리턴 직후)에서 `config` 필드에 `maskSensitiveFields`(apiKey/token/secret/password 등 키-이름 화이트리스트, `****<last4>`)를 **항상** 적용하고 있어 — DB 저장·WS emit·REST 응답 모두 이 마스킹을 거친 뒤의 값만 흐른다. 따라서 Config 탭이 노출하는 값은 역할 무관하게 이미 마스킹된 상태이며, viewer 접근이 가능하다는 사실 자체가 새로운 정보 노출을 만들지는 않는다 — Rationale 위반이라 보기 어렵다.
  - 제안: (a) `14-execution-history.md ## Rationale` 에 "Config 탭은 `GET /executions/:id`(역할 무관, 워크스페이스 멤버 전체 접근 가능)에 얹히며, 노출 안전성은 엔진 boundary 의 범용 `maskSensitiveFields`(핸들러 config echo 전수 마스킹)가 담당한다 — 페이지 자체의 role 게이트에 의존하지 않는다" 같은 한 문단을 명시적으로 추가할 것을 권고한다. 직전 impl-prep 리뷰가 근거로 든 "editor+ 게이트" 전제가 실제로는 틀렸으므로, 이 사실이 문서화되지 않으면 향후 다른 검토자가 같은 잘못된 전제를 반복할 위험이 있다. (b) 화이트리스트 기반 마스킹은 키 이름에 의존하므로, 커스텀 헤더 이름(예: `x-my-secret-value`)처럼 화이트리스트에 없는 키로 저장된 민감 값은 여전히 그대로 노출될 수 있다는 점은 이번 V-05 가 새로 만든 위험이 아니라 기존 마스킹 설계의 한계이므로 별도 트랙(발견 시 확인)으로 기록해도 무방하다.

## 요약

V-05(실행 상세 노드 서브탭 확장)는 직전 `--impl-prep` 검토가 예측한 대로 "에디터 `ResultDetail` 순수 재사용" 방침을 그대로 이행했으며, 코드 확인 결과 R-3(LLM 탭 평탄화, 중첩 `LLM Information` 구조 폐기)을 자동으로 계승하고 R-1(목록 API 경량화)·R-4(Skipped 노드 제외)와도 충돌하지 않는다. 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. 다만 Config 탭이 신규 노출되는 노드 상세 조회 엔드포인트(`GET /api/executions/:id`)는 실제로는 `@Roles` 게이트가 없어 `viewer` 역할도 접근 가능한데, 직전 impl-prep 검토는 이를 `editor+` 게이트로 잘못 전제했었다. 다행히 엔진 boundary 의 범용 `maskSensitiveFields` 가 역할과 무관하게 config 를 항상 마스킹하므로 실질적 정보 노출 위험은 낮지만, 이 안전성의 근거(role 게이트가 아니라 masking)가 spec Rationale 에 명문화돼 있지 않아 향후 오해의 소지가 있다 — WARNING 이 아닌 INFO 로 기록해 문서 보강을 권고한다.

## 위험도

LOW
