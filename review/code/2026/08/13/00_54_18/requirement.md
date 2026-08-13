# 요구사항(Requirement) 리뷰 — idempotency.interceptor 경계값 테스트 + isHttpStatusCode

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 describe 블록 13건 신설 + `makeContext` 의 `body` mock 정규화 수정
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정을 truthiness → `=== null` 명시 비교로 변경, `isIdempotencyEntry()` 의 `statusCode` 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()` (정수 + 100~599 범위) 로 강화
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 선재 갭 체크박스 완료 표시 + 완료 근거 서술

## 검증 방법

코드 정독 외에 다음을 직접 실행해 확인했다:
- `npx jest idempotency.interceptor.spec.ts` → 54/54 pass
- `npx tsc --noEmit -p tsconfig.json` → 해당 파일 관련 에러 0
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` → 0 warning/error
- `spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md` 대조

## 발견사항

- **[INFO]** `readKey`/`hashBody` 경계값(`MAX_KEY_LENGTH=200`, statusCode 유효 범위 `100~599`)은 이번 diff 가 신설한 값이 아니라 기존 구현을 새로 커버한 것이며, spec(`spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md`)은 두 값 모두에 대해 침묵한다 — 순수 구현 방어(Redis 키 길이 제한 · express `RangeError` 방지)이지 spec 요구사항 위반이 아니다. 판단 근거는 두 함수(`isHttpStatusCode`, `readKey`)의 docstring 이 각각 스스로 명시하고 있어 spec 갱신 대상도 아니다(회색지대, 조치 불요).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:394` (`isHttpStatusCode`), `:409` (`readKey`)

- **[INFO]** `rawKey === null` 로의 변경은 `readKey()` 가 빈 문자열을 이미 필터링(`trimmed.length === 0` → `null`)하므로 현재 구현에서는 동작을 바꾸지 않는 순수 리팩터다(회귀 없음). 커밋 메시지·plan 서술이 주장하는 "책임 분리로 뮤테이션이 잡혔다"는 논리를 직접 검증했다: 변경 전 `!rawKey` 조건에서는 `readKey` 내부의 빈 문자열 검사를 제거해도 호출부 truthiness 가 여전히 `''` 를 걸러내 테스트가 GREEN 으로 남는 반면, `rawKey === null` 로 바꾸면 그 내부 검사 제거가 즉시 관측 가능한 회귀(빈 키로 캐시 사용)가 된다 — 서술이 코드와 일치한다.

- **[INFO]** `isHttpStatusCode()` 는 100~599 범위의 모든 정수를 "손상 아님"으로 판정하므로, 이론상 인터셉터가 실제로 쓰는 상태코드(2xx/409/410) 밖의 값(예: 418)이 캐시에 섞여 있어도 손상으로 잡히지 않고 성공 채널로 재생된다. 다만 이 값은 인터셉터 자신이 `storeEntry()` 에서 2xx/409/410 만 적재하므로 정상 경로에서는 발생하지 않고, 이 함수의 문서화된 목적도 "express `RangeError` 방지"로 한정돼 있어(§`isErrorStatusCacheable` 이 닫힌 목록을 별도로 담당) 의도된 관심사 분리다. 결함이 아니다.

## 요약

경계값 테스트 13건(키 길이 상한 200/201, 공백·탭 전용 키, 앞뒤 공백 trim, 배열 헤더, body 키 순서 hash 불일치, `undefined`/`null` body 동치, statusCode 범위 밖 4가지 · 경계 2가지)과 `isHttpStatusCode()` 범위 검사 신설이 diff 의 전부다. 신설 함수는 spec EIA §R8 이 요구하는 "손상 캐시 → 500 이 아니라 신규 처리" fail-open 원칙을 구체 방어(정수+100~599 범위)로 정확히 구현하며, 닫힌 목록(2xx/409/410) 판정은 별도 함수(`isErrorStatusCacheable`)가 그대로 유지해 관심사가 섞이지 않는다. `intercept()` 의 `rawKey === null` 변경은 동작을 바꾸지 않는 안전한 리팩터이고, 실제로 이전엔 truthiness 가 가리고 있던 관측 갭을 닫는다는 주석·plan 서술이 코드로 검증됐다. 테스트 mock 의 `'body' in opts ? opts.body : {}` 도 `hashBody` 의 `body ?? null` 동치성(undefined vs null)을 정확히 노출하도록 고쳐졌다. jest 54/54 pass, tsc/eslint 클린을 직접 실행해 확인했다. plan 파일의 "13건" 서술도 실제 `it`/`it.each` 개수와 일치한다. Critical/Warning 은 발견되지 않았다.

## 위험도

NONE
