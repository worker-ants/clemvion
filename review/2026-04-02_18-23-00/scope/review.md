### 발견사항

- **[WARNING]** auth.controller.ts, auth.controller.spec.ts — 표현식 엔진과 무관한 포맷팅 전용 변경
  - 위치: `auth.controller.ts:81-83`, `auth.controller.spec.ts:26-33, 32-37`
  - 상세: 멀티라인 표현식의 줄바꿈 스타일만 변경. 기능 변경 없음. 표현식 엔진 피처와 전혀 무관한 파일
  - 제안: 피처 브랜치에서 무관한 파일 변경은 분리하거나 제거할 것

- **[WARNING]** `expression-resolver.service.ts:resolveString` — 혼합 표현식 처리 분기 미구현
  - 위치: `expression-resolver.service.ts:136-141`
  - 상세: 스펙(5-expression-language.md §8.3.1)에서 "혼합 텍스트 + 표현식: 결과는 항상 string"이라 명시하지만, 코드의 두 분기(`FULL_EXPRESSION_PATTERN` 매칭 여부)가 모두 동일하게 `result`를 반환함. 타입 강제(String 변환)가 없으며, `evaluate()`가 혼합 케이스를 항상 string으로 반환한다는 암묵적 가정에 의존
  - 제안: mixed path에서 명시적으로 `String(result)` 변환 또는 `evaluate`가 해당 케이스를 보장함을 주석으로 명시

- **[INFO]** `websocket.gateway.spec.ts:202` — 타입 단언 제거
  - 위치: `websocket.gateway.spec.ts:202-204`
  - 상세: `as unknown as { continueExecution: jest.Mock }` 제거. 기능 변경 없는 스타일 수정. 피처와 무관
  - 제안: 별도 PR로 분리하거나 그대로 유지

- **[INFO]** `frontend/package.json` — 빌드 스크립트 변경 (`next build` → `next build --webpack`)
  - 위치: `frontend/package.json:7`
  - 상세: `transpilePackages`가 Turbopack에서 정상 작동하지 않아 webpack 강제 지정한 것으로 추정되나, 커밋 메시지나 주석에 근거 없음. 빌드 성능에 영향
  - 제안: 이유를 주석 또는 커밋 메시지에 명시할 것

- **[INFO]** `execution-engine.service.ts` — `executeNode` 시그니처에 `nodeMap?` 추가
  - 위치: `execution-engine.service.ts:494-495`
  - 상세: optional 파라미터로 추가되어 기존 호출부 호환은 유지되나, `nodeMap` 미전달 시 표현식 해석이 스킵됨(`resolvedConfig = node.config`). 표현식 미해석이 의도적 fallback인지 불명확
  - 제안: `nodeMap`이 없을 경우의 동작을 주석으로 명시

---

### 요약

변경의 주된 목적인 `@workflow/expression-engine` 패키지 통합, `ExpressionResolverService` 구현, 노드 설정 패널의 `ExpressionInput` 교체, 프론트엔드 자동완성 컴포넌트 구현은 모두 명확히 의도된 범위 내에 있다. 단, `auth.controller.ts`와 `auth.controller.spec.ts`에 기능과 무관한 포맷팅 변경이 혼입되어 있으며, `resolveString`의 혼합 표현식 처리가 스펙 명세와 코드 구현 사이에 불일치가 존재한다. 나머지 변경들은 피처 구현을 위한 필요 변경이나, 일부 설명이 부족하다.

### 위험도

**LOW**