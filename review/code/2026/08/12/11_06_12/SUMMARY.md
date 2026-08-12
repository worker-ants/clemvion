# ai-review SUMMARY — `11_06_12` (forced 6)

델타 = 커밋 `17221ecb9` — backend lint `no-unsafe-*` warning 25건 제거(46→21), 3파일.
**의도적 부분 작업** — 나머지 21건은 겹치지 않는 다른 7파일에 있고 다음 세션이 이어받는다.

## 집계 — 6/6 착지, **CRITICAL 0 / WARNING 0**

| reviewer | 위험도 |
|---|---|
| side_effect · scope · maintainability · requirement | **NONE** |
| security · testing | LOW (INFO만) |

## side_effect 가 "런타임 0" 을 주장에서 사실로 바꿨다

이 델타의 값은 "타입만 붙였다" 인데, 그건 **주장**이었다. side_effect 가 증명했다:

- `git show 17221ecb9~1:<path>` / `17221ecb9:<path>` 로 before/after 소스를 scratch 에 추출
- 저장소의 **TypeScript 5.9.3** 으로 `transpileModule` emit
- 1차(기본 옵션)에서 `execution-engine.service.ts` 만 달랐는데 원인은 **내가 추가한 주석 2줄**
- 2차에서 프로젝트 실제 `tsconfig.json` 옵션(`removeComments: true` 포함)을 이식해 재실행

**3파일 전부 emit JS 가 md5 까지 동일.** `as` 단언·제네릭 인자·`let x: T;`·import elision 이
전부 emit 에서 사라진다는 것을 개별로도 확인했다.

> 이 저장소는 "정적 형태 판단 vs 벤치마크" 로 이미 데인 적이 있다. 이번엔 리뷰어가
> **컴파일러를 실제로 돌려** 판정했다.

## security — 핵심 우려를 정면으로 다뤘고, 결론은 "새 위험 없음"

프롬프트로 던진 우려는 이것이었다: **`no-unsafe-*` 는 "검증 안 된 값이 흐른다" 는 신호인데
타입을 붙이는 건 검증이 아니라 단언이다 — 경고만 지우고 위험은 남을 수 있다.**

세 자리 판정:

| 자리 | 판정 |
|---|---|
| `m.query<{id:string}[]>` (동시 실행 상한) | 원칙적 우려는 타당. **다만 이 커밋이 만든 위험이 아니다** — 수정 전에도 암묵 `any` 로 곧바로 `.length` 를 읽었다. 게다가 **실패 방향이 fail-closed**: shape 이 어긋나 `rows.length` 가 `undefined` 면 `undefined === 1` 은 false → admission **거부**(cap 우회 아님) |
| `let result: SetupResult` | 어댑터 3종(Slack·Telegram·Discord)을 직접 열어 확인 — 외부 JSON 을 통째 캐스팅하는 게 아니라 **필드별 명시 매핑으로 리터럴을 새로 구성**한다. secret rotate 에 쓰이는 `issuedInboundSigning` 은 Telegram 이 `randomBytes(24)` 로 **자체 생성**한 값 |
| `getPrototypeOf(x) as object` | 무해 |
| 기존 방어를 지웠는가 | **없음** — `typeof` 체크·가드 삭제 0 |

하드닝 제안(INFO): admission 자리에 `Array.isArray(rows)` 런타임 가드. **채택하지 않았다** —
아래 처분 참조.

## testing 이 내 전제 두 개를 정정했다

- 내 프롬프트는 "`migrate-node-output-refs.ts` 에 테스트가 있는가? 없으면 17건이 아무 테스트도
  안 거치는가?" 라고 물었다. **있다** — 전용 spec 44건이 `rewriteExpression` 을 직접 덮는다.
- **그러나 7개 콜백 중 Pass 2 하나만 spec 입력이 매치하지 않아 한 번도 실행된 적이 없었다.**
  44건을 돌면서도 그 자리는 비어 있었다. → **처분함**(아래).

`m.query` 제네릭도 세 겹으로 뒷받침됨을 확인했다 — 같은 파일의 기존 선례(`:8450`), 그 shape 를
반영한 unit mock, 그리고 같은 트랜잭션을 **실 Postgres 로 돌리는 e2e**(`execution-concurrency-cap`).

## 나를 정정한 사실 셋

| 내가 말한 것 | 실제 |
|---|---|
| "콜백 **7곳**이 같은 형태" | **6곳**. Pass 5(`:467`)는 캡처 그룹 수·옵셔널이 달라 공용 타입으로 못 묶는다 (maintainability) |
| "`migrate` 스크립트에 테스트가 없을 수 있다" | **44건 있다** (testing) |
| — | `wip(` 접두사는 이 저장소 이력에서 **유일 사용례** (scope) |

## 처분

| # | 출처 | 처분 |
|---|---|---|
| 1 | testing INFO | **Pass 2 테스트 추가.** 뮤테이션으로 판별력 확인 — 치환을 무력화하면 **정확히 1건 RED**(새 테스트만). 44→45 |
| 2 | security INFO (`Array.isArray` 가드) | **유예.** 아래 근거 |
| 3 | requirement INFO (plan 의 "47건" vs 실측 46) | 다음 세션이 plan 을 닫을 때 함께 정정 — 핸드오프에 명시 |
| 4 | scope INFO (`wip(` 접두사) | PR 타이틀에서 정리. 커밋 amend 는 하지 않음(이력이 실제 진행을 반영) |

**#2 를 유예한 이유**: 이 커밋의 값 하나가 **"emit 이 바이트 동일" 이라는 증명 가능한 성질**이다.
런타임 가드를 넣는 순간 그 성질이 깨진다. 그리고 security 스스로 판정했듯 실패 방향이
**fail-closed** 라 급하지 않다. 별도 항목으로 남기는 편이 정직하다.

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 0
