# 정식 규약 준수 검토 — `spec/2-navigation/6-config.md`

검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `id` 필드가 파일 basename 권장 표기와 다름

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter — `id: config`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일 basename은 `6-config`이지만 `id`는 `config`로 선언돼 있다. 규약은 "권장(recommended)"이지 의무는 아니며, 가드(`spec-frontmatter.test.ts`)도 `id`의 존재와 kebab-case 유효성만 검사한다. `config`는 현재 다른 spec과 충돌하지 않으므로 build 차단은 없다.
- **제안**: `id: 6-config`로 변경하면 basename 권장 패턴을 완전히 따르게 된다. 현재 `config`를 안정 식별자로 의도했다면 Rationale에 그 근거를 한 줄 남기는 것이 권장된다.

---

### [INFO] `PATCH /api/model-configs/:id/set-default` — 액션 성격 endpoint에 PATCH 사용

- **target 위치**: `spec/2-navigation/6-config.md` §3 API → Model Config API 표 3행
- **위반 규약**: `spec/5-system/2-api-convention.md §3` — "POST | 리소스 생성, 액션 실행 (멱등성 X)"
- **상세**: `set-default` 연산은 대상 레코드의 `is_default`를 true로 설정하는 동시에 동일 `(workspace_id, kind)` 내 다른 레코드의 `is_default`를 false로 초기화하는 cascade 부수효과를 수반한다. 이처럼 단일 리소스 부분수정의 경계를 넘어 여러 레코드에 영향을 주는 연산은 api-convention §3이 "액션 실행"으로 분류해 POST를 지정하는 패턴에 해당한다. 비교: 같은 도메인의 `POST /api/auth-configs/:id/regenerate`·`POST /api/auth-configs/:id/reveal` 은 유사한 부수효과 패턴에 POST를 사용한다. 현재 구현(`model-config.controller.ts:138` `@Patch(':id/set-default')`)과 spec이 일치하므로 런타임 충돌은 없으나, 향후 유사 endpoint 신설 시 선례로 작용할 수 있다.
- **제안**: (a) `POST /api/model-configs/:id/set-default`로 변경해 api-convention §3의 "액션 실행 = POST" 원칙을 일관 적용하거나, (b) 현 PATCH를 유지할 경우 Rationale에 "멱등성(`is_default` 단일 필드 수정)에 기반해 PATCH를 택했다"는 명시적 근거를 추가한다. 규약 자체를 갱신할 필요는 없으며 spec Rationale 추가로 충분하다.

---

### [INFO] `## 3. API` heading의 legacy 번호 접두사

- **target 위치**: `spec/2-navigation/6-config.md` — `## 3. API` 섹션 제목
- **위반 규약**: CLAUDE.md 권장 "Overview / 본문 / Rationale 3섹션" 구조 — 번호 접두사 규칙은 별도로 지정되지 않으나 동 문서 내 일관성 원칙
- **상세**: 문서 내 다른 최상위 섹션(`## Overview`, `## Part A: Authentication`, `## Part B: Models`, `## Rationale`)은 번호 접두사 없이 작성돼 있으나 API 섹션만 `## 3. API`로 번호를 붙이고 있다. Part A·B가 1·2에 해당하고 API가 3이라는 구 번호 체계의 잔재로 보인다. 문서 파싱·앵커 생성에 영향은 없다.
- **제안**: `## 3. API` → `## API`로 번호 접두사를 제거해 다른 섹션과 형식을 통일한다.

---

## 요약

`spec/2-navigation/6-config.md`는 `spec/conventions/spec-impl-evidence.md`의 frontmatter 의무 필드(`id`, `status`, `code:`)를 모두 갖추고 있으며, `spec/conventions/audit-actions.md`의 `auth_config.reveal` 표기도 `<resource>.<verb>` 구조 + 현재형(§2.2) 규칙과 정확히 일치한다. `spec/conventions/error-codes.md`의 UPPER_SNAKE_CASE 에러 코드(`MODEL_CONFIG_INVALID` 등)도 준수된다. 문서 구조는 Overview / 본문(Part A·B) / Rationale 3섹션 권장을 충족하고, API endpoint 명명(kebab-case 복수형 명사)도 `spec/5-system/2-api-convention.md §2.2` 규약을 따른다. 지적 사항 세 건은 모두 INFO 수준으로, 규약을 직접 위반해 다른 시스템의 invariant를 깨는 CRITICAL·WARNING 항목은 발견되지 않았다.

## 위험도

LOW
