# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 직전 라운드(13_37_11) `testing` reviewer 의 MEDIUM-위험 WARNING(`buildEditorHref` 콜사이트 회귀 테스트 부재)이 SUMMARY 병합 누락으로 이번 "WARNING 조치" 커밋에서도 그대로 누락된 것을 `requirement` reviewer 가 재확인했다. 그 외 자매 stale 주석 미조치 WARNING 1건과 사소한 INFO 다수가 있으나 기능 결함은 없다. 단, `security`/`side_effect`/`testing` 3개 reviewer 는 매니페스트상 `success` 로 보고됐음에도 해당 output 파일이 디스크에 존재하지 않아 내용을 검증하지 못했다(§권장 조치사항 참고).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/Testing | `buildEditorHref` 콜사이트 7곳 중 5곳에 slug-활성 회귀 가드 테스트가 없다. 직전 라운드(13_37_11) `testing` reviewer 가 MEDIUM 위험으로 명시했던 WARNING #2("헬퍼 오용에 의한 broken editor link 재발 방지" 검증 공백)이지만, 13_37_11 의 SUMMARY.md 가 "testing.md 파일이 디스크에서 확인되지 않는다"고 (실제로는 존재했음에도) 오보하면서 이번 "ai-review WARNING 조치" 커밋(5c4ffd5b)의 조치 대상 5건(W1~W5)에서 빠졌다. 프로덕션 코드(`buildEditorHref` 호출 인자) 자체는 이미 정확함이 확인되어 현재 기능 결함은 아니다. | `dashboard-page.test.tsx`(recent-workflows row-click·create-then-push 미검증) · `workflows-page.test.tsx:153`(`useParams: () => ({})` 무-slug 상태에서만 단언) · `triggers-page.test.tsx`(slug 주입돼 있음에도 href 단언 자체 없음) · `danger-tab.test.tsx:23,144`(무-slug 상태로만 통과) · `execution-list-page.test.tsx:196-201`("Open in Editor" 클릭이 bare path 로만 단언) · `components/triggers/cards/overview-card.tsx`(테스트 파일 자체 부재) | `schedules-page.test.tsx:459-460`/`execution-list-page.test.tsx`(row-click)의 "slug-누락 회귀 가드" 패턴(워크스페이스 스토어에 slug 주입 후 href/push 값 단언)을 5개 파일에 적용하고 `overview-card.tsx` 는 최소 렌더+href 단언 테스트 신설. plan `editor-slug-phase2.md` 의 `REVIEW WORKFLOW` 체크박스 반영 필요 |
| 2 | Documentation | stale 주석("editor 등 slug 밖")이 `use-workspace-slug.ts`(이번 커밋 W3 로 정정됨)와 동일 클래스로 `sidebar.tsx` 에도 있었으나 이번 조치에서 빠졌다. 직전 SUMMARY 의 "권장 조치사항 3"이 두 파일을 함께 지목했음에도 하나만 정정됨. 기능 영향은 없음(런타임 판정은 `pathname.startsWith` dual-check 로 정확) — 순수 주석 정확성 문제이며 차후 "에디터는 아직 slug 밖" 오독 소지. (참고: `requirement` reviewer 는 이 항목을 직전 라운드 등급표상 원래 INFO 였다고 보아 "조치 범위 이탈 아님"으로 판단 — 실제 영향 없는 vacuous 케이스라는 근거를 덧붙임. 두 관점 모두 기능 결함은 아니라는 데 동의.) | `codebase/frontend/src/components/layout/sidebar.tsx:442` | `use-workspace-slug.ts` 와 동일하게 "editor 등 slug 밖" 부분 제거 또는 "(문서·catch-all 등) slug 밖에선"으로 교체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `HELPER` 상수(`path.join(SRC, "lib", "workspace", "href.ts")`)가 두 guard 테스트 파일에 동일 리터럴로 중복 정의됨 — W2 의 "공유 헬퍼로 추출" 의도상 잔여 중복 | `no-raw-editor-href.test.ts`, `no-raw-execution-href.test.ts` | 필요하면 `href-guard-utils.ts` 로 함께 이전 가능하나, 두 파일이 서로 다른 exemption 목록을 가져 강제 통합 불필요 — 현행 유지 무방 |
| 2 | Maintainability | 두 layout wiring 테스트(`(editor)/w/[slug]/__tests__/layout.test.tsx`, `(main)/w/[slug]/__tests__/layout.test.tsx`)의 mock 셋업(`next/navigation`/`use-workspaces`/`workspace-store`)이 거의 동일하게 반복 | 위 두 파일 | 현재 2개뿐이라 허용 가능. 세 번째 slug 레이아웃 추가 시 공용 mock 팩토리 고려 |
| 3 | Maintainability | `workspace-slug-gate.test.tsx` 가 모듈-스코프 mutable state(`mockParams`/`storeState`/`switchWorkspaceSpy`)를 `beforeEach` 로 재설정하는 기존 컨벤션을 그대로 이전 — 이번 커밋이 새로 도입한 문제는 아님 | `codebase/frontend/src/lib/workspace/__tests__/workspace-slug-gate.test.tsx` | 현 상태 유지 가능. 새 케이스 추가 시 `beforeEach` 명시적 재대입 패턴 계속 유지 |
| 4 | Documentation | 직전 라운드(`13_37_11`)의 `RESOLUTION.md` 부재 — 이번 fresh review(현재 라운드)가 Critical/Warning 없이 clean 하면 그 자체가 "resolved" 로 인정되는 프로젝트 컨벤션이라 차단 사유는 아님 | `review/code/2026/07/09/13_37_11/` | 이번 라운드에서도 actionable 발견(Critical/Warning)이 남으므로, `13_37_11` 세션에 대한 `RESOLUTION.md` 작성 필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `buildEditorHref` 콜사이트 5/7 회귀 테스트 갭(직전 testing WARNING #2 미조치) 재확인. W1/W2/W4/W5 는 정확히 구현·검증됨(vitest 71/71 pass, tsc/eslint 클린) |
| documentation | LOW | 자매 stale 주석(`sidebar.tsx:442`) 미조치. W1~W5 docstring/CHANGELOG 품질은 양호 |
| maintainability | NONE | HELPER 상수 중복, layout mock 반복, 모듈-스코프 state 패턴 — 모두 INFO 수준 사소한 잔여 중복 |
| scope | NONE | 커밋 9개 파일 변경이 선행 SUMMARY W1~W5 와 정확히 1:1 대응, 범위 이탈 없음 |
| security | (파일 누락) | output 파일이 디스크에 없어 검증 불가 — 재시도 필요 |
| side_effect | (파일 누락) | output 파일이 디스크에 없어 검증 불가 — 재시도 필요 |
| testing | (파일 누락) | output 파일이 디스크에 없어 검증 불가 — 재시도 필요 |

## 발견 없는 에이전트

- `scope` — NONE. 범위 이탈·불필요 변경 없음(전부 INFO 성격의 긍정 확인).

## 권장 조치사항

1. `buildEditorHref` 콜사이트 회귀 가드 테스트를 5개 파일(`dashboard-page.test.tsx`, `workflows-page.test.tsx`, `triggers-page.test.tsx`, `danger-tab.test.tsx`, `execution-list-page.test.tsx`)에 추가하고 `overview-card.tsx` 테스트를 신설한다(WARNING #1).
2. `sidebar.tsx:442` 의 stale 주석을 `use-workspace-slug.ts` 와 동일하게 정정한다(WARNING #2).
3. `security`/`side_effect`/`testing` reviewer 를 재실행한다 — 매니페스트는 `success` 로 보고했으나 해당 output 파일(`security.md`/`side_effect.md`/`testing.md`)이 디스크에 존재하지 않아 이번 통합 보고서에 반영하지 못했다.
4. (선택) maintainability INFO 3건은 즉각 조치 불필요하나, 다음 관련 파일 수정 시 함께 정리 고려.
5. 위 1·2 항목 조치 후 fresh `/ai-review` 1회 재실행하여 clean 확인, 또는 `RESOLUTION.md` 작성.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명, 아래)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 실행된 7명 전원이 router_safety 에 의해 강제 포함됨(소스 코드 변경 시 security/requirement/scope/side_effect/maintainability/testing 항상 적용, CHANGELOG.md 변경으로 documentation 적용). 즉 router 자체의 1차 선별 결과와 무관하게 안전장치가 이번 변경 범위 전체를 커버함.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 변경 범위(테스트 재구성·주석·CHANGELOG)에 불필요하다고 판단(세부 사유 매니페스트 미포함) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |