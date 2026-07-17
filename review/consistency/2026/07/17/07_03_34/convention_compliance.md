# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--spec` (spec draft 검토)
- target: `plan/in-progress/spec-update-catch-all-terminal-contract.md` (developer → project-planner 위임 draft, 제안 1–4 + 체크리스트)
- 참조: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/**`, `spec/conventions/error-codes.md`, `.claude/docs/plan-lifecycle.md`, CLAUDE.md §정보 저장 위치

## 발견사항

- **[WARNING]** 제안 3(선택) 채택 시 `11-error-empty-states.md` 에도 제안 4 와 동형인 `code:` 완결성 갭이 새로 생김
  - target 위치: target 문서 "제안 3 — `11-error-empty-states.md` §1.3 표에 행 추가 (선택)" 및 "제안 4 — frontmatter `code:` 글로브 보강"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` = "본 spec 이 약속한 surface 의 구현 경로"
  - 상세: 제안 4 는 `_layout.md`·`9-user-profile.md`·`10-auth-flow.md` 세 문서만 "본문에서 catch-all 동작을 명시적으로 약속하면서 `code:` 로 그 구현 파일을 가리키지 않는" 갭으로 지목해 `(main)/[...rest]/page.tsx`(+`href.ts`) 추가를 제안한다. 그런데 제안 3(선택)이 채택되면 `11-error-empty-states.md` §1.3 표에도 "`(main)/[...rest]` catch-all 이 `notFound()` 로 종결한다" 는 **동일 성격의 명시적 약속**이 새로 생긴다. 실제로 확인한 결과 이 파일의 현재 frontmatter `code:` 목록(`empty-state.tsx`/`error-page.tsx`/각 페이지 `page.tsx`/`not-found.tsx` 등)에는 catch-all `(main)/[...rest]/page.tsx` 가 없다 — 제안 4 가 다른 세 문서에서 고친 것과 완전히 같은 유형의 "가드가 못 잡는 완결성 갭"(각 문서 이미 다른 파일로 ≥1 매치해 `spec-code-paths.test.ts` green)이 이 문서에만 남는다. 제안 4 의 표에 `11-error-empty-states.md` 행이 없는 것은 누락으로 보인다.
  - 제안: 제안 3 을 채택할 경우, 제안 4 표에 `11-error-empty-states.md | §1.3 catch-all → notFound() 종결 | (신규 갭) | codebase/frontend/src/app/(main)/[...rest]/page.tsx` 행을 추가한다. 제안 3 을 최종적으로 기각한다면 이 항목은 해당 없음.

- **[INFO]** `spec_area` frontmatter 가 실제 대상 문서 수와 불일치 (정식 규약은 아니고 관행 수준)
  - target 위치: target 문서 frontmatter `spec_area: spec/2-navigation/_layout.md`
  - 위반 규약: 명문화된 `spec/conventions/**` 항목은 없음 — `plan/complete/spec-draft-webchat-execution-residuals.md`·`plan/complete/spec-draft-pr874-deferred-docs.md` 등 기존 plan 들이 정착시킨 **비공식 관행**(`spec_area` 에 영향받는 spec 파일을 콤마로 전부 나열)과의 형식 일관성 문제
  - 상세: 본 제안은 `_layout.md`·`9-user-profile.md`·`10-auth-flow.md` (+선택 `11-error-empty-states.md`) 4개 spec 파일을 대상으로 하는데 `spec_area` 는 `_layout.md` 하나만 기재한다. `plan-lifecycle.md §4`·`spec-impl-evidence.md` 어디에도 `spec_area` 스키마·가드가 없어(grep 결과 build-gate 미대상) build 를 깨지는 않지만, 다른 다중-대상 plan 들의 콤마 나열 패턴과 형식이 어긋난다.
  - 제안: `spec_area: spec/2-navigation/_layout.md, spec/2-navigation/9-user-profile.md, spec/2-navigation/10-auth-flow.md` (선택적으로 `11-error-empty-states.md`) 로 확장. 또는 이 필드가 반복적으로 쓰이는 만큼 `plan-lifecycle.md §4` 에 정식 필드로 승격해 다중-경로 표기법을 명문화하는 편도 고려 가능(규약 갱신 옵션).

- **[INFO]** 검토 시점 저장소 상태가 target 스냅샷보다 앞서 있어 체크리스트가 stale 로 보임 (target 문서 자체의 텍스트 위반은 아님, 세션 정합성 참고용)
  - target 위치: target 문서 "## 체크리스트" (전항목 `[ ]`)
  - 위반 규약: 직접 규약 위반 아님 — `.claude/docs/plan-lifecycle.md` §2/§5 의 "체크리스트가 실제 진행 상태를 반영해야 한다" 는 취지와의 정합성 참고 사항
  - 상세: 검토 시점 working tree 에는 이미 `spec/2-navigation/_layout.md`·`9-user-profile.md`·`10-auth-flow.md`·`spec/data-flow/12-workspace.md` 가 제안 1·2·4(+세션 중 추가된 제안 5·6)를 반영한 상태로 uncommitted 수정돼 있고, 같은 plan 파일의 working-tree 버전에는 "`--spec` 사전 검토 (07_03_34): BLOCK: NO" 노트와 제안 5·6 이 이미 추가돼 있다. 그러나 (이 체크가 대상으로 받은) frozen target 텍스트와 체크리스트는 모두 미착수 상태(`[ ]`)로 남아 있어, 리뷰 시점 기준으로는 실제 반영 상태와 체크리스트가 어긋난다.
  - 제안: 최종 커밋 전에 체크리스트를 실제 반영 상태(제안 1·2·4 적용 완료, 제안 5·6 반영 여부)에 맞춰 갱신하고, `plan/complete/` 이동 조건(전항목 `[x]`)을 만족하는지 재확인.

## 요약

target 문서는 `spec/conventions/spec-impl-evidence.md` 의 `code:` 프론트matter 스키마, `.claude/docs/plan-lifecycle.md` 의 plan frontmatter 스키마(`worktree`/`started`/`owner` 필수, `(unstarted)` sentinel, 추가 필드 허용), 그리고 저장소가 정착시킨 "spec-update-*" 위임 draft 문서 구조(배경 → 제안 N → 반영 후속 → 체크리스트 → 출처)를 전반적으로 잘 준수한다. 인용된 spec 줄 번호·문구는 실측과 정확히 일치하고, "terminal"·"catch-all" 등 용어도 기존 spec 전반(실행 엔진·노드 출력 등)에서 이미 쓰이는 어휘와 합치하며, frontmatter `code:` 에 인라인 YAML 주석을 다는 패턴도 `4-integration.md` 의 선례와 일치한다. 유일한 실질적 갭은 제안 4 의 완결성 기준(catch-all 을 명시적으로 약속하는 문서엔 그 구현 경로를 `code:` 로 명시)을 제안 3(선택)이 채택될 경우 `11-error-empty-states.md` 에는 적용하지 않은 점이며, 나머지는 `spec_area` 다중-경로 표기 및 세션 중 관찰된 체크리스트-실제상태 드리프트 같은 경미한 형식 사안이다. Critical 급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
