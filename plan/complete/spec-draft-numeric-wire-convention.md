---
title: numeric 컬럼의 wire 타입 규약 + threshold 라벨 정정 + JSDoc 공개 노출 명시
worktree: plan-in-progress-items-b0c80b
started: 2026-09-05
owner: planner
status: complete
priority: P2
spec_impact:
  - spec/1-data-model.md
  - spec/conventions/swagger.md
---

# numeric wire 타입 규약 (planner 3건 묶음)

> 출처: `spec-draft-nullable-notation-followups.md` 의 planner 트랙 3건.
> 세 건 다 `#1284`(numeric 축 가드) 가 드러낸 같은 자리에서 나왔고, **같은 두 파일**을
> 건드리므로 한 세션으로 묶으라고 그 트래커가 지시해 두었다.
>
> | # | 항목 | 출처 |
> |---|---|---|
> | ① | `spec/1-data-model.md` 의 `threshold` 가 `Float` 로 라벨링 | `19_43_18` INFO#6 |
> | ② | `swagger.md` 에 numeric/decimal 불변식 미성문화 | `20_05_42` W2 |
> | ③ | `swagger.md` 에 "JSDoc 은 공개 description 이 된다" 미명시 | `21_10_30` INFO#3 |

---

## 1. 실측 — 저장소의 numeric 컬럼은 **둘뿐**이고, 둘이 서로 다르게 나간다

```
grep -rhoiE "^\s+[a-z_]+ +(NUMERIC|DECIMAL)\([0-9]+, *[0-9]+\)" codebase/backend/migrations/*.sql
```

| 컬럼 | DB 타입 | 노출 경로 | **wire 타입** |
|---|---|---|---|
| `alert_rule.threshold` | `NUMERIC(12,4)` | 컨트롤러가 엔티티를 **그대로 반환** | **`string`** (`"10.0000"`) |
| `llm_usage_log.cost_usd` | `NUMERIC(12,6)` | 서비스가 `SUM(u.cost_usd)::float` + `Number(row.costUsd)` 로 **명시 변환** | **`number`** |

두 경로를 코드에서 확인했다 — `statistics.service.ts:346,376`(과 `:430,457`)이 실제로
`::float` 와 `Number(...)` 를 **둘 다** 건다. 즉 `StatisticsResponseDto.costUsd: number` 는
옳고, `AlertRuleDto.threshold: string` 도 옳다. **둘 다 옳은 것이 요점**이다.

### 그런데 spec 은 이 둘을 다르게 라벨링한다

| 위치 | 현재 |
|---|---|
| `1-data-model.md:851` (`cost_usd`) | `Numeric(12,6)?` — DB 타입 그대로, **정확** |
| `1-data-model.md:873` (`threshold`) | `Float` — **틀렸다.** 같은 행의 설명은 *"DB 는 `NUMERIC(12,4)` 고정소수"* 라고 스스로 반박한다 |

같은 문서 안에서 **유일한 두 numeric 컬럼이 서로 다른 관례로 적혀 있고**, 그중 하나는
자기 행의 설명과 모순된다.

### 오탐 배제 — 다른 `Float` 라벨은 정말 float 다

`1-data-model.md:361` 의 `rerank_score_threshold | Float?` 는 실제로
`DOUBLE PRECISION`(`V082__knowledge_base_rerank.sql:10`)이다. 이름이 비슷하다고 함께 고치면
**맞는 것을 틀리게 만든다** — 건드리지 않는다.

---

## 2. 변경안 (A) — `1-data-model.md` 의 두 numeric 행을 나란히 맞춘다

`threshold` (§2.25):

```
| threshold | Numeric(12,4) | 임계치. **응답에는 문자열로 실린다** — 엔티티를 그대로 내보내는 경로라 TypeORM 의 numeric 표현이 그대로 나간다 ([swagger.md §1-6](./conventions/swagger.md#1-6-numeric-컬럼의-wire-타입)). 쓰기는 `number` 를 받는다 |
```

`cost_usd` (§2.24) — 타입 라벨은 이미 정확하므로 **wire 타입 한 구절만** 잇는다:

```
| cost_usd | Numeric(12,6)? | `pricing.ts` 단가표(`provider:model`)로 계산. 미등재 모델은 NULL (통계 `SUM` 에서 자연 제외). 통계 응답에는 **숫자**로 실린다 — 서비스가 `::float` + `Number()` 로 명시 변환한다 ([swagger.md §1-6](./conventions/swagger.md#1-6-numeric-컬럼의-wire-타입)) |
```

> **왜 `cost_usd` 도 건드리나**: ①은 `threshold` 한 줄만 지목했다. 그런데 그 줄을 고치는
> 이유가 *"이 문서의 다른 numeric 행과 어긋난다"* 이므로, 비교 대상이 되는 행이 wire 타입을
> 말하지 않으면 다음 사람은 **둘이 왜 다른지**를 다시 알아내야 한다. 두 행이 함께 있어야
> 규약이 읽힌다.

