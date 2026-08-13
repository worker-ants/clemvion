# 요구사항(Requirement) 코드 리뷰

## 발견사항

- **[WARNING]** `admitExecutionOrDefer` 에 추가한 `Array.isArray(rows)` fail-closed 가드가 이번 diff 가
  스스로 명시한 위험 클래스(`EntityManager.query`/`Repository.query()` 선언 타입이 `Promise<any>` 라
  `RETURNING` 결과 배열 단언이 "주장이지 검증이 아니다")를 **같은 파일의 구조적으로 동일한 sibling
  두 곳, 그리고 인접 서비스 한 곳에는 적용하지 않았다.**
  - 위치(가드 적용 안 된 sibling):
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8179`
      (`lockNonTerminalExecutionRow` — `const live: unknown[] = await manager.query(...); return live.length > 0;`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8465-8492`
      (`updateExecutionStatus` else 분기 — `const updated: Array<{ id: string }> = await
      this.executionRepository.query(...RETURNING id...); const persisted = updated.length > 0;`.
      이 분기는 RUNNING/COMPLETED/FAILED/CANCELLED **terminal 전이의 choke point**라 admission
      보다 오히려 파급이 크다.)
    - `codebase/backend/src/modules/executions/executions.service.ts:303-319`
      (`computeChainDepth` — `const rows: Array<{ depth: number | null }> = await
      this.executionRepository.query(...)`)
  - 상세: 새로 추가된 가드의 주석(`execution-engine.service.ts:2922-2930`)은 "드라이버가 배열이
    아닌 것을 돌려주면 `rows.length` 가 `Cannot read properties of undefined` 로 터진다 — 원인이
    안 보이는 메시지다" 라고 정확히 진단하고, 오직 admission 지점 한 곳만 고쳤다. 그런데 동일한
    "제네릭 타입 단언 + `.length` 접근" 패턴이 파일 내 최소 2곳, 인접 서비스에 1곳 더 있다. 이
    프로젝트가 이미 여러 번 반복해 기록한 결함 클래스(하드닝을 자매 함수에 미적용)와 형태가
    같다 — "고쳤다" 라고 쓰는 시점에 자매를 전수로 세지 않은 사례.
    특히 `updateExecutionStatus:8465` 분기는 `admitExecutionOrDefer` 와 달리 **애플리케이션
    트랜잭션으로 감싸여 있지 않은 단일 raw UPDATE**라 "throw ⇒ rollback 으로 부분 적용을 막는다"
    는 이번 PR 의 방어 논리조차 그대로 적용되지 않는다(단일 statement 는 이미 autocommit 되어
    있어 `.length` 접근 실패 시점엔 UPDATE 자체는 이미 커밋된 뒤다) — 오히려 **진단 메시지
    불명확성만** 남아 있고 이번 PR 이 고치겠다고 밝힌 문제 그대로다.
  - 제안: 세 자리에도 동일한 `Array.isArray` 런타임 가드(+ 명확한 에러 메시지)를 적용하거나,
    적용하지 않기로 한다면 그 판단 근거(예: 위험도가 admission 보다 낮다는 실측)를 남긴다.
    미룰 경우 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 후속 항목으로 명시 등재해
    "완료" 로 닫힌 체크박스가 잔여 표면을 감추지 않도록 한다.

