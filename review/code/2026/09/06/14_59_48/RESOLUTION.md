# RESOLUTION — `review/code/2026/09/06/14_59_48` (+ consistency `14_59_49`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 6 · 위험도 MEDIUM ·
consistency **BLOCK: NO** · Critical 0 · WARNING 2
**처분**: WARNING 8건 중 6건 수정, 2건은 planner 등재(권한 밖). INFO 1건 수정.

**이번 라운드의 성격**: 지적 대부분이 *"방금 만든 것이 한 칸 좁다"* 였다. 새 결함이 아니라
**같은 결함 클래스를 세 번 연속 좁게 닫은 것**이 드러났다.

---

## W1 (architecture) — 이미 있는 SoT 를 우회한 4번째 사본이었다

`isEndpointPathUniqueViolation` 이 PG 에러 duck-typing 을 손으로 다시 짰다.
`common/db/pg-error.ts` 에 `pgErrorCode`/`isPostgresUniqueViolation` 이 이미 있었다.

**DRY 문제가 아니라 정확성 문제였다.** 그 SoT 의 docstring 이 존재 이유를 이렇게 적는다:

> TypeORM 의 QueryFailedError 는 wrap 깊이가 호출 경로에 따라 달라서 (raw query vs
> `Repository.insert` vs `Repository.save`), `err.code` 만 보거나 `err.driverError.code`
> 만 보는 검사 패턴이 곳곳에 흩어져 있었다.

내 사본은 정확히 그 흩어진 패턴 — **`driverError` 표면만** 봤다. 호출 경로가 바뀌면 조용히
false 를 돌려주고 계약이 사라진다.

| 고친 것 | 무엇 |
|---|---|
| SoT 확장 | `pgErrorConstraint(err)` — `pgErrorCode` 와 **같은 두 표면**을 흡수 |
| 호출부 | `isPostgresUniqueViolation(err) && pgErrorConstraint(err) === …` |
| `pg-error.spec.ts` 신설 | 두 표면을 **각각** 태운다 (`driverError` / 최상위). 이름 부재 → `undefined`, 비-에러 → false |
| triggers fixture | `uniqueViolation(constraint, surface)` — 종전엔 `driverError` 표면만 만들어서 **반쪽인 것이 관측되지 않았다** |

## W3 (testing·requirement) — 파서 트레일링 주석이 또 좁았다

인용 스칼라 + 트레일링 주석(`"a.ts"  # note`)이 남았다. 재현:

```
parsed: ['codebase/backend/a.ts"  # note', 'codebase/frontend/b.ts']
```

닫는 따옴표와 주석이 값에 붙어 **죽은 glob** 이 된다 — 항목이 사라지는 것과 같은 등급이다.
인용 부호 안팎을 갈라 처리한다: 언쿼트는 ` #` 이후를 자르고, 인용 스칼라는 **닫는 따옴표
뒤**를 자른다(닫는 따옴표가 없으면 **자르지 않는다** — 추측해서 자르면 값이 사라진다).

테스트 3건 추가 — 인용+주석(**RED**) · 따옴표 **안**의 `#` 은 값이다 · 미종료 따옴표 폴백.
뒤 둘은 반대 방향 대조군이다. 파서 테스트 총 47 pass, 전수 재확인 **731 대 731**.

> **같은 클래스를 세 번 좁게 닫았다** — 줄 전체 주석 → 트레일링 주석 → 인용 스칼라.
> 매번 "이번엔 닫았다" 고 적었고 매번 리뷰어가 정규식을 직접 돌려 다음 형태를 찾았다.
> 근본 처방(두 파서 golden fixture 코퍼스)은 plan 에 등재했다.

## W2 (architecture) — 같은 PR 안에서 원칙이 갈렸다

구조 축은 관계 이름을 엔티티 **타입 주석에서 파생**한다(손 목록이 좁아 유출을 놓쳤으므로).
그런데 값 축 `USER_SECRET_KEYS` 는 손으로 적혀 있고 엔티티와 대조하는 테스트가 **0건**이었다.