## 3. 변경안 (B) — `swagger.md` §1-6 신설

§1 (DTO 패턴) 의 마지막 소절로 `### 1-6. numeric 컬럼의 wire 타입` 을 넣는다.
`1-5`(writeOnly/readOnly) 다음, `## 2) Controller 패턴` 앞이다.

```markdown
### 1-6. numeric 컬럼의 wire 타입

TypeORM 은 `numeric`/`decimal` 컬럼을 **문자열**로 준다 — 정밀도 손실을 피하기 위한 것이고,
JS `number` 로 받으면 그 컬럼 타입을 고른 이유가 사라진다.

따라서 응답 DTO 의 타입은 **그 필드가 어떻게 나가는지**를 따른다:

| 노출 경로 | wire 타입 | DTO 선언 |
| --- | --- | --- |
| 엔티티를 그대로 반환 (패스스루) | 문자열 | `field: string` + `@ApiProperty({ type: String, example: '10.0000' })` |
| 서비스가 명시 변환 (`::float` / `Number(...)`) | 숫자 | `field: number` |

**둘 다 정당하다.** 정하는 것은 컬럼 타입이 아니라 **변환이 있느냐**다.

저장소의 두 실례가 각 갈래다 — `alert_rule.threshold`(패스스루 → 문자열),
`llm_usage_log.cost_usd`(`statistics.service.ts` 가 `SUM(...)::float` + `Number(...)` →
숫자). 데이터 모델 §2.24·§2.25 도 이 구분을 적는다.

> **가드**: 패스스루 갈래는 `swagger-dto-contract.spec.ts` 의 `findNumericAsNumber` 가
> 저장소 전역으로 강제한다 — `numeric`/`decimal` 컬럼을 그대로 내보내는 응답 DTO 가 그
> 필드를 `number` 라고 하면 실패한다. 짝짓기는 `<Entity>Dto` 이름 관례에 의존하며 그
> 한계는 술어 docstring 에 캐너리로 고정돼 있다. 명시 변환 갈래는 정적으로 판별할 수
> 없으므로 **가드가 아니라 이 규약이 담당한다.**
```

## 4. 변경안 (C) — `swagger.md` §3 에 "JSDoc 은 공개된다" 한 문단

§3 (주석/설명 톤) 의 길이 표 **바로 뒤**, 보안·정책 캐비엇 인용문 앞에 넣는다.

```markdown
**JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다** (2026-09-05 규약화):

플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다(문서 상단).
즉 DTO 의 `/** ... */` 는 **API 소비자가 읽는 문장**이다. 정정 경위·리뷰 참조·"왜 이렇게
바꿨는지" 같은 **내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석**에 적는다 — `//` 는
플러그인이 읽지 않는다.

| 무엇 | 어디 |
| --- | --- |
| 소비자가 이 필드를 쓰려면 알아야 하는 것 | JSDoc `/** */` |
| 왜 이 값이 이 타입인지의 경위, 리뷰·PR 참조 | 바로 위 `//` 주석 |

`alert-rule-response.dto.ts` 의 `threshold` 가 이 분리를 적용한 예다.

**기존 DTO 는 소급 정리 대상이 아니다** — §1-4 신설 때와 같은 원칙이다. 그 자리를 다음에
건드릴 때 함께 맞춘다.
```

## 5. 변경안 (D) — `swagger.md ## Rationale` 짝짓기 (`--spec` W1)

이 문서는 본문 규칙마다 **하단 `## Rationale` 절 + 본문의 `> 근거:` 역링크**를 짝지어 온다
(§1-4·§3·§5 가 전부 그렇다). 신설 §1-6 도 같은 형태를 갖춰야 한다 — 안 그러면 이 문서 안에서
새 절만 근거 없이 서 있다.

`## Rationale` 에 아래 절을 넣고, §1-6 본문 끝에 `> 근거: [...]` 역링크를 단다:

```markdown
### §1-6 numeric wire 타입 — 가드와 규약의 책임 분리

**기각한 대안 — 가드가 명시 변환 경로까지 판정하게 하기.** 그러면 이 규약 절이 필요 없어진다.
그러나 그 판정은 **서비스 코드의 데이터 흐름을 따라가야** 성립한다 — `SUM(...)::float` 가 어느
필드로 흘러 어느 DTO 로 조립되는지를 정적으로 잇는 일이고, `findNumericAsNumber` 가 서 있는
AST 수준에서 할 수 있는 판정이 아니다. 무리하게 넓히면 그 파일이 스스로 적어 둔 "정규식으로
세 번 틀렸다" 는 자리로 되돌아간다.

그래서 분업한다 — **정적으로 판별 가능한 갈래(패스스루)는 가드**, **변환 유무를 사람이 아는
갈래는 이 규약**이 맡는다. 저장소의 numeric 컬럼이 둘뿐이고 그 둘이 각각 다른 갈래라는
실측이 이 형태를 정했다 (`plan/complete/spec-draft-numeric-wire-convention.md`).
```

