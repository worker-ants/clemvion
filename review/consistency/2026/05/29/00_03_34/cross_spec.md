# Cross-Spec 일관성 검토 — spec/2-navigation/2-trigger-list.md §2.1 "인증" 요소 추가 + R-15

**검토 대상**: `plan/in-progress/spec-draft-triggers-auth-column.md`
**검토 일시**: 2026-05-29
**검토자**: Cross-Spec 일관성 검토자

---

## 발견사항

### [CRITICAL] R-15 요구사항 ID 충돌 — `spec/6-brand.md` 가 이미 동일 ID 사용

- **target 위치**: target 문서 "변경 2 — Rationale 신규 R-15" (`### R-15. 외부 노출 webhook 무인증 경고 표시 (2026-05-29)`)
- **충돌 대상**: `spec/6-brand.md` §8 Rationale — `### R-15. 워드마크 layout 개정 — capital C, monochrome, no sub-copy (2026-05-25)` (파일 내 429번째 줄 및 74, 87~89, 91, 99~100, 115, 125, 129, 139번째 줄 등 다수 참조)
- **상세**: `R-15` 는 `spec/6-brand.md` 의 브랜드 결정 ID 로 이미 확정 사용 중이다. "워드마크 2-tone 폐기·단색 monochrome·sub-copy 폐기·viewBox 320×80" 결정을 가리키며, R-3·R-5·R-13 등 다른 브랜드 Rationale 이 이 ID 를 교차 참조한다. target draft 가 같은 ID `R-15` 를 "트리거 목록 무인증 webhook 경고 표시" 에 부여하면 두 문서 간 ID 공간이 충돌한다. Rationale ID 는 문서 고유 번호 체계이지만, 서로 다른 spec 에서 같은 번호가 완전히 다른 의미로 쓰이면 cross-spec 참조 시 혼동이 발생한다.
- **위험도 판단**: 현재 Rationale ID 는 문서 범위 로컬 번호이므로 즉시 기능 충돌이 나타나지는 않으나, `spec/2-navigation/2-trigger-list.md` 의 R-15 가 다른 문서에서 링크로 참조될 경우 (`spec/6-brand.md#r-15` 앵커와 혼동) 단일 진실 원칙을 해친다.
- **제안**: target Rationale ID 를 `R-15` 다음 빈 번호 (`R-15` 이전 2-trigger-list.md 의 최대 번호를 확인하면 `R-14` 이므로 `R-15` 는 이 문서에서 순서상 맞지만) — 충돌 해소를 위해 target 의 ID 를 **`R-15`** 대신 `2-trigger-list.md` 내부의 최신 미사용 번호로 교체하거나, ID 충돌 가능성을 명시한 주석을 추가한다. 실질적으로는 문서 범위가 다르므로 `spec/6-brand.md` 의 `R-15` 는 건드리지 않고, target 의 ID 에 **파일 범위 prefix** 를 부여해 명확히 구분하거나 (예: Rationale 절 제목을 `R-15`로 유지하되 title 에 파일 범위 표기), 향후 cross-spec Rationale 충돌을 방지하기 위해 ID 체계를 파일 prefix 로 구분하는 규약을 `spec/conventions/` 에 정비하는 방향을 권장한다.

---

### [WARNING] `_product-overview.md` NAV-TR-10 — 삭제된 인라인 인증 필드 여전히 명시

- **target 위치**: target draft 본문 내 "§2.3.1 Auth Config 행" 참조 ("AuthConfig binding 정책 자체는 §2.3.1 Auth Config 행 + R-14 가 SoT")
- **충돌 대상**: `spec/2-navigation/_product-overview.md` §3.2 NAV-TR-10 — "트리거 상세 드로어에서 이름·웹훅 인증(`authType` / `hmacHeader` / `hmacSecret` / `bearerToken` / `endpointPath`) 을 GUI 로 수정 가능"
- **상세**: `spec/2-navigation/2-trigger-list.md` Rationale R-14 (2026-05-28) 에서 인라인 인증 4행 (`authType` / `hmacHeader` / `hmacSecret` / `bearerToken`) 이 제거되고 `authConfigId` 단일 binding 으로 격상됐다. 그러나 상위 PRD 인 `spec/2-navigation/_product-overview.md` NAV-TR-10 은 여전히 구식 인라인 인증 필드 목록을 참조한다. target draft 가 이 spec 위에서 `authConfigId` 기반 뱃지 표시를 기술하면, product-overview 의 NAV-TR-10 이 "authType / hmacHeader / hmacSecret / bearerToken 를 GUI 로 수정 가능" 이라는 내용과 단일 진실이 깨진다.
- **제안**: target draft 채택 시 `spec/2-navigation/_product-overview.md` NAV-TR-10 의 인증 필드 목록을 `authConfigId` (AuthConfig binding) 로 갱신해야 한다. 본 draft 의 frontmatter 에 "NAV-TR-10 갱신 필요" 를 명시하거나, 동일 spec PR 에서 함께 수정할 것을 권고.

