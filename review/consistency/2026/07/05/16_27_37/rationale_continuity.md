# Rationale 연속성 검토 — V-05 실행 상세 노드 서브탭 (`spec/2-navigation/`, --impl-prep)

## 발견사항

- **[INFO]** R-3(LLM 탭 평탄화) 은 위반이 아니라 오히려 재사용 대상 컴포넌트가 이미 준수 중 — 명시적 확인만 필요
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3/§3.4/§3.4.2 (EH-DETAIL-03)
  - 과거 결정 출처: 동 문서 `## Rationale` R-3 "LLM 탭을 단일 `LLM Information` 탭에서 최상위 평탄화로 바꾼 이유" (이전 구조 = 단일 `LLM Information` 탭 아래 `Response`/`Request`/`Usage` 서브탭 — 이 중첩 구조는 명시적으로 폐기됨)
  - 상세: V-05 구현 계획(`plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 "코드 구현" 옵션)은 실행 상세 페이지의 `NodeResultsTab` 을 에디터 `result-detail.tsx` 의 탭 구성과 정렬(공용 재사용)하는 방향이다. 코드 확인 결과 `codebase/frontend/src/components/editor/run-results/result-detail.tsx` 는 이미 R-3 이 요구하는 평탄화 구조(`Response`/`Request`/`LLM Usage` 를 최상위 탭으로, 노드 레벨에서는 `LLM Usage` 하나만 노출)를 구현하고 있다 (`detailTabs` 배열, `tabResponse`/`tabRequest` i18n 키 등). 따라서 이 컴포넌트를 그대로 실행 상세 페이지에 재사용하면 R-3 의 합의(단일 `LLM Information` 중첩 탭 폐기)를 자동으로 계승하게 되어 재도입 위험은 낮다. 다만 구현자가 "재사용" 대신 유사 UI 를 처음부터 새로 작성(재구현)하는 경로를 택할 경우, 과거에 폐기된 "단일 LLM Information 탭 + 하위 Response/Request/Usage" 구조를 모르고 다시 만들 위험이 있다.
  - 제안: 구현 착수 시 "새로 만들지 말고 `result-detail.tsx` 를 재사용/공용화" 라는 plan 의 결정을 실제 구현 PR 설명·커밋 메시지에도 남겨, 리뷰어가 R-3 준수 여부를 재확인할 수 있게 한다. 별도 spec 수정 불요(이미 SoT 가 명확).

- **[INFO]** R-4(Skipped 노드 제외)·R-1(목록 nodeExecutions 미포함) 은 V-05 재사용 범위 밖 — 회귀 방지용 확인 포인트로만 기록
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3, `## Rationale` R-1·R-4
  - 과거 결정 출처: 동 문서 R-1 (목록 API 는 배치 집계 3카운트만, `nodeExecutions`/`executionPath` 본문 미포함), R-4 (Skipped 노드는 상세 좌측 목록에서 제외)
  - 상세: V-05 는 상세 페이지 우측 패널(노드별 서브 탭)만 확장 대상이다. 좌측 노드 목록의 Skipped 필터링 로직이나 목록 페이지 API 계약과는 무관하므로 직접 충돌 가능성은 낮다. 다만 `result-detail.tsx` 재사용 시 해당 컴포넌트가 기대하는 node 데이터 shape(에디터의 실행 컨텍스트 store 기반)과 실행 상세 페이지가 REST `GET /api/executions/:id` 로 받는 `nodeExecutions` shape 가 다를 수 있어, 공용화 리팩토링 과정에서 실수로 Skipped 노드 필터링 로직이 흐트러지거나 목록 API 호출 경로가 잘못 재사용될 여지는 남아있다.
  - 제안: 구현 시 (a) 좌측 노드 목록은 여전히 상세 API(`GET /api/executions/:id`)의 `nodeExecutions` 기반이며 목록 페이지 배치 집계 API 를 사용하지 않음을, (b) Skipped 필터링이 공용화 후에도 유지됨을 각각 회귀 테스트로 고정할 것을 권고(신규 Rationale 불요 — 기존 R-1/R-4 범위 내 유지 확인).

- **[INFO]** Config 탭 노출 시 role 기반 접근 통제 정합 — Rationale 자체 충돌은 아니나 결정 근거 부재
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3 ("Config" 서브 탭), `codebase/backend/src/modules/executions/executions.controller.ts` (`@Roles('editor')` on 상세 조회)
  - 과거 결정 출처: 없음(신규 표면) — `spec/3-workflow-editor/1-node-common.md` R-2(2-트랙 설정 폼) 는 에디터 컨텍스트(`editor+`)를 전제로 함
  - 상세: `result-detail.tsx` 의 Config 탭은 에디터 컨텍스트(이미 `editor+` 권한 사용자)에서 노드 config 를 마스킹 없이 그대로 노출한다. 실행 상세 페이지도 이미 `@Roles('editor')` 로 게이트되어 있어 권한 레벨 자체는 일치하지만, 이 정합은 명시적 Rationale 로 기록된 적이 없다 — 이번이 Config 탭이 "실행 결과 조회" 표면(원래 read-only 성격이 강한 실행 이력 화면)으로 처음 확장되는 사례다.
  - 제안: 구현 완료 후 `14-execution-history.md` `## Rationale` 에 "Config 탭은 에디터와 동일 권한(`editor+`) 전제 하에 노출되며 별도 마스킹을 적용하지 않는다 — 접근 권한이 이미 config 편집 권한과 동일 레벨이므로" 식의 짧은 근거를 남기는 것을 권고(CRITICAL/WARNING 은 아니며, 향후 낮은 권한(viewer)에게 실행 이력 페이지를 개방할 계획이 생길 경우를 대비한 사전 기록).

## 요약

V-05(실행 상세 페이지 노드 서브탭 확장)는 "에디터 `result-detail.tsx` 공용 재사용" 이라는 plan 의 명시된 방향대로 진행되는 한, 과거 Rationale — 특히 §3.4.2 관련 R-3(LLM 탭 평탄화, 중첩 `LLM Information` 구조 폐기) — 을 위반하지 않는다. 오히려 재사용 대상 컴포넌트 자체가 이미 R-3 이 요구하는 평탄화 구조를 구현하고 있어, 순수 재사용이라면 과거 결정이 자동으로 계승된다. R-1(목록 API 경량화)·R-4(Skipped 노드 제외)는 이번 작업 범위(우측 상세 패널) 밖이라 직접 충돌 가능성이 낮으나, 컴포넌트 통합 과정에서 데이터 소스가 뒤섞이지 않도록 회귀 테스트로 고정할 필요가 있다. Config 탭의 권한 정합은 신규 결정이라 짧은 Rationale 보강을 권고하나 차단 사유는 아니다. 전반적으로 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다.

## 위험도

LOW
