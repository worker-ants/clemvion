---
title: CONCURRENTLY 재실행 패턴 규약 + 리뷰 산출물 인용 규약
worktree: plan-in-progress-items-b0c80b
started: 2026-09-05
owner: planner
status: complete
priority: P2
spec_impact:
  - spec/conventions/migrations.md
  - spec/conventions/review-citations.md
---

# 규약 2건 (planner 묶음)

> 출처: `spec-draft-nullable-notation-followups.md` 의 남은 규약 항목 둘. 둘 다
> `spec/conventions/` 쓰기라 한 세션으로 묶었다.
>
> | # | 항목 | 출처 |
> |---|---|---|
> | ① | `CREATE INDEX CONCURRENTLY` 재실행 위험 — 패턴 성문화 | `23_02_51` W1 · `23_26_09` W3 |
> | ② | 코드 주석의 리뷰 세션 ID 인용 — 성문화할지 전환할지 | `00_06_38` W2 |

---

## ① CONCURRENTLY 인덱스 교체의 재실행 안전성

### 1.1 세 형태를 실측했다

`#1285` 가 남긴 질문은 *"두 위험 중 하나를 고르는 문제인가, 양쪽을 다 피할 수 있나"* 였다.
Postgres 17 · Flyway 10-alpine(저장소 이미지와 같은 태그)으로 **세 형태를 다 돌렸다**.

| 형태 | 실패 후 재실행 | **성공 후** 수동 재실행 |
|---|---|---|
| (a) DROP-first 없음 — `V056`·`V106` | **쓸 수 있는 인덱스 0개** | no-op |
| (b) DROP-first — `V110` | 정상 복구 | **재빌드** (oid 16394 → 16395) |
| (c) invalid 한정 `DO` 블록 | 정상 복구 | **no-op** (oid 불변) |

(b) 의 재빌드는 oid 변화로 확인했다. 처음 이 대조를 잴 때 두 문장을 한 `psql -c` 에 넣어
**둘 다 실패**했고 그래서 oid 가 같았다 — "no-op" 으로 읽을 뻔했다. 문장을 각각 보내
다시 재서 잡았다.

(c) 의 형태:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_new' AND NOT i.indisvalid
  ) THEN
    EXECUTE 'DROP INDEX idx_new';   -- 비-concurrent: invalid 인덱스는 쿼리가 안 쓴다
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_new ON t (ws, ts);
DROP INDEX CONCURRENTLY IF EXISTS idx_old;
```

### 1.2 그런데 (c) 는 **지금 이 저장소에서 돌지 않는다**

psql 로는 됐지만 **Flyway 가 거부한다**:

```
ERROR: Detected both transactional and non-transactional statements within the same
migration (even though mixed is false). Offending statement found at line 12:
CREATE INDEX CONCURRENTLY ... [non-transactional]
```

`.conf` 의 `executeInTransaction=false` 를 **둬도 같은 에러**다 — 그 설정은 mixed 판정을
면제하지 않는다(있을 때·없을 때 각각 확인). `DO` 블록은 transactional statement 라서
`CONCURRENTLY` 와 한 파일에 섞이는 순간 걸린다. 이는 `migrations/README.md` §5 가 이미
적어 둔 *"같은 파일에 transactional statement 와 CONCURRENTLY 를 섞지 않는다"* 와 같은 벽이다.

**`-mixed=true` 를 주면 통과한다** — 실측:

```
Migrating schema "public" to version "002 - replace index" [non-transactional]
Successfully applied 2 migrations
→ idx_new indisvalid=true, idx_old 삭제됨
```

> **프로브를 한 번 잘못 만들었다**: 처음엔 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`
> 없이 돌려 **무한 hang** 했다. 그 값은 저장소 마이그 이미지 Dockerfile 이 박아 두는 것이고,
> README §4 가 hang 의 원인까지 적어 둔 자리다. 그대로 뒀으면 "(c) 는 hang 한다" 는
> **잘못된 결론**을 낼 뻔했다.

