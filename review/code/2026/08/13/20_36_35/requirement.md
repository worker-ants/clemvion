# 요구사항(Requirement) 리뷰

## 발견사항

- **[CRITICAL]** 이 PR 이 고친 것과 정확히 같은 결함 클래스(TypeORM 0.3.31 이 `UPDATE`/`DELETE ... RETURNING` 을 `[rows, rowCount]` 튜플로 반환)가 `auth-oauth.service.ts`의 소셜 로그인 콜백에 그대로 남아 있다 — 실서비스 Google/GitHub 로그인이 항상 실패할 것으로 추정된다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback`, 실제 파일 138~152행 부근 — 본 파일은 이번 diff 대상이 아니라 게이트 번호가 없다). 핵심 코드:
    ```ts
    const consumed = await this.dataSource.query<AuthOAuthState[]>(
      'DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW() RETURNING *',
      [state],
    );
    if (consumed.length === 0) { throw ... OAUTH_STATE_MISMATCH ... }
    const record = consumed[0];
    if (record.provider !== provider) { throw ... 'Provider mismatch for OAuth state' ... }
    ```
  - 상세: `this.dataSource.query(sql, params)` (2-인자 호출, `useStructuredResult` 미지정)는 `node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:198-207`(직접 확인, 설치된 버전 0.3.31 — 이 PR의 실측과 동일 버전)에서 `DELETE`/`UPDATE` 커맨드에 한해 `result.raw = [raw.rows, raw.rowCount]` 를 그대로 반환한다. 즉 `consumed` 는 항상 `[rowsArray, rowCount]` 형태이고 `.length` 는 **항상 2**(0 이 아님), `consumed[0]` 은 **행 배열 자체**(단일 row 객체가 아님)다. 결과: (1) `consumed.length === 0` 분기가 영원히 타지 않아 "이미 소비/만료된 state" 를 절대 거절하지 못하고, (2) `record = consumed[0]` 은 배열이므로 `record.provider` 는 항상 `undefined` → `record.provider !== provider` 가 항상 참 → **정상적인 콜백도 예외 없이 `OAUTH_STATE_MISMATCH`("Provider mismatch for OAuth state")로 던진다.** `isOAuthStubEnabled()` 가드는 `exchangeCodeForToken`/`fetchProfile` 에만 있고 이 DB 소비 단계보다 뒤에 위치해 스텁 모드에서도 이 경로는 실 DB 를 친다. 이 PR 의 새 헬퍼(`update-returning-rows.ts`)와 동일 값의 반대 형제 함수인 `integration-oauth.service.ts`의 `consumeOAuthState`(838~848행)는 정확히 같은 문제를 `queryResult[0]` 로 이미 올바르게 처리하고 있어 대조군이 된다. 유닛 테스트(`auth-oauth.service.spec.ts:197~295`)는 `dataSource.query.mockResolvedValueOnce([validState])` 처럼 실제와 다른(INSERT 형) shape 로 mock 해 GREEN 이고, 이 콜백 경로에 대한 e2e 커버리지도 저장소에 없다 — 이 PR의 plan 문서(`plan/in-progress/update-returning-tuple-shape.md`)가 스스로 명명한 "GREEN 두 겹" 패턴과 동형이다.
  - 제안: `updateReturningRows` 로 `consumed` 를 언랩한 뒤 `.length`/`[0]` 을 사용하도록 수정. plan 문서의 "backend 전역 `.query()` 소비 41곳 감사" 가 이 지점을 놓쳤다는 뜻이므로, 완료 처리 전에 plan 체크리스트에 이 지점을 추가하고 실측(RED→GREEN) 재현을 권장한다. (이 diff 의 리뷰 대상 파일 목록 밖이라 CRITICAL 이 이 PR 자체를 막을 근거는 약하지만, 이 PR 이 다루는 문제의 완전성 주장을 직접 반증하므로 동일 작업 내 후속 처리를 강하게 권고한다.)

- **[WARNING]** 새로 추가된 `update-returning-rows.spec.ts` 가 자체 lint 게이트를 통과하지 못한다 — plan 문서의 "`lint --max-humans 0` 통과" 검증 기록과 불일치.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:65` (diff 게이트 65행, `join(SRC, 'modules/knowledge-base/queues/stuck-document-recovery.service.ts')`)
  - 상세: `npx eslint "src/**/*.ts" --max-warnings 0` (package.json 의 `lint` 스크립트와 동일 커맨드) 실행 시 `prettier/prettier` 포맷 오류 1건이 이 줄에서 발생해 lint 가 실패한다(직접 재현 확인).
  - 제안: `npx eslint --fix` 또는 `prettier --write` 로 포맷 정정 후 재검증.

