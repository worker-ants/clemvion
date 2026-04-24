파일 쓰기 권한이 차단되었습니다. 아래에 보고서 전문을 출력하겠습니다.

---

# Code Review 통합 보고서

> 브랜치: `improve-code` | 일시: 2026-04-24

## 전체 위험도

**MEDIUM** — 핵심 기능(스코프 격리·마스킹·에러 코드)은 견고하나, i18n 키가 배지 컴포넌트에 연결되지 않은 구현 불일치와 `isExecutionInScope` 분기 테스트 누락이 조기 해결이 필요한 중점 항목이다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | **i18n 키 3개가 배지 컴포넌트에 미연결** — `exploreExecutionsList`, `exploreExecutionDetails`, `executionNotInScope`를 `ko.ts`·`en.ts`·spec §13에 추가했으나 `tool-call-badge.tsx`의 `summarize()`는 하드코딩 영문 문자열을 반환해 한국어 UI에 번역이 노출되지 않음 | `tool-call-badge.tsx:summarize()` | `useTranslation` 연결하거나, 의도적 우회라면 spec §13에서 해당 키 제거 |
| 2 | Testing | **`isExecutionInScope` 미검증 경로** — `parentExecutionId`가 존재하지만 부모 `workflowId`가 제3의 워크플로인 케이스 테스트 없음. 현재 `EXECUTION_NOT_IN_SCOPE` 테스트는 `parentExecutionId: null`로 즉시 반환되는 경로만 검증하며 두 번째 `findOne` mock은 dead code | `explore-tools.service.spec.ts` | 테스트 두 개로 분리: ① `parentExecutionId: null`, ② 부모 `workflowId`가 다름 |
| 3 | Testing | **`tool-call-badge.tsx` 신규 분기 테스트 전무** — `get_workflow_executions`·`get_execution_details` 분기 추가 후 유닛 테스트 없음 | `tool-call-badge.tsx` | `tool-call-badge.test.tsx`에 최소 3케이스: ① status 있는 목록, ② result null, ③ execution detail |
| 4 | Database | **`loadTimeline`에 row 수 상한 없음** — 루프 노드가 수천 번 반복 실행된 경우 `getExecutionDetails` 한 번 호출이 수만 row를 메모리로 올리며 자식 실행까지 재귀 적용됨 | `explore-tools.service.ts:loadTimeline()` | `take: 500` + `timelineTruncated: true` 힌트 응답 포함; spec §4.1.1 "크기 제한 없음" 재검토 |
| 5 | Database / Performance | **자식 타임라인 N+1 쿼리** — `Promise.all(directChildren.map(child => loadTimeline(child.id)))` 가 자식 수만큼 개별 DB 쿼리를 발행. `loadNodeStats`가 `In()` 패턴으로 이미 회피한 것과 불일치 | `explore-tools.service.ts:getExecutionDetails` | `nodeExecutionRepo.find({ where: { executionId: In(childIds) } })` 단일 쿼리 후 `executionId` 기준 메모리 그룹핑 |
| 6 | Database | **인덱스 존재 미확인** — `parent_execution_id`와 `(workflow_id, started_at DESC)` 복합 인덱스가 이번 변경에서 처음 쿼리 조건으로 사용되나 마이그레이션이 없음 | `explore-tools.service.ts:getWorkflowExecutions()`, `getExecutionDetails()` | `CREATE INDEX idx_executions_parent_id` 및 `CREATE INDEX idx_executions_workflow_started` 마이그레이션 확인 |
| 7 | Maintainability | **상태 enum 중복 정의** — `'pending'|'running'|...'waiting_for_input'` 6개 값이 `explore-tools.service.ts`(EXECUTION_STATUS_VALUES)와 `tool-definitions.ts`(JSON schema enum)에 각각 독립 선언 | `explore-tools.service.ts`, `tool-definitions.ts` | `EXECUTION_STATUS_VALUES`를 단일 위치에서 export해 양쪽 import |
| 8 | Maintainability | **`getExecutionDetails` 내 독립 쿼리 직렬 실행** — scope 통과 후 `loadTimeline`과 `executionRepo.find({ parentExecutionId })`가 의존성 없음에도 순차 실행 | `explore-tools.service.ts:getExecutionDetails` | `const [timeline, directChildren] = await Promise.all([...])` |
| 9 | Performance | **`loadNodeStats` 애플리케이션 레벨 집계** — 최대 50건의 모든 `node_execution` row를 메모리로 로드 후 JS 루프로 집계. DB GROUP BY 전환 시 반환 row가 최대 50개로 고정 | `explore-tools.service.ts:loadNodeStats()` | `createQueryBuilder`로 `COUNT/SUM(CASE WHEN)` + `GROUP BY ne.execution_id` |
| 10 | Testing | **`tsconfig.json` 테스트 파일 제외로 타입 가드 약화** — 빌드 타입체크에서 `*.spec.ts`, `*.test.tsx` 제외로 mock 타입 불일치가 CI에서 누락될 수 있음 | `frontend/tsconfig.json` | `tsconfig.test.json` 별도 생성 또는 lint 단계에 `tsc --noEmit --project tsconfig.test.json` 추가 |
| 11 | Documentation | **`plan/` 문서 체크박스 미갱신** — 구현 완료 후에도 Phase 1~4 전 항목이 `[ ]` 상태 (CLAUDE.md 규약 위반) | `plan/workflow-assistant-execution-tools.md` | 완료 항목 `[x]` 표시 또는 아카이빙 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **`getExecutionDetails` workspace 검증이 애플리케이션 레이어에서 수행** — DB 쿼리에 `workspaceId` 조건 미포함. `workflow` relation이 null이면 암묵적 거부 | `explore-tools.service.ts:getExecutionDetails` | `findOne({ where: { id, workflow: { workspaceId } }, relations: ['workflow'] })`로 쿼리 레벨 방어 추가 |
| 2 | Security | **부모 실행 조회 시 workspace 조건 없음** — `isExecutionInScope` 내 부모 `findOne`에 workspace 필터 없음 | `explore-tools.service.ts:isExecutionInScope` | 부모 조회에 workspace 조건 포함 또는 `parent.workflow?.workspaceId === workspaceId` 추가 검증 |
| 3 | Security | **마스킹 포맷이 짧은 비밀값의 끝 4자 노출** — `'sk-abcd1234'` → `'****1234'`. 8자 미만 토큰에서 suffix가 패턴 추론에 활용될 수 있음 | `maskSensitiveFields` 유틸 | `authorization`, `token` 등 고감도 키는 `'[REDACTED]'` 고정 치환 검토 |
| 4 | Concurrency | **Running 실행 조회 시 비원자적 스냅샷** — 3개 독립 쿼리 사이 상태 변경 시 불일치 스냅샷 반환 가능. 스펙에서 의도된 동작이나 시스템 프롬프트 §8에 미명시 | `explore-tools.service.ts:getExecutionDetails` | 시스템 프롬프트 §8에 "running 응답은 조회 시점의 스냅샷" 한 줄 추가 |
| 5 | Architecture | **`ExploreToolsService` Fat Service 경향** — 생성자 파라미터 9개. 워크플로 탐색과 실행 이력 탐색이 단일 서비스에 누적 | `explore-tools.service.ts:constructor` | 도구 2~3개 추가 시점에 `ExecutionExploreService` 분리 검토 |
| 6 | Architecture | **도구 추가 시 Shotgun Surgery** — 탐색 도구 1종 추가 시 4개 파일 동시 수정 불가피 | `tool-definitions.ts`, `explore-tools.service.ts`, stream service, module | `IExploreTool` 인터페이스 + 레지스트리 패턴 도입 검토 (현 규모에서는 즉각 리팩토링 비용 높음) |
| 7 | API Contract | **`hint` 필드가 `INVALID_ID` 에러에만 부분 적용** — LLM 오류 해석 일관성 저하 | `explore-tools.service.ts` 에러 반환 지점 | 모든 에러에 `hint` 추가하거나 의도를 spec에 명시 |
| 8 | API Contract | **`triggerId` 필드가 spec §4.1 응답 컬럼에 미기재** | `spec/3-workflow-editor/4-ai-assistant.md §4.1` | spec §4.1에 `triggerId?` 추가 |
| 9 | Maintainability | **`subExecutionsTruncatedDepth` 값 `1` 하드코딩** | `explore-tools.service.ts:getExecutionDetails` | `const SUB_EXECUTION_INCLUDED_DEPTH = 1;` 상수 선언 |
| 10 | Maintainability | **dispatch의 빈 문자열 기본값** — `asString(args.id, '')` 로 `id` 미전달 시 `INVALID_ID`로 분류되어 실제 원인 감춤 | `workflow-assistant-stream.service.ts:case 'get_execution_details'` | `args.id`가 string인지 선검사 후 없으면 `MISSING_ARGUMENT` 반환 검토 |
| 11 | Dependency | **`ExecutionsService` 우회로 향후 RBAC 누락 위험** — Repository 직접 주입으로 cross-cutting concern 자동 상속 불가. 주석 명시됨 | `explore-tools.service.ts`, `workflow-assistant.module.ts` | `ExecutionsService` 규칙 추가 시 이 서비스도 함께 점검하도록 리뷰 체크리스트 추가 |
| 12 | Scope | **`tool-call-badge.tsx` 한국어 인라인 주석** — 다른 분기는 주석 없음. 규약 불일치 | `tool-call-badge.tsx:summarize()` | 주석 제거 또는 한 줄 영문으로 교체 |
| 13 | Side Effect | **`getCount()` + `.limit(1)` 조합 효과 없음** — TypeORM의 `getCount()`는 LIMIT 무시 | `explore-tools.service.ts` — grandchild 확인 블록 | `.limit(1).getMany().then(r => r.length > 0)` 또는 `getExists()`(TypeORM 0.3+) |
| 14 | Testing | **`getWorkflowExecutions` 빈 결과 케이스 미명시** — `items: []`와 `nodeStats` fallback 명시적 assert 없음 | `explore-tools.service.spec.ts` | 별도 it 블록으로 빈 배열 응답 검증 |
| 15 | Testing | **단일 자식 실행만 테스트** — `Promise.all` 병렬 경로, 혼합 상태 자식 케이스 없음 | `explore-tools.service.spec.ts:subExecutions` | 자식 2건(completed + failed) 케이스 추가 |
| 16 | Documentation | **`executionNotInScope` i18n 키 사용 위치 불명확** | `en.ts`, `ko.ts`, spec §13 | spec §13 테이블에 "표시 위치" 열 추가 |
| 17 | Requirement | **Memory 문서와 실제 구현 괴리** — "ExecutionsService 어댑터" 명시했으나 실제는 Repository 직접 주입 | `memory/workflow-assistant-execution-tools-decisions.md` | memory 문서를 실제 구현으로 갱신 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Database | **MEDIUM** | `loadTimeline` row 상한 없음, N+1 자식 타임라인, 인덱스 미확인 |
| Testing | **MEDIUM** | `isExecutionInScope` 분기 미검증, 배지 테스트 없음, Dead Mock |
| Requirement | **MEDIUM** | i18n 키 3개 배지 미연결, plan 문서 미갱신 |
| Maintainability | **LOW–MEDIUM** | 상태 enum 중복, 직렬 쿼리, i18n 미연결 |
| Performance | **LOW** | `loadNodeStats` 앱 레벨 집계, N+1 자식 타임라인, 인덱스 의존 |
| Architecture | **LOW** | N+1 재현, Fat Service 경향, Shotgun Surgery |
| Security | **LOW** | workspace 검증 순서, 마스킹 suffix 노출, 부모 조회 조건 없음 |
| Documentation | **LOW** | i18n 키 사용처 불명확, plan 체크박스 미갱신 |
| Dependency | **LOW** | Repository 직접 주입 기술 부채 |
| API Contract | **LOW** | hint 필드 불균일, triggerId spec 불일치 |
| Concurrency | **LOW** | Running 스냅샷 비원자성 (의도된 동작) |
| Scope | **LOW** | tsconfig 변경 스코프 이탈, 포맷팅 diff 노이즈 |
| Side Effect | **LOW** | 생성자 아리티 변경 영향, directChildren take 무제한 |

