# Cross-Spec 일관성 검토 — `plan/in-progress/ai-node-failed-conversation-preview.md`

## 발견사항

- **[CRITICAL]** Phase 1 spec 개정 대상에서 `spec/3-workflow-editor/3-execution.md §10.6.1`(선언된 SoT) 누락 — 기본 탭 정책이 두 문서에서 직접 모순될 것
  - target 위치: `## Phase 1 — spec 개정 (spec/conventions/conversation-thread.md)` 항목 3 "기본 탭 정책 — 대화형 노드는 `result.error` 가 있어도 미리보기를 기본 선택"
  - 충돌 대상: `spec/2-navigation/14-execution-history.md:211` + `spec/3-workflow-editor/3-execution.md §10.6.1`("디폴트 탭 선택 우선순위") · §10.8("라이프사이클" 표)
  - 상세:
    1. `14-execution-history.md:211` 은 "실행 상세 페이지는 에디터 Run Results 드로어와 **동일한 `ResultDetail` 컴포넌트**를 재사용하므로 서브 탭 전체 구성·조건·**기본탭**·auto-fallback 은 [Spec 실행 §10.6.1] 이 단일 진실(SoT)이다" 라고 명문화한다. 실제로 `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx` 가 `ResultDetail`(`result-detail.tsx`)을 그대로 import 해 재사용하는 것도 코드로 확인된다. 즉 target 이 고치려는 "기본 탭 정책"의 **선언된 SoT는 `conversation-thread.md` 가 아니라 `3-execution.md §10.6.1`** 이다.
    2. `3-execution.md §10.6.1` 의 "디폴트 탭 선택 우선순위"는 현재 "1. Error — 에러가 있으면 최우선" 이며, 예외는 "AI multi-turn retryable error 종결 시" (`port:'error'` + `status:'ended'` + `details.retryable===true`, 즉 target 문서가 말하는 "이미 커버된" CT-S9/S10 케이스) 로 **좁게** 한정돼 있다. target 의 새 Inv-8/기본 탭 정책("대화형 노드는 error 있어도 Preview 기본, 오류 탭은 명시적 선택")은 이 예외를 `node.failed`(status=`failed`) 케이스까지 넓히는 것인데, Phase 1 이 `conversation-thread.md` 만 고치면 §10.6.1 의 "1. Error 최우선" 일반 규칙과 conversation-thread.md 의 새 규칙이 **같은 컴포넌트·같은 시나리오**에 대해 정면으로 모순된다.
    3. `3-execution.md §10.8` "라이프사이클" 표의 "실행 실패" 행은 이미 "드로어 유지... **conversation snapshot 보존**([Conversation Thread §9.7.1] Inv-6) — multi-turn AI Agent 의 대화가 노드 실패와 함께 **사라지지 않음**" 이라고 적혀 있다. 이 문장은 store 보존과 UI 가시성을 구분하지 않고 "사라지지 않는다"(=화면에 남는다) 로 읽히는데, 이것이 정확히 target 문서가 "구조적 원인"으로 지목한 store/렌더 계층 혼동이다. Phase 1 이 이 행을 검토·갱신하지 않으면, 정작 버그를 유발한 문서가 수정 대상 목록에서 빠진 채로 남는다.
    4. `spec/2-navigation/14-execution-history.md §3.4` (AI Agent Preview 탭 서술)도 "**완료된** 대화를 채팅 스레드 형태로 표시한다" 로 명시적으로 "완료된" 케이스에 한정돼 있다. target 의 스코프("포함: live 세션 — 에디터 drawer **+ 실행 상세 페이지**")가 그대로 구현되면 동일 페이지가 라이브 세션 중에는 failed 대화도 표시해야 하므로 이 문구도 갱신 필요 대상이다.
  - 제안: Phase 1 개정 대상에 `spec/3-workflow-editor/3-execution.md §10.6.1`(디폴트 탭 우선순위 예외 확장) + §10.8(라이프사이클 표 "실행 실패" 행 정합화) + `spec/2-navigation/14-execution-history.md §3.4`("완료된" 한정 문구 갱신)를 추가한다. `conversation-thread.md` 에는 Inv-8/CT-S15~16 을 두되, 실제 탭 선택 규칙 자체의 SoT 는 기존 관행대로 `3-execution.md §10.6.1` 에 두고 `conversation-thread.md` 는 그것을 참조하는 형태로 정리해야, 이미 한 번 겪은 "EH-DETAIL-06 dangling 위임" 류의 drift(`14-execution-history.md:470` 참조)를 반복하지 않는다.