- **[WARNING]** `execution-engine.service.ts` 의 두 지점에서 `assertRowArray` 호출(호출부-특화 진단 메시지)이 `updateReturningRows`(범용 메시지)로 대체되며 실패 시 진단 정보가 줄었다 — 같은 저장소가 `assert-row-array.ts` 자체 docstring에서 "메시지는 호출부가 준다... 그 설명이 진짜 값어치다" 라고 명시한 설계 원칙과 어긋난다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 2944행(`admitExecutionOrDefer`) 및 8541행(`updateExecutionStatus`).
  - 상세: 제거된 두 `assertRowArray(...)` 호출은 각각 `` `admission UPDATE ... RETURNING, execution ${executionId}. 트랜잭션을 롤백한다(부분 적용 방지).` ``, `` `updateExecutionStatus guarded UPDATE ... RETURNING, execution ${execution.id} → ${newStatus}. false 로 넘기면 종결 이벤트가 조용히 유실된다.` `` 처럼 실행 ID·목표 상태를 포함한 메시지를 던졌다. `updateReturningRows` 는 대신 `` `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})` `` 라는 위치·컨텍스트 없는 범용 메시지만 던진다. 배열이 아닌 값이 오는 경우는 극히 드문 방어적 분기이지만, 발생 시 어떤 execution 의 admission/종결에서 터졌는지 로그만으로 알 수 없게 됐다. 기능 자체(throw 하여 안전하게 실패)는 보존되므로 CRITICAL 은 아니다.
  - 제안: `updateReturningRows` 에 선택적 `detail` 문자열 인자를 추가해 호출부가 컨텍스트를 실어 보낼 수 있게 하거나, 호출부에서 `try/catch` 로 감싸 원 에러 메시지에 context 를 prefix.