### 1.3 파일을 둘로 쪼개는 우회는 성립하지 않는다

"`DO` 블록은 앞 파일, `CONCURRENTLY` 는 뒷 파일" 로 나누면 mixed 판정을 피한다. 그러나
**Flyway 는 실패한 마이그레이션만 재실행한다** — 뒷 파일이 실패해 invalid 잔재가 생겨도
앞 파일은 이미 성공 상태라 다시 돌지 않는다. 정리 코드가 실행될 기회가 없어 **목적을
잃는다.** 정리와 생성은 같은 파일에 있어야 한다.

### 1.4 결정 — (b) 를 기본으로 성문화하고, (c) 의 전제를 함께 적는다

**기본은 (b) DROP-first.** 오늘 설정 그대로 돌고, 나쁜 쪽 위험(인덱스 0개)을 없앤다.
남는 비대칭(성공 후 수동 재실행 시 재빌드)은 Flyway 정상 흐름에서 발생하지 않고, 발생해도
재빌드가 끝나면 스스로 정상으로 돌아온다.

**(c) 는 `mixed=true` 를 전역으로 켜야 한다.** 그 설정은 *"transactional 과 non-transactional
을 한 파일에 섞지 마라"* 는 가드를 **모든 마이그레이션에 대해** 푼다. 110개 마이그레이션을
가진 저장소에서 그 가드를 없애는 것은 이 규약 문서 하나가 단독으로 정할 일이 아니다 —
**별도 결정 항목으로 등재**한다(아래 ③ 참조).

### 1.5 변경안 (A) — `codebase/backend/migrations/README.md` §5 **안에** 접어 넣는다

