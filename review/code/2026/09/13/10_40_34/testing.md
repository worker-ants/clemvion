# 테스트(Testing) 리뷰

## 검토 방법

프롬프트가 절단한 파일(`llm-model-config.controller.spec.ts`·`guide-error-code-scan.ts`·
`guide-error-code-existence.test.ts`·`response-contract.ts`·`plan/in-progress/guide-error-code-truth.md`
등)은 `Read`/`Grep` 으로 저장소 원본을 직접 열어 확인했다. 이 배치는 `review/code/.../10_12_19`
라운드(같은 워크트리에 이미 커밋됨)의 재검토 대상이라, 그 라운드의 `testing.md` 를 먼저 읽고
지적이 실제로 처리됐는지를 축으로 삼았다.

핵심 스위트를 직접 실행해 GREEN 을 실측했다(저장소 파일은 뮤테이션하지 않음, `git status --short`
클린 확인):

- backend: `npx jest src/modules/llm/llm.service.spec.ts src/modules/llm/llm-model-config.controller.spec.ts` → **66/66 통과**
- frontend: `npx vitest run guide-error-code-existence.test.ts guide-sanitized-message-parity.test.ts model-configs.test.ts model-config-manager.test.tsx` → **54/54 통과**

## 발견사항

- **[INFO] (직전 라운드 WARNING 해소 확인) UI 실패 경로 테스트 공백이 정확히 채워졌다**
  - 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` — `"failed test surfaces the reason in the toast (not an empty suffix)"`(신규) + `"[대조군] 사유 필드가 비면 토스트 접미도 빈다"`(신규)
  - 상세: `review/code/2026/09/13/10_12_19/testing.md` W#1 이 지목한 자리(`model-config-manager.tsx:83` 의 `result.message ?? ""` — 이 PR 이 고친다고 주장하는 사용자 증상의 마지막 렌더링 지점)에 정확히 실패 케이스가 추가됐다. `toEqual`/`toHaveBeenCalledWith` 가 아니라 **정확 문자열**(`"Connection failed: Authentication failed. Please check your API key."`)을 단언하고, 사유가 없는 경우(`{ success: false }`)의 대조군까지 별도 `it` 로 분리해 "느슨한 `stringContaining` 이었다면 버그가 있어도 통과했다" 는 사실을 코드로 남겼다. 회귀 방지 체인(백엔드 wire → API 클라이언트 픽스처 → UI 토스트) 세 층이 이제 전부 닫혔다.
  - 제안: 없음(확인용 기록).

- **[WARNING] 이번 PR 이 함께 고친 형제 DTO(`TestConnectionResultDto`, integrations)는 `code` 필드 선언 추가·`meta`/`latencyMs` 제거를 검증하는 테스트가 하나도 없다 — 같은 PR 이 LLM 쪽에 배선한 것과 똑같은 결함 클래스가 이 파일에는 무방비로 남는다**
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`(`TestConnectionResultDto`, 게이트 456행대) — 소비 서비스 `codebase/backend/src/modules/integrations/integrations.service.ts` (`testConnection`)
  - 상세: 실측(`grep -rln "assertMatchesContract" codebase/backend/src`) 결과 `assertMatchesContract`/`contractForDto` 는 `llm.service.spec.ts`·`llm-model-config.controller.spec.ts`·`model-config-response.dto.ts`·`execution-response.dto.spec.ts` 4곳에만 배선돼 있고 `integrations` 모듈에는 0건이다. `integrations.controller.spec.ts` 자체가 존재하지 않아(`find ... -iname "*.controller.spec.ts"` → `third-party-oauth.controller.spec.ts` 만 있음) HTTP 왕복 테스트도 없다. `integrations.service.spec.ts` 는 `toEqual({ success, message, code })` 로 **서비스 반환값**을 정확히 고정하고 있지만(양호), 그 값이 방금 갱신된 **DTO 선언**과 일치하는지 대조하는 계층이 없다. 즉 이번 PR 이 `ModelTestConnectionResultDto`(LLM)에 대해서는 정확히 "선언 vs 값" 불일치가 재발하면 즉시 RED 가 뜨도록 `contractForDto`를 배선했는데(`llm-model-config.controller.spec.ts:227-230`, `:257-260`), 같은 PR 이 `code` 를 새로 선언하고 `meta`/`latencyMs` 를 제거한 형제 DTO 는 그 배선이 빠진 채로 남는다 — 누군가 `meta`(생산자 0건, 이번에 제거됨)를 되살리거나 `code` 를 리네임해도 이 스위트는 계속 GREEN 이다.
  - 제안: `integrations.service.spec.ts` 또는 신규 `integrations.controller.spec.ts` 에 `assertMatchesContract(result, await contractForDto(TestConnectionResultDto))` 한 줄을 최소 1곳(대표 실패 케이스, 예: `CAFE24_AUTH_FAILED` 반환 지점)에 배선한다. plan 체크리스트가 이미 이 DTO 를 "부분 고침"(`code` 선언 추가, MCP 전용 3필드는 별도 트래커)으로 기록해 뒀으므로, 이 항목은 그 후속으로 등재하기 적합하다.

