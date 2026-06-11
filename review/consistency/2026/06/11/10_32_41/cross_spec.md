# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 일시**: 2026-06-11

---

## 발견사항

- **[INFO]** Workflow List 더보기 메뉴 항목 명칭 불일치
  - target 위치: §4.2 — "각 워크플로우 행의 컨텍스트 메뉴(⋯)에 **'Execution History'** 항목 추가"
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md` §2.6 더보기 메뉴 액션 표 — **"실행 기록"** 으로 표기
  - 상세: target 은 영문 메뉴 라벨 `Execution History` 를 쓰고, 1-workflow-list.md 는 한국어 `실행 기록` 을 쓴다. UI 레이블의 공식 표기가 두 문서에서 다르게 기술되어 있어 어느 쪽이 UI 실제 문자열인지 불명확하다.
  - 제안: `1-workflow-list.md §2.6` 표 또는 target §4.2 에서 표기를 통일. 실제 구현 렌더링 기준으로 한쪽을 SoT 로 지정할 것.

- **[INFO]** Execution 상태 필터에서 `pending` 미포함
  - target 위치: §2.3 필터 표 — `All / Completed / Failed / Running / Cancelled / Waiting` 6종
  - 충돌 대상: `spec/1-data-model.md §2.13` — Execution.status Enum = `pending / running / completed / failed / cancelled / waiting_for_input`
  - 상세: 데이터 모델 상 `pending` 은 유효한 Execution 상태이지만 UI 필터 목록에 포함되지 않는다. `pending` 상태의 실행은 `All` 필터에서만 보인다. 이는 의도된 UX 결정일 수 있으나(pending 은 사용자에게 직접 노출되지 않을 만큼 순간적), 명시적 Rationale 이 없다.
  - 제안: target `## Rationale` 에 `pending` 을 필터에서 제외한 이유를 한 줄 추가(예: "pending 상태는 큐 대기 순간에만 존재하며 사용자 조작 불가라 UI 필터에서 제외"). 또는 필터에 추가.

- **[INFO]** Chat Channel(webhook 변형) 트리거 출처 처리 미언급
  - target 위치: §2.4 Trigger 출처 분류 표 — `subworkflow / manual / schedule / webhook / unknown` 5종
  - 충돌 대상: `spec/1-data-model.md §2.8` — chat-channel 은 별도 Trigger.type 이 아니라 `webhook` 트리거의 `config.chatChannel` 변형. `spec/5-system/15-chat-channel.md` 참조.
  - 상세: Chat Channel 트리거로 시작된 실행은 `Trigger.type = 'webhook'` 이므로 §2.4 의 분류 규칙상 `webhook` 으로 분류된다. 이 동작이 의도인지(Chat Channel 실행이 Webhook 라벨로 표시되는 것이 맞는지) 명시적으로 언급되지 않는다. 현재 5종 표에서 `chatChannel` 하위 구분은 없다.
  - 제안: target §2.4 또는 R-2 Rationale 에 "Chat Channel 트리거는 Trigger.type='webhook' 의 변형이므로 `webhook` 으로 분류된다" 한 줄 주석 추가. 별도 6번째 source 를 만들 계획이 없음을 명시.

- **[INFO]** 목록 API sort 파라미터 기본값이 API 규약 기본값(`created_at`)과 상이
  - target 위치: §5 목록 API 쿼리 파라미터 표 — `sort` 기본값 = `started_at`
  - 충돌 대상: `spec/5-system/2-api-convention.md §4.1` — 공통 sort 파라미터의 기본값 예시 = `created_at`
  - 상세: API 규약의 기본값은 예시이지 강제 규칙이 아니다. 실행 내역에서 `started_at` 기본 정렬은 의미상 올바르다. 그러나 API 규약 §4.1 에서 이 예외를 명시하지 않아 다른 개발자가 혼동할 수 있다.
  - 제안: 충돌이 아닌 합법적 도메인 오버라이드이므로 변경 불필요. 다만 target §5 의 쿼리 파라미터 설명에 "Execution 도메인은 `started_at` 을 기본값으로 사용 (API 규약 §4.1 의 `created_at` 예시와 다름)" 한 줄을 추가하면 명확해진다.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 `spec/1-data-model.md` (Execution 엔티티 필드 정의), `spec/5-system/2-api-convention.md` (목록 응답 형식 §5.2), `spec/5-system/13-replay-rerun.md` (Re-run API 및 chain 모델), `spec/3-workflow-editor/_product-overview.md` (ED-AI-35~38 요구사항), `spec/3-workflow-editor/4-ai-assistant.md` (get_workflow_executions / get_execution_details 도구), `spec/2-navigation/0-dashboard.md` (Recent Executions 클릭 동작)의 정의들과 전반적으로 일치한다. 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌은 발견되지 않았다. 발견된 4건은 모두 INFO 수준의 명명 불일치 또는 명시적 설명 누락으로, 기능 동작이나 구현을 차단하는 CRITICAL/WARNING 사안은 없다.

---

## 위험도

NONE
