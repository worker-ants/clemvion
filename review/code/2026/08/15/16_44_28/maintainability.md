# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 두 UPDATE(Execution/NodeExecution cascade)를 `dataSource.transaction`으로 원자화. 자매 함수 `cancelParkedExecution`(:1023)·`markWebChatIdleTimeout`(:1152)과 동형 패턴으로 정렬.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대응하는 헬퍼 `installStalledTx`(:4879) + 회귀 테스트 4건(트랜잭션 manager 공유, RUNNING 마킹, 중간 실패 시 throw, affected=0 no-op).

(`CHANGELOG.md`, `plan/**`, `review/**` 는 process 문서로 코드 유지보수성 관점 밖이라 제외 — 직전 라운드(`16_04_38` maintainability)와 동일 스코프 판단)

## 이전 라운드(`16_04_38`) WARNING 재검증

- **W(구 WARNING) — `installStalledTx` 헬퍼를 도입하고 바로 다음 테스트가 재사용하지 않음**: 현재 코드에서 **해소 확인**. `installStalledTx`(:4879) 정의 직후 4개 테스트(:4914, :4946, :5029, :5054) 전부가 헬퍼를 호출한다(`grep`으로 4곳 모두 `installStalledTx(...)` 호출 확인). 자매 헬퍼 `installCancelTx`(:3281 부근)와 동일하게 "정의 직후 전원 재사용" 패턴을 지킨다.

## 발견사항

- **[INFO]** 신규 테스트 3건이 `emitExecution` spyOn 셋업(8~10줄)을 각각 손으로 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4916-4927`(신규), `:5034-5045`(신규), `:5056-5067`(신규) — 세 곳이 동일한 `jest.spyOn((service as unknown as {...}).eventEmitter, 'emitExecution').mockResolvedValue(undefined)` 블록을 반복한다.
  - 상세: 같은 파일 다른 `describe` 블록(`admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)`, :4482 부근)에는 이미 `const emitSpy = () => jest.spyOn(...).mockResolvedValue(undefined);`(:4506) 형태로 추출된 로컬 헬퍼가 있어 재사용 가능한 선례가 존재한다. 다만 이 반복 자체는 이 diff 가 새로 만든 습관이 아니라 파일 전역에 걸쳐(:970, :1034, :1078, :1147 등) 이미 널리 퍼져 있는 기존 관례이므로, 이번 변경만의 새로운 회귀는 아니다.
  - 제안: 필수 조치는 아님(기존 스타일과 일관). 이 describe 블록 스코프에 `const emitSpy = () => jest.spyOn(...).mockResolvedValue(undefined);` 헬퍼를 하나 두면 4개 `it` 블록(신규 3 + 기존 1) 모두에서 8줄씩 줄일 수 있다는 정도의 선택적 개선.

- **[INFO]** 트랜잭션 클로저 구조(Execution UPDATE → affected=0 조기 return → `duration_ms` 추출 → NodeExecution cascade UPDATE → `finalized` 플래그)가 이제 `cancelParkedExecution`·`markWebChatIdleTimeout`·`finalizeStalledExhausted` 세 함수에서 거의 동일한 형태로 3중 반복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357-3405`(`finalizeStalledExhausted`) — 대조 `cancelParkedExecution:1028-1071`, `markWebChatIdleTimeout` 동일 구간.
  - 상세: 세 함수 모두 "let 변수를 클로저 밖에서 선언 → `dataSource.transaction` 안에서 Execution UPDATE → affected=0 이면 조기 return(no-op) → RETURNING 에서 duration 추출 → 조건부 NodeExecution cascade UPDATE → 성공 플래그 set" 골격을 그대로 복제한다(가드 컬럼값·에러 payload 등 세부만 다름). 공통 헬퍼로 추출할 여지가 있으나, 세 함수의 SET/WHERE 절 값·에러 payload 구조·성공 후 emit 종류가 서로 달라 단순 파라미터화는 시그니처가 복잡해질 수 있다.
  - 제안: 이번 diff 범위에서 조치할 사안은 아니다 — 같은 커밋의 `plan/in-progress/eia-stalled-atomicity.md` "범위 밖" 절에 "관용구 헬퍼 추출"이 이미 정본 트래커 항목으로 명시적으로 defer 돼 있으므로 별도 지적 없이 추적 상태만 확인.

