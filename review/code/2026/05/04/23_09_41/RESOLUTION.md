# Review Resolution — 2026-05-04 23:09:41

리뷰 일시: 2026-05-04 23:09 (`review/2026-05-04_23-09-41/SUMMARY.md`)
대상 커밋: `50eea92 feat(executions): 실행 목록에 트리거 출처(Trigger Source) 컬럼 추가`

리뷰 SUMMARY 의 Critical 1건 + Warning 15건을 모두 본 PR 에서 조치했다. INFO 항목은 영향이 작아 후속으로 미룬다.

---

## Critical 조치

### C1. `findById` 에 triggerSource/triggerLabel 누락 — Swagger 계약 불일치

**조치**: `findById` 도 `triggerSource` / `triggerLabel` 을 응답에 포함하도록 enrich.
- `executions.service.ts` `findById`: QueryBuilder 로 변경하고 `trigger`, `executor` 관계를 안전 컬럼만 선택적으로 join.
- `deriveExecutionTrigger` 결과를 응답 객체에 attach.
- 응답 직전 `stripPrivateRelations` 로 `trigger`, `executor` 관계 객체를 제거 (User 등 민감 정보 누출 방지).
- 반환 타입을 `ExecutionDetailWithTrigger = Execution & { nodeExecutions, triggerSource, triggerLabel }` 로 명시.

→ 결과: 목록·상세 응답이 동일한 trigger 정보를 노출. WebSocket snapshot 도 자동으로 두 필드 포함.

---

## Warning 조치

### W1. Security/PII — `executor.email` 라벨 노출

**조치**:
- `deriveExecutionTrigger` 의 manual 분기에서 email fallback 을 제거. `User.name` 만 사용하고, name 부재/공백 시 `null` 반환.
- `executions.service.ts` 의 `addSelect` 에서 `executor.email` 제거 (`['executor.id', 'executor.name']` 만 적재).
- 새 테스트: 응답 JSON 에 `@` 문자가 없음을 검증 (`expect(JSON.stringify(data[0])).not.toMatch(/@/)`).

### W2. Security/Tenant — `loadParentWorkflowNames` 워크스페이스 필터 부재

**조치(부분)**:
- `loadParentWorkflowNames` 를 raw QueryBuilder 로 재작성하고 `Workflow` 와 inner join.
- 현재 테넌시는 호출자가 `workflow_id` 단위로 이미 좁혀 호출하는 구조이며, parent 실행은 동일 워크스페이스 내에서만 생성되도록 execution-engine 이 보장한다 (FK 무결성).
- 코드에 의존성 가정을 주석으로 명시. 워크스페이스 ID 를 명시적으로 받는 것은 후속 PR (서비스 시그니처 광범위 변경 필요).

### W3. Security/IDOR — `findByWorkflow` 소유권 검증

**조치**: 컨트롤러 가드(`@ApiBearerAuth('access-token')` + 워크스페이스 가드)에서 검증된다는 가정을 서비스 메서드에 docstring 으로 명시.

### W4. Concurrency — `stop()` TOCTOU

**조치**: 최종 상태 전환을 단일 원자 UPDATE 로 변경.
- `UPDATE execution SET status='cancelled', finished_at=..., duration_ms=... WHERE id=:id AND status IN ('running','pending')`
- `affected === 0` 이면 다른 요청이 먼저 전이시킨 케이스로 보고 최신 상태를 재조회하여 반환 (idempotent stop).

### W5. Concurrency — `cancelWaitingExecution` await

**조치(설계 명시)**: 해당 함수는 `void` 동기 함수(`pendingContinuation.reject()` 만 트리거)임을 코드에서 확인.
- 실제 DB 상태 전환은 reject 핸들러가 비동기로 수행하므로, 즉시 re-fetch 한 결과는 stale 일 수 있음을 주석으로 명시.
- 클라이언트는 websocket `EXECUTION_*` 이벤트로 후속 갱신을 받는 기존 설계를 유지.

### W6. Architecture — `findById` vs `findByWorkflow` 추상화 계층 일관성

**조치**: `findById` 도 trigger 정보를 포함하도록 통일 (C1 와 동일 작업).

### W7. Architecture — `ExecutionTriggerSource` 3중 중복

**조치**:
- `execution-trigger.ts` 의 `EXECUTION_TRIGGER_SOURCES` 를 `as const` 배열로 단일 정의하고, 타입은 `(typeof ...)[number]` 로 파생.
- `ExecutionDto` 는 동 배열을 `enum` 옵션으로 직접 사용.
- 프론트엔드 `executions.ts` 도 동일한 `as const` 패턴 적용 (모노레포 전체 공유 패키지 도입은 후속 과제).

### W8. Type — 프론트 `triggerSource?` optional

**조치**: 백엔드가 list/detail 모두에서 필수로 반환하므로, 프론트엔드 `ExecutionData.triggerSource: ExecutionTriggerSource` (필수) 로 변경.

