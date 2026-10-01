---
id: "CLE-ENG-RAWQUERY"
title: "raw SQL 결과 읽기 규약"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-ENG"
ancestors: ["CLE-VISION", "CLE-ENG"]
area: "CLE-ENG"
content_hash: "c8b9dd50795dc708f380e5daf6a902ca53f8a92c8fba067028b6cb12d27d8cbb"
read_as: "approved"
task: null
source_paths: ["spec/conventions/raw-query-results.md"]
mirror_sha256: "acc59f6e0cd5c65c24301eb23d590abc83cc045a849a52083acd0a98e6a91d01"
etag: "sha256-d5b90e73eafa1ac06581cf74875b08c9e992e21652a5beafaf1efa0ecb32beb4"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/raw-query-results.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

백엔드가 raw SQL(`.query()`)로 받은 결과를 **어떻게 읽는가**의 단일 기준이다. 두 가지 불변식을 정한다.

- (a) `UPDATE`/`DELETE … RETURNING` 의 반환은 **튜플**이다(raw SQL 결과 튜플, `[rows, affectedCount]`).
- (b) raw 결과의 **컬럼명은 snake_case** 다.

런타임에 드라이버가 돌려준 값을 해석하는 방법만 다룬다. 스키마를 바꾸는 절차는 [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md), 노드의 출력 계약은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. 이 문서와는 축이 다르다.

## 규칙

