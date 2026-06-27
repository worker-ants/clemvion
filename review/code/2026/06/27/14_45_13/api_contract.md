# API 계약(API Contract) 리뷰

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**리뷰 세션**: 2026-06-27 14:45:13
**변경 개요**: `LlmModelConfigController.testConnection` 에 `@Roles('editor')` + `@ApiForbiddenResponse` 추가, 단위/e2e 테스트 보강, CHANGELOG 기록

---

## 발견사항

### [INFO] `POST /api/model-configs/:id/test` — 의도된 breaking change, 문서화 충족

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `@Post(':id/test')` 핸들러 + `CHANGELOG.md` `## Unreleased — model-config :id/test 인가 강화`
- 상세: Viewer 역할의 직접 API 호출이 이제 403을 받는다. 이는 API 계약 관점에서 하위 비호환(breaking change)에 해당한다. 단, (1) CHANGELOG에 "Breaking changes" 섹션으로 명시적으로 기록됐고, (2) `@ApiForbiddenResponse` Swagger 선언이 구현과 동일 변경으로 추가됐으며, (3) plan 기록(`02-architecture.md`)에 product sign-off 및 "UI 도달 경로 없음, 직접 API 갭 차단" 범위 한정이 명시돼 있다. 거버넌스 조건이 충족된 상태다.
- 제안: 외부 API 통합 클라이언트가 Viewer 자격증명으로 이 엔드포인트를 직접 호출하던 경우를 위해 릴리스 시 공지하는 것을 권장한다. 이는 CHANGELOG 기재로 일차 충족되나, 별도 릴리스 노트나 이메일 공지가 있다면 추가적으로 보강될 수 있다. 현재 차단 사유 없음.

---

### [INFO] `testConnection` — 미존재 리소스에서 `200 + { success: false }` 반환 (pre-existing)

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `testConnection` 핸들러, `codebase/backend/test/workspace-rbac.e2e-spec.ts` 케이스 H
- 상세: e2e 주석 및 코드 구조상 `testConnection`은 존재하지 않는 config ID에 대해 catch로 흡수해 `200 OK + { success: false }`를 반환하는 best-effort 패턴이다. 일반적인 "리소스 없음 → 404" RESTful 규칙에서 벗어나며, editor 가드 통과 단언이 `not.toBe(403)`으로 수정(W2 FIXED)되어 이 구현 세부에 결합되지 않게 됐다. 이는 본 PR이 도입한 신규 동작이 아닌 pre-existing 설계이며, 이번 변경 후에도 동작이 변경되지 않았다.
- 제안: 향후 API 계약 검토 시 미존재 config에 대한 404 명시적 전파를 고려하거나, Swagger `description`에 "설정 미존재 시에도 200 + `success: false`" 동작을 명시해 소비자 혼선을 방지할 것을 권장한다. 본 PR 범위 외 사항이며 차단 사유 없음.

---

### [INFO] `listModels` — 페이지네이션 미적용 (pre-existing)

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `@Get(':id/models')` 핸들러
- 상세: `GET /api/model-configs/:id/models`는 `type` 쿼리 필터만 있고 페이지네이션 매개변수가 없다. Provider 모델 목록이 수십~수백 개로 증가할 경우 응답 크기가 비확정적이다. 단, 현재 외부 Provider API 자체가 전체 목록을 반환하는 구조이므로 실용적 설계다. 이 또한 pre-existing 상태이며 본 PR이 변경하지 않았다.
- 제안: Provider 모델 목록이 대형화될 때를 대비해 최대 결과 수 상한(`limit` 고정값 또는 클라이언트 지정)을 API 계약에 정의해 두는 것을 고려한다. 별건 개선으로 분류, 현재 차단 사유 없음.

---

### [INFO] `listModels` Swagger — 워크스페이스 비-멤버 403 미문서화 (의도적, 주석 명시됨)

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `@Get(':id/models')` Swagger 어노테이션, 해당 핸들러 위 인라인 주석
- 상세: `listModels`는 `@Roles` 가드가 없어 Viewer+가 통과한다. `@ApiForbiddenResponse`를 두지 않은 것이 의도적임을 인라인 주석("조회(Viewer+) — @Roles 미적용이 의도적이다")으로 명시해 previous session에서 지적된 I6 항목이 해소됐다. 단, 워크스페이스 비-멤버가 호출하면 상위 멤버십 가드에서 403을 내는 경로는 여전히 Swagger 문서에 반영되지 않는다. 이 403은 컨트롤러 공통 인증 계층 책임이므로 컨트롤러 레벨 선언 생략이 합리적이다.
- 제안: 컨트롤러 전체에 적용되는 워크스페이스 멤버십 403을 전역 Swagger 설정 또는 컨트롤러 레벨 `@ApiResponse`로 일괄 선언하는 방안을 검토할 수 있다. 현재 차단 사유 없음.

---

### [INFO] 역할 정책 대칭성 — spec §3·R-7과 완전 정합

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 전체
- 상세: action-POST(`testConnection`, `previewModels`) = Editor+, GET 조회(`listModels`) = Viewer+ 라는 역할 정책이 컨트롤러 수준에서 일관되게 적용됐다. spec §3 표 및 R-7 Rationale에 명문화된 계약과 구현이 일치한다. `@ApiForbiddenResponse`도 action-POST 두 메서드에만 선언되어 Swagger 선언과 역할 게이트가 정합한다. 긍정적 확인 사항이다.

---

## 요약

본 변경은 `POST /api/model-configs/:id/test`에 `@Roles('editor')` 인가 게이트를 추가하고 Swagger에 `@ApiForbiddenResponse`를 병기한 최소 범위 인가 강화 PR이다. Viewer 역할 호출자에게 breaking change이나, CHANGELOG에 "Breaking changes" 섹션으로 명시되고 product sign-off·UI 미노출·직접 API 갭 차단 목적이 plan에 기록된 상태로 거버넌스 조건이 충족됐다. HTTP 상태 코드(403)는 적절하며, Swagger 선언이 구현과 일치하고, URL 경로·요청 검증·에러 응답 형식 모두 기존 계약과 일관된다. `GET :id/models`의 Viewer+ 유지, `POST preview-models`의 기존 Editor+ 패턴과 대칭을 이루며 spec §3·R-7에 근거한 역할 정책이 API 수준에서 완전히 구현됐다. INFO 수준 항목 4건(breaking change 외부 공지 권장, best-effort 200 패턴, 페이지네이션 미적용, 워크스페이스 403 미문서화)은 모두 pre-existing 사항이거나 허용된 설계 결정이며 차단 사유 없다.

---

## 위험도

LOW

---

STATUS=success ISSUES=0
