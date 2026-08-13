# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** 새 주석이 설명하는 바로 그 사실을 **20줄 위의 옛 주석이 정면으로 부정**한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2917` (Read 로 실제 파일 직접 확인 — 프롬프트 조립 문서의 diff 는 이 줄을 문맥으로도 포함하지 않아 게이트가 없음)
  - 상세: `admitExecutionOrDefer` 안, `m.query<{ id: string }[]>(...)` 바로 위 줄(2916~2917)에 여전히 다음 주석이 남아 있다: `// 전부 any 가 된다. RETURNING id 이므로 실제 shape 은 행 배열이다.` 그런데 같은 함수, 같은 변수 `rows` 를 설명하는 새 주석(diff 로 추가된 부분, `execution-engine.service.ts:2938`~`2943`)은 정확히 반대로 말한다: `// UPDATE 는 [rows, rowCount] 튜플을 돌려준다 — rows.length === 1 을 그대로 쓰면 항상 2 라 영원히 거짓이었다`. 이번 PR 이 고친 버그의 근본 원인이 "RETURNING 이 있으니 행 배열일 것"이라는 잘못된 믿음이 코드베이스 전역에 퍼져 있었다는 것(plan 문서 Rationale)인데, 바로 그 잘못된 문장이 이번에 고친 함수 안에 그대로 살아남아 새 주석과 모순된 채 공존한다. 다음에 이 코드를 읽는 사람이 두 주석 중 먼저 눈에 띄는 걸 믿으면 동일한 클래스의 회귀가 재발할 수 있다.
  - 제안: 2916~2917 의 "RETURNING id 이므로 실제 shape 은 행 배열이다" 문장을 삭제하거나 새 주석(2938~2943)과 통합해 하나의 정확한 설명으로 만든다.

