# Architecture Review — guide-error-code-truth

## 발견사항

- **[INFO]** 레이어 간 명명 불일치를 런타임 계약 검사로 고정한 것은 올바른 방향
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:321` (반환 타입 `message` 로 변경), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:57` (`ModelTestConnectionResultDto.message`)
  - 상세: 서비스 반환(`error`) · 선언 DTO(`message`) · 프런트엔드 소비(`result.message`) 세 레이어가 서로 다른 필드 이름을 썼던 근본 원인은, *값 vs 선언*을 대조하는 정본 검사기(`assertMatchesContract`)가 해당 엔드포인트에 배선돼 있지 않았다는 것이다. 이번 변경은 이름만 맞춘 것이 아니라 `llm.service.spec.ts`(서비스 단위)와 신규 `llm-model-config.controller.spec.ts`(컨트롤러 HTTP 왕복, `TransformInterceptor` 포함)의 **두 레이어**에 그 계약 검사를 배선해, "레이어 경계에서 이름이 갈리는" 클래스의 결함이 이 엔드포인트에서는 재발하면 즉시 RED 가 뜨도록 만들었다. 레이어 책임 분리와 계약 강제를 코드가 아니라 인프라(공용 `response-contract`)로 처리한 점이 적절하다.
  - 제안: 없음 (긍정적 관찰).

- **[WARNING]** 새 가드(`guide-error-code-existence`)가 검증하는 것은 "코드 **이름**의 실재"뿐, 이 PR 이 고친 버그의 근본 원인이었던 "코드/문구 **내용**의 정확성"은 여전히 무방비
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/models.mdx` (8갈래 문장 표, 신규 하드코딩) vs `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts` (SoT)
  - 상세: 이번 plan(§A)의 실제 결함은 "이름이 존재하지 않는다"가 아니라 "세 레이어가 서로 다른 필드 이름/문구를 써서 사용자에게 정보가 도달하지 않았다"였다. 신규 가드는 에러 **코드 토큰**(`LLM_TIMEOUT` 류)의 실재만 backend 소스와 대조하고, `models.mdx`에 새로 박아 넣은 8개 실패 문장(`"Authentication failed. Please check your API key."` 등)은 `sanitize-error.util.ts`의 문자열을 수기로 옮겨 적은 것이며 이를 대조하는 자동 검사기가 없다. 즉 이번 PR 이 막은 것과 정확히 같은 클래스(SoT 문구 변경 → 미러 문서 조용히 낡음)가 이 새 표에서 다시 열려 있다.
  - 제안: 최소한 backend `sanitize-error.util.ts`의 8개 문자열을 export 하고, frontend 가드(같은 `guide-error-code-existence` 가드 가족)에서 `models.mdx` 표의 문장이 그 집합의 부분집합인지 대조하는 케이스를 추가하거나, 후속 plan 항목으로 명시 등재.

- **[INFO]** 신규 가드가 frontend 테스트 스위트에서 backend/packages 소스 트리를 직접 파일시스템 워크 — 기존 자매 가드(`impl-anchor-existence`)와 동일한 선례를 따른 의도적 경계 확장
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46` (`walkTree(root, ["codebase/backend/src", "codebase/packages"], ...)`)
  - 상세: `codebase/frontend`의 테스트가 `codebase/backend/src`·`codebase/packages`의 디렉터리 경로를 하드코딩해 훑는 구조는 모듈 경계상 이례적이지만(문서 검증이라는 목적상 불가피), 이 PR이 새로 만든 패턴이 아니라 같은 파일 안 주석이 명시하듯 기존 `impl-anchor-existence.test.ts`가 이미 확립한 선례를 재사용한 것이다. 코드 자체도 vacuity floor(`mdxFiles.length > 50` 등)로 "경로가 조용히 비는" 회귀를 이미 방어해 뒀다. 구조적 결합은 존재하나 신규 리스크는 아니고 완화책도 갖춰져 있다.
  - 제안: 없음 (신규 이슈 아님, 참고용 기록).

- **[INFO]** `guide-error-code-scan.ts` (순수 스캐너) / `guide-error-code-existence.test.ts` (단언) 분리는 응집도가 높다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`, `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`
  - 상세: 정규식 판정 로직(`scanErrorCodeCitations`, `collectBackendTokens`)을 순수 함수 모듈로 분리하고, 그 축별 판정 근거를 별도 "대조군(synthetic fixture)" describe 블록으로 검증한 구조는 단일 책임 원칙에 부합한다. 기존 `tree-walk`/`impl-anchor-parse` 유틸을 재사용해 중복도 없다.
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** `TestConnectionResultDto` (integrations) / `ModelTestConnectionResultDto` (model-config) — 유사 shape 을 가진 두 DTO 가 각 모듈에 독립 존재
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456`, `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:49`
  - 상세: 두 DTO 모두 `latencyMs`라는 동일한 유령 필드(생산자 0건)를 갖고 있었고, 이번 PR 이 "한쪽만 고치면 같은 거짓 광고가 남는다"는 주석과 함께 양쪽을 동시에 고쳤다. 이는 별개 모듈(`integrations` vs `model-config`)이 각자의 연결-테스트 엔드포인트 계약을 소유하는 구조 자체는 모듈 경계상 타당하지만, 공통 shape(`{success, message?, meta/dimension?}`)의 중복 유지비용(shotgun-surgery 패턴)이 이번처럼 반복될 수 있음을 보여준다. 프로젝트 메모(cafe24/makeshop 미러 중복은 의도)와 유사하게 의도된 분리일 가능성이 높다.
  - 제안: 공통 베이스 DTO 추출을 강제하지는 않되, 두 DTO가 같은 결함을 반복해서 겪는다면(3회 이상) 공용 `ConnectionTestResultDto` 베이스 타입 도입을 검토할 근거로 이번 사례를 기록해 둘 것.

## 요약

이번 변경의 핵심 아키텍처 기여는 서비스/DTO/프런트엔드 세 레이어의 필드 명명이 갈라져 발생한 결함을, 코드 수정에 그치지 않고 기존 공용 런타임 계약 검사기(`assertMatchesContract`)를 두 레이어(서비스 단위·컨트롤러 HTTP 왕복)에 배선해 재발 방지 인프라로 정착시킨 점이다. 신규 문서-코드 실재성 가드(`guide-error-code-existence`)도 기존 가드 가족의 위치·역할 분담 관례를 그대로 따르고 순수 로직과 단언을 분리해 응집도가 높다. 다만 이 가드는 "코드 이름의 존재"만 보증하고 이번 결함의 실질 원인이었던 "문구/필드 내용의 정확성"까지는 닫지 못해, `models.mdx`의 8갈래 수기 문장이 `sanitize-error.util.ts`와 조용히 벌어질 수 있는 동일 클래스 리스크가 남아 있다. 그 외 두 DTO 간의 유사 shape 중복은 모듈 경계상 허용 가능한 범위이며 순환 의존성이나 레이어 위반은 발견되지 않았다.

## 위험도
LOW
