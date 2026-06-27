# Documentation Review

## 발견사항

### 발견사항 1
- **[WARNING]** CHANGELOG 에 behavior-breaking 변경 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/CHANGELOG.md`
  - 상세: `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 가 추가됨으로써 기존에 Viewer 역할 사용자도 호출 가능하던 엔드포인트가 이제 403 을 반환한다. 이는 외부 API 계약 관점에서 breaking behavior change 에 해당한다. 현재 CHANGELOG 에는 npm audit 패치와 EIA 검증 추가 항목만 있으며 이 인가 갭 해소 변경은 기록돼 있지 않다. API 클라이언트나 자동화 스크립트가 Viewer 자격증명으로 `:id/test` 를 직접 호출해온 경우 이 항목이 마이그레이션·배포 안내에 필요하다.
  - 제안: `## Unreleased` 섹션에 "POST /api/model-configs/:id/test — Viewer 호출 차단(Editor+ 강제). 종전 `@Roles` 부재로 Viewer 도 호출 가능했으나, 과금 provider 호출·embedding 차원 자동저장 부수효과를 동반하므로 Editor+ 로 게이트 (spec §3 R-7)." 항목을 추가한다.

### 발견사항 2
- **[INFO]** `workspace-rbac.e2e-spec.ts` 파일 상단 JSDoc 에 model-config 인가 불변식 미기재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/test/workspace-rbac.e2e-spec.ts` 라인 439–447
  - 상세: 파일 선두 JSDoc 의 "보호 대상 invariants" 목록에 워크스페이스 격리·viewer write 차단·owner 삭제 전용·CANNOT_ASSIGN_OWNER·owner 강등이 나열돼 있다. 이번 PR 이 추가한 케이스 H ("model-configs/:id/test 는 Editor+, :id/models 는 Viewer+") 는 이 목록에 반영돼 있지 않아 파일을 처음 읽는 사람이 어떤 계약을 테스트하는지 한 눈에 파악하기 어렵다.
  - 제안: invariants 목록에 "- action-POST(:id/test·preview-models)는 Editor+ 게이트(과금 방어), 조회GET(:id/models)는 Viewer+ 허용" 항목을 추가한다.

### 발견사항 3
- **[INFO]** `listModels` 핸들러에 `@ApiUnauthorizedResponse` 만 있고 `@ApiForbiddenResponse` 가 없음 — 의도적이며 정확하나 명시적 주석 부재
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 라인 314–337
  - 상세: `listModels` 는 `@Roles` 미적용(Viewer+)이므로 워크스페이스 멤버라면 403 이 없다. 이는 spec §3 및 R-7 과 정확히 일치한다. 그러나 `testConnection` 에 `@ApiForbiddenResponse` 가 신규 추가된 것과 대조할 때, `listModels` 의 `@ApiForbiddenResponse` 부재가 의도적 생략인지 누락인지 코드만 보면 판단하기 어렵다. 현재 Swagger 문서에서는 `listModels` 의 403 케이스가 미문서화 상태다(실제로 멤버 아닌 사용자가 호출하면 RolesGuard 가 아닌 workspace membership 레이어에서 403 을 낼 수 있다).
  - 제안: `listModels` 핸들러에 `// @ApiForbiddenResponse 미적용 — Viewer+ 허용(spec §3·R-7)` 인라인 주석을 추가하거나, workspace membership 차단에 대한 `@ApiForbiddenResponse({ description: '워크스페이스 멤버 아님' })` 를 추가해 Swagger 문서를 완성한다.

---

## 긍정적 발견

다음 문서화 요소는 품질이 높다.

- **클래스 레벨 JSDoc** (`LlmModelConfigController`): forwardRef 순환 해소 배경·단방향 의존 구조·API 계약 SoT 참조(`spec/2-navigation/6-config.md §3`)를 모두 포함하고 있다. 컨텍스트가 충분해 리팩토링 이유를 즉시 파악할 수 있다.
- **Swagger 선언 정합성**: `testConnection` 에 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 가 `@Roles('editor')` 추가와 함께 동일 커밋으로 추가돼 OpenAPI 문서와 구현이 일치한다.
- **인라인 spec 참조**: 테스트 파일의 `describe` 블록 헤더에 `// 인가 계약 SoT: spec/2-navigation/6-config.md §3 + R-7.` 를 명시해 계약 출처를 추적 가능하다.
- **e2e 인라인 주석**: 케이스 H 의 `missingId` 사용 이유, guard-first 실행 순서, testConnection 의 best-effort 200 vs listModels 의 404 차이를 주석으로 설명해 테스트 의도를 명확히 한다.
- **spec 문서 정합성**: `spec/2-navigation/6-config.md §3` 과 Rationale R-7 이 이미 이 변경 내용을 완전히 기술하고 있다. 구현이 spec 과 일치한다.

---

## 요약

세 파일의 문서화 수준은 전반적으로 우수하다. 클래스 JSDoc, Swagger 어노테이션, 인라인 spec 참조, e2e 주석 모두 변경 의도를 충분히 설명한다. 다만 Viewer 에서 403 으로의 behavior change 를 CHANGELOG 에 기록하지 않은 점이 가장 중요한 갭으로, 외부 API 사용자 및 운영 팀에 전달돼야 할 내용이다. 나머지는 정보성 수준의 개선 권고다.

## 위험도

LOW
