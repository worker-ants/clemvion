# Testing Review — EIA §6.4 종결 `error` 객체화 (3라운드, `22_55_51`→`23_17_57` 이후)

## 발견사항

- **[WARNING]** `finalizeStalledExhausted` 의 자식 `NodeExecution` cascade `error` 값(특히 `stalledError.code` 참조)이 어떤 테스트에서도 검증되지 않는다 — 뮤테이션으로 생존 실측
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3299` (`code: stalledError.code,` — 자식 cascade `.set()` 안). 대응 테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4769-4771` (`expect(nodeQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: NodeExecutionStatus.FAILED }))`).
  - 상세: 이 diff 자신의 주석(`execution-engine.service.ts:3297-3298` — "부모와 같은 code — 위 `stalledError` 를 도입한 이유(손으로 반복하면 갈린다)가 30줄 아래에서 그대로 재현되고 있었다")이 밝히듯, 이 줄은 정확히 "손으로 값을 반복하면 갈린다"는 이 PR 의 핵심 교훈을 다시 겪은 자리를 고친 것이다. 그런데 그 수정을 검증하는 테스트가 없다 — `execution-engine.service.spec.ts:4769-4771` 의 자식 cascade 단언은 `status` 필드만 `objectContaining` 으로 보고, `error` 필드(코드 상으로는 `{code: stalledError.code, message: 'Node failed: parent execution stalled (재배달 소진)'}`) 는 전혀 언급하지 않는다. 부모 UPDATE(`:4760-4764`)와 emit(`:4775-4787`)은 이번 라운드에서 이미 값까지 고정됐지만, 같은 함수의 세 번째 쓰기 지점(자식 cascade)만 비어 있다.
  - **뮤테이션으로 검증**: `execution-engine.service.ts:3299` 를 `code: stalledError.code,` → `code: 'MUTATED_WRONG_CODE',` 로 바꾼 뒤 `npx jest execution-engine.service.spec.ts` 전체 실행 — **448/448 GREEN 유지**(대상 테스트 포함). 원본으로 복원 후 `git diff` 로 원복 확인.
  - 제안: `:4769-4771` 을 `expect(nodeQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: NodeExecutionStatus.FAILED, error: { code: 'WORKER_HEARTBEAT_TIMEOUT', message: 'Node failed: parent execution stalled (재배달 소진)' } }))` 형태로 확장한다(부모 UPDATE·emit 단언과 동일 패턴). 이렇게 하면 `stalledError.code` 참조가 끊어지거나 리터럴로 되돌아가는 회귀를 이 PR 이 스스로 세운 원칙대로 잡을 수 있다.