- **[WARNING]** `knowledge-base.service.ts`의 5개 수정 지점(CAS 락 2곳·재큐 2곳·reset 1곳)에 대해, 실제 드라이버가 반환하는 튜플 shape(`[[{id}], N]`)를 사용하는 회귀 테스트가 전혀 추가되지 않았다 — `execution-engine.service.spec.ts`에는 실측 shape 테스트 2건이 추가된 것과 대조적이다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` (diff 대상 아님 — 미변경 확인. `reExtractAll`/`reEmbedAll`/`retryFailedDocuments` 관련 테스트 전체 grep 결과 `[[{` 튜플 패턴 0건).
  - 상세: `beforeEach` 의 기본 `mockDataSource.query = jest.fn().mockResolvedValue([])`, 그리고 각 테스트가 override 하는 값(`[{ id: 'kb-1' }]` 등)은 모두 "행 배열 직접"(INSERT 형) shape 다. `updateReturningRows` 는 이 shape 도 fallback 으로 그대로 받아들이므로 현재 테스트들은 통과하지만, 만약 이번 수정(`if (updateReturningRows(acquired).length === 0)` 등)이 원래의 `if (acquired.length === 0)` 로 되돌려져도 — 즉 이 PR 이 고치려는 그 버그가 재발해도 — 위 mock shape 로는 테스트가 계속 GREEN 이다(수동 추적 확인: `acquired=[{id:'kb-1'}]` → `.length===1`→lock 통과, `acquired=[]`→`.length===0`→409, 튜플 언랩 유무와 무관하게 동일 결과). `update-returning-rows.spec.ts` 의 구조적 가드(호출 횟수 카운트)는 "헬퍼 호출이 사라지는 것"은 잡지만 "헬퍼 안의 언랩 로직이 case 를 잘못 처리하는 것"이나 "KB 쪽 실제 shape 불일치"는 못 잡는다. 이는 plan 문서 스스로가 근본 원인으로 지목한 "mock 이 틀린 현실을 인코딩" 패턴이 KB 쪽에는 그대로 남아있다는 뜻이다.
  - 제안: `knowledge-base.service.spec.ts`의 `reExtractAll`/`reEmbedAll`/`retryFailedDocuments` 관련 CAS-락·reset 테스트 중 최소 1건씩을 실측 튜플 shape(`[[{id:'kb-1'}], 1]` / `[[], 0]`)로 재무장해, 회귀 시 실제로 RED 가 나는지 확인.

- **[INFO]** (사전 존재, 이번 diff 로 인한 신규 결함 아님) `updated: Array<{ id: string }>` (line ~8503)·`m.query<{ id: string }[]>` (line ~2916) 타입 선언은 실제 런타임 shape(튜플)과 다르다 — 코드 주석 자체가 "제네릭은 주장이지 검증이 아니다" 라고 인정하고 있어 알려진 한계다. `updateReturningRows` 도입이 이 타입 부정확성을 고치지는 않았지만 런타임 동작은 정확히 처리한다. 향후 정리 시 `unknown`/실제 튜플 타입으로 재선언 고려.

- **[정보/검증]** `update-returning-rows.ts`/`update-returning-rows.spec.ts` 자체의 핵심 로직 검증 결과는 모두 정상:
  - `updateReturningRows`: 비-배열 입력 시 throw, 튜플(`[rows,count]`, `[[],0]` 포함) 언랩, 행 배열 직접(빈 배열 포함) pass-through — 10개 유닛 테스트 전부 실제 실행 확인(`npx jest update-returning-rows.spec.ts` → 10 passed).
  - 구조적 가드 3종(호출 지점 수 카운트 `[2,5]`, 선례 2건(`stuck-document-recovery` 구조분해 2곳/`agent-memory-admin` `deletedRowCount` 2곳), 소비 지점 총원 `[3,10]`)을 Node 스크립트로 직접 재현 — plan 문서·테스트가 주장하는 수치와 정확히 일치.
  - `execution-engine.service.ts`(admission gate `rows.length===1`→`updateReturningRows(rows).length===1`, `updateExecutionStatus`의 `persisted`)와 `knowledge-base.service.ts`(CAS 락 2곳, 재큐 2곳, reset 1곳) 5+2 = 7개 호출부 전부 spec/문서가 서술한 대로 정확히 변환됐다. `knowledge-base.service.ts`의 `reExtractAll` 내부 `SELECT id FROM document` 결과(369행 `rows.map((r) => r.id)`)는 SELECT 라 튜플이 아니므로 헬퍼가 필요 없고 실제로도 미적용 — 올바른 판단.
  - `spec/5-system/8-embedding-pipeline.md:264`("결과가 0행이면 `409 KB_REEMBED_IN_PROGRESS`")·`spec/5-system/4-execution-engine.md:1138`(admission gate 조건부 UPDATE RETURNING 계약)와 line-level 로 대조한 결과, 이번 수정은 **spec 이 이미 규정한 동작을 코드가 위반하고 있던 것을 원복**한 것이다 — spec-drift 가 아니라 정상적인 버그 수정.
  - `assertRowArray` 는 여전히 8220행에서 사용 중(orphan import 아님).

## 요약

이번 diff 자체(`updateReturningRows` 헬퍼 도입, `execution-engine.service.ts` 2곳·`knowledge-base.service.ts` 5곳 전환, 구조적 회귀 가드, plan 문서)는 실제 TypeORM 0.3.31 + pg 드라이버 소스(`PostgresQueryRunner.js`)까지 직접 대조한 결과 정확하고 spec(embedding-pipeline §CAS, execution-engine §8 admission gate)과 line-level 로 일치하며, 핵심 로직·구조적 가드 수치를 전부 재현·검증했다. 다만 (1) 이 PR이 스스로 주장한 "전역 감사"가 놓친, 동일 버그 클래스의 라이브 CRITICAL(`auth-oauth.service.ts` 소셜 로그인 콜백 — 실서비스 로그인 상시 실패로 추정)이 존재하고, (2) 새 테스트 파일이 자체 lint 게이트를 통과하지 못하며, (3) 진단 메시지 컨텍스트 손실과 (4) `knowledge-base.service.ts` 5개 수정 지점에 실측 shape 회귀 테스트가 없어 재발을 잡지 못하는 갭이 확인됐다. (1)은 이 diff의 파일 목록 밖이라 이 PR을 직접 막을 근거로 보기는 애매하지만, 같은 세션·같은 결함 클래스이므로 병행 처리를 강력히 권고한다.

## 위험도

HIGH — diff 자체의 기능/spec 정합성은 양호하나, 같은 작업의 감사 범위 밖에서 발견된 동일 클래스의 라이브 CRITICAL(OAuth 로그인)과 회귀 테스트 커버리지 갭이 존재해 즉시 후속 조치가 필요하다.
