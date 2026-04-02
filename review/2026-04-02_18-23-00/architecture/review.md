### 발견사항

---

**[INFO]** 공유 패키지(`@workflow/expression-engine`)를 별도 로컬 패키지로 분리
- 위치: `backend/package.json`, `frontend/package.json`
- 상세: 표현식 엔진을 `packages/expression-engine`으로 추출하여 프론트/백엔드가 공유하는 구조는 아키텍처적으로 올바른 방향. 단, 루트 `package.json`에 `workspaces` 설정 없이 `file:` 참조만 사용하는 구조는 일반적인 monorepo 관리 도구(npm/pnpm workspaces, Nx, Turborepo)의 이점을 살리지 못함.
- 제안: 루트에 `package.json`을 두고 `workspaces: ["backend", "frontend", "packages/*"]`를 설정하거나, Turborepo 같은 monorepo 툴을 도입하여 빌드 캐싱 및 의존성 그래프 관리를 체계화하는 것을 검토할 것.

---

**[WARNING]** `ExpressionResolverService.resolveString()` 내 타입 보존 로직 버그
- 위치: `expression-resolver.service.ts` — `resolveString()` 메서드
- 상세: 스펙(§5.3)은 "전체가 `{{ expr }}`인 경우 평가 결과의 원래 타입 유지, 혼합 텍스트 + 표현식의 경우 string"으로 명시하지만, 현재 구현은 두 경우 모두 `evaluate()`의 반환값을 그대로 반환한다. `evaluate()`가 이미 `string` interpolation을 내부에서 처리한다면 정상이지만, full-expression 분기(`FULL_EXPRESSION_PATTERN.test`)와 mixed 분기가 동일한 코드를 실행하므로 분기 자체가 의미 없다.
  ```ts
  // 두 분기가 동일하게 result를 반환함
  if (FULL_EXPRESSION_PATTERN.test(value)) {
    return result; // ← same
  }
  return result;   // ← same
  ```
- 제안: `evaluate()`가 타입 보존과 문자열 변환을 구분하지 않는다면, mixed 분기에서는 `String(result)`로 명시적 변환이 필요. 또는 `evaluate()`가 이를 처리한다면 분기를 제거하고 주석으로 의도를 문서화할 것.

---

**[WARNING]** `buildExpressionContext()`에서 `startedAt`이 항상 현재 시각으로 고정
- 위치: `expression-resolver.service.ts:38`
- 상세: `$execution.startedAt`을 `new Date().toISOString()`으로 생성하면 실제 실행 시작 시각이 아닌 표현식 해석 시각이 반영된다. `ExecutionContext`에 `startedAt` 필드가 없어서 임시로 채운 것으로 보이나, 표현식에서 `$execution.startedAt`을 사용하는 노드는 잘못된 값을 받는다.
- 제안: `ExecutionContext` 인터페이스에 `startedAt: string` 필드를 추가하거나, `Execution` 엔티티에서 값을 주입받아 전달할 것.

---

**[WARNING]** `depth > MAX_DEPTH`에서 원본 객체(`obj`)를 그대로 반환 — 표현식 미해석 데이터 누출
- 위치: `expression-resolver.service.ts` — `resolveObject()` 메서드
- 상세: 깊이 초과 시 `return obj`는 원본 config 객체를 그대로 노드 핸들러에 전달하게 되어, 미해석된 `{{ }}` 표현식 문자열이 실행 시스템에 노출된다. 심층 구조를 가진 config(예: JSON Schema를 포함한 AI 노드)에서 예상치 못한 동작을 유발할 수 있다.
- 제안: 깊이 초과 시 빈 객체 반환 대신 `Warning` 로깅 후 그대로 반환하는 현재 방식은 유지하되, 로그를 남겨서 추적 가능하게 할 것. 또는 초과 시 에러를 던져서 명시적으로 실패시키는 방법도 고려.

---

**[INFO]** `ExpressionInput`의 highlight overlay가 `multiline` 모드에서 비활성화됨
- 위치: `expression-input.tsx:165`
- 상세: `{hasExpression && !multiline && (...)}` 조건으로 textarea에는 하이라이트 오버레이가 표시되지 않는다. 스펙(§8.4.1)은 multiline 입력에도 `{{ }}` 블록 하이라이트를 요구하고 있으나 현재 미구현 상태.
- 제안: multiline textarea에도 동일한 하이라이트 오버레이를 적용하거나, 스펙에 textarea 제외 사유를 명시할 것. (기술적 난이도는 있으나 contenteditable 기반으로 교체하는 것이 근본 해결책)

---

**[INFO]** `expression-exclusions.ts`가 단순 상수 파일로 서비스와 분리
- 위치: `expression-exclusions.ts`
- 상세: 제외 규칙을 별도 파일로 분리한 것은 OCP(개방-폐쇄 원칙)에 부합하며 신규 핸들러 추가 시 이 파일만 수정하면 된다. 다만 현재 `Set<string>`의 하드코딩 방식은 향후 핸들러가 자신의 제외 키를 선언하는 방식(핸들러 인터페이스에 `excludeConfigKeys?` 프로퍼티 추가)으로 발전시키면 더 높은 응집도를 달성할 수 있다.
- 제안: 단기적으로는 현 구조 유지. 장기적으로는 `NodeHandler` 인터페이스에 `excludeConfigKeys?: Set<string>`을 추가하여 핸들러가 스스로 제외 키를 선언하도록 리팩터링 고려.

---

**[INFO]** `frontend/package.json`의 `build` 스크립트에 `--webpack` 플래그 추가
- 위치: `frontend/package.json:8`
- 상세: `next build --webpack`은 Turbopack 대신 Webpack을 강제 사용하게 한다. `transpilePackages`로 로컬 패키지를 처리할 때 Turbopack의 호환성 문제를 우회하기 위한 것으로 추정되나, 이는 임시 조치이며 프로덕션 빌드 성능에 영향을 준다.
- 제안: Next.js 버전 업데이트 후 Turbopack과의 호환성을 재검토하거나, 로컬 패키지를 빌드 후 배포하는 방식으로 전환 시 이 플래그를 제거할 것.

---

**[INFO]** `use-expression-context.ts`에서 다중 입력 엣지 처리가 미완성
- 위치: `use-expression-context.ts:57-61`
- 상세: 입력 엣지가 2개 이상인 경우 `inputFields`에 source 노드 ID만 push하고 있다. 이는 `$input.` 자동완성에서 의미 없는 UUID를 제안하게 된다.
- 제안: 다중 입력의 경우 각 소스 노드의 출력 필드를 합집합으로 제공하거나, 스펙에 다중 입력 노드의 `$input` 구조를 정의하여 이에 맞게 자동완성 로직을 구현할 것.

---

### 요약

이번 변경은 표현식 엔진을 공유 패키지로 분리하고, 백엔드 실행 엔진에 표현식 해석 레이어를 삽입하며, 프론트엔드 에디터에 Expression-aware 입력 컴포넌트를 도입하는 체계적인 아키텍처 개선이다. 전체적으로 레이어 분리와 모듈 경계가 명확하며, `ExpressionResolverService`의 단일 책임 설계와 제외 규칙의 외부화는 OCP를 잘 준수한다. 다만 `resolveString()`의 타입 보존 분기 버그, `$execution.startedAt` 부정확한 값 주입, 깊이 초과 시 미해석 데이터 누출 등 런타임 정확성에 영향을 주는 몇 가지 구현 오류가 존재하며, monorepo 워크스페이스 관리 미비와 `--webpack` 강제 플래그는 장기적 기술 부채 요소다.

### 위험도

**MEDIUM**