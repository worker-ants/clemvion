# 보안(Security) 리뷰 결과

## 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- `plan/in-progress/refactor-06-c2-followups.md`

## 변경 개요
06 C-2(재개 진입 원자 claim) 후속 정리: (1) `claimResumeEntry` 트랜잭션의 "짝 불일치(Execution 이미 terminal) → tx 롤백" 판별을 클로저 boolean 플래그(`execMismatch`)에서 전용 타입 sentinel 클래스(`ResumeClaimExecTerminalError`) + `instanceof` 판별로 교체, (2) RUNNING 세그먼트 시작 시각 기록 로직을 `recordRunningSegmentStart` 헬퍼로 단일화(claim 경로와 `updateExecutionStatus` 경로가 공유), (3) 이에 대한 unit/e2e 테스트 보강(동시 재개 시 skip-guard, 이중 실행 0 검증). 기존 동시성 제어(조건부 UPDATE + affected count 기반 원자 claim), 워크스페이스 격리(W-6), 인증 헤더 사용 등 보안 관련 로직 자체는 변경되지 않았다.

### 발견사항

- **[INFO]** Sentinel 에러 판별 방식이 `instanceof` 로 강화됨 (개선)
  - 위치: `execution-engine.service.ts` L279-289, L881-921 (`ResumeClaimExecTerminalError`, `claimResumeEntry`)
  - 상세: 기존 `execMismatch` boolean 클로저 플래그 + 문자열 매직 에러 메시지(`'__resume_claim_exec_terminal__'`) 방식은, 만약 트랜잭션 콜백 내부에서 다른 예기치 못한 예외가 동시에 발생하고 우연히 `execMismatch` 가 이미 `true` 로 세팅된 상태였다면 `.catch` 가 해당 예외를 "정상 discard" 로 오분류해 `false` 를 반환하고 원인 불명 에러를 삼킬 잠재 위험이 있었다(root cause 은폐로 인한 사후 대응 지연 리스크). 신규 코드는 타입 기반 `instanceof` 판별로 바뀌어 오직 의도된 sentinel 만 discard 되고 그 외 DB 오류(무결성 위반, 커넥션 장애 등)는 정상적으로 상위로 전파된다. 보안 관점에서는 "에러 은폐로 인한 이상 징후 미탐지" 리스크를 낮추는 방향의 개선이며 회귀는 없다.
  - 제안: 없음 (개선 확인용 INFO).

- **[INFO]** 재개 진입 원자 claim(Race 방지)의 fail-closed 설계 유지 확인
  - 위치: `execution-engine.service.ts` L881-921 `claimResumeEntry`
  - 상세: `execRes.affected === 0`(동시 cancel 등으로 Execution 이 이미 terminal) 시 정상적으로 tx 를 롤백해 NodeExecution claim 도 함께 취소한다(discard). 이는 "짝(Execution/NodeExecution) 불일치 상태로 재개가 진행되는" 논리적 레이스를 차단하는 fail-closed 패턴으로, 동시 재개 요청에 대한 이중 실행 방지(비인가 재실행/데이터 오염 방지)와 직결된 보안 속성이다. 이번 변경은 이 속성을 그대로 보존한다. e2e 테스트(`execution-park-resume.e2e-spec.ts` 신규 케이스)가 병렬 `continue` 2건에 대해 form 노드가 정확히 1회만 실행됨을 검증하여 회귀를 가드한다.
  - 제안: 없음.

- **[INFO]** 하드코딩 시크릿/인젝션/인증 우회 없음
  - 위치: 전체 diff
  - 상세: 변경분에 SQL 문자열 결합, 사용자 입력의 직접 삽입, 신규 외부 I/O, 신규 인증/인가 분기, 자격증명·API 키 리터럴이 없다. 기존 TypeORM QueryBuilder 파라미터 바인딩(`:id`, `:status` 등)을 그대로 사용하므로 SQL 인젝션 벡터 미도입. 에러 메시지(`'resume claim aborted — paired Execution is terminal'`)는 내부 sentinel 로만 사용되고 외부(클라이언트/로그)로 노출되지 않으며 민감 정보를 포함하지 않는다.
  - 제안: 없음.

- **[INFO]** 테스트 코드(spec/e2e)만의 변경 부분
  - 위치: `execution-engine.service.spec.ts` L35-124, `execution-park-resume.e2e-spec.ts` 신규 `it` 블록
  - 상세: 신규 유닛 테스트는 claim 이 이미 Execution 을 RUNNING 으로 전이시킨 경우 재개 sentinel 전이(`updateExecutionStatus(RUNNING)`) 를 재차 호출하지 않는지 검증한다(RUNNING→RUNNING 상태전이 assert 위반 회피). e2e 신규 테스트는 동일 waiting 노드에 대한 병렬 `continue` 요청이 인증된 토큰(`ownerToken`)·워크스페이스 헤더 하에서 이중 실행을 일으키지 않는지 검증한다. 테스트 데이터에 시크릿·실제 자격증명 없음(JWT 는 테스트 헬퍼 `registerAndLogin` 이 발급하는 테스트 전용 토큰).
  - 제안: 없음.

### 요약
이번 변경은 06 C-2(재개 진입 원자 claim) 구현의 후속 리팩터링으로, 기존에 이미 검증된 동시성 제어(조건부 UPDATE + affected count 기반 원자 claim, fail-closed 짝 불일치 롤백)의 내부 구현을 boolean 클로저 플래그에서 타입 안전한 sentinel 에러 클래스로 교체하고 중복 로직을 헬퍼로 통합한 것이다. 신규 공격 표면, 인증/인가 변경, 인젝션 벡터, 하드코딩 시크릿, 정보 노출이 없으며, 오히려 예외 판별 정확도를 높여 "의도치 않은 DB 오류가 정상 discard 로 오분류될" 잠재적 은폐 리스크를 줄이는 방향의 개선이다. 신규 테스트(unit + e2e)는 동시 재개 시 이중 실행 방지라는 보안 관련 불변식(데이터 무결성)을 명시적으로 가드한다.

### 위험도
NONE
