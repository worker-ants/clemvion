# Security Review — `23_48_38`

## 리뷰 대상 요약

핵심 프로덕션 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
한 곳이다 — 캐시 엔트리 **안쪽** `responseJson` 파싱을 재현 분기 두 자리의 맨몸 `JSON.parse`
에서 단일 지점(`switchMap` 콜백)으로 끌어올리고, 실패 시 `discardCorruptEntry()` 로 위임해
fail-open(+warn) 시키는 리팩터. 나머지 파일(`CHANGELOG.md`, `*.spec.ts`, `plan/*.md`,
`review/code/2026/08/12/23_24_08/**`, `review/code/2026/08/12/23_36_13/**`)은 테스트·문서·이전
리뷰 세션 산출물이며 실행 코드 변경이 없다.

## 발견사항

- **[INFO]** 손상된 캐시 엔트리 파싱 실패 메시지가 새니타이징 없이 로그에 그대로 삽입된다 (이론적 log injection/forging)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:225` (`discardCorruptEntry`), 참고로 동일 패턴이 `:145`(GET 실패)·`:308`(직렬화 실패)·`:316`(SET 실패)에도 기존부터 존재
  - 상세: ``err instanceof Error ? err.message : String(err)`` 를 템플릿 리터럴로 그대로 `this.logger.warn()` 에 넣는다. `JSON.parse` 의 `SyntaxError.message` 는 V8 구현에 따라 원문의 일부 스니펫을 포함할 수 있어, Redis 에 저장된 값을 임의로 조작할 수 있는 행위자가 있다면 개행 등을 실어 로그 라인을 위조할 여지가 이론적으로 있다. 다만 이 값은 **이 서비스 자신이 쓴 Redis 엔트리**이고 손상시키려면 Redis 쓰기 권한이라는 이미 높은 신뢰 경계가 필요해, 이 diff 가 신뢰 경계를 새로 확장하지는 않는다 (직전 리뷰 라운드 `23_24_08` 에서도 INFO#1 로 동일 판정, 조치 불요로 유예됨).
  - 제안: 조치 불요. 원한다면 구조화 로깅(메시지·원인을 별도 필드로 분리)으로 전환.

- **[INFO]** `JSON.parse` 결과를 런타임 스키마 검증 없이 타입 단언으로 캐스팅
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:159` (`JSON.parse(cachedJson) as IdempotencyEntry`), `:183` (`JSON.parse(cached.responseJson)`)
  - 상세: `bodyHash`/`statusCode`/`responseJson` 필드 존재·타입을 검증하지 않고 그대로 사용한다. 다만 이 값도 이 서비스가 `storeEntry()` 로 직접 쓴 자기 자신의 캐시라 외부 입력이 새로 유입되는 지점이 아니다 — 신뢰 경계 미확장.
  - 제안: 조치 불요(기존 관례의 연장). 강화하려면 `zod` 등으로 엔트리 형태를 검증하되 별도 후속으로.

- **[INFO]** (개선 확인) 이번 변경이 정보 노출 표면을 오히려 줄인다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149-201` (`switchMap` 콜백 전체)
  - 상세: 종전에는 안쪽 `responseJson` 이 손상돼 있으면 재현 분기의 맨몸 `JSON.parse` 가 던진 `SyntaxError` 가 그대로 올라가 `GlobalExceptionFilter` 가 500 으로 마스킹했다. 이제는 `discardCorruptEntry()` 로 구조화된 fail-open 처리를 거쳐 downstream 정상 응답을 돌려준다 — 예기치 못한 예외 타입이 필터까지 도달하는 경로가 줄어 방어적으로 개선.

- **[INFO]** (설계 확인) `bodyHash` 판정이 payload 파싱보다 먼저 — 캐시 손상으로 409 충돌 검출을 우회할 수 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:167-186`
  - 상세: 순서가 반대였다면(먼저 payload 파싱 시도) 손상된 `responseJson` 을 가진 엔트리에서 `IDEMPOTENCY_KEY_CONFLICT` 가 조용히 사라지고, 동일 `Idempotency-Key` + 다른 body 재요청이 새 응답을 받는 방향으로 멱등성 충돌 탐지가 무력화될 수 있었다. 현재 순서는 이 계약을 지킨다. 회귀 테스트(`idempotency.interceptor.spec.ts` 의 "안쪽이 깨졌어도 body 가 다르면 여전히 409" 케이스)로 순서가 고정됨을 확인.

- **[INFO]** Redis 캐시 키 조합에 `rawKey` 원문(구분자 미이스케이프) 삽입 — 충돌 가능성 검토
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:133` (`` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` ``)
  - 상세: `rawKey`(클라이언트 `Idempotency-Key` 헤더, `readKey()` 로 trim+길이 상한 200만 적용)에 콜론이 포함돼도, `executionId`(서버가 토큰 검증 후 합성, 클라이언트 조작 불가)와 `route`(`context.getHandler().name`, 서버 값)가 항상 `rawKey` **앞**에 고정 삽입되므로 다른 execution/route 네임스페이스로의 충돌은 발생하지 않는다 — 자기 자신의 키 네임스페이스 안에서만 영향. 이번 diff 의 변경 범위가 아니고(기존 로직 그대로), Redis 키는 명령이 아니라 단순 문자열이라 인젝션 표면도 아니다. 문제 없음으로 확인.

## 요약

이번 diff 의 프로덕션 코드 변경은 캐시 엔트리 안쪽 `responseJson` 파싱을 단일 지점으로 모아 fail-open 시키는 방어 강화 리팩터로, 새로운 인젝션·인증/인가 우회·시크릿 노출·안전하지 않은 암호화 사용은 발견되지 않았다. `bodyHash` 판정이 payload 파싱보다 앞선 순서 덕분에 캐시 손상을 이용한 409 충돌 탐지 우회도 막혀 있다. 지적 가능한 항목(로그 인젝션 이론적 가능성, 런타임 스키마 미검증)은 모두 "서비스 자신이 쓴 Redis 데이터"라는 동일 신뢰 경계 안에 있어 실질 위험이 낮고, 직전 리뷰 라운드(`23_24_08`)에서도 같은 판정으로 조치 불요 처리된 항목과 동일하다. 오히려 종전에 발생하던 500 마스킹(예외 상세가 `GlobalExceptionFilter` 로 전파되는 경로) 하나가 사라져 정보 노출 표면이 소폭 줄었다. `CHANGELOG.md`/`plan/*.md`/`review/**` 등 나머지 변경 파일은 문서·테스트·이전 리뷰 산출물이며 실행 코드가 아니고, grep 상 하드코딩된 시크릿·자격증명도 발견되지 않았다.

## 위험도
NONE
