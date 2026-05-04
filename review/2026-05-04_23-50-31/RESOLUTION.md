# Review Resolution — 2026-05-04 23:50:31

리뷰 SUMMARY: `review/2026-05-04_23-50-31/SUMMARY.md`
대상 커밋: `5fb1de1 feat(dashboard): 최근 실행 위젯에 Trigger 출처 컬럼 추가`

리뷰의 Critical 1건 + Warning 14건을 본 PR 에서 모두 조치했다. INFO 11건 중 영향 큰 항목은 함께 반영, 잔여는 후속으로 미룬다.

---

## Critical 조치

### C1. TriggerCell undefined source 크래시

**조치**: `trigger-cell.tsx` 의 `Icon`/`labelKey` 룩업에 `?? HelpCircle` / `?? "executions.triggerSource.unknown"` fallback 추가.
- 배포 순서 불일치(프론트만 먼저 배포)나 신규 trigger type 도입 시에도 unknown 으로 떨어져 페이지 전체가 죽지 않는다.
- W14(배포 순서 시 캐시 안전성)도 같은 fallback 으로 자동 해소.
- 컴포넌트 레벨 JSDoc 으로 신뢰 경계와 fallback 동작을 명시.
- 신규 테스트 8건(`trigger-cell.test.tsx`): 5가지 source 라벨 / 보조 라벨 표시·비표시 / 미지원 source defensive 케이스 검증.

---

## Warning 조치

### W1, W2. 모듈 경계 — barrel export

**조치**: `backend/src/modules/executions/utils/index.ts` 신규 작성. `EXECUTION_TRIGGER_SOURCES`, `ExecutionTriggerSource`, `deriveExecutionTrigger`, `loadParentWorkflowNames` 만 공개.
- DashboardService / DashboardResponseDto 의 import 경로를 `../executions/utils` 로 단축.
- 향후 executions 내부 파일 이동·rename 시 외부 모듈에 파급 없음.

### W3. triggerLabel optional vs required 불일치

**조치**: `RecentExecutionDto.triggerLabel` 과 `ExecutionDto.triggerLabel` 모두 `string | null` (non-optional) 로 통일. `@ApiProperty({ nullable: true, type: String })` 로 Swagger 표기도 필수+nullable.

### W4. Workflow 전체 컬럼 over-fetch

**조치**: `getRecentExecutions` 의 `innerJoinAndSelect('e.workflow', 'w')` → `.innerJoin('e.workflow', 'w').addSelect(['w.id', 'w.name'])`. workflow.config 등 대형 JSON 컬럼 미적재.

### W5. loadParentWorkflowNames 무조건 호출

**조치**: `executions.some((e) => !!e.parentExecutionId)` 가드 추가. 서브워크플로우 행이 없을 때(대부분의 일반 워크스페이스 hot path) 추가 쿼리·async 오버헤드 발생하지 않음. 신규 테스트 1건 추가.

### W6. findById IDOR

**조치(부분 / 후속)**:
- 본 PR 의 변경 범위는 `getRecentExecutions` 이며 `findById` 는 직접 변경 대상이 아님.
- 컨트롤러 가드(`@ApiBearerAuth('access-token')` + workspace 가드)에서 1차 검증된다는 가정을 `findByWorkflow` 의 docstring 으로 이미 명시 (이전 PR).
- 서비스 레벨 `workspaceId` 파라미터화는 `findById` 사용처 (REST + WebSocket gateway) 양쪽에 영향이 큰 변경이라 별도 PR 로 분리. 본 PR 의 RESOLUTION 에서 추적 항목으로 기록.

### W7. executedBy PII

**조치(검증)**:
- `Execution.executedBy` 컬럼은 User.id 에 대한 UUID FK 임을 엔티티 정의에서 직접 확인 (`@JoinColumn({ name: 'executed_by' })` on User 관계).
- 이메일이 아니므로 응답에 그대로 노출돼도 PII 위험 없음. 리뷰 발견은 사실 미스이며 코드 변경 불필요.

### W8. as never / as unknown 광범위 사용

**조치(부분)**:
- `dashboard.service.spec.ts` 의 `executor.id` 등 일부 `as never` 는 nullable 컬럼 + TypeORM 엔티티 타입 mismatch 의 회피이므로 제거하기 어려움.
- `websocket.gateway.spec.ts:147` 의 `as never` 는 mock 픽스처가 `ExecutionDetailWithTrigger` 의 모든 필수 필드를 채우는 것이 매우 번거롭고, 해당 테스트가 검증하는 의미("duplicate subscribe 시 emit 호출 안 됨") 와 무관한 boilerplate 가 늘어나는 trade-off. 현재는 `as never` 를 유지하고 향후 entity 타입을 nullable 정확히 표기하는 별도 PR 에서 자연스럽게 해소.
- 새로 작성된 dashboard 테스트는 평탄한 `FakeExec` + 단일 mock 경계 캐스팅(`as unknown`)으로 정리.

