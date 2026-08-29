# 보안(Security) 리뷰 — `resolveCacheHit()` 추출 (idempotency.interceptor.ts)

## 검토 범위 및 방법

- 파일 1 (`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`)이 유일한 애플리케이션 코드 변경이며, `intercept()` 의 `switchMap` 콜백 본문을 `resolveCacheHit()` private 메서드로 추출하고 인자 4개(`redisKey`/`bodyHash`/`context`/`next`)를 `CacheLookup` 인터페이스로 묶은 **순수 구조 리팩터**다. 제거된 블록과 신설 메서드 본문을 줄 단위로 대조한 결과 로직 변화는 없다(분기 순서·조건·throw 대상·캐시 키 조합 전부 동일).
- 파일 2 (`plan/in-progress/backend-lint-gate-broken-on-main.md`)는 plan 문서 갱신, 파일 3~10 (`review/consistency/2026/08/29/17_23_43/*`)은 이번 turn 의 consistency-check 산출물이다. 둘 다 애플리케이션 코드가 아니며 시크릿·자격증명·민감정보 하드코딩은 없음을 grep(`password|api[_-]?key|secret|token|Bearer |private[_-]?key|BEGIN (RSA|PRIVATE)`)으로 확인했다 — 매치는 전부 `secret-store` 모듈명·경로 문자열이며 실제 비밀값이 아니다.
- consistency `SUMMARY.md` INFO #4 가 "`resolveCacheHit()` 호출부의 `redisKey`/`bodyHash` 필드가 뒤바뀐 것으로 보인다"는 관찰을 남겼으나, 같은 문서 하단 정정과 현재 워킹트리 직접 대조(`redisKey, bodyHash, context, next` — 3곳 모두 정상 순서) 결과 이는 구현자가 주입했다 되돌린 뮤테이션 테스트의 잔상이며 현재 코드에는 남아 있지 않음을 확인했다. 별도 뮤테이션을 재현하지 않았고 저장소에도 쓰지 않았다.

## 발견사항

- **[INFO]** 캐시된 응답 payload 가 검증 없이 그대로 재현된다 (기존 동작, 이번 diff 로 신설되지 않음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:287` (`throw new HttpException(cachedPayload as Record<string, unknown>, cached.statusCode)`), `:293` (`return of(cachedPayload)`)
  - 상세: `resolveCacheHit()` 은 Redis 에서 읽은 `cachedPayload` 를 형태 검증(`isIdempotencyEntry`)만 거치고 내용 자체는 그대로 클라이언트에 반환한다. 캐시 키가 `executionId`(Guard 가 토큰 검증 후 합성, 클라이언트 조작 불가) + `route` + `Idempotency-Key` 로 스코프돼 있고 적재도 같은 인터셉터가 하므로, 이번 diff 범위 안에서 새로운 인젝션·권한 우회 표면이 생기지는 않는다. 이 관찰은 구조 추출 이전부터 있던 동작이라 "새 결함"이 아니라 참고 사항으로만 남긴다.
  - 제안: 조치 불요 (범위 밖). 다만 향후 `storeEntry()` 적재 대상이 서비스 계층 밖(예: 사용자 입력이 그대로 섞인 응답)으로 넓어질 경우 재조사 필요.

- **[INFO]** consistency checker 가 관찰한 "필드 스왑"은 코드 결함이 아니라 되돌려진 뮤턴트임을 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:190`, `:226`
  - 상세: `SUMMARY.md` INFO #4 및 정정 문단(`review/consistency/2026/08/29/17_23_43/SUMMARY.md:51-71`)이 설명하는 대로, 구현자가 `CacheLookup.redisKey`/`bodyHash` 를 의도적으로 바꿔 넣어 spec 테스트 13건이 RED 되는 것을 실측한 뒤 즉시 원복했다. 현재 트리를 직접 열어 `{ redisKey, bodyHash, context, next }` 순서가 3곳 모두 정상임을 확인했다 — 잔여 뮤테이션 없음.
  - 제안: 후속 조치 불요.

## 요약

이번 diff 는 `IdempotencyInterceptor.intercept()` 의 `switchMap` 콜백을 `resolveCacheHit()` private 메서드로 추출하고 4개 파라미터를 `CacheLookup` 인터페이스로 그룹화한 **순수 구조 리팩터**이며, 인젝션·인증/인가·입력 검증·암호화·에러 처리·의존성 축 어디에서도 로직 변화가 없다(제거된 블록과 신설 메서드 본문이 조건·순서·throw 대상까지 동일). 캐시 키 스코프(`executionId:route:rawKey`), bodyHash 우선 검증, 엔트리/payload 손상 시 형태 검증 후 fail-open, 손상 로그에서 값 자체를 찍지 않는 것(`describeShape`) 등 기존의 보안 관련 방어는 그대로 보존됐다. consistency checker 가 지적한 "필드 스왑" 은 구현자가 주입했다 되돌린 뮤테이션 테스트의 잔상으로, 현재 워킹트리를 직접 대조해 잔여물이 없음을 확인했다. plan/consistency 문서 산출물에서도 하드코딩된 시크릿이나 민감정보 노출은 발견되지 않았다.

## 위험도
NONE
