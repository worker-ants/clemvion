# Testing Review — M-8 1단계 review fix

리뷰 대상: `refactor(triggers): M-8 1단계 review fix — triggersApi 유닛 테스트 + 타입/문서 강화`
커밋: `ac804f2a4510631b552dcbd96fa6d7a2dc2a91c8`
생성일: 2026-06-23

---

### 발견사항

- **[INFO]** `triggersApi.list` — `totalItems` 필드 미검증
  - 위치: `triggers.test.ts` L34–51 (`triggersApi.list` describe block)
  - 상세: 페이지 응답 정규화 테스트에서 `result.items` 길이와 `result.totalPages` 만 검증하고 `result.totalItems` 는 확인하지 않는다. `normalizePagedResponse` 는 `pagination.totalItems` 를 별도로 처리하므로 `list` wrapper 수준에서 end-to-end 필드 완전성을 검증하는 편이 낫다.
  - 제안: 첫 번째 list 케이스에 `expect(result.totalItems).toBe(...)` 한 줄 추가.

- **[INFO]** `triggersApi.list` — `page` 필드가 정상 응답(envelope)에서도 올바르게 채워지는지 검증 없음
  - 위치: `triggers.test.ts` L34–44
  - 상세: bare-array fallback 케이스에서는 `result.page` 를 검증하지만, 정상 envelope 케이스에서는 `result.page` 검증이 없다. `normalizePagedResponse` 자체 테스트(`paginated.test.ts`)가 이를 커버하나, `list` 함수가 `normalizePagedResponse` 를 올바른 인수로 호출하는지는 integration 관점에서 누락된 단언이다.
  - 제안: 첫 번째 list 테스트에 `expect(result.page).toBe(2)` 추가.

- **[INFO]** 에러 전파(네트워크 에러) 테스트 부재
  - 위치: `triggers.test.ts` 전체
  - 상세: `model-configs.test.ts` 에는 `getMock.mockRejectedValue(new Error("network error"))` 패턴으로 에러 전파를 명시적으로 검증하는 케이스가 있으나(`L122–126`), `triggers.test.ts` 에는 어떤 함수에 대해서도 에러 전파 테스트가 없다. `triggersApi` 함수들은 에러를 직접 처리하지 않으므로 현재 동작과 불일치하지는 않지만, 관례상 한 케이스 이상은 포함하는 것이 바람직하다.
  - 제안: 대표 함수 1개(예: `list`)에 `getMock.mockRejectedValue` 케이스를 추가해 관례와 일치시킨다.

- **[INFO]** `rotateNotificationSecret` / `revokeInteractionToken` — 이중 envelope 의 `undefined.data` 접근 예외 경우 미커버
  - 위치: `triggers.test.ts` L131–156; `triggers.ts` L169 (`return res.data.data`)
  - 상세: `res.data.data` 패턴에서 `res.data` 가 `null` 또는 `data` 키가 없는 응답(예: 서버 오류 후 200 OK + 빈 바디)이 오면 런타임 TypeError 가 발생한다. 현재 테스트는 정상 경로(happy path)만 커버한다. 이 경우는 실제 발생 가능성이 낮으나, M-8 2단계의 Zod 검증 도입 전까지 잠재 회귀 경로로 남는다.
  - 제안: 현 단계에서 즉시 수정 필요 수준은 아니나, M-8 2단계에서 Zod 도입 시 함께 커버할 것을 권고.

- **[INFO]** `rotateBotToken` — 응답 검증 없음 (void 반환이지만 일관성 부재)
  - 위치: `triggers.test.ts` L154–161
  - 상세: `rotateBotToken` 테스트는 POST URL·body 만 검증하고 결과값은 검증하지 않는다. `void` 반환이므로 결과 단언은 불필요하지만, `create` / `update` 케이스와 구조적으로 동일하므로 불일치는 없다. 의도적 생략이면 주석으로 명시하면 더 명확하다.
  - 제안: 필요 없으면 그대로 두되, `// void — no return value to assert` 주석을 추가해 의도를 명확히.

- **[INFO]** `page.tsx` 변경사항에 대한 테스트 없음 (추가 주석만)
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` L226–229
  - 상세: 이번 변경은 `/workflows` useQuery 에 설명 주석을 추가하는 것뿐이므로 동작 변경이 없고 테스트 추가는 불필요하다. 기존 `triggers-page.test.tsx` 의 회귀 가능성도 없다.
  - 제안: 조치 불필요.

- **[INFO]** `beforeEach` 위치 — 최상위 레벨에 단일 선언
  - 위치: `triggers.test.ts` L29
  - 상세: `beforeEach(() => vi.clearAllMocks())` 가 최상위 스코프에 선언되어 있어 모든 describe 블록에 적용된다. `model-configs.test.ts` 는 각 describe 블록 내부에 별도 `beforeEach` 를 선언하는 패턴을 사용한다. 현재 방식도 정상 동작하며 모든 mock 을 클리어하므로 격리 문제는 없으나, 관례 통일 측면에서 `model-configs.test.ts` 패턴을 따르면 더 일관성 있다.
  - 제안: 스타일 권고 수준. 필수 변경 아님.

---

### 요약

이번 변경의 핵심 산출물인 `triggers.test.ts` 는 12개 테스트로 `triggersApi` 의 핵심 경로를 잘 커버한다. `getById` workflow 평탄화 4-way, 이중 envelope 언래핑, bare-array fallback 등 이전 리뷰가 지적한 커버리지 갭을 모두 채웠다. `model-configs.test.ts` 관례를 충실히 따랐으며, mock 선언 순서(모듈 호이스팅 전)·`vi.clearAllMocks` 격리·fakeAxios helper 재사용 모두 적절하다. 발견사항은 전부 INFO 수준으로, `totalItems` 단언 누락·에러 전파 케이스 부재·이중 envelope 예외 경로 미커버가 소규모 보완 기회로 남아 있으나 현 12개 테스트가 행동 계약을 충분히 표현한다. `page.tsx` 는 주석 추가만이므로 회귀 위험 없다.

### 위험도

LOW
