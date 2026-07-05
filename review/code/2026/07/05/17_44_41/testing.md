# 테스트(Testing) 리뷰 — V-10 트리거 목록 Schedule cron·nextRunAt enrichment

## 발견사항

- **[INFO]** `toHaveBeenCalledTimes(1)` 단언의 "배치 vs N+1" 증명력이 약함 — schedule 트리거가 1건뿐인 fixture
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:324-365` (첫 번째 `it`), `scheduleRepo.find` mock, fixture 는 schedule 타입 트리거 `s-trig` 1건만 포함
  - 상세: 테스트 의도(주석 "N+1 이 아니라 triggerId IN [...] 배치 1회")는 명확하지만, schedule 트리거가 1건일 때는 N+1 이었어도 `scheduleRepo.find`/`findOne` 호출이 1회로 동일하게 관측된다. 즉 이 테스트만으로는 "N개 schedule 행에도 호출이 여전히 1회"라는 배치 특성을 구별하지 못한다 — 구현을 실수로 `data.filter(...).map(t => scheduleRepository.findOne(...))` (per-row loop) 로 되돌려도 (트리거가 1건인 한) 이 테스트는 여전히 통과한다. `expect(scheduleRepo.find).toHaveBeenCalledWith({ where: { triggerId: In(['s-trig']), ... } })` 로 `find` 메서드명과 `In` 사용은 검증되지만, "배치성"의 핵심 증거는 다건 입력에서의 단일 호출 여부다.
  - 제안: fixture 에 schedule 타입 트리거를 2건 이상(`s-trig-1`, `s-trig-2`) 넣고 `scheduleRepo.find` 가 여전히 `toHaveBeenCalledTimes(1)`이며 `In(['s-trig-1', 's-trig-2'])` (양쪽 id 모두 포함)로 호출됨을 단언하면 N+1 회피 주장이 실질적으로 검증된다. 현재는 회귀(N+1 로 되돌아가는 실수)를 잡지 못하는 약한 가드다.

- **[INFO]** cross-workspace 격리(schedule 조회의 `workspaceId` 스코프) 를 직접 검증하는 케이스 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:834-836` (`scheduleRepository.find({ where: { triggerId: In(...), workspaceId } })`)
  - 상세: 구현이 `workspaceId` 를 where 절에 포함시킨 것은 좋으나(다른 워크스페이스의 동일 schedule id 오염 방지), 단위 테스트는 `toHaveBeenCalledWith` 로 호출 인자만 확인할 뿐 "다른 workspace 의 schedule 은 매칭되지 않는다"는 동작을 실제로 검증하는 케이스가 없다(mock 이 인자와 무관하게 스텁된 값을 그대로 반환하므로). e2e 도 단일 workspace 컨텍스트라 이 경계를 커버하지 않는다.
  - 제안: 우선순위는 낮음(where 절 자체가 `toHaveBeenCalledWith` 로 고정 검증되어 회귀 시 실패하긴 함) — 다만 "동일 triggerId, 다른 workspaceId" schedule row 가 매칭되지 않는 것까지 보증하려면 실제 TypeORM 쿼리 레벨 통합 테스트(e2e)가 더 적합. 현재 e2e C-2 는 단일 workspace 내 positive path 만 검증.