1. `.query()` 로 실행한 raw `UPDATE`/`DELETE … RETURNING` 의 런타임 반환은 `[rows, affectedCount]` 튜플이다. 행 배열로 오지 않는다. 이 결과를 쓸 때는 반드시 `updateReturningRows` 를 거친다.
2. `INSERT … RETURNING`, `INSERT … ON CONFLICT DO UPDATE … RETURNING`, QueryBuilder `.update().returning().execute()` 는 규칙 1 의 대상이 아니다([대상이 아닌 형태](#불변식-a--returning-은-튜플이다)).
3. `.query()` 결과 행의 키는 DB 컬럼명(snake_case)이다. 엔티티 프로퍼티명(camelCase)이 아니다. raw 결과를 엔티티 타입으로 단언하지 않는다.
4. 튜플 오해 결함을 진단할 때는 어느 방향으로 틀렸는지(항상 참인지, 항상 거짓인지)를 먼저 확인한다.
5. 규칙 1 은 발견형 가드가 `src/**` 전체를 훑어 파일마다 **개수로** 강제한다([집행](#집행)).
6. 가드 면제는 `(파일, 사유, 검토한 지점 수)` 3-tuple 로 선언한다. 선언한 개수는 실측과 **정확히 같아야** 한다.

## 불변식 (a) — RETURNING 은 튜플이다

`.query()` 로 실행한 raw `UPDATE`/`DELETE … RETURNING` 은 `[rows, affectedCount]` 튜플을 돌려준다. 경계는 좁다. 다음 셋은 대상이 아니다.

| 형태 | 반환 | 다른 이유 |
| --- | --- | --- |
| `INSERT … RETURNING` | 행 배열 | command tag 가 INSERT 다 |
| `INSERT … ON CONFLICT DO UPDATE … RETURNING` | 행 배열 | 본문에 UPDATE 가 있어도 **태그는 INSERT** 다 |
| QueryBuilder `.update().returning().execute()` | `UpdateResult { raw, affected }` | `.query()` 와 **별개 계약**이다 |

### 틀렸을 때 두 방향으로 나타난다

튜플을 행 배열로 오해하면 길이가 언제나 **2** 다. 그래서 같은 결함이 두 방향으로 나타난다.

| 쓴 표현 | 실제 | 증상 |
| --- | --- | --- |
| `length > 0` | **항상 참** | "언제나 적용됐다" 고 착각한다. 선점 감지 분기가 죽는다 |
| `length === 1` | **항상 거짓** | "언제나 실패했다" 고 착각한다. 성공 경로가 죽는다 |

"분기가 죽었다" 로만 적으면 어느 쪽으로 죽었는지가 사라진다. 그래서 진단할 때 방향을 먼저 본다(규칙 4).

## 불변식 (b) — 컬럼명은 snake_case 다

`.query()` 는 TypeORM 엔티티 매퍼를 **거치지 않는다**. 그래서 반환 행의 키는 DB 컬럼명(snake_case)이지 엔티티 프로퍼티명(camelCase)이 아니다.

(a) 만 지키고 (b) 를 놓치면 튜플은 풀리는데 그 안의 필드가 모두 `undefined` 다. 두 불변식을 한 문서에 두는 이유다(Rationale «두 불변식을 한 문서에 두는 이유»).

## 집행

`update-returning-rows.spec.ts` 의 **발견형 가드**가 `src/**` 전체를 훑는다. 파일마다 raw 지점 수만큼 헬퍼를 거치는지 **개수로** 판정한다(`#1241`). 개수를 보는 이유는 한 파일에 raw 지점이 둘인데 헬퍼는 하나만 거치는 **부분 커버리지**를 잡기 위해서다.

면제는 `(파일, 사유, 검토한 지점 수)` 3-tuple 이다. 선언 개수는 실측과 정확히 같아야 한다. 상한만 보면 부풀린 선언이 새 지점을 에러 없이 통과시킨다.

### 스캐너가 원리적으로 못 보는 형태

셋 다 알려진 한계이고 고칠 대상으로 보지 않는다. 음성 캐너리로 고정돼 있다.

| 형태 | 못 보는 이유 |
| --- | --- |
| `.query(sqlVar)`. SQL 이 변수에 담긴 경우 | 호출부에 문자열 리터럴이 없어 판정 축이 닿지 않는다. 데이터 흐름 분석이 필요하다 |
| 2단계 이상 중첩 제네릭 | 부분 정규식이 한 단계까지만 받는다 |
| CTE 접두 `WITH … UPDATE … RETURNING` | 판정이 **첫 키워드**를 보는데 `WITH` 에서 어긋난다. 넓히려면 SQL 파서가 필요하다. 첫 키워드 판정은 `INSERT … ON CONFLICT DO UPDATE` 오탐을 빼는 근거이기도 하다 |

## 구현 위치

- `codebase/backend/src/common/utils/update-returning-rows.ts` (`updateReturningRows` 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (발견형 가드)
- `codebase/backend/src/common/__test-utils__/source-scan.ts`

## Rationale

### 규약으로 올린 이유 — 네 번 따로 알아냈다

같은 지식을 저장소 안에서 네 번 각자 알아냈다.

| # | 지점 | 그 자리에서 알아낸 형태 |
| --- | --- | --- |
| 1 | `stuck-document-recovery.service.ts` | `const [rows] = await …` 구조분해 |
| 2 | `agent-memory-admin.service.ts` | 로컬 `deletedRowCount()` 가 튜플·비튜플 양쪽을 받는다 |
| 3 | `integration-oauth.service.ts` | `.query<[Row[], number]>` 로 튜플 타입을 명시 |
| 4 | `update-returning-rows.ts` | 공용 헬퍼(`#1168`) |

네 번 각자 알아냈다는 것은 **적어 둔 자리가 없었다**는 뜻이다. 개인의 부주의 탓으로 볼 일이 아니다.

### 두 불변식을 한 문서에 두는 이유

이 규약이 없어서 실제로 두 결함이 났다.

- **(a)**: OAuth callback 의 `DELETE … RETURNING` 결과를 행 배열로 다뤄 state 가 끝내 해석되지 않았다. 그 결과 소셜 로그인이 늘 실패했다(`#1168`).
- **(b)**: 같은 PR 에서 `rememberMe`(camelCase)를 읽었는데 실제 행 키는 `remember_me` 였다. "로그인 유지" 가 통째로 무시됐다. 단위 테스트의 mock 이 엔티티 형태(`rememberMe`)여서 테스트가 통과한 채로 남았다.

`#1168` 이 (a) 만 고쳤다가 (b) 를 놓쳐 CRITICAL 이 났다. 한쪽만 고치면 증상만 바뀐다.

### 방향을 먼저 보는 이유

`8332d9a20`(2026-08-13)이 두 방향(항상 참, 항상 거짓)의 결함을 **한 파일에서 동시에** 고쳤다. 같은 원인이 한 파일 안에서도 반대 증상으로 나타난다. 규칙 4 는 이 사례에서 나왔다.

### 기각한 대안 — 마이그레이션 규약에 덧붙이기

축이 다르다(스키마 변경 절차와 런타임 결과 읽기). 마이그레이션을 건드리지 않는 사람은 이 규약에 닿지 못한다.

### 기각한 대안 — 타입 경계 래퍼로 강제하기

`DataSource`/`EntityManager` 확장 래퍼로 "호출하자마자 언랩" 을 컴파일 타임에 강제하는 안을 `#1241` 이 검토했다. 보장은 더 강하지만 **기존 raw 호출부를 모두 옮겨야** 한다. 발견형 가드는 호출부를 하나도 건드리지 않고 같은 축을 지킨다. 옮기는 비용을 치를 이유가 생기면 그때 올린다.

### "개수" 를 세는 이유

처음 가드는 파일 단위 **존재**만 봤다. 그러면 raw 지점이 2곳이고 헬퍼가 1곳인 파일을 "가드됨" 으로 잘못 판정한다. 자매 큐레이션 가드는 정확한 개수 튜플로 이미 이 문제를 피하고 있었다. 발견형으로 바꾸면서 그 정밀도를 잃었다가 되찾았다(`#1241` 리뷰 2라운드).
