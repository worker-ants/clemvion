# Testing Review — config-call-history §A.3

## 발견사항

### [WARNING] QB mock 이 단일 qb 객체를 3회 공유 — 쿼리 간 독립 검증 불가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-call-history-929994/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 763-775행 (`makeExecutionRepo`)
- 상세: `createQueryBuilder` 가 항상 동일한 `qb` 객체를 반환한다. 실제 `getUsage` 는 `executionRepository.createQueryBuilder`를 **3번** 호출한다 — `getCount` 전용 QB, `getRawOne` 전용 QB, `getMany` 전용 QB 순. 단일 qb 공유 시 `qb.where` 호출 검증이 어느 쿼리에 대한 것인지 구분할 수 없고, `getCount`/`getRawOne`/`getMany` 가 각 QB 에서 한 번씩만 호출됐는지도 단언할 수 없다. 현재는 `totalCalls` 가 항상 `getCount` 결과를 받는다는 가정이 암묵적으로 성립할 뿐이다.
- 제안: `createQueryBuilder` mock 을 call-순서 별로 다른 qb 를 반환하도록 변경한다. 예: `jest.fn().mockReturnValueOnce(countQb).mockReturnValueOnce(periodQb).mockReturnValueOnce(recentQb)`. 이렇게 하면 각 쿼리의 `select`/`setParameters`/`orderBy` 호출도 개별 spy 로 단언할 수 있다.

### [WARNING] chat-channel 경로에서 X-Forwarded-For IP 추출 테스트 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-call-history-929994/codebase/backend/src/modules/hooks/hooks.service.spec.ts` 580-612행 (chat-channel §A.3 블록)
- 상세: webhook 경로에는 `x-forwarded-for: '198.51.100.9, 10.0.0.1'` 헤더를 주입하는 XFF 추출 테스트가 추가됐다(219행). 그러나 `handleChatChannelWebhook` 경로는 `sourceIp: undefined`(헤더 없음) 케이스만 테스트한다. chat-channel 도 `extractClientIp(input.headers)` 를 직접 호출하므로(`hooks.service.ts` 605행), XFF 헤더가 있는 경우 `sourceIp` 가 `'198.51.100.9'` 로 전달되는지 검증하는 테스트가 없다.
- 제안: chat-channel 그룹에 `x-forwarded-for` 헤더를 포함한 케이스를 1건 추가한다. webhook 경로의 219행 테스트와 대칭되는 형태로 작성하면 된다.

### [INFO] `recentCalls` 결과의 `triggerName` 폴백 경로 미테스트
- 위치: `auth-configs.service.spec.ts` 202-257행 (`getUsage` 테스트 블록)
- 상세: 서비스 코드 `e.trigger?.name ?? 'Unknown'` 에서 `trigger` 관계가 `null/undefined` 인 케이스(orphan execution — trigger DELETE 후 SET NULL)가 `'Unknown'` 으로 폴백하는 경로를 검증하는 테스트가 없다.
- 제안: `recent` 배열 항목에 `trigger: undefined` 를 주고 반환값의 `triggerName === 'Unknown'` 을 단언하는 케이스를 추가한다.

### [INFO] `USAGE_RECENT_CALLS_LIMIT(20)` limit 적용 여부 단언 없음
- 위치: `auth-configs.service.spec.ts` makeExecutionRepo mock 및 getUsage 테스트 전체
- 상세: `.limit(USAGE_RECENT_CALLS_LIMIT)` 호출이 실제로 이루어지는지 검증하지 않는다. qb mock 이 단일 객체를 공유하므로 `limit` spy 를 asserting 하더라도 어느 QB 인지 불명확하다. QB 분리(WARNING-1 수정) 이후 recentQb 의 `.limit` 인자가 `20` 임을 단언하는 것이 바람직하다.
- 제안: WARNING-1 수정 후 `recentQb.limit.toHaveBeenCalledWith(20)` 추가.

### [INFO] SQL migration 에 대한 롤백 검증(DOWN 스크립트) 테스트 없음
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- 상세: DOWN 스크립트가 주석으로만 존재하며, Flyway 는 기본적으로 DOWN 을 실행하지 않는다. 프로젝트가 별도 down-migration 테스트를 운용하지 않는다면 INFO 수준이지만, 롤백이 실제로 동작하는지 통합 테스트에서 확인된 바 없다.
- 제안: 프로젝트에 마이그레이션 rollback 통합 테스트 인프라가 있다면 V096 UP→DOWN→UP 시퀀스를 추가한다. 없다면 현 수준 유지 허용.

### [INFO] 프런트엔드 테스트 — 기간별 카운트 개별 숫자값 단언 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-call-history-929994/codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` 1221-1228행
- 상세: "기간별 호출 수 섹션이 렌더된다" 테스트는 섹션 헤더(`"Calls by Period"`) 존재만 확인한다. USAGE 픽스처에 `{ last24h: 2, last7d: 5, last30d: 7 }` 이 있음에도 실제 숫자값이 차트 컨테이너 안에 렌더되는지는 검증하지 않는다. recharts 가 passthrough stub 이라 Bar 값 자체는 렌더 안 되지만, 레이블(`"Last 24h"` 등)은 `XAxis` 가 stub 처리되어 단언할 수 없다. 이는 stub 설계의 한계로 허용 가능하나, 데이터 준비 로직(USAGE data 전달 여부) 검증은 누락.
- 제안: 현행 유지 허용 또는 BarChart stub 을 `data` prop 을 JSON 출력하는 형태로 교체해 `{ last24h: 2 }` 포함 여부를 단언할 수 있다.

## 요약

핵심 코드 경로(sourceIp/responseCode 영속, periodCounts 파싱, NULL 폴백, 트리거 없음 단락, webhook XFF IP, chat-channel 기본 경로, 프런트엔드 컬럼 렌더)에 대한 테스트가 전반적으로 충실하게 추가되었다. 가장 주의가 필요한 부분은 `makeExecutionRepo` 에서 단일 QB 객체를 3회 공유하는 구조로, 서비스가 실제로 `getCount`→`getRawOne`→`getMany` 순서로 3개의 독립 QB 를 사용함에도 mock 이 이를 구분하지 못한다. 이 구조적 취약점으로 인해 쿼리 간 파라미터 혼용이나 메서드 호출 순서 오류가 발생해도 테스트가 통과할 수 있다. chat-channel XFF 추출 테스트 누락도 webhook 경로 대비 비대칭이다.

## 위험도

MEDIUM
