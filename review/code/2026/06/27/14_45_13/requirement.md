# 요구사항(Requirement) 리뷰

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**리뷰 범위**: `LlmModelConfigController.testConnection` `@Roles('editor')` 추가 + `@ApiForbiddenResponse` Swagger 선언 + 단위/e2e 테스트 보강 + CHANGELOG 기재

---

## 발견사항

### [INFO] 기능 완전성 — 전 관점 이상 없음

변경된 코드가 의도한 기능(action-POST `:id/test` 를 Editor+ 로 게이트, GET `:id/models` 는 Viewer+ 유지)을 완전히 구현한다.

- `testConnection` 핸들러: `@Roles('editor')` + `@ApiForbiddenResponse` 추가. 가드 통과 후 `llmService.testConnection(id, workspaceId)` 위임 — 반환값 경로 완전.
- `listModels` 핸들러: `@Roles` 미적용 유지(Viewer+ 허용). 인라인 주석으로 의도 명문화.
- `previewModels` 핸들러: 기존 `@Roles('editor')` 변경 없음 — 대칭 패턴 유지.

### [INFO] Spec fidelity — spec과 구현 line-level 일치 확인

관련 spec 문서 2건을 Read하여 확인.

**`spec/2-navigation/6-config.md §3` Model Config API 표**:
- `POST /api/model-configs/:id/test` → "(Editor+ — 과금 action-POST)" → `@Roles('editor')` 적용 ✅
- `GET /api/model-configs/:id/models` → "(Viewer+ — 조회)" → `@Roles` 부재(의도적) ✅
- `POST /api/model-configs/preview-models` → "(Editor+ — 과금 action-POST)" → 기존 `@Roles('editor')` 유지 ✅
- Rationale R-7: "`:id/test` 만 게이트가 없던 비대칭(인가 갭)을 해소" → 정확히 이번 변경의 목적과 일치 ✅

**`spec/5-system/7-llm-client.md §8.3`** LlmService.testConnection 권한 항목:
- "권한: editor 이상. 컨트롤러 `LlmModelConfigController.testConnection` 의 `@Roles('editor')` 로 강제" → 코드에 `@Roles('editor')` 존재 ✅

spec이 명시한 필드명·에러코드·기본값·검증규칙이 모두 구현과 일치한다. 불일치 사항 없음.

### [INFO] 단위 테스트 — 메타데이터 단언 정합

`llm-model-config.controller.spec.ts` 내 `@Roles decorator presence` describe 블록이 3가지를 모두 검증한다:
1. `previewModels` → `ROLES_KEY` 메타데이터에 `'editor'` 포함 ✅
2. `testConnection` → `ROLES_KEY` 메타데이터에 `'editor'` 포함 ✅
3. `listModels` → `ROLES_KEY` 메타데이터가 `undefined` (Viewer+ 유지) ✅

`ROLES_KEY` 상수 (`roles.guard.ts` 에서 import)를 사용해 매직 스트링 하드코딩을 방지한다. `ROLES_KEY = 'roles'` 와 `SetMetadata(ROLES_KEY, roles)` 계약이 일치함을 실측으로 확인.

### [INFO] e2e 케이스 H — 시나리오 커버리지 완전

`workspace-rbac.e2e-spec.ts` 케이스 H가 다음 시나리오를 모두 포함한다:

| 시나리오 | 단언 | 근거 |
|---------|------|------|
| viewer → `POST :id/test` | `toBe(403)` | R-7: Editor+ 게이트 |
| viewer → `POST preview-models` | `toBe(403)` | R-7: 두 번째 action-POST 회귀 방지 |
| editor → `POST :id/test` | `not.toBe(403)` | 가드 통과 확인(authz 계약만 단언, 구현 세부 결합 없음) |
| viewer → `GET :id/models` | `not.toBe(403)` + `toBe(404)` | Viewer+ 유지 + 핸들러 실제 도달 확인 |

`missingId = '00000000-0000-4000-8000-000000000000'` 를 사용해 실제 provider 호출 없이 가드 레이어만 검증하는 방식은 테스트 안정성 측면에서 적절하다.

### [INFO] 엣지 케이스 처리

- `ParseUUIDPipe` 가 `testConnection`·`listModels` 의 `:id` 경로 파라미터에 UUID 유효성을 강제한다.
- `listModels` 의 `@Query('type')` 는 TypeScript 타입 `'chat' | 'embedding'` 으로 선언되나 런타임 enum 강제가 없다. 이는 pre-existing 사항(I1 in RESOLUTION.md 로 이미 defer 결정됨)으로 본 변경 범위 밖이다.
- `testConnection` 미존재 config → best-effort `200 { success: false }` (pre-existing 동작, 가드 통과 후 서비스 레이어 처리) — 본 변경이 도입한 동작이 아님.

### [INFO] CHANGELOG 기재

`CHANGELOG.md` 에 `## Unreleased — model-config :id/test 인가 강화` 섹션이 추가됐다. Breaking changes 항목에 Viewer → 403 변경 사실, 영향 범위(직접 API 호출 갭 차단), SoT 링크(`spec/2-navigation/6-config.md §3` + R-7, `spec/5-system/7-llm-client.md §8.3`)가 모두 기재됐다.

### [INFO] 비즈니스 로직 — 워크스페이스 공통 인증 계층과의 경계

`listModels` 에 `@ApiForbiddenResponse` 를 두지 않는 결정(인라인 주석에 명시)이 spec §3 와 일치한다. 워크스페이스 비-멤버의 403은 컨트롤러 공통 인증 계층 책임으로 역할 게이트와 별개 경로임을 코드와 주석이 정확히 반영한다.

---

## 요약

이번 변경은 spec/2-navigation/6-config.md §3 + Rationale R-7 및 spec/5-system/7-llm-client.md §8.3 이 명시적으로 요구하는 인가 계약을 정확히 구현한다. `testConnection`(`@Roles('editor')` 추가)·`listModels`(Viewer+ 유지 = `@Roles` 미적용)·`previewModels`(기존 Editor+ 불변)의 세 엔드포인트가 spec 표·R-7·§8.3 과 line-level 로 일치한다. 단위 테스트는 `ROLES_KEY` 상수 import 참조로 메타데이터를 안전하게 단언하며, e2e 케이스 H는 viewer→403, editor→가드통과, listModels viewer→404 세 시나리오를 실 인프라로 검증한다. 기능 누락·엣지 케이스 미처리·의도-구현 괴리·spec 불일치 항목이 없다.

---

## 위험도

NONE