처음엔 `### 5-1.` 로 새 소절을 만들려 했는데, **README 는 `### 1.`~`### 6.` 평면 번호**만
쓴다 (`migrations.md` 는 `### 6.1` 점 표기라 또 다르다). 세 번째 표기를 들이는 대신
§5 **본문 안에** 넣는다 — §5 가 바로 `executeInTransaction=false` 파일을 다루는 절이고
인덱스 교체는 그 특수 사례다. 이러면 번호 체계도 안 건드리고 주제도 제자리다
(`--spec` INFO#3).

같은 편집에서 §5 의 규정 문장 두 개를 손본다:

1. **"CREATE INDEX CONCURRENTLY 를 정확히 한 개만"** 의 스코프를 밝힌다 — 제한 대상은
   **CREATE 개수**이고 교체에 짝지어지는 DROP 은 그 제한 밖이다. 지금 문언으로도 위반이
   아니지만, 3-statement 패턴이 바로 뒤에 오므로 읽는 사람이 헷갈린다 (`--spec` W1).
2. **원인 레이어를 정정한다** (`--spec` INFO#1). §5 는 혼합 거부를 *"PostgreSQL 자체 제약"*
   이라고 적는데, **실제로 먼저 걸리는 것은 Flyway 의 mixed 판정**이다 — 실측 에러 메시지가
   `Detected both transactional and non-transactional statements ... mixed is false` 이고,
   `-mixed=true` 를 주면 통과한다. PostgreSQL 의 제약은 그 가드가 존재하는 **이유**이지
   거부를 내는 주체가 아니다.

§5 는 이미 *"`executeInTransaction=false` 파일은 한 statement 만"* 을 다룬다. 그 바로 뒤에
인덱스 **교체**의 패턴을 잇는다 (전문은 `## 부록 A`).

### 1.6 변경안 (B) — `spec/conventions/migrations.md` 에서 가리키기

`migrations.md` Overview 는 *"실제 작성 가이드는 README 가 담당"* 이라고 스스로 분업을
적어 두었다. 그래서 이 문서에는 **패턴을 복제하지 않고** §5 절차에 한 줄 포인터만 잇는다.
삽입 문구는 이것이다 (`--spec` INFO#4 — 의도만 적지 말고 문구를 남긴다):

```markdown
- 기존 인덱스를 **교체**하는 마이그레이션은 재실행 안전성 패턴이 따로 있다 —
  [`migrations/README.md` §5](../../codebase/backend/migrations/README.md) 의
  "인덱스 교체는 DROP-먼저" 참조. `IF NOT EXISTS` 만으로는 실패 후 재실행이 인덱스를
  0개로 만들 수 있다.
```

---

## ② 리뷰 산출물 인용 규약

### 2.1 실측 — 관례는 확립돼 있고, 형태가 이미 깨져 있다

| | 값 |
|---|---|
| `origin/main` `codebase/` 안 `hh_mm_ss` 인용 | **107개 파일 · 514회** (2026-09-05 09시 측정) |
| 날짜를 확인할 수 있는 인용 중 가장 이른 것 | **2026-05-26** |
| 그중 `review/<종류>/<YYYY>/<MM>/<DD>/<hh_mm_ss>` **전체 경로** 형태 | **15회** |
| 날짜 없는 **bare `hh_mm_ss`** | **499회** |
| 저장소의 세션 디렉터리 | 2,413개 (서로 다른 시각 2,276개) |
| 둘 이상의 날짜에 같은 시각이 존재 | **46개** |
| 코드가 인용한 서로 다른 시각 | 197개 |
| **그중 여러 날짜에 걸려 해소 불가** | **8개** |

> 출처 plan 은 같은 수치를 **104개 파일·508회**로 적는다 — 그때(`00_06_38` 라운드) 측정한
> 값이고, 그 뒤 이 세션의 PR 두 개가 머지되며 늘었다. **둘 다 각자의 시점에서 맞다** — 그래서
> 어느 쪽도 고치지 않고 측정 시각을 밝힌다.

즉 이 관례는 **폐기 대상이 아니라 형태를 고쳐야 하는 것**이다. 514회가 이미 쌓였으므로
"PR 번호로 전환" 하면 그 인용이 전부 고아가 된다. 반면 bare 형태는 **이미 8건이
해소 불가**다 — 가설이 아니라 실측이다.

> **이 수치를 처음 셀 때 "0건" 이라는 거짓 0 을 냈다** (`00_06_38` RESOLUTION 에 기록).
> `-E "\b[0-9]{2}_…"` 패턴이 안 물었는데 그것을 "선례 없음" 으로 읽고 **정반대 결론**을
> 낼 뻔했다. 이번에도 존재가 확실한 문자열(`20_16_17`)로 명령을 먼저 검증하고 셌다.

### 2.2 결정 — 성문화하되 **날짜를 요구**한다

- 리뷰 산출물 인용은 **유지**한다. `review/**` 는 커밋된다(`_prompts/` 만 gitignore).
  **다만 "영구" 는 과한 말이다** — `f7c56bf0a` 가 옛 산출물을 정리한 적이 있고, 전체 경로
  인용 15회 중 **1건**이 워킹트리에 없다. 그래도 git 이력으로 해소된다는 것이 요점이고,
  bare 형태는 **이력으로도 해소되지 않는다.**
- 새로 쓰는 인용은 **날짜를 포함**한다 — 전체 경로가 기본, 최소한 `2026-09-04 23_02_51`.
- **기존 499건은 소급 정리 대상이 아니다.** 그 자리를 다음에 건드릴 때 함께 맞춘다
  (`swagger.md` §1-4·§3 가 세운 것과 같은 원칙).

### 2.3 변경안 (C) — `spec/conventions/review-citations.md` 신설

기존 규약 문서 어디에도 맞는 자리가 없다 — `spec-impl-evidence.md` 는 **frontmatter**
증거를 다루고, `migrations.md` 는 버전 정책이다. CLAUDE.md 가 *"정식 규약 →
`spec/conventions/<name>.md`"* 를 지시하므로 짧은 문서를 신설한다 (전문은 `## 부록 B`).

---

## ③ 이 draft 가 등재하는 후속

- [ ] **`mixed=true` 도입 여부** (planner + 인프라). (c) 형태를 쓰려면 필요하고, 그 대가는
  *"한 파일에 transactional/non-transactional 을 섞지 마라"* 가드의 **전역 해제**다.
  실측·형태 비교는 이 draft 에 다 있으므로 남은 것은 **결정 하나**다.
- [ ] **bare 인용 8건의 해소** — 어느 날짜인지 코드 컨텍스트로 특정해 경로를 채우는 일.
  여러 파일에 흩어져 있어 별도 작업이다.

---

## 부록 A — `migrations/README.md` §5 에 붙일 전문

````markdown
**인덱스 교체는 DROP-먼저** (2026-09-05 규약화)

옛 인덱스를 새 것으로 갈아 끼우는 파일은 아래 **세 문장 순서**를 쓴다:

```sql
DROP INDEX CONCURRENTLY IF EXISTS <새 인덱스 이름>;   -- 0) 앞선 실패의 invalid 잔재 정리
CREATE INDEX CONCURRENTLY IF NOT EXISTS <새 인덱스 이름> ON ...;
DROP INDEX CONCURRENTLY IF EXISTS <옛 인덱스 이름>;
```

**0) 이 없으면 재실행이 인덱스를 0개로 만든다.** `CREATE INDEX CONCURRENTLY` 가 중간에
실패하면 `indisvalid = false` 인 인덱스가 **이름을 점유한 채** 남는데, `IF NOT EXISTS` 는
이름만 보고 유효성은 보지 않는다. 그대로 재실행하면 CREATE 가 건너뛰고 뒤이은 DROP 이
옛 인덱스를 지워, **쓸 수 있는 인덱스가 하나도 없는 상태**로 끝난다 — Postgres 는 invalid
인덱스를 쿼리에 쓰지 않으므로 조용히 seq scan 으로 회귀하면서 쓰기 비용만 낸다.
(실증: `CREATE UNIQUE INDEX CONCURRENTLY` 를 중복 데이터에 걸어 실패시킨 뒤 재현.)

**감수하는 비대칭**: 0) 은 대상이 invalid 잔재인지 정상 인덱스인지 구분하지 않는다. 그래서
**이미 성공한** 마이그레이션을 Flyway 흐름 밖에서 수동 재실행하면 살아 있는 인덱스를
재빌드한다(그 구간 seq scan). Flyway 는 성공한 마이그레이션을 다시 돌리지 않으므로 정상
흐름에서는 발생하지 않고, 반대편(인덱스 0개)이 훨씬 나쁘다.

> **`indisvalid` 를 보고 분기하면 양쪽을 다 피할 수 있다 — 단 `mixed=true` 가 필요하다.**
> `DO $$ ... IF NOT indisvalid THEN DROP INDEX ... $$` 는 정상 인덱스를 건드리지 않아
> 성공 후 재실행도 완전 no-op 이다. 그러나 `DO` 는 transactional statement 라 같은 파일의
> `CONCURRENTLY` 와 섞이는 순간 Flyway 가 거부한다(`Detected both transactional and
> non-transactional statements ... mixed is false`). `-mixed=true` 를 주면 통과하지만,
> 그 설정은 §5 의 혼합 금지 가드를 **모든 마이그레이션에 대해** 푼다. 도입 여부는 별도
> 결정 항목이다. 파일을 둘로 쪼개는 우회는 성립하지 않는다 — Flyway 는 **실패한
> 마이그레이션만** 재실행하므로 앞 파일의 정리 코드가 돌 기회가 없다.

선례: `V110__schedule_workspace_next_run_index.sql`. 그 이전의 `V056`·`V106` 은 0) 이 없어
같은 위험을 갖는다 — append-only 라 소급 수정 대상은 아니고, 재실행이 필요해지면 위
`indisvalid` 확인을 **수동 절차**로 선행한다.
````

