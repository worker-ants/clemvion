# 정식 규약 준수 검토 — spec/2-navigation/

검토 모드: impl-done (scope=`spec/2-navigation/`, diff-base=`origin/main`, HEAD 워킹트리=`/Volumes/project/private/clemvion/.claude/worktrees/slug-routing-hardening-94580e`)

## 선행 확인

`git -C <워킹트리> diff origin/main --stat` 로 이번 라운드(브랜치 `claude/slug-routing-hardening-94580e`, PR #865 후속 하드닝)의 실제 변경분을 확인한 결과 **`spec/**` 파일은 이번 diff 에 포함되어 있지 않다** (변경은 `codebase/frontend/src/lib/workspace/{href,safe-path,types}.ts` · `resolve-fallback.ts` · workspace-store.ts · 관련 페이지/테스트에 국한). 즉 `spec/2-navigation/` 자체는 이번 라운드에서 손대지 않았고, 슬러그 라우팅(#865)은 이미 별도 PR 에서 병합·ai-review 4라운드 수렴을 거친 상태다. 아래는 diff-base 시점과 무관하게 **현재 target 문서 전체**를 `spec/conventions/**` 대비로 재검증한 결과다.

## 발견사항

- **[INFO]** `0-` prefix 의미가 root/영역 레벨에서 상이함에도 build 가드가 이를 "index" 로 오인 흡수
  - target 위치: `spec/2-navigation/0-dashboard.md` (frontmatter + 문서 전체)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §명명 컨벤션 (`spec/<영역>/0-overview.md — 기술 아키텍처 개요` vs `spec/<영역>/N-name.md — 정렬 보장된 상세 spec`) · `spec/conventions/spec-impl-evidence.md §4.2` (`spec-area-index.test.ts`)
  - 상세: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 의 `INDEX_RE = /^(_.*overview|_layout|0-.*|README)\.md$/` 는 basename 이 `0-` 로 시작하는 모든 파일을 "index 문서"로 분류한다. `spec/2-navigation/0-dashboard.md` 는 의미상 "기술 아키텍처 개요"가 아니라 그냥 정렬상 첫 번째 상세 spec(대시보드 화면 spec)인데, 이 regex 때문에 (a) 그 자신은 "sibling" 목록에서 빠져 index 문서로부터의 링크 의무를 지지 않고, (b) 오히려 자신도 다른 sibling 을 링크하는 "index 후보"로 카운트된다. 현재는 `_product-overview.md` §내비게이션 맵과 `_layout.md` 메뉴에서 실제로 `0-dashboard.md` 가 잘 참조되므로 **당장 깨진 것은 없다** — 다만 이 회색지대는 향후 어떤 영역에 `0-`로 시작하는 새 상세 spec 이 index 문서에서 누락돼도 가드가 이를 검출하지 못하는 잠재 blind spot 이다 (`spec/3-workflow-editor/0-canvas.md` 도 동일 패턴).
  - 제안: target 문서 수정은 불필요(현재 링크 무결성 정상). 대신 가드 쪽 INDEX_RE 를 basename 정확히 `0-overview.md`/`0-<area>.md`(cross-cutting entry) 로 좁히거나, project-planner SKILL.md 의 "0-" prefix 정의에 "영역 폴더 내 0-prefix 파일 중 실제 아키텍처 개요가 아닌 경우(예: `0-dashboard.md`, `0-canvas.md`)"에 대한 예외 문구를 명시해 문서-가드 간 의미 괴리를 줄이는 편이 좋다. 규약 갱신 성격의 제안이며 target 자체의 결함은 아니다.

- **[INFO]** 영역 내 Overview 섹션 존재 여부 비일관
  - target 위치: `spec/2-navigation/14-execution-history.md` (`## Overview (제품 정의)`, line 1295 부근) vs 같은 영역의 `0-dashboard.md` / `1-workflow-list.md` / `10-auth-flow.md` / `11-error-empty-states.md` / `13-user-guide.md` / `15-system-status.md`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 ("다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일")
  - 상세: `spec/2-navigation` 은 다중 파일 영역이라 Overview 책임이 `_product-overview.md` 로 위임되는 것이 해당 영역의 실제 관례이며, 대부분의 sibling 문서(대시보드·워크플로우 목록·인증 플로우 등)는 이를 따라 본문(`## 1. 개요`, `## 1. 화면 구성 개요` 등) + `## Rationale` 2-섹션만 갖는다. 반면 `14-execution-history.md` 한 파일만 자체 `## Overview (제품 정의)` 섹션(EH-LIST/EH-DETAIL/EH-NAV 요구사항표 포함)을 별도로 갖고 있어 영역 내 구조가 비일관하다. "3섹션 권장"은 각 spec 이 자유롭게 택할 수 있는 옵션이라 이 자체가 규약 위반은 아니나(오히려 권장 구조에 더 부합), 같은 영역 안에서 구조 패턴이 갈리는 점은 일관성 관점에서 사소한 개선 여지다.
  - 제안: 구조 변경은 선택 사항. 굳이 통일하려면 `14-execution-history.md` 의 Overview 절 요구사항표(EH-*)를 유지하되 헤더만 다른 문서와 통일하거나, 반대로 다른 문서에도 필요 시 화면별 Overview 절을 허용하는 방향으로 project-planner SKILL.md 에 "영역 내 개별 문서가 자체 Overview 를 가질 수 있는 경우"를 명문화하면 향후 검토자의 혼선을 줄일 수 있다.

- **[INFO]** 폴더 목록 API 응답 포맷이 §3.1 본문에 명시되지 않음(실제 구현은 규약 준수)
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (`GET /api/folders`)
  - 위반 규약: 없음(단순 문서 완결성) — 참고: `spec/conventions/swagger.md` §5-2 (`ApiOkWrappedArrayResponse(Dto)` → `{ data: <Dto>[] }`)
  - 상세: 같은 문서 §3 메인 목록(`GET /api/workflows`)은 "페이지네이션 응답 형식은 API 규약 §5.2 준수"라고 명시하고, `0-dashboard.md` §7 도 "응답 본문은 공통 래퍼(`{ "data": ... }`)로 감싸진다"고 명시하는 반면, §3.1 폴더 API 섹션은 응답 envelope 형태를 언급하지 않는다. 실제 구현(`folders.controller.ts` 의 `@ApiOkWrappedArrayResponse(FolderDto)`)은 `spec/conventions/swagger.md` §5-2 에 정식 등재된 `{ data: <Dto>[] }` 패턴을 정확히 따르고 있어 **구현 자체는 문제 없음** — 다만 spec 본문에 그 사실이 명시되지 않아 독자가 §5.2(페이지네이션)와 혼동할 여지가 남는다.
  - 제안: §3.1 폴더 API 표 위에 "응답은 `{ data: FolderDto[] }` — 비-페이징 배열([Swagger 규약 §5-2](../conventions/swagger.md#5-응답-dto-규약))" 한 줄을 추가하면 완결성이 높아진다.

## 그 외 확인된 준수 사항 (참고)

- 에러 코드: `10-auth-flow.md` §5.4 의 OAuth callback `?error=` lower_snake_case 값은 `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리에 정확히 등재·상호링크되어 있어 규약 위반이 아니다.
- `1-workflow-list.md` Rationale §3 의 폴더 순환 오류에 대한 `VALIDATION_ERROR` 재사용은 `error-codes.md` §1 의 "시스템 전역 공용 코드는 prefix 없이" 예외 범주와 정합하며, `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와의 네이밍 충돌 회피 근거도 Rationale 에 명시돼 있다.
- DTO 배치: `DashboardSummaryDto`/`RecentWorkflowDto`/`RecentExecutionDto`(`dto/responses/dashboard-response.dto.ts`), `ExportWorkflowDto`(`dto/responses/workflow-response.dto.ts`) 모두 `spec/conventions/swagger.md` §5-1 이 요구하는 `dto/responses/` 위치·클래스 명명(`*Dto`)을 따른다.
- frontmatter: 번들된 6개 문서(`0-dashboard`/`1-workflow-list`/`10-auth-flow`/`11-error-empty-states`/`13-user-guide`/`14-execution-history`/`15-system-status`) 모두 `spec/conventions/spec-impl-evidence.md` §2~3 스키마(`id`/`status`/`code`, `partial` 시 `pending_plans`)를 준수한다. `1-workflow-list.md` 의 `pending_plans: plan/in-progress/spec-sync-workflow-list-gaps.md` 는 실제로 실존하며 올바른 frontmatter(`worktree`/`started`/`owner`)를 갖는다.
- `13-user-guide.md` §8 `<ImplAnchor>` 정의는 `spec/conventions/user-guide-evidence.md` 를 SoT 로 정확히 인용하며 데코레이터 화이트리스트(`@Post`/`@Get`/`@Put`/`@Patch`/`@Delete`)도 실제 NestJS 관례와 일치한다.
- 이번 라운드의 실제 코드 변경(`buildExecutionHref` 헬퍼 도입, `toSafeInternalPath` 추출)은 API endpoint·에러 코드·DTO 등 정식 규약이 다루는 surface 를 새로 발행하지 않는 순수 FE 내부 리팩터라, `spec/conventions/**` 대비 신규 위반 소지가 없다.

## 요약

이번 검토 대상 범위(`spec/2-navigation/`)는 이번 워크플로 라운드에서 실제로 변경되지 않았으며(diff 는 코드 전용), 기존 문서는 `error-codes.md`·`swagger.md`·`spec-impl-evidence.md` 등 관련 정식 규약을 대체로 충실히 따르고 교차 링크하고 있다. 발견된 사항은 모두 INFO 수준으로, (1) `spec-area-index.test.ts` 의 `0-` prefix 처리 방식이 project-planner SKILL.md 의 "0-" 의미 정의와 미묘하게 어긋나 향후 blind spot 여지를 남기는 점, (2) 같은 영역 내 Overview 섹션 유무가 문서마다 다른 점, (3) 폴더 목록 API 의 응답 envelope 형식이 본문에 명시되지 않은 점이며, 셋 다 현재 시스템 invariant 를 깨뜨리지 않는 문서 완결성·일관성 개선 제안 수준이다.

## 위험도

LOW
