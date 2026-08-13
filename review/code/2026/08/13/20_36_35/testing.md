# 테스트(Testing) 리뷰 — update-returning-rows 튜플 shape 수정

## 발견사항

- **[WARNING]** `updateExecutionStatus` 의 guarded UPDATE 수정 지점은 실측(튜플) shape 로 검증하는 회귀 테스트가 없다 — 기존 테스트는 여전히 old code 와 new code 를 가르지 못하는 mock shape 를 쓴다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8541` (`const persisted = updateReturningRows<{ id: string }>(updated).length > 0;` — diff 게이트 8541) / 회귀 테스트 부재 지점: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1014`("동시 cancel 이 이미 terminal 로 선점..." 테스트, `mockExecutionRepo.query.mockResolvedValueOnce([])` at spec.ts:1032) 및 같은 패턴을 쓰는 spec.ts:3659, 5149, 5458, 5474, 5498, 5652
  - 상세: 이번 PR 은 `admitExecutionOrDefer`(execution-engine.service.ts 게이트 2944) 에는 실측 튜플 shape(`[[{id}],1]`, `[[],0]`) 로 admission 을 거는 신규 테스트 2개를 추가했다(spec.ts 게이트 4405~4446). 그런데 **같은 파일의 또 다른 수정 지점인 `updateExecutionStatus`(게이트 8541) 는 신규/갱신 테스트가 전혀 없다.** 이 지점을 실제로 exercise 하는 기존 테스트들(예: "동시 cancel 이 이미 terminal 로 선점" 테스트, spec.ts:1032 의 `mockResolvedValueOnce([])`)은 여전히 비-튜플(plain array) shape 를 mock 한다. `updateReturningRows([])` 는 `Array.isArray(result[0])` 가 false 이므로 입력을 그대로 반환한다 — 즉 old code(`updated.length > 0`)와 new code(`updateReturningRows(updated).length > 0`)가 이 mock shape 아래서 **항상 동일한 결과**를 낸다. `updateExecutionStatus` 의 수정을 되돌려도(= `assertRowArray`+`updated.length>0` 로 원복해도) 이 스위트는 여전히 GREEN 이다 — 정확히 이번 PR 의 plan 문서(`plan/in-progress/update-returning-tuple-shape.md`)가 자인한 "mock 이 트린 현실을 인코딩해서 4개월간 결함을 못 봤다" 는 패턴이 이 지점에는 그대로 재현되어 있다. `admitExecutionOrDefer` 는 원인이 규명된 CRITICAL(admission 영구 실패)이라 우선 처리됐지만, `updateExecutionStatus`(동시 cancel 선점 분기)도 동일한 결함 클래스이며 그 분기는 concurrency 관련이라 이후 회귀가 특히 재현하기 어렵다.
  - 제안: `updateExecutionStatus`(또는 이를 호출하는 `finalizeFailedExecution` 류 상위 경로) 를 대상으로, `mockExecutionRepo.query` 가 실측 튜플 shape(`[[{id}], 1]` = 적용됨 / `[[], 0]` = 0행 선점)를 반환하도록 무장한 최소 1개의 신규 테스트를 추가해 `persisted` 계산이 실측 shape 아래서도 올바른지 검증한다.

- **[WARNING]** `knowledge-base.service.ts` 의 5개 수정 지점 모두, 대응하는 `knowledge-base.service.spec.ts` 기존 테스트가 비-튜플 mock shape 를 그대로 쓴다 — 헬퍼 적용을 실측 데이터로 증명하지 못한다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`(re-extract CAS), `:541-543`(embedding 재큐), `:572-576`(graph 재큐), `:719`(re-embed CAS), `:740-741`·`756`·`766`(reset). 대응 테스트: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts:356-360`("rejects concurrent re-extract"), `:660-789`(`reEmbedAll` 스위트 전체), `:1208-1320`(`retryFailedDocuments` 스위트 전체)
  - 상세: 위 테스트들은 예외 없이 `mockDataSource.query.mockResolvedValueOnce([{ id: 'kb-1' }])` / `[]` / `docs`(plain array) 형태를 쓴다. 실측 튜플(`[[{id:'kb-1'}], 1]`, `[[], 0]`)이 아니다. `updateReturningRows` 는 첫 원소가 배열이 아니면 입력을 그대로 통과시키므로, 이 mock shape 아래서는 헬퍼를 우회한 old code 와 new code 가 항상 같은 결과를 낸다 — 즉 knowledge-base 쪽 5개 fix 는 **behavioral 회귀 테스트로 뒷받침되지 않는다.** 파일 1(`update-returning-rows.spec.ts`)의 구조적 가드는 "헬퍼가 호출되는가"(grep count)만 검증하며, "실측 shape 아래서 올바르게 동작하는가"는 검증하지 않는다 — 두 안전망의 역할이 다른데, 이 PR 은 execution-engine 에만 후자를 추가했다.
  - 제안: 최소한 각 5개 지점 중 CAS 락 2곳(re-extract/re-embed, 원래 결함이 "락이 거절하지 않는다"는 보안·정합성 성격)은 실측 튜플 shape 로 무장한 회귀 테스트를 1개씩 추가해, 이번에 고친 결함이 이 스위트 안에서도 재발 시 RED 로 잡히게 한다.