## 부록 B — `spec/conventions/review-citations.md` 전문

````markdown
---
id: review-citations
status: implemented
code:
  - codebase/backend/src/common/guards/roles.guard.spec.ts
  - codebase/frontend/src/components/llm-config/sanitize-loader-error.ts
---

# Convention: 코드 주석의 리뷰 산출물 인용

## Overview (제품 정의)

이 저장소의 코드·테스트 주석은 **왜 이 자리가 이렇게 생겼는지**를 리뷰 산출물로 가리킨다.
`origin/main` 의 `codebase/` 안에 **107개 파일·514회** 쌓여 있다. 날짜를 확인할 수 있는
인용(전체 경로 형태) 중 가장 이른 것은 **2026-05-26** 세션이다 — bare 형태는 날짜가 없어
그보다 이른 것이 있는지는 알 수 없고, 그 점이 §2 의 근거이기도 하다. 이 문서는 그 관례를
성문화하고 **인용 형태**를 정한다.

> `code:` 는 **이 규약이 처방하는 형태를 실제로 쓰는 파일**을 가리킨다 — 저장소에 10개
> 있고(전체 경로 형태), backend·frontend 에서 하나씩 골랐다. 이 저장소의 다른 규약 문서도
> `code:` 를 넓은 트리가 아니라 좁고 구체적인 파일로 적는다.

