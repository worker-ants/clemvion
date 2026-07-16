# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 점검 절차

1. `.claude/config/doc-sync-matrix.json` Read — `rows[]` 21개 trigger 색인 확보.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 + "자주 누락되는 항목") 보조 Read.
3. 변경 file 목록: 이번 커밋(`34008deb5` `fix(navigation): 사용자 가이드(/docs) 진입 시 /w/<slug> 무한 중첩 라우팅 fix` + 후속 `89c4b1f6b` plan frontmatter 보정) 8개 파일을 `git show --stat` 로 대조.
4. 각 파일을 21개 trigger 의 glob/semantic 조건에 매칭.

## 대상 파일 및 매칭 결과

| 파일 | 매칭되는 trigger |
| --- | --- |
| `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` | 없음 (e2e 테스트 신설, guard 강화 목적) |
| `codebase/frontend/src/app/(main)/[...rest]/page.tsx` | 없음 (`(main)` catch-all 리다이렉트 로직 — 어떤 trigger glob 도 `codebase/frontend/src/app/**` 를 지정하지 않음) |
| `codebase/frontend/src/app/(main)/__tests__/workspace-redirect.test.tsx` | 없음 (테스트) |
| `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx` | 없음 (신규 테스트) |
| `codebase/frontend/src/components/layout/sidebar.tsx` | `new-ui-string` (semantic, `codebase/frontend/src/**/*.tsx`) 후보로 검토했으나 **불일치**로 판정 — 아래 상세 참고 |
| `codebase/frontend/src/lib/workspace/href.ts` | 없음 (docstring/주석만 추가, 런타임 동작·문자열 불변) |
| `plan/complete/ai-agent-tool-payload-budget-followups.md` | 없음 (본 PR 과 무관한 선행 plan 의 frontmatter `spec_impact` 보정 — Gate C 대응, `codebase/` 무변경) |
| `plan/in-progress/user-guide-routing-loop-fix.md` | 없음 (plan 문서 자체이며, 문서 본문 §4 DOCUMENTATION 단계에서 "해당 행 없음" 자가 판정 기록) |

### `sidebar.tsx` — `new-ui-string` semantic trigger 상세 검토

diff 는 `navItems` 배열에 `workspaceScoped: boolean` 필드를 추가하고 그 값을 `/docs` 항목만 `false` 로 설정한 것이 전부다. 확인한 사항:

- 신규 `labelKey` 없음 — 기존 `sidebar.dashboard` / `sidebar.userGuide` 등 이미 dict 에 등록된 키를 그대로 재사용.
- 신규 `t(...)` 호출 없음, 신규 하드코딩 한국어 리터럴 없음.
- 변경은 raw 문자열이 아니라 라우팅 스코프를 나타내는 내부 boolean 플래그이며 사용자에게 노출되는 텍스트가 아니다.

따라서 `new-ui-string` trigger 의 실질 조건("신규 한국어 리터럴")을 충족하지 않는다 — dict(`{ko,en}`) 갱신 대상 아님. i18n parity 가드(`i18n.test.ts`, `hardcoded-korean-ratchet.test.ts`)도 이 변경으로 인한 신규 baseline 초과가 없을 것으로 판단된다(신규 리터럴이 없으므로).

### 그 외 trigger 미매칭 확인

