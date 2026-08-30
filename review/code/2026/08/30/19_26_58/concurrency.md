# 동시성(Concurrency) 코드 리뷰

## 검증 방법

`git status --short` 로 시작·종료 시 저장소 상태를 확인했고(clean), 저장소 파일은 뮤테이션하지
않았다(읽기 전용 `Read`/`grep`/`python3` 브레이스 매칭만 사용). 이 diff 는 `origin/main..HEAD`
3개 커밋(`1a12088f2`·`519671792`·`9d5e001bf`)의 누적본이며, 이전 두 라운드(`17_36_15`·
`18_10_28`)가 이미 같은 `updateExecutionStatus` else 분기 트랜잭션화 코드를 검토했다. 이번
라운드는 그 위에 (1) `finishStatusTransition` 헬퍼 추출, (2) self-deadlock JSDoc 의 호출부
수 정정(11→20)이 더해진 상태다.

`execution-engine.service.ts` 를 직접 열어 다음을 독립적으로 재검증했다:

- `this.updateExecutionStatus(` 직접 호출부(파일 내부): grep 결과 **11곳**
  (652/2309/2409/2485/2574/3569/4307/4432/4755/4893/5014) — JSDoc 주장과 일치.
- `EngineDriver.updateExecutionStatus` 경유 호출부: `ai-turn-orchestrator.service.ts`(453/550/1608,
  3곳) · `retry-turn.service.ts`(696/915, 2곳) · `form-interaction.service.ts`(110/325, 2곳) ·
  `button-interaction.service.ts`(391/562, 2곳) = **9곳** — 합계 **20곳**, JSDoc 주장과 일치.
- `dataSource.transaction`/`manager.transaction` 을 여는 모든 블록(파일 내 1024/1158/1253/2974/
  3342/8448/8644/8710, `retry-turn.service.ts` 215)을 브레이스 매칭 스크립트로 시작~끝 줄 범위를
  계산해, 위 20개 호출부 중 어느 하나도 그 범위 안에 들지 않음을 확인했다 — self-deadlock 이
  지금 트리거되는 경로는 없다는 JSDoc 결론이 실측과 일치한다.

## 발견사항

- **[INFO]** self-deadlock 경고 JSDoc 의 호출부 수 정정(11→20)이 정확하며, "어휘적 범위" 한계
  고지도 적절하다 — 새 결함 아님, 확인 결과만 기록.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8582`
    (`public async updateExecutionStatus` 위 JSDoc, "호출 제약 — 자신의 트랜잭션 콜백 안에서
    부르지 말 것" 문단)
  - 상세: 직전 라운드(`18_10_28` concurrency WARNING)가 지적한 "11곳 전수 대조" 주장이 실제로는
    파일 내부 호출만 센 것이었던 문제를, 이번 diff 가 20곳(11+9)으로 정정하고 "이 확인은 어휘적
    범위다 — 호출 스택 위쪽에서 트랜잭션을 연 caller 가 있는지까지는 보지 않았다" 는 한계까지
    명시했다. 위 "검증 방법" 절에서 독립적으로 재실측한 결과 숫자·범위 주장 모두 정확하다.
    `finishStatusTransition` 추출(8768행) 도 두 호출부(linkedNodeExec 분기 반환문·else 분기
    반환문) 모두 각자의 `dataSource.transaction` 콜백이 끝난 **뒤**에 호출돼, 트랜잭션 경계를
    넘나드는 새 공유 상태 접근을 만들지 않는다.
  - 제안: 조치 불필요. 향후 새 호출부가 `EngineDriver` 를 소비하는 4개 서비스 중 하나의 자체
    트랜잭션 콜백 **안에서** 추가되는 경우(예: 어떤 서비스가 자신의 저장 작업을 트랜잭션으로
    묶으면서 그 안에서 `driver.updateExecutionStatus` 를 호출하도록 리팩터링)에는 이 JSDoc 이
    명시한 "어휘적 범위" 한계 그대로 self-deadlock 회귀가 조용히 생길 수 있다 — 리뷰 시 이
    JSDoc 문구를 근거로 "확인됨" 이라 넘기지 말고 그때마다 다시 대조할 것.

- **[INFO]** (재확인, 신규 아님) else 분기 트랜잭션 래핑에 따른 커넥션 풀 점유 시간 증가는
  이전 두 라운드에서 이미 "의도된 트레이드오프, 조치 불요" 로 처분됐고 이번 diff 로 변경되지
  않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8710-8745`
    (`let persisted = false; await this.dataSource.transaction(async (manager) => { ... });`)
  - 상세: 단발 auto-commit UPDATE → BEGIN/UPDATE/COMMIT(또는 ROLLBACK) 3왕복으로 바뀐 것은
    변함없으나, 목적(shape 위반 throw 시 실제 롤백 보장)이 비용을 상회한다는 판정이 이번
    라운드에서도 재확인된다. 새로 추가할 내용 없음.

## 요약

이번 diff 는 이전 두 라운드(`17_36_15`·`18_10_28`)가 이미 검증한 `updateExecutionStatus` else
분기 트랜잭션화(shape 위반 throw 시 UPDATE 롤백 보장) 위에, `18_10_28` WARNING(self-deadlock
JSDoc 의 호출부 수 과소집계)에 대한 정정만 얹은 누적본이다. 독립적으로 재실측한 결과 정정된
숫자(20 = 11+9)와 "20곳 전부 트랜잭션 콜백 밖" 이라는 결론, 그리고 "어휘적 범위만 확인했다"
는 한계 고지 모두 정확하다. `finishStatusTransition` 헬퍼 추출도 새로운 race 를 만들지 않는다.
프로덕션 코드 자체(트랜잭션 경계·롤백 배선·데드락 위험 서술)에서 새로 발견된 결함은 없다.
Critical/Warning 은 없다.

## 위험도

LOW — 트랜잭션 경계를 다루는 hot-path 변경이 포함돼 있어 NONE 은 아니나, 실제 검증 결과
이번 라운드에서 새로 열린 위험은 없고 이전 라운드의 지적은 정확히 닫혔다.
