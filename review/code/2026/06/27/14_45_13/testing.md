# Testing Review

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**검토 일시**: 2026-06-27
**변경 개요**: `LlmModelConfigController.testConnection` `@Roles('editor')` 추가 + 단위/e2e 테스트 보강 (이전 라운드 W1–W4 fix 후 최종 상태)

---

## 발견사항

### [INFO] testConnection 단위 테스트 설명 언어 혼용 — 미정리 잔여
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` 라인 98
- 상세: `"testConnection method has 'editor' role metadata (billed action-POST -> Editor+)"` 와 `'listModels (GET read) has NO role metadata — Viewer+ retained'` 에 `->` 기호, "GET read" 중복 서술이 혼입돼 있다. 이전 라운드 I9("테스트 설명 영어 통일")가 부분 적용됐으나 두 설명이 코드 스타일 표기(`->`)와 자연어 영어가 섞인 상태로 남아 있다. 기능 오류가 아니고 회귀 위험도 없어 INFO 수준이다.
- 제안: `"testConnection has 'editor' role metadata (billing action POST — Editor+)"` / `"listModels (GET) has NO role metadata — Viewer+ access retained"` 로 통일하면 같은 describe 블록 내 세 테스트가 동일 톤을 가진다.

### [INFO] `viewerPreview` e2e 단언이 최소 body 의존 — 의도적이나 주석 비대칭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/test/workspace-rbac.e2e-spec.ts` 라인 418–423
- 상세: `preview-models` viewer 403 단언은 `{ provider: 'openai', apiKey: 'sk-test' }` body 를 전송한다. 가드가 body 검증 파이프보다 먼저 실행돼 body 내용과 무관하게 403 이 반환된다는 사실을 코드 주석이 정확히 설명한다. `viewerTest`(`/:id/test`) 는 body 없이 전송하는 반면 `viewerPreview` 만 body 를 포함해 케이스 간 패턴이 다르다. 동작에는 영향 없지만 body 유무의 의도 차이(preview-models 는 DTO 필수 선언 여부)를 주석에 한 줄 추가하면 명확해진다.
- 제안: 현행 유지 가능. 선택적으로 "preview-models DTO 선언 때문에 최소 body 전달 — 가드 실행은 DTO 파싱 전" 주석 추가.

### [INFO] `X-Workspace-Id` 미전송 시 RolesGuard false 경로 미테스트 (pre-existing, 별건 유지)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/common/guards/roles.guard.ts` 라인 10 (`ROLES_KEY`) + guard 본문 `if (!workspaceId) return false` 경로
- 상세: 이전 라운드 I7 에서 defer 로 분류됐으며 본 PR 범위 외다. 모든 e2e 케이스가 `X-Workspace-Id: ws` 를 전송해 정상 경로만 검증한다. `roles.guard.spec.ts` 전용 파일이 없으면 향후 생성 시 포함 권장.
- 제안: 별건 개선 — 본 PR 에서 처리 불필요.

---

## 긍정 확인 사항

**이전 라운드 W1–W4 모두 해소됨**:

| 이전 W# | 내용 | 현 상태 |
|---------|------|---------|
| W1 | e2e 케이스 H 에 `preview-models` viewer→403 누락 | `viewerPreview` 단언 추가됨 (라인 418–423) |
| W2 | `editorTest.body.data.success` 구현 결합 단언 | `not.toBe(403)` 단독으로 교체됨 (라인 432) |
| W3 | `Reflect.getMetadata('roles', ...)` 매직 스트링 3곳 | `ROLES_KEY` import 로 교체됨 (라인 4, 92, 100, 107) |
| W4 | CHANGELOG `## Unreleased` breaking change 누락 | Breaking changes 항목 추가됨 |

**테스트 계층 완전성**:
- 단위 테스트: `previewModels`·`testConnection`·`listModels` 세 메서드 모두 `Reflect.getMetadata(ROLES_KEY, ...)` 로 데코레이터 존재 여부 직접 검증. `ROLES_KEY = 'roles'` 상수가 `roles.guard.ts` 에서 export 되어 있어 키 변경 시 컴파일 단계에서 감지됨.
- 서비스 위임 테스트: `testConnection`·`listModels` 두 메서드의 서비스 위임 동작이 별도 describe 블록으로 독립 검증됨 (라인 44–78).
- e2e: viewer→403(`/:id/test`)·viewer→403(`preview-models`)·editor→not 403·viewer→404(`/:id/models`) 네 경로 모두 실 인프라로 검증됨. 215 pass 확인 (RESOLUTION.md 기재).

**테스트 격리**:
- 단위 테스트: `beforeEach` 에서 mock 을 매번 재생성해 테스트 간 상태 오염 없음.
- e2e 케이스 H: `uniqueEmail('rbac-h-own')`·`uniqueEmail('rbac-h-view')`·`uniqueEmail('rbac-h-edit')` 로 실행 간 이메일 충돌 방지. `missingId = '00000000-0000-4000-8000-000000000000'` 는 유효한 UUID v4 형식으로 `ParseUUIDPipe` 를 통과하면서 실존 entity 에 의존하지 않음 — guard 선실행 검증 전략의 핵심.

**Mock 적절성**:
- 단위 테스트가 `LlmService`·`LlmPreviewService` 를 `jest.fn()` 으로 mock 해 외부 의존 없이 컨트롤러 위임 로직만 검증. 실제 provider 호출 없이 인가 게이트만 측정하는 e2e 설계(`missingId` 전략)도 동일 원칙을 따름.

---

## 요약

이번 변경의 테스트 커버리지는 이전 라운드 Warning 4건(W1 preview-models e2e 누락·W2 body 단언 구현 결합·W3 매직 스트링·W4 CHANGELOG)이 모두 해소된 양호한 상태다. 단위 테스트는 `ROLES_KEY` 상수 참조로 silent-failure 위험을 제거했고, e2e 케이스 H 는 R-7 이 규정하는 두 action-POST(`/:id/test`·`preview-models`) 각각의 viewer 차단을 실 HTTP 응답으로 검증하며, editor 단언은 `not.toBe(403)` 만으로 서비스 구현 세부와의 결합을 피했다. 잔여 INFO 3건은 테스트 설명 언어 통일성(기능 무관), e2e body 전달 패턴 주석(선택), `X-Workspace-Id` 누락 경로 테스트 부재(별건 guard spec)로 즉각적 장애 위험이 없다.

---

## 위험도

LOW