- **새 노드 추가 / 노드 schema 변경**: `codebase/backend/src/nodes/**` 변경 없음 — 매칭 없음.
- **통합/제공자 변경**: provider 관련 코드 변경 없음.
- **유저 가이드 신규 섹션 디렉토리**: `codebase/frontend/src/content/docs/*/` 디렉토리 변경 없음 — `locale.ts` 갱신 불필요.
- **인증·권한·세션 흐름 변경**: 이번 변경은 `codebase/backend/src/modules/auth/**` 를 건드리지 않는다. 워크스페이스 slug 라우팅이라는 이름 때문에 얼핏 인접해 보이지만, 실제 trigger glob 은 backend auth 모듈이며 이번 변경은 순수 frontend 라우팅(sidebar href·catch-all redirect)이다 — 매칭 없음.
- **표현식 언어 변경**: `codebase/packages/expression-engine/**` 무변경.
- **실행·디버깅 흐름 변경**: backend 실행 엔진·디버그 로깅 무변경.
- **신규 warningCode/errorCode**: backend `warningRules`/`error-codes.ts` 무변경.
- **spec 신규/대규모 변경**: `spec/**` 파일 변경 없음(이번 diff 에 spec 파일 없음) — `spec-major-change` trigger 불일치.
- **user-guide GUI 흐름 절 신규/변경**: `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` 무변경.

## 참고 사항 (INFO, 비차단)

`plan/in-progress/user-guide-routing-loop-fix.md` 본문의 "consistency-check WARNING 대응" 절에 다음 서술이 있다:

> 다만 catch-all 계약이 넓어지는 것은 사실 → **spec 보강 draft 를 정식 항목으로 포함**
> (`plan/in-progress/spec-update-catch-all-terminal-contract.md`, developer 는 spec 직접 수정
> 불가 → project-planner 위임)

작업 체크리스트 10번 "spec 보강 draft (`spec-update-catch-all-terminal-contract.md`) → project-planner 위임" 은 아직 미체크(`[ ]`) 상태이며, 실제로 `plan/in-progress/spec-update-catch-all-terminal-contract.md` 파일은 이번 변경 set 에 없다(향후 별도 turn 에서 project-planner 로 위임 예정으로 plan 에 명시).

이는 매트릭스의 `spec-defect-found` 행("spec 자체에 누락·오류가 있다고 판단됨" → `plan/in-progress/spec-update-<name>.md` 작성 후 project-planner 위임)에 해당하는 흐름이지만, 본 리뷰어의 핵심 관점(docs MDX·i18n dict·backend-labels 동반 갱신)과는 결이 다른 spec 거버넌스 절차이고, developer 가 스스로 인지·plan 에 기록해 후속 조치를 예고한 상태이므로 **차단 사유로 분류하지 않는다**. 다만 이 draft 가 실제로 project-planner 에게 위임되지 않은 채 plan 이 `complete` 로 이동하면 spec-pending-plan-existence 류 가드가 놓칠 수 있는 gap 이므로, 후속 turn 에서 반드시 처리되는지 확인이 필요하다는 점만 기록해 둔다.

## 요약

매트릭스 trigger 21개 중 이번 변경 set(8개 파일: e2e 테스트 1·frontend 라우팅 컴포넌트/헬퍼 3·신규/기존 테스트 2·plan 문서 2)에 매칭되는 항목은 **0건**이다. 변경은 사이드바 "/docs" 링크의 워크스페이스 slug 오부착과 `(main)/[...rest]` catch-all 의 무한 리다이렉트를 고치는 순수 프론트엔드 라우팅 버그 fix로, 신규 노드·노드 schema·신규 UI 문자열(dict 키)·신규 통합·신규 가이드 섹션·auth 백엔드 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error 코드 중 어느 것도 발생시키지 않는다. `sidebar.tsx` 의 `navItems` 구조 변경은 기존 dict 키만 재사용하는 내부 boolean 플래그 추가라 i18n parity 위반도 없다. developer 의 plan 문서(§4 DOCUMENTATION)도 동일하게 "해당 행 없음"으로 자가 판정했으며, 본 리뷰는 이를 독립적으로 재확인했다. 유일한 비차단 참고사항은 plan 내 명시된 spec 보강 draft(`spec-update-catch-all-terminal-contract.md`) 위임이 아직 완료되지 않았다는 점(항목 10 미체크)이며, 이는 user-guide-sync 범위 밖(project-planner 위임 절차)이라 INFO 로만 기록한다.

## 위험도

NONE
