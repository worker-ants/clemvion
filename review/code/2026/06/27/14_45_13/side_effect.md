# 부작용(Side Effect) 리뷰

리뷰 대상: authz follow-up 2차 — `testConnection @Roles('editor')` + 테스트·스펙·플랜·CHANGELOG·이전 리뷰 산출물 일체
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] testConnection 인가 동작 변경 (의도된 부작용)

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `@Post(':id/test')` 핸들러에 `@Roles('editor')` 추가
- 상세: `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 가 추가됨으로써 이전까지 워크스페이스 Viewer 가 직접 호출 가능하던 엔드포인트가 Editor+ 전용으로 제한된다. `RolesGuard.canActivate` 는 `workspacesService.getMemberRole` DB 조회 후 역할 계층(`ROLE_HIERARCHY`)을 비교해 403 을 반환한다. 이 변경은 spec `6-config.md §3 R-7` 및 product sign-off 에 근거한 의도된 인가 행동 변경이다. UI 경로(모델 추가/수정 폼)는 이미 Editor+ 전용이므로 일반 사용자 흐름에 영향이 없고 직접 API 호출 갭만 차단된다.
- 연쇄 부작용: `testConnection` 은 저장된 Provider 자격증명으로 외부 LLM 호출 + `ModelConfig.dimension` 자동 PATCH 저장이라는 두 부수효과를 내포한다. `@Roles('editor')` 추가로 Viewer 에 의한 이 두 부수효과가 함께 차단된다 — 의도된 효과이며 보안 개선이다.
- 제안: 없음 — spec R-7 과 plan C-2 cluster 4 authz follow-up 에 근거가 충분하고 product sign-off 가 완료됐다.

---

### [INFO] `Reflect.metadata` 범위 — 클래스 프로토타입 메서드에 국한

- 위치: `codebase/backend/src/common/guards/roles.guard.ts` — `export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)`
- 상세: `@Roles('editor')` 는 내부적으로 `Reflect.defineMetadata(ROLES_KEY, roles, target)` 를 수행해 `LlmModelConfigController.prototype.testConnection` 에 메타데이터를 설정한다. 이는 해당 프로토타입 메서드에 한정된 변경으로, 전역 `Reflect` 네임스페이스나 다른 클래스/메서드에는 영향이 없다. NestJS가 이 메타데이터를 `RolesGuard` 내 `Reflector.getAllAndOverride` 로만 읽으므로 다른 가드·인터셉터·서비스의 동작을 변경하지 않는다.
- 제안: 없음.

---

### [INFO] `ROLES_KEY` import 추가 — 신규 전역 변수 없음

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — `import { ROLES_KEY } from '../../common/guards/roles.guard'`
- 상세: `ROLES_KEY = 'roles'` 는 이미 `roles.guard.ts` 에 export 로 존재하던 상수다. 이번 변경은 테스트 파일에서 해당 상수를 import 한 것뿐이며 새 전역 변수를 도입하지 않는다. 매직 스트링 하드코딩을 제거하는 개선이다.
- 제안: 없음.

---

### [INFO] `listModels` — `@Roles` 미적용 유지로 인한 Viewer+ 동작 불변

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `@Get(':id/models')` 핸들러
- 상세: 이번 변경에서 `listModels` 는 `@Roles` 를 받지 않았다. `RolesGuard` 는 `requiredRoles` 가 없으면 자동 통과(`return true`)를 반환하므로, `listModels` 에 대한 Viewer 접근 동작은 이전과 완전히 동일하다. 의도적 미적용이 코드 주석으로도 명시됐다.
- 제안: 없음.

---

### [INFO] e2e 테스트 케이스 H — 테스트 DB 엔티티 정리 부재

- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 케이스 H
- 상세: 케이스 H 에서 생성하는 owner·viewer·editor 사용자 및 워크스페이스는 `afterAll` 에서 명시적으로 삭제되지 않는다. 이는 기존 케이스 A–G 와 동일한 패턴이며 e2e 환경 특성상 격리된 테스트 DB 에서 실행되므로 운영 데이터에 영향이 없다. `uniqueEmail('rbac-h-...')` 로 이메일 충돌 가능성을 회피한다.
- 제안: 없음 — 기존 패턴과 일관되며 테스트 환경 격리가 전제된다.

---

### [INFO] 이전 리뷰 산출물 파일 생성 — 의도된 파일시스템 변경

- 위치: `review/code/2026/06/27/11_46_32/` 하위 파일들 (RESOLUTION.md, SUMMARY.md, _retry_state.json, api_contract.md, documentation.md, maintainability.md, requirement.md, scope.md, security.md, side_effect.md, meta.json)
- 상세: 이번 diff 에 포함된 `review/code/2026/06/27/11_46_32/` 하위 파일들은 이전 리뷰 세션의 산출물이다. 이들은 런타임 코드에 영향을 주지 않는 문서 파일로, 프로젝트 규약(CLAUDE.md §정보 저장 위치)에 따른 의도된 파일시스템 변경이다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` 데코레이터를 추가하고 이를 검증하는 테스트·스펙·플랜·CHANGELOG 를 갱신하는 것이다. 전역 변수 도입, 예상치 못한 파일 생성·수정·삭제, 환경 변수 읽기·쓰기, 의도하지 않은 외부 서비스 호출, 이벤트·콜백 흐름 변경은 발견되지 않았다. 함수 시그니처(`testConnection`, `listModels`, `previewModels`)는 불변이며 공개 API URL 구조도 변경이 없다. `@Roles` 데코레이터가 설정하는 Reflect 메타데이터는 해당 프로토타입 메서드에 국한돼 다른 핸들러나 전역 상태에 영향을 미치지 않는다. `listModels` 는 `@Roles` 를 의도적으로 부여하지 않아 Viewer+ 접근이 정확히 유지된다. 유일한 동작 변화는 Viewer 의 `POST /api/model-configs/:id/test` 직접 호출이 403 으로 전환되는 것인데, 이는 spec R-7 및 product sign-off 에 의해 명시적으로 승인된 인가 계약 변경이다. 의도하지 않은 부작용은 없다.

---

## 위험도

LOW

---

STATUS=success CRITICAL=0 WARNING=0 RISK=low PATH=/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/review/code/2026/06/27/14_45_13/side_effect.md
