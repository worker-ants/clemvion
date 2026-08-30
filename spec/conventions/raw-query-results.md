---
id: raw-query-results
status: implemented
code:
  - codebase/backend/src/common/utils/update-returning-rows.ts
  - codebase/backend/src/common/utils/update-returning-rows.spec.ts
  - codebase/backend/src/common/__test-utils__/source-scan.ts
pending_plans:
  - plan/in-progress/update-returning-tuple-shape.md
---

# raw SQL 결과 읽기 규약 (Conventions)

## Overview

raw SQL(`.query()`) **결과를 읽는 방법**의 SoT. 두 가지를 규정한다 — `UPDATE`/`DELETE …
RETURNING` 의 반환이 **튜플**이라는 것과, raw 결과의 **컬럼명이 snake_case** 라는 것.

> **SoT 경계**: 스키마 변경 *절차*는 [`migrations.md`](./migrations.md), 노드의 출력 *계약*은
> [`node-output.md`](./node-output.md) 가 SoT 다. 본 문서는 그 둘과 축이 다르다 — 런타임에
> 드라이버가 돌려준 값을 **어떻게 해석하는가**만 다룬다.

### 왜 규약으로 올렸나 — 네 번 독립 재발견

같은 지식을 저장소 안에서 **네 번 각자** 알아냈다:

| # | 지점 | 그 자리에서 알아낸 형태 |
| --- | --- | --- |
| 1 | `stuck-document-recovery.service.ts` | `const [rows] = await …` 구조분해 |
| 2 | `agent-memory-admin.service.ts` | 로컬 `deletedRowCount()` 가 튜플·비튜플 양쪽 수용 |
| 3 | `integration-oauth.service.ts` | `.query<[Row[], number]>` 로 튜플 타입 명시 |
| 4 | `update-returning-rows.ts` | 공용 헬퍼 (`#1168`) |

네 번 각자 알아낸 것은 개인의 부주의가 아니라 **적어 둔 자리가 없었다**는 뜻이다.

---

## 1. 불변식 (a) — `UPDATE`/`DELETE … RETURNING` 은 튜플이다

`.query()` 로 실행한 raw `UPDATE`/`DELETE … RETURNING` 의 런타임 반환은 행 배열이 아니라
`[rows, affectedCount]` **튜플**이다. 소비할 때 반드시 `updateReturningRows` 를 거친다.

경계가 좁다 — 아래 셋은 **대상이 아니다**:

| 형태 | 반환 | 왜 다른가 |
| --- | --- | --- |
| `INSERT … RETURNING` | 행 배열 | command tag 가 INSERT |
| `INSERT … ON CONFLICT DO UPDATE … RETURNING` | 행 배열 | 본문에 UPDATE 가 있어도 **태그는 INSERT** |
| QueryBuilder `.update().returning().execute()` | `UpdateResult { raw, affected }` | `.query()` 가 아니라 **별개 계약** |

### 틀렸을 때의 부호가 한 가지가 아니다

튜플을 행 배열로 오해하면 길이가 언제나 **2** 다. 그래서 같은 결함이 두 방향으로 나타난다:

| 쓴 표현 | 실제 | 증상 |
| --- | --- | --- |
| `length > 0` | **항상 참** | "언제나 적용됐다" 고 착각 → 선점 감지 분기가 죽는다 |
| `length === 1` | **항상 거짓** | "언제나 실패했다" 고 착각 → 성공 경로가 죽는다 |

`8332d9a20`(2026-08-13) 이 이 **두 부호를 한 파일에서 동시에** 고쳤다. "분기가 죽었다" 로만
적으면 어느 쪽으로 죽었는지가 사라지므로, 진단할 때 부호를 먼저 확인한다.

## 2. 불변식 (b) — raw 결과의 컬럼명은 snake_case 다

