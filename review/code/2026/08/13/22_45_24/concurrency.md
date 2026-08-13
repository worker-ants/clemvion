# 동시성(Concurrency) 리뷰 — `update-returning-rows` 헬퍼 도입 (`22_45_24`)

## 개요

이 변경은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아니라
`[rows, rowCount]` **튜플**을 돌려준다는 실측 사실을 반영해, 그동안 행 배열로 오인해 온
7~8개 지점을 `updateReturningRows()` 헬퍼로 정정한다. 대상 지점 대부분이 **CAS(compare-and-swap)
락·admission 직렬화·상태 전이 가드**라 동시성 리뷰 범위의 핵심에 정확히 해당한다. 코드를
직접 열어 대조한 결과다.

## 발견사항

- **[INFO]** `knowledge-base.service.ts` 의 `retryFailedDocuments` 임베딩 분기만 `unknown` 전환에서 누락됨
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:530` (`const rows = await this.dataSource.query<{ id: string }[]>(...)`)
  - 상세: 같은 파일의 다른 4개 `UPDATE … RETURNING` 소비 지점(336, 563→711 인근, 728)은 모두
    `unknown` 으로 바꿔 "선언 타입은 검증되지 않는 주장" 이라는 이번 PR 의 원칙을 따랐는데,
    이 지점만 옛 `query<{ id: string }[]>` 제네릭이 남아 있다. 런타임 동작은
    `updateReturningRows<{ id: string }>(rows)` 가 shape 을 실제로 판별해 정정하므로 **기능
    결함은 아니다** — 타입 수준의 거짓 주장이 한 곳 남았을 뿐이다. 다만 이번 결함의 근본
    원인이 정확히 "타입이 실제 shape 을 보장한다는 잘못된 믿음" 이었던 만큼, 같은 파일 안에서
    자매 지점 하나가 그 믿음을 그대로 두면 다음 리팩터링(예: `updateReturningRows` 호출 삭제)
    때 컴파일러가 잡아주지 못하는 사각을 남긴다.
  - 제안: `unknown` 으로 통일해 "이 값의 shape 은 오직 `updateReturningRows` 가 판별한다" 는
    불변식을 파일 전체에서 시각적으로도 일관되게 만든다.

- **[INFO]** `detail` 진단 인자가 8개 호출부 중 2곳(`execution-engine.service.ts` 2건)에만 전달됨
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146`,
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345,541,572,719,740`
  - 상세: `updateReturningRows` 의 선택적 두 번째 인자(`detail`)는 "shape 이 배열이 아닐 때
    극단 상황에서 로그만으로 지점을 특정" 하기 위해 남긴 것(JSDoc, WARNING 4 조치)인데,
    실제로는 execution-engine 두 곳만 채우고 auth-oauth·knowledge-base 5곳은 비워 뒀다.
    CAS 락·OAuth state 소비처럼 동시성 실패가 원인 파악이 특히 중요한 지점들이라, 프로덕션에서
    `Array.isArray` 예외가 던져질 경우(드라이버 업그레이드 등으로 shape 이 다시 바뀌는 상황)
    이 5곳은 어느 KB/어느 OAuth state 인지 로그로 특정하기 더 어렵다.
  - 제안: 필수는 아니지만, 특히 KB CAS 락 2곳(`id`/`workspaceId`)과 OAuth state 소비 1곳(`state`
    앞 몇 글자)에 `detail` 을 채우면 향후 회귀 진단 비용이 줄어든다.

## 핵심 로직 검증 (참고 — 발견사항은 아니나 판정 근거)

- `updateReturningRows` 의 튜플 판별 휴리스틱(`Array.isArray(result[0])`)은 Postgres 행이
  항상 평범한 객체로 반환되는 한 안전하다 — 행 자체가 배열인 경우는 없으므로 "직접 행
  배열"(길이 N, `result[0]` = 객체)과 "튜플"(길이 2, `result[0]` = 행 배열) 사이에 오판 가능
  경로가 없다. 빈 튜플이 `[[], 0]`(길이 2, `result[0]=[]`→배열)로 오는 것도 실측·테스트로
  고정돼 있어 0행 CAS 거절 분기가 정상적으로 트리거된다.
- **KB reextract/reembed CAS 락(`knowledge-base.service.ts:336`, `:711`)**: 수정 전에는
  `acquired.length` 가 튜플이라 항상 2였으므로 `if (acquired.length === 0) throw` 가 **한 번도
  타지 않았다** — 이것은 진짜 경쟁 조건이다. 동시에 들어온 두 번째 재추출/재임베딩 요청이
  DB 상으로는 0행 매칭(이미 `in_progress`)임에도 애플리케이션은 성공으로 오인해 두 요청이
  모두 `DELETE FROM entity`/문서 reset/큐 addBulk 를 중복 실행할 수 있었다. 이번 수정으로
  거절 분기가 실제로 작동해 상호배제가 복원된다.
- **execution admission(`execution-engine.service.ts:2913`)**: `pg_advisory_xact_lock` 으로
  같은 workspace 의 admission 을 직렬화한 뒤 조건부 UPDATE 로 카운트-체크-전이하는 구조
  자체는 이번 diff 의 범위 밖(이미 이전 라운드에서 도입)이며 변경되지 않았다. 이번 diff 는
  그 UPDATE 의 결과 해석만 정정한다 — 전엔 `rows.length === 1` 이 튜플 때문에 항상 거짓이라
  admission 이 실제 성공해도 앱은 매번 `deferred` 로 오판해 2s 재큐 후 rehydration 우회
  경로로 재구동했다(사이드채널 의존). 이제 정상 경로가 정직하게 성공을 반환한다.
- **`updateExecutionStatus`(`execution-engine.service.ts:8512` 부근)**: `WHERE status IN
  (non-terminal)` guarded UPDATE 는 "동시 취소/완료 레이스에서 진 쪽이 실제로 DB 를 못
  바꿨다" 는 것을 `persisted` 로 감지해 중복 종결 이벤트 emit·`recordRunningSegmentStart`
  중복 기록을 막는 CAS 성격의 가드다. 수정 전엔 `updated.length > 0` 이 튜플이라 항상 참이라
  **이 가드가 실질적으로 무력화**돼 있었다 — 레이스에서 진 트랜잭션도 자신이 이겼다고 믿고
  종결 메트릭을 냈을 수 있다. 수정으로 실제 매치 여부가 반영된다.
- 세 파일의 신규 테스트(`execution-engine.service.spec.ts` admission 2건,
  `knowledge-base.service.spec.ts` CAS 0행 1건, `auth-oauth.service.spec.ts` 2건)는 실측
  shape(`[[...], n]`)을 직접 mock 해 정정 전 코드에서 RED 가 재현됨을 확인했다고 기록돼
  있고(RESOLUTION.md), `update-returning-rows.spec.ts` 의 구조적 가드(파일별 헬퍼 호출 수
  고정)도 실제 소스의 호출 수(execution-engine 2, knowledge-base 5, auth-oauth 1)와 일치한다
  — grep 으로 직접 대조했다.
- 데드락 관점: 이번 diff 는 락 획득 순서·중첩을 바꾸지 않는다(advisory lock 은 트랜잭션당
  1회, 다른 락과 중첩되지 않음). 이벤트 루프 블로킹·async/await 누락도 관찰되지 않는다 —
  모든 `.query()` 호출이 이미 `await` 로 소비되고, 헬퍼 자체는 동기 함수라 새로운 비동기
  경계를 추가하지 않는다.

## 요약

이 변경은 신규 동시성 결함을 들여오는 것이 아니라, 이미 존재하던 진짜 경쟁 조건(KB
재추출/재임베딩 CAS 락이 튜플 오판으로 인해 상호배제를 전혀 하지 못했던 문제)과 상태 전이
가드 무력화(레이스 패자를 승자로 오판해 중복 종결 이벤트 가능성)를 정확한 실측·테스트·구조적
회귀 가드와 함께 바로잡는 수정이다. 판별 휴리스틱은 Postgres 드라이버의 실제 반환 형태 하에서
안전하고, 8개 호출부 모두 헬퍼로 일관 전환됐다(호출 수를 grep 으로 직접 대조 확인). 남은
항목은 같은 파일 내 자매 지점 하나의 잔존 거짓 제네릭과 진단용 `detail` 인자의 불균일한
사용뿐이며, 둘 다 런타임 동작에 영향이 없는 INFO 수준이다.

## 위험도

LOW