- **[INFO]** `admitExecutionOrDefer` 의 `Array.isArray` 가드가 throw 하면, 그 직전에 등록된
  `this.eventEmitter.registerExecutionRouting(...)` (호출부 `runExecutionFromQueue`,
  admission 호출 이전)이 release 되지 않는다 — `deferred`/`runExecution` 내부 예외 경로는 각각
  `releaseExecutionRouting` 을 호출하지만, 이 admission-throw 경로는 `try/catch` 밖이라 그 호출을
  거치지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3654-3670`
    (`runExecutionFromQueue`, admission 호출 지점)
  - 상세: 다만 이 propagation 경로 자체(uncaught → BullMQ job failed, `attempts:1` 이라 재시도
    없음)는 이번 diff 이전에도 **동일하게 존재**했다 — 가드가 없던 이전 코드도 `rows` 가 배열이
    아니면 `rows.length` 에서 동일하게 uncaught TypeError 를 던졌으므로, 이번 PR 은 그 propagation
    자체를 바꾸지 않았고 메시지만 명확히 했다(주석이 스스로 "가드가 더하는 것은 판정 변경이
    아니라 진단" 이라고 명시). 그래서 이번 diff 가 새로 만든 회귀는 아니라고 판단해 WARNING 이
    아닌 INFO 로 남긴다 — 다만 routing 누수 자체는 여전히 실재하는 잠재 결함이라 별도 항목으로
    적어 둔다.
  - 제안: (선택) `admitExecutionOrDefer` 호출도 `runExecution` 처럼 try/catch 로 감싸
    실패 시 `releaseExecutionRouting` 을 호출하도록 확장 검토.

## 확인된 정합성 (양호)

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 의 신규 2건
  (`execution.node.completed`+`http_request` → debug / `execution.ai_message`+non-string message
  → warn)은 실제 `toChatChannelEvent`(`chat-channel.dispatcher.ts:592-601`, `:501-503`)의 분기
  조건과 `isSubFilterNull`(`:192`) 판정을 line-level 로 정확히 재현한다. 양방향을 다 봐 삼항
  반전 회귀를 잡는 설계도 실제로 유효하다.
- `execution-engine.service.ts:2931-2936` 의 `Array.isArray(rows)` 가드는 `throw`(rollback 보존)를
  선택해, spec(`spec/5-system/4-execution-engine.md` §8, `recoverOrphanPendingExecutions`)이 이미
  문서화한 "job 소실 orphan pending → 부팅 backstop 이 wait-timeout cancelled 로 회수" 경로와
  자연스럽게 맞물린다(가드가 던지면 트랜잭션 롤백 → `pending` 유지 → 기존 backstop 이 스캔).
  `return false`(defer) 로 삼켰다면 실제 UPDATE 가 적용된 경우 DB 는 `running`인데 앱은 defer 로
  처리해 워커 없는 영구 `running` 을 만들 수 있었다는 RESOLUTION.md 의 판단도 코드와 일치한다.
- `executions.service.spec.ts` 의 신규 LRU 경계값 테스트는 실제 `snapshotCache`
  구현(`executions.service.ts:169-201`, `get` 시 delete+set 으로 MRU 갱신, `set` 시 `keys().next()`
  로 최고령 키 evict)과 정확히 일치한다 — 257번째 삽입 시 evict 대상이 `e-1`(직전에 `e-0`을
  읽어 MRU 로 갱신했으므로)이 되는 것까지 손으로 재계산해 검증했고 코드와 일치했다.
- `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환은 값 변경 없음(순수 가시성 확대), 소비처(정의부·
  테스트) 외 부작용 없음을 확인.
- TODO/FIXME/HACK/XXX 신규 주석 없음(diff 전체 grep 확인).
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크박스 갱신(`[ ]`→`[x]`, admission
  가드·snapshotCache evict 항목)은 실제 코드 상태와 일치.
- 관련 spec 본문(`spec/5-system/4-execution-engine.md` §8) 은 admission gate 의 TOCTOU·advisory
  lock·orphan pending backstop 을 규정하지만 `EntityManager.query` 드라이버 shape 방어 자체는
  스펙 대상이 아닌 순수 구현 디테일이다 — 불일치 아님(INFO 대상조차 아님, 이미 이전 라운드
  SUMMARY 가 동일하게 판단).

## 요약

핵심 3건(로그 레벨 분기 테스트, LRU 경계값/방향 테스트, admission `Array.isArray` fail-closed
가드+테스트)은 모두 실제 소스와 line-level 로 정확히 일치하고, 관련 spec(§8 admission gate·
orphan pending backstop)과도 충돌 없이 맞물린다. 다만 이번 admission 가드가 스스로 명시한 방어
근거("드라이버가 배열이 아닌 것을 돌려주면 진단 불가능한 크래시")가 같은 파일의 구조적으로
동일한 `.query()` RETURNING/array 단언 두 곳(`lockNonTerminalExecutionRow`,
`updateExecutionStatus` else 분기 — 후자는 terminal 전이 choke point 라 파급이 더 크다)과 인접
서비스 한 곳(`executions.service.ts:computeChainDepth`)에는 적용되지 않아, "고쳤다" 는 판단이
sibling 전수 조사 없이 한 지점에만 좁게 적용됐다. 이는 CRITICAL 이 아니라 WARNING 이다 — 실제
발생 확률은 극히 낮은 defense-in-depth 성격이고 기존 동작(uncaught crash)을 악화시키지도 않지만,
이 PR 이 스스로 제시한 근거를 완결하려면 sibling 을 함께 다루거나 최소한 후속 항목으로 등재해야
한다.

## 위험도

LOW