`.query()` 는 TypeORM 의 엔티티 매퍼를 **우회**한다. 그래서 반환 행의 키는 DB 컬럼명
(snake_case) 이지 엔티티 프로퍼티명(camelCase) 이 아니다. **raw 결과를 엔티티 타입으로
단언하지 않는다.**

(a) 만 지키고 (b) 를 놓치면 튜플은 풀리는데 그 안의 필드가 전부 `undefined` 다.

## 3. 이 규약이 없어서 난 일

- **(a)**: OAuth callback 의 `DELETE … RETURNING` 결과를 행 배열로 다뤄 state 가 영영
  해석되지 않았다 → **소셜 로그인 상시 실패** (`#1168`).
- **(b)**: 같은 PR 에서 `rememberMe`(camelCase) 를 읽었는데 실제 행 키는 `remember_me`
  였다 → **"로그인 유지" 가 통째로 무시**됐다. 단위 테스트의 mock 이 엔티티 형태
  (`rememberMe`) 였기 때문에 **초록인 채로** 살아남았다.

(b) 를 (a) 와 **같은 문서에** 두는 이유가 이것이다 — `#1168` 이 (a) 만 처방했다가 (b) 를
놓쳐 CRITICAL 이 났다. 한쪽만 고치면 증상만 바뀐다.

## 4. 집행

`update-returning-rows.spec.ts` 의 **발견형 가드**가 `src/**` 전수를 스캔해, 파일마다 raw
지점 수만큼 헬퍼를 거치는지 **개수로** 판정한다(`#1241`). 존재 여부가 아니라 개수를 보는
이유는, 한 파일에 raw 지점이 둘인데 헬퍼는 하나만 거치는 **부분 커버리지**를 잡기 위해서다.

면제는 `(파일, 사유, 검토한 지점 수)` 3-tuple 이고, 선언 개수는 실측과 **정확히 일치**해야
한다 — 상한만 보면 부풀린 선언이 새 지점을 조용히 통과시킨다.

### 스캐너가 원리적으로 못 보는 형태

셋 다 **고칠 대상이 아니라 알려진 한계**이고 음성 캐너리로 고정돼 있다:

| 형태 | 왜 못 보나 |
| --- | --- |
| `.query(sqlVar)` — SQL 이 변수에 담김 | 호출부에 문자열 리터럴이 없어 판정 축이 닿지 않는다. 데이터플로 분석이 필요 |
| 2단계 이상 중첩 제네릭 | 부분 정규식이 한 단계까지만 받는다 |
| CTE 접두 `WITH … UPDATE … RETURNING` | 판정이 **첫 키워드**를 보는데 `WITH` 에서 어긋난다. 넓히려면 SQL 파서가 필요하고, 첫 키워드 판정은 `INSERT … ON CONFLICT DO UPDATE` 오탐 배제의 근거이기도 하다 |

---

## Rationale

### 기각한 대안 — `migrations.md` 확장

축이 다르다(스키마 변경 절차 vs 런타임 결과 읽기). 마이그레이션을 안 건드리는 사람이 이
규약에 닿지 못한다.

### 기각한 대안 — 타입 경계 래퍼로 강제

`DataSource`/`EntityManager` 확장 래퍼로 "호출 즉시 언랩" 을 컴파일 타임에 강제하는 안을
`#1241` 이 검토했다. 보장은 더 강하지만 **기존 raw 호출부 전수 이관**을 요구한다. 발견형
가드는 호출부를 하나도 안 건드리고 같은 축을 지킨다. 이관 비용을 치를 이유가 생기면 그때
승격한다.

### 왜 "개수" 인가

초기 가드는 파일 단위 **존재**만 봤다. 그러면 raw 지점이 2곳이고 헬퍼가 1곳인 파일을
"가드됨" 으로 오판한다. 자매 큐레이션 가드는 정확한 개수 튜플로 이미 그걸 피하고 있었는데,
발견형으로 바꾸면서 그 정밀도를 잃었다가 되찾았다 (`#1241` 리뷰 2라운드).
