# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: cafe24-mcp-tool-provider.spec.ts

- **[INFO]** `api` assertion 블록이 두 테스트에 동일하게 중복됨
  - 위치: diff +40~+45 (success 케이스), +55~+60 (auth-fail 케이스)
  - 상세: `api: { label: 'cafe24.product.product_list', method: 'GET', path: expect.any(String) }` 객체가 성공 경로와 실패 경로 두 곳에 리터럴로 반복된다. 현재 변경은 2곳뿐이지만, 추후 `CAFE24_TRANSPORT_FAILED` 테스트(line ~893)에도 동일 api assertion 이 추가될 경우 3곳 이상으로 늘어난다. 공통 상수 또는 헬퍼(`expectedApiInfo(operation)`)로 추출하면 operation 명 변경·필드 추가 시 한 곳만 수정하면 된다.
  - 제안:
    ```ts
    const PRODUCT_LIST_API = {
      label: 'cafe24.product.product_list',
      method: 'GET',
      path: expect.any(String),
    } as const;
    // 사용: expect.objectContaining({ ..., api: PRODUCT_LIST_API })
    ```

- **[INFO]** `CAFE24_TRANSPORT_FAILED` 테스트(line ~893)에는 아직 `api` assertion 이 없음
  - 위치: spec 파일 라인 893~899 `logUsage` `toHaveBeenCalledWith` 블록
  - 상세: success 경로와 auth-fail 경로에는 INT-US-05 api assertion 을 추가했으나, transport-fail 경로의 `logUsage` 호출에는 `api` 검증이 없다. 일관성 측면에서 실패 경로 전체가 동일하게 검증되어야 테스트가 spec 을 완전히 커버한다.
  - 제안: transport-fail 테스트의 `expect.objectContaining` 에도 `api` 필드 검증 추가.

- **[INFO]** 테스트 픽스처 상수 `'abcdef1234567890'`, `'ws-1'`, `'exec-1'` 이 파일 전체에 리터럴로 산재
  - 위치: 파일 전체 (`buildTools` / `execute` / `cleanup` describe 블록)
  - 상세: 이미 기존 코드에 존재하는 패턴이므로 이번 diff 가 도입한 문제는 아니다. 다만 이번 diff 의 새 assertion 들도 동일 리터럴을 추가하고 있어 기존 패턴을 강화(amplify)했다. 개선하려면 파일 상단에 `TEST_INTEGRATION_ID = 'abcdef1234567890'` 등 상수를 선언하면 된다. 이번 PR 범위 밖이므로 INFO 등급.

---

### 파일 2: cafe24-mcp-tool-provider.ts

- **[INFO]** `apiInfo` 변수 선언 위치가 early-return guard 블록들 사이에 삽입됨
  - 위치: diff +1171~+1179 (라인 1595~1604)
  - 상세: `opEntry` 검사(early return) 직후, `args` 파싱 전에 `apiInfo` 를 구성하는 흐름은 논리적으로 자연스럽다. 의도가 명확하며 early-return 이후 항상 유효한 `resource`/`operation` 을 갖는 시점임이 보장된다. 읽기 흐름 문제 없음.

- **[INFO]** `apiInfo` 가 `nodeExecutionId && workflowId` guard 안에서만 사용되나 guard 밖에서 선언됨
  - 위치: 라인 1600~1604 (선언) vs 라인 1691, 1722 (사용)
  - 상세: 사용처 2곳 모두 `if (ctx.nodeExecutionId && ctx.workflowId)` 블록 안에 있다. 현재 구조상 apiInfo 는 항상 구성되지만 조건 미충족 시 사용되지 않는다. 이는 guard 블록이 나중에 제거되거나 확장될 경우 자연스럽게 동작하므로 방어적으로 좋은 설계다. 다만 미래 독자가 "왜 guard 밖에서 선언했지?"라고 의문을 가질 수 있어 기존 블록 주석(`// INT-US-05`)이 충분한 맥락을 제공한다. 현 상태로 무방.

- **[INFO]** `apiInfo` 의 타입이 인라인 객체 리터럴로 추론됨 (명시 타입 없음)
  - 위치: 라인 1600~1604
  - 상세: `logUsage` 의 `api` 파라미터 타입이 외부 인터페이스(`IntegrationsService.logUsage`)에 정의되어 있을 것이다. 인라인 리터럴로 타입이 추론되므로 인터페이스 변경 시 TypeScript 컴파일러가 오류를 잡아준다 — 현재 구조로 충분하다. 명시 타입 annotation 이 있으면 더 가독성이 높아질 수 있으나 필수 아님.

- **[WARNING]** `execute()` 메서드 내 `logUsage` 호출 패턴이 success 경로와 fail 경로에서 미묘하게 비대칭
  - 위치: 라인 1691~1707 (success, `await` 직접), 라인 1722~1732 (fail, `.catch(() => undefined)` 후처리)
  - 상세: 이번 diff 가 도입한 문제는 아니고 기존 코드의 패턴이지만, `api: apiInfo` 추가로 두 블록이 더 유사해 보이면서 차이(success 는 `await`, fail 은 `fire-and-forget .catch`)가 오히려 눈에 잘 안 띈다. 유지보수 중 한쪽만 수정하고 나머지를 누락하는 회귀 위험이 있다. 두 블록을 `logUsageResult(status, error, apiInfo)` 같은 내부 헬퍼로 추출하거나, 최소한 `// NOTE: success 는 await, fail 은 fire-and-forget` 주석으로 의도 차이를 명시하면 좋다.
  - 제안: 두 `logUsage` 호출을 private 헬퍼로 통합하거나, 기존 비대칭 이유를 설명하는 주석 한 줄 추가.

---

### 파일 3: plan/in-progress/cafe24-mcp-usage-api.md

- **[INFO]** Plan 문서의 구조와 frontmatter 가 프로젝트 규약을 준수하며 변경 범위, 원인, 단계가 명확히 기술됨. 가독성 우수.

---

## 요약

이번 변경은 `cafe24-mcp-tool-provider.ts` 의 `execute()` 에서 `opEntry` destructure 를 `{ operation }` 에서 `{ resource, operation }` 으로 확장하고, `apiInfo` 객체를 구성해 성공·실패 양쪽 `logUsage` 호출에 전달하는 단순하고 집중된 버그픽스다. 함수 길이·중첩 깊이·순환 복잡도 모두 기존 대비 변화 없이 최소 수정 원칙을 잘 지켰다. 주요 유지보수성 우려는 두 가지: (1) 테스트의 `api` assertion 객체 리터럴 중복 — 현재는 2곳이지만 `CAFE24_TRANSPORT_FAILED` 등 추가 경로 검증 시 3곳 이상으로 늘어날 수 있어 상수 추출을 권고하며, (2) `execute()` 내 success/fail `logUsage` 호출이 비대칭(await vs fire-and-forget)한데 두 블록이 이제 더 유사해 보여 실수 가능성이 높아졌다 — 헬퍼 추출 또는 주석 보완이 적절하다. 전반적으로 코드의 의도가 명확하고 네이밍 일관성(노드 핸들러와 동일한 `cafe24.<resource>.<operation>` 형식)도 잘 유지됐다.

## 위험도

LOW
