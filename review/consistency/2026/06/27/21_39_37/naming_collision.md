# 신규 식별자 충돌 검토

검토 범위: `spec/5-system/`, diff-base `8c5fdf257c7d4a49e5d715e5414ccf643cfdc9f6`

---

## 분석 전제

diff-base 이후 `spec/5-system/` 에서 실제로 변경된 파일은 `spec/5-system/2-api-convention.md` 단 1건이다. 추가된 내용은 목록 응답 wrapping 구조를 설명하는 주석 1줄이며, 이 외의 spec/5-system/ 파일은 내용 변경 없음. 함께 변경된 코드베이스 파일(`api-wrapped.ts`/`.spec.ts`, cafe24 metadata) 도 검토 대상에 포함한다.

---

## 발견사항

### [INFO] `PaginatedResponseDto` — 이미 정의된 식별자 재참조 (충돌 없음)

- target 신규 식별자: `spec/5-system/2-api-convention.md` §5.2 주석의 `PaginatedResponseDto`
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/conventions/swagger.md` §2-5 "응답 wrapping" (l.204, l.265, l.317) — 동일 DTO 를 동일 의미(`{ data, pagination }` single-wrap)로 정의
  - `/Volumes/project/private/clemvion/spec/3-workflow-editor/4-ai-assistant.md` — 동일 의미 참조
  - `/Volumes/project/private/clemvion/codebase/backend/src/common/dto/paginated-response.dto.ts` — 실제 클래스
- 상세: 추가된 주석은 `swagger.md §2-5` 가 이미 정의한 패턴을 api-convention 맥락에서 재설명하는 설명 텍스트다. 의미 충돌 없음.
- 제안: 없음. 현재 표현이 기존 정의와 완전히 정합한다.

### [INFO] `TransformInterceptor` 참조 — 기존 식별자

- target 신규 식별자: `spec/5-system/2-api-convention.md` 주석 내 `TransformInterceptor`
- 기존 사용처: `spec/conventions/swagger.md` 및 관련 코드에서 이미 사용 중인 클래스명
- 상세: 새로 도입된 이름이 아니며 기존 구현체를 지칭. 충돌 없음.

### [INFO] 링크 앵커 `#2-5-응답-wrapping` — 유효한 기존 섹션

- target 신규 식별자: `../conventions/swagger.md#2-5-응답-wrapping`
- 기존 사용처: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` l.204 `### 2-5. 응답 wrapping` 섹션
- 상세: 앵커가 실제 섹션 헤딩과 일치한다. 깨진 링크 없음.

### [INFO] `KNOWN_DOCS_ABSENT` — 테스트 파일 로컬 상수

- target 신규 식별자: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` 내 `const KNOWN_DOCS_ABSENT`
- 기존 사용처: 해당 파일 내에서만 선언·사용. export 없음.
- 상세: 테스트 로컬 상수이며 외부로 export 되지 않는다. 같은 이름의 상수·변수가 다른 파일에 존재하지 않음. 충돌 없음.

---

## 제거된 식별자 (충돌 분석 불요)

diff-base 이후 다음 cafe24 operation ID 들이 metadata 및 i18n dict 에서 **제거**됐다:

- `applications_list`, `webhooks_list`, `mains_update`, `mains_delete`, `customer_get`, `customer_update`, `coupon_get`, `coupon_delete`, `socials_apple_settings_get`

제거는 신규 식별자 충돌 대상이 아니다. 대응하는 i18n 키(`cafe24.application.applications_list` 등)도 함께 제거됐다.

---

## 요약

`spec/5-system/` diff 범위에서 새로 도입된 식별자는 실질적으로 없다. `spec/5-system/2-api-convention.md` 에 추가된 주석은 `spec/conventions/swagger.md` 에 이미 정의된 `PaginatedResponseDto`, `TransformInterceptor` 를 동일 의미로 재인용하며, 링크 앵커도 실제 섹션과 일치한다. 코드베이스 변경에서 도입된 `KNOWN_DOCS_ABSENT` 는 테스트 로컬 상수로 외부 충돌이 없다. 기존 식별자와 다른 의미로 이름이 겹치는 사례, 명명 혼동 위험, API endpoint 중복, 이벤트명 충돌, ENV var/config key 충돌, 파일 경로 충돌은 발견되지 않았다.

## 위험도

NONE
