# 테스트(Testing) 리뷰 — `idempotency.interceptor` readKey/hashBody 경계값 (누적 최종 라운드, `01_40_25`)

## 검토 범위 및 방법

이 세션의 diff 는 이미 4라운드(`23_48_38` → `00_54_18` → `01_10_52` → `01_31_17`) `/ai-review`
를 거친 `readKey`/`hashBody` 경계값 테스트·`isHttpStatusCode()` 범위 검사의 누적 상태이며, 직전
라운드(`01_31_17`, testing 위험도 NONE) 이후 실제 코드/테스트에 가해진 변경은 커밋
`2a1abb4c1` 하나뿐임을 `git log`/`git show` 로 확인했다. 그 커밋은 `idempotency.interceptor.spec.ts`
모듈 docstring 의 "다섯 번째 describe" 문단 위치를 옮긴 것으로, diff 를 직접 열어 **테스트 코드
자체는 한 줄도 바뀌지 않았음**을 확인했다(순수 주석 재배치). 그 외 변경은 `CHANGELOG.md`,
plan 체크리스트 완료 노트, `review/**` 산출물이며 테스트 코드가 아니다.

독립 재검증: `cd codebase/backend && npx jest idempotency.interceptor.spec.ts` 직접 실행 —
**56/56 통과**(`plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "인터셉터 56/56",
`01_10_52`/`01_31_17` testing.md 의 동일 주장과 일치). `readKey`/`hashBody` 경계값
`describe` 블록(`spec.ts:1224-1467`)을 직접 읽고 선언 9개/`it.each` 전개 15건이라는 plan
의 정정된 수치(`f2785d8a0`)도 직접 세어 일치함을 확인했다.

## 발견사항

- **[INFO]** `hashBody()` 의 `typeof body === 'string'` 분기가 스펙 파일 전체에서 한 번도
  실행되지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:430-435`
    (`function hashBody`, `typeof body === 'string' ? body : JSON.stringify(body ?? null)`)
  - 상세: `grep -n "body: '" idempotency.interceptor.spec.ts` 결과 매치가 `makeContext` 함수
    정의 자체(`body: 'body' in opts ? opts.body : {}`, 137행) 하나뿐이고, 어떤 `it`/`it.each`
    도 문자열 `body` 를 넘기지 않는다 — 이 파일의 모든 테스트는 `body` 로 객체(`{ a: 1 }` 등)나
    `undefined`/`null` 만 쓴다. 이번 diff 의 신규 `describe` 블록은 스스로를 "`readKey()`·
    `hashBody()` **경계값**" 테스트라고 명명하고 있고 body nullish 동등성·키 순서 의존은
    커버하는데, `hashBody` 의 두 분기 중 하나(문자열 body 를 그대로 해시하는 경로 — 예를 들어
    body 를 JSON 이 아닌 원문 문자열로 재해시하는 것과 `JSON.stringify(문자열)` 로 이중
    인코딩하는 뮤턴트를 가르는 유일한 지점)는 여전히 미검증이다. 프로덕션 코드 변경분은 아니므로
    이번 diff 의 회귀는 아니지만, "경계값 하드닝" 이라는 이 diff 의 목적 범위 안에 있는 분기다.
  - 제안: `it('body 가 원시 문자열이면 그대로 해시된다 — JSON.stringify 로 재인코딩하지 않는다', …)`
    류의 케이스 하나를 같은 `describe` 블록에 추가하면 두 분기 모두 인접 뮤턴트에 대해 방어된다.
    차단 사유는 아니며 다음에 이 파일을 만질 때 반영해도 무방하다.

- **[INFO]** (긍정, 재확인) `makeContext` 의 헤더 truthy 체크로 "헤더가 빈 문자열로 실제 존재"
  상태를 별도로 구성할 수 없는 테스트 인프라 제약은 `01_10_52` 라운드가 이미 발견해 "무해함"을
  확인한 항목이다 — 재검토 결과도 동일하다
  - 위치: `idempotency.interceptor.spec.ts:130-132` (`headers: opts.idempotencyKey ? {...} : {}`)
  - 상세: `''` 는 falsy 라 `opts.idempotencyKey: ''` 를 넘겨도 헤더 자체가 부재로 만들어진다.
    `readKey` 는 non-string/trim-후-빈-문자열/길이초과 세 경로 모두 `null` 을 반환하므로 이
    구분 불가가 실제 관측 가능한 커버리지 갭을 만들지는 않는다(공백뿐인 키 `it.each` 가 trim
    후 빈 문자열 경로를 이미 커버). 조치 불요 — 신규 지적 아님, 상태 유지 확인.

- **[INFO]** (긍정) 새 `describe` 블록의 테스트 격리·가독성·회귀 고정력은 3라운드 독립 재검증을
  거쳤고, 이번 세션의 직접 실행으로도 재확인됨
  - 위치: `idempotency.interceptor.spec.ts:1224-1467`
  - 상세: `beforeEach`/`afterEach` 없이 각 `it` 이 `makeRedis()`/`makeContext()`/
    `makeCallHandler()` 를 독립 생성해 순서 의존이 없고(격리), `warnSpy` 는 `try/finally` 로
    복원되며(가독성 있는 근거 주석 포함), 키 길이 상한(200/201)·`statusCode` 무효 5종(음수·0·
    99·600·200.5)·유효 경계 2종(100·599)·공백뿐인 키·trim 동등성·배열-vs-조인문자열 헤더·body
    nullish 동등성·키 순서 의존까지 목적별로 하나씩 겨냥한다. `readKey`/`hashBody` 가
    module-private 라 `intercept()` 경유로만 검증하는 설계는 구현 세부사항에 결합되지 않는
    바람직한 테스트 용이성 선택으로, 이번 재검토에서도 유효하다.

## 이전 라운드 testing 발견 반영 상태 (직접 소스 대조)

| 라운드 | 발견 | 이번 세션 재확인 |
|---|---|---|
| `00_54_18` WARNING #1 | 하한(100) 바로 아래(99) 무효 케이스 부재 | `spec.ts:1391` 존재, 뮤턴트 `>=100→>=50` 시 이 케이스만 RED (`01_10_52` 가 재현, 이번엔 소스만 재확인) |
| `00_54_18` WARNING #2 | "헤더 배열=중복 헤더" 주석이 실측과 다름 | `spec.ts:1286-1329` 주석 정정 + 조인 문자열 테스트 존재 확인 |
| `01_10_52` INFO | `hashOf` 가 사전 단언 없이 인덱싱 | `spec.ts:1377-1378` `toHaveBeenCalledTimes(1)` 선단언 확인 |
| `01_31_17` | 신규 발견 없음, 위험도 NONE | 이번 세션도 테스트 코드 변경 없음(docstring 재배치만) — 동일 결론 |

## 요약

직전 3라운드(`00_54_18`/`01_10_52`/`01_31_17`)가 이미 뮤테이션 실측 기반으로 검증을 마쳤고, 이번
세션의 유일한 코드 변경은 테스트 파일의 모듈 docstring 문단 재배치(테스트 로직 무변경)뿐임을
`git show` 로 확인했다. 독립적으로 `jest` 를 재실행해 56/56 통과, plan 이 주장하는 "선언 9개 /
전개 15건" 수치, `readKey`/`hashBody` 경계값 커버리지(키 길이 양쪽 경계·`statusCode` 인접 경계
양쪽·공백/trim·배열-vs-조인문자열·body nullish 동등성·키 순서 의존)를 재확인했다. 새로 찾은
유일한 갭은 `hashBody()` 의 문자열-body 분기가 이 diff 의 "경계값 하드닝" 목적 범위 안에 있음에도
여전히 테스트되지 않는다는 점(INFO, 비차단)이며, 나머지는 이전 라운드가 이미 발견해 무해함을
확인한 항목의 재확인이다. 신규 CRITICAL/WARNING 급 커버리지 갭, 격리 문제, mock 오용은
발견하지 못했다.

## 위험도

NONE
