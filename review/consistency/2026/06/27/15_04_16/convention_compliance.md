# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 (--impl-prep)
**검토 대상**: `spec/2-navigation/6-config.md`
**검토 일시**: 2026-06-27

---

## 발견사항

### **[INFO]** `id` 값이 파일 basename 과 완전 일치하지 않음

- **target 위치**: frontmatter `id: config`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일명이 `6-config.md` 이므로 basename(확장자 제외)은 `6-config`. 현재 `id: config` 는 숫자 prefix 를 생략한 형태다. 규약은 "권장(recommended)" 이라 강제 아니고, 다른 영역에 동명 `id: config` 가 없다면 충돌도 없다.
- **제안**: 현재 상태 유지 가능. 다른 영역에서 `id: config` 가 추가될 경우 해당 후발 문서가 `nav-config` 등으로 회피한다는 점을 인지하면 족하다 (`spec-impl-evidence.md §2.1` 후발-prefix 패턴).

---

## 규약별 적합성 요약

| 점검 축 | 결과 | 근거 |
|---|---|---|
| **frontmatter 구조** (`spec-impl-evidence.md §2`) | 적합 | `id`, `status: implemented`, `code:` 모두 존재. `code:` 경로 8개가 모두 glob 패턴 또는 명시 파일로 작성됨 |
| **문서 3섹션 구조** (CLAUDE.md) | 적합 | `## Overview (제품 정의)` → Part A/B 본문 → `## Rationale` 순서 준수 |
| **`_product-overview.md` 명명** (CLAUDE.md) | 적합 | 첫 줄에서 `./_product-overview.md` 로 참조. 밑줄 prefix 패턴 준수 |
| **audit action 명명** (`audit-actions.md §3`) | 적합 | `§A.4` 의 `action='auth_config.reveal'` 은 레지스트리 `auth_config\|현재형\|reveal\|구현` 과 일치. `model_config` 관련 audit 행위는 본 spec 이 선언하지 않으며 `미구현` 상태라 정합 |
| **에러 코드 명명** (`error-codes.md §5`) | 적합 | `§B.6.2` 의 `MODEL_CONFIG_INVALID` 는 rename 이력(구: `LLM_CONFIG_INVALID`)에 따른 정확한 현행 코드명 |
| **API endpoint 명명** | 적합 | 모든 경로 토큰이 kebab-case (`set-default`, `preview-models`, `auth-configs` 등). 감사 액션 토큰 `set_default` 는 audit-actions §1 규약대로 언더스코어 — 계층 구분 정상 |
| **secret-store 규약** (`secret-store.md §1 비대상`) | 적합 | `AuthConfig` 자격증명이 `auth-configs` 모듈 컬럼 transformer 로 직접 암복호화한다고 서술. `secret://` URI 미사용 — secret-store.md 의 "비대상" 규정과 일치 |
| **API 응답 wrapping** (`swagger.md §2-5, §5-2`) | 해당 없음 | 본 문서는 spec 이므로 데코레이터·DTO 규약은 구현 파일에 적용. spec 본문은 `{ data: ... }` 응답 구조를 올바르게 기술 |
| **금지 항목** (conventions 전반) | 없음 | 명시 금지 패턴(prefix 없는 audit action, 하이픈 audit 토큰, 구 에러 코드 `LLM_CONFIG_*` 잔류 등) 사용 없음 |

---

## 요약

`spec/2-navigation/6-config.md` 는 정식 규약을 전반적으로 준수하고 있다. frontmatter 는 `spec-impl-evidence.md` 의 필수 필드(`id`/`status`/`code:`)를 모두 갖추었고, 문서는 Overview-본문-Rationale 3섹션 구조를 따른다. audit action(`auth_config.reveal`), 에러 코드(`MODEL_CONFIG_INVALID`), endpoint 명명(kebab-case), 비밀값 처리(secret-store 비대상 정합) 모두 해당 conventions 와 일치한다. 유일한 지적은 `id: config` 가 basename `6-config` 에서 숫자 prefix 를 생략한 것으로, 규약 자체가 "권장"으로 선언하고 있어 INFO 수준에 그친다.

---

## 위험도

NONE
