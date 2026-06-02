# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-error-codes.md`
**Mode**: spec draft 검토 (--spec)
**Reviewer**: convention_compliance sub-agent
**Date**: 2026-06-02

---

## 발견사항

### 1. **[CRITICAL]** Frontmatter `status: implemented` 가 이 위치(plan/) 에서 부정확 — spec-impl-evidence 규약 위반

- **target 위치**: frontmatter `status: implemented` (line 3)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — frontmatter `status` 는 spec 파일(`spec/conventions/**.md`)에 적용되는 라이프사이클이다. `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며 `code: ≥1 매치 의무` 를 전제한다.
- **상세**: 본 문서는 `plan/in-progress/spec-draft-error-codes.md` 에 있는 **draft** 다. 본문 첫 줄도 "본 문서는 `spec/conventions/error-codes.md` 로 신설될 draft" 라고 명시한다. 즉 아직 `spec/conventions/` 에 실존하지 않으므로 spec-impl-evidence 의무 대상 경로(`spec/conventions/**.md`)에 해당하지 않는다. 그럼에도 `status: implemented` 를 기재하면, plan 파일을 spec 파일로 오인하거나 build-time 가드(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`)가 이 경로를 검사 대상으로 잘못 포함할 위험이 있다. plan 파일의 frontmatter `status` 는 plan 라이프사이클(plan-lifecycle.md) 의 값이어야 하며, `implemented` 는 spec 라이프사이클 전용 enum 값이다.
- **제안**: plan 파일 frontmatter 에는 plan-lifecycle.md 가 정의한 상태 값(예: `in-progress`)을 사용하거나, spec-impl-evidence `status` 를 기재할 이유가 없다면 제거한다. 실제 spec 파일(`spec/conventions/error-codes.md`) 이 신설된 이후에 그 파일의 frontmatter 에 `status: implemented` + `code:` 를 기재해야 한다.

---

### 2. **[CRITICAL]** `code:` 글로브가 spec-impl-evidence 검증 기준(`≥1 실존 파일 매치`)을 만족하는지 확인 불가 — 향후 spec 파일 신설 시 필수 확인 사항

- **target 위치**: frontmatter `code:` (lines 4–6)
  ```
  code:
    - codebase/backend/src/common/filters/http-exception.filter.ts
    - codebase/backend/src/common/swagger/error-response.dto.ts
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1, §3` — `status: implemented` 일 때 `code: ≥1 매치 의무`.
- **상세**: 기재된 두 경로는 glob 이 아닌 구체 파일 경로다. 이 경로들이 실제 존재하는지는 draft 단계에서 검증되지 않지만, spec 파일 신설 시 `spec-code-paths.test.ts` 가 이를 강제 검증한다. 해당 파일이 에러 코드 **명명 규약** 의 구현 증거로서 충분한지도 검토 필요 — `http-exception.filter.ts` 는 봉투 생산 지점이고 `error-response.dto.ts` 는 Swagger 표현이지만, 실제 에러 코드 상수 정의(예: enum, constant 파일)가 누락되어 있다면 `code:` 글로브가 명명 규약의 실제 구현 surface 를 제대로 가리키지 못한다.
- **제안**: 에러 코드 상수/enum 을 정의하는 실제 파일(예: `codebase/backend/src/common/errors/*.ts` 또는 유사 경로)이 존재한다면 `code:` 에 추가한다. spec 파일 신설 시 경로 실존 여부를 `spec-code-paths.test.ts` 로 반드시 확인한다.

---

### 3. **[WARNING]** `swagger.md §2-4` 참조 링크가 규약 문서 경로와 불일치

- **target 위치**: `## Overview` 섹션, "`swagger.md §2-4`" 링크 (line 16 / Overview 내부)
- **위반 규약**: `spec/conventions/swagger.md` 의 실제 섹션 번호. swagger.md 의 §2는 "Controller 패턴", §2-4는 "상태 코드 응답 규칙" 이다.
- **상세**: target 은 "HTTP 상태 코드 선택은 `swagger.md §2-4`" 라고 기재하나, `spec/conventions/swagger.md §2-4` 는 HTTP 응답 상태 코드 규칙 테이블을 담고 있다. 이는 의미상 맞으나 링크 anchor(`./swagger.md`)가 상대 경로로 작성되어 있어, 실제 배포 위치(`spec/conventions/error-codes.md`)에서는 올바르나 현재 `plan/in-progress/` draft 에서 클릭 시 broken 상태다. 내용 자체의 참조 의도는 올바르다.
- **제안**: draft 단계에서는 broken link 가 허용되나, spec 파일 신설 시 `[spec/conventions/swagger.md §2-4](../conventions/swagger.md#2-4-상태-코드-응답-규칙)` 또는 동등한 올바른 anchor 로 교체 확인.

---

### 4. **[WARNING]** 봉투(envelope) 형식을 본 문서에서 직접 기술 — SoT 중복 우려

- **target 위치**: `## 1. 형식` 섹션, 봉투 정의 라인
  ```
  봉투: `{ "error": { "code": "<UPPER_SNAKE>", "message": "<human readable>", "details?": ... } }`
  ```
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` — 에러 봉투의 SoT 는 api-convention §5.3 이다. Overview 에서 본 문서가 명명만 다룬다고 선언했음에도 본문에서 봉투 형식을 직접 서술하면 SoT 중복이 발생한다.
- **상세**: Overview 는 "응답 봉투(envelope) 형식은 `5-system/2-api-convention.md §5.3` 이 SoT, 본 문서는 명명만" 이라고 명확히 선언했다. 그러나 §1 본문에서 봉투 형식 `{ "error": { "code": ..., "message": ..., "details?": ... } }` 를 직접 인라인으로 기술해 SoT 가 둘로 갈린다. api-convention §5.3 의 봉투가 변경될 때 본 문서도 같이 갱신해야 하는 유지 부담이 생긴다.
- **제안**: 봉투 형식 인라인 기술을 제거하고, api-convention §5.3 으로의 링크 참조만 남긴다. 예: "봉투 형식은 [api-convention §5.3](../5-system/2-api-convention.md#53-에러-응답) 참조." 생산 지점(`http-exception.filter.ts`) 언급은 유지해도 무방하나 봉투 JSON 구조 자체는 SoT 참조로 대체.

---

### 5. **[INFO]** `_product-overview.md` 없이 도메인 prefix 예시 목록(`VALIDATION_ERROR`)이 naming pattern 이탈 가능성

- **target 위치**: `## 1. 형식`, 도메인 prefix 예시: `CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`, `VALIDATION_ERROR`
- **위반 규약**: 규약 자체의 내적 일관성 — `<DOMAIN>_<CONDITION>` 형태로 정의했으나 `VALIDATION_ERROR` 는 DOMAIN prefix 없이 단일 토큰.
- **상세**: 규약은 `<DOMAIN>_<CONDITION>` 을 형식으로 제시했으나, 예시 중 `VALIDATION_ERROR` 는 이 패턴을 따르지 않는다(`DOMAIN_CONDITION` 이 아닌 단일 의미 코드). 기존 코드라면 §4 예외 레지스트리에 등재하거나, 또는 이 형식이 단순히 "권장" 이라면 그렇게 명시해야 일관성이 유지된다.
- **제안**: `VALIDATION_ERROR` 를 §4 예외 레지스트리에 추가하거나, §1 형식 설명에 "도메인이 자명한 범용 에러는 prefix 생략 가능" 이라는 허용 조항을 명시. 또는 `VALIDATION_ERROR` 를 제거하고 `<DOMAIN>_<CONDITION>` 패턴을 따르는 예시로 교체.

---

### 6. **[INFO]** 문서 배치 위치 — plan/ 이 아닌 spec/conventions/ 가 최종 목적지

- **target 위치**: 파일 경로 `plan/in-progress/spec-draft-error-codes.md`, 본문 첫 줄 노트
- **위반 규약**: CLAUDE.md 정보 저장 위치 원칙 — "정식 규약: `spec/conventions/<name>.md`"
- **상세**: 본 파일이 `plan/in-progress/` 에 위치하는 것은 draft 단계에서 의도적이며 본문에도 명시되어 있다. 이 자체는 위반이 아니나, spec 파일 신설 시 반드시 `spec/conventions/error-codes.md` 로 이동(또는 새 파일 작성) 해야 한다는 점을 plan 의 체크리스트에 명시하는 것이 좋다.
- **제안**: plan frontmatter 또는 본문 TODO 에 "spec/conventions/error-codes.md 신설 후 본 plan 파일 complete/ 이동" 을 명시.

---

## 요약

target 문서(`plan/in-progress/spec-draft-error-codes.md`)는 spec 내용 자체(명명 원칙, 안정성 정책, 예외 레지스트리, Rationale 3섹션)는 정식 규약 구조를 잘 따른다. 그러나 두 가지 CRITICAL 문제가 있다. 첫째, plan 파일임에도 frontmatter 에 spec-impl-evidence 전용 `status: implemented` 를 기재해 라이프사이클 가드와 충돌한다. 둘째, `code:` 경로가 에러 코드 명명 규약의 실제 구현 surface(상수/enum 정의 파일)를 충분히 포함하지 않을 수 있다. 추가로, Overview 에서 봉투 SoT 를 api-convention §5.3 으로 위임한다고 선언했으나 §1 본문에서 봉투 구조를 직접 서술해 SoT 중복이 생긴다(WARNING). spec/conventions/error-codes.md 로 최종 신설될 때 위 지적사항을 반영해야 build-time 가드(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`)를 통과할 수 있다.

## 위험도

**HIGH**

(CRITICAL 2건이 spec 파일 신설 시 build-time 가드 fail 을 직접 유발할 수 있음. draft 단계에서는 즉각 장애를 일으키지 않으나, plan 에서 spec 으로 프로모션 시 수정 없이 머지하면 CI 차단)
