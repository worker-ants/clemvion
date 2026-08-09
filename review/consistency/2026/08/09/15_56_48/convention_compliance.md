# 정식 규약 준수 검토 결과

## 검토 대상
- 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
- diff 요지: `app.module.ts`(`DiscoveryModule` 등록) · `common/decorators/workspace-reflection-canary.{ts,spec.ts}`(신규 — 부팅 시 `@WorkspaceId()` reflection fail-closed 캐너리) · `common/decorators/workspace.decorator.spec.ts` · `common/guards/roles.guard.spec.ts` · `common/utils/uuid.{ts,spec.ts}`(`isUuidShaped` 신설) · `common/utils/workspace-context.util.{ts,spec.ts}`(`X-Workspace-Id` 헤더 형식 검증 → 400 `VALIDATION_ERROR`) · `main.ts`(캐너리 호출). **이번 diff 에는 `spec/**` 변경이 없다** — `spec/5-system/` 18개 파일 전부 `origin/main` 대비 무변경(코드 전용 hardening).
- 점검 방법: `spec/5-system/` 번들 전문(18개 파일, frontmatter 포함)을 `spec/conventions/*`(`error-codes.md`·`spec-impl-evidence.md`·`swagger.md` 등)와 대조. diff 는 "spec 서술이 현재 구현과 실제로 어긋나는가"를 오탐 없이 판정하는 데만 사용(§본 checker 는 spec-코드 drift 자체가 아니라 spec 문서의 정식 규약 준수를 본다 — drift·Rationale 동기화는 별도 checker(`rationale_continuity`/`cross_spec`) 소관).

## 발견사항

이번 diff·target 범위에서 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.** 아래는 확인을 위해 대조한 항목과 결과(전부 준수 확인)이며, 참고용 INFO 1건만 남긴다.

- **[INFO]** 신규 코드 경로(`common/decorators/workspace-reflection-canary.ts`)가 `spec/5-system/1-auth.md` frontmatter `code:` 글로브에 명시적으로 포함되지 않음
  - target 위치: `spec/5-system/1-auth.md` frontmatter `code:` (예: `codebase/backend/src/common/guards/*.ts` 등)
  - 관련 규약: [`spec/conventions/spec-impl-evidence.md` §2.1·§4](../../../../spec/conventions/spec-impl-evidence.md) — `status: partial|implemented` spec 은 `code:` 글로브가 ≥1 파일 매치해야 함(build 가드 `spec-code-paths.test.ts`).
  - 상세: `1-auth.md` 는 `status: partial` 이고 `code:` 에 `codebase/backend/src/common/guards/*.ts` 를 포함해 이미 ≥1 매치를 만족하므로 **build 가드는 깨지지 않는다** — 이 항목은 위반이 아니라 완성도 참고 사항이다. 신규 `common/decorators/workspace-reflection-canary.ts`(및 기존 `common/decorators/workspace.decorator.ts`, `common/utils/workspace-context.util.ts`)는 어느 `spec/5-system/*.md` 의 `code:` 글로브에도 매치되지 않는데, 이는 이 파일들의 실질 SoT 가 `spec/data-flow/12-workspace.md`(frontmatter 의무 면제 대상 — 동 컨벤션 §1 "`spec/data-flow/**` 는 frontmatter 의무 대상이 아니다")이기 때문으로 보인다. 즉 규약 위반이 아니라 **의도된 SoT 분리**로 판단된다 — stale-glob 탐지는 `/spec-coverage` standing audit(R-1)의 관할이지 본 checker 의 blocking 대상이 아니다.
  - 제안: 조치 불요(비차단). 다만 `1-auth.md` §3.3(API 인가 흐름)·§Rationale "Production fail-closed 가드" 인접부가 `RolesGuard`/`@WorkspaceId()` 판별을 다루므로, 후속에 `code:` 를 `common/decorators/*.ts` 로 넓히는 것을 고려할 수 있다(강제 아님).

## 대조 확인 (참고 — 위반 없음)

