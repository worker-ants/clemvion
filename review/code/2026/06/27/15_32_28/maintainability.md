# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`

- **[WARNING] `ParseEnumPipe` 에 raw 배열 전달 — 기존 코드베이스 패턴과 불일치**
  - 위치: 라인 127–128 (`listModels` `@Query` 파라미터)
  - 상세: 동일 코드베이스에서 `ParseEnumPipe` 의 유일한 선행 사례인 `auth.controller.ts` 는 `OAUTH_PROVIDER_ENUM`을 `Record<string, string>` 으로 구성한 뒤 전달한다(`AUTH_OAUTH_PROVIDERS.reduce(…, {})`). 이번 변경은 `['chat', 'embedding']` 이라는 일반 배열을 그대로 전달한다. NestJS `ParseEnumPipe` 의 내부 구현이 `Object.keys(enumType).map(k => enumType[k])` 로 동작하기 때문에 결과적으로는 동작하지만, 이는 NestJS 의 비공개 내부 동작(numeric index key)에 의존하는 암묵적 경로이며 공식 API 계약은 `Record<string, any>` 를 기대한다. 기존 패턴과 달리 배열을 넘기는 이유가 주석이나 선례 없이 도입되어, 후속 작성자가 패턴을 따라야 하는지 판단하기 어렵다.
  - 제안: 기존 패턴(`{ chat: 'chat', embedding: 'embedding' }` 형태의 `Record<string, string>` 상수)을 활용하거나, 아래 INFO(타입-런타임 이중 선언 제거)와 결합해 단일 소스 상수를 추출한다.
    ```typescript
    const MODEL_TYPE_ENUM = { chat: 'chat', embedding: 'embedding' } as const;
    type ModelType = keyof typeof MODEL_TYPE_ENUM; // 'chat' | 'embedding'
    // @Query('type', new ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true }))
    // type?: ModelType,
    ```

- **[INFO] 타입 선언과 런타임 배열이 독립적 — 단일 소스 부재**
  - 위치: 라인 81 (이전 버전 `'chat' | 'embedding'`) / 라인 127–128 (`['chat', 'embedding']`)
  - 상세: TypeScript 타입 `'chat' | 'embedding'` 과 `ParseEnumPipe` 에 넘기는 `['chat', 'embedding']` 배열은 개념상 동일한 허용값 집합이지만 코드에서 두 곳에 독립적으로 선언된다. 타입이 갱신될 때 배열, 또는 그 반대를 놓칠 수 있다.
  - 제안: 위 WARNING 제안의 `MODEL_TYPE_ENUM` 상수 하나로 `keyof typeof` 타입과 파이프 인자를 동시에 파생시켜 DRY 를 달성한다.

- **[INFO] `PROVIDER_PROBE_THROTTLE` 내부 키 순서가 코드베이스 관례와 반전**
  - 위치: 라인 39 (`const PROVIDER_PROBE_THROTTLE = { default: { limit: 10, ttl: 60_000 } }`)
  - 상세: 코드베이스 전체(`auth.controller.ts` L107/176/194/427/462, `sessions.controller.ts` L79/125, `invitations.controller.ts`, `integrations.controller.ts` 등)는 일관되게 `{ ttl: 60_000, limit: … }` 순서(ttl 선행)를 사용한다. 이 상수만 `{ limit: 10, ttl: 60_000 }` 으로 역전되어 있다. 런타임 동작에는 무관하나 패턴 스캔 시 눈에 걸린다.
  - 제안: `{ default: { ttl: 60_000, limit: 10 } }` 로 순서 통일.

- **[INFO] `PROVIDER_PROBE_THROTTLE` 상수 추출은 새로운 DRY 패턴이나 코드베이스 미확산 상태**
  - 위치: 라인 39, 60, 79, 102 (3개 핸들러 `@Throttle` 참조)
  - 상세: 다른 컨트롤러(`auth`, `sessions`, `integrations`, `knowledge-base`)는 모두 인라인 객체 리터럴을 사용한다. `PROVIDER_PROBE_THROTTLE` 방식은 같은 정책을 공유하는 핸들러가 3개 이상일 때 매우 합리적인 DRY 패턴이며, 코멘트로 의도도 명확히 설명되어 있다. 이 패턴을 다른 컨트롤러에도 적용할지를 팀 컨벤션으로 명시하면 이후 일관성 유지가 용이해진다.
  - 제안: 채택 또는 보류 모두 무방하나, "같은 값이 N회 이상 반복될 때 상수화" 기준을 컨벤션에 명시해 두면 향후 판단이 쉬워진다.

---

### 파일 2: `plan/complete/web-chat-loader-queue-replay-arguments.md`

발견사항 없음. `spec_impact: []` → `spec_impact: none` 는 frontmatter 스키마 정합 수정으로, 유지보수성에 영향을 주지 않는다.

---

### 파일 3: `plan/in-progress/refactor/02-architecture.md`

발견사항 없음. PR 번호·머지 커밋 해시 추가는 계획 문서의 상태 추적 갱신이며 코드 유지보수성과 무관하다.

---

## 요약

이번 변경의 핵심은 `PROVIDER_PROBE_THROTTLE` 상수 추출과 `ParseEnumPipe` 도입 두 가지다. 상수 추출은 3개 핸들러에 흩어진 동일 객체 리터럴을 하나의 명명된 진실로 수렴시켜 스로틀 정책 변경 시 단일 지점만 수정하면 되도록 만든 명확한 개선이며, 설명 주석도 잘 갖춰져 있다. `ParseEnumPipe` 도입은 쿼리 파라미터 입력 검증을 추가해 방어성을 높였으나, 동일 코드베이스의 선행 패턴(`Record<string, string>` 구성)과 달리 raw 배열을 넘기는 방식이 채택되어 일관성이 깨졌고, 타입 선언과 런타임 배열이 두 곳에 독립적으로 존재하는 DRY 위반도 남아 있다. 상수 키 순서의 미세 반전과 합쳐서 경미한 수준이지만 후속 작성자의 패턴 판독을 어렵게 하는 요소들이다. 플랜 파일 변경은 유지보수성과 무관한 상태 기록이다.

## 위험도

LOW