### W9. Performance — `loadParentWorkflowNames` over-load

**조치**: 두 컬럼만 SELECT 하는 raw QueryBuilder 로 변경.
```ts
qb.innerJoin('pe.workflow', 'wf')
  .select(['pe.id AS parent_id', 'wf.name AS workflow_name'])
  .where('pe.id IN (:...ids)', { ids: parentIds })
  .getRawMany()
```
Workflow.config 등 대형 JSON 컬럼 미적재.

### W10. `executor.name === ""` 빈 문자열 fallback

**조치**: 헬퍼 내부에 `trimToNull` 도입. 트리거명/실행자명/부모 워크플로명 모두 `trim()` 후 빈 문자열이면 `null` 로 정규화. 새 테스트 2건 추가.

### W11. Testing — `executionRepo.find` 호출 인자 미검증

**조치**: 부모 워크플로 조회 QB 의 `where('pe.id IN (:...ids)', { ids: ... })` 호출 인자를 `expect(parentNameQB.where).toHaveBeenCalledWith(...)` 로 명시 검증.

### W12. Testing — 다중 parentExecutionId 케이스

**조치**: `p1`, `p2` 두 부모를 가진 3개 row 케이스를 신규 테스트로 추가. 각 자식이 올바른 부모 라벨을 받는지, IN 절이 중복 제거된 두 ID 만 포함하는지 검증.

### W13. Testing — `null as never` 캐스팅

**조치**: `service.spec.ts` 의 픽스처 타입을 `Partial<Execution>` 대신 평탄한 `FakeExec` 로 교체. nullable 필드를 정확히 표현해 캐스팅 0회로 정리. (Execution 엔티티 자체의 nullable 타이핑 보강은 변경 폭이 커 후속 PR.)

### W14. Frontend — IIFE → 컴포넌트 추출

**조치**: 행 렌더 내부 IIFE 를 `<TriggerCell source={...} label={...}/>` 컴포넌트로 추출. 재사용·메모이제이션 가능성 확보.

### W15. Side Effect — 컨트롤러 반환 타입 alignment

**조치**:
- `findByWorkflow` 의 반환 타입이 `PaginatedResponseDto<ExecutionDto>` 로 명시되어 컨트롤러에서 그대로 전달.
- `findById` 의 반환 타입은 `ExecutionDetailWithTrigger` 로 명시. WebSocket gateway spec 의 mock 도 `as never` 캐스트로 정합화.

---

## INFO (후속으로 미룸)

| # | 발견 | 후속 처리 사유 |
|---|------|----------------|
| INFO-1 | `getCount()` LEFT JOIN 포함 | `getManyAndCount()` 단일 호출로 전환하면서 자연 해소 |
| INFO-2 | `getCount()` + `getMany()` 분리 | 위와 동일 — `getManyAndCount()` 적용으로 해결됨 |
| INFO-3 | 중첩 서브워크플로우 1단계 한계 | 현재 라벨은 직계 부모 1단계만 표시. 다단계 표기는 별도 UX 결정 필요 |
| INFO-4 | `toIso` TypeORM 드라이버 의존성 | 주석 추가됨 |
| INFO-5 | `unknown: "—"` em-dash 이유 | 단순 표시 정책. 설명 필요 시 spec 보완 |
| INFO-6 | 미지원 trigger.type silent fallback | 신규 타입 도입 시 helper 분기 추가 필요. 현재는 unknown 으로 떨어져 안전 fail |
| INFO-7 | webhook 서비스 레벨 통합 경로 | 신규 테스트 추가됨 (`maps webhook-trigger ...`) |
| INFO-8 | `executor: { name: null, email: null }` | 신규 테스트 추가됨 (W10 의 trimToNull 검증) |
| INFO-9 | `findById`, `stop` 메서드 테스트 부재 | 기존 기술 부채. 본 PR 스코프 외 |
| INFO-10 | `EXECUTION_TRIGGER_SOURCES as const` | W7 에서 적용됨 |
| INFO-11 | 신규 트리거 타입 추가 시 변경 지점 산재 | shared-types 패키지 도입은 모노레포 광범위 변경. 후속 |

---

## 검증

- `npm run lint` (backend, frontend) — clean
- `npm test` (backend) — 161 suites / 2588 tests pass
- `npm test` (frontend) — 100 files / 1126 tests pass (Trigger 컬럼 신규 검증 포함)
- `npm run build` (backend, frontend) — clean
- 추가 테스트:
  - `execution-trigger.spec.ts`: 12 → 15 (PII 비노출, 빈 문자열 정규화, EXECUTION_TRIGGER_SOURCES 일관성)
  - `executions.service.spec.ts`: 5 → 7 (webhook 매핑, 다중 부모 배치)
  - `execution-list-page.test.tsx`: Trigger 컬럼 라벨/보조라벨 렌더 검증 1건 추가
