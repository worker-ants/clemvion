### 발견사항

---

**[WARNING] `tool-call-badge.tsx`가 spec §13 에서 정의한 i18n 키를 사용하지 않음**
- 위치: `frontend/src/components/editor/assistant-panel/tool-call-badge.tsx`, `summarize()` 함수
- 상세: `get_workflow_executions`와 `get_execution_details` 배지 라벨을 하드코딩된 영어 문자열(`"executions (failed): 3"`, `"execution detail: 5 nodes"`)로 생성한다. spec §13, `ko.ts`, `en.ts`에 `exploreExecutionsList` / `exploreExecutionDetails` 키를 명시적으로 추가했음에도 배지 컴포넌트는 이를 전혀 사용하지 않아 한국어 사용자에게 영어 텍스트가 노출된다.
- 제안: `summarize()` 내에서 프로젝트의 기존 i18n 훅(`useTranslation` 또는 `t(...)`)을 통해 해당 키를 사용하거나, 배지 컴포넌트 외부(메시지 뷰)에서 i18n 처리를 위임한다. 만약 배지가 의도적으로 i18n을 우회하는 컴포넌트라면 spec §13의 해당 키 정의 자체를 제거해야 정합성이 유지된다.

---

**[WARNING] `assistant.executionNotInScope` i18n 키가 spec §13에 정의됐으나 프론트엔드 구현에서 사용되지 않음**
- 위치: `frontend/src/lib/i18n/dict/ko.ts`, `en.ts` (추가) vs. 실제 사용 지점 부재
- 상세: `EXECUTION_NOT_IN_SCOPE` 에러 코드는 백엔드가 반환하고, spec §13은 대응 i18n 키를 명시하지만 변경된 프론트엔드 코드 어디에서도 이 키를 참조하지 않는다. 배지는 `ok: false`를 빨간 색상으로만 처리하고, 에러 코드별 메시지를 UI에 표시하는 경로가 없다.
- 제안: 에러 메시지를 노출하는 토스트/인라인 컴포넌트에서 이 키를 사용하거나, 현재 설계가 LLM이 자연어로 오류를 전달하는 방식이라면 spec §13에서 해당 항목을 제거하여 혼선을 방지한다.

---

**[INFO] `getCount()` 전 `.limit(1)` 호출은 무효**
- 위치: `explore-tools.service.ts`, `getExecutionDetails()` 내 `subExecutionsTruncatedDepth` 계산
- 상세: `.limit(1).getCount()`에서 TypeORM의 `getCount()`는 `SELECT COUNT(*) ...` 쿼리를 생성하여 `LIMIT` 절을 무시한다. 따라서 `.limit(1)`은 효과 없이 전체 grandchild 행을 카운트한다. 존재 여부 확인 목적에서는 결과가 정확하지만 불필요한 풀 스캔이 발생할 수 있다.
- 제안: 존재 여부만 확인하려면 `.limit(1).getMany().then(r => r.length > 0)`로 교체하거나, `SELECT 1 ... LIMIT 1` 패턴에 해당하는 방법을 사용한다.

---

**[INFO] 자식 실행 타임라인 로딩 시 N+1 쿼리**
- 위치: `explore-tools.service.ts`, `getExecutionDetails()` 내 `subExecutions` 구성
- 상세: `Promise.all(directChildren.map(child => loadTimeline(child.id)))` 는 직계 자식 N개마다 별도의 `nodeExecutionRepo.find` 쿼리를 발생시킨다. sub-workflow 노드가 많은 워크플로우에서는 쿼리 수가 비례해 증가한다.
- 제안: `nodeExecutionRepo.find({ where: { executionId: In(directChildren.map(c => c.id)) } })`로 한 번에 조회 후 메모리에서 `executionId` 기준으로 그룹핑하면 단일 쿼리로 처리할 수 있다. 현재 diagnostic 용도라 허용 범위 안이지만, 대규모 워크플로에서는 문제가 될 수 있다.

---

**[INFO] 계획 문서(`plan/workflow-assistant-execution-tools.md`)가 완료 후에도 모두 미체크 상태**
- 위치: `plan/workflow-assistant-execution-tools.md` 전체
- 상세: 구현이 완료됐음에도 Phase 1~4의 모든 항목이 `- [ ]`로 남아 있어 진행 상태를 반영하지 않는다.
- 제안: 완료된 항목을 `- [x]`로 갱신하거나, 계획 완료 시 `plan/` 문서를 아카이빙 처리한다.

---

**[INFO] Memory 문서에 기재된 `ExecutionsService` 재사용 계획과 실제 구현의 괴리**
- 위치: `memory/workflow-assistant-execution-tools-decisions.md` §"구현 단계에서 유의 사항" 1번
- 상세: 메모리 문서는 "`executions.service.ts`의 `findById()` 위에 얇은 어댑터를 얹으면 됨"이라 명시하지만, 실제 구현은 `executionRepo`와 `nodeExecutionRepo`를 직접 주입해 별도의 쿼리 로직을 작성했다.
- 제안: 아키텍처상 문제는 없으나, 향후 `ExecutionsService`에 RBAC 같은 교차 관심사가 추가될 경우 `ExploreToolsService`는 그 보호를 받지 못한다. 메모리 문서를 실제 구현 방식으로 갱신하고, 추후 서비스 레이어 교체 시점을 명시해둔다.

---

### 요약

핵심 요구사항인 PRD ED-AI-35~38(실행 조회 도구 2종, 스코프 제한, 민감 필드 마스킹, 실행 중 read 허용)은 백엔드 구현, 단위 테스트, 스트림 서비스 연동, 시스템 프롬프트 2-step 패턴 교육까지 모두 충실하게 반영되어 있다. 스코프 검증 로직(workspace → workflowId → parentExecutionId 1-level 체크)과 에러 코드 분기(`EXECUTION_NOT_FOUND` / `EXECUTION_NOT_IN_SCOPE`)도 스펙과 정합한다. 단, spec §13에 명시된 i18n 키 3개 중 `exploreExecutionsList`·`exploreExecutionDetails`가 배지 컴포넌트에서 실제로 사용되지 않아 한국어 사용자 경험이 누락되며, `executionNotInScope` 키는 프론트엔드 어디서도 참조되지 않는다. 이 i18n 불일치가 요구사항 관점의 주요 미완성 지점이다.

### 위험도

**MEDIUM**