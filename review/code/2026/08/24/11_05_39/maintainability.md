# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 함수 분리 리팩터링 후 JSDoc 이 원래 있던 함수(이제는 orchestrator 로 남은 `allowlistFanoutNodeOutput`)의 설명을 그대로 두른 채, 새로 추출된 하위 헬퍼(`narrowTopLevelNodeOutput`) 머리 위에 남았다 — 이 문서가 서술하는 범위(정확도)가 실제 함수 범위보다 넓다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:171` (JSDoc 시작) ~ `:190` (`narrowTopLevelNodeOutput` 종료). orchestrator 는 `:192`~`:214` `allowlistFanoutNodeOutput`.
  - 상세: 이 diff 는 기존 `allowlistFanoutNodeOutput` 내부에 인라인돼 있던 top-level `nodeOutput` 좁히기 로직을 `narrowTopLevelNodeOutput(envelope, key)` 라는 별도 헬퍼로 추출하고, 두 번 호출(`'nodeOutput'`, `'output'`)하도록 바꿨다. 그런데 원래 함수 위에 있던 JSDoc(171~181행, 이번 diff 에서 손대지 않은 컨텍스트 줄) — *"fanout envelope 안의 `nodeOutput` **두 자리**를 fail-closed allowlist 로 좁힌다 … 폼 waiting 은 `nodeOutput`, 버튼 waiting 은 `buttonConfig.nodeOutput`"* — 는 그대로 새 함수 `narrowTopLevelNodeOutput` 머리 위에 남았다. 하지만 `narrowTopLevelNodeOutput` 은 **buttonConfig 를 전혀 모른다** — 그 로직은 `allowlistFanoutNodeOutput`(201~211행)에 별도로 남아 있다. 즉 이 JSDoc 을 그대로 읽으면 "이 함수가 두 자리(top-level + buttonConfig)를 다 처리한다" 고 오해하게 되는데, 실제로 `narrowTopLevelNodeOutput` 은 파라미터로 받은 키 하나만 좁히고 buttonConfig 는 손대지 않는다. 정작 `narrowTopLevelNodeOutput` 고유의 계약(`key: 'nodeOutput' | 'output'` 파라미터가 왜 둘인지, 왜 top-level 두 번 호출하는지)은 이 JSDoc 어디에도 설명돼 있지 않다 — 그 설명은 오히려 호출부인 `allowlistFanoutNodeOutput` 안의 라인 주석(195~197행)에 있다.
  - 이 파일은 바로 몇 줄 위(162~169행)에 **같은 종류의 결함을 이미 한 번 겪은 이력**을 라인 주석으로 남겨 뒀다 — *"블록 JSDoc 으로 두었더니 붙을 선언이 없어 당시 뒤따르던 선언의 문서로 읽혔다(`14_55_29` maintainability W4)"*. 이번 리팩터링에서 그 교훈에도 불구하고 "JSDoc 이 리팩터링 후 엉뚱한 선언에 붙는다" 는 같은 클래스의 문제가 다시 발생했다 — 이번엔 파일이 사라진 게 아니라 함수가 쪼개지면서 범위가 어긋난 변형이다.
  - 제안: JSDoc 을 두 개로 나눈다. `allowlistFanoutNodeOutput` 위에는 "두 자리(top-level + buttonConfig)를 판다" 는 현재 문구를 옮기고, `narrowTopLevelNodeOutput` 위에는 이 헬퍼 고유 계약(단일 top-level 키 하나를 파라미터로 받아 좁히고, 호출자가 두 키에 대해 각각 호출한다는 것)을 새로 적는다.