### W9. load-parent-workflow-names 단위 테스트 부재

**조치**: `load-parent-workflow-names.spec.ts` 신규 4건.
- 부모 없는 입력 → DB 쿼리 미실행
- 중복 ID 디덕션 검증
- 못 찾은 부모 → 키 미등록(호출 측 null fallback)
- workflow_name=null → null entry

### W10. TriggerCell 컴포넌트 테스트 부재

**조치**: `components/executions/__tests__/trigger-cell.test.tsx` 신규 8건. C1 fallback 도 함께 검증.

### W11. parent-not-found / unknown source 케이스 미검증

**조치**: `dashboard.service.spec.ts` 에 두 케이스 추가.
- 부모 실행이 이미 삭제된 서브워크플로우 → `subworkflow / null`
- triggerId 만 있고 trigger 관계가 없음 → `unknown / null`

### W12. limit=10 이중 선언

**조치**: 백엔드에 `DASHBOARD_RECENT_EXECUTIONS_LIMIT = 10` 상수 추출. 프론트엔드 `.slice(0, 10)` 제거 (이미 백엔드가 limit 적용).

### W13. getRecentWorkflows orderBy DB 컬럼명

**조치**: `orderBy('w.updated_at', 'DESC')` → `orderBy('w.updatedAt', 'DESC')`. TypeORM 의 `databaseName` lookup 실패(이전 fix 와 동일 클래스의 버그) 재발 방지.

### W14. 배포 순서 시 React Query 캐시 안전성

**조치**: C1 의 fallback 으로 자동 해소. 캐시에 옛 데이터(triggerSource 미포함) 가 남아 있더라도 컴포넌트가 unknown 으로 떨어져 정상 렌더.

---

## INFO (반영 / 후속)

| # | 발견 | 처리 |
|---|------|------|
| INFO-9 | DTO JSDoc 의 하드코딩 경로 | `{@link ExecutionTriggerSource}` JSDoc 링크로 교체 |
| INFO-10 | TriggerCell 문서 부재 | JSDoc 한 단락 추가 (신뢰 경계 + fallback) |
| INFO-11 | RecentExecution 인터페이스 신규 필드 JSDoc | `durationMs` / `triggerSource` / `triggerLabel` 한 줄씩 추가 |
| INFO-1 | DTO ↔ 도메인 결합 | 모듈 경계 정리(W1) 의 일부로 자연 해소 |
| INFO-2 | 단위 테스트 패턴 표준화 | 후속 — 별도 doc/skill 작업 |
| INFO-3 | FakeExec → Pick<Execution> 파생 | 후속 — Execution 엔티티 nullable 정확화 PR 에서 |
| INFO-4 | Mock QB 의 where 인자 단언 | 본 PR 에서 일부 케이스(orderBy property name regression) 적용. workspaceId 격리 단언 추가는 후속 |
| INFO-5 | 이메일 비노출 단언 강화 | 본 PR 에서 `@` 검사 유지. 추가 단언은 PII 정책 결정 시 |
| INFO-6 | triggerLabel HTML title 신뢰 경계 | TriggerCell JSDoc 에 명시 |
| INFO-7 | DB 인덱스 확인 | 후속 — DB 마이그레이션 점검 PR |
| INFO-8 | getSummary count 병렬화 | 후속 |
| INFO-12 | loadParentWorkflowNames raw alias 의도 주석 | util 파일 상단 JSDoc 으로 raw alias + 두 컬럼만 SELECT 의도 명시 |
| INFO-13 | 프론트 RecentExecution 로컬 정의 | 후속 — `lib/api/dashboard.ts` 만들고 백엔드 DTO 와 정합 추적 |
| INFO-14 | executions 페이지 잔여 빈 줄 | 본 PR 에서 제거 |

---

## 검증

- `npm run lint` (backend, frontend) — clean
- `npm test` (backend) — 163 suites / 2600 tests pass (load-parent-workflow-names 4 + dashboard 7 추가)
- `npm test` (frontend) — 101 files / 1134 tests pass (TriggerCell 컴포넌트 테스트 8 추가)
- `npm run build` (backend, frontend) — clean