---

### [WARNING] `useAuthConfigs` 훅 — spec 어느 문서에도 정의되지 않은 프론트엔드 계약

- **target 위치**: target draft 변경 1 — §2.1 표 "인증" 요소 설명 중 "프론트가 워크스페이스 AuthConfig 목록(`useAuthConfigs`)으로 type 해석"
- **충돌 대상**: `spec/2-navigation/6-config.md §3` API 테이블 (`GET /api/auth-configs`) + `spec/2-navigation/2-trigger-list.md §3` + `spec/1-data-model.md §2.17`
- **상세**: target draft 는 프론트엔드가 `useAuthConfigs` 훅을 사용해 워크스페이스 AuthConfig 목록을 조회하고 `authConfigId` 로 type 을 해석한다고 기술한다. `spec/2-navigation/6-config.md` 는 `GET /api/auth-configs` API 를 정의하지만, `useAuthConfigs` 라는 React Query 훅 이름 및 그 계약(반환 필드 shape, 캐시 정책 등)은 어떤 spec 문서에도 정의되지 않았다. 구현체에서 훅 이름이 다를 경우 spec 과 코드의 괴리가 발생하며, 목록 응답에 `authConfigId` → `type` 매핑 데이터가 포함된다는 전제도 명시적으로 검증되지 않았다.
- **제안**: spec 에는 구현 훅 이름 대신 "워크스페이스 AuthConfig 목록 (`GET /api/auth-configs`) 를 사전 조회해 `id → type` 매핑을 구성" 과 같이 API 계약 수준으로 기술하거나, 해당 훅 계약을 `spec/2-navigation/6-config.md` 또는 별도 convention 에 정의한다.

---

### [INFO] Webhook URL 형식 불일치 — target 인용 위치 (`§2.4`)의 기존 spec 내 불일치

- **target 위치**: target draft R-15 본문 — "webhook 은 `{base_url}/hooks/{endpoint_path}` 로 외부에 공개된 HTTP 진입점 ([§2.4](#24-webhook-url-형식))"
- **충돌 대상**: `spec/5-system/12-webhook.md` WH-EP-02 — URL 형식 `{base_url}/api/hooks/{endpoint_path}`
- **상세**: target draft 가 참조하는 `spec/2-navigation/2-trigger-list.md §2.4` 는 `{base_url}/hooks/{endpoint_path}` 로 표기하고 있으나, `spec/5-system/12-webhook.md` WH-EP-02 와 상세 흐름 (§5.1 시퀀스, hooks.controller 등) 은 일관되게 `/api/hooks/` prefix 를 포함한다. target draft 가 기존 2-trigger-list §2.4 의 URL 을 그대로 인용하므로 새로 충돌을 만드는 것은 아니지만, 기존 drift 를 그대로 전파한다.
- **제안**: target draft 의 R-15 본문 URL 형식을 `{base_url}/api/hooks/{endpoint_path}` 로 수정하거나, 동일 PR 에서 `spec/2-navigation/2-trigger-list.md §2.4` 의 URL 표기를 `/api/hooks/` 로 통일한다 (`spec/5-system/12-webhook.md` WH-EP-02 가 단일 진실).

---

## 요약

target draft 는 트리거 목록 §2.1 에 "인증" 표시 요소를 추가하는 소규모 spec 변경이다. AuthConfig 바인딩 모델 자체는 이미 `spec/2-navigation/2-trigger-list.md` R-14 와 `spec/5-system/12-webhook.md` §3.2 에서 정합적으로 정의되어 있어 핵심 데이터 모델·API 계약 차원의 직접 모순은 없다. 다만 Rationale ID `R-15` 가 `spec/6-brand.md` 에서 브랜드 결정 ID 로 이미 사용 중이라는 **요구사항 ID 충돌이 CRITICAL 등급**으로 존재한다. 추가로 상위 PRD `spec/2-navigation/_product-overview.md` NAV-TR-10 이 R-14 로 폐기된 인라인 인증 필드를 여전히 참조해 단일 진실을 유지하지 못하고 있으며 (WARNING), target draft 에서 언급하는 `useAuthConfigs` 훅 계약이 spec 에 미정의인 점도 보완이 필요하다 (WARNING).

---

## 위험도

**HIGH**

> CRITICAL 등급 발견사항(R-15 ID 충돌)이 존재한다. Rationale ID 가 문서 범위 로컬이어서 즉각적인 기능 파괴는 없으나, cross-spec 링크 및 일관성 추적 관점에서 동일 ID 가 두 문서에서 완전히 다른 의미로 확정되기 전에 해소해야 한다. WARNING 2건(NAV-TR-10 구식 필드, useAuthConfigs 미정의)도 동 PR 에서 처리하거나 후속 plan 에 등록할 것을 권고한다.
