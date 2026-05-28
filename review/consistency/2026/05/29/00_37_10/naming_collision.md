# 신규 식별자 충돌 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-05-29

---

## 발견사항

### 1. 요구사항 ID 충돌

발견 없음. `spec/2-navigation/6-config.md`는 독립적인 요구사항 ID를 직접 정의하지 않는다. 해당 화면의 요구사항 ID(`NAV-CA-*`, `NAV-CL-*`)는 `spec/2-navigation/_product-overview.md §3.6–3.7`에 위치하며, 6-config.md는 이를 참조만 한다.

### 2. 엔티티/타입명 충돌

- **[INFO]** `AuthConfigType` 과 `IntegrationAuthType` 의 공유 문자열 (`api_key`, `bearer_token`)
  - target 신규 식별자: `spec/2-navigation/6-config.md §A.2` 가 열거하는 인증 type 값 `API Key`, `Bearer Token`, `Basic Auth`, `HMAC`
  - 기존 사용처: `spec/1-data-model.md §2.17.3` — TypeScript 타입명 분리 `AuthConfigType` 과 `IntegrationAuthType` 이 이미 명시적으로 분리됨. `basic_auth` (AuthConfig 인바운드용) vs `basic` (Integration 아웃바운드용) 의 의도적 표기 차이도 §2.17.3 에 기록됨.
  - 상세: 6-config.md가 열거하는 type 식별자(`api_key`/`bearer_token`/`basic_auth`/`hmac`)는 `spec/1-data-model.md §2.17.1` 의 JSONB 스키마와 완전히 정합함. 단순 참조 중복이며 의미 충돌 없음. §2.17.3 이 already codify.
  - 제안: 없음 (기존 근거 문서에서 이미 처리됨).

### 3. API endpoint 충돌

- **[INFO]** `POST /api/llm-configs/preview-models` 경로 중복 선언
  - target 신규 식별자: `spec/2-navigation/6-config.md §3 LLM Config API` 표의 `POST /api/llm-configs/preview-models`
  - 기존 사용처: `spec/5-system/7-llm-client.md §5.5` — 동일 경로·동일 의미로 이미 정의됨 (`POST /api/llm-configs/preview-models`, body `{ provider, apiKey, baseUrl? }`, 반환 `ModelInfo[]`)
  - 상세: 양쪽 모두 "저장 전 폼 자격증명으로 모델 목록 미리보기"라는 동일 의미를 가지며 의미 충돌이 아닌 단순 선언 중복. 그러나 6-config.md에는 7-llm-client.md §5.5가 규정한 `@Throttle(10/60s)`, SSRF 가드, body 로깅 금지 정책, `LLM_CREDENTIALS_REQUIRED` / `LLM_CONFIG_INVALID` 에러 코드가 생략되어 있어 독자가 두 문서를 모두 참조하지 않으면 계약을 불완전하게 이해할 수 있음.
  - 제안: 6-config.md §3 의 해당 행에 `7-llm-client.md §5.5` 교차 참조 주석 추가 (예: `상세 계약: [LLM Client §5.5](../5-system/7-llm-client.md#55-모델-목록-preview-폼-자격증명-기반)`). 또는 설명 컬럼에 "상세 계약은 §5.5 참조" 한 줄 추가.

모든 다른 endpoint (`GET /api/auth-configs`, `POST /api/auth-configs`, `GET/PATCH/DELETE /api/auth-configs/:id`, `POST /api/auth-configs/:id/regenerate`, `POST /api/auth-configs/:id/reveal`, `GET /api/auth-configs/:id/usage`, `GET/POST/PATCH/DELETE /api/llm-configs/:id`, `POST /api/llm-configs/:id/test`, `PATCH /api/llm-configs/:id/set-default`, `GET /api/llm-configs/:id/models`)에 대해 다른 spec 파일에 동일 method+path로 별도 정의된 충돌은 발견되지 않았다. `spec/1-data-model.md §2.17.2`는 세 평문 노출 경로(`POST /api/auth-configs`, `…/regenerate`, `…/reveal`)를 규범적으로 열거하고 있으며 6-config.md와 일치한다.

### 4. 이벤트/메시지명 충돌

발견 없음. 6-config.md는 SSE·queue·webhook 이벤트 이름을 새로 도입하지 않는다.

### 5. 환경변수·설정키 충돌

발견 없음. 6-config.md는 ENV var 또는 config key를 새로 정의하지 않는다.

