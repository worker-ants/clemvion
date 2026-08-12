# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 캐시 대상 판정(`isCacheable`)이 인라인 익명 로직으로 남아 있어, 이 프로젝트가 다른 곳(예: `TERMINAL_STATUSES` 단일 출처화)에서 채택한 "이름 있는 단일 출처" 관행과 결이 다르다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168-171` (`cacheTapped` 내부)
  - 상세: `(statusCode >= 200 && statusCode < 300) || statusCode === 409 || statusCode === 410` 이 `tap()` 콜백 안에 인라인으로 박혀 있다. 현재는 이 조건을 소비하는 곳이 한 곳뿐이라 심각하지 않지만, JSDoc 이 "단일 비교로 축약 금지"·"네 경우 모두 spec 회귀 테스트가 있다"를 강조할 만큼 이 술어의 정확성이 중요하다고 스스로 명시하고 있다. 모듈 스코프의 명명된 순수 함수(`isCacheableStatus(statusCode: number): boolean`)로 추출하면 (1) 그 함수 자체를 독립적으로 단위 테스트할 수 있는 표면이 생기고, (2) JSDoc 을 함수 바로 위로 옮겨 "정책 서술"과 "부수효과(캐시 SET)"를 분리할 수 있다.
  - 제안: 필수는 아니나, 이런 "닫힌 목록" 형태의 정책 판정은 별도 named export 로 뽑아 두면 향후 §R8 범위가 또 바뀔 때(이번처럼) diff 가 그 함수 하나로 국한되고 리뷰 대상이 좁아진다.

- **[INFO]** 신규 테스트 4건(`409`/`410`/`5xx`/`401·404`)이 `redis`/`interceptor`/`context`/`callHandler` 생성 4줄을 매번 반복한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:234-293` (신규 `it` 블록 4개)
  - 상세: 각 테스트가 `const redis = makeRedis(); const interceptor = makeInterceptor(redis);` 로 시작해 상태 코드만 바꿔 가며 캐시 여부를 단언한다. 다만 이 패턴은 diff 가 새로 만든 것이 아니라 파일 전체(예: `describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)')`)에 이미 확립된 스타일이며, `beforeEach` 공유 상태를 피해 각 테스트를 독립적으로 읽을 수 있게 하려는 의도적 선택으로 보인다(스타일 일관성은 유지됨).
  - 제안: 실행 조치 불필요 — 기존 컨벤션과 일치하므로 이번 diff 범위에서 고칠 이유는 없다. 다만 이 4건처럼 "상태코드 → 캐시 여부/저장값"만 다른 케이스가 더 늘어난다면 `it.each([[409, true], [410, true], [500, false], [404, false]])` 같은 파라미터화를 고려할 수 있다는 정도로 남겨 둔다.

- **[INFO]** `cacheTapped` JSDoc(15줄)이 정책 근거·오답 두 가지(`>= 400`, `=== 400`)·이력을 한 블록에 담아 상당히 길다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:141-155`
  - 상세: 다만 이는 이 코드베이스 전반(예: `retry-turn.service.ts`, `execution-engine.service.ts` 관련 CHANGELOG 서술)에서 관측되는 "결정의 배경을 코드 옆에 남긴다"는 일관된 컨벤션이며, 실제로 이 길이 덕분에 "왜 `=== 400` 으로 좁히면 안 되는가"라는 미래의 재발 오답을 코드 레벨에서 막는다(관련 회귀 테스트 4건이 정확히 그 두 오답을 각각 잡도록 설계돼 있음, `idempotency.interceptor.spec.ts` 및 `plan/in-progress/backend-lint-gate-broken-on-main.md` 뮤테이션 표 참조). 감점 요소로 보지 않는다.

## 요약

이번 변경은 `idempotency.interceptor.ts`의 캐시 대상 판정을 `statusCode >= 400`(선재 결함)에서 Spec EIA §R8 이 정한 닫힌 목록(`2xx`·`409`·`410`)으로 교정하는 국소적 버그 수정이며, 유지보수성 관점에서는 전반적으로 우수하다. 변경된 조건문은 6줄 이내로 짧고 이름(`isCacheable`)이 의도를 정확히 드러내며, 중첩 깊이·순환 복잡도 증가가 없다. JSDoc 이 "왜 두 가지 단순화(`>= 400`, `=== 400`)가 각각 오답인지"를 명시하고 그 각각을 잡는 회귀 테스트(409/410/5xx/401·404 4건)를 신규로 추가해, 코드·테스트·문서(CHANGELOG, spec data-flow 표, plan 체크리스트) 네 층이 모두 같은 서술로 정합하게 갱신됐다 — SoT 드리프트가 없다. 테스트 파일의 반복적 셋업은 기존 파일 컨벤션과 동일한 스타일이라 새로 도입된 문제가 아니다. 유일하게 눈에 띄는 개선 여지는 캐시 가능 여부 판정을 named 함수로 추출할 수 있다는 점 정도이며, 이는 필수 수정 사항이 아니라 선택적 리팩터링이다.

## 위험도

NONE
