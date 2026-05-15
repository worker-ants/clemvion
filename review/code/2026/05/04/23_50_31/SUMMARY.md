# Code Review 통합 보고서

> 대상 커밋: `5fb1de1` feat(dashboard): 최근 실행 위젯에 Trigger 출처 컬럼 추가
> 리뷰 일시: 2026-05-04

## 전체 위험도
**MEDIUM** — 프론트엔드 `TriggerCell`의 방어 코드 부재로 인한 런타임 크래시 경로가 명확히 존재하며, 테스트 커버리지 공백과 모듈 경계 위반이 복합적으로 남아 있음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / API Contract / Requirement | `TRIGGER_ICON[source]`가 `undefined`를 반환할 경우 `<Icon />` 렌더 크래시 발생. 배포 순서 불일치(프론트 먼저 배포) 또는 백엔드에서 새 trigger type 추가 시 재현 가능 | `trigger-cell.tsx:33` | `const Icon = TRIGGER_ICON[source] ?? HelpCircle;` 으로 fallback 처리 (`TRIGGER_LABEL_KEY`도 동일하게 적용) |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Dependency | `dashboard` 모듈의 DTO와 서비스가 `executions` 모듈의 내부 유틸 경로를 직접 참조. `executions` 내부 리팩터링 시 `dashboard`에 파급되는 암묵적 결합 | `dashboard-response.dto.ts:3-5`, `dashboard.service.ts:10-14` | 공유 타입·상수를 `src/common/`으로 이동하거나 `executions/index.ts` 배럴 export로 공개 API만 노출 |
| 2 | Architecture | `loadParentWorkflowNames`가 `executions/utils/`에 위치하면서 두 모듈에서 사용됨. 소속 위치와 소비 범위 불일치 | `load-parent-workflow-names.ts` | `backend/src/common/utils/`로 이동 또는 `executions` 배럴 export로 노출 |
| 3 | API Contract | `triggerLabel` 선택성 불일치: 서비스 인터페이스는 `string \| null`(required), DTO는 optional. Swagger 스키마 혼란 유발 | `dashboard.service.ts` vs `dashboard-response.dto.ts` | DTO를 `triggerLabel: string \| null`(non-optional)로 통일 |
| 4 | Requirement / Performance | `getRecentExecutions`에서 `innerJoinAndSelect('e.workflow', 'w')`로 Workflow 전체(config JSON 포함) 로드. 실제 사용 필드는 `w.name`뿐 | `dashboard.service.ts:145` | `.innerJoin('e.workflow', 'w').addSelect(['w.id', 'w.name'])` 으로 변경 |
| 5 | Performance | `loadParentWorkflowNames`를 `parentExecutionId` 없는 경우에도 무조건 호출. 대시보드 핫 패스에서 불필요한 async 오버헤드 | `dashboard.service.ts:155-158` | `executions.some((e) => e.parentExecutionId != null)` 조건부 호출 |
| 6 | Security | `findById`에 워크스페이스 격리 없음. 가드 누락·우회 시 IDOR 위험 | `executions.service.ts — findById` | `workspaceId` 파라미터 추가 후 서비스 레이어에서 직접 필터링 |
| 7 | Security | `executedBy` 필드가 이메일을 저장하는 경우 API 응답에 PII 노출 가능성 | `executions.service.ts — toExecutionDto():237` | 컬럼이 이메일인지 UUID인지 확인 후 이메일이면 제거 또는 마스킹 |
| 8 | Testing | `as never` / `as unknown` 타입 우회가 테스트 전반에 광범위하게 사용 — 타입 안전망 약화 | `dashboard.service.spec.ts` 전반, `websocket.gateway.spec.ts:147` | `websocket.gateway.spec.ts`는 필수 필드를 채운 완전한 Mock; `FakeExec`은 `Pick<Execution, ...>`으로 교체 |
| 9 | Testing | `load-parent-workflow-names.ts` 독립 테스트 파일 없음. 두 모듈에서 공유하는 핵심 유틸인데 커버리지 공백 | `load-parent-workflow-names.ts` | `load-parent-workflow-names.spec.ts` 신규 작성 |
| 10 | Testing | `TriggerCell` 공유 컴포넌트 테스트 없음. 미지원 source 케이스 포함 미검증 | `trigger-cell.tsx` | 5가지 source 렌더, `label: null`, 미지원 source fallback 케이스 |
| 11 | Testing | "parent 못 찾음" 케이스와 `triggerSource: 'unknown'` 케이스 미검증 | `dashboard.service.spec.ts:102-118` | 두 케이스를 별도 `it()` 블록으로 추가 |
| 12 | Maintainability | 리밋이 백엔드 `.limit(10)`과 프론트엔드 `.slice(0, 10)`에 이중 선언 | `dashboard.service.ts`, `dashboard/page.tsx` | 백엔드에 상수 추출, 프론트엔드의 `.slice(0, 10)` 제거 |
| 13 | Database | `getRecentWorkflows`의 `orderBy('w.updated_at', 'DESC')`가 DB 컬럼명 사용 — TypeORM 버그 재발 위험 | `dashboard.service.ts — getRecentWorkflows` | `orderBy('w.updatedAt', 'DESC')`로 통일 |
| 14 | Side Effect | 배포 순서 불일치 시 React Query 캐시에 `triggerSource` 없는 데이터가 남아 Critical #1 촉발 | `dashboard/page.tsx:53-55` | Critical #1 방어 코드 추가 + 배포 순서(백엔드 → 프론트) 보장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | DTO 레이어가 `EXECUTION_TRIGGER_SOURCES` 런타임 상수를 import — 도메인 로직 모듈과 결합 강화 | `dashboard-response.dto.ts:3` | `common/constants/`로 이동 또는 DTO 내 인라인 배열 정의 |
| 2 | Architecture | 단위 테스트 패턴 혼재: 직접 생성자 주입 vs `Test.createTestingModule()` | `dashboard.service.spec.ts`, `websocket.gateway.spec.ts` | 프로젝트 레벨에서 단위 테스트 패턴 표준 문서화 |
| 3 | Testing | `FakeExec` 수동 복제 — 엔티티 변경 시 false-positive 위험 | `dashboard.service.spec.ts:3-16` | `Pick<Execution, ...>` 형태로 엔티티에서 직접 파생 |
| 4 | Testing | Mock QBuilder의 `where` 인자 미검증 — workspaceId 격리 버그 통과 가능 | `dashboard.service.spec.ts:42-50` | `expect(listQB.where).toHaveBeenCalledWith(...)` 단언 추가 |
| 5 | Security | `@` 기호로만 이메일 비노출 검증 — 이메일 없는 PII 탐지 불가 | `dashboard.service.spec.ts:83` | 민감 필드가 직렬화 결과에 없음을 명시적으로 단언 |
| 6 | Security | `triggerLabel`의 HTML `title` 신뢰 경계 미문서화 (현재는 안전) | `trigger-cell.tsx:48` | 코드 주석으로 신뢰 경계 명시 |
| 7 | Database | `executions.workflow_id`, `workflows.workspace_id` 인덱스 부재 시 성능 저하 가능 | `dashboard.service.ts` | 두 인덱스 존재 여부 확인 및 마이그레이션 추가 |
| 8 | Database | `getSummary` 초반 count 쿼리 2개 순차 실행 (독립적이므로 병렬화 가능) | `dashboard.service.ts — getSummary` | `Promise.all([...])` 으로 병렬화 |
| 9 | Documentation | `dashboard-response.dto.ts` JSDoc에 하드코딩된 파일 경로 — stale 주석 위험 | `dashboard-response.dto.ts` | `{@link ExecutionTriggerSource}` JSDoc 링크로 교체 |
| 10 | Documentation | `TriggerCell` 공유 컴포넌트 레벨 문서 없음 (`label: null` 동작 등) | `trigger-cell.tsx` | 간단한 JSDoc 한 줄 추가 |
| 11 | Documentation | `RecentExecution` 인터페이스 신규 필드에 JSDoc 미기재 | `dashboard.service.ts` | null 의미를 명시하는 한 줄 JSDoc 추가 |
| 12 | Maintainability | `loadParentWorkflowNames`의 raw SQL alias 패턴이 주변 `addSelect` 패턴과 불일치 | `load-parent-workflow-names.ts` | `getRawMany` + raw alias 사용이 의도적임을 주석으로 명시 |
| 13 | Requirement | `dashboard/page.tsx`의 `RecentExecution` 로컬 정의 — 백엔드 DTO 변경 시 수동 동기화 필요 | `dashboard/page.tsx:53-60` | `@/lib/api/dashboard`에서 타입 export 후 재사용 |
| 14 | Scope | `executions/page.tsx` 인라인 `TriggerCell` 제거 후 빈 줄 1개 잔여 | `executions/page.tsx` | 빈 줄 제거 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | **MEDIUM** | TriggerCell undefined source 크래시, 배포 순서 불일치 시 캐시 이슈 |
| Security | **LOW~MEDIUM** | `findById` IDOR 위험, `executedBy` PII 미확인 |
| Testing | **MEDIUM** | 공유 유틸·컴포넌트 테스트 부재, `as never` 타입 우회, 엣지 케이스 미검증 |
| Architecture | **LOW** | dashboard→executions 모듈 경계 위반 |
| API Contract | **LOW** | `triggerLabel` 선택성 불일치, TriggerCell 방어 부재 |
| Performance | **LOW** | `loadParentWorkflowNames` 무조건 호출, Workflow 전체 컬럼 over-fetch |
| Requirement | **LOW** | TriggerCell 방어 코드 부재, Workflow over-fetch |
| Maintainability | **LOW** | `as never` 광범위 사용, 매직 넘버 이중 선언, `FakeExec` 수동 정의 |
| Dependency | **LOW** | 크로스 모듈 내부 유틸 직접 참조 |
| Database | **LOW** | `getRecentWorkflows` orderBy 컬럼명, 인덱스 존재 여부 미확인 |
| Documentation | **LOW** | JSDoc 하드코딩 경로, `TriggerCell` 문서 부재 |
| Concurrency | **LOW** | 신규 코드 공유 상태 없음. `getSummary` 일부 병렬화 가능 |
| Scope | **NONE** | 기능 범위 내 변경만 확인됨 |

