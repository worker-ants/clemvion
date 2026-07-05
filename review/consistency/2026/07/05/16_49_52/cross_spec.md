# Cross-Spec 일관성 검토 — V-05 (execution-detail page → ResultDetail 재사용)

검토 대상 diff: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (origin/main...HEAD)
관련 spec: `spec/2-navigation/14-execution-history.md` §3.3/§3.4 (EH-DETAIL-03) vs `spec/3-workflow-editor/3-execution.md` §10.6.1 (Run Results Drawer)

## 발견사항

- **[WARNING]** ResultDetail 재사용으로 execution-detail 페이지가 신규 노출하는 탭(`meta`/`port`/`status`/`references`)이 두 관련 spec 어디에도 문서화되어 있지 않음
  - target 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (V-05 주석 블록, `<ResultDetail ... />` 호출부, 옛 `DetailTab = "preview"|"input"|"output"|"error"` 타입·자체 탭바 삭제)
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` §3.3 노드 결과 패널("서브 탭(노드 레벨): Preview / Input / Output / LLM Usage(AI 전용) / Config / Error") 및 EH-DETAIL-03("Preview / Input / Output / Config / Error. AI 노드는 LLM Usage 탭 추가") · `spec/3-workflow-editor/3-execution.md` §10.6.1 탭 표(Preview/Input/Output/Response/Request/LLM Usage/Config/Error)
  - 상세: 실제 `ResultDetail` 컴포넌트(`codebase/frontend/src/components/editor/run-results/result-detail.tsx`, **이번 diff 로 변경되지 않음** — `origin/main` 에 이미 존재)는 `DetailTab` 을 `preview | input | output | meta | port | status | llm_usage | response | request | config | references | error` 11종으로 정의하고, AI 노드에서 RAG references 가 있으면 `references` 탭을, envelope 에 `meta`/`port`/`status` 필드가 있으면 각각 해당 탭을 노출한다(§136-271). 이 4개 탭(`meta`/`port`/`status`/`references`)은 Run Results Drawer(`run-results-drawer.tsx`, 이미 `ResultDetail` 사용 중)에서는 기존에도 존재했던 **선재(pre-existing) 갭**이라 §10.6.1 의 book-keeping 이 이미 stale 했다. 이번 V-05 diff 는 execution-detail 페이지가 자체 4-탭(`preview/input/output/error`) 하드코딩 UI를 버리고 `ResultDetail` 을 그대로 위임함으로써, 기존에 에디터 Drawer 한정이었던 이 갭을 **실행 내역(EH-DETAIL) 페이지로 확산**시킨다. 두 spec(`14-execution-history.md` EH-DETAIL-03, `3-execution.md` §10.6.1) 모두 `status: implemented` 이며 갭을 인지하는 `pending_plans` 나 각주가 없다.
  - 제안: (a) `spec/3-workflow-editor/3-execution.md` §10.6.1 표에 `References`(RAG 근거) / `Meta` / `Port` / `Status` 행을 추가해 기존 Drawer 갭부터 문서화하고, (b) `spec/2-navigation/14-execution-history.md` §3.3/§3.4/EH-DETAIL-03 에 "노드 결과 패널은 에디터 Run Results 의 `ResultDetail` 을 그대로 재사용하며 §10.6.1 의 전체 탭 집합(References/Meta/Port/Status 포함)을 그대로 상속한다"는 취지의 문장을 추가해 두 spec 이 동일 컴포넌트를 가리키도록 정렬. 코드 변경은 불필요(이미 올바르게 동작) — spec 텍스트만 갱신.

- **[INFO]** 두 spec 문서(14-execution-history.md, 3-execution.md)의 "노드 상세 서브탭" 서술이 독립적으로 유지되어 향후 drift 위험
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3/§3.4/§3.4.1/§3.4.2 (전체를 재서술)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §10.6 ~ §10.6.1 (동일 UI 요소를 이미 상세히 서술)
  - 상세: 이번 V-05 변경으로 두 페이지(에디터 Run Results Drawer, 실행 상세 페이지)가 **동일 컴포넌트**(`ResultDetail`)를 공유하게 되었음에도, 두 spec 문서는 탭 목록·기본 선택 우선순위·waiting 상태 처리 등을 각자 별도 산문으로 반복 서술한다(§3.4/§3.4.1/§3.4.2 vs §10.6.1). 지금은 내용이 실질적으로 합치하지만(Preview/Input/Output/Config/LLM Usage/Error, 메시지 레벨 Preview/Response/Request/LLM Usage, 디폴트 우선순위 Error→Preview→Output 등), 코드가 이미 단일 컴포넌트로 합쳐진 상태에서 spec 만 이원화돼 있으면 한쪽만 갱신되고 다른 쪽이 stale 해지는 drift 가 반복될 위험이 있다(§10.14 의 "진입점이 두 곳이 되더라도 모달·정책·API 는 단일 source of truth" 원칙이 Re-run 모달에는 있지만 노드 상세 탭에는 명시적으로 없음).
  - 제안: `14-execution-history.md` §3.3/§3.4 를 "탭 UI 는 [Spec 실행/디버깅 §10.6 ResultDetail](../3-workflow-editor/3-execution.md#106-상세-뷰-오른쪽-칼럼) 을 그대로 재사용 — SoT 는 §10.6.1" 로 축약하고, execution-history 고유 차이(예: 좌측 패널이 시간순 나열이 아니라 skipped 제외 등)만 남기는 리팩터를 향후 고려. 급하지 않음(즉시 조치 불요).

- **[INFO]** dry-run 배지 로직 변경(`executionDryRun` prop 제거)은 spec §9.2/§7.4 의 역할 분리와 오히려 더 잘 정렬됨 (충돌 아님, 확인 목적 기록)
  - target 위치: `page.tsx` diff — `executionDryRun` prop 및 `execution.dryRun === true` OR 분기 제거, `isDryRunOutput(selectedNode.outputData)` 단독 판정으로 위임(`ResultDetail` 내부)
  - 충돌 대상: `spec/5-system/13-replay-rerun.md` §7.4/§9.2 ("NodeExecution `_dryRun` 은 결과 표시용(UI 식별), Execution `dry_run` 은 실행 제어용(엔진 주입·복원)으로 역할이 분리된다")
  - 상세: 옛 코드는 `executionDryRun || isDryRunOutput(...)` 으로 실행 레벨 플래그도 배지 판정에 섞었으나, spec §9.2 는 명시적으로 두 필드의 책임을 분리한다(Execution.dry_run=엔진 제어, NodeExecution._dryRun=UI 표시). 새 코드(`ResultDetail` 위임)는 `isDryRunOutput(result.outputData)` 단독으로 판정하며, 이는 이미 에디터 Run Results Drawer 가 쓰던 것과 동일한 로직이다. 두 화면(Drawer/실행상세)이 이제 동일한 판정을 쓰게 되어 §10.14 정신(단일 source of truth)에도 부합. 등급 상향 사유 없음 — 정보성 확인.
  - 제안: 조치 불필요. 필요 시 `13-replay-rerun.md` §7.4 예시 문구에 "두 화면 모두 노드 레벨 `_dryRun` 마커만으로 배지를 판정한다(Execution.dry_run 은 배지에 관여하지 않음)"를 한 줄 명시하면 향후 재발 방지에 도움.

## 요약

V-05(실행 상세 페이지가 에디터 `ResultDetail` 컴포넌트를 그대로 재사용)는 데이터 모델·API 계약·요구사항 ID·RBAC·상태 전이·계층 책임 어느 축에서도 직접적 모순을 일으키지 않았다. 다만 `ResultDetail` 자체가 (diff 이전부터, 즉 origin/main 시점부터) 이미 두 spec 문서(`3-workflow-editor/3-execution.md` §10.6.1, `2-navigation/14-execution-history.md` §3.3/EH-DETAIL-03)가 문서화한 탭 집합보다 넓은 탭(References/Meta/Port/Status)을 지원하고 있었고, 이번 재사용으로 그 선재 갭이 실행 내역 페이지 쪽 spec 에도 그대로(그리고 새롭게) 노출된다. 코드 결함이 아니라 두 spec 문서의 book-keeping 갭이 재사용을 계기로 표면화된 것이므로 CRITICAL 은 아니며, spec 갱신(§10.6.1 탭 표 보강 + `14-execution-history.md` 의 SoT 참조화)으로 해소 가능하다. dry-run 배지 판정 변경은 오히려 기존 spec 의 역할 분리 원칙과 더 정합해졌다.

## 위험도

LOW
