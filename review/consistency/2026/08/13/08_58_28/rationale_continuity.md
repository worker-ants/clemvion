# Rationale 연속성 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- spec/` 결과 없음 — 이번 라운드는 **spec 문서 변경이 없다**.
코드 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (+구현) 와
`idempotency.interceptor.spec.ts` (+테스트) 두 파일뿐이며, 내용은:

1. `readKey()` 실패를 `null` 로 명시하고 호출부가 `!rawKey` truthiness 대신 `rawKey === null` 로 판정하도록 좁힘 (동작 동일, 판정 책임만 이동)
2. 캐시 엔트리 `statusCode` 검증을 `typeof === 'number'` 에서 `isHttpStatusCode` (정수 + `[100,599]` 범위) 로 강화
3. 경계값(`readKey`/`hashBody`) + `statusCode` 범위 테스트 13건 + mock 의 `body: 'body' in opts ? opts.body : {}` 정규화

이는 `spec/5-system/14-external-interaction-api.md` §R8 계열(`fix(eia)` #1153/#1155/#1157/#1158, `test(eia)` 최근 2건)의 연속 하드닝 라운드이고, 이번 라운드 자체는 그 마지막 잔여 갭(엔트리 `statusCode` 가 HTTP 코드 형태가 아닐 때 `RangeError`→500) 을 닫는다.

## 대조한 Rationale

- `spec/5-system/14-external-interaction-api.md` **§R8** "Idempotency-Key 와 `submit_form` 검증 실패의 관계" — 캐시 대상 닫힌 목록(`2xx`/`409`/`410`, `400 VALIDATION_ERROR`·`5xx` 제외) + 캐시 키 스코프(`executionId`+`route`, 헤더 값 단독·토큰/jti 스코프·전역 fallback 전부 기각)
- `spec/data-flow/15-external-interaction.md` **Rationale** "Fail-open 정책의 일관 표기" — Redis/idempotency 전 경로 fail-open(warn) 원칙, §2.2 스키마 매핑 표의 "캐시 대상은 닫힌 목록" 재확인

## 발견사항

### [INFO] 신규 `isHttpStatusCode` 무결성 검사는 R8 의 "닫힌 목록" 과 별개 층 — 명시 구분 외 조치 불필요
- target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `isHttpStatusCode`(L397-403), `isIdempotencyEntry`(L377-385)
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R8 "**단일 비교로 축약하지 말 것**" — `isErrorStatusCacheable`(L355-357, `=== 409 || === 410`, 변경 없음)이 그 열거를 그대로 유지
- 상세: `isHttpStatusCode` 는 **읽기 시점**(캐시에서 역직렬화한 엔트리)의 손상 방어이고, `isErrorStatusCacheable` 은 **쓰기 시점**(무엇을 캐시할지)의 R8 닫힌 목록 게이트다. 이 서비스가 직접 `storeEntry` 하는 값은 항상 2xx 또는 409/410 이라 `[100,599]` 범위 안에 있으므로, 신규 검사가 정상 엔트리를 거부할 여지는 없다. R8 이 금지한 "단일 비교로 열거를 축약"은 `isErrorStatusCacheable` 에는 적용되지 않은 채 그대로다 — 즉 이번 diff 는 R8 이 규율하는 그 조건을 건드리지 않았다.
- 제안: 조치 불필요. 다만 두 함수의 관심사가 이름만으로 구분되지 않으므로(`isHttpStatusCode` vs `isErrorStatusCacheable`), 향후 유지보수자가 "형태 검증"과 "캐시 대상 목록"을 혼동하지 않도록 이미 코드 주석이 그 경계를 명시하고 있음(L46, L344-346, L397 doc-comment) — 이 상태를 유지하면 충분.

## 요약

이번 라운드는 spec 문서 변경이 전혀 없는 순수 구현/테스트 하드닝(§R8 연속 라운드의 마지막 잔여 갭 — 캐시 엔트리 `statusCode` 가 HTTP 코드 형태가 아닐 때의 500 방지)이다. 코드 diff 를 §R8("캐시 대상은 닫힌 목록" · "캐시 키는 execution+route 로 스코프, 헤더 단독·토큰 스코프·전역 fallback 기각")과 `spec/data-flow/15-external-interaction.md` 의 fail-open Rationale 에 대조한 결과, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것도 발견되지 않았다. `readKey`/`isErrorStatusCacheable`/캐시 키 스코프 로직은 변경 없이 그대로이며, 신규 `isHttpStatusCode` 는 R8 이 규율하는 "무엇을 캐시하는가" 축과 겹치지 않는 별도의 읽기-시점 방어다.

## 위험도

NONE