---

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상 발견사항을 제출함

---

## 권장 조치사항

1. **[즉시] i18n 키 배지 연결** — `tool-call-badge.tsx:summarize()`에 `useTranslation` 적용하거나 spec §13에서 미사용 키 제거. 한국어 사용자에게 영어 텍스트가 노출되는 실사용 버그
2. **[즉시] `isExecutionInScope` 누락 테스트 추가** — "부모 있으나 제3의 워크플로" 경로 검증 케이스. 핵심 보안 경계의 분기가 미검증 상태
3. **[즉시] `plan/` 체크박스 갱신** — 완료 항목 `[x]` 표시 또는 아카이빙 (CLAUDE.md 규약)
4. **[단기] N+1 자식 타임라인 최적화** — `In(childIds)` 단일 쿼리 + 메모리 그룹핑
5. **[단기] 인덱스 확인 및 마이그레이션 추가** — `parent_execution_id`, `(workflow_id, started_at DESC)`
6. **[단기] `loadTimeline` row 상한 추가** — `take: 500` + `timelineTruncated` 플래그
7. **[단기] `tool-call-badge.tsx` 테스트 추가** — 신규 배지 분기 3케이스 이상
8. **[중기] 상태 enum 단일 소스 관리** — `EXECUTION_STATUS_VALUES` 공통 위치로 이동
9. **[중기] `loadNodeStats` DB GROUP BY 전환** — 앱 레벨 집계를 DB 레벨로
10. **[중기] `getExecutionDetails` 직렬 쿼리 병렬화** — `Promise.all([loadTimeline, findChildren])`
11. **[장기] `ExecutionExploreService` 분리 검토** — 도구 2~3개 추가 시점에 Fat Service 리팩토링