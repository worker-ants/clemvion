# Cross-Spec 일관성 검토 결과

**대상 변경**: `spec/conventions/chat-channel-adapter.md §3.1` — `WORKFLOW_FORBIDDEN_WORKSPACE` 를 `executionFailedInternal` 분류 행에 명시 등재 (1줄 수정)

**검토 기준**: `spec/conventions/`, 연관 `spec/5-system/3-error-handling.md`, `spec/4-nodes/2-flow/1-workflow.md §6`, `spec/conventions/error-codes.md`

---

## 발견사항

### INFO: 분류 일관성 — 기존 정책과 완전 정합

- target 위치: `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 line 388
- 충돌 대상: 없음 (하기 근거 참조)
- 상세:
  - `WORKFLOW_FORBIDDEN_WORKSPACE` 는 `spec/5-system/3-error-handling.md §1.4` 의 Sub-workflow 에러 코드 목록에 이미 등재돼 있으며, 동 문서 §1.4 Note 에서 "enum 확장 시 분류 표 행 추가 검토 의무"를 명시하고 있다. 본 변경은 그 의무를 이행한 것이다.
  - `spec/4-nodes/2-flow/1-workflow.md §6` 는 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 런타임 error 포트 surface 코드로 정의하며, cross-workspace 격리 차단(W-6 fail-closed)을 우리 플랫폼 정책 결정으로 명시한다.
  - 동일 플랫폼 정책 차단인 `HTTP_BLOCKED`(SSRF 차단)·`DB_HOST_BLOCKED` 가 모두 `executionFailedInternal` 로 분류되는 기존 패턴과 의미적으로 일치한다.
  - `spec/conventions/error-codes.md` 명명 규약(`UPPER_SNAKE_CASE`, 의미 기반 명명) 위반 없음.
  - 구현(`execution-failure-classifier.ts` `INTERNAL_CODES`)과 spec 표가 동일 커밋 내에서 동시에 갱신되어 spec-impl 불일치가 없다.
- 제안: 해당 없음 (확인 완료).

---

### INFO: 사전 존재 갭 — `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` 미등재 (본 변경 범위 외)

- target 위치: `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 전체
- 충돌 대상: `spec/5-system/3-error-handling.md §3.2` — Sub-workflow 에러 코드 5종 목록
- 상세:
  - `spec/5-system/3-error-handling.md §3.2` 는 Sub-workflow 노드 에러 포트 코드로 5종을 나열한다: `SUB_WORKFLOW_FAILED`·`SUB_WORKFLOW_NOT_FOUND`·`SUB_WORKFLOW_TIMEOUT`·`SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`.
  - 본 변경 후 분류 표에는 `SUB_WORKFLOW_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE` 2종만 명시 등재되고 나머지 3종은 fallback 행으로 처리된다(CCH-ERR-04 warn 로그 발생 가능). 이 갭은 본 변경이 도입한 것이 아닌 사전 상태이며, fallback 도 동일 `executionFailedInternal` 반환이라 사용자 대면 영향 없음.
- 제안: 별도 트랙에서 나머지 3종 명시 등재 검토. blocking 아님.

---

## 요약

`spec/conventions/chat-channel-adapter.md §3.1` 에 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 `executionFailedInternal` 분류로 추가한 변경은 기존 spec 과 직접 모순이 없다. `spec/5-system/3-error-handling.md §1.4` 가 이미 해당 코드를 Sub-workflow 에러 열거에 등재하고 분류 표 추가 의무를 명시하고 있으며, `spec/4-nodes/2-flow/1-workflow.md §6` 의 에러 surface 정의와도 정합한다. 분류 선택(internal)은 동일 플랫폼 정책 차단 패턴(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`)과 일치하며, spec-impl 동기 역시 동일 커밋에서 함께 갱신되어 불일치가 없다. 사전에 존재하던 일부 Sub-workflow 코드 미등재 갭은 본 변경 범위 외이며 UX 영향도 없다.

## 위험도

NONE
