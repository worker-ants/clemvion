# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 파일: `spec/2-navigation/6-config.md`

---

## 발견사항

### 발견사항 1

- **[INFO]** `api_key` / `bearer_token` 문자열이 두 도메인에서 동시 사용
  - target 신규 식별자: `AuthConfig.type` 열거값 `"api_key"`, `"bearer_token"` (6-config.md §A.2 via data-model §2.17.1)
  - 기존 사용처: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md §2.10` — `Integration.auth_type` 열거값 `"api_key"`, `"bearer_token"`
  - 상세: 두 도메인이 동일 문자열을 사용하지만 의미는 다르다 — AuthConfig.type 은 **인바운드 webhook 인증** 방식이고, Integration.auth_type 은 **아웃바운드 외부 서비스 연동** 방식이다. `spec/1-data-model.md §2.17.3`(consistency W-10/W-11)에 이미 문서화돼 있으며, TypeScript 타입을 `AuthConfigType` / `IntegrationAuthType` 으로 분리해 cross-domain 혼용을 방지하는 처방도 명시돼 있다. Basic 인증은 `basic_auth` vs `basic` 으로 표기가 달라 추가 구분 단서도 있다.
  - 제안: 현행 처방(TypeScript 유니온 타입 분리)이 충분하다. 코드 내 `AuthConfigType` 과 `IntegrationAuthType` 을 혼용하지 않도록 런타임 유효성 검사·DTO 레이어에서 타입 경계를 명확히 유지한다.

### 발견사항 2

- **[INFO]** `spec/5-system/3-error-handling.md` 의 `MODEL_CONFIG_INVALID` 소스 파일 주석이 C-2 cluster 4 이후 불완전
  - target 신규 식별자: `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 등재된 `codebase/backend/src/modules/llm/llm-model-config.controller.ts`
  - 기존 사용처: `spec/5-system/3-error-handling.md` L48 — `MODEL_CONFIG_INVALID` 소스로 `model-config.service.ts`·`model-config.controller.ts` 만 기재
  - 상세: C-2 cluster 4 refactor 로 `preview-models` 엔드포인트(SSRF 검증 포함)가 `LlmModelConfigController`(`llm-model-config.controller.ts`)로 이전됐다. 해당 컨트롤러도 `MODEL_CONFIG_INVALID` 를 발행할 수 있으나 3-error-handling.md 의 소스 주석에 미반영된 상태다. 에러 코드 의미 자체의 충돌은 없고(두 컨트롤러 모두 동일 의미로 발행), 소스 주석의 관리 drift 다.
  - 제안: `spec/5-system/3-error-handling.md` L48 의 소스 주석에 `llm-model-config.controller.ts` 를 추가한다. 이는 별건 planner 작업이며 본 authz follow-up PR 차단 사유는 아니다.

---

## 요약

`spec/2-navigation/6-config.md` 가 도입하거나 참조하는 식별자 — 토큰 prefix(`wfk_`/`wft_`/`whs_`), API endpoint(`/api/auth-configs*`, `/api/model-configs*`), 컨트롤러명(`LlmModelConfigController`), 옵저버 메서드(`onConfigInvalidated`), 감사 액션(`model_config.set_default`), 에러 코드(`MODEL_CONFIG_INVALID`/`MODEL_CONFIG_NOT_FOUND`) — 는 코퍼스 전반에서 동일한 의미로 일관되게 사용되고 있으며 다른 의미와의 직접 충돌은 없다. `api_key`/`bearer_token` 문자열이 두 도메인에 걸쳐 나타나지만 이는 기존 spec(`§2.17.3 W-10/W-11`)이 인지하고 TypeScript 타입 분리로 처방한 의도적 설계다. authz follow-up 구현(testConnection `@Roles('editor')` 부여, listModels Viewer+ 유지)은 새 식별자를 도입하지 않으므로 충돌 위험이 없다.

---

## 위험도

LOW