### 6. 파일 경로 충돌

- **[INFO]** `spec/2-navigation/6-config.md` 파일명의 복합 도메인 포함
  - target 신규 식별자: 파일명 `6-config.md`, frontmatter `id: config`
  - 기존 사용처: `spec/0-overview.md §8 문서 맵` — 내비게이션 화면별 문서 목록에 `6-config.md`가 이미 존재함. `spec/2-navigation/_product-overview.md §3.6–3.7`은 Authentication(`/authentication`)을 독립 최상위 메뉴로, LLM을 Config 서브메뉴로 구분함.
  - 상세: `spec/2-navigation/_product-overview.md §3.6` 주석("Authentication은 Config 서브메뉴가 아닌 최상위 메뉴로 노출된다, 경로: `/authentication`")과 파일명 `6-config.md` 사이에 개념 불일치가 존재한다. 파일 하나가 `/authentication`과 `/config/llm` 두 경로를 다루고 있어, 파일명만 보고 Authentication 화면의 spec이 이 파일에 포함됨을 추론하기 어렵다. 실질적인 파일 경로 충돌(기존 파일 덮어쓰기 등)은 없음.
  - 제안: 현행 유지 가능. 다만 파일 상단 관련 문서 링크에 `/authentication` 경로 UI 경로를 명시하거나, `_product-overview.md §3.6`의 주석에서 "상세 spec은 `6-config.md §Part A`" 교차 참조를 추가하면 탐색성이 개선됨.

### 7. Rationale ID 충돌

- **[INFO]** `### R-1` / `### R-2` ID 가 동일 `spec/2-navigation/` 영역 내 복수 파일에서 재사용됨
  - target 신규 식별자: `spec/2-navigation/6-config.md §Rationale` 의 `### R-1` (기본 모델 select-only), `### R-2` (Part A Webhook wiring)
  - 기존 사용처:
    - `spec/2-navigation/2-trigger-list.md` — `### R-1` ~ `### R-14` (별도 도메인의 Rationale)
    - `spec/2-navigation/_layout.md` — `### R-1`, `### R-2`
    - `spec/2-navigation/10-auth-flow.md` — `### R-1`, `### R-2`
    - `spec/2-navigation/13-user-guide.md` — `### R-1`
    - `spec/2-navigation/5-knowledge-base.md` — `### R-1`
  - 상세: Rationale ID(`R-1`, `R-2` …)는 파일 내 앵커(heading hash)로만 동작하며 spec 전체에서 전역 unique할 필요는 없다. 그러나 `spec/0-overview.md §8` 문서 맵에서 규약("본문 끝에 `## Rationale` 섹션")은 파일 범위 ID임을 암묵 전제한다. 현재 6-config.md `R-1`이 다른 파일에서 `R-1`로 교차 참조되는 경우는 없어 실제 충돌 없음. 단, 일부 spec 파일(`spec/1-data-model.md §2.17.3` Rationale, `spec/5-system/12-webhook.md` Rationale)은 `### R-A`/`### R-B` 등 구분자를 쓰거나 서술형 제목만 사용해 파일 간 패턴이 일관되지 않음.
  - 제안: 현행 유지 허용 (파일 범위 앵커이므로). 문서 간 직접 인용 시에는 항상 파일 경로 포함 anchor link(`[문서명 §Rationale R-1](../2-trigger-list.md#r-1-...)`) 를 사용하면 혼동 없음.

---

## 요약

`spec/2-navigation/6-config.md`가 도입하는 식별자(AuthConfig type 값, API endpoint, 비밀 값 prefix, Rationale ID) 중 기존 corpus와 **의미 충돌**을 일으키는 항목은 없다. `POST /api/llm-configs/preview-models` endpoint는 `spec/5-system/7-llm-client.md §5.5`에 이미 상세 정의가 존재하므로 6-config.md의 선언은 단순 중복이나, 7-llm-client.md의 throttle·SSRF·로깅 계약이 생략된 채 요약만 노출되어 독자 오해 여지가 있다. 파일명 `6-config.md`가 `/authentication` 경로(Product Overview §3.6에서는 독립 최상위 메뉴로 분류)와 `/config/llm` 두 화면을 함께 다루는 점은 탐색성 측면의 사소한 불일치이다. Rationale ID(`R-1`/`R-2`)는 파일 범위 앵커로 운영되며 전역 충돌이 아니다.

---

## 위험도

LOW
