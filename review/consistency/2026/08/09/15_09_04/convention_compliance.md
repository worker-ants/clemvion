# 정식 규약 준수 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 범위 메모

이번 diff(`origin/main...HEAD`)는 `spec/5-system/**.md` 를 **전혀 변경하지 않는다** — 전부 `codebase/backend/**` 코드 변경(`app.module.ts`·`main.ts`·`common/decorators/workspace-reflection-canary.{ts,spec.ts}`(신규)·`common/decorators/workspace.decorator.spec.ts`·`common/guards/roles.guard.spec.ts`·`common/utils/uuid.{ts,spec.ts}`·`common/utils/workspace-context.util.{ts,spec.ts}`)다. 따라서 본 검토는 (a) target 문서(spec/5-system/) 자체의 기존 규약 준수 상태와 (b) 이번 코드 변경이 target 문서·`spec/conventions/**` 가 규정한 명명·출력 포맷·API 문서 패턴을 따르는지를 함께 확인했다.

## 발견사항

- **[WARNING] frontmatter `code:` 글로브가 이번 PR 이 강화한 정확한 표면을 놓친다**
  - target 위치: `spec/5-system/1-auth.md` frontmatter `code:` (workspace 컨텍스트/RBAC 를 다루는 §3), `spec/5-system/3-error-handling.md` frontmatter `code:` (§1.3 `WORKSPACE_ID_REQUIRED` 행이 `common/decorators/workspace.decorator.ts` 를 명시 링크)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1/§2 — "`code:` = 본 spec 이 약속한 surface 의 구현 경로"
  - 상세: `1-auth.md` 의 `code:` 는 `codebase/backend/src/common/guards/*.ts` 만 포함하고, `3-error-handling.md` 의 `code:` 는 `common/filters`·`common/pipes`·`nodes/core/error-codes.ts`·`execution-engine/error`·`health` 만 포함한다. 두 문서 어디에도 `codebase/backend/src/common/decorators/*.ts`(신규 `workspace-reflection-canary.ts` 포함)·`codebase/backend/src/common/utils/workspace-context.util.ts`·`codebase/backend/src/common/utils/uuid.ts`·`codebase/backend/src/app.module.ts`·`codebase/backend/src/main.ts` 가 글로브로 잡히지 않는다. 그런데 이 파일들이 바로 `1-auth.md §3`(header-first 워크스페이스 결정)·`3-error-handling.md §1.3`(`WORKSPACE_ID_REQUIRED` 가 명시적으로 `common/decorators/workspace.decorator.ts` 를 인용)가 서술하는 메커니즘의 실제 구현이고, 이번 PR 은 그 메커니즘(reflection 캐너리·UUID 형식 검증)을 정확히 여기서 강화했다. `spec-code-paths.test.ts` 가드는 "≥1 매치"만 요구해 빌드는 통과하지만(`common/guards/*.ts` 로 이미 충족), evidence 추적의 취지(spec 약속 ↔ 실제 구현 경로 대조)는 이 표면에서 비어 있다. PR 이전부터 있던 갭이 이번 PR 로 파일 수만 늘며 그대로 이어진다.
  - 제안: `1-auth.md` 의 `code:` 에 `codebase/backend/src/common/decorators/*.ts`(또는 `workspace.decorator.ts`+`workspace-reflection-canary.ts` 명시)와 `codebase/backend/src/common/utils/workspace-context.util.ts`·`uuid.ts` 를 추가. 부팅 가드는 `3-error-handling.md`(§1.3 인용 대상) 또는 `1-auth.md` 어느 한쪽에 `app.module.ts`/`main.ts` 관련 라인만 최소 추가해도 evidence 사슬이 닫힌다. 빌드 차단 사항은 아니므로 우선순위는 낮되, 이번 PR 이 스스로 "cross-tenant 재발 방지" 라고 강조하는 표면이라 근접 갱신 가치가 크다.

- **[INFO] 신규 canary 파일이 `common/decorators/` 디렉터리의 로컬 명명 패턴과 다르다**
  - target 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (해당 없음 — target 문서엔 이 디렉터리에 대한 명시 규약이 없음, 코드베이스 로컬 관례와의 괴리만 관측)
  - 위반 규약: 명시적 `spec/conventions/**` 문서 없음 — `frontend-layering.md` 는 프론트엔드 전용이고 backend `common/decorators/`·`common/utils/` 디렉터리 명명·배치를 규정하는 정식 규약 파일은 이 번들에 없음. 따라서 이는 "위반"이 아니라 로컬 일관성 관찰
  - 상세: `common/decorators/` 하위 기존 3개 파일(`current-user.decorator.ts`·`public.decorator.ts`·`workspace.decorator.ts`)은 모두 `*.decorator.ts` 접미사이며 `index.ts` 로 barrel-export 된다. 신규 `workspace-reflection-canary.ts` 는 `@Decorator()` 팩토리가 아니라 부팅 시 1회 호출되는 assertion 함수 묶음이고, `index.ts` 에도 등재되지 않는다(직접 상대경로 import). 정식 규약 위반은 아니지만 디렉터리가 "무엇을 담는 곳인가"에 대한 로컬 신호가 흐려진다.
  - 제안: 정식 규약을 새로 만들 필요는 없음(과잉). 다만 후속 정리 시 `common/bootstrap/` 류의 디렉터리로 옮기거나, 최소한 이 파일이 데코레이터가 아니라는 점을 디렉터리 README/주석 수준에서 명확히 하는 정도로 충분. 규약 갱신보다는 코드 배치 조정이 더 적절.

