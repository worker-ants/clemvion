# 보안(Security) 리뷰

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**리뷰 범위**: `LlmModelConfigController.testConnection` `@Roles('editor')` 인가 강화 + 관련 단위/e2e 테스트 보강

---

## 발견사항

### [INFO] `@Query('type')` 런타임 열거형 강제 없음 (pre-existing)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L122 `listModels` 핸들러
- 상세: `@Query('type') type?: 'chat' | 'embedding'` 선언의 TypeScript 타입은 컴파일 타임 전용이다. 런타임에 유효하지 않은 문자열(예: `type=../admin`)이 그대로 서비스 레이어로 전달될 수 있다. NestJS `ValidationPipe` + `@IsEnum` 등으로 런타임 강제를 적용하지 않으면 서비스 내부에서 예상치 못한 분기가 발생할 수 있다. 이 이슈는 본 PR 이전부터 존재하며 이번 변경이 도입한 것이 아니다. 이전 리뷰(I1)에서 별건 defer로 확정됐다.
- 제안: `PreviewModelListDto` 패턴 참고해 `@IsEnum` + `ValidationPipe`로 런타임 강제 추가. 별건 PR에서 처리한다.

---

### [INFO] `previewModels` apiKey 로그 마스킹 미확인 (pre-existing)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L73 `previewModels` 핸들러, e2e 테스트 L226 `.send({ provider: 'openai', apiKey: 'sk-test' })`
- 상세: `previewModels`는 Body에서 `apiKey`를 받아 `LlmPreviewService.previewModels(dto)` 로 전달한다. 서비스/인프라 계층에서 이 값이 로그에 평문으로 기록되는지 여부를 이 컨트롤러 레이어에서 확인할 수 없다. API 키가 애플리케이션 로그에 평문으로 남으면 로그 수집 시스템에서 자격증명 노출 위험이 있다. 이 이슈는 본 PR 이전부터 존재한다. e2e 테스트의 `'sk-test'`는 의도적 테스트 값이며 실제 자격증명이 아니다. 이전 리뷰(I2)에서 별건 defer로 확정됐다.
- 제안: `LlmPreviewService` 및 하위 Provider 클라이언트에서 로그 출력 시 apiKey 마스킹(`sk-***...***`) 적용 여부를 별건으로 감사한다.

---

### [INFO] `listModels` — `@Roles` 미적용 시 워크스페이스 멤버십 검증이 상위 가드 의존

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L102 `listModels` 핸들러, `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/common/guards/roles.guard.ts` L51
- 상세: `RolesGuard.canActivate`는 `requiredRoles`가 없으면 `true`를 반환한다(default Allow). `listModels`는 `@Roles`가 없으므로 RolesGuard를 통과한다. 컨트롤러 코드의 인라인 주석(L99-101)은 "워크스페이스 멤버십 미충족 403은 컨트롤러 공통 인증 계층 책임"이라고 명시한다. 이 "공통 인증 계층"이 실제로 모든 요청에 적용돼 미인증·비멤버 접근을 차단하는지는 이 diff 범위에서 확인되지 않는다. 단, e2e 케이스 H에서 viewer 자격증명으로 `listModels` 호출 시 403이 아닌 404가 반환됨이 실 인프라 검증됐으므로, viewer 멤버는 핸들러에 실제 도달한다는 것이 확인됐다. 이는 설계 의도와 일치하며 취약점이 아니다.
- 제안: 공통 인증 계층(JWT 가드 또는 워크스페이스 가드)이 모든 컨트롤러 라우트를 커버하는지 주기적으로 감사한다. 특히 `@Public()` 같은 예외 데코레이터가 `listModels`에 의도치 않게 적용되는 경우를 방지한다.

---

## 핵심 변경 보안 평가

본 PR의 핵심 변경인 `@Roles('editor')` 추가는 보안을 강화하는 방향이다.

- **인가 갭 차단**: 종전에 모든 워크스페이스 멤버(Viewer 포함)가 호출 가능했던 `POST /api/model-configs/:id/test`는 외부 Provider 과금 호출을 일으키는 action-POST다. `@Roles('editor')` 추가로 Viewer의 직접 API 악용 가능성이 봉쇄됐다.
- **입력 검증**: `@Param('id', ParseUUIDPipe)`가 적용돼 경로 파라미터의 UUID 형식이 강제된다. SQL 인젝션·경로 탐색 위험 없다.
- **하드코딩 시크릿**: 없음. e2e 테스트의 `'sk-test'`는 의도된 더미 값이며 실제 자격증명이 아니다.
- **에러 처리**: `testConnection` 미존재 config → `200 { success: false }` 패턴은 스택 트레이스·내부 정보 노출 없이 봉쇄됐다(서비스 레이어 best-effort catch).
- **암호화**: 이번 변경에 암호화 관련 도입 없음.
- **의존성**: 신규 의존성 추가 없음.
- **인증**: `@ApiBearerAuth('access-token')` 컨트롤러 전체 적용. RolesGuard는 `userId`·`workspaceId` 부재 시 `false` 반환해 미인증 접근 차단.
- **OWASP A01 (Broken Access Control)**: `testConnection` 인가 갭 차단으로 직접 개선됨.

---

## 요약

본 변경은 `POST /api/model-configs/:id/test`에 `@Roles('editor')` 게이트를 추가해 기존 인가 갭을 봉쇄하는 보안 강화 PR이다. `ParseUUIDPipe`로 경로 파라미터가 보호되고, RolesGuard 구현은 역할 계층 비교와 워크스페이스 멤버십 실시간 조회를 수행하며, 하드코딩된 시크릿이나 새로운 인젝션 경로는 도입되지 않았다. 발견된 항목 3건은 모두 pre-existing 이슈(런타임 enum 미강제·apiKey 로그 마스킹·상위 인증 계층 의존)로 본 PR이 도입한 취약점이 아니며 이전 리뷰에서도 별건 defer로 확정됐다. 인가 강화 자체는 OWASP A01 관점에서 올바른 방향이다.

---

## 위험도

LOW