- **[INFO]** 프런트엔드 `handleExecutionFailed` 의 "object 인데 `message` 없음" / "`error` 자체가 `null`·부재" fallback 분기(`use-execution-events.ts:264-271`, `errorMessage ?? "Execution failed before the tool completed"`)는 여전히 직접 테스트로 고정되지 않았다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-271`. 대응 테스트는 `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1123`(string 케이스)·`:1140`(object+message 케이스) 뿐.
  - 상세: 직전 라운드(`23_17_57` testing INFO)에서 이미 같은 지점을 "차단 사유 아님"으로 지적했고, `23_17_57/RESOLUTION.md` INFO 18 도 "헬퍼가 `message: ''` 로 흡수하므로 크래시 경로 아님"이라며 의도적으로 미조치를 확정했다. 이번 diff 에서도 그 판단대로 새 테스트가 추가되지 않았다 — 재확인 차 다시 기록하되, 이미 두 라운드에 걸쳐 명시적으로 트리아지된 항목이라 등급을 올리지 않는다.
  - 제안: 이전 라운드 판단(비차단) 유지. 저비용이므로 여유가 있으면 캐너리 하나만 추가해도 좋다.

## 관점별 평가

1. **테스트 존재 여부**: 신규 헬퍼 `toTerminalErrorPayload` 는 자체 spec(14+ 케이스, `it.each` 3종)으로 충분히 커버되고, `dispatcher`/`retry-turn`/프런트엔드 `use-execution-events` 의 변경도 대응 테스트가 갱신·신설됐다. `EXECUTION_FAILED` 4개 emit 지점 중 3곳(`failFirstSegmentSetup`, `finalizeStalledExhausted` 부모, `finalizeFailedExecution`)은 이번 라운드까지 값 단언이 완비됐다 — 다만 `finalizeStalledExhausted` 의 **자식 cascade** 는 여전히 값 미검증(위 WARNING).
2. **커버리지 갭**: 위 WARNING 이 유일한 실측 갭. 직전 두 라운드가 지적한 W8(2개 emit 값 미검증)·W9(bigint 무증상)·W1(failFirstSegmentSetup 미검증)은 이번 diff 로 실제로 닫힌 것을 재확인했다(각각 뮤테이션으로 재검증).
3. **엣지 케이스**: `terminal-error-payload.spec.ts` 는 null/undefined/string/number/boolean/bigint/symbol, 필드별 타입가드(`code`/`nodeId`/`message` 비문자열), `details` optional, 입력 불변성까지 폭넓게 커버한다. `it.each` 의 파라미터-타이틀 대응(`%p`→scalar 값, `%s`→label)도 실제 배열 순서와 일치해 뒤바뀜 결함이 없다(직접 대조 확인).
4. **Mock 적절성**: `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 의 `eventEmitter.emitExecution` spy·`nodeQb`/`execQb` 는 실제 서비스 로직을 그대로 태우고 호출 인자만 가로채는 적절한 패턴이다. 다만 `nodeQb.set` 에 건 mock 을 걸어놓고 `error` 인자를 확인하지 않아(위 WARNING) mock 의 가치를 절반만 쓰고 있다.
5. **테스트 격리**: 각 `it`/`it.each` 케이스가 독립 fixture 를 구성한다. `terminal-error-payload.spec.ts` 는 순수 함수 테스트라 격리 이슈 없음. `execution-engine.service.spec.ts` 는 `mockExecutionRepo`/`mockNodeExecutionRepo` 를 케이스별로 재정의해 순서 의존이 없다.
6. **가독성**: 테스트마다 "왜"를 설명하는 한국어 주석(특히 뮤테이션 생존 이력을 명시한 것들)이 의도를 명확히 드러낸다. dispatcher spec 의 타이틀(`code=null`)도 실제 assertion 과 일치한다.
7. **회귀 테스트**: `chat-channel.dispatcher.spec.ts` 의 back-compat 테스트가 새 계약(`code: null`)에 맞게 전부 갱신됐고, 프런트 `use-execution-events.test.ts` 의 신규 캐너리(객체가 스토어에 안 들어감)는 이전 라운드 CRITICAL fix 의 회귀 방지선으로 유효하다. `finalNodeId`/`finalPort` 제거도 stale 참조가 없다. 다만 위 WARNING 은 "이 PR 이 스스로 만든 drift 방지 리팩터"에 대한 회귀 테스트가 빠진 경우다.
8. **테스트 용이성**: `toTerminalErrorPayload(err: unknown)` 는 DI 없는 순수 함수라 격리 테스트가 쉽고 이점을 최대로 활용했다. `finalizeStalledExhausted` 는 세 번의 DB/emit 쓰기(부모 UPDATE·자식 cascade UPDATE·emit)를 한 메서드에서 순차 수행하는 구조라, 세 번째(자식 cascade)만 검증에서 빠지기 쉬운 형태다 — mock QueryBuilder 체인이 `set()` 호출 인자를 그대로 캡처할 수 있으므로 테스트 용이성 자체는 낮지 않다(비용 문제가 아니라 누락 문제).

## 요약

핵심 신규 헬퍼(`toTerminalErrorPayload`)와 대표 소비처(`chat-channel` back-compat wrap, `retry-turn.service`, `failFirstSegmentSetup`, `finalizeFailedExecution`, 프런트엔드 `use-execution-events`)는 세 라운드에 걸쳐 뮤테이션까지 동원해 촘촘히 검증됐고, 직전 두 라운드가 지적한 갭(W8·W9·failFirstSegmentSetup 값 미검증)은 이번 diff 로 실제 닫힌 것을 재확인했다. 다만 같은 함수(`finalizeStalledExhausted`) 안에서 부모 UPDATE·emit 은 값까지 고정됐는데 **자식 `NodeExecution` cascade 의 `error` 필드만 여전히 미검증**이다 — 이 줄은 이 PR 자신의 주석이 "손으로 값을 반복하면 갈린다"는 교훈을 재현한 자리라고 밝히는 바로 그 위치라서, 회귀 방지 테스트가 빠져 있다는 사실이 특히 아이러니하다. 뮤테이션(`stalledError.code` → 임의 값)으로 448개 전체 테스트가 GREEN 유지됨을 직접 확인했다. 외부 wire(EIA emit)는 정확히 검증되므로 대외 영향은 없고 DB 내부 `NodeExecution.error.code` 값에 한정된 낮은 위험이다. 프런트엔드 fallback 분기 하나는 두 라운드째 의도적으로 비차단 INFO 로 유지되고 있어 그대로 둔다.

## 위험도

LOW
