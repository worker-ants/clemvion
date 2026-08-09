STATUS=success naming_collision review complete — 0 critical, 0 warning, 2 info

===REPORT_MARKDOWN_BELOW===

# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

이번 target 은 `spec/5-system/` 이 번들에 포함돼 있으나, `## 구현 변경 사항` 의 실제 diff(`origin/main...HEAD`)는 **spec `*.md` 를 전혀 건드리지 않고 코드만 변경**한다 (`plan/in-progress/auth-guard-reflection-hardening.md` frontmatter 도 `spec_impact: none` 으로 확인됨). 따라서 본 검토는 diff 가 도입한 코드 식별자를 대상으로 했다:

- 신규 파일: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (+ `.spec.ts`)
- 신규 export: `WorkspaceIdReflectionBrokenError`(class), `countWorkspaceIdConsumingRoutes`(fn), `assertWorkspaceIdReflectionWorks`(fn)
- `codebase/backend/src/common/utils/uuid.ts` 신규 export: `isUuidShaped`(fn), `UUID_SHAPE_PATTERN`(const)
- `codebase/backend/src/app.module.ts` 신규 import: `DiscoveryModule` (NestJS 내장, 신규 식별자 아님)
- `codebase/backend/src/common/utils/workspace-context.util.ts`: 기존 `resolveRequestWorkspaceContext` 에 `BadRequestException({code:'VALIDATION_ERROR'})` throw 추가 (신규 에러 코드 아님, 기존 `VALIDATION_ERROR` 재사용)
- 각 `.spec.ts` 의 로컬 UUID 픽스처 상수(`HEADER_WS`/`TOKEN_WS`/`OWN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`/`WS1`) — 파일-스코프 `const`, export 없음

모든 신규 export 식별자에 대해 `git grep`(worktree 절대경로, `codebase/`+`spec/`+`plan/`)으로 기존 사용처 유무를 확인했다. 결과는 전부 신규 정의 위치 자신만 매칭되었고, 기존 코드·spec 어디에도 동명 식별자가 없었다.

## 발견사항

- **[INFO]** `workspace-reflection-canary.ts` 가 `common/decorators/` 폴더의 암묵적 `.decorator.ts` 접미사 패턴을 벗어남
  - target 신규 식별자: 파일 경로 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
  - 기존 사용처: 같은 폴더의 `current-user.decorator.ts` · `public.decorator.ts` · `workspace.decorator.ts` (+ 각 `.decorator.spec.ts`) 는 전부 `<name>.decorator.ts` 접미사를 따름
  - 상세: 이 파일은 데코레이터가 아니라 부트타임 self-check(캐너리)이며, `handlerConsumesWorkspaceId`(`workspace.decorator.ts`)를 재사용해 검증하는 소비자다. 접미사 컨벤션이 `spec/conventions/` 에 정식 문서화된 규칙은 아니라서(grep 결과 없음) 충돌 등급은 아니지만, 폴더 스캔 시 "이 폴더 = 파라미터 데코레이터 모음" 이라는 암묵적 기대를 깬다.
  - 제안: 조치 불요(정식 규약 없음). 다만 후속 파일이 더 늘면 `common/bootstrap/` 또는 `common/security/` 같은 별도 폴더로 분리하는 편이 스캔성이 좋다.

- **[INFO]** `canary` 라는 용어가 저장소 내 다른 의미로도 이미 쓰이고 있음
  - target 신규 식별자: `WorkspaceIdReflectionBrokenError`/`workspace-reflection-canary.ts` 의 "reflection canary"(부트타임 self-check) 개념
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (예: `llmConfigId: 'cred-leak-canary'`, `workspaceId: 'ws-canary'`) — 테스트 안에서 "직렬화 시 credential 이 새는지" 를 감지하는 **데이터 leak 캐너리 값**
  - 상세: 동일 식별자 문자열이 아니라 "canary" 라는 일반 소프트웨어 엔지니어링 용어를 공유할 뿐이며, 하나는 클래스/파일명, 다른 하나는 테스트 픽스처 리터럴이라 실제 명칭 충돌은 없다. 문맥(부트 검증 vs 데이터 유출 감지)도 명확히 갈려 혼동 가능성은 낮다.
  - 제안: 조치 불요. 향후 "canary" 를 저장소 공통 용어로 굳히고 싶다면 `spec/conventions/` 에 짧게 정의해두는 것도 좋다(선택).

## 요약

diff 가 새로 도입한 코드 식별자(`WorkspaceIdReflectionBrokenError`·`countWorkspaceIdConsumingRoutes`·`assertWorkspaceIdReflectionWorks`·`isUuidShaped`·`UUID_SHAPE_PATTERN`·신규 파일 `workspace-reflection-canary.ts`)는 `codebase/`·`spec/`·`plan/` 전역에서 grep 기준 유일하며, 기존 정의와의 이름 충돌은 없다. 에러 코드는 새 코드를 만들지 않고 기존 `VALIDATION_ERROR`(`spec/5-system/3-error-handling.md`)를 정확한 의미로 재사용했고, plan 문서에도 `WORKSPACE_ID_REQUIRED`(헤더·클레임 둘 다 부재)와의 의미 차이를 명시적으로 검토한 흔적이 있어 준수 상태다. 새 API endpoint·env var·webhook/큐 이벤트명·spec 파일도 이번 diff 에는 없다. 발견된 두 건은 모두 INFO 수준의 명명 정합성 참고사항으로, 충돌이 아니라 향후 확장 시 참고할 만한 관찰이다.

## 위험도
NONE