## 6. 변경안 (E) — frontmatter `code:` 에 가드 추가 (`--spec` INFO#2)

§1-6 이 `swagger-dto-contract-guard.ts` 를 **강제 주체로 지목**하는데, 그 파일이
`swagger.md` frontmatter `code:` 글롭 어디에도 안 걸린다. 이 문서에서 처음으로 `code:` 밖
파일을 본문이 지목하는 사례다. 글롭을 하나 잇는다:

```yaml
  - codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts
```

## 7. 적용 후 의무 — 소스 plan 체크박스 backport (`--spec` W2)

이 draft 를 적용하면 `spec-draft-nullable-notation-followups.md` `## 후속` 의 **미체크 3건**
(swagger.md numeric 불변식 / `1-data-model.md` threshold 라벨 / JSDoc 분리 가이드)을
**같은 커밋에서 `[x]` 로 갱신**한다. 그 문서는 *"미체크 체크박스가 단일 진실"* 이라고 스스로
적어 두었으므로, 갱신을 빠뜨리면 다음 사람이 이미 끝난 일을 다시 한다.

---

> **제목에 `/` 를 쓰지 않은 이유**: `spec/` 의 앵커 링크를 검사하는 가드가 저장소에 없다
> — 잘못 쓰면 조용히 썩는다. 한글 슬러그 규칙을 손으로 계산하다 두 번 틀린 이력이 있어,
> 저장소 실례(`#41-기록-대상-액션`)로 확인된 문자(영숫자·공백·하이픈·한글·마침표)만 쓰는
> 제목으로 골랐다. `decimal` 은 본문이 첫 줄에서 함께 말한다.

---

## 8. 이 draft 가 하지 않는 것

- **코드 변경 없음.** ①②③ 은 전부 `spec/` 서술이다. 가드(`findNumericAsNumber`)와
  분리 적용례(`alert-rule-response.dto.ts`)는 `#1284` 에서 이미 머지됐다 — 이 draft 는
  **이미 강제되고 있는 것을 규약 문서에 적는 일**이다.
- **`rerank_score_threshold` 를 건드리지 않는다** (§1 오탐 배제 참조).

---

## Rationale

### 왜 "numeric 은 문자열이다" 로 단순화하지 않았나

처음 등재된 문구는 *"`numeric`/`decimal` 컬럼을 엔티티 그대로 내보내는 응답은 **문자열**"*
이었다. 이 형태로만 쓰면 `StatisticsResponseDto.costUsd: number` 가 **위반처럼 보인다** —
실제로는 서비스가 명시 변환하므로 옳은데도 그렇다.

저장소에 numeric 컬럼이 둘뿐이고 **그 둘이 각각 다른 갈래**라는 실측이 규약의 형태를
정했다. 갈래를 가르는 것은 컬럼 타입이 아니라 **변환의 유무**다.

### 기각한 대안 — 가드를 명시 변환 경로까지 넓히기

`findNumericAsNumber` 가 "변환이 있으니 `number` 가 맞다" 까지 판정하게 하면 규약 문서가
필요 없어진다. 그러나 그 판정은 **서비스 코드의 데이터 흐름을 따라가야** 성립한다 —
`SUM(...)::float` 가 어느 필드로 흘러 어느 DTO 로 조립되는지를 정적으로 잇는 일이고,
이 가드가 서 있는 AST 수준에서 할 수 있는 판정이 아니다. 무리하게 넓히면 **정규식으로
세 번 틀렸던 그 자리로 되돌아간다**(같은 파일 docstring). 정적으로 판별 가능한 갈래만
가드가 맡고 나머지는 규약이 맡는 분업이 옳다.

### `cost_usd` 행까지 손대는 것이 범위 확대 아닌가

①은 `threshold` 한 줄을 지목했다. 그런데 그 줄이 틀렸다는 **근거 자체가** "같은 문서의
`cost_usd` 행과 어긋난다" 이다. 비교 대상을 그대로 두면 정정의 근거가 문서에 안 남고,
다음 사람은 두 행이 왜 다른 wire 타입을 갖는지 코드를 다시 읽어야 한다. 근거가 되는
행에 한 구절을 잇는 것은 확대가 아니라 **정정을 읽히게 하는 최소치**다.

### §3 에 넣는 이유 — 길이가 아니라 **독자**의 문제다

§3 은 이미 *"상세 근거는 spec 본문에 두고 여기서는 요약 + SoT 링크"* 라고 적는다. 그것은
**길이·SoT** 규칙이다. ③이 말하는 것은 다른 축이다 — JSDoc 에 적은 것은 **공개 API
문서로 나간다**는 사실이고, 이건 짧게 쓰든 길게 쓰든 달라지지 않는다. 그래서 길이 표
바로 뒤, 캐비엇 앞에 독립된 문단으로 둔다.