- **[INFO]** 신규 admission 테스트 2개 중 "0행 매칭" 케이스는 old code 와 결과가 같아 회귀를 가르지 못하는 fixture 다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4426-4446` ("실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다")
  - 상세: 입력 `[[], 0]` 에 대해 old code(`rows.length === 1` → `[[],0].length` = 2 → `false`)와 new code(`updateReturningRows([[],0]).length === 1` → `[].length` = 0 → `false`)가 동일하게 `false` 를 낸다. 즉 이 테스트만 놓고 보면 fix 를 되돌려도 GREEN 이다 — 회귀 discriminator 는 짝인 gate 4405-4424("1행 매칭"이면 admitted) 하나뿐이다. 테스트 자체의 의도("두 방향을 다 본다")는 정상 동작 확인으로서는 유효하니 문제는 아니지만, 코멘트가 "회귀 가드"처럼 읽힐 수 있어 실제 판별력과 괴리가 있다는 점은 명확히 해두는 게 좋다.
  - 제안: (선택) 주석에 "이 케이스는 회귀 discriminator 가 아니라 정상성 확인용"임을 한 줄 덧붙이면 다음 리뷰어의 오해를 줄일 수 있다.

- **[INFO]** `updateExecutionStatus` 의 로컬 변수 타입 선언이 여전히 "행 배열"이라고 주장해, 다음 테스트 작성자가 동일한 오해에 빠질 유인을 남긴다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8504` (`const updated: Array<{ id: string }> = await this.executionRepository.query(...)`) — 이번 diff 범위 밖(불변 코드)이지만 게이트 8541 바로 위 8곳 이내
  - 상세: 같은 파일의 `admitExecutionOrDefer` 쪽(라인 2918)은 `m.query<{ id: string }[]>(...)` 호출부 주석에서 "제네릭은 주장이지 검증이 아니다"라고 이미 스스로 정정해 뒀는데, `updateExecutionStatus` 쪽은 타입 선언(`Array<{ id: string }>`)이 실측과 반대되는 채로 남아 있다. 이 타입이 TS 상 "행 배열"로 보이므로, 이 필드를 새로 mock 하는 사람은 `[{id}]` 같은 비-튜플 값을 다시 만들 가능성이 높다 — 이번 PR 이 고치려던 바로 그 함정이다.
  - 제안: `const updated: unknown = await this.executionRepository.query(...)` 로 바꾸거나 최소한 `admitExecutionOrDefer` 와 동일한 정정 주석을 남겨, 실측 shape(튜플)과 타입 선언의 괴리를 없앤다.

## 요약

`updateReturningRows` 헬퍼 자체(`update-returning-rows.spec.ts`)는 4가지 shape(튜플/빈튜플/행배열/비배열)를 명확한 의도 설명과 함께 잘 커버하고, 그 위에 얹은 구조적 재발 가드(소비 지점 수 == 헬퍼 호출 수 grep 카운트, 대조군 2곳 고정)는 이 저장소가 반복해서 겪은 "헬퍼는 만들었는데 새 소비 지점이 헬퍼를 빠뜨리는" 실패 클래스를 잘 막는다. 다만 이 구조적 가드는 "헬퍼가 호출됐는가"만 증명할 뿐 "실측 shape 아래서 올바르게 동작하는가"는 증명하지 않는데, 이번 PR 은 그 행동적(behavioral) 회귀 테스트를 `admitExecutionOrDefer` 한 곳에만 추가했다. 같은 파일의 `updateExecutionStatus`(동시 cancel 선점이라는 concurrency 성격의 CRITICAL 급 분기) 와 `knowledge-base.service.ts` 의 5개 수정 지점은 여전히 예전 그대로의 비-튜플 mock 을 쓰는 기존 테스트에 의존하고 있어, 그 mock shape 아래서는 fix 를 되돌려도 스위트가 GREEN 을 유지한다 — plan 문서 스스로가 진단한 "mock 이 트린 현실을 인코딩한다" 문제가 정확히 같은 형태로 6곳 중 5곳에 남아 있다는 뜻이다. 프로덕션 코드 자체는 헬퍼의 shape-무관 설계 덕에 정상 동작하므로 현재 시점의 기능 결함은 아니지만, 테스트 관점에서는 "이번에 고친 결함 클래스가 재발해도 잡아낼 안전망"이 6곳 중 1곳에만 있다는 비대칭이 핵심 리스크다.

## 위험도

MEDIUM