- **[WARNING]** 수정된 지점의 타입 애너테이션이 여전히 "행 배열"이라고 주장 — 이번 결함의 원인과 동일한 형태의 오문서화가 그대로 남음
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2918` — `const rows = await m.query<{ id: string }[]>(...)` (admission UPDATE, Read 로 확인)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8504` — `const updated: Array<{ id: string }> = await this.executionRepository.query(...)` (updateExecutionStatus guarded UPDATE, Read 로 확인)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:336` — `manager.query<{ id: string }[]>(...)` (reExtractAll CAS 락)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:530` — `this.dataSource.query<{ id: string }[]>(...)` (embedding 재큐)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:563` — 〃 (graph 재큐)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:711` — 〃 (reEmbedAll CAS 락)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:728` — 〃 (reset)
  - 상세: 새 헬퍼 `update-returning-rows.ts` 의 JSDoc 은 "TypeORM 0.3.31 + pg 는 UPDATE/DELETE 에만 `[rows, rowCount]` 튜플을 돌려준다"고 명시하는데, 위 7곳은 여전히 `.query<{ id: string }[]>` / `Array<{ id: string }>` 로 결과 타입을 "행 배열"이라 선언한다. `EntityManager.query`/`Repository.query` 의 실제 선언 타입이 `Promise<any>` 라 TypeScript 가 이 거짓 주장을 검증해주지 않는다(assert-row-array.ts 의 자체 문서화 내용과 동일한 함정). 타입 시그니처는 코드를 읽는 사람에게는 사실상 문서다 — 이 시그니처를 그대로 복사해 새 UPDATE/DELETE raw 쿼리 지점을 추가하는 다음 개발자는 `updateReturningRows` 를 거치지 않고 바로 `.length`/`.map` 을 써도 타입 체커가 아무 것도 잡아주지 않아 동일한 4개월짜리 결함을 재현할 수 있다.
  - 제안: 이 7곳의 제네릭/타입 애너테이션을 `unknown`(또는 `updateReturningRows` 의 파라미터 시그니처에 맞춘 타입)으로 바꾸거나, 최소한 "이 타입은 실제 런타임 shape 이 아니다"라는 주석을 바로 옆에 남긴다.

- **[WARNING]** CHANGELOG.md 에 이번 수정에 대한 항목이 없음
  - 위치: `CHANGELOG.md` (미변경 — 리뷰 대상 파일에 포함되지 않음)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "Unreleased" 절에 이번과 유사한 성격(운영 admission-gate 동작, 조용히 깨져 있던 프로덕션 동작)의 변경을 상세 서술로 적극 기록하는 관행이 확립돼 있다(예: `IdempotencyInterceptor` fail-open 계측, `ChatChannelDedupService`). 이번 변경은 사용자에게 체감되는 실제 결함이다 — 워크플로/워크스페이스 동시성 cap 이 정상 경로에서는 사실상 미집행이었고, KB 재추출/재임베딩 CAS 락이 동시 요청을 한 번도 거절하지 못했으며(`동시 재추출 허용`), 실패 문서 재큐잉이 `documentId: undefined` 인 가짜 job 을 큐잉했다. 그런데도 CHANGELOG 에는 해당 항목이 없다.
  - 제안: 관행에 맞춰 "Unreleased" 절에 이번 수정 요약(무엇이 깨져 있었고 사용자에게 어떤 영향이 있었는지)을 추가한다.

- **[INFO]** "raw UPDATE/DELETE 결과는 `updateReturningRows` 를 거쳐야 한다"는 규약이 `spec/conventions/` 에 없음
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (전체), `plan/in-progress/update-returning-tuple-shape.md`
  - 상세: 헬퍼 자체의 JSDoc 과 plan 문서의 Rationale 은 훌륭하게 문서화돼 있지만, 새 회귀 가드(`update-returning-rows.spec.ts`)는 정적 grep 으로 **이미 알고 있는 두 파일**(`execution-engine.service.ts`, `knowledge-base.service.ts`)의 소비 지점 수만 고정한다. 다른 모듈에 새 raw `UPDATE ... RETURNING` 쿼리를 추가하는 개발자는 이 규약의 존재를 알 방법이 spec.ts 파일의 describe 블록을 우연히 읽는 것뿐이다. `spec/conventions/` 에 짧게라도 이 규약을 남기면 발견 가능성이 올라간다. (plan 문서가 "AST 기반 전역 가드는 후속 과제"라고 명시적으로 defer 한 점은 합리적이며, 이 항목은 그 defer 와 별개로 규약 자체의 discoverability 문제다.)
  - 제안: `spec/conventions/` 에 "raw `.query()` 로 UPDATE/DELETE RETURNING 을 소비할 때는 `updateReturningRows` 를 거친다"는 짧은 규약 문서를 추가하거나, 최소한 `assert-row-array.ts` JSDoc 에서 `update-returning-rows.ts` 를 상호 참조한다.

- **[INFO]** (긍정 사례) 신규 문서화 품질이 매우 높음 — 참고용으로 기록
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`, `codebase/backend/src/common/utils/update-returning-rows.spec.ts`, `plan/in-progress/update-returning-tuple-shape.md`
  - 상세: 헬퍼 JSDoc 은 실측 표(shape별 `length`)와 근본 원인·과거 두 차례 회귀 사례를 명시해 "왜 이렇게 짰는지"가 코드만으로 완결된다. `update-returning-rows.spec.ts` 의 구조적 가드 describe 블록은 자신의 정적 grep 이 가진 사각지대(`let`·체이닝 형태)를 스스로 명시하고, 대조군(구조분해·`deletedRowCount`)까지 함께 고정해 문서-코드 정합을 검증 가능하게 만든다. `plan/in-progress/update-returning-tuple-shape.md` 는 Overview/실측/원인/처방/검증/Rationale 구조를 갖춰 프로젝트 규약(SDD)에 부합한다.

## 요약

이번 변경은 UPDATE/DELETE raw 쿼리 결과가 `[rows, rowCount]` 튜플이라는 사실을 몰라 4개월간 조용히 깨져 있던 admission gate·CAS 락·재큐잉 로직을 고치는 PR이며, 새로 추가된 헬퍼(JSDoc)·구조적 회귀 가드 테스트·plan 문서의 문서화 품질 자체는 이 저장소 기준으로도 상당히 높다. 다만 정작 수정한 코드 주변에 **이번 결함을 만든 바로 그 오해("RETURNING 이 있으니 행 배열")를 담은 옛 주석이 새 주석과 모순된 채 남아 있고**, 관련 7개 지점의 타입 애너테이션도 여전히 실제 런타임 shape 과 다른 "행 배열"을 주장해, 향후 유사 지점을 추가할 개발자가 타입 시그니처를 신뢰하면 동일 결함을 재현할 위험이 있다. 또한 저장소가 적극적으로 유지하는 CHANGELOG 관행에도 불구하고 이 정도 사용자 영향이 있는 수정에 항목이 빠져 있다.

## 위험도

MEDIUM
