# 테스트(Testing) 리뷰 — hooks embed-config Cache-Control TTL 문서 단일 진실화

대상: `hooks.controller.spec.ts`, `hooks.controller.ts` (behavior-preserving DRY 리팩터).
`review/code/**`, `review/consistency/**`, `plan/in-progress/*.md` 는 리뷰 산출물/추적 문서로 테스트
관점 분석 대상에서 제외(애플리케이션 코드 아님).

## 발견사항

- **[INFO]** 신규 도입된 `EMBED_CONFIG_CACHE_MAX_MINUTES` 파생 계산에 대한 직접 테스트 부재
  - 위치: `hooks.controller.ts:41` (`Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)`), 소비처 `hooks.controller.ts` L58-63(`@ApiOperation` description), L179-181(`@ApiResponse` headers description/example)
  - 상세: 이번 diff 로 새로 추가된 계산 로직(`Math.ceil(...)`)을 실행·단언하는 테스트가 없다. 이 상수는 `EMBED_CONFIG_CACHE_CONTROL` 과 달리 실제 HTTP 응답 헤더에는 쓰이지 않고 Swagger 문서 문자열에만 소비되므로, `hooks.controller.spec.ts` 의 `res.set` 단언(`'public, max-age=300'`)으로는 커버되지 않는다. 상수가 module-private(`const`, export 없음)이라 단위 테스트에서 직접 import 도 불가능하고, `SwaggerModule.createDocument()` 기반 렌더 검증 테스트도 이 코드베이스에 존재하지 않는다(RESOLUTION.md 도 이를 "기존 관행의 연장, 신규 리스크 아님"으로 명시하며 accept). 다만 `Math.ceil` 산식 자체는 이번에 신규 도입된 코드 경로라는 점에서, 향후 `EMBED_CONFIG_CACHE_SEC` 를 60의 배수가 아닌 값(예: 90)으로 바꿀 때 반올림 방향(`ceil` vs `round`) 실수가 있어도 어떤 테스트도 잡지 못한다.
  - 제안: 스코프상 블로킹 아님(문서 텍스트 전용 영향, API 계약·실제 캐시 동작 무관). 강화하려면 (a) 두 상수를 `export` 하고 `expect(EMBED_CONFIG_CACHE_MAX_MINUTES).toBe(5)` 형태의 1-라인 단위 테스트를 추가하거나, (b) 더 강하게 `SwaggerModule.createDocument(app)` 스모크 테스트로 실제 렌더 문자열을 단언. 현 상태 유지도 수용 가능한 트레이드오프.

- **[INFO]** 강화된 헤더 단언은 프로덕션 상수를 참조하지 않고 값을 재입력(golden-value 방식) — 의도된 설계, 결함 아님
  - 위치: `hooks.controller.spec.ts:104-107`
  - 상세: `expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300')` 는 `EMBED_CONFIG_CACHE_SEC`/`EMBED_CONFIG_CACHE_CONTROL` 을 import 해서 참조하지 않고 리터럴을 그대로 하드코딩한다. 얼핏 "SoT 미참조"로 보이지만, 만약 프로덕션 상수를 그대로 참조했다면 상수 값이 바뀌어도 테스트가 항상 통과해버려 회귀 가드로서 의미가 없어진다(테스트 주석에 이 설계 의도가 명시돼 있음: "EMBED_CONFIG_CACHE_SEC 단일 진실이 깨지면(오타·단위 실수) 회귀를 잡는다"). golden-value 하드코딩이 올바른 선택이며, `stringContaining('max-age')` → 정확값으로의 강화는 실질적인 회귀 탐지력 향상이다. 확인 목적으로만 기록.

- **[INFO]** `receiveWebhook` 관련 3개 기존 테스트는 이번 diff 로 미변경 — 회귀 없음 확인
  - 위치: `hooks.controller.spec.ts:111-153`
  - 상세: 이번 diff 는 `getEmbedConfig` 경로(상수·Swagger 문자열)만 건드리고 `receiveWebhook`(interactionHttpResponse 릴레이 분기 포함)은 무관하다. 해당 3개 테스트는 여전히 유효하며 회귀 없음. 테스트 격리(매 테스트 `beforeEach` 로 mock 재생성)도 적절히 유지됨.

## 요약

핵심 변경(`hooks.controller.spec.ts` 의 `stringContaining('max-age')` → 정확값 `'public, max-age=300'` 단언 강화)은 SoT 드리프트(오타·단위 실수)를 실제로 잡아낼 수 있는 유의미한 회귀 가드 개선이다. mock 구성(`res.set/json/status` 체이닝, `beforeEach` 초기화)은 Express Response 계약을 적절히 흉내내며 테스트 간 격리도 양호하고, 테스트 이름·주석이 의도를 명확히 전달한다. `hooks.controller.ts` 의 파생 상수 도입은 behavior-preserving 리팩터로 실제 HTTP 헤더 값(`EMBED_CONFIG_CACHE_CONTROL`)에 대해서는 강화된 단언으로 잘 커버되지만, 문서 전용으로만 소비되는 `EMBED_CONFIG_CACHE_MAX_MINUTES`(신규 `Math.ceil` 계산)는 어떤 테스트로도 검증되지 않는다 — 다만 영향 범위가 Swagger 문서 텍스트에 국한되고 코드베이스 전반에 Swagger 렌더 검증 관행 자체가 부재하다는 점에서 이번 PR 의 신규 리스크로 보기 어렵고 블로킹 사유가 아니다. 전반적으로 테스트 존재·격리·가독성·회귀 방지 측면에서 양호한 소규모 변경이다.

## 위험도
LOW
