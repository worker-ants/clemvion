# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `updateExecutionStatus` 두 분기(linkedNodeExec / else)의 트랜잭션 후처리(epilogue)가 거의 동일한 4줄로 중복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8647-8652`(linkedNodeExec 분기) 와 `:8728-8733`(else 분기, 이번 diff 로 신설 — diff 게이트 `8728~8730`, 나머지는 hunk 범위 밖이라 `Read` 로 직접 확인).
  - 상세: 이번 diff 로 else 분기도 `dataSource.transaction(...)` 으로 감싸면서, 두 분기 모두 다음 patttern 을 그대로 반복하게 됐다 — `if (enteringRunning && persisted) { this.recordRunningSegmentStart(execution.id); } this.emitTerminalExecutionMetrics(execution, newStatus, persisted); return persisted;`. 트랜잭션 진입부(`let persisted = false; await this.dataSource.transaction(async (manager) => {...})`)의 골격도 동일하다. 이 파일 자체의 주석(`WARNING #9`, 8574-8586)이 증언하듯, 이 프로젝트는 이미 "한쪽 분기만 고치고 형제 분기에 반영하지 않는" 클래스의 결함을 반복 경험했다(`retry-turn` 자매 함수 사례, 본 spec 파일 1299-1301행 회귀 테스트 주석 참조). 지금처럼 4줄짜리 epilogue 가 두 곳에 손으로 복제돼 있으면, 다음에 `recordRunningSegmentStart`/`emitTerminalExecutionMetrics` 호출 순서나 조건이 바뀔 때 한쪽만 고치고 넘어갈 위험이 실측된 전례와 같은 모양으로 존재한다.
  - 제안: `lockNonTerminalExecutionRow` / `recordRunningSegmentStart` / `emitTerminalExecutionMetrics` 처럼 이미 private 메서드로 추출해 온 이 파일의 기존 관례를 따라, 트랜잭션 실행 + epilogue 를 감싸는 헬퍼(예: `private async runGuardedTransition(enteringRunning, execution, newStatus, txWork: (manager) => Promise<boolean>): Promise<boolean>`)를 도입해 두 분기가 그 헬퍼를 호출하도록 정리하는 편이 향후 drift 를 구조적으로 차단한다.

- **[INFO]** `updateExecutionStatus` 함수가 이번 diff 로 더 길어졌다(현재 약 168줄, `execution-engine.service.ts:8566-8734`).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8566-8734`
  - 상세: 이 함수는 이미 두 개의 큰 분기(각각 트랜잭션 콜백 포함)를 갖고 있었는데, 이번 diff 가 else 분기에도 `dataSource.transaction` 래핑을 추가하면서 두 분기 모두 "트랜잭션 열기 → 콜백 내부 로직 → epilogue" 구조를 갖는 대칭 형태가 됐다. 기능적으로는 올바르지만(짝 전이와 동일한 롤백 보장을 얻기 위한 의도된 변경), 단일 함수의 길이·책임(assertTransition 검증 + 세그먼트 시간 추적 + 두 개의 서로 다른 영속 전략 + 메트릭 발행)이 계속 누적되고 있다.
  - 제안: 위 WARNING 의 헬퍼 추출과 함께, 두 분기의 트랜잭션 콜백 본체(짝 전이 저장 vs guarded UPDATE)만 남기고 나머지 공통 골격을 헬퍼로 옮기면 함수 하나의 가독 범위가 줄어든다. 즉시 처리할 필요는 없으나 다음 손질 시 후보로 남겨 둘 만하다.

- **[INFO]** 테스트 mock(`mockTxManagerQuery`)의 SQL 문자열 매칭에 쓰인 `/UPDATE execution/` 정규식이 이번 diff 로 3곳(beforeEach 위임 분기 + 신규 테스트 2건)에 추가됐으나, 이는 이 spec 파일 전체에서 이미 22회 쓰이고 있는 기존 관용구와 동일한 형태다(`grep -c 'UPDATE execution'` = 22, 이번 diff 이전에도 폭넓게 사용됨).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:289`, `:4831`, `:4855`
  - 상세: 새 코드가 기존 컨벤션(파일 전역에서 이미 반복되는 리터럴 매칭 스타일)을 그대로 따른 것이라 이번 diff 가 새로 만든 중복은 아니다. 다만 정규식 리터럴이 파일 전역 22곳에 흩어져 있어, `UPDATE execution` SQL prefix 가 바뀌면(예: 테이블명 alias 변경) 22곳을 전수 grep 해야 하는 구조다.
  - 제안: 이번 diff 의 책임 범위는 아니므로 즉시 조치 불필요. 파일 상단에 `const UPDATE_EXECUTION_SQL_RE = /UPDATE execution/;` 같은 공유 상수를 두는 리팩터링은 이 diff 와 별도 작업으로 고려할 만하다.

가독성·네이밍·중첩 깊이·매직 넘버 관점에서는 특이사항이 없다 — 새로 추가된 코드(`mockTxManagerQuery` 델리게이션, 신규 테스트 2건, production 의 `dataSource.transaction` 래핑)는 이 파일에 이미 정착된 스타일(과감한 한국어 인라인 근거 주석, `service as unknown as {...}` 캐스팅 패턴, 트랜잭션 매니저 래핑 패턴)을 정확히 따르고 있어 일관성 문제는 없다. `plan/in-progress/*.md` 두 파일의 변경은 진행 상황 서술 갱신(체크박스 완료 처리 + 취소선 정정)으로, 코드가 아니라 추적 문서이며 유지보수성 관점의 코드 이슈에 해당하지 않는다.

## 요약

이번 변경은 `updateExecutionStatus` 의 else 분기(guarded UPDATE)를 짝 전이 분기와 동일하게 `dataSource.transaction` 으로 감싸 롤백 보장을 얻는 작업이며, 스타일·네이밍·문서화는 이 코드베이스의 기존 관례를 정확히 따른다. 다만 그 결과로 두 분기가 "트랜잭션 열기 → 내부 로직 → epilogue(세그먼트 기록 + 메트릭 발행 + return)" 라는 동일한 골격을 코드로 두 번 반복하게 됐고, 이 파일 자신의 주석이 증언하듯 이 프로젝트는 정확히 이 모양의 "형제 분기 drift" 결함을 이미 여러 차례 겪었다. 기능적 결함은 아니지만, 향후 epilogue 로직이 바뀔 때 한쪽만 고칠 위험을 구조적으로 줄이려면 공통 헬퍼 추출을 고려할 시점이다. 함수 길이도 계속 늘어나고 있어(현재 약 168줄) 함께 정리할 여지가 있다.

## 위험도

LOW
