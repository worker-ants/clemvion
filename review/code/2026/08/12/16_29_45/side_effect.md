# 부작용(Side Effect) 리뷰 — EIA idempotency 캐시 스코프(§R8) 정합화

## 발견사항

- **[WARNING]** 캐시 대상이 `2xx~3xx`(옛 조건 `statusCode >= 400` 이면 제외 → 400 미만 전부 캐시)에서 `2xx` 단독(+409/410)으로 **조용히 좁아졌다** — 3xx 응답 캐시 중단은 문서·테스트 어디에도 명시되지 않은 부수 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168-171` (`cacheTapped` 의 `isCacheable` 정의)
  - 상세: 옛 코드 `if (statusCode >= 400) return;` 는 200~399 를 전부 캐시했다(3xx 포함). 신규 코드는
    ```
    const isCacheable =
      (statusCode >= 200 && statusCode < 300) ||
      statusCode === 409 ||
      statusCode === 410;
    ```
    로 바뀌어 **300~399 는 더 이상 캐시되지 않는다.** 이 PR 의 CHANGELOG(`CHANGELOG.md:10`)·docstring(`idempotency.interceptor.ts:141-155`)·plan 뮤테이션 표(`plan/in-progress/backend-lint-gate-broken-on-main.md:576-579`)는 모두 "409·410 이 추가로 캐시된다"만 서술하고, 3xx 가 캐시 대상에서 빠진다는 사실은 어디에도 언급이 없다. 테스트(`idempotency.interceptor.spec.ts`)에도 3xx 케이스가 없어 이 축소가 회귀 테스트로 잠기지 않았다.
    실측(`grep -rn "res.status" codebase/backend/src/modules/external-interaction/`)으로는 이 모듈의 어떤 컨트롤러도 3xx 를 실제로 반환하지 않아 **현재는 실질 영향이 0**으로 보인다. 다만 Spec EIA §R8 원문("성공 2xx")과 정확히 일치시킨 결과이므로 방향 자체는 옳다 — 문제는 "왜 좁아졌는지"가 어디에도 기록되지 않아, 향후 누군가 3xx 응답을 이 경로에 추가하면 캐시 제외가 "의도"인지 "회귀"인지 판단할 근거가 없다는 점이다.
  - 제안: docstring 또는 CHANGELOG 에 "구현이 종전엔 3xx 도 캐시했으나 R8 이 2xx 만 지목하므로 이번에 함께 좁혔다"는 한 줄을 남기거나, 최소한 plan 의 뮤테이션 표에 이 축소를 기록해 다음 리뷰어가 "누락"으로 재지적하지 않게 한다.

- **[INFO]** 인터페이스(클라이언트 관측 가능) 동작 변경: 동일 `Idempotency-Key` 로 `409`/`410` 재요청 시 이제 24h 캐시된 동일 응답이 재현된다 — 이전에는 매번 다운스트림이 재실행됐다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168-172` (`isCacheable` 확장), `CHANGELOG.md:19-20` ("클라이언트 영향" 절)
  - 상세: 의도된 변경이며 Spec EIA §R8/EIA-RL-02 와 정합화하는 것이 이 PR 의 목적이다. CHANGELOG·spec·테스트(`409 는 캐시된다`, `410 도 캐시된다`)로 충분히 문서화·회귀 고정되어 있다. 다만 "부작용" 관점에서는 실제로 **Redis SET 호출 빈도가 늘어나는 새로운 쓰기 부작용**(이전엔 409/410 경로에서 SET 이 전혀 발생하지 않았음)이라 기록해 둔다.
  - 제안: 없음 — 이미 충분히 문서화·테스트됨. 참고 목적의 INFO.

- **[INFO]** 함수 시그니처·공개 API 형태 변경 없음 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `cacheTapped(redisKey, bodyHash, context)` (변경 없음), `intercept(context, next)` (변경 없음)
  - 상세: 이번 diff 는 `cacheTapped` 내부의 조건식만 교체했고 파라미터·리턴 타입·호출부는 그대로다. 생성자(`constructor`)도 변경 없음. 호출자(`interaction.controller.ts`)에 영향 없음.

## 요약

이번 변경의 핵심은 `IdempotencyInterceptor.cacheTapped` 의 캐시 대상 조건을 `statusCode >= 400` 제외에서 Spec EIA §R8 의 닫힌 열거(`2xx`·`409`·`410`)로 교체한 것이며, 이는 문서(CHANGELOG·spec·plan)·테스트(신규 4건)로 폭넓게 뒷받침된 **의도된** 부작용(더 많은 상태코드에 대해 Redis SET 이 발생하고, 클라이언트가 409/410 재조회 시 캐시된 동일 응답을 받게 됨)이다. 함수 시그니처·전역 상태·파일시스템·환경변수·네트워크 호출·이벤트 계약에는 변화가 없다. 다만 조건식을 "≥400 제외"에서 "닫힌 열거 포함"으로 재작성하는 과정에서 옛 조건이 암묵적으로 포함하던 `300~399`(3xx) 범위가 캐시 대상에서 조용히 빠졌는데, 이 축소는 CHANGELOG·docstring·plan 뮤테이션 표 어디에도 명시되지 않았고 회귀 테스트도 없다 — 현재 이 모듈이 3xx 를 실제로 반환하지 않아 실질 위험은 낮지만, 문서화되지 않은 동작 축소라는 점에서 WARNING 으로 기록한다.

## 위험도

LOW
