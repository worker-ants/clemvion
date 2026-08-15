# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 의
  JSDoc/인라인 주석 중복 해소(직전 라운드 `16_19_26` WARNING 반영) + `WHERE id = :id` 대상 식별 하드닝(이전
  라운드 `16_19_26` testing W1 반영, 이 함수 자체는 이번 diff 에서 실질적 로직 변경 없음).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 하드닝에 대응하는
  단언 2건 추가(`installStalledTx` 반환값을 통한 `execQb.where`/`nodeQb.where` 대상 검증).
- 그 외 `CHANGELOG.md`, `plan/**`, `review/**`, `spec/5-system/4-execution-engine.md` 는 process/문서
  파일로 코드 유지보수성 관점 밖이라 제외(직전 두 라운드와 동일 스코프 판단).

이 diff 는 직전 라운드(`review/code/2026/08/15/16_19_26`)가 지적한 WARNING 2건(테스트 WHERE 미검증,
JSDoc/인라인 주석 90% 중복)을 정확히 그 자리에서 해소한 것이다. 두 항목 모두 재확인했고 이미 반영돼
있다.

### 재확인 (이미 반영됨)

- JSDoc(`:3325-3329`)과 함수 본문 최상단 인라인 주석(`:3348-3349`)의 중복 — `:3348-3349` 가 "자매 둘과
  동형인 단일 트랜잭션 — 근거는 위 JSDoc 참조" 한 줄로 축약돼 두 곳에 같은 서술이 반복되던 상태가
  해소됨. 근거가 JSDoc 한 곳에만 남아 향후 한쪽만 갱신되며 모순되는 위험이 사라졌다.
- 신규 첫 테스트(`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`, `:4914`)와
  두 번째 테스트(`:4946`) 모두 `installStalledTx` 헬퍼(`:4879`)를 통해 셋업하며, 손 복붙된 mock 셋업은
  남아있지 않다.

### 발견사항

- **[INFO]** 테스트 helper 간 트랜잭션-밖-접근 가드의 비대칭 — `installStalledTx`(신규, `:4879-4905`)만
  `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 를 즉시 throw 하도록
  무장하는데, 자매 `installCancelTx`(`:3281-3294`)는 이 무장이 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4879-4905`
    (`installStalledTx`) vs `:3281-3294` (`installCancelTx`)
  - 상세: `installStalledTx` 는 "다시 밖으로 나가는 회귀를 잡는다"는 명시적 목적으로
    트랜잭션 밖 repo 사용 시 즉시 에러를 던지도록 새로 하드닝했다(plan
    `eia-stalled-atomicity.md` 에도 의도로 기록됨). 이 자체는 개선이지만, 결과적으로 두
    `install*Tx` 헬퍼가 "자매·동형"이라고 서로를 지칭하면서도(`:4877` 주석) 무장 수준이
    갈린 상태로 남았다 — `cancelParkedExecution` 쪽 트랜잭션 코드가 다시 repo 직접 접근으로
    회귀해도 `installCancelTx` 기반 테스트는 잡아내지 못한다. 이번 diff 가 만든 회귀는
    아니며(이 함수는 원래도 이 가드가 없었다), 이 diff 범위 밖 함수를 건드리는 문제라 이번
    PR 에서 조치할 필요는 없다.
  - 제안: 다음에 `cancelParkedExecution`/`markWebChatIdleTimeout` 쪽 테스트를 손댈 기회가
    있으면 같은 throw 가드를 `installCancelTx`/`markWebChatIdleTimeout` 헬퍼에도 백포트해
    세 자매 테스트 헬퍼의 무장 수준을 동형으로 맞추는 것을 고려. 이번 PR 범위는 아니다.

- **[INFO]** `execQb.where` 의 `'id = :id'` 대상 단언이 두 테스트(`:4938-4940`, `:4972-4974`)에 그대로
  중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914`
    (`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`)와 `:4946`
    (`RUNNING 이면 failed + WORKER_HEARTBEAT_TIMEOUT 마킹 + ...`)
  - 상세: 두 테스트가 서로 다른 관심사(전자=트랜잭션 wiring, 후자=행동/emit)를 검증한다는
    점에서 의도적 중복이며, 이 저장소가 반복 지적해 온 "값을 손으로 반복하면 갈린다"는
    원칙은 주로 *프로덕션 코드*의 값 중복을 겨냥한 것이라 테스트 단언 중복에 그대로 적용하긴
    어렵다. 다만 향후 `id = :id` 형태의 WHERE 절 자체가 바뀌면(예: soft-delete 조건 추가)
    두 자리를 모두 갱신해야 하는 점은 남는다.
  - 제안: 실질적 위험은 낮다 — 조치 불필요, 참고용 관찰.

### 확인 사항 (문제 없음)

- 매직 넘버·과도한 중첩·순환 복잡도 증가 없음. `finalizeStalledExhausted` 는 이번 diff 로 로직
  변경이 없고 주석만 축약됐다.
- `installStalledTx` 네이밍은 파일의 스코프별 접두사 컨벤션(`:3262-3266` 주석이 유래 명시)을
  그대로 따른다.
- 새로 추가된 단언들(`nodeQb.where`/`nodeQb.andWhere`, `:4985-4990`)은 직전 라운드가 지적한
  "WHERE 가드 미검증" 갭을 정확히 메운다 — 헬퍼 재사용 형태로 추가돼 별도 중복을 만들지 않았다.

### 요약

이번 라운드의 실질 diff 는 직전 라운드(`16_19_26`)가 남긴 WARNING 2건(JSDoc/인라인 주석 중복,
Execution UPDATE 의 `WHERE id` 대상 미검증)을 정확한 자리에서 해소한 것으로, 새로 도입된
유지보수성 결함은 없다. 유일하게 눈에 띄는 것은 신규 테스트 헬퍼 `installStalledTx` 가 자매
`installCancelTx` 보다 더 강한 무장(트랜잭션 밖 접근 즉시 throw)을 갖게 되어 두 헬퍼의 무장
수준이 갈렸다는 점인데, 이는 이번 diff 범위 밖 함수에 대한 개선 여지일 뿐 회귀나 결함은 아니다.
전반적으로 프로덕션 코드는 확립된 자매 함수 패턴을 그대로 재사용해 가독성·일관성이 높고, 테스트
코드도 공유 헬퍼를 통해 중복 없이 구성돼 있다.

### 위험도

LOW
