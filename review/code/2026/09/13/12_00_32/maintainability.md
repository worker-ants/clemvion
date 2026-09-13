# 유지보수성(Maintainability) 리뷰

## 검토 범위

`origin/main` 대비 `codebase/` 21개 파일(851 insertions / 61 deletions) 전수 확인. 핵심 로직
변경은 다음 6개이며 나머지는 테스트·MDX 문서 미러:

- `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection` 반환 필드 `error`→`message` 리네임 + JSDoc 보강
- `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`,
  `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — 미발행 필드 제거(`latencyMs`, `meta`) / 미선언 필드 추가(`code`)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (신규, 184줄) — 순수 스캐너 함수 2개
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (신규, 189줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규, 73줄)

프롬프트에서 diff 가 생략된 파일(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`,
`llm-model-config.controller.spec.ts`, `plan/in-progress/guide-error-code-truth.md`)은 `Read` 로
원본을 직접 열어 대조했다.

## 발견사항

- **[INFO]** 신규 스캐너의 `CODE_CONTEXT` 정규식이 한 줄에 9개 대안(영·한 혼용)을 담은 채 축약돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:105` (`CODE_CONTEXT` 상수 선언부)
  - 상세: `/error\.code|error code|에러 코드|\bfail(?:s|ed|ure)?\b|실패|\berror\b|오류|timed out|시간 초과|rate limit|요청 한도|returns \d{3}/i` 는 대안이 늘어날수록 한눈에 읽기 어려워진다. 다만 바로 위(90~103줄)에 왜 이 술어를 골랐는지·무엇을 일부러 놓치는지를 표와 실측치로 상세히 설명한 주석이 있어 당장의 가독성 손실은 크게 상쇄된다.
  - 제안: 지금 규모(대안 11개)에서는 조치 불요. 축이 더 늘어나면(예: 새 언어 어휘 추가) `CODE_CONTEXT_TERMS: string[]` 배열 + `.join("|")` 형태로 바꿔 개별 항목에 주석을 달 수 있게 하는 편이 유지보수에 유리하다.

- **[INFO]** `llm.service.spec.ts` 의 실패-사유 테스트 5건이 문자열만 다른 동일 구조를 반복한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` — 이번 diff 가 손댄 5개 `it` 블록(`mockClient.testConnection.mockRejectedValue(...)` → `expect(result).toEqual({ success: false, message: ... })` 패턴, `error:`→`message:` 리네임 대상)
  - 상세: 이번 PR 은 이 5곳 전부를 한 글자(`error`→`message`)만 바꾸며 통과했다. 구조 자체는 이 diff 가 새로 만든 것이 아니라 기존 패턴을 그대로 유지한 것이므로 이 PR 이 만든 결함은 아니다. 다만 5곳 모두를 어차피 건드리는 김에 `test.each`로 파라미터화했다면 향후 여섯 번째 sanitize 문구가 추가될 때 반복을 줄일 기회였다.
  - 제안: 지금 당장 리팩터를 요구할 정도는 아니다(기존 관례 유지가 더 안전한 선택일 수 있음). 다음에 이 목록에 항목을 추가할 일이 생기면 `test.each` 전환을 고려할 것.

- **[INFO]** DTO 주석이 필드 선언보다 훨씬 길다(코드:주석 비율 낮음)
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `TestConnectionResultDto` 클래스(`code`·`meta` 필드 주변, 약 460~488줄)
  - 상세: `code?: string` 한 줄짜리 필드 선언에 12줄의 "왜 이렇게 됐는가" 서사 주석이 붙는다. 다만 같은 스타일(실측 근거를 소스에 남기는 서사형 주석)이 `schedules/dto/responses/schedule-response.dto.ts`·`workspaces/dto/responses/workspace-response.dto.ts` 등 기존 DTO 여러 곳에서 이미 확인되는 저장소 관례라, 이번 PR 이 새로 만든 이탈은 아니다. 확인 목적으로만 기록.
  - 제안: 관례를 바꿀 필요 없음. 다만 같은 DTO 에 이런 서사 주석이 계속 누적되면(이번이 이미 두 번째 필드) 파일이 무거워지므로, 세 번째 유사 사례가 생기면 `spec/*/…md`의 Rationale 섹션이나 CHANGELOG 로 옮기는 것을 재검토할 만하다(RESOLUTION.md 가 이미 "두 유사 DTO 통합은 세 번째 유사 결함 시 재검토"라고 스스로 적어 둔 것과 같은 결의 지적).

- **[INFO]** 두 개의 `TABLE_HEADER_WITH_CODE`/`CODE_CONTEXT` 처럼 이름이 유사한 상수가 서로 다른 판정 축(줄 신호 vs 표 헤더)을 담당
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:104`, `:116`
  - 상세: 실제로 혼동을 일으킬 정도는 아니다 — 각 상수 위에 축 번호(1/2/3/3′)와 역할을 명시한 JSDoc 이 붙어 있고, 사용처(`scanErrorCodeCitations`)에서도 역할이 분명히 갈린다. 결함이 아니라 관찰 기록.

발견된 CRITICAL/WARNING 수준의 유지보수성 결함은 없다.

## 긍정적으로 확인한 점 (참고)

- `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` 는 순수 함수(`scanErrorCodeCitations`, `collectBackendTokens`) + 얇은 테스트 계층으로 관심사가 잘 분리돼 있고, 함수 길이·중첩 깊이 모두 적정 수준(최대 15줄 내외, 2단 중첩)이다.
- 매직 넘버(`50`, `500`, `800` 등 vacuity-floor 임계값)마다 실측치를 주석으로 병기해 "왜 이 숫자인가"가 코드에 남아 있다.
- 라운드 1 리뷰에서 지적된 이름(`files`→`fileTexts`)과 JSDoc 위치(파라미터 목록 안 → 함수 상단) 문제가 현재 소스에 정확히 반영돼 있음을 직접 확인했다.
- `error`→`message` 리네임이 서비스·DTO·프런트 API 클라이언트·문서(6개 MDX) 전 층에 걸쳐 누락 없이 반영됐다(잔존 참조 grep 0건).

## 요약

이번 변경은 응답 필드명 정정(`error`→`message`)과 죽은 DTO 필드 정리, 그리고 그 계약을 지키는 신규 정적 가드 2종·계약 검증 테스트 추가로 구성된다. 신규 코드(스캐너·가드 테스트)는 함수가 짧고 책임이 분리돼 있으며, 판정 근거(어떤 축을 왜 선택/기각했는지, 무엇을 일부러 놓치는지)를 코드 인접 주석에 실측치와 함께 남겨 다음 사람이 같은 조사를 반복하지 않도록 설계돼 있다. 정규식이 다소 길고 DTO 주석이 필드 선언보다 긴 지점이 있지만 전자는 충분한 설명 주석으로, 후자는 기존 저장소 관례와의 일관성으로 상쇄된다. 위에 적은 항목은 모두 INFO 수준의 관찰이며 즉시 조치가 필요한 사안은 없다.

## 위험도

NONE
