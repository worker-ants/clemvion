# 정식 규약 준수 검토 — spec/2-navigation/6-config.md

검토 모드: 구현 착수 전 (--impl-prep)
검토일: 2026-06-14

---

## 발견사항

### 1. **[INFO]** `id` 필드가 basename 과 정확히 일치하지 않음 (관례 범위 내)

- **target 위치**: frontmatter line 2 — `id: config`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일명은 `6-config.md` 이므로 basename(확장자 제외)은 `6-config`인데 `id`는 `config`다. 동일 영역의 sibling 파일들(`0-dashboard.md` → `id: dashboard`, `1-workflow-list.md` → `id: workflow-list`, `10-auth-flow.md` → `id: auth-flow`)이 숫자 prefix를 제거하고 이름 부분만 사용하는 관례를 따르고 있어, 이 패턴은 프로젝트 전반에서 확립된 암묵 관례이다. 규약은 "기반 권장"이라 의무는 아니지만 스키마 문서상 basename 일치가 권장사항이므로 명시한다.
- **제안**: 현행 유지 가능. 단, spec-impl-evidence.md §2.1이 "숫자 prefix 제거 패턴도 허용" 임을 명시적으로 예시로 추가하면 향후 혼동이 없다.

---

### 2. **[INFO]** h2 섹션 헤딩 명명 스타일 혼재

- **target 위치**: `## Part A: Authentication`, `## Part B: Models`, `## 3. API` — 동일 h2 레벨에서 "Part 레이블"과 "숫자 번호" 혼용
- **위반 규약**: CLAUDE.md — "Overview / 본문 / Rationale 3섹션 권장" (각 SKILL.md 참고). 명시적 금지 규정은 없으나 sibling spec 파일(`5-knowledge-base.md`: `## 1. 화면 구조 … ## 3. API`, `4-integration.md`: `## 1. 라우트 구성 … ## 9. API`)은 모두 숫자 번호 일관 패턴을 사용한다.
- **상세**: Part A/B는 번호 없이 "Part 레이블"을 쓰고 `## 3. API`는 숫자를 붙여, 같은 h2 depth에서 명명 방식이 다르다. 규약 위반은 아니지만 동일 영역 sibling 대비 스타일 일관성이 낮다.
- **제안**: `## Part A` → `## 1. Authentication (인증 설정)`, `## Part B` → `## 2. Models (모델 설정)`, `## 3. API` 유지 형태로 통일하거나, 현행 유지 시 별도 이슈 없음.

---

### 3. **[INFO]** `## 3. API` — 본문 섹션 번호가 Part 구분 이후 `3`에서 시작 (일관성 관찰)

- **target 위치**: line 252 `## 3. API`
- **위반 규약**: 명시 규약 없음 (관찰 수준).
- **상세**: Part A = 첫 번째 본문 섹션, Part B = 두 번째, `3. API`는 세 번째. 그러나 Part A/B에 번호가 없어 `3`이 뜬금없어 보인다. `5-knowledge-base.md`에서도 `## 3. API`를 동일 패턴으로 사용하고 있어 영역 내 일관성은 있다.
- **제안**: 발견사항 #2와 함께 정리하면 자연스럽게 해소됨.

---

## 부적합 없음 (PASS) 항목

아래 항목은 정식 규약을 준수하고 있다.

1. **frontmatter 의무 필드**: `id`, `status`, `code`, `pending_plans` 모두 존재. `spec-impl-evidence.md §2.1` 요건 충족.
2. **`status: partial` + `pending_plans:` 의무**: `pending_plans: plan/in-progress/spec-sync-config-gaps.md`가 명시되고 해당 파일이 `plan/in-progress/`에 실존함 (`spec-impl-evidence.md §3` + `spec-pending-plan-existence.test.ts` 요건 충족).
3. **`code:` glob 매치 가드**: `status: partial` 이므로 `code:` ≥ 1 매치 의무. 7개 경로 열거 (`spec-code-paths.test.ts` 요건 충족 예상).
4. **문서 3섹션 구조**: `## Overview (제품 정의)` / 본문(Part A, Part B, § 3. API) / `## Rationale` 구조를 갖춤.
5. **에러 코드 참조**: `RERANK_CONFIG_INVALID` — `UPPER_SNAKE_CASE` + `<DOMAIN>_<CONDITION>` 패턴 준수 (`error-codes.md §1`).
6. **audit 액션 참조**: `action='auth_config.reveal'` — `audit-actions.md §3` 레지스트리(`auth_config | 현재형(§2.2) | reveal`) 와 일치.
7. **`model_config` 감사 액션 미참조**: `model_config.set_default` 등 미구현 감사 액션을 spec 본문에서 직접 발행하지 않음 — `audit-actions.md §3` 미구현 레지스트리와 일치.
8. **API 경로 명명**: `/api/auth-configs`, `/api/model-configs` — kebab-case, `/api/` prefix 준수.
9. **`PATCH /api/model-configs/:id/set-default` HTTP method**: `set-default`는 리소스 상태 변경(is_default 플래그)이므로 PATCH가 적절. spec 본문에 이유 명시됨(§B.6.3).
10. **금지 항목 없음**: conventions에서 명시 금지한 패턴(`/api/llm-configs`, `/api/rerank-configs` 구 alias)을 본문이 "제거 완료"로 명시하고 신규 사용 없음.

---

## 요약

`spec/2-navigation/6-config.md`는 정식 규약(`spec/conventions/spec-impl-evidence.md`, `audit-actions.md`, `error-codes.md`)을 전반적으로 준수한다. frontmatter 의무 필드·`status: partial` 에 따른 `pending_plans:` 의무·plan 파일 실존·감사 액션 명명 등 모든 CRITICAL/WARNING 체크를 통과한다. 발견된 사항은 모두 INFO 수준으로, `id` 필드의 숫자 prefix 제거 관례(sibling 파일들과 동일 패턴)와 h2 섹션 헤딩 스타일 혼재(Part 레이블과 숫자 혼용)에 그친다. 구현 착수를 차단하는 규약 위반은 없다.

---

## 위험도

NONE
