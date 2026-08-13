# Database 리뷰 — update-returning-tuple-shape (최종 라운드, `23_07_11`)

## 개요

이번 changeset 은 TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` raw 쿼리가
행 배열이 아니라 `[rows, rowCount]` **튜플**을 반환한다는 실측 사실을 반영해, 이를 행
배열로 오인해 `.length`/`[0]`/`.map` 을 직접 쓰던 8개 지점(execution-engine 2곳,
knowledge-base 5곳, auth-oauth 1곳)을 신규 헬퍼 `updateReturningRows()` 로 통일한 correctness/
concurrency 수정이다. 동일 changeset 안에 이 수정을 다룬 두 차례의 선행 리뷰 산출물
(`review/code/2026/08/13/20_36_35/`, `.../22_45_24/`)과 그 RESOLUTION 이 리뷰 대상 파일 목록에
포함돼 있는데, 이는 실제 코드가 아니라 그 두 라운드의 검토 이력이므로 DB 관점에서는 참고용이다.
아래는 최종 코드 상태(`codebase/backend/src/**`)를 직접 열어 재검증한 결과다.

## 발견사항

- **[INFO]** 이 changeset 은 이미 실재하던 3개의 DB 동시성 결함(CAS 락 2건 + admission
  게이트 1건 + OAuth state 소비 1건)을 정확히 고친다 — 신규 위험 도입 아님.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2913-2953`
    (`admitExecutionOrDefer`), `:8508-8554`(`updateExecutionStatus`) /
    `codebase/backend/src/modules/auth/auth-oauth.service.ts:138-153`(`handleCallback`) /
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 의
    `reExtractAll`(CAS 락, `updateReturningRows` 호출부), `reEmbedAll`(CAS 락 + reset) —
    이 파일은 diff 가 프롬프트에서 생략돼 `git diff origin/main...HEAD -- <path>` 로 직접 대조함.
  - 상세: 수정 전엔 튜플의 `.length`(항상 2)를 행 배열의 길이로 오독해 (1) KB 재추출/재임베딩
    CAS 락이 한 번도 거절하지 않아 동시 요청이 중복으로 `entity`/`chunk_entity` 삭제·재큐를
    실행할 수 있었고, (2) execution admission UPDATE 가 실제로 성공해도 앱은 매번 실패로
    오판해 크래시 복구(rehydration) 경로로 우회 재구동했으며, (3) `updateExecutionStatus` 의
    "동시 cancel 이 이미 terminal 로 선점" 가드가 한 번도 타지 않아 종결 이벤트 중복 emit
    가능성이 있었고, (4) OAuth state DELETE 가 항상 "행 배열의 첫 원소"를 배열로 오독해 소셜
    로그인이 상시 실패했다. `updateReturningRows()` 는 `Array.isArray(result[0])` 로 튜플/행
    배열을 판별해 첫 원소를 언랩하며, 이 판별은 Postgres 행이 항상 POJO(배열 아님)로 오는 한
    안전하다(직접 소스 확인). 신규/기존 테스트가 실측 shape(`[[{id}],1]`, `[[],0]`)를 mock 해
    RED→GREEN 전이를 검증한다.
  - 제안: 조치 불요(이미 이 diff 의 목적). 배포 후 "죽어 있던 분기가 처음 라이브된다"는
    행동 변화(admission 지연 소멸, KB 재추출/재임베딩 409 최초 관측, 소셜 로그인 성공률
    회복)는 DB 쿼리 자체의 문제가 아니라 운영 관측 항목이며, plan 문서에 이미 체크리스트로
    등재돼 있다(`plan/in-progress/update-returning-tuple-shape.md` §후속).

- **[INFO]** SQL 인젝션: 이번 changeset 이 건드린 모든 raw 쿼리(admission UPDATE, guarded
  UPDATE, KB CAS UPDATE 5건, OAuth DELETE)는 기존과 동일하게 `$1, $2, ...` 파라미터 바인딩만
  사용한다. 신규 SQL 텍스트 변경 없이 결과 해석 로직만 교체됐다. 인젝션 리스크 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2921`(admission
    UPDATE), `:8512`(guarded UPDATE) / `codebase/backend/src/modules/auth/auth-oauth.service.ts:149`
    (DELETE) / `knowledge-base.service.ts` 각 CAS/재큐/reset UPDATE(파일 직접 확인, 전부 `$1`/`$2`
    바인딩).

- **[INFO]** `knowledge-base.service.ts` 의 `retryFailedDocuments` embedding 분기 하나만 여전히
  `.query<{ id: string }[]>()` 라는 실제와 다른 제네릭 타입 주석을 유지한다 — 선행 리뷰
  (`22_45_24` concurrency INFO)가 이미 지적했고 이번 라운드에도 정정되지 않았다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `retryFailedDocuments`
    내부 `const rows = await this.dataSource.query<{ id: string }[]>(...)` (embedding 분기). 프롬프트
    diff 가 생략돼 소스를 직접 열어 확인(현재 533행 부근). 같은 함수의 graph 분기(569행 부근)와
    다른 5개 KB 호출부는 전부 `unknown` 으로 정정돼 있다.
  - 상세: 런타임 동작은 `updateReturningRows<{ id: string }>(rows, ...)` 가 실제 shape 을 판별해
    올바르게 언랩하므로 기능 결함은 아니다. 다만 이 changeset 의 핵심 원칙("선언 제네릭은 검증
    안 되는 주장일 뿐, 실제 shape 판별은 헬퍼 한 곳이 책임진다")이 이 한 지점에서만 시각적으로
    깨져 있어, 향후 이 지점에서 헬퍼 호출을 실수로 제거해도 컴파일러가 여전히 "행 배열"이라고
    거짓 보증한다.
  - 제안: `unknown` 으로 통일해 파일 전체 일관성을 맞추는 것을 권장(낮은 우선순위, 기능 영향 없음).

- **[INFO]** `KnowledgeBaseService.reEmbedAll` 의 CAS 락 UPDATE 와 후속 reset UPDATE 가 여전히
  트랜잭션 밖의 별도 두 문장이다(이번 diff 가 도입한 문제 아님, 기존 구조).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `reEmbedAll`
    내부 CAS 락 `this.dataSource.query(...)` 와 그 아래 reset `this.dataSource.query(...)`
    (두 문장 사이 `dataSource.transaction()` 래핑 없음, `reExtractAll` 은 CAS+DELETE+reset 을
    `dataSource.transaction()` 한 트랜잭션으로 묶는 것과 대조됨).
  - 상세: 이번 diff 가 건드린 것은 각 UPDATE 결과의 shape 해석뿐이라 새로 생긴 문제는 아니지만,
    CAS 락 성공(→ `reembed_status='in_progress'`) 직후~reset UPDATE 사이 프로세스 크래시 시
    KB 가 `in_progress` 로 남고 문서 status 는 리셋되지 않는 좁은 창이 여전히 존재한다.
  - 제안: 이번 PR 범위 밖. plan 문서의 후속 ②(`updateExecutionStatus` 트랜잭션화)와 별개 후속
    검토 후보로 기록해 둘 만하다(강제 아님).

- **N+1 / 대량 데이터**: 이번 diff 는 반복문 내부 쿼리 실행 방식을 바꾸지 않는다. KB 임베딩/그래프
  재큐의 `CHUNK_SIZE` 분할은 BullMQ `addBulk` 대상이지 DB 쿼리가 아니며, 기존 청크·재시도 보상
  전략을 그대로 유지한다. admission/CAS 락 쪽도 단건 UPDATE 이며 반복 쿼리 아님.
- **인덱스**: WHERE 절 조건(`status='pending'`, `reextract_status='idle'`, `state=$1 AND
  expires_at > NOW()` 등)은 이번 diff 로 변경되지 않았다 — 신규 인덱스 필요·기존 인덱스 무효화
  없음.
- **커넥션 관리**: `dataSource.query`/`manager.query`/트랜잭션 매니저 호출 패턴 자체는 변경 없음.
- **마이그레이션/스키마**: 이번 diff 에 스키마 변경·마이그레이션 파일 없음. 해당 없음.
- **plan/review 산출물 파일들** (`plan/in-progress/*.md`, `review/code/**/*.md`, `review/consistency/**/*.md`)
  은 문서·메타 산출물이며 DB 코드 변경이 아니다 — 이 관점에서는 검토 대상 아님.

## 요약

이 changeset 은 새로운 DB 위험을 도입하기보다 **기존에 조용히 무력화돼 있던 CAS 락/admission
가드/종결 이벤트 가드/OAuth state 소비를 바로잡는 correctness 수정**이다. 소스를 직접 열어
재검증한 결과 execution-engine 2곳·knowledge-base 5곳·auth-oauth 1곳의 `updateReturningRows`
전환이 실제로 적용돼 있고, 모든 raw SQL 은 여전히 파라미터화돼 있으며, 스키마·마이그레이션·
인덱스·커넥션 관리에는 변화가 없다. 두 차례의 선행 전담 DB 리뷰(`20_36_35`, `22_45_24`)가
이미 이 지점들을 상세히 검증해 LOW 로 판정했고, 이번 재확인에서도 새로운 CRITICAL/WARNING 급
DB 결함은 발견되지 않았다. 남은 지적(`retryFailedDocuments` 의 잔여 제네릭 타입 표기, `reEmbedAll`
CAS+reset 비-원자성)은 모두 이전부터 있었거나 기능에 영향 없는 INFO 수준이며, 즉시 조치가
필요한 항목은 없다.

## 위험도

LOW