## 준수가 확인된 항목 (긍정 소견)

- **에러 코드**: `resolveRequestWorkspaceContext` 가 던지는 `new BadRequestException({ code: 'VALIDATION_ERROR', message: 'X-Workspace-Id must be a UUID' })` 는 `spec/5-system/2-api-convention.md §5.3`("code 의 상태코드별 기본값: 400=`VALIDATION_ERROR`")과 `spec/5-system/3-error-handling.md §1.3`(`VALIDATION_ERROR | 요청 데이터 유효성 실패 | 400`)를 정확히 재사용한다. 새 도메인 전용 코드를 신설하지 않은 것도 `2-api-convention.md Rationale`("일반 신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 신설")의 원칙과 일치.
  실제 런타임 경로(`GlobalExceptionFilter.catch`)를 대조한 결과 `resp.code`(`'VALIDATION_ERROR'`) → `errorResponse.error.code` 로, `requestId` 는 필터가 매 응답 발급 → 문서화된 `{ error: { code, message, requestId } }` 봉투(§5.3)를 그대로 산출한다. `message` 도 내부 구현 원문(스택·SQLSTATE 등)을 echo 하지 않아 CWE-209 관련 문구("내부 구현 원문을 echo 하지 않는다")를 준수.
- **명명**: 신규 `WorkspaceIdReflectionBrokenError` 는 코드베이스에 이미 있는 PascalCase + `Error` 접미사 typed-error 관례(`WorkflowForbiddenWorkspaceError`·`MessageTooLongError`·`ExecutionCancelledError`, `spec/5-system/3-error-handling.md` §1.4/§1.5 참조)와 일치한다. HTTP 표면에 노출되는 `error.code` 문자열이 아니라 부팅 단계 내부 예외라 `spec/conventions/error-codes.md` §1(UPPER_SNAKE_CASE 등)의 적용 대상도 아니다(그 규약은 client-facing `error.code` 값에 한정).
- **금지 패턴 미답습**: 코드 주석이 스스로 인용한 "`spec/data-flow/12-workspace.md` §Rationale 이 명시적으로 기각한 '라우트별 opt-in 마커' 패턴" 주장을 실제 spec 원문(`spec/data-flow/12-workspace.md` "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관" §, "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착")과 대조한 결과 정확했다 — 실제로 그 패턴이 명시적으로 기각돼 있고, 이번 PR 의 canary 설계(호출부에 아무 마커도 요구하지 않음)는 그 결정과 정합한다.
- **API 문서 규약(Swagger)**: 이번 diff 는 신규 컨트롤러·엔드포인트·DTO 를 추가하지 않는다(가드/유틸/부팅 단계 내부 로직만). `spec/conventions/swagger.md` 의 DTO JSDoc·`@ApiProperty`·컨트롤러 데코레이터 패턴이 적용될 신규 표면이 없어 위반도 발생하지 않는다.
- **문서 구조**: `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이번 diff 로 변경되지 않았고, 기존에 이미 `## Overview` → 본문 → `## Rationale` 3섹션 구조를 유지하고 있어(각 문서 확인) 회귀 없음.

## 요약

이번 PR 은 `spec/5-system/**.md` 를 건드리지 않는 순수 코드 변경(워크스페이스 인가 가드 reflection 캐너리 + `X-Workspace-Id` UUID 형식 검증)이며, 새로 방출되는 에러 응답(`VALIDATION_ERROR`/400)은 `2-api-convention.md §5.3`·`3-error-handling.md §1.3` 이 규정한 봉투 형식·기본 코드 매핑·메시지 마스킹 정책을 정확히 따른다. 신규 typed error 명명도 기존 관례와 일치하고, spec 이 명시적으로 기각한 "라우트별 opt-in 마커" 패턴도 답습하지 않았다(코드 주석의 spec 인용을 원문 대조로 확인). 유일한 실질 지적은 CRITICAL 이 아닌 WARNING 수준으로, `spec-impl-evidence.md` 관점에서 이번에 강화된 정확한 표면(`common/decorators/workspace.decorator.ts`·신규 `workspace-reflection-canary.ts`·`common/utils/workspace-context.util.ts`·`uuid.ts`)이 `1-auth.md`/`3-error-handling.md` 어느 frontmatter `code:` 글로브에도 잡히지 않아 evidence 추적 사슬이 비어 있다는 점이다 — 빌드 차단 사항은 아니며 PR 이전부터 있던 갭의 연장이다. 그 외 디렉터리 배치(`common/decorators/`)의 로컬 명명 불일치는 정식 규약 부재로 INFO 수준 참고 사항에 그친다.

## 위험도

LOW
