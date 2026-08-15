# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 두 UPDATE 를 `dataSource.transaction` 으로 원자화 (자매 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형화)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대응하는 회귀 테스트 3건 + 헬퍼 `installStalledTx` 추가

(그 외 `plan/**`, `review/**`, `spec/**` 파일은 process 문서로 코드 유지보수성 관점 밖이라 제외)

### 발견사항

- **[WARNING]** 새로 도입한 DRY 헬퍼(`installStalledTx`) 바로 다음 테스트가 그 헬퍼를 쓰지 않고 동일 mock 셋업을 26줄 그대로 복붙
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914-4939` (중복 코드), 헬퍼 정의는 `:4879-4905`
  - 상세: `installStalledTx`(4879-4905)는 `execQb`/`nodeQb`(둘 다 execute affected:1 고정)/`txSpy`/`managerCqb`/트랜잭션-밖 repo 사용 시 throw 하는 무장까지 캡슐화해 반환한다. 그런데 바로 다음에 오는 첫 테스트(`'Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다'`, 4914)는 이 헬퍼를 호출하지 않고 동일한 qb shape·`txSpy`·`managerCqb`·throw-무장 로직을 손으로 다시 작성한다(4915-4939, ~26줄). 헬퍼가 반환하는 `{ execQb, nodeQb, txSpy, managerCqb }` 로 그대로 대체 가능해 보인다(node affected:1 고정도 이 테스트가 요구하는 값과 일치). 같은 파일의 자매 패턴(`installCancelTx`, `:3281-3294`)은 정의 직후 모든 테스트(`:3297`, `:3333`, `:3347`)가 예외 없이 헬퍼를 재사용하는 것과 대조적이다. 이렇게 두 벌로 남으면 향후 mock shape 이 바뀔 때 한쪽만 갱신되고 다른 쪽은 조용히 stale 해질 위험이 있다.
  - 제안: `const { execQb, nodeQb, txSpy, managerCqb } = installStalledTx(1);` 로 교체해 4915-4939 의 수작업 셋업을 제거.

- **[INFO]** "자매와 동형" 주석이 트랜잭션 구조에만 해당하고 에러 흡수(try/catch) 범위는 다름 — 오독 소지
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334`(`finalizeStalledExhausted` 함수) — 대조 `cancelParkedExecution:1023`, `markWebChatIdleTimeout:1152`
  - 상세: 두 자매 함수는 함수 전체를 `try { … } catch (err) { this.logger.error(...) }` 로 감싸 "DB 오류는 내부 흡수 — 호출자에 예외 전파 없음(best-effort)" 을 `@remarks` 로 명문화한다. `finalizeStalledExhausted` 는 트랜잭션 구조는 동형으로 도입했지만 함수 레벨 try/catch 는 추가하지 않았다(diff 전후 모두 없음 — 이번 변경이 만든 회귀는 아니며, 호출부 `execution-run.processor.ts` 의 `.catch()` 가 실질적으로 흡수함을 확인). 다만 "자매 둘과 동형" 이라는 주석 문구(`:3342-3345`)만 읽으면 에러 처리까지 동일하다고 오해할 수 있다.
  - 제안: 필요하면 주석에 "트랜잭션 원자성 범위에서만 동형(에러 흡수는 caller 의 `.catch()` 가 담당)" 임을 한 줄 덧붙이거나, 완전 대칭을 원할 경우 함수 레벨 try/catch 추가 + caller `.catch()` 제거를 별도 항목으로 백로그화.

- **[INFO]** 신규 트랜잭션 클로저 패턴(`let` 변수를 async 클로저 밖에서 선언 후 내부에서 대입) 자체는 새로운 부채가 아니라 기존 두 자매 함수(`cancelled`/`cancelledDurationMs`)와 동일한 기존 코드베이스 관용구를 그대로 재사용한 것으로 확인됨 — 별도 조치 불요, 일관성 관점에서는 오히려 양호.

### 요약

프로덕션 코드 변경(`finalizeStalledExhausted` 트랜잭션화)은 이미 확립된 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)의 패턴·네이밍·주석 스타일을 정확히 재사용해 가독성·일관성이 높고, 새로 도입된 매직 넘버나 과도한 중첩·복잡도 증가도 없다. 테스트 파일 쪽은 대체로 기존 관용구(`installCancelTx` 계열)를 잘 따르지만, 새로 만든 `installStalledTx` 헬퍼가 바로 다음 테스트에서 재사용되지 않고 동일 셋업이 그대로 복붙되어 있는 지점이 유일한 실질적 유지보수성 결함이다(WARNING). 그 외 함수 레벨 try/catch 비대칭은 caller 의 기존 `.catch()` 로 실질적으로 커버되므로 INFO 수준이다.

### 위험도

LOW
