# 정식 규약 준수 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
> 검토 모드: spec draft (--spec)
> 검토 기준: `spec/conventions/**`

---

## 발견사항

### [INFO] plan frontmatter 필드 구성 — 정합

- target 위치: 파일 최상단 frontmatter (`worktree`, `started`, `owner`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4`
- 상세: `worktree: .claude/worktrees/auth-config-webhook-wiring`, `started: 2026-05-28`, `owner: project-planner` 세 필드 모두 스키마와 일치. 이상 없음.
- 제안: 해당 없음.

---

### [INFO] plan 파일 위치 및 명명 — 정합

- target 위치: 파일 경로 `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
- 위반 규약: `.claude/docs/plan-lifecycle.md §1` + `CLAUDE.md §정보 저장 위치`
- 상세: `plan/in-progress/` 에 위치하며, kebab-case 파일명으로 명명 규약을 준수한다.
- 제안: 해당 없음.

---

### [WARNING] spec draft 문서가 spec 파일이 아닌 plan 파일로 작성됨 — 역할 혼동 가능

- target 위치: 본문 전체 (## 1~## 8 각 섹션)
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md`", "기술 명세 → `spec/<영역>/*.md`", "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: 본 문서는 "spec 7 파일 변경안"을 담은 plan-side draft 로, 실제 spec 변경 내용(§2.17 JSONB 스키마, WH-SC-0X 표, §3.2 권한 매트릭스 등)이 spec 파일이 아닌 plan 파일 안에 위치한다. 본 draft 는 `/consistency-check --spec` 통과 후 실제 spec 파일에 반영하기 위한 중간 산출물이므로 이 패턴 자체가 의도적임을 본문이 명시(첫 번째 인용 블록)하고 있다. 다만 CLAUDE.md 는 "spec 는 `spec/` 에, plan 은 `plan/` 에"라는 단일 진실 원칙을 명시하므로, plan 파일이 spec 변경 내용의 임시 본문을 그대로 포함하는 패턴에 대해 규약 문서에 명시적인 허용 문구가 없다는 점에서 거리감이 있다.
- 제안: (1) 운영 관례로 허용할 경우 `.claude/docs/plan-lifecycle.md` 또는 CLAUDE.md 에 "Phase 0 spec draft 는 `plan/in-progress/spec-draft-<slug>.md` 에 작성, consistency-check 통과 후 실제 spec 에 반영"이라는 한 줄 예외 허용 문구를 추가 권장. (2) target 문서 자체는 수정 불요 — 규약이 명시적으로 이 패턴을 다루도록 갱신하는 것이 올바른 방향.

---

### [INFO] 문서 구조 — Overview/본문/Rationale 3섹션 부분 준수

- target 위치: 본문 전체
- 위반 규약: `CLAUDE.md §정보 저장 위치` (Rationale 은 해당 spec 문서 끝의 `## Rationale` 권장)
- 상세: 본 draft 는 plan 문서이므로 spec 의 3섹션 구조 강제 대상이 아니다. 대신 각 spec 변경 섹션(§1~§7) 안에 "Rationale 추가" 항목을 명시적으로 포함하고 있어 Rationale 의도는 충실히 반영됐다. `## 동기` 섹션이 전반적인 배경을 제공하고 있어 Overview 역할도 수행한다.
- 제안: 해당 없음. 현재 구조가 plan draft 로서 적절하다.

---

### [INFO] Migration 명명 규약 — 준수

- target 위치: `## Migration 번호 (확인됨)` 섹션 및 `## Migration 컨벤션 (W-7 해소)` 섹션
- 위반 규약: `spec/conventions/migrations.md §1`
- 상세:
  - `V064__auth_config_type_add_hmac.sql` — `V<번호>__<snake_case_descriptor>.sql` 형식 준수.
  - `V065__trigger_config_strip_inline_auth.sql` — 동일.
  - alphanumeric suffix 없음 (`V064a`, `V064_1` 등 금지 패턴 없음). 단조 증가 (`V063` 다음 `V064`→`V065`).
  - draft 가 "W-7 해소" 섹션에서 명시적으로 `spec/conventions/migrations.md §1` alphanumeric suffix 금지 원칙 준수를 선언하고 있다.
- 제안: 해당 없음.

---

### [INFO] secret-store 규약 비대상 처리 — 준수

- target 위치: `## 7. spec/conventions/secret-store.md` 섹션 (§7.1, §7.2, §7.3)
- 위반 규약: `spec/conventions/secret-store.md §1` (URI Scheme 적용 대상)
- 상세: draft 가 `AuthConfig.config` 는 `secret://` scheme 의 비대상임을 명시하고(§7.1), `§4.A` 마스킹 단락 삽입 계획을 C-4 일관성 문제로 철회(§7.2)하는 등 secret-store 규약의 경계를 정확히 인식하고 있다. Changelog 에만 외부 링크 한 줄을 추가하는 것으로 convention 파일 자체의 변경을 최소화한다(§7.3). 단일 진실 원칙에 부합.
- 제안: 해당 없음.

---

### [WARNING] spec-impl-evidence frontmatter 갱신 의무 누락 — 명시 부재

- target 위치: `## Side-effect 영향 영역` 섹션 및 `## 2. spec/5-system/12-webhook.md §2.9`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` → `partial` → `implemented` 라이프사이클 전이 규칙; `spec/conventions/spec-impl-evidence.md §2` — frontmatter `id`, `status`, `code:` 의무
- 상세: §2.9 에서 `12-webhook.md` frontmatter 를 Phase 6 완료 후 `status: implemented` + `code:` 글로브로 격상할 계획을 명시하고 있다. 그러나 변경 대상인 `spec/5-system/1-auth.md`, `spec/2-navigation/6-config.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/10-triggers.md` 의 frontmatter 갱신 계획(status 전이 + code: 글로브 추가)이 명시되어 있지 않다. `spec-impl-evidence.md §1` 의 적용 대상(`spec/2-navigation/**.md`, `spec/5-system/**.md`, `spec/data-flow/**.md` 등)이므로 모든 변경 대상 spec 파일에 동일한 격상 계획이 필요하다. `spec/conventions/spec-impl-evidence.md` Side-effect 목록에도 언급됐으나("본 PR 후 `12-webhook.md`·`6-config.md` frontmatter `code:` 글로브 추가") 일부만 포함하고 있다.
- 제안: Side-effect 영향 영역 목록에 다음을 추가 명시:
  - `spec/2-navigation/2-trigger-list.md` frontmatter: `status` 전이 + `code:` 글로브 (`codebase/frontend/src/components/triggers/**`) 갱신
  - `spec/2-navigation/6-config.md` frontmatter: 동일 (6-config Part A)
  - `spec/5-system/1-auth.md` frontmatter: Reveal 권한 추가에 따른 `code:` 갱신
  - `spec/data-flow/10-triggers.md` frontmatter: 인증 분기 재작성에 따른 `code:` 갱신

---

### [WARNING] swagger 규약 처리 — 부분 명시, Forbidden 응답 데코레이터 누락

- target 위치: `## swagger (I-9)` 섹션
- 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙), `§5-4` 새 엔드포인트 체크리스트
- 상세: draft 가 `POST /:id/reveal` 의 `@ApiResponse` + 401/403 데코레이터 명시를 developer Phase 2 에 위임한다. `spec/conventions/swagger.md §2-4` 에서 "보호된 엔드포인트는 기본적으로 `@ApiUnauthorizedResponse` 포함" + `@Roles(...)` 붙은 엔드포인트는 `@ApiForbiddenResponse` 도 추가"를 의무화한다. 또한 `§5-4` 체크리스트에 따르면 신규 엔드포인트에 응답 DTO 클래스(`dto/responses/*-response.dto.ts`) 위치도 spec 단계에서 언급될 필요가 있다. reveal 응답 DTO 명칭(`RevealAuthConfigResponseDto` 등)이 명시되지 않아 developer 가 규약 없이 결정해야 한다.
- 제안: swagger 섹션에 다음 추가:
  - `@ApiOkWrappedResponse(RevealAuthConfigResponseDto)` 래퍼 헬퍼 사용 명시 (`spec/conventions/swagger.md §5-2` 공용 헬퍼 의무)
  - 응답 DTO 경로: `codebase/backend/src/modules/auth-configs/dto/responses/reveal-auth-config-response.dto.ts`
  - `@ApiForbiddenResponse` 의무 명시 (Admin+ 전용 엔드포인트이므로 `@Roles` 필요)

---

### [INFO] API endpoint 경로 명명 — 준수

- target 위치: `§4.6 §3 API 표 — reveal 행 추가` 및 `§5.2 §3 API 표`
- 위반 규약: `spec/conventions/swagger.md §2-3`, `CLAUDE.md` (일반 REST 관례)
- 상세: `POST /api/auth-configs/:id/reveal` — 리소스 기준 nested action 형식. `:id` UUID 파라미터. `/api/auth-configs/:id/regenerate` 와 동일 패턴. REST 관례상 적절하며 swagger.md §2-3 의 `@ApiParam({ format: 'uuid' })` 적용 가능한 형태.
- 제안: 해당 없음.

---

### [INFO] 에러 코드 명명 규약 — 일관적

- target 위치: WH-SC-04, §2.7 인증 검증 흐름, `§6.1 sequence`
- 위반 규약: 별도 에러 코드 규약 없음 (spec/conventions/ 에 에러 코드 전용 규약 파일 미존재)
- 상세: `AUTH_FAILED` 단일 메시지 정책이 WH-SC-04 cross-ref 와 함께 일관되게 유지됐다. SCREAMING_SNAKE_CASE 형식으로 기존 에러 코드 패턴과 일치.
- 제안: 해당 없음.

---

### [INFO] `_product-overview.md` / `0-` prefix 규약 — 적용 범위 외

- target 위치: 본 plan 문서 전체
- 위반 규약: `CLAUDE.md §정보 저장 위치`
- 상세: `_product-overview.md` 와 `0-` prefix 규약은 `spec/` 디렉토리 내 spec 파일에 적용되는 규약이다. 본 문서는 `plan/in-progress/` 의 plan draft 이므로 해당 규약의 적용 범위 밖이다.
- 제안: 해당 없음.

---

### [INFO] 단일 진실(SoT) 선언 일관성 — 양호

- target 위치: §1 `§2.17.2 마스킹·노출 정책` 및 `§4.5 §A.4`
- 위반 규약: `CLAUDE.md §정보 저장 위치` — 단일 진실 원칙
- 상세: 마스킹 정책 SoT 를 `spec/1-data-model.md §2.17.2` 로 단일화하고, `spec/2-navigation/6-config.md §A.4` 에서는 "정의 SoT 는 `spec/1-data-model.md §2.17.2`" 참조만 하도록 명시한다. C-4 해소로 `secret-store.md` 에 중복 기재도 철회됐다. 단일 진실 원칙이 잘 지켜지고 있다.
- 제안: 해당 없음.

---

## 요약

`plan/in-progress/spec-draft-auth-config-webhook-wiring.md` 는 정식 규약과의 충돌 수준이 전반적으로 낮다. Migration 명명(V064/V065)·secret-store 경계 처리·단일 진실 원칙 모두 규약을 인식하고 준수하고 있다. 핵심 WARNING 2건: (1) spec-impl-evidence frontmatter 갱신 계획이 `12-webhook.md`·`6-config.md` 외 나머지 변경 대상 spec 파일(`1-auth.md`, `2-trigger-list.md`, `10-triggers.md`)에도 명시되지 않은 누락, (2) `POST /:id/reveal` swagger 데코레이터 규약(`@ApiForbiddenResponse`, 응답 DTO 명칭, `ApiOkWrappedResponse` 헬퍼)이 developer 에 위임되면서 스펙에서 누락됐다는 점. plan draft 가 plan 파일로 작성되는 패턴에 대해 규약 문서에 허용 문구가 없다는 점(WARNING)은 규약 갱신으로 해소하는 것이 적절하며 target 문서 수정 불요.

---

## 위험도

**LOW**
