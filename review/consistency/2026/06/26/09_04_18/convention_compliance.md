# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 (--impl-prep)
**Target**: `spec/2-navigation/6-config.md`
**검토 시각**: 2026-06-26

---

## 발견사항

### [INFO] `## 3. API` 섹션 헤더의 숫자 prefix 불일치

- **target 위치**: `spec/2-navigation/6-config.md` — `## 3. API` (라인 약 252)
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장" — 명시적 숫자 규약은 없으나 `spec/2-navigation/4-integration.md` 가 `## 1.`…`## 9. API` 의 일관된 숫자 체계를 사용하는 것과 대비
- **상세**: 문서의 최상위(`##`) 섹션은 `## Overview`, `## Part A:`, `## Part B:`, `## 3. API`, `## Rationale` 순이다. `## 3. API` 는 "3" 을 붙이나 동급 섹션인 `## Part A:` 와 `## Part B:` 는 번호가 아닌 문자(letter) 접두어를 사용한다. 즉 `## 1.`·`## 2.` 에 해당하는 상위 형제 섹션이 없다 — 과거에 `1.`/`2.` 숫자 체계였다가 "Part A"/"Part B" 로 재구성하면서 "3. API" 만 잔류한 것으로 보인다.
- **제안**: `## 3. API` → `## API` 로 숫자 제거하거나, 상단 섹션도 `## 1. Authentication (인증 설정)` / `## 2. Models (모델 설정)` / `## 3. API` 로 일관 번호 체계 복원. 동급 비교 문서(`4-integration.md`)는 후자(일관 번호 체계) 패턴을 따른다.

---

### [INFO] `id: config` frontmatter — 파일 basename과의 사소한 괴리

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter, 라인 2
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "id: spec 식별자. 파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일 basename 은 `6-config` 이나 frontmatter `id` 는 `config` (숫자 prefix `6-` 생략). 규약상 "권장(recommended)" 이므로 하드 요구사항은 아니다. 실제로 `spec/2-navigation/` 내 모든 파일이 동일하게 숫자 prefix 를 생략하는 de facto 로컬 패턴을 따르며(예: `0-dashboard.md` → `id: dashboard`, `5-knowledge-base.md` → `id: knowledge-base`), spec 트리 전체에서 `id: config` 중복도 없다 (grep 확인). 가드(`spec-frontmatter.test.ts`)도 현재 basename 일치 강제는 아님. 충돌·가드 실패 리스크 없음.
- **제안**: 현행 유지 가능. 규약 문서 §2.1 에 "숫자 prefix 는 id 에서 생략한다" 주석을 추가하면 lokal 패턴이 공식화된다 (규약 자체 갱신이 적절).

---

## 규약별 점검 결과 (이상 없음)

| 규약 | 점검 결과 |
|------|----------|
| Frontmatter `id`/`status`/`code:` 유효성 (`spec-impl-evidence.md §2`) | 이상 없음 — `status: implemented`, `code:` 경로 모두 실존 확인 |
| `status: implemented` 의 `pending_plans:` 부재 (`§3`) | 이상 없음 — 의무 없음 |
| 문서 3섹션 구조 (Overview / 본문 / Rationale) | 이상 없음 |
| `_product-overview.md` 내비게이션 맵 링크 | `_product-overview.md` 라인 5에 `[설정 (인증, Models)](./6-config.md)` 등재 확인 |
| 감사 액션 명명 (`audit-actions.md §3`) | `auth_config.reveal` 정확 — `auth_config` 현재형 §2.2 카탈로그와 일치 |
| `model_config` 감사 액션 미언급 | 규약 §3에서 `model_config.*` 전부 "미구현" — spec 이 감사 로깅을 약속하지 않으므로 무결 |
| 에러 코드 (`error-codes.md`) | `MODEL_CONFIG_INVALID` 사용 ✓, 구 코드 `LLM_CONFIG_INVALID`/`LLM_CONFIG_NOT_FOUND` 미사용 확인 |
| API 경로 명명 (kebab-case) | `/api/auth-configs`, `/api/model-configs`, 서브경로 전부 kebab-case ✓ |
| 레거시 alias (`/api/llm-configs`, `/api/rerank-configs`) | 문서 내 "PR4 에서 제거" 명시, 금지 패턴 미사용 ✓ |
| Swagger 응답 DTO 위치 (`swagger.md §5-1`) | `dto/responses/model-config-response.dto.ts` 실존 확인 ✓ |
| `spec/2-navigation/` id 충돌 | `id: config` 는 spec 트리 전체에서 유일 ✓ |

---

## 요약

`spec/2-navigation/6-config.md` 는 정식 규약(`spec/conventions/**`) 준수 측면에서 실질적 위반 사항이 없다. frontmatter 스키마(spec-impl-evidence §2)·감사 액션 명명(audit-actions §3)·에러 코드(error-codes §5)·API 경로 명명 모두 규약과 일치하며, 레거시 alias 와 구 에러 코드도 올바르게 제거·교체됐다. 발견된 두 사항은 모두 INFO 등급 — `## 3. API` 헤더의 숫자 artifact(문서 내부 일관성 문제)와 `id: config` 의 basename 권장 패턴 사소한 이탈이다. 후자는 영역 전체의 de facto 로컬 관행이라 규약 자체에 주석을 추가하는 방향이 적절하다.

## 위험도

NONE