- **[INFO] `message: null` 경계값이 UI 토스트 테스트에 없다**
  - 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` (신규 두 `it`, 478행대·505행대) — DTO 선언은 `message?: string | null`(`model-config-response.dto.ts`)
  - 상세: 신규 테스트는 `message` 가 문자열인 경우와 **필드 자체가 생략된**(`{ success: false }`, `undefined`) 경우만 다룬다. DTO 가 명시적으로 허용하는 `message: null` (`nullable: true`) 조합은 어느 층에서도 별도로 단언되지 않는다. `result.message ?? ""` 는 `??` 연산자 특성상 `null`/`undefined` 를 동일하게 처리하므로 실제 동작은 이미 안전할 가능성이 높지만, 그 사실이 대조군으로 코드에 고정돼 있지는 않다.
  - 제안: 급하지 않음 — 원하면 대조군 `it` 에 `message: null` 케이스를 하나 추가해 `??` 처리 경계를 명시적으로 고정할 수 있다.

## 잘된 점 (참고, 회귀 없음 확인)

- `llm-model-config.controller.spec.ts` 의 신규 HTTP 왕복 `describe` 는 실제 `LlmService`(mock 아님)를 DI 하고 전역 `TransformInterceptor` 까지 태워 "필드 이름 축에서 vacuous 해지는" 함정을 피했다. 성공/실패 각각 `assertMatchesContract` + 문자열 정확 단언 + `Object.keys(...).sort()` 전수 키 비교를 3중으로 걸고, 그 각각이 무엇을 가르는지 4가지 뮤턴트 표로 주석에 남겨 재현 가능한 근거를 제공한다.
- `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`: vacuity floor(코퍼스 크기·토큰 수 하한, 두 root 각각 별도 단언), 축별 최소 후보 수, 회귀 고정 케이스(discord 문서), 베이스라인 0 을 분리된 `it` 로 나눠 "스캐너가 조용히 `[]` 를 반환해도 GREEN" 함정을 차단한다. 별도 `describe("scanErrorCodeCitations — 축별 대조군")` 는 채택/비대상 양쪽을 합성 입력으로 명시하고, 여러 줄 `<FieldTable>` 이 놓친다는 **경계 자체를 대조군으로 고정**해(이전 라운드 INFO#9 정확히 해소) 다음 사람이 "왜 안 걸렸지" 를 추적할 필요가 없게 했다.
- 신규 `guide-sanitized-message-parity.test.ts`: SoT(`sanitize-error.util.ts`)에서 정규식으로 8개 반환 리터럴을 실제로 추출해 "8건" vacuity floor 로 추출 실패 방향을 먼저 막고, `models{,.en}.mdx` 표와 **양방향**(표→SoT 고아 검사, SoT→표 누락 검사) 대조한다 — 부분집합 단언만으로는 "행 삭제" 편집이 조용히 통과하는 함정을 정확히 인지하고 피했다.
- `model-configs.test.ts`: 지어낸 `latencyMs: 120` 픽스처를 실재 생산 필드 `dimension` 으로 교체 — "픽스처가 곧 커버리지" 함정(생산자 0건인 값으로 "통과"를 주장)을 스스로 인지하고 고친 사례.
- `llm.service.spec.ts`: 필드 리네임(`error`→`message`)에 맞춰 기존 4개 단언이 정확히 갱신됐고, 신규 `assertMatchesContract` 케이스가 "리네임 자체"와 "선언과 일치하는가"를 의도적으로 분리해 검증한다 — 기존 회귀 테스트가 손상 없이 최신 계약을 반영한다.
- Mock/격리: `model-config-manager.test.tsx` 는 `describe` 별 `beforeEach(vi.clearAllMocks)` + `afterEach(cleanup)` 로 테스트 간 상태 누수가 없고, `llm.service.spec.ts` 는 매 `beforeEach` 마다 `mockClient`/`mockModelConfigService` 를 새로 만들어 독립적이다.

## 요약

직전 라운드(`10_12_19`)의 유일한 Testing WARNING(UI 토스트 실패 경로 무테스트)이 정확 문자열 단언 +
대조군으로 정밀하게 해소됐고, 신규 가드 두 종(`guide-error-code-existence`·
`guide-sanitized-message-parity`)은 vacuity floor·축별 대조군·양방향 대조를 갖춰 이 저장소 평균
이상의 테스트 설계를 보인다. 직접 실행한 핵심 스위트(backend 66/66, frontend 54/54)도 모두
GREEN 이다. 다만 이번 PR 이 같은 손으로 함께 고친 형제 DTO(`TestConnectionResultDto`, integrations
모듈 — `code` 신규 선언·`meta`/`latencyMs` 제거)에는 이 PR 이 LLM 쪽에 정확히 배선한 것과 동일한
런타임 계약 검사(`assertMatchesContract`)가 빠져 있어, 같은 결함 클래스(선언 vs 실제 생산 불일치)가
재발해도 잡히지 않는다 — 이 PR 의 스코프를 벗어나 블로킹 사유는 아니지만 후속으로 채워야 할 유일한
실질 공백이다.

## 위험도

LOW
