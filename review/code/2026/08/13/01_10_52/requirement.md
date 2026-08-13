# 요구사항(Requirement) 리뷰 — `idempotency.interceptor` statusCode 경계값 하드닝 + 전회 리뷰 WARNING 4건 조치

## 대상 요약

이번 diff 는 직전 리뷰 라운드(`review/code/2026/08/13/00_54_18/`)가 지적한 WARNING 4건에 대한
조치(RESOLUTION.md 기록)를 포함한 최종 상태다 — main 대비 전체 diff 라 신규 `describe` 블록 전체가
`+` 로 보이지만, 실제로는 이전 라운드 구현 + 이번 라운드 수정이 합쳐진 결과다. 핵심 변경:

1. `idempotency.interceptor.ts`: `MIN_HTTP_STATUS_CODE=100`/`MAX_HTTP_STATUS_CODE=599` 상수 +
   `isHttpStatusCode()` 신설 → `isIdempotencyEntry()` 가 `typeof === 'number'` 대신 이 함수로 검증.
   `intercept()` 의 `!rawKey` → `rawKey === null` 명시 비교. `readKey()` JSDoc 추가.
2. `idempotency.interceptor.spec.ts`: `readKey`/`hashBody` 경계값 `describe` 블록(13개 케이스,
   최종 56/56 통과) + `makeContext` 의 `body` mock 을 `'body' in opts ? opts.body : {}` 로 수정 +
   모듈 docstring 에 5번째 describe 색인 추가.
3. `CHANGELOG.md`: `statusCode` 범위 검사 500-방지 항목 신규 등재.
4. `plan/in-progress/backend-lint-gate-broken-on-main.md`: 체크박스 완료 전환 + 완료 근거(뮤턴트
   재실측, 생존 2건의 원인, docstring 서브항목 생략 사유) 서술.
5. `review/code/2026/08/13/00_54_18/*`: 직전 라운드의 리뷰 산출물(SUMMARY/RESOLUTION/개별 리뷰어
   출력) — 코드가 아니므로 요구사항 관점 평가 대상 밖.

## 검증 방법

- `npx jest idempotency.interceptor.spec.ts` → **56/56 pass** (직전 라운드 `54/54` 대비 +2 — WARNING
  #1 조치로 `99` 케이스가 기존 `it.each` 배열에 편입, WARNING #2 조치로 조인 문자열 테스트가 신규
  추가된 결과와 정확히 일치).
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` → 0 warning/error.
- `spec/5-system/14-external-interaction-api.md` §R8 (Idempotency-Key), `spec/data-flow/15-external-interaction.md` §Redis 항목 대조.
- `CHANGELOG.md` 신규 항목을 직접 `Read` — 기존 두 항목과 형식(문제→원인→클라이언트 영향)이 일치함을 확인.

## 전회 WARNING 4건 조치 확인

| # | 전회 발견 | 조치 확인 |
|---|---|---|
| 1 (testing) | `isHttpStatusCode` 하한(100) 바로 아래(99) 경계 미검증 — 뮤테이션 생존 | `idempotency.interceptor.spec.ts` 의 무효 케이스 배열에 `['하한 바로 아래(99)', 99]` 추가 확인. RESOLUTION.md 의 재실측 표(하한 확대 `100→50` 등 5종) 전부 RED 로 기록 — 코드로도 논리적으로 타당(인접 페어 완성) |
| 2 (testing) | "헤더가 배열이면(중복 전송)" 테스트 근거 주석이 실측과 불일치 | 조인 문자열(`"a, b"`) 테스트를 별도로 신설(`중복 헤더의 조인 문자열은 그대로 유효한 키다`), 기존 배열 테스트 주석도 "타입이 허용하는 형태에 대한 방어" 로 정정. `readKey()` JSDoc 에도 동일 내용 반영 |
| 3 (documentation) | CHANGELOG 누락 | `CHANGELOG.md` 최상단에 기존 두 항목과 동일 형식으로 신규 항목 추가 확인 |
| 4 (documentation) | 모듈 docstring 이 5번째 describe 미색인 | 모듈 docstring 에 "다섯 번째 describe 는 …" 단락 추가 확인 |

네 건 모두 실제 코드/문서 상태로 재확인했고, 조치 내용이 RESOLUTION.md 의 서술과 일치한다.

## 발견사항

- **[INFO]** `isHttpStatusCode()` 의 유효 범위(100~599)는 spec 이 침묵하는 영역이다 — spec fidelity 위반 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 함수 `isHttpStatusCode` (JSDoc 및 본문, `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 상수 선언부 포함)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 은 idempotency 캐시 대상을 **닫힌 목록**(`2xx`·`409`·`410`)으로만 규정하며, 캐시 엔트리의 `statusCode` 필드가 "몇 이상 몇 이하여야 손상이 아닌가" 라는 형태 검증 값은 규정하지 않는다. 실제로 캐시에 적재되는 값은 `storeEntry()` 호출부 두 곳(`cacheTapped` 의 `next`: `< 200 || >= 300` 이면 skip, `catchError`: `isErrorStatusCacheable`(409/410)만 통과)으로 항상 2xx 또는 {409,410} 뿐이라 100~599 범위는 "손상 판정을 위한 구현 방어" 이지 §R8 의 닫힌 목록을 재구현한 것이 아니다. `isErrorStatusCacheable()` 은 그대로 별도 함수로 남아 있어 두 관심사(형태 유효성 vs 캐시 대상 여부)가 섞이지 않는다. spec 갱신 대상도 아니다(회색지대).
  - 제안: 조치 불요. (이미 직전 라운드 requirement/security 리뷰가 같은 결론에 도달했고, 이번 재검증에서도 재확인됨)

