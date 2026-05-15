## 발견사항

### 핵심 기능 완전성

- **[INFO]** `review-workflow.ts`의 `collectUnresolvedFailures`가 `kind === 'finish'`만 제외
  - 위치: `review-workflow.ts` → `collectUnresolvedFailures` 함수
  - 상세: `get_node_schema`가 3번째 호출에서 `ok:false, error: 'REDUNDANT_SCHEMA_LOOKUP'`을 반환할 때, 이 결과가 `pendingToolCalls`에 쌓인다. 이후 LLM이 `finish`를 호출하면 `UNRESOLVED_FAILED_CALLS` 점검이 해당 실패를 포착할 수 있다 — `isRecoveredLater`의 복구 패턴이 `get_node_schema`를 다루지 않으므로 항상 `false`를 반환한다.
  - 제안: `collectUnresolvedFailures`에서 `kind === 'finish'` 외에 `kind !== 'edit'`(또는 `name === 'get_node_schema'`) 조건을 추가해 explore 계열 호출을 제외

### 주석-구현 불일치

- **[WARNING]** `SCHEMA_LOOKUP_HARD_STOP = 3` 상수 설명 오류
  - 위치: `workflow-assistant-stream.service.ts:141` 근방 (`SCHEMA_LOOKUP_HARD_STOP` 선언)
  - 상세: 주석에 "3이면 첫 호출 + cache hit 2회까지 관용, **4번째**부터 error 응답"이라고 쓰여 있으나, 실제 코드 흐름을 추적하면 첫 호출 시 `hits: 1`로 저장, 2번째 호출 시 `hits += 1 → 2 < 3`이므로 warning, 3번째 호출 시 `hits += 1 → 3 >= 3`이므로 error다. 테스트(`call_3` → error)도 **3번째**가 hard-stop임을 확인한다.
  - 제안: 주석을 "3번째 호출부터 error 응답"으로 수정

### 시스템 프롬프트 설명 부정확

- **[INFO]** review skip 조건 설명이 구현과 불일치
  - 위치: `system-prompt.ts` → Self-review 섹션 마지막 단락
  - 상세: "Review is skipped automatically for trivial turns (single node, **no plan**)"이라고 쓰여 있으나, `evaluateReviewGuard` 구현에서 `nonTriggerCount <= 1`이면 plan 유무와 무관하게 skip된다.
  - 제안: "single non-trigger node regardless of plan presence"로 수정

### 테스트 커버리지 누락

- **[INFO]** `planStepIds` (배열 형식) 미테스트
  - 위치: `review-workflow.spec.ts` → `FAKE_STEP_COMPLETION` 그룹
  - 상세: `collectFakeStepCompletion`은 `tc.planStepId === step.id || (Array.isArray(tc.planStepIds) && tc.planStepIds.includes(step.id))` 두 경로를 지원하나, `planStepIds` 배열 형식의 테스트가 없다.
  - 제안: `planStepIds: ['s1']`을 사용하는 케이스 추가

- **[INFO]** `MAX_ORPHANS = 20` 상한 테스트 없음
  - 위치: `review-workflow.spec.ts` → `ORPHAN_NODES` 그룹
  - 상세: `MAX_UNRESOLVED`(10)는 캡 테스트가 있으나 `MAX_ORPHANS`(20) 캡은 없음

### 엣지 케이스

- **[INFO]** `PENDING_USER_CONFIG_UNMENTIONED`의 대소문자 민감 비교
  - 위치: `review-workflow.ts` → `collectUnmentionedPendingUserConfig`
  - 상세: `text.includes(node.label)`은 대소문자 구분 비교. LLM이 "sendemail"처럼 소문자로 언급하면 "SendEmail" 라벨을 감지 못한다. 실제로는 LLM이 노드 label을 그대로 인용하는 경향이 강하므로 실용적으로 큰 문제는 아님.
  - 제안: `text.toLowerCase().includes(node.label.toLowerCase())`로 개선 고려

---

## 요약

전반적으로 기능 설계와 구현이 잘 일치하며, 2-stage finish 자체점검·에러 복구 힌트·스키마 중복 조회 방지의 핵심 비즈니스 요구사항이 코드에 정확히 반영되어 있다. 테스트도 orphan·unresolved failure·fake completion·coverage 등 주요 시나리오를 충분히 커버한다. 실질적인 결함은 `get_node_schema`의 hard-stop 에러(`ok:false, error: 'REDUNDANT_SCHEMA_LOOKUP'`)가 `UNRESOLVED_FAILED_CALLS` 점검에서 오탐될 수 있는 잠재적 false positive 하나이며, 그 외는 주석 오류와 테스트 커버리지 보강 수준의 사항이다.

## 위험도

**LOW**