# API 계약(API Contract) 리뷰

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**리뷰 범위**: `LlmModelConfigController` 인가 강화 (`testConnection @Roles('editor')` 추가) + 관련 테스트·e2e·plan 갱신

---

## 발견사항

### [INFO] testConnection — Viewer 에서 Editor+로의 의도적 breaking change

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L76–213 (`@Post(':id/test')` 핸들러)
- 상세: `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 추가로 기존에 인가 없이 호출 가능했던 Viewer 역할의 API 접근이 403 으로 차단된다. 이는 API 계약 관점에서 하위 비호환(breaking change)이다. 단, plan 기록(`02-architecture.md`)에 product sign-off 가 명시되어 있고 "UI 도달 경로 없음, 직접 API 갭 차단"으로 영향 범위가 한정된다. 의도된 변경이며 별도 PR 로 격리됐다.
- 제안: 외부 API 문서(changelog 또는 릴리스 노트)에 역할 요건 강화 사실을 명시하는 것을 권장한다. 현재 Swagger 에 `@ApiForbiddenResponse` 가 추가돼 있어 문서 수준에서는 선언됐으나, 소비자 공지 없이 배포 시 직접 API 통합 클라이언트가 403 을 예상하지 못할 수 있다.

---

### [INFO] testConnection 응답 — 미존재 리소스에서 200 + `{ success: false }` 반환

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 및 e2e `workspace-rbac.e2e-spec.ts` H 케이스 (`editorTest.body.data.success`)
- 상세: `testConnection` 은 존재하지 않는 config ID 에 대해서도 200 OK + `{ data: { success: false } }` 를 반환한다(best-effort 패턴). e2e 가 이 동작을 명시적으로 단언한다. 이 패턴은 일반적인 "리소스 없음 → 404" RESTful 규칙에서 벗어난다. 단, 이는 본 PR 이 도입한 신규 동작이 아닌 pre-existing 동작이며, 역할 가드 통과 증거로 활용된다.
- 제안: pre-existing 설계 결정이므로 본 PR 범위 밖이다. 향후 API 계약 검토 시 404 를 명시적으로 전파하는 방향을 고려하거나, Swagger 에 "설정 미존재 시에도 200 + success:false" 를 `description` 으로 명시해 소비자 혼선을 방지할 것을 권장한다.

---

### [INFO] listModels — 페이지네이션 미적용

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `@Get(':id/models')` 핸들러
- 상세: `GET /api/model-configs/:id/models` 는 `type` 쿼리 필터로 결과를 줄일 수 있으나 페이지네이션 매개변수(`page`/`limit`/커서)가 없다. 외부 Provider 가 반환하는 모델 목록이 수십~수백 개에 달하는 경우 응답 크기가 비확정적이다. 단, 실시간 Provider 호출 특성(외부 Provider 자체가 페이지네이션 없이 전체 목록 반환)을 고려하면 현재 설계가 실용적이다.
- 제안: Provider 모델 목록이 대형화될 때를 대비해 최대 결과 수 상한(`limit` 고정 또는 클라이언트 지정)을 API 계약에 정의해 두는 것을 고려한다. 현재는 차단 사유 없다.

---

### [INFO] listModels Swagger — workspace 외부인 403 미문서화

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `@Get(':id/models')` Swagger 어노테이션
- 상세: `listModels` 는 `@Roles` 가드가 없어 Viewer+ 가 통과하지만, 워크스페이스 비-멤버는 상위 워크스페이스 가드에 의해 403 을 받을 수 있다. 현재 Swagger 에는 `@ApiForbiddenResponse` 가 없다(역할 제한이 없으므로 생략 합리적). 단, 워크스페이스 멤버십 미충족 시의 403 경로가 문서화되지 않아 API 탐색 시 혼선이 생길 수 있다.
- 제안: 컨트롤러 전체에 적용되는 워크스페이스 멤버십 403 은 전역 Swagger 응답 혹은 컨트롤러 레벨 `@ApiForbiddenResponse` 로 일괄 선언하는 것을 검토한다. 현재는 차단 사유 없다.

---

## 요약

본 변경은 `POST /api/model-configs/:id/test` 엔드포인트에 `@Roles('editor')` 를 추가하고 Swagger에 `@ApiForbiddenResponse` 를 병기하는 최소 범위 인가 강화 PR이다. `GET :id/models` 의 Viewer+ 유지, `POST preview-models` 의 기존 Editor+ 동형 패턴과 정합하며, 역할 정책이 spec §3 + R-7 에 명문화된 후 구현된 절차를 따랐다. 컨트롤러 단위 테스트(메타데이터 단언)와 e2e 케이스 H 가 viewer→403·editor→200·listModels viewer→404 를 실 인프라로 검증한다. Viewer 역할 호출자에게는 breaking change 이나 product sign-off 확인, UI 미노출, 직접 API 갭 차단 목적 명시 등 거버넌스 조건이 충족됐다. HTTP 상태 코드·에러 응답 형식·URL 설계·요청 검증 모두 기존 계약과 일관된다. INFO 수준 참고사항 4건(의도적 breaking change 공지, best-effort 200 패턴, 페이지네이션 미적용, 워크스페이스 403 미문서화)이 확인되었으나 차단 사유는 없다.

---

## 위험도

LOW
