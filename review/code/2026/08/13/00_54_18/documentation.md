# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 라운드의 클라이언트-가시적 500 방지 수정이 빠져 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:384-400` (신규 `isHttpStatusCode()`), 근거 항목은 `plan/in-progress/backend-lint-gate-broken-on-main.md:682-685`
  - 상세: 신규 `isHttpStatusCode()` 는 캐시 엔트리의 `statusCode` 가 `-1`·`0`·`600`·`200.5` 같은 값이면 손상으로 간주해 신규 처리로 강등시킨다. 이 함수의 JSDoc 자체가 "`typeof === 'number'` 만 보면 이 값들이 통과해 `res.status(-1)`/`new HttpException(payload, -1)` 로 흘러가고 express 가 전송 시점에 `RangeError` 를 내 **500** 이 된다" 고 명시한다 — 즉 실제 500 결함을 막는 클라이언트-가시적 수정이다. `CHANGELOG.md` 최상단에는 바로 이 클래스의 **같은 성격**의 이전 수정 두 건(엔트리 안쪽 `responseJson` 손상 → 500, 캐시 키 스코프)이 상세한 "Unreleased" 항목으로 이미 등재돼 있는데, 이번 `isHttpStatusCode()` 방어에 대응하는 항목은 없다. 같은 파일·같은 세션에서 이미 확립된 관행(모든 fail-open/500 방지 수정마다 CHANGELOG 항목을 남김)과 어긋난다.
  - 제안: 기존 항목들과 같은 형식(문제 → 원인 → 클라이언트 영향)으로 `## Unreleased — 손상된 캐시 엔트리의 statusCode 가 유효 범위를 벗어나면 500 이 됐다` 류의 항목을 추가한다.

- **[WARNING]** 테스트 파일 최상단 모듈 docstring 이 신규 5번째 `describe` 블록을 목록에서 빠뜨렸다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-40` (모듈 docstring, 특히 gate 11·24·34 의 "두 번째"·"세 번째"·"네 번째 describe" 서술) / 신규 블록: `:1208-1218` (`describe('IdempotencyInterceptor — readKey / hashBody 경계값', ...)`)
  - 상세: 이 파일의 모듈 docstring 은 파일 안의 각 `describe` 블록을 "두 번째 describe 는 …", "세 번째 describe 는 …", "네 번째 describe 는 …" 식으로 순번을 매겨 요약해 왔다(정확히 이 관행 자체가 이 파일의 문서화 스타일이다). 이번 diff 가 파일 끝에 다섯 번째 `describe` 블록(`readKey`/`hashBody` 경계값, gate 1208-1425)을 새로 추가했지만, 최상단 docstring 은 여전히 네 개까지만 나열한다. 블록 자체의 로컬 docstring(gate 1208-1217)은 잘 작성돼 있어 내용 손실은 없지만, 파일 구조를 훑어보는 용도인 최상단 색인이 이제 실제 파일 구조보다 좁다 — 이 저장소가 반복해 지적해 온 "문서한 범위가 실제보다 좁다/넓다" 패턴과 같은 종류다.
  - 제안: 모듈 docstring에 "다섯 번째 describe 는 `readKey`/`hashBody` 경계값 — …" 한 단락을 추가해 색인을 최신화한다.

- **[INFO]** `readKey()` 헬퍼에 JSDoc 이 없다 — 파일 내 다른 모든 헬퍼는 문서화돼 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:409` (`function readKey(raw: unknown): string | null`)
  - 상세: 같은 파일의 `describeShape`(gate 402) · `hashBody`(gate 416-419) · `isErrorStatusCacheable`(gate 341-354) · `isIdempotencyEntry`(gate 356-373) · `isHttpStatusCode`(gate 384-393) 는 전부 최소 한 줄 이상의 문서(JSDoc 또는 인라인 주석)를 갖는데 `readKey` 만 무주석이다. 이번 diff 는 `intercept()` 의 호출부 주석(gate 105-108)에서 "이제 책임이 갈린다 — `readKey` 는 '쓸 수 있는 키인가', 여기는 '받았는가' 만 본다" 고 `readKey` 의 계약을 명시적으로 서술하는데, 정작 계약의 주인인 `readKey` 자체에는 그 계약(non-string → null, trim 후 빈 문자열 → null, `MAX_KEY_LENGTH` 초과 → null, 그 외 trim 된 문자열)을 적어 둔 곳이 없다.
  - 제안: `readKey` 위에 반환값 규약(`string | null`, null 의 세 가지 사유)을 한 줄 JSDoc 으로 추가한다.

- **[INFO]** 체크리스트 항목이 번들로 묶었던 "클래스 docstring 에 R8 선재 결함 참조 한 줄 추가" 서브 항목의 이행 여부가 완료 노트에 없다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:674`("함께: 클래스 docstring 에 R8 선재 결함 참조 한 줄 추가(INFO 2, 경미).")와 `:682-696`(완료 노트)
  - 상세: 원 체크리스트 항목은 세 가지를 묶었다 — (1) `readKey`/`hashBody` 경계값 테스트, (2) 클래스 docstring 에 "R8 선재 결함" 참조 한 줄 추가, (3) `isIdempotencyEntry()` 의 statusCode 범위 검사. 완료 노트(gate 682-696)는 (1)과 (3)을 구체적 수치(테스트 13건, 뮤턴트 10개)로 확인해 주지만 (2)에 대해서는 아무 언급이 없다. 실제로 이번 diff(`idempotency.interceptor.ts`)에도 클래스 최상단 docstring(gate 49-86)에는 변경이 없다. "R8 선재 결함" 자체가 이후 다른 라운드(`eia-r8-cache-scope`, 같은 문서 gate 746 부근)에서 완전히 수정돼 더 이상 "선재 결함"이 아니게 됐을 가능성이 높아 이 서브 항목이 자연스럽게 무의미해졌을 수 있지만, 체크박스는 `[x]`로 통째로 닫혔고 완료 노트가 그 사정을 밝히지 않아 다음 사람이 "완료라고 적혀 있는데 실제로는 안 됐다"로 오인할 여지가 있다.
  - 제안: 완료 노트에 "docstring 참조 줄 추가는 생략함 — 참조 대상이던 R8 선재 결함이 이후 라운드에서 이미 수정돼 더 이상 유효하지 않음" 한 줄만 덧붙이면 모호성이 사라진다.

## 요약

이번 diff 는 세 파일(테스트 스펙, 인터셉터 구현, plan 문서) 모두 코드 옆에 근거·뮤테이션 실측 결과·설계 이유를 촘촘히 남기는 이 저장소의 문서화 관행을 잘 따르고 있고, 신규 함수(`isHttpStatusCode`)와 신규 테스트 블록 각각의 로컬 문서는 충실하다. 다만 (1) 같은 클래스의 이전 500-방지 수정마다 남겨 온 `CHANGELOG.md` 관행이 이번 statusCode 범위 검사에는 적용되지 않았고, (2) 테스트 파일 최상단의 "describe 블록 색인" 이 신규 5번째 블록을 반영하지 못해 스스로 세운 문서화 관행에서 벗어났으며, (3) 헬퍼 함수 하나의 JSDoc 누락과 (4) plan 체크박스 완료 노트의 서브 항목 처리 여부 모호함이 남아 있다. 전부 차단성은 아니지만 이 저장소가 반복적으로 겪어 온 "문서가 실제 범위/상태와 어긋난다"는 결함 클래스와 같은 성격이라 수정을 권장한다.

## 위험도

LOW
