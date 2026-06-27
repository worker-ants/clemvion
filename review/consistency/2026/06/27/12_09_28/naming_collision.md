# 신규 식별자 충돌 검토 — naming_collision

검토 대상: `spec/2-navigation/6-config.md` (구현 완료 후 검토, diff-base=origin/main)
변경 파일:
- `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
- `codebase/backend/src/modules/llm/llm-model-config.controller.ts`
- `codebase/backend/test/workspace-rbac.e2e-spec.ts`

---

## 발견사항

충돌에 해당하는 발견사항이 없습니다.

---

## 식별자별 점검 결과

### ROLES_KEY (상수 import)

- diff 는 `llm-model-config.controller.spec.ts` 에 `import { ROLES_KEY } from '../../common/guards/roles.guard'` 를 추가한다.
- `ROLES_KEY` 는 `/codebase/backend/src/common/guards/roles.guard.ts:10` 에 `export const ROLES_KEY = 'roles'` 로 이미 선언·공개되어 있으며, `roles.guard.spec.ts`, `audit-logs.spec.ts`, `folders.controller.spec.ts`, `auth-configs.controller.spec.ts`, `agent-memory.controller.spec.ts` 에서 동일 방식으로 import 해 사용 중이다.
- 신규 식별자 도입이 아닌 기존 상수 재사용이다. 충돌 없음.

### @Roles('editor') / @ApiForbiddenResponse (데코레이터)

- `testConnection` 핸들러에 추가된 `@Roles('editor')` 와 `@ApiForbiddenResponse` 는 `roles.guard.ts` 및 NestJS Swagger 에서 이미 정의된 데코레이터다.
- 동일 컨트롤러의 `previewModels` 에도 이미 동일하게 적용되어 있어 충돌 없음.

### 테스트 케이스 레이블 'H.'

- `workspace-rbac.e2e-spec.ts` 에 새로 추가된 `it('H. POST /api/model-configs/:id/test ...')` 레이블은 기존 A(line 39) · B(81) · C(134) · D(168) · E(211) · F(267) · G(293) 에 이어 순차적이다.
- 기존 파일 내 H 레이블이 없었음을 확인했다. 충돌 없음.

### 테스트 픽스처 식별자 (uniqueEmail / uniqueName 접두사)

- 새 테스트가 사용하는 접두사 `rbac-h-own`, `rbac-h-view`, `rbac-h-edit`, `uniqueName('H')` 는 기존 A~G 테스트가 사용하는 `rbac-{a..g}-*` / `uniqueName('{A..G}')` 와 중복되지 않는다.

### R-7 (Rationale 앵커 ID)

- 코드 주석이 참조하는 `spec §3·R-7` 는 `spec/2-navigation/6-config.md:341` 의 `### R-7. action-POST 인 test 와 preview-models 를 Editor 로 게이트` 를 가리킨다.
- 이 R-7 은 본 diff 이전부터 `spec/2-navigation/6-config.md` 에 존재했으며 diff 가 새로 도입한 ID 가 아니다.
- 참고로 `R-7` 은 다른 spec 파일(`spec/2-navigation/2-trigger-list.md:279`, `spec/conventions/spec-impl-evidence.md:228`) 에도 파일 로컬 Rationale 앵커로 존재하지만, 각 파일 내부의 독립 앵커이므로 전역 ID 충돌에 해당하지 않는다.

### 새 API endpoint

- diff 는 새 endpoint 를 도입하지 않는다. `POST /api/model-configs/:id/test` 와 `GET /api/model-configs/:id/models` 는 기존 컨트롤러에 이미 있던 라우트이며, 이번 변경은 기존 핸들러에 가드·Swagger 데코레이터를 추가하는 수정이다.

---

## 요약

이번 diff 가 도입하는 식별자는 모두 기존 정의의 재사용(ROLES_KEY 상수 import, @Roles/@ApiForbiddenResponse 데코레이터) 또는 파일 내 순차적 확장(테스트 레이블 H, 픽스처 접두사 rbac-h-*)에 해당한다. 새로운 전역 식별자 도입이 없으며, 기존 사용처와 의미가 다른 동명 식별자도 없다. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 모두 충돌 없음.

## 위험도

NONE