- **[WARNING]** "제외(별도 과제)" 절의 EH-DETAIL-12 인용은 기존 관행과 부합하나, 관련 nav spec(EH-DETAIL-06 ✅) 쪽에는 이 한계가 반영되지 않음
  - target 위치: `## 스코프` "제외 (별도 과제)" 문단
  - 충돌 대상: `spec/2-navigation/_product-overview.md §3.15` EH-DETAIL-06 (✅ "단일 AI Agent 노드 범위") / `spec/2-navigation/14-execution-history.md §3.4`
  - 상세: target 은 "새로고침 후 `/executions/:id` 이력 view 에서 failed 노드의 대화 복원"을 EH-DETAIL-12(v2, cross-node) 영역으로 돌리고 있다. `conversation-thread.md §4/§9.3/§7` 이 이미 "실행 후 이력 view" 재구성 전체를 EH-DETAIL-12 로 위임해온 기존 관행과는 부합하므로 target 이 새로 만든 불일치는 아니다. 다만 `14-execution-history.md §3.4` 는 AI Agent Preview 탭을 "**완료된** 대화" 로만 한정해 이 gap 을 사실상 이미 회피하고 있는데, 이번 plan 의 Phase 1 이 "이력 view 한계 명시"를 `conversation-thread.md §9.3` 에만 추가할 계획이라 두 문서(`conversation-thread.md` 신규 문구와 `14-execution-history.md` 기존 "완료된" 한정 문구) 사이의 근거가 한쪽에만 명문화되는 비대칭이 생긴다.
  - 제안: `14-execution-history.md §3.4` 의 "완료된 대화" 문구 옆에 (위 CRITICAL 항목의 §3.4 갱신과 묶어) "failed 종결 노드의 새로고침 후 대화 복원은 EH-DETAIL-12(v2) 로드맵" 한 줄을 상호 참조로 추가하면 두 문서가 동일 근거를 공유하게 된다.

## 요약

이번 target(`ai-node-failed-conversation-preview.md`)의 핵심 진단(store Inv-6 은 충족되나 렌더 게이트가 `status==='completed'` 만 받아들여 `node.failed` 대화가 도달 불가) 자체는 `spec/1-data-model.md`(Execution/NodeExecution 필드, `output_data` nullable)·`spec/0-overview.md`(로드맵 §6.3 EH-DETAIL-12 위치)와 모순이 없고 오히려 정합적으로 뒷받침된다. 다만 target 이 고치려는 "대화형 노드는 error 여도 Preview 기본 선택" 규칙의 **선언된 단일 진실(SoT)은 `spec/conventions/conversation-thread.md` 가 아니라 `spec/3-workflow-editor/3-execution.md §10.6.1`**(`14-execution-history.md:211` 이 명문화, `ResultDetail` 컴포넌트가 에디터 드로어와 실행 상세 페이지에 공유되므로)이며, Phase 1 의 spec 개정 대상 목록에 이 파일이 빠져 있다. 그대로 진행하면 §10.6.1 의 "Error 최우선" 일반 규칙과 conversation-thread.md 의 새 Inv-8 규칙이 같은 컴포넌트·같은 시나리오(대화형 노드 실패)에 대해 정면으로 어긋나는 두 SoT 를 만들게 되고, 이는 이 저장소가 이미 한 번 정리한 "EH-DETAIL-06 dangling 위임" 문제와 동일한 클래스의 재발이다. `/consistency-check --spec` 재실행 전에 Phase 1 갱신 목록에 `3-execution.md §10.6.1/§10.8`(+ `14-execution-history.md §3.4`)을 추가하는 것을 권고한다. 요구사항 ID(Inv-8, CT-S15/16)는 기존 spec 전역에서 미사용을 확인했으므로 충돌 없음. 데이터 모델·API 계약·RBAC 관점에서는 이번 변경이 순수 프론트엔드 렌더 계층에 국한돼 있어 별도 충돌이 없다.

## 위험도

HIGH
