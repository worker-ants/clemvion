# 성능(Performance) 코드 리뷰 — EIA R8 캐시 키 스코프 (idempotency cache key scoping)

## 리뷰 범위

- `CHANGELOG.md` (문서, 성능 영향 없음)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (핵심 로직 변경)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (단위 테스트, 신규 4건)
- `codebase/backend/test/external-interaction.e2e-spec.ts` (e2e 테스트, 신규 2건)

핵심 변경은 멱등 캐시 Redis 키를 `interaction:idempotency:<key>` 에서
`interaction:idempotency:<executionId>:<route>:<key>` 로 스코프 확장한 것 하나다(보안 결함 수정,
`idempotency.interceptor.ts:114-115`). 알고리즘 구조·호출 패턴·I/O 모델은 그대로이고 캐시 키 조립
문자열만 바뀌었다.

## 발견사항

- **[INFO]** Redis 키 길이 증가는 무시할 수준
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:115` (`const redisKey = \`${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}\`;`)
  - 상세: 키가 `<prefix><rawKey>` (≤ 200자, `MAX_KEY_LENGTH`) 에서 `<prefix><executionId>:<route>:<rawKey>` 로 늘었다. `executionId` 는 UUID(36자), `route` 는 `interact`/`cancel` 같은 짧은 핸들러명이라 실질 증가분은 수십 바이트 수준이다. Redis GET/SET 은 여전히 O(1) 단일 키 연산이라 이 증가가 지연시간·메모리에 미치는 영향은 무시할 수 있다.
  - 제안: 조치 불필요. `MAX_KEY_LENGTH` 는 `rawKey` (클라이언트 입력)에만 적용되고 `executionId`/`route` 는 서버가 합성한 값(길이 고정)이라 총 키 길이 상한도 사실상 여전히 유계다 — 별도 가드 추가는 과잉.

- **[INFO]** `context.getHandler().name` 호출 비용
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113` (`const route = context.getHandler().name;`)
  - 상세: 요청마다 함수 객체의 `.name` 프로퍼티를 1회 읽는다. NestJS 인터셉터 파이프라인이 이미 `ExecutionContext` 를 구성하는 비용에 비하면 무시할 수 있는 property read 이며, 반사(reflection) API 호출도 아니다(단순 함수 객체 속성).
  - 제안: 조치 불필요.

- **[INFO]** Redis GET→SET 사이 원자성 부재는 기존 구조 그대로(회귀 아님)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` (line 91 부근) / `storeEntry()` (line 234 부근)
  - 상세: 캐시 조회(GET)와 적재(SET)가 원자적이지 않아 동시 요청 시 둘 다 캐시 미스로 판정되고 둘 다 downstream 을 부를 수 있는 좁은 창이 기존에도 있었다. 이번 변경은 키 스코프만 바꿨을 뿐 이 구조를 건드리지 않았고, 코드 주석(line 68-73)도 이 트레이드오프를 명시적으로 인지하고 있다(spec 의 "가용성 우선" 결정).
  - 제안: 이번 PR 범위 밖 — 별도 트래킹이 이미 문서화돼 있으므로 추가 조치 불요.

## 요약

이번 변경은 순수 보안 버그 수정(캐시 네임스페이스 누수 차단)이며 알고리즘 복잡도·I/O 모델·자료구조·캐싱 전략에 실질적 변화가 없다. Redis 키 조립에 두 개의 문자열 세그먼트(`executionId`, `route`)가 추가된 것이 유일한 런타임 변경점으로, 여전히 O(1) 단일 키 GET/SET 경로이고 키 길이 증가폭도 무시할 수준이다. N+1 호출·블로킹 I/O 신설·불필요한 메모리 할당·O(n²) 누적 연산 등 성능 관점의 문제는 발견되지 않았다. 신규 테스트(unit 4건, e2e 2건)도 각 케이스당 상수 개수의 Redis/HTTP 호출만 발생시켜 테스트 스위트 실행 시간에 미치는 영향도 미미하다.

## 위험도

NONE
