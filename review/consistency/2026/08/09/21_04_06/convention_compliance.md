# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

`git diff origin/main...HEAD` 는 `spec/5-system/**` 를 **전혀 건드리지 않는다** — 변경은
`codebase/backend/{README.md, src/common/**, src/modules/secret-store/**.spec.ts,
src/nodes/integration/http-request/**.spec.ts, test/secret-store-like-prefix.e2e-spec.ts}` 와
`plan/in-progress/*.md` 3건뿐이다 (전부 테스트 픽스처 정리·주석 앵커 정정·신규 e2e 1건 — 기능
변경 없음). 따라서 target 문서(`spec/5-system/**.md`, 18개 파일)는 이 라운드의 diff 와 무관하게
**기존 상태 그대로**이며, 본 검토는 (a) 기존 상태가 여전히 규약을 준수하는지 재확인하고 (b) 이번
diff 가 target 문서에 새로운 정합 의무를 만들었는지를 확인하는 두 갈래로 진행했다.

같은 세션의 직전 라운드(`review/consistency/2026/08/09/20_02_21/convention_compliance.md`)가
`spec/5-system/**` 전체를 `spec/conventions/**` 전체와 이미 전수 대조했고 CRITICAL/WARNING 0 ·
INFO 2 로 수렴했다. target 문서가 그 사이 변경되지 않았으므로 그 결론은 그대로 유효하다. 본
라운드는 중복 전수 재검사 대신, **이번 diff 가 새로 건드린 영역**(부트 캐너리 주석·워크스페이스
UUID 픽스처·secret-store LIKE 가드 e2e)이 target 문서(특히 `1-auth.md` §"부트 캐너리", `2-api-
convention.md` §2.3, `3-error-handling.md` §1.3)의 기존 서술과 여전히 합치하는지를 중점 재확인했다.

## 발견사항

- **[INFO] `spec/conventions/secret-store.md` §2.1 각주의 "실행 가능한 테스트 부재" 서술이 이번 diff 로 stale 해짐**
  - target 위치: 엄밀히는 대상 target(`spec/5-system/**`) 밖 — `spec/conventions/secret-store.md`
    §2.1 `deleteByPrefix` 각주("**알려진 검증 공백**: in-memory 테스트 mock 이 `startsWith` 라 LIKE
    와일드카드 의미론을 재현하지 않는다 — … **아직 실행 가능한 테스트로 고정돼 있지 않고** 본
    각주가 유일한 기록이다. 재현하려면 … e2e 를 추가해야 한다.")
  - 위반 규약: 없음(target 위반 아님) — 다만 `spec/conventions/**` 자체가 이번 diff 로 사실과
    어긋난 상태가 됐다는 관측
  - 상세: 이번 diff 가 정확히 그 "추가해야 한다"던 e2e 를 신설했다
    (`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`, `spec/conventions/secret-
    store.md §2.1` 를 직접 인용하며 "가드의 존재 근거를 실 Postgres 에게 직접 묻는다" 고 명시).
    즉 convention 문서가 스스로 "미해결"이라 적어 둔 검증 공백이 이제 닫혔는데, convention 문서
    텍스트는 갱신되지 않았다. `spec/5-system/**` 는 이 각주를 재인용하지 않으므로 target 자체의
    위반은 아니지만, 다음에 이 각주를 읽는 개발자가 "아직 e2e 없음" 을 사실로 믿고 중복 작업을
    할 위험이 있다.
  - 제안: `spec/conventions/secret-store.md §2.1` 각주에 "2026-08-09, `test/secret-store-like-
    prefix.e2e-spec.ts` 로 해소됨" 한 줄을 추가하거나 각주 자체를 제거. 이는 `project-planner`
    권한 영역(`spec/**`)이라 본 리뷰는 조치 없이 기록만 한다.

- **[INFO] (직전 라운드 재확인 — 변경 없음) `## Overview` 섹션 유무가 파일마다 다름**
  - target 위치: `2-api-convention.md` · `5-expression-language.md` · `6-websocket-protocol.md` ·
    `11-mcp-client.md` · `7-llm-client.md` · `16-system-status-api.md` (Overview 없음) vs 나머지
    11개 파일(`## Overview (제품 정의)` 있음)
  - 위반 규약: CLAUDE.md/SKILL.md "Overview / 본문 / Rationale 3섹션 **권장**"
  - 상세: 직전 라운드(20_02_21) 검토 결과와 동일 — 이번 diff 로 새로 생기거나 악화된 것이 아니다.
    "권장" 문구이고 Overview 없는 6개 파일은 공통적으로 순수 기술 프로토콜/컨벤션 성격이라
    설명 가능한 편차다.
  - 제안: 조치 불요. 기록 유지.

- **[INFO] (직전 라운드 재확인 — 변경 없음) `spec/5-system/` 전용 `0-overview.md` 부재**
  - target 위치: 디렉토리 전체 (`_product-overview.md` 만 존재, 루트 `spec/0-overview.md` 를 대신
    인용)
  - 위반 규약: SKILL.md 명명 컨벤션 — `spec/<영역>/0-overview.md`
  - 상세: 17개 파일 전체가 일관되게 동일 패턴이라 기존 설계이고, 명명 컨벤션도 "권장" 수준.
  - 제안: 조치 불요. 기록 유지.

## 확인된 양호 사례 (이번 diff 관련 영역)

- **`1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증" 은 이번 diff 이후에도 정확**:
  이 Rationale 절은 구체적 라우트 수(73/142)를 인용하지 않으므로, `workspace-reflection-canary.ts`
  주석이 "73건" → "142건" 으로 갱신되고 `roles.guard.ts`/`data-flow/12-workspace.md` 의 73건과의
  관계를 명확히 구분한 이번 diff 와 **충돌하지 않는다**.
- **`2-api-convention.md` §2.3 / `3-error-handling.md` §1.3 의 `X-Workspace-Id` 3분기 서술**
  (`WORKSPACE_ID_REQUIRED` vs 형식-오류 `VALIDATION_ERROR` vs 코드 없는 403, `isUuidShaped` 가
  `isValidUuid` 보다 느슨한 의도적 비대칭)이 이번 diff 가 손댄 `uuid.ts`/`workspace-context.util.ts`
  의 앵커 정정 주석과 **정확히 합치**한다. 코드 주석의 정정(캐너리로 잘못 지목됐던
  `system-status.e2e-spec.ts` → 실제로는 `uuid.spec.ts`/`workspace-context.util.spec.ts`)은 순수
  주석/테스트 변경이라 스펙이 서술하는 **동작 자체**는 바뀌지 않았고, 스펙도 이 동작을 정확히
  반영하고 있다.
- **`16-system-status-api.md` §4 보안 / `2-api-convention.md` L438** 의 "system-status 는 워크스페이스
  경계 없음, `@Roles()`/스코핑 미적용" 서술이 이번 diff 의 코드 주석
  ("`system-status.controller.ts` 에는 `@Roles()` 도 `@WorkspaceId()` 도 없다")과 정확히 일치 —
  교차 검증됨.
- **신규 파일 `common/__test-utils__/workspace-id-fixtures.ts`**: `spec-impl-evidence.md §R-1`
  (`code:` 글로브는 "≥1 매치" 의무일 뿐 전 파일 나열 의무가 아님)에 비춰 `1-auth.md` frontmatter
  `code:` 목록에 이 파일이 없어도 위반이 아니다 — 기존 글로브(`common/decorators/*.ts` 등)가 이미
  ≥1 매치를 만족하고, 이 파일은 spec 이 "약속한 surface" 가 아니라 테스트 내부 픽스처이므로
  frontmatter 갱신 의무 대상이 아니다.

## 요약

이번 diff 는 `spec/5-system/**` 를 전혀 수정하지 않는 순수 backend 테스트/주석 위생 변경이라,
target 문서는 직전 라운드(20_02_21)에서 이미 CRITICAL/WARNING 0 으로 확인된 상태를 그대로
유지한다. 이번 diff 가 새로 건드린 영역(워크스페이스 UUID 검증 비대칭, 부트 캐너리, secret-store
LIKE 가드)에 대해 target 문서가 서술하는 내용을 재대조한 결과 모두 코드와 합치했고 새로운
CRITICAL/WARNING 은 없다. 유일하게 새로 발견한 것은 target 밖(`spec/conventions/secret-store.md`)
의 각주 하나가 이번 diff 가 신설한 e2e 로 인해 stale 해졌다는 INFO 성 관측이며, 나머지 두 INFO 는
직전 라운드와 동일한 기존 관찰의 재확인이다.

## 위험도

NONE