- **[INFO]** 함수 레벨 `try/catch` 비대칭(자매 둘은 있고 이 함수는 없음)에 대한 이전 라운드 지적이 JSDoc 으로 명문화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3331-3334`(`finalizeStalledExhausted` JSDoc)
  - 상세: "함수 레벨 `try/catch` 는 의도적으로 없다 — 유일 호출부(`ExecutionRunProcessor.onFailed`)가 `.catch()` 로 흡수하므로 최종 동작은 동등하고, 여기서 삼키면 트랜잭션 실패가 관측 불가능해진다" 로 명시하고, 이를 검증하는 회귀 테스트(`:5029` "트랜잭션 중간 실패는 삼키지 않고 던진다")까지 갖춰 이전 라운드(`16_04_38` maintainability INFO)가 지적한 "오독 소지"가 해소됐다. 조치 불요, positive confirmation.

## 점검 관점별 요약

1. **가독성**: 트랜잭션 도입 후에도 자매 함수와 동일한 서사 구조(주석 위치·순서 포함)를 유지해 옆 함수를 안 봐도 의도가 읽힌다.
2. **네이밍**: `finalized`/`stalledDurationMs`/`stalledError`는 자매의 `cancelled`/`cancelledDurationMs` 네이밍 컨벤션과 정확히 대응.
3. **함수 길이**: `finalizeStalledExhausted`(:3345-3423, 약 79줄)는 트랜잭션 도입으로 소폭 길어졌지만 자매 두 함수와 동급 길이이며 단일 책임(마감 트랜잭션 + best-effort 후처리)을 유지.
4. **중첩 깊이**: 트랜잭션 콜백 1단 + 내부 `if` 조기 return 1단으로 자매와 동일 수준, 과도한 중첩 없음.
5. **매직 넘버**: 신규 매직 넘버/문자열 없음(`stalledError` 상수화가 오히려 기존 하드코딩 중복을 제거).
6. **중복 코드**: 프로덕션 코드의 트랜잭션 골격이 자매 3개 함수에 걸쳐 반복되나(위 INFO), 이미 트래커에 defer 등재됨. 테스트 코드의 `emitSpy` 셋업 반복은 파일 전역의 기존 관례와 일치.
7. **코드 복잡도**: 조건 분기 2개(affected=0 조기 return, finalized 조기 return)로 순환 복잡도 낮음.
8. **일관성**: 프로덕션·테스트 모두 자매 패턴(`installCancelTx`/`cancelParkedExecution`)을 그대로 재사용해 스타일 일관성이 높다.

## 요약

이번 diff 는 `finalizeStalledExhausted` 를 이미 확립된 두 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)와 동형 패턴으로 정렬한 순수한 하드닝이며, 네이밍·주석 스타일·에러 처리 방침을 모두 기존 관례에서 그대로 가져와 가독성과 일관성이 높다. 직전 라운드(`16_04_38`)가 지적한 "헬퍼 미재사용" WARNING 은 이번 diff 에서 완전히 해소됐고(4개 테스트 전원이 `installStalledTx` 재사용), 함수 레벨 try/catch 비대칭도 JSDoc + 전용 회귀 테스트로 명문화돼 오독 소지가 사라졌다. 남은 관찰 사항은 (a) 신규 테스트 3곳의 `emitSpy` 셋업 반복(파일 전역 기존 관례와 동일, 새 문제 아님)과 (b) 트랜잭션 골격이 세 자매 함수에 3중 반복되는 구조적 DRY 여지(이미 plan 문서에 defer 로 등재)로, 둘 다 CRITICAL/WARNING 급은 아니며 INFO 수준이다.

## 위험도

LOW
