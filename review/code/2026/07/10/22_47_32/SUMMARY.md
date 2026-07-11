# AI Code Review SUMMARY

- **대상**: `getStatus()` 2단계 컬럼 projection (`origin/main...HEAD`)
- **일시**: 2026-07-10 22:47:32
- **실행 reviewer**: 10 (performance / database / security / concurrency / requirement / testing / side-effect / api-contract / scope / maintainability)
- **skip**: dependency (의존성 변경 없음), documentation (JSDoc 만), architecture (구조 변경 없음), user-guide-sync (매트릭스 trigger 해당 없음)
- **호출 경로**: 자동 트리거 → 평문 Agent fan-out (Workflow 비동기 간극 회피)

## 종합 위험도: LOW — **Critical 0건**

| reviewer | STATUS | 위험도 | Critical | Warning |
| --- | --- | --- | --- | --- |
| security | OK | NONE | 0 | 0 |
| requirement | OK | NONE | 0 | 0 |
| side-effect | OK | NONE | 0 | 0 |
| scope | OK | NONE | 0 | 0 |
| database | OK | LOW | 0 | 1 |
| concurrency | OK | LOW | 0 | 0 |
| api-contract | OK | LOW | 0 | 0 |
| performance | OK | LOW | 0 | 2 |
| maintainability | OK | LOW | 0 | 2 |
| testing | OK | **MEDIUM** | 0 | 2 |

## 핵심 확인 (Critical 부재 근거)

- **secret egress 불변식 유지** (security): 소스가 `execution.conversationThread` → `threadRow.conversationThread` 로 바뀌었지만 `redactThreadForPublic` 재배선 정확. 1단계 select 에 `conversationThread` 가 없어 배선이 깨지면 `undefined` 로 **즉시 드러나는** 구조. 신규 마스킹 테스트는 vacuous 아님(1단계 mock 에서 thread 제거 → 배선 회귀 시 `TypeError`).
- **wire 계약 무변경** (api-contract, requirement): §5.3 9개 필드 line-by-line 대조. `updatedAt` fallback 침묵 회귀 위험은 `startedAt`/`finishedAt` projection 포함 + 실값 단언 테스트로 차단.
- **partial entity 누출 없음** (side-effect): `getStatus()` 는 항상 새 DTO 를 조립해 반환. 유일한 호출자는 `interaction.controller.ts`. TypeORM 0.3 은 identity map 미사용.
- **race 신규 아님** (concurrency): "waiting 인데 nodeExec null" race 는 **변경 전에도 존재**. `conversation_thread` 는 park 커밋 시점에만 갱신돼 T1~T2 구간 불변.
- **인가 스코프 동일** (security): 1·2단계 모두 `where: { id: ctx.executionId }`.

## Warning (조치 대상)

### W-1 [testing, MEDIUM] stage-2 쿼리의 `where`(executionId) 미단언 — 인가 경계 무검증
`select` 배열만 검사하고 stage-2 가 **같은 executionId** 를 조회하는지 단언이 없다(`nodeRepo.findOne` 에 대한 `toHaveBeenCalledWith` 0건). EIA 는 토큰이 특정 executionId 로 scope 되는 모델이라, stage-2 가 다른 executionId 를 조회하는 버그를 이 스위트가 전혀 검출하지 못한다.
→ **조치**: stage-2 execution 쿼리 + nodeExecution 쿼리의 `where` 단언 추가.

### W-2 [maintainability] projection 리터럴 3중 SoT + 컬럼명 오기 시 침묵 회귀
`select: ['id',...]` 인라인 리터럴이 (a) DTO 조립 코드 (b) 테스트 `BASE_COLUMNS` 와 암묵 동기화돼야 한다. 컬럼명을 오기하거나 향후 필드 추가 시 select 갱신을 잊으면 `undefined` → fallback 으로 조용히 잘못된 값이 나간다. 같은 파일에 `TERMINAL_STATUSES`/`SSE_SEQ_PLACEHOLDER` 모듈 상수 선례 있음.
→ **조치**: `STATUS_PROJECTION_COLUMNS` 모듈 상수 + `satisfies (keyof Execution)[]` 로 **컴파일 타임** 오기 차단.

### W-3 [testing] 기존 waiting 테스트 4건이 stage 를 구분하지 못함 (vacuous 위험)
`repo.findOne.mockResolvedValue(...)` 가 모든 호출에 같은 객체를 반환 → 구현이 2단계 분리를 되돌려도 green. 신규 테스트가 실질적으로 상쇄 중이나, 향후 신규 블록이 약화되면 갭이 드러난다.
→ **조치**: 해당 4건에 "stage 를 구분하지 않는다" 명시 주석 + 신규 테스트가 가드함을 링크.

### W-4 [performance] `Promise.all` 상쇄 주장의 주석 표현 부정확
`Promise.all` 은 **왕복 depth**(2단계)를 보존할 뿐, 늘어난 총 쿼리 수(2→3)와 peak 커넥션(1→2)을 상쇄하지는 않는다. database reviewer 는 "latency depth 그대로 유지, PK 단건이라 부담 미미" 로 판단 — 두 판단은 **latency vs 총 쿼리 수**를 각각 말한 것으로 모순 아님.
→ **조치**: 주석을 "왕복 depth 보존(대신 PK 조회 1회 추가)" 로 정밀화.

## Info (반영할 것 + 기록만)

- **[requirement, 반영]** JSDoc 의 "500 turn × turn 당 4000자" 는 **서로 다른 두 cap 의 합성**. `STORAGE_MAX_TURNS=500` 은 §4 storage cap 이 맞지만, `MAX_TURN_TEXT_CHARS=4000` 은 `thread-renderer.ts:106` 의 **LLM 주입 시점(§5.3) cap** 이며 append 시 truncate 하지 않는다(`applyCharCaps` 는 render 경로). 즉 저장 turn 텍스트는 무제한 → 실제 worst-case 행 크기는 추정치보다 **클 수 있다**(최적화 근거는 오히려 강화).
  → 주석 수치 정정.
- **[testing, 반영]** `expect.arrayContaining` 은 **초과 컬럼**을 못 잡는다 → 정확 집합 비교로 강화.
- **[testing, 반영]** `waiting` + 대기 nodeExec 없음 + thread 존재 조합 미검증 (thread 를 fetch 하고 버림). 현재 동작을 테스트로 고정.
- **[performance, 기록]** F6 — 부수적 이득: 종전엔 `input_data`/`error`/`user_variables`/`resume_call_stack` 등 **다른 jsonb 컬럼도 매번** 통째로 읽었다. 2단계 `select: ['id','conversationThread']` 로 이들도 제거돼 실제 절감은 서술보다 크다. F4(waiting 비중이 높으면 실익 축소) 우려를 상당 부분 상쇄.
- **[performance, 기록]** F4 — 배포 후 상태별 호출 비중 계측 권장. **후속 plan 없이 기록만**(계측 인프라 부재, 본 PR 범위 밖).
- **[performance, 기록]** F8 — `redactThreadForPublic` 의 O(thread) 비용이 waiting 폴링마다 반복(변경 전부터 존재, 회귀 아님). 향후 더 큰 절감처.
- **[performance, 기각]** F5 — LEFT JOIN 단일 쿼리 병합 제안. 이득 서브ms 수준이고 `nodeExecution` 은 `relations:['node']` 를 쓰는 별도 repo 조회라 병합 시 쿼리 복잡도가 급증. **채택하지 않음**.
- **[api-contract, 기록]** 2단계 null → 404 미승격 결정 타당. execution row 는 hard-delete 경로가 없다(검색 0건).
- **[maintainability, 기록]** `getStatus()` 헬퍼 추출은 현시점 YAGNI.