- **[INFO]** e2e C-2 가 페이지네이션 경계(스케줄 트리거 수가 `limit` 초과) 를 커버하지 않음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:173-205` (C-2), `?type=schedule&limit=100` 사용
  - 상세: `findAll` 의 `scheduleTriggerIds` 는 `data`(현재 페이지 슬라이스) 기준으로 산출되므로, 페이지 경계를 넘어가는 schedule 트리거가 정확히 자신의 페이지에서만 enrichment 되는지는 로직상 명백하지만, 회귀 시(예: 향후 누군가 "전체 조회" 로 바꾸는 실수) 를 감지할 테스트는 없음. 단위 테스트도 단일 페이지(`limit: 20`) 케이스만 존재.
  - 제안: 낮은 우선순위 — 로직이 단순(현재 페이지 slice 대상)해 과잉 테스트 리스크. 필요 시 unit 레벨에서 `offset`/`limit` mock 인자 검증 정도로 충분.

- **[INFO]** `Object.assign(t, {...})` 가 원본 `Trigger` 엔티티 객체를 in-place mutate — 테스트에서는 문제 없으나 실제 동작과 살짝 다른 대체(mock) 사용
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:840-853` vs 단위 테스트의 `mockQb` fixture(`as unknown as Trigger` 리터럴 객체)
  - 상세: 실제 TypeORM 엔티티는 prototype 기반(`sanitizeChatChannelForResponse` 가 `Object.getPrototypeOf` 를 보존하는 이유)이지만, 테스트 fixture 는 plain object literal 이라 prototype 관련 동작(예: getter/setter, class method)의 상호작용은 커버되지 않는다. 다만 이 PR 의 diff 범위(`Object.assign(t, {...})`, cronExpression/timezone/nextRunAt 병합)는 plain data 병합이라 실질적 괴리는 낮음. `sanitizeChatChannelForResponse` 자체의 prototype 보존 로직은 기존 `findOneDetail` 테스트에서 이미 다뤄짐.
  - 제안: 조치 불요 — 참고용 관찰.

- **[INFO]** `TriggerDetail` 반환 타입 변경(`PaginatedResponseDto<Trigger>` → `PaginatedResponseDto<TriggerDetail>`) 에 대한 타입 레벨 회귀 테스트 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:780`, `TriggerDetail` (line 731-735)
  - 상세: 단위 테스트는 `result.data as unknown as Array<Record<string, unknown>>` 로 강제 캐스팅해 검증하므로, `TriggerDto`(응답 DTO)와 `TriggerDetail`(서비스 내부 타입) 간 필드 정합은 컴파일 타임에만 보장되고 컨트롤러 레벨 매핑(class-transformer 직렬화 등)이 실제로 `cronExpression`/`timezone`/`nextRunAt` 를 누락 없이 통과시키는지는 e2e(C-2)가 최종 방어선. e2e 가 이를 커버하므로 실질 갭은 아니나, 컨트롤러 유닛(있다면)에서의 DTO 매핑 테스트는 확인 못함.
  - 제안: 조치 불요 — e2e C-2 가 응답 body 의 `cronExpression`/`timezone`/`nextRunAt` 를 직접 검증해 end-to-end 직렬화 갭을 이미 커버함.

## 요약

새로 추가된 3개 단위 테스트(`schedule 행 enrichment`, `schedule 행 없음 → skip`, `매칭 schedule row 없음 → 필드 없이 반환`)와 e2e C-2 는 이번 변경의 핵심 경로 — 배치 조회 발생, webhook 행 비오염, schedule 행 없을 때 조회 skip, 매칭 실패 시 graceful fallback, 실제 API 응답에 cron/timezone/nextRunAt 노출 — 를 모두 다루고 있어 실질적 회귀 방지 효과는 있다. 다만 핵심 셀링 포인트인 "N+1 회피" 주장을 뒷받침하는 `toHaveBeenCalledTimes(1)` 단언이 schedule 트리거 1건짜리 fixture 로만 구성되어 있어, per-row loop 로 퇴행해도 통과할 수 있는 약한 가드다(다건 fixture 로 강화 권장). 나머지는 cross-workspace 스코프·페이지 경계 등 낮은 우선순위 엣지케이스로, 현재 코드 단순성과 기존 `sanitizeChatChannelForResponse`/`findOneDetail` 커버리지를 감안하면 반드시 추가해야 할 정도는 아니다. mock 구성은 suite 별 독립 `beforeEach`/`moduleRef` 로 격리되어 있고, 기존 회귀 테스트(58개)는 모두 그대로 통과한다(`npx jest triggers.service.spec.ts` 확인).

## 위험도

LOW
