# 테스트(Testing) 리뷰 — `idempotency.interceptor` readKey/hashBody 경계값 + statusCode 범위 검증 (최종 수렴 라운드, `08_47_47`)

## 검토 방법

이 diff(`origin/main...HEAD`)의 실질 코드 변경은 `CHANGELOG.md`, `idempotency.interceptor.ts`,
`idempotency.interceptor.spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md` 넷이고,
나머지 60여 개 파일은 이미 5라운드(`23_48_38`→`00_54_18`→`01_10_52`→`01_31_17`→`01_40_25`) 진행된
`/ai-review`의 산출물 커밋이다. 이번 라운드는 프롬프트의 주장을 그대로 받지 않고 **직접 재실행**해
검증했다.

- `npx jest idempotency.interceptor.spec.ts` → 56/56 pass (직접 실행, 재확인)
- `npx jest ... -t "readKey / hashBody 경계값"` → **15 passed, 41 skipped, 56 total** — plan 노트의
  "경계 테스트 15건" 주장과 일치 (`plan/in-progress/backend-lint-gate-broken-on-main.md:691`)
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` → 0 warning/error
- **뮤테이션을 직접 주입해 재실행**(자기보고만 받지 않음, `git status` 로 클린 확인 후 mutate →
  scratchpad 백업에서 원복):
  - `MIN_HTTP_STATUS_CODE = 100` → `50` (하한을 넓히는 뮤턴트, 이전 라운드에서 리뷰어가 생존을
    지적했던 것과 동일) → **1건 RED** (`99` 무효 케이스, `idempotency.interceptor.spec.ts:1391`
    부근 `it.each`) — "인접 경계로 고정했다"는 plan 주장이 실측으로 성립함을 재확인.
  - `readKey()`(`idempotency.interceptor.ts:423`)의 `trimmed.length === 0` 절 제거 → **2건 RED**
    (`idempotency.interceptor.spec.ts:1266-1270` 공백뿐인 키 `it.each`) — `rawKey === null` 명시
    비교(`idempotency.interceptor.ts:113`)로의 전환이 이 경계를 실제로 관측 가능하게 만든다는
    plan/코드 주석의 주장도 실측으로 성립.
  - 두 뮤테이션 모두 원본 파일을 스크래치패드에 백업한 뒤 mutate → 재실행 → 파일 내용 diff 없음을
    `git status`로 확인하며 원복.

## 발견사항

- **[INFO]** (긍정, 재확인) 신규 `describe('IdempotencyInterceptor — readKey / hashBody 경계값', …)`
  블록(`idempotency.interceptor.spec.ts:1224-1467`)의 테스트 격리는 문제 없다
  - 상세: 파일 전체에 `beforeEach`/`afterEach`가 없고(grep 확인), 각 `it`/`it.each` 원소가
    `makeRedis()`/`makeContext()`/`makeCallHandler()`를 매번 새로 생성해 전역 상태 공유가 없다.
    `Logger.prototype.warn` spy(`idempotency.interceptor.spec.ts:1400` 부근)도 파일 전역 관행대로
    `try/finally { warnSpy.mockRestore() }`로 복원된다. `key200`/`key201`을 한 `it`에서 함께
    검증하는 구성(`:1228-1250`)은 off-by-one이 한쪽 케이스만으로는 안 잡힌다는 주석 근거가
    있고, 실제로 `readKey`의 `trimmed.length > MAX_KEY_LENGTH`(`idempotency.interceptor.ts:426`)와
    정확히 대응한다.

- **[INFO]** module-private 헬퍼(`readKey`/`hashBody`/`isHttpStatusCode`)를 export 없이
  `intercept()` 경유로만 테스트하는 구조는 테스트 용이성 관점에서 적절하다
  - 상세: 모듈 docstring(`idempotency.interceptor.spec.ts:44-45`)이 "헬퍼 직접 호출은 호출부
    테스트가 아니다"를 명시하고 실제로 전 테스트가 `lastValueFrom(interceptor.intercept(...))`을
    거친다. 구현 세부사항이 아니라 공개 계약(HTTP 요청→응답)을 검증하므로 리팩터링 내성이
    높다. 대가로 각 경계 케이스가 RxJS 파이프라인 전체를 통과해야 해 개별 순수함수 단위
    테스트보다 다소 무겁지만, 이 파일의 기존 4개 블록과 일관된 선택이라 새로운 문제가 아니다.

- **[INFO]** `readKey`의 `typeof raw !== 'string'` 분기는 배열 형태만 커버하고 다른 non-string
  타입(예: 숫자)은 커버하지 않는다 — 우선순위 낮음
  - 위치: `idempotency.interceptor.ts:424`(`if (typeof raw !== 'string') return null;`) /
    대응 테스트는 `idempotency.interceptor.spec.ts:1286-1310`(배열 케이스 1건뿐)
  - 상세: Express/Node의 `req.headers[key]` 타입은 `string | string[] | undefined`로 이미
    제한되어 있어 배열 외의 non-string 값(숫자·객체 등)이 실제로 이 경로에 도달할 표면은
    타입 시스템이 사실상 닫아 둔다. 뮤테이션으로도 이 분기 자체를 지우면 배열 테스트가 이미
    잡으므로 실질 커버리지 갭은 아니지만, "문자열이 아님"이라는 텍스트상 사유가 배열 하나로만
    대표된다는 점은 기록해 둔다.
  - 제안: 조치 불요. 표면이 사실상 닫혀 있어 우선순위를 매길 필요는 없다.

- **[INFO]** `makeContext()`의 `idempotencyKey` 삼항(`opts.idempotencyKey ? {...} : {}`,
  `idempotency.interceptor.spec.ts:120-122`)은 "헤더 값이 리터럴 빈 문자열"과 "헤더 자체가
  없음"을 구분하지 못한다 — 기존 라운드(`01_10_52` RESOLUTION INFO 12)가 이미 확인·유예한
  항목과 동일
  - 상세: `readKey()`가 두 입력을 모두 `null`로 처리해(non-string이든 trim 후 빈 문자열이든
    결과가 같음) `intercept()` 레벨에서 관측 가능한 차이가 없다는 이전 라운드의 근거가 이번
    소스 상태에서도 그대로 유효함을 재확인했다. 새 회귀가 아니다.
  - 제안: 조치 불요 — 기존 유예 결정 유지.

- **[INFO]** `bodyHashOf()` 테스트 헬퍼(`idempotency.interceptor.spec.ts:183-186`)가 프로덕션
  `hashBody()`(`idempotency.interceptor.ts:428-433`)와 동일한 알고리즘을 손으로 재구현한다
  - 상세: "같은 규칙"이라는 주석이 있어 의도는 명시돼 있지만, 두 구현이 독립적이지 않아
    `hashBody`가 잘못 바뀌어도 `bodyHashOf`를 나란히 잘못 바꾸면 테스트가 여전히 통과할
    이론적 여지가 있다(mirror-implementation 패턴의 일반적 한계). 다만 이번 diff가 새로 만든
    패턴이 아니라 이 파일 전역에서 이미 반복적으로 쓰이는 기존 관행이고, 새 경계값 테스트가
    검증하는 핵심 성질(키 순서 의존, body nullish 동등성)은 `intercept()`가 실제로 저장하는
    `bodyHash`와 이 헬퍼가 만드는 값을 비교하는 방식이라 갭이 실질적으로 좁다.
  - 제안: 조치 불요 — 이번 diff 단독 책임이 아니며 기존 파일 컨벤션의 연장.

## 이전 5라운드 testing 지적사항 반영 상태 (직접 재실행/재확인)

| 라운드 | 지적 | 반영 확인 방법 | 결과 |
|---|---|---|---|
| `00_54_18` WARNING #1 | 하한 인접 경계(99) 무효 케이스 부재 — 뮤턴트(`>=100→>=50`) 생존 | `MIN_HTTP_STATUS_CODE`를 50으로 직접 mutate 후 재실행 | RED (killed) — 이번 세션에서 재확인 |
| `00_54_18` WARNING #2 | "헤더 배열=중복 헤더" 주석이 사실과 다름(실측: 조인 문자열) | 소스 대조 — `idempotency.interceptor.spec.ts:1286-1329` | 주석 정정 + 별도 테스트 확인 |
| `01_10_52` WARNING #1 | "13건" 표기가 실제 개수(15건)와 불일치 | `jest -t` 실행으로 직접 카운트 | 15 passed 확인, plan 표기 일치 |
| `01_10_52` INFO #11 | `hashOf`가 사전 단언 없이 `calls[0]` 인덱싱 | 소스 대조 — `toHaveBeenCalledTimes(1)` 선단언 존재 확인 | 반영 확인 |
| `01_31_17` WARNING #1 | docstring 문단 오삽입(테스트 코드 자체 아님, 문서 결함) | 해당 사항 없음(documentation 영역) | — |

## 요약

이번 diff의 테스트 변경(`readKey`/`hashBody` 경계값 신규 `describe` 블록 15건 + `isHttpStatusCode()`
대응 `it.each`)은 이전 5라운드의 뮤테이션 기반 자기검증 주장을 이번 세션에서 **직접 재실행**하여
독립적으로 재확인했다 — 자기보고를 그대로 받지 않고 `MIN_HTTP_STATUS_CODE` 하한 확대 뮤턴트와
`readKey()`의 빈 문자열 검사 제거 뮤턴트를 각각 주입해 대응 테스트가 실제로 RED가 되는 것을
확인한 뒤 원복했다. 테스트 격리(공유 상태 없음, `warnSpy` 짝 맞음), 가독성(경계 양쪽을 한 곳에
모으는 의도가 주석으로 명시됨), 회귀 안전성(기존 4개 describe 블록 56/56 그대로 pass) 모두
양호하다. 새로 지적할 CRITICAL/WARNING 급 커버리지 갭·격리 문제·mock 오용은 발견하지 못했고,
남은 관찰(non-string 비배열 타입 미커버·`makeContext` 빈 문자열/헤더부재 미구분·`bodyHashOf`
mirror 구현)은 전부 우선순위가 낮거나 이전 라운드가 이미 검토·유예한 항목의 재확인이다.

## 위험도

NONE