- **에러 코드 명명**: 신규 `workspace-context.util.ts` 가 던지는 `BadRequestException({ code: 'VALIDATION_ERROR', message: 'X-Workspace-Id must be a UUID' })` 는 [`error-codes.md` §1](../../../../spec/conventions/error-codes.md#1-의미-기반-명명-핵심-원칙) 이 명시한 "시스템 전역 공용 코드(prefix 없음)" 예외에 정확히 해당하고, [`3-error-handling.md` §1.3](../../../../spec/5-system/3-error-handling.md#13-유효성-검증-에러)/[`2-api-convention.md` §5.3](../../../../spec/5-system/2-api-convention.md#53-에러-응답) 이 이미 문서화한 "400 기본값 = `VALIDATION_ERROR`" 매핑과 일치. 새 코드 신설이 아니라 기존 카탈로그 코드 재사용이라 rename/신규 등재 의무(§2)도 발생하지 않는다. `message` 도 라이브러리 원문을 echo 하지 않고 사람이 쓴 고정 문구라 §5.3 의 CWE-209 방지 규칙과 정합. 같은 패턴(`code: 'VALIDATION_ERROR'` throw)이 이미 `password.util.ts`·`validation.pipe.ts` 에 선례로 존재해 프로젝트 관행과도 일관.
- **API 헤더 포맷**: `2-api-convention.md §2.3` 는 `X-Workspace-Id: {workspace-uuid}` 를 이미 UUID 형태로 예시하고 있어, 신규 `isUuidShaped` 형식 검증이 spec 이 암묵적으로 전제한 계약을 어기지 않는다(오히려 강제할 뿐). `WORKSPACE_ID_REQUIRED`(헤더 부재)와 신규 malformed-헤더 경로(`VALIDATION_ERROR`)가 서로 다른 조건에 서로 다른 코드를 쓰는 것도 §1 "의미가 갈릴 때 새 코드"·"단, 일반 조건은 공용 `VALIDATION_ERROR`" 원칙과 충돌하지 않는다.
- **문서 구조(Overview/본문/Rationale)**: `spec/5-system/` 는 다중 파일 영역이라 [`project-planner/SKILL.md` "Spec 문서 구조"](../../../../.claude/skills/project-planner/SKILL.md) 규정대로 제품 정의(Overview)를 `_product-overview.md` 로 위임하고 있다. 개별 `N-name.md` 파일 중 일부(`2-api-convention.md`·`5-expression-language.md`·`6-websocket-protocol.md`·`11-mcp-client.md`·`7-llm-client.md`)는 파일 자체의 `## Overview` 절이 없지만, 이는 "3섹션 **권장**"(의무 아님) + 상위 `_product-overview.md` 존재로 커버되는 기존 패턴이라 위반으로 보지 않았다. `## Rationale` 는 18개 파일 전부 보유(`_product-overview.md` 제외 — PRD 성격상 Rationale 불요). frontmatter `id`/`status`(전부 `partial`|`implemented`, 유효 5값 중)/`code:` 스키마도 [`spec-impl-evidence.md` §2](../../../../spec/conventions/spec-impl-evidence.md#2-frontmatter-스키마) 형식을 모두 준수. `_product-overview.md` 는 밑줄 prefix 로 frontmatter 면제 대상(§1)이라 frontmatter 부재가 정상.
- **명명 규약(URL/파일)**: 신규 코드가 새 REST 엔드포인트를 추가하지 않아(내부 유틸리티·부트 가드만 추가) `2-api-convention.md §2.2`(케밥 케이스·복수형 리소스 등)에 영향을 주는 변경이 없다. 파일명(`workspace-reflection-canary.ts` 등)·frontmatter `id`(kebab-case) 도 기존 표기와 일관.
- **API 문서(Swagger/DTO) 규약**: 이번 diff 는 신규 Controller/DTO/`@Api*` 데코레이터를 도입하지 않는다(순수 backend 내부 가드·유틸). [`swagger.md`](../../../../spec/conventions/swagger.md) 대상 표면 변경 없음 — 해당 없음(N/A).
- **금지 항목**: 캐너리 코드 주석이 스스로 인용한 "`SetMetadata`+`Reflector` 라우트별 opt-in 마커" 기각 근거는 `spec/data-flow/12-workspace.md §Rationale`(§"멤버십 검증은 가드 1곳에서")의 실제 "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착" 문구와 정확히 대응해, 이 프로젝트가 반복 경계해 온 "허위 기각 이력 인용"에 해당하지 않는다. 새로 도입한 부트 검증도 `spec/conventions/**` 가 명시적으로 금지한 패턴을 재도입하지 않는다.

## 요약
이번 PR 은 `spec/5-system/**` 문서 자체를 변경하지 않은 순수 코드 hardening(부팅 시 워크스페이스 reflection 캐너리 신설 + `X-Workspace-Id` 헤더 UUID 형식 검증)이다. 신규 코드가 발행하는 에러 코드(`VALIDATION_ERROR`)·헤더 포맷은 `spec/conventions/error-codes.md`·`spec/5-system/2-api-convention.md`·`3-error-handling.md` 가 이미 확립한 정식 규약과 정확히 정합하며, 새 REST 표면·DTO·Swagger 데코레이터가 없어 API 문서 규약 위반 표면도 없다. `spec/5-system/` 각 파일의 frontmatter(`id`/`status`/`code`)·문서 구조(다중 파일 영역의 `_product-overview.md` 위임)도 `spec-impl-evidence.md`·`project-planner/SKILL.md` 규정을 준수한다. 유일한 참고 사항은 신규 파일이 `1-auth.md` 의 `code:` 글로브에 개별 매치되지 않는다는 점이나, 이는 build 가드를 깨지 않고(기존 글로브로 이미 충족) 실질 SoT 가 frontmatter 면제 대상인 `spec/data-flow/12-workspace.md` 로 의도적으로 분리된 것으로 보여 비차단 INFO 로만 남긴다. (Rationale 미동기화 이슈는 별도 `rationale_continuity` checker 가 이미 WARNING 으로 포착했다.)

## 위험도
NONE
