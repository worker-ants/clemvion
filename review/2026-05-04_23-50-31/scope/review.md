## 발견사항

### [INFO] `executions.service.ts` — private 메서드 제거 및 공유 유틸리티 추출
- **위치**: `executions.service.ts` L188–L222 (제거된 `loadParentWorkflowNames`)
- **상세**: `DashboardService`에서 동일 로직이 필요해 코드 중복을 방지하기 위한 추출. 직접 요청 범위(`dashboard` 기능 추가)를 벗어나지만, 이 추출 없이는 `dashboard.service.ts`에 동일 코드를 복사해야 했음.
- **제안**: 현재 구조가 적절. 변경 불필요.

### [INFO] `executions/page.tsx` — 인라인 `TriggerCell` 제거
- **위치**: `executions/page.tsx` L82–L119 (삭제된 블록)
- **상세**: 대시보드 페이지에서 동일 컴포넌트가 필요해 `trigger-cell.tsx`로 추출한 변경. 기능 동작은 100% 동일하게 유지되며, 불필요한 행동 변화 없음.
- **제안**: 현재 구조가 적절. 변경 불필요.

### [INFO] `websocket.gateway.spec.ts` — `as never` 타입 캐스트 추가
- **위치**: L147
- **상세**: `ExecutionDetailWithTrigger` 타입에 `triggerSource`/`triggerLabel` 필드가 추가되면서 기존 모의값이 타입 오류를 유발. `as never`로 우회한 점은 이전 `as never` 사용(`fakeExecution as never`, L116)과 일관성을 유지함.
- **제안**: 허용 가능하나, 더 명시적으로 하려면 `{ id: 'exec-abc', triggerSource: 'manual', triggerLabel: null } as ExecutionDetailWithTrigger` 형태가 더 안전함. 단, 기존 코드 패턴과의 일관성을 고려하면 현재 방식도 수용 가능.

### [INFO] `dashboard.service.ts` — `orderBy` 필드명 수정
- **위치**: `dashboard.service.ts` diff `-orderBy('e.started_at', 'DESC')` → `+orderBy('e.startedAt', 'DESC')`
- **상세**: 이미 `fix(executions)` 커밋(`0384047`)에서 ExecutionsService에 적용된 동일한 수정을 DashboardService에도 적용. `leftJoin` + TypeORM 조합에서 `started_at`(DB 컬럼명)을 쓰면 메타데이터 조회 실패가 재발하므로 이번 leftJoin 추가로 인해 필수 수정.
- **제안**: 현재 구조가 적절.

---

## 요약

모든 변경사항은 **대시보드 최근 실행 위젯에 Trigger 출처 컬럼을 추가**하는 기능 범위 내에 정확히 포함됩니다. `loadParentWorkflowNames` 유틸리티 추출과 `TriggerCell` 컴포넌트화는 코드 중복을 방지하기 위한 필연적 부수 효과이며, `websocket.gateway.spec.ts` 수정은 타입 시스템 호환성 유지를 위한 불가피한 변경입니다. `orderBy` 필드명 수정 역시 이번 `leftJoin` 추가로 인해 새롭게 필요해진 버그 수정입니다. 의도 범위를 벗어난 기능 확장, 관련 없는 리팩토링, 또는 무관한 파일 수정은 발견되지 않습니다.

## 위험도

**NONE**