# 동시성(Concurrency) 리뷰

## 발견사항

### [INFO] getStatusById — read-only 단순 조회, TOCTOU 취약성 없음
- 위치: `codebase/backend/src/modules/executions/executions.service.ts`, 신규 메서드 `getStatusById` (라인 699–704)
- 상세: `findOne` 단일 SELECT로 status만 조회하는 경량 메서드다. 호출부인 `hooks.service.ts::getActiveExecutionStatus`는 조회 결과를 판단 기준으로만 쓰고 별도 상태 변경을 하지 않으므로, status 조회 후 상태가 바뀌어도 치명적 경쟁 조건이 발생하지 않는다. 기존 코드(private 브래킷 접근)와 동일한 의미를 공개 API로 캡슐화한 리팩터링이며 동시성 특성에 변화 없다.
- 제안: 해당 없음.

### [INFO] snapshotCache (LRU Map) — 단일 스레드 Node.js 이벤트 루프에서 안전
- 위치: `executions.service.ts`, `readSnapshotCache` / `writeSnapshotCache` / `invalidateSnapshotCache`
- 상세: 본 변경 파일에 직접 포함되지 않지만, `getStatusById` 추가로 `executions.service.ts` 전체 파일 컨텍스트가 검토 대상에 포함됐다. `snapshotCache`는 인스턴스 변수 `Map`으로, Node.js의 단일 스레드 이벤트 루프 특성상 동시에 두 async 함수가 같은 Map을 변이하는 interleaving은 발생하지 않는다. delete+set 패턴도 같은 tick 안에서 완료된다. 멀티 인스턴스 환경에서 cross-instance stale 문제가 있으나, 이미 코드 주석에 명시되어 있고 본 변경 범위 밖이다.
- 제안: 해당 없음.

### [INFO] hooks.service.ts `getActiveExecutionStatus` — private 브래킷 접근 제거
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, 라인 884–577 (diff 기준)
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` private 브래킷 접근을 `this.executionsService.getStatusById(executionId)` 공개 메서드 호출로 교체했다. 동시성 특성은 동일하며 오히려 캡슐화가 개선됐다. `.catch(() => null)` 오류 흡수는 `getStatusById` 내부로 이동해 의미가 보존된다.
- 제안: 해당 없음.

### [INFO] extractClientIpFromHeaders 반환형 `null` → `undefined` 통일
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`, `hooks.service.ts` 두 군데 `?? undefined` 제거
- 상세: 반환형 변경(`string | null` → `string | undefined`)은 동시성과 무관하다. `?? undefined` 불필요 연산만 제거되었고, 소비처의 falsy 분기 동작은 동일하다.
- 제안: 해당 없음.

## 요약

이번 변경은 (1) private 브래킷 접근(`['executionRepository']`)을 공개 API(`getStatusById`)로 캡슐화, (2) `extractClientIpFromHeaders` 반환형을 `null → undefined`로 통일하는 리팩터링, (3) 해당 테스트 보완으로 구성된다. 새로 추가된 `getStatusById`는 단순 SELECT이며 호출부가 읽기 전용으로만 사용하므로 TOCTOU·경쟁 조건 위험이 없다. 기존의 REPEATABLE READ 트랜잭션, 원자적 UPDATE WHERE status IN (...) 패턴, LRU 캐시 등 동시성 제어 메커니즘은 이번 변경에서 건드리지 않았고 정상 유지된다. Node.js 단일 스레드 환경에서 Map 기반 LRU 캐시도 안전하다. 동시성 관점의 신규 위험은 없다.

## 위험도

NONE
