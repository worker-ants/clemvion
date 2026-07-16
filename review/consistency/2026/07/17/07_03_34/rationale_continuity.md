# Rationale 연속성 검토 결과

- target: `plan/in-progress/spec-update-catch-all-terminal-contract.md`
- 모드: spec draft 검토 (`--spec`)

## 방법

target 이 언급하는 세 spec 문서(`_layout.md`, `9-user-profile.md`, `10-auth-flow.md`, `11-error-empty-states.md`)의 `## Rationale` 절 전문과, cross-cutting 인 `spec/data-flow/12-workspace.md` (URL slug = FE 라우팅 SoT), `spec/conventions/spec-impl-evidence.md` (`code:` 글로브 정책) 의 `## Rationale` 을 대조했다. 또한 target 이 스스로 인용하는 선행 결정 기록(`plan/complete/user-guide-routing-loop-fix.md` §결정, `(main)/[...rest]/page.tsx` docstring, `review/consistency/2026/07/17/00_32_57/SUMMARY.md`)을 실제로 열어 인용의 정확성을 검증했다.

## 발견사항

- **[INFO]** terminal 계약의 "기각된 대안" 이 `## Rationale` 이 아니라 본문 각주에만 남는다
  - target 위치: 제안 1 (`_layout.md` §2.2 각주, 85행에 추가할 텍스트), 제안 2 (`9-user-profile.md` §3, 155행)
  - 과거 결정 출처: 없음(신규 결정) — 다만 CLAUDE.md "정보 저장 위치" 표: "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  - 상세: catch-all 을 terminal 로 만든 결정에는 이미 두 개의 명시적으로 **기각된 대안**이 있다 — (a) "`/w/` 접두를 떼고 재-forward" (ping-pong 무한루프가 됨), (b) "`buildWorkspaceHref` idempotent 화" (호출자 버그 은폐 + `team-a`/`team-b` 충돌 시 정답 미정의). 이 두 대안과 기각 사유는 현재 `(main)/[...rest]/page.tsx` docstring 과 `plan/complete/user-guide-routing-loop-fix.md` §결정 에만 존재하고, target 이 제안하는 `_layout.md`/`9-user-profile.md` 본문 각주에는 "terminal 이다 + 왜(무한 리다이렉트)" 만 들어가고 두 기각 대안은 들어가지 않는다. plan/complete 문서는 완료 후 아카이브 성격이라 향후 `_layout.md` 만 읽는 사람이 발견하기 어렵고, 이는 target 스스로가 우려하는 "향후 구현자의 오독"(§배경 마지막 문단)과 같은 종류의 위험이다. 다만 CRITICAL/WARNING 은 아니다 — 기존 spec 에 이 결정을 뒤집는 선행 Rationale 자체가 없었으므로 "번복"이 아니라 "최초 기록 위치 선택"의 문제이며, 이 문서와 같은 스타일(footnote 에 배경+근거를 압축 병기)은 `_layout.md` 자체가 line 85·126 에서 이미 쓰고 있는 기존 관행과 일치한다.
  - 제안: (선택) `_layout.md`·`9-user-profile.md` 의 `## Rationale` 절에 "catch-all terminal 계약" 항목을 하나 추가해 두 기각 대안(strip 재-forward, idempotent href)과 기각 사유를 옮겨 적으면, 각주는 "무엇" 만 남기고 "왜/무엇을 검토했나" 는 Rationale 이 담당하는 본 프로젝트의 3-섹션 관행과 완전히 정렬된다. 차단 사유는 아니다.

## 교차검증 결과 (반증 없음)

target 의 핵심 주장 — "기존 spec 문언은 반증되지 않았다" — 을 독립적으로 재확인했다:

1. `11-error-empty-states.md:66,70` — "404 감지 = 존재하지 않는 라우트 접근" 과 "무효/비멤버 slug → 404 아님(FE 편의 redirect)" 두 행이 실제로 공존하며, target 이 주장하는 두 케이스 구분("slug 해석 실패" vs "라우트 부재")과 정확히 일치한다. `notFound()` 종결은 이 기존 정책의 적용이지 신규 채택이 아니라는 target 의 판단은 코드(`page.tsx:28-30` 주석이 동일 절을 직접 인용)와도 정합.
2. `10-auth-flow.md:443` — "redirect-only 중간 경로라 flash 허용" 문구는 실제로 로그인 후 `/dashboard` 리다이렉트 문맥에 한정된 괄호이며, 그 경로(`rest[0] !== "w"`)는 수정 후에도 그대로 redirect-only 로 남는다. target 의 스코프 한정 주장은 문서 원문과 일치.
3. `spec/data-flow/12-workspace.md` Rationale "URL slug = FE 라우팅 SoT" 의 "slug 없는 라우트(docs·catch-all)는 localStorage 힌트 기준" 문구는 `rest[0]==="w"` 케이스(target 의 변경 대상)와 다른 케이스(무-slug 진입)를 가리키므로 충돌하지 않는다.
4. `spec/conventions/spec-impl-evidence.md` R-1 (`code:` 글로브 허용, 영역 단위 책임) 은 제안 4 의 "여러 문서가 같은 파일(`href.ts`, `page.tsx`)을 `code:` 로 공유" 방식과 상충하지 않는다 — 동일 관행이 이미 저장소 다른 곳(예: `1-workflow-list.md` 등)에도 있다.
5. 이 결정 계열 자체가 이미 한 차례 Rationale 연속성 심사를 거쳤다 — `plan/complete/user-guide-routing-loop-fix.md` §"consistency-check WARNING 대응" W#2 가 "catch-all 이 redirect-only → 이원화" 를 정확히 같은 근거(§1.3 404 정책, §7.2 스코프 한정)로 이미 재검토해 **spec 위반 아님**으로 판정했다. target 은 그 판정을 그대로 상속해 문서화하는 후속 draft이며, 별도의 새 결정 번복을 시도하지 않는다.

기각된 대안의 무단 재도입(관점 1), 합의 원칙 위반(관점 2), 근거 없는 결정 번복(관점 3), invariant 우회(관점 4) 어느 것도 발견되지 않았다.

## 요약

target 은 신규 spec 결정이 아니라 이미 구현·검증되고 선행 consistency-check(00_32_57)에서 한 차례 Rationale 정합성 심사(W#2)를 통과한 코드 현실을 spec 본문에 반영하는 "보강" draft다. 인용된 세 문서(`_layout.md`, `9-user-profile.md`, `10-auth-flow.md`, `11-error-empty-states.md`)의 `## Rationale`·본문 문언을 전수 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 없다. 유일한 관찰은 정보 배치 스타일에 관한 INFO 하나 — terminal 계약 결정에 딸린 두 개의 기각된 대안(strip 재-forward, idempotent href)이 spec 의 `## Rationale` 이 아니라 코드 docstring·완료된 plan 문서에만 남아 있어, 향후 `_layout.md` 만 참조하는 독자에게는 발견성이 낮다는 점이다. 이는 차단 사유가 아니며 target 의 체크리스트 진행에 영향을 주지 않는다.

## 위험도

NONE
