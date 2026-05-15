## 발견사항

### - [WARNING] spec §5.3 JSON 예시와 실제 코드 동작 불일치
- **위치**: `spec/4-nodes/2-flow/1-workflow.md` §5.3 JSON 예시
- **상세**: §5.3의 에러 케이스 JSON 예시에 `"code": "SUB_WORKFLOW_FAILED"`가 그대로 남아 있는데, 바로 아래 `"message": "Workflow not found: wf_uuid_9999"`가 기재되어 있음. 새로 구현된 `mapSubWorkflowError`로는 이 메시지가 `SUB_WORKFLOW_NOT_FOUND`로 매핑되므로, 예시가 실제 동작과 모순됨. §5.3 표의 설명문("executor 에러 메시지에 따라 세분화")은 올바르게 수정되었지만 JSON 예시 자체가 갱신되지 않음.
- **제안**: `"code": "SUB_WORKFLOW_NOT_FOUND"`로 수정하거나, 메시지를 generic runtime 오류("Node X exceeded maximum iteration count" 등)로 바꿔 `SUB_WORKFLOW_FAILED`와 일관되게 맞출 것

---

### - [INFO] 코드·테스트·스펙 전반에 task 식별자 주석 잔류
- **위치**: `error-codes.spec.ts:29`, `workflow.handler.ts:136·160`, `workflow.handler.spec.ts:131·226`
- **상세**: `// Sub-workflow specific codes added in Phase 1 A-3.`, `// D-1 — sync result is...`, `// A-2: async output is enriched...` 등 plan 태스크 ID 참조. CLAUDE.md에 "현재 task·fix·호출자를 주석에 기술하지 말 것" 원칙이 명시되어 있음. 이 주석들은 plan 문서가 이동·폐기되면 컨텍스트를 잃음.
- **제안**: 태스크 ID(`D-1`, `A-2`, `A-3`)를 제거하고 동작 이유만 남길 것 (예: `// sync result wraps one level so downstream access is uniform regardless of sub-workflow output shape`)

---

### - [INFO] `mapSubWorkflowError` 모듈 레벨 export — 공개 API 표면 확장
- **위치**: `workflow.handler.ts:192+`, `workflow.handler.spec.ts:1`
- **상세**: JSDoc에 "Exported for unit testing" 이라고 명시되어 있으나, module export는 외부 임포터에게 공개 API로 노출됨. 현재 executor가 구조화된 에러 타입을 제공하지 않아 임시 패턴 매칭이 필요하다는 이유는 타당하나, 테스트 전용이라면 `export` 대신 동일 파일 내 통합 테스트로 간접 검증하는 방법도 있음.
- **제안**: 현 상태 유지 가능. 단 JSDoc에 "executor가 구조화된 에러 타입을 노출하면 이 함수와 export는 제거 예정"이라는 제거 조건을 명시하면 미래 정리가 용이함.

---

## 요약

변경 전체는 plan §1.5에 명시된 4개 workflow 항목(A-1 키 통일, A-2 async 출력 보강, A-3 에러 코드 세분화, D-1 sync 래핑)에 충실하게 범위가 한정되어 있다. 관련 없는 파일 수정, 불필요한 리팩토링, 미승인 기능 추가는 없다. 단 spec §5.3 JSON 예시가 A-3 구현 결과와 모순되는 문서 불일치가 하나 존재하며, 이는 사용자나 AI가 spec을 읽을 때 잘못된 코드 동작 이해로 이어질 수 있다.

## 위험도

**LOW**