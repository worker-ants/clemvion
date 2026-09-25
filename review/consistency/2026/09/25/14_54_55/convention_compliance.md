# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-path-guard.md`

## 검토 범위와 방법

target 은 `spec/data-flow/12-workspace.md` · `spec/5-system/{1-auth,2-api-convention,3-error-handling,13-replay-rerun}.md` ·
`spec/2-navigation/{6-config,9-user-profile}.md` · `spec/conventions/{error-codes,swagger}.md` 아홉 개 spec 파일에 대한
편집 지시(diff 형태 아님, 산문 지시)를 담은 spec draft 다. 정식 규약 준수 여부를 다음 순서로 확인했다:

- `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` 전문을 저장소에서 직접 읽어 (prompt 번들에는
  컨텍스트 예산 초과로 두 파일 모두 절단돼 있었다 — `feedback_consistency_spec_mode_budget` 교훈과 동일 패턴) 명명·
  rename 정책·DTO/데코레이터 체크리스트 규정과 target 의 C-1~C-9 편집 지시를 대조.
- target 이 인용하는 spec 원문 문구(`3-error-handling.md §1.2/§1.3`, `2-api-convention.md §5.3`,
  `data-flow/12-workspace.md` Rationale 여러 절, `1-auth.md §1.5.4`)를 실제 파일에서 grep 대조해 인용 정확도를 확인.
- 새로 도입되는 식별자(`@WorkspaceParam`, `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`, 저장소
  가드명 `workspace-param-binding`)를 기존 코드(`workspace.decorator.ts`)·spec 카탈로그와 대조해 명명 패턴 일치 여부 확인.

## 발견사항

- **[INFO]** B-1 절의 "Planned 인라인 마커" 인용이 `spec-impl-evidence.md §3` 전체를 가리켜, 마커 **문법**(`*(미구현 · Planned)*` 헤딩 표기, `1-auth.md §1.3`·§4.1 Planned 표에서 실제로 쓰는 형태)의 근거로 읽힐 여지가 있다.
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` §B-1 "이 저장소의 «계획(Planned)/미구현» 인라인 마커(`spec-impl-evidence.md §3`)는 …"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status` 라이프사이클 표 — `backlog/spec-only/partial/implemented/archived`)
  - 상세: §3 은 frontmatter `status` 필드의 상태 전이만 정의하고, 본문에 쓰는 `*(미구현 · Planned)*` 같은 인라인 텍스트 마커의 표기 자체는 규정하지 않는다(별도 조항 없음 — grep 0건). `status: partial` 이 이런 인라인 마커가 등장하는 문서들의 공통 전제라는 점에서 인과관계는 있으나, §3 을 "그 마커의 근거 조항"으로 읽으면 다음 사람이 §3 에서 마커 문법을 찾다가 못 찾는다.
  - 제안: "`spec-impl-evidence.md §3`(`status: partial` 라이프사이클)" 처럼 무엇을 가리키는지 한정하거나, 실제 마커 선례(`1-auth.md §1.3`/§4.1 Planned 표)를 병기. 이 항목은 이 draft 가 채택한 "spec+구현 동일 PR" 결정 자체에는 영향이 없다 — 인용 정밀도 문제일 뿐이다.

- **[INFO]** 신설 코드 `EDITOR_REQUIRED`/`OWNER_REQUIRED` (C-1 (e), C-2) 가 도메인 prefix 없이 등재되는데, `error-codes.md §1` 은 prefix-less 예외를 `VALIDATION_ERROR`·`INVALID_TOOL_ARGUMENTS` 두 건만 명시적으로 콜아웃한다.
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-1 (e) 표, C-2 `EDITOR_REQUIRED`/`OWNER_REQUIRED` 신설 행
  - 위반 규약: `spec/conventions/error-codes.md §1` "도메인 prefix (권장)"
  - 상세: 실제로는 이미 `ADMIN_REQUIRED`·`NOT_A_MEMBER` 가 prefix-less 로 카탈로그(`3-error-handling.md §1.2`)에 등재돼 있어 이번 신설은 **기존 선례를 그대로 따른 것**이고 위반이 아니다. 다만 §1 의 명시적 콜아웃 목록이 이 RBAC 코드군을 아직 언급하지 않아, 신설분(`EDITOR_REQUIRED`/`OWNER_REQUIRED`)이 향후 다른 리뷰에서 "prefix 누락"으로 오탐될 여지가 남는다.
  - 제안: 강제 사항 아님 — 필요하면 `error-codes.md §1` 에 "역할·멤버십 거부군(`*_REQUIRED`, `NOT_A_MEMBER`)은 시스템 전역 공용 코드로 prefix 없이 쓴다" 한 줄을 이 draft 나 후속 편집에서 추가하는 것을 고려할 수 있다.