- **[INFO]** 같은 서사(반증된 유예 근거 + 실 DB 조회 결과)가 코드 주석·테스트 JSDoc·문서 4곳 이상에 유사하지만 미묘하게 다른 표현으로 중복돼 있어, 다음에 이 결정이 또 뒤집히면 손-동기화 지점이 늘어난다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:472`~`483`(`toFanoutEnvelope` JSDoc) / `codebase/backend/src/modules/websocket/websocket.service.spec.ts:906`~`923`(캐너리 테스트 JSDoc) / `CHANGELOG.md`(28~38행 부근) / `plan/complete/sse-nodeoutput-allowlist.md`(30~38행) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(136~154행)
  - 상세: "`{}` 측정 자체는 맞았지만 `outputData` 가 된다는 전제가 틀렸다 — flat record 는 in-memory `nodeOutputCache` 에만 들어간다 / 실 DB 조회 93행 중 84 object, top-level 키는 `meta`·`config`·`output`·`port`·`status`·`conversationConfig` 뿐"이라는 동일 사실이 최소 5곳에 각각 다른 문장으로 반복 서술된다. 이 프로젝트 자체가 과거에 "미러 스윕을 두 번 놓쳤다"(같은 PR 의 `plan/complete/sse-nodeoutput-allowlist.md` §작업 기록에 명시)는 이력이 있을 만큼 이런 다중 사본 서술이 drift 를 유발한 전례가 있다. 코드/테스트 관점에서는 큰 문제가 아니지만(코드 자체는 한 chokepoint 로 수렴돼 있음), 주석·문서 유지보수 비용 관점에서는 반복 서술량이 많다.
  - 제안: 다음에 이 결정이 다시 바뀌면(예: 폴백 shape 이 실제로 관측되는 경우), 코드/테스트 쪽 JSDoc 은 "실측 근거 상세"를 반복하지 않고 plan/트래커 문서를 가리키는 짧은 참조로 축약하는 것을 고려— 코드 파일은 "무엇을/왜"만, "언제 무엇이 틀렸는지의 서사"는 plan 쪽 단일 SoT 에만 두는 편이 향후 스윕 대상이 줄어든다.

- **[INFO]** 이번에 추가된 캐너리 테스트 2건이 주제와 무관한 `describe` 블록(`llmCalls strip`) 안에 위치 — 기존에 이미 트래커에 등재된 동일 클래스 이슈를 한 건 더 늘렸다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:925`(`it('[캐너리] execution.node.* 의 envelope.output 도 allowlist 를 지난다', …)`), `:976`(`it('[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다 …', …)`)
  - 상세: 두 테스트 모두 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` (604행 시작, 다음 `describe` 는 1183행) 스코프 안에 있다. 하지만 두 테스트의 주제는 `llmCalls` strip 이 아니라 `nodeOutput`/`output` allowlist 좁히기다 — 원래 이 표면을 다루는 `describe` 는 별도로 존재한다(751행 부근 *"fanout `nodeOutput` 은 fail-closed allowlist 다"*). 같은 PR 의 `plan/complete/sse-nodeoutput-allowlist.md`(129~130행)가 이미 이전 라운드에서 *"describe 블록 이동(testing 14 + 12)은 정본 트래커에 등재했다"* 고 기록해 둔, **의도적으로 유예된 기존 이슈**의 연장선이다. 이번 PR 이 그 잘못된 위치에 새 테스트를 2건 더 추가해 향후 이동 시 옮길 대상이 늘었다.
  - 제안: 새 코드가 아니라 이미 트래커에 있는 항목이므로 이번 PR 에서 반드시 고칠 필요는 없다 — 다만 그 트래커 항목을 처리할 때 이번에 추가된 2건도 함께 옮겨야 한다는 점을 등재 항목에 명시해 두는 것을 권장.

- **[INFO]** `(x as Record<string, unknown>).y as Record<string, unknown>` 형태의 이중 타입 단언이 새 테스트 2곳에서 그대로 반복된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:943`~`946`, `:989`~`992`
  - 상세: `const out = (fanout.payload as Record<string, unknown>).output as Record<string, unknown>;` 형태가 두 신규 테스트에 동일하게 나타나고, 파일 전체에도 유사 패턴이 여러 번 반복된다(예: 901행). 기존 파일 스타일과 일관되므로 이번 diff 만의 새 결함은 아니지만, 작은 타입 단언 헬퍼(`asRecord(x, key)`)로 뽑으면 테스트 본문의 신호 대 잡음비가 개선된다.
  - 제안: 우선순위 낮음 — 기존 파일 전역 스타일과의 일관성을 이유로 이번 PR 범위에서 강제할 사안은 아니다.

## 요약

핵심 변경(`codebase/backend/src/modules/websocket/websocket.service.ts` 의 `narrowTopLevelNodeOutput` 추출 + `allowlistFanoutNodeOutput` 에서 재사용)은 오히려 기존의 인라인 중복(top-level `nodeOutput` 좁히기 블록이 반복될 뻔한 지점)을 헬퍼 함수로 걷어내 DRY 를 개선했고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮게 유지된다. 네이밍도 `narrowTopLevelNodeOutput`/`allowlistFanoutNodeOutput` 모두 의도를 잘 드러낸다. 가장 실질적인 흠은 리팩터링 후 **JSDoc 이 원래 함수(현재는 orchestrator)의 설명을 그대로 지닌 채 새로 추출된 좁은 헬퍼 위에 남아, 문서 범위가 실제 함수 범위보다 넓게 읽힌다**는 점이다 — 이 파일이 과거 정확히 같은 클래스의 실수를 라인 주석으로 자체 기록해 둔 바로 몇 줄 위에서 재발했다는 점에서 지적할 가치가 있다. 그 외에는 서사 중복(코드/테스트/문서 다중 사본)과, 이전 라운드부터 트래커에 등재돼 있던 describe 블록 배치 문제가 이번 PR 로 두 건 더 늘어난 점 정도가 관찰되며, 둘 다 이미 알려진 이슈의 연장이라 급하지 않다. 전체적으로 코드 품질은 양호하다.

## 위험도
LOW
