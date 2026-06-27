# 변경 범위(Scope) 리뷰 결과

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**변경 의도**: `POST /api/model-configs/:id/test` — Viewer 호출 차단(Editor+ 강제)

---

## 발견사항

### [INFO] listModels 관련 테스트 추가 — 직접 구현 변경 없는 기존 동작 확인
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (listModels 메타데이터 단언), `codebase/backend/test/workspace-rbac.e2e-spec.ts` 케이스 H (viewerModels → 404)
- 상세: 핵심 의도는 `testConnection` 에 `@Roles('editor')` 를 추가하는 것이다. `listModels` 에는 신규 구현 변경이 없음에도 "Viewer+ 유지" 확인 테스트가 함께 추가됐다. `testConnection`(Editor+) 대비 `listModels`(Viewer+) 의 의도적 비대칭을 명시적으로 검증하는 것으로, 인가 계약 완전성 측면에서 정당화된다. `@Roles` 추가 후 인접 엔드포인트가 의도치 않게 제한되지 않았음을 regression 관점에서 확인하는 역할도 한다.
- 제안: 현행 유지. 범위 이탈이 아닌 계약 완전성 확인으로 판단한다.

### [INFO] `ROLES_KEY` 임포트 추가 및 기존 `previewModels` 테스트 키 교체
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — import 추가(L3), 기존 `Reflect.getMetadata('roles', ...)` → `Reflect.getMetadata(ROLES_KEY, ...)` 교체(L83)
- 상세: 신규 테스트 2건이 `ROLES_KEY` 를 사용하므로 import 자체는 직접 필요한 추가다. 기존 `previewModels` 테스트의 매직 스트링 교체는 W3 리뷰 지적 사항의 fix 로 수행됐으며, 동일 `describe` 블록 내에서 같은 상수를 일관되게 사용하기 위한 최소 범위 정리다. `previewModels` 동작 자체는 변경되지 않는다.
- 제안: 현행 유지. 리뷰 fix 범위 내 허용 가능 수정이다.

### [INFO] `listModels` 핸들러 인라인 주석 추가
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L141–143
- 상세: `listModels` 에 `@Roles` 가 미적용된 것이 의도적임을 설명하는 3줄 주석이 추가됐다. `testConnection` 에 `@Roles('editor')` 가 추가되면서 바로 아래 `listModels` 와의 비대칭이 생겨 "의도적 생략인지 누락인지" 를 명시할 필요가 생긴 것으로, 이번 변경의 직접 파생이다.
- 제안: 현행 유지. 변경 맥락을 설명하는 적절한 주석이다.

### [INFO] spec 파일 2건 변경 포함
- 위치: `spec/2-navigation/6-config.md` (§3 표 권한 표기 + R-7 Rationale), `spec/5-system/7-llm-client.md` §8.3 (권한 줄 추가)
- 상세: plan (`02-architecture.md`) 이 "planner 선행 업무"로 명시한 사항 — `6-config.md §3` 표에 Editor+/Viewer+ 명문화 + R-7 Rationale 신설, `7-llm-client.md §8.3` 권한 줄 추가 — 이 본 PR 에 동행 포함됐다. SDD 규약상 developer 구현 전 planner spec 갱신이 선행돼야 하며, 그 선행 작업 결과가 이번 PR 에 포함된 것이다. 직접 authz 구현(controller `@Roles`)의 근거 문서화 목적으로 범위 내에 해당한다.
- 제안: 현행 유지. plan 이 명시한 planner 선행 업무 이행이며 구현의 spec 근거를 확립한다.

### [INFO] 리뷰·일관성 검토 산출물 다수 포함
- 위치: `review/code/2026/06/27/11_46_32/` (ai-review 8개 reviewer 산출물 + RESOLUTION + SUMMARY), `review/consistency/2026/06/27/11_20_31/` (impl-prep consistency check), `review/consistency/2026/06/27/12_09_28/` (impl-done consistency check)
- 상세: 프로젝트 개발자 워크플로우가 구현 후 `/ai-review` + `consistency-check` 를 필수 단계로 요구하며, 그 산출물을 `review/` 하위에 커밋하도록 정의돼 있다. 이 파일들은 모두 현재 PR 의 authz 변경을 대상으로 수행한 리뷰 및 일관성 검토의 결과물로, 워크플로우 규약에 따른 필수 산출물이다.
- 제안: 현행 유지. 무관한 파일 포함이 아니라 프로젝트 필수 프로세스 산출물이다.

---

## 요약

이번 변경은 `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 를 추가해 Viewer 직접 API 호출을 차단하는 단일 목적 PR 이다. 모든 파일이 그 목적에 직접 귀결된다. 컨트롤러 변경(1개 데코레이터 + 1개 Swagger 선언 + 1개 주석)은 최소 범위이며, 단위 테스트·e2e 테스트는 authz 계약 쌍(testConnection=Editor+, listModels=Viewer+)을 완전히 검증하기 위한 필요 범위 내 추가다. spec 파일 변경은 plan 이 명시한 planner 선행 의무 사항이고, CHANGELOG 는 breaking change 공지 의무 이행이며, plan 갱신은 추적 문서 현행화다. review/consistency 산출물은 프로젝트 워크플로우가 강제하는 프로세스 결과물이다. 무관한 리팩토링, 기능 확장, 의미 없는 포맷팅 변경, 관련 없는 파일 수정은 일체 발견되지 않았다.

---

## 위험도

NONE
