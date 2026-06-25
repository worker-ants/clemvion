# 정식 규약 준수 검토 — 03 m-4: backend catch 변수명 통일

검토 모드: --impl-prep (구현 착수 전)
대상: `plan/in-progress/refactor/03-maintainability.md §m-4` 기술 및 구현 범위 설명

---

## 발견사항

### 발견사항 없음 (NONE)

검토 범위를 구체화하면 다음과 같다.

**1. 명명 규약**

m-4 구현은 `eslint-plugin-unicorn` 의 `unicorn/catch-error-name` 단일 룰을 `{ name: 'err' }` 로 활성화해 catch 파라미터를 `err` 로 통일하는 것이다. `spec/conventions/error-codes.md` 는 에러 **코드 문자열**(`error.code` 값 — `UPPER_SNAKE_CASE`, `<DOMAIN>_<CONDITION>` 구조) 만 소유하며, catch 변수명(`err`/`error`/`e`)은 해당 규약의 적용 범위 밖임을 명확히 한다 (`error-codes.md` §Overview "본 문서가 유일하게 소유하는 것": 의미 기반 명명·rename 안정성·historical artifact 레지스트리). `audit-actions.md`·`swagger.md`·`migrations.md` 등 다른 conventions 도 catch 변수명을 규정하지 않는다. 따라서 "명명 규약 SoT 는 lint 설정" 이라는 plan 기술은 현행 conventions 와 충돌하지 않는다.

**2. 출력 포맷 규약**

catch 변수명 rename 은 순수 로컬 식별자 변경으로, API 응답 봉투·에러 코드 문자열·이벤트 페이로드 등 출력 포맷에 영향을 주지 않는다. `error-codes.md §2` 의 rename = breaking change 정책은 **공개 에러 코드 값**에만 적용되며, catch 파라미터(내부 식별자)는 해당 범위 밖이다. 위반 없음.

**3. 문서 구조 규약**

구현 계획 기술은 `plan/in-progress/refactor/03-maintainability.md` 내 항목으로, `_product-overview.md`·`0-` prefix 등의 spec 문서 구조 규약이 적용되는 영역이 아니다 (plan/ 은 작업 추적용). CLAUDE.md 의 정보 저장 위치 규칙상 진행 중 작업은 `plan/in-progress/` 에 두는 것이 정확히 준수돼 있다.

**4. API 문서 규약**

본 작업은 API endpoint·DTO·Swagger 데코레이터와 무관하다. `swagger.md` 규약 적용 대상 아님.

**5. 금지 항목**

- `eslint-plugin-unicorn` 전체 preset 비활성화하고 단일 룰만 사용하는 방식은 "부수 규칙 유입 차단" 목적으로 기술돼 있으며, 이는 기존 `eslint.config.mjs` 의 방식(`no-console: 'error'` 를 전체 recommended 확장이 아닌 단일 룰로 추가)과 일관된 패턴이다.
- `^_` ignore 패턴 유지는 기존 `no-unused-vars.caughtErrorsIgnorePattern: '^_'` 와 정합한다.
- 에러 코드 prefix(`CAFE24_*`/`MAKESHOP_*`) rename 은 대상이 아니다. `error-codes.md §2` 의 rename 금지는 이 구현에서 촉발되지 않는다.

---

## 요약

`03 m-4` catch 변수명 통일 구현은 정식 규약(`spec/conventions/**`)이 소유하는 어떤 영역과도 충돌하지 않는다. `error-codes.md` 가 에러 코드 **문자열** 만 소유하고 catch 파라미터 식별자를 규율 대상 밖으로 명시하고 있으므로, lint 설정을 SoT 로 삼는 plan 기술은 정확하다. 출력 포맷·API 명명·문서 구조·Swagger 패턴 규약 모두 본 작업 범위와 교차점이 없다.

---

## 위험도

NONE