## 1. 인용은 유지한다

`review/**` 는 커밋된다 — `.gitignore` 가 무시하는 것은 `review/**/_prompts/` 한 줄뿐이고
`SUMMARY.md`·`<role>.md`·`meta.json`·`RESOLUTION.md` 는 저장소에 남는다. 따라서 세션 경로는
**영구 참조**이며, 인용은 고아가 되지 않는다.

## 2. 날짜를 포함한다 (2026-09-05 규약화)

**bare `hh_mm_ss` 는 쓰지 않는다.** 세션 시각은 날짜를 넘어 충돌한다 — 실측(2026-09-05):
저장소의 2,413개 세션 중 **46개 시각이 둘 이상의 날짜에** 있고, 코드가 인용한 197개 시각
중 **8개가 이미 해소 불가**다.

| 형태 | 예 | 판정 |
| --- | --- | --- |
| 전체 경로 | `review/code/2026/09/04/23_02_51` | **권장** |
| 날짜 + 시각 | `2026-09-04 23_02_51` | 허용 |
| bare 시각 | `23_02_51` | **금지** (날짜가 없으면 해소 불가) |

지적 번호를 함께 적으면 더 좁혀진다: `review/code/2026/09/04/23_02_51 W1`.

## 3. 기존 인용은 소급 정리 대상이 아니다

499건의 bare 인용은 그 자리를 **다음에 건드릴 때** 함께 맞춘다. 일괄 치환은 하지 않는다 —
날짜를 코드 컨텍스트로 하나씩 특정해야 하는 일이라 기계적 변환이 안 된다.

## Rationale

### 왜 PR 번호로 전환하지 않았나

`00_06_38` 리뷰는 *"영구 코드 주석에 일시적 프로세스 식별자"* 라며 PR 번호·커밋 SHA 로의
전환을 제안했다. 전환하면 **514회의 기존 인용이 전부 고아**가 된다. 그리고 전제가 틀렸다 —
세션 ID 는 일시적이지 않다. `review/**` 가 커밋되므로 경로는 영구적이고, 문제는 **날짜가
빠진 인용 형태**였지 인용 대상이 아니었다.

PR 번호는 그 나름의 손실이 있다 — PR 은 라운드별 산출물을 담지 않아 *"어느 라운드의 어느
지적"* 을 가리키지 못한다. 세션 경로는 그 입도를 그대로 준다.

### 왜 소급 정리를 하지 않나

bare 인용의 날짜는 커밋 시각으로 근사할 수 있지만 **근사는 틀릴 수 있다** — 한 파일이 여러
날의 라운드를 인용하는 경우가 흔하다. 잘못 채운 경로는 bare 인용보다 나쁘다(존재하는 다른
세션을 가리킨다). 그 자리를 아는 사람이 손볼 때 맞추는 편이 옳다.
````