- **[INFO]** `rawKey === null` 전환은 `spec/5-system/14-external-interaction-api.md` §R8 이 규정하는 "키 미설정 시 캐시 적용 안 함" 동작을 바꾸지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 진입부(`const rawKey = readKey(...)` 및 다음 줄의 `if (rawKey === null || !this.redis)`)
  - 상세: `readKey()` 는 non-string·trim 후 빈 문자열·`MAX_KEY_LENGTH` 초과 세 경우 모두 `null` 만 반환하도록 구현돼 있어(`readKey` 본문 3개 반환 지점 확인), `rawKey` 가 falsy 이면서 `null` 이 아닌 값(예: 빈 문자열)을 반환할 경로가 없다. 따라서 `!rawKey` → `rawKey === null` 전환은 §R8 "키 미설정 시 캐시 적용 안 함" 요구를 그대로 유지하는 순수 리팩터다. 뮤테이션 관측성 개선(호출부 truthiness 가 `readKey` 내부 검사를 가리던 문제 해소)이 목적이라는 diff 주석의 주장도 실제로 검증 가능하다.
  - 제안: 조치 불요.

- **[INFO]** 경계값 테스트 13건(56/56 통과)이 문서화된 계약(키 순서 의존, body nullish 동치, 키 길이 상한, 중복 헤더 실제 경로)을 정확히 고정한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `describe('IdempotencyInterceptor — readKey / hashBody 경계값', ...)` 블록
  - 상세: `hashBody()` 의 "키 순서가 다른 동일 의미 객체는 다른 hash → 409(클라이언트 책임)" 주석(`idempotency.interceptor.ts` `hashBody` 함수)을 실제 테스트(`같은 body 라도 키 순서가 다르면 다른 hash → 409`)가 그대로 검증한다 — 문서화된 동작과 테스트가 line-level 로 일치. `body: undefined`/`body: null` 동치성 테스트도 `hashBody` 의 `body ?? null` 을 정확히 노출한다.
  - 제안: 조치 불요. 긍정 확인.

## 요약

전회 라운드(`00_54_18`)가 지적한 WARNING 4건(하한 인접 경계 미검증, 중복 헤더 근거 주석 오류, CHANGELOG 누락, 모듈 docstring 색인 누락) 모두 이번 diff 에서 실제로 조치됐음을 코드·문서 직접 대조 및 테스트 실행(56/56 pass, eslint 0/0)으로 재확인했다. `isHttpStatusCode()` 의 100~599 범위 검사는 spec EIA §R8 이 규정하는 "손상 캐시 → 500 이 아니라 신규 처리" fail-open 원칙을 구체 방어로 정확히 구현하며, §R8 의 닫힌 목록(2xx/409/410) 판정은 `isErrorStatusCacheable()` 이 그대로 별도로 담당해 관심사가 섞이지 않는다. `rawKey === null` 전환은 §R8 의 "키 미설정 시 캐시 적용 안 함" 요구를 유지하는 순수 리팩터임을 `readKey()` 의 반환 경로 분석으로 검증했다. Critical/Warning 발견사항 없음.

## 위험도

NONE
