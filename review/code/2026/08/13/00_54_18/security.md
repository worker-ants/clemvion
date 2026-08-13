# 보안(Security) 코드 리뷰

## 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (신규 경계값 테스트 13건)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`readKey` 판정 명시화 + `isHttpStatusCode()` 신설)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크리스트/이력 갱신, 코드 아님)

## 발견사항

- **[INFO]** 캐시 엔트리 `statusCode` 범위 검사(100–599)가 `1xx` 정보성 코드까지 허용한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:394-400` (`isHttpStatusCode`)
  - 상세: `isHttpStatusCode()` 는 `Number.isInteger(value) && value >= 100 && value <= 599` 로 검사한다. 이 함수가 통과시키는 값 중 `1xx`(예: `100`)는 최종 응답 상태 코드로는 의미론적으로 유효하지 않다. 캐시 엔트리가 손상되어 `statusCode: 100` 같은 값이 저장돼 있으면, 정상 재현 경로(`intercept()` 의 `res.status(cached.statusCode)` 호출부, `idempotency.interceptor.ts` 391행 부근 `typeof res.status === 'function'` 분기)에서 그 값을 그대로 응답에 실어 비정상 상태 라인을 만들 수 있다. 다만 이 값의 출처는 서버 자신이 이전에 적재한 Redis 캐시뿐이라 **공격자가 직접 제어할 수 있는 입력 경로가 아니며**, 이 diff 가 막으려는 실제 위험(`-1`/`0`/`3.5` 등으로 인한 `RangeError`→500)은 정상적으로 차단된다. 신규 취약점이라기보다 방어 범위의 미세한 여백에 가깝다.
  - 제안: 필요하면 `value >= 200`(성공/에러 재현 채널은 실제로 `2xx`·`409`·`410` 만 캐시 대상이므로) 로 하한을 좁히는 것을 고려할 수 있으나, 우선순위는 낮다 — 급한 조치 불필요.

- **[INFO]** 캐시 손상 로그가 payload 값을 찍지 않도록 의도적으로 설계됨 (긍정 관찰)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `describeShape()` (402-407행 부근)
  - 상세: 손상 엔트리 로깅 시 원본 캐시 값을 출력하지 않고 `typeof`/`array`/`null` 같은 형태 문자열만 기록한다(`/** 손상 로그용 — 값 자체를 찍지 않는다(캐시 payload 가 로그로 새지 않도록) */`). 로그를 통한 민감정보 노출(§7 에러 처리) 관점에서 올바른 설계다. 조치 불필요, 참고로 기록.

- **[INFO]** 이번 diff 의 핵심 변경(`rawKey === null` 명시 비교, `isHttpStatusCode()` 신설)은 취약점 도입이 아니라 방어 강화
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:110`(`if (rawKey === null || !this.redis)`), `:394-400`(`isHttpStatusCode`)
  - 상세: `!rawKey` truthiness 검사를 `rawKey === null` 명시 비교로 좁혀 `readKey()` 의 책임(빈 문자열/길이초과 거부)과 호출부 책임(키 미제공 여부)을 분리했다. `isHttpStatusCode()` 는 손상된 캐시 엔트리의 `statusCode` 가 `res.status()`/`HttpException` 생성자로 흘러가 `RangeError`(500)를 유발하는 경로를 차단한다. 두 변경 모두 입력 검증을 좁히거나 명시화하는 방향으로, 인젝션·인증우회·정보노출 등 새 공격 표면을 열지 않는다.
  - 제안: 없음.

## 그 외 점검 결과 (해당 없음)

- 인젝션(SQL/XSS/커맨드/경로탐색): 해당 diff 는 문자열을 SQL/셸/파일 경로에 사용하지 않는다. Redis 키는 서버가 신뢰 가능한 값(`executionId`: Guard 가 토큰 검증 후 합성, `route`: `getHandler().name`)과 길이·형태가 이미 제한된 `rawKey` 로만 조립되며 이번 diff 로 새로 열린 문자열 조립 지점은 없다.
- 하드코딩된 시크릿: 없음 (테스트 파일도 jest mock 뿐, 실 자격증명 없음).
- 인증/인가: 이번 diff 는 `InteractionGuard` 이후 실행되는 캐시 계층 내부 판정만 다루며, 인증/인가 로직 자체는 변경하지 않았다.
- 암호화: `bodyHash` 는 SHA-256(무결성 비교 용도, 비밀정보 보호 목적 아님) 그대로이며 변경 없음.
- 에러 처리: 위 `describeShape()` 관찰대로 민감정보 미노출 유지.
- 의존성 보안: 이번 diff 는 의존성 변경을 포함하지 않는다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`: 체크박스 상태 갱신과 완료 기록 추가뿐이며 실행 코드가 아니어서 보안 관점 검토 대상이 아니다.

## 요약

이번 변경은 idempotency 캐시 인터셉터의 기존 방어(키 판정·엔트리 형태 검사)를 명시화·정밀화하고 그 경계값을 커버하는 테스트 13건을 추가하는 하드닝 성격의 커밋이다. 새로운 인젝션·인증우회·시크릿 노출 표면은 확인되지 않았고, 유일하게 짚을 만한 점은 `isHttpStatusCode()` 의 허용 범위가 `1xx` 까지 포함해 이론적으로 비정상 상태 라인을 만들 여지가 있다는 것인데, 그 값의 출처가 서버 자신이 적재한 캐시뿐이라 공격자가 제어할 수 있는 입력 경로가 아니므로 실질 위험은 낮다.

## 위험도

NONE