파생을 그대로 옮길 수는 없다 — "민감함" 은 타입이 아니라 **의미**라 AST 로 판정되지 않는다.
두 방향을 건다:

1. **패턴 부분집합** — `*Hash`·`*Secret`·`*Token`·`*RecoveryCodes` 컬럼은 전부 목록에.
   반대 방향(목록에만 있고 엔티티에 없는 유령 항목)도 함께 문다.
2. **컬럼 수 카나리아(23)** — 형태를 모르는 새 비밀 컬럼(`ssn` 같은)은 1번이 못 본다.
   키워드 목록을 넓히는 것은 **다음 키워드를 모르므로** 원리적으로 안 닫힌다. 그 자리를
   카나리아가 맡아 사람이 한 번 보게 만든다.

## W5 (testing) — 가드가 못 지키는 유일한 자리에 단위 테스트가 0건

`listMembers` 는 `User` 전 컬럼을 싣고 **JS 단 수동 매핑**으로 고른다. 구조 가드는 로드
형태만 보므로 매핑이 넓어져도 초록이다. 화이트리스트 주석이 *"안전망은 e2e J. 뿐"* 이라고
적고 있었는데 — 그 하나가 깨지면 원인을 좁힐 방법이 없다.

`workspaces.service.spec.ts` 에 2건 추가. **뮤테이션**: `...m.user` 스프레드 → **RED**
(정확히 구조 가드가 원리적으로 못 보는 그 형태다). 키 목록 비교만으로는 중첩 유출을 놓치므로
`findUserSecretLeaks` 도 함께 건다.

## W6 (documentation) — CHANGELOG 가 최종 커밋의 두 안건 중 하나를 빠뜨렸다

트레일링 주석 결함과 수정 내역을 한 절로 보충했다(이번 라운드의 인용 스칼라 건까지 합쳐서).

## consistency W1 — `details.subCode` 는 저장소 유일 키였다

세부 코드를 **세 번** 옮겼다:

| 판 | 문제 |
|---|---|
| 봉투 top-level `subCode` | `GlobalExceptionFilter` 가 안 복사 — **wire 에 닿지 않는다** |
| `details.subCode` | wire 에는 닿지만 **저장소 유일 키**를 새로 만들었다 |
| **`details.code`** | `error-codes.md §4.2` · `trigger-parameter.types.ts` 가 이미 쓰는 키 |

top-level `code` 자체를 특화 코드로 **교체**하는 선례도 7건 있으나, 이 자리는 spec 이
*"409 `RESOURCE_CONFLICT` (세부 코드 …)"* 로 **두 층을 나눠** 적었으므로 그 서술을 그대로
실현했다. 다만 *"어느 쪽이 기본인가"* 를 문서가 답하지 않으므로 **정식화를 planner 항목으로
등재**했다 — 안 적으면 다음 구현자가 또 고른다.

---

## 조치하지 않은 것

| # | 사유 |
|---|---|
| W4 scope (4번째 연쇄 확장) | 리뷰어가 *"기능·테스트 품질 충분, 되돌릴 필요 없음"* 판정. 하네스 수정은 별도 커밋으로 분리돼 cherry-pick 가능하다. **PR 설명에 4개 관심사를 명시**하라는 권고는 이행한다 |
| consistency W2 (`botToken` 마스킹 서술 자기모순) | `spec/` 쓰기라 developer 권한 밖. **plan 등재** — 방치하면 다음 구현자가 실제 last4 노출 필드를 신설해 `secret-store.md §1.1` 을 위반할 소지가 있다는 것이 이 항목의 실질이다 |
| INFO#2·3·4·5·6·7·8·9·11·12·13 | 확인 기록 · 기존 부채(소급 정리 대상 아님) · 이미 처분 · 범위 밖 |
| consistency INFO#1·2·3·4·5 | 범위 밖 · 이미 추적 중 · 후속 spec 정비 턴 |

INFO#10(`it.each` 가 같은 호출을 두 번 실행)은 수정했다 — promise 를 변수에 담아 재사용.

## 검증

lint / unit(backend **9,485**, 452 suites) / build / e2e(299) / harness(47 파서 테스트) 전부 PASS.