---

## 발견 없는 에이전트

- **Scope**: 모든 변경이 기능 범위 내에 포함됨. 의도 범위를 벗어난 확장 없음.
- **Concurrency**: 신규 코드에 공유 변경 가능 상태, 락, 경쟁 조건 없음.

---

## 권장 조치사항

1. **[즉시] TriggerCell fallback 처리** — `TRIGGER_ICON[source] ?? HelpCircle`, `TRIGGER_LABEL_KEY[source] ?? 'executions.triggerSource.unknown'`으로 방어 코드 추가
2. **[즉시] Workflow 전체 컬럼 over-fetch 수정** — `innerJoinAndSelect` → `.innerJoin().addSelect(['w.id', 'w.name'])`으로 변경
3. **[즉시] `getRecentWorkflows` orderBy 수정** — `w.updated_at` → `w.updatedAt`으로 통일 (TypeORM 버그 재발 방지)
4. **[단기] 모듈 경계 정리** — `ExecutionTriggerSource`, `EXECUTION_TRIGGER_SOURCES`, `loadParentWorkflowNames`를 `common/` 또는 `executions` 배럴 export로 이전
5. **[단기] 테스트 보강** — `load-parent-workflow-names.spec.ts` 신규 작성, `TriggerCell` 렌더 테스트 추가, "parent 못 찾음"·"unknown source" 케이스 추가
6. **[단기] `triggerLabel` DTO 선택성 통일** — `string | null`(non-optional)로 변경
7. **[중기] `findById` IDOR 대응** — 서비스 레이어에 `workspaceId` 파라미터 추가
8. **[중기] `executedBy` PII 확인** — 이메일인 경우 API 응답에서 제거
9. **[중기] `loadParentWorkflowNames` 조건부 호출** — `hasSubworkflow` 가드 추가
10. **[중기] DB 인덱스 확인** — `executions.workflow_id`, `workflows.workspace_id` 인덱스 존재 여부 확인 및 마이그레이션 추가