## 준수 확인된 항목 (참고)

- **명명 규약**: 신설 코드 4종(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`) 모두 `UPPER_SNAKE_CASE`, 의미 기반 명명(§1 원칙) 준수. `@WorkspaceParam('<name>')` 은 기존 `@WorkspaceId()`(`ROUTE_ARGS_METADATA` 팩토리 identity 패턴)와 동일 설계를 따르며 이름도 자연스러운 형제 관계.
- **rename 정책(error-codes.md §2)**: 이번 변경은 기존 wire 코드의 rename 이 아니라 "코드 없는 403(전역 기본값 `FORBIDDEN`)" 을 전용 코드로 대체하는 신설이다. 유일하게 실질적 wire 값 변경이 생기는 자리(`1-auth §1.5.4` `forbidden`/`admin_required` → `ADMIN_REQUIRED`)에 대해서도 draft 가 frontend grep(0건 분기)으로 breaking 영향을 직접 확인해 두었다(C-3). `admin_required` 를 §5(Retired) 아닌 §3(Historical, 유지)에 남기는 판단도 §5 정의("코드베이스에서 완전 제거")와 정확히 일치한다 — 서비스 코드에 여전히 존재하는 두 번째 방어선이라는 draft 자신의 서술과 부합.
- **API 문서 규약(swagger.md)**: C-5 의 체크리스트 수정(`@WorkspaceId()` · `@WorkspaceParam(...)` 병기, 코드 병기 문구)이 실제 `swagger.md §5-4` 원문과 정확히 대조된다 — 인용·치환 대상 문구가 실재한다.
- **문서 구조 규약**: 신설 Rationale 절 제목 형식(`### <제목> (YYYY-MM-DD)`)이 `data-flow/12-workspace.md` 의 기존 절 제목 관례와 일치. 대상 spec 문서들은 이미 Overview/본문/Rationale 3섹션 구조를 갖추고 있고, draft 의 삽입은 그 구조 내부(Rationale 신설·기존 절 보강)에 머문다 — 신규 최상위 spec 파일 생성이 아니므로 `0-` prefix·`_product-overview.md` 규칙은 해당 없음.
- **plan frontmatter(Gate C 등)**: `spec_impact` 가 9개 실재 spec 경로의 리스트로 채워져 있고 bare `none` 오용 없음. `worktree`/`started`/`owner` 필드도 정상.
- **인용 정확도**: `3-error-handling.md §1.3` "코드 없는 403", `2-api-convention.md §5.3` "403=`FORBIDDEN`", `swagger.md §5-4` 체크리스트 문구, `1-auth.md §1.5.4` 표 행 등 draft 가 "현재 이렇다"고 인용한 모든 자리를 grep 대조했고 전부 실재 문구와 일치했다.

## 요약

target 은 새 데코레이터·에러 코드·저장소 가드를 도입하면서도 명명(UPPER_SNAKE_CASE·의미 기반)·rename 안정성 정책·swagger 체크리스트·문서 3섹션 구조 등 `spec/conventions/` 의 정식 규약을 세밀하게 따르고 있다. 특히 `error-codes.md §2`(rename=breaking) 와 §3/§5 의 경계(유지 vs 은퇴)를 정확히 구분해 적용한 점, 그리고 유일한 실질적 wire 변경 지점에 대해 frontend 영향을 직접 grep 으로 확인해 둔 점이 두드러진다. 발견된 두 건은 모두 INFO 등급의 인용 정밀도·선제적 문서 보강 제안이며, 채택된 설계 결정 자체를 흔들지 않는다.

## 위험도

LOW
