# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건 (신규 라우트 세그먼트 `[slug]` 와 기존 `/docs` catch-all `[...slug]` 파라미터명 충돌이 plan 의 spec-sync 체크리스트에서 누락)

## 전체 위험도
**HIGH** — 기술적 충돌 자체는 plan 이 이미 인지해 코드 rename(`[...slug]`→`[...path]`)으로 완화하기로 했으나, 그 완화가 (a) 아직 명시적 구현 체크리스트 항목이 아니라 상단 요약 prose 로만 존재하고 (b) 대응 spec 문서(`13-user-guide.md`) 갱신이 spec-sync 스텝에서 누락되어 있어, 이대로 착수하면 코드-스펙 drift 로 조용히 남을 위험이 크다. 여기에 `Workspace.slug` UNIQUE 미명시(워크스페이스 격리 관련 민감 영역), spec 반영 체크리스트 스코프 과소평가(`_layout.md` 등 build-가드 미대상 문서 다수 누락), impl-prep payload 스코프 오배선(9-user-profile.md 누락) 등 구조적 이슈가 겹쳐 HIGH 로 평가한다. `rationale_continuity` checker 결과 파일이 실제로 존재하지 않아(상태는 success 로 보고됐으나 Read 실패) 통합 커버리지에 공백이 있다는 점도 감안해야 한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (+ cross_spec INFO, plan_coherence WARNING 로 동일 사안 교차확인) | 신규 라우트 세그먼트 `[slug]`(`/w/[slug]/...`)가 기존 `/docs` catch-all 파라미터 `[...slug]`와 이름이 같아, 중첩 시 Next.js `params.slug` 가 하위 catch-all 값으로 덮여쓰일 위험. plan 상단 요약에 rename(`[...slug]`→`[...path]`) 완화가 prose 로만 언급되고 실행 체크리스트 항목이 아니며, 대응 spec 문서 갱신도 spec-sync 스텝(TL;DR #10 / §8)에 없음 | `spec/2-navigation/13-user-guide.md` frontmatter `code:`(7행 `docs/[...slug]/page.tsx`), 본문 §1(27행)·§3(93행) | `plan/in-progress/workspace-slug-routing.md` 상단 요약(10~14행, prose 뿐) 및 TL;DR #10 / "구현 단계" §8 spec 반영 체크리스트(현재 9-user-profile §3·data-flow/12-workspace Rationale·10-auth-flow §7.2 3건만 명시) | plan 에 (a) `(main)/docs/[...slug]`→`(main)/docs/[...path]` rename 을 Phase 1 구현 체크리스트의 first-class 항목으로 승격, (b) §8 spec 반영 스텝에 `13-user-guide.md` frontmatter `code:` 경로 및 본문 §1/§3 `[...slug]`→`[...path]` 표기 갱신을 명시적으로 추가. rename 커밋에 spec 갱신 동봉 권장 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Workspace.slug` 유일성(UNIQUE) 미명시 — 개인(`이메일로컬+랜덤4자리`)·팀(`team-<uuid8>`) 워크스페이스 slug 생성 시 충돌 검사/재시도 로직 부재. 문서 집합의 다른 모든 자연키 필드(User.email, Folder 복합키, Integration.name 등)는 예외 없이 유일성을 명시하는 패턴과 대비 | `spec/1-data-model.md` §2.2 Workspace 엔티티 (`slug` 필드, UNIQUE 표기 없음) | `spec/2-navigation/10-auth-flow.md` §6.2(개인 워크스페이스 자동생성), `9-user-profile.md` §4(팀 워크스페이스 생성, 규칙 미명시) | `1-data-model.md` §2.2 에 `slug UNIQUE` 제약 명시(+마이그레이션), `10-auth-flow.md §6.2`/`9-user-profile.md §4` 에 충돌 시 재시도/증가 로직 명문화. `workspace-slug-routing.md` §8 에 이 갭 반영 추가 |
| 2 | plan_coherence | spec 반영(spec-sync) 체크리스트가 실제 영향 범위보다 크게 좁음 — 28페이지 route-group 이동 시 `spec/2-navigation/` 사실상 전체의 frontmatter `code:` glob·bare 경로 서술이 stale 화되나, plan §8 은 3개 문서만 명시. 특히 `_layout.md` 는 밑줄 prefix 라 spec-impl-evidence 가드 대상에서 제외되어 build-gate 로 전혀 검출 불가 | `spec/2-navigation/_layout.md` §2.2(메뉴 경로 표)·§3.1(알림 딥링크 표), `11-error-empty-states.md` Rationale + frontmatter, `13-user-guide.md` §1/§3, `0-dashboard.md` §5, `1-workflow-list.md` §2.6, 그 외 대상 폴더 전체 frontmatter `code:` | `plan/in-progress/workspace-slug-routing.md` "구현 단계" §8 / TL;DR #10 (현재 9-user-profile·10-auth-flow·12-workspace 3건만 명시, `_layout.md` 등 누락) | §8 스코프를 `spec/2-navigation/` 전체로 확장: (i) frontmatter `code:` glob 일괄 정정, (ii) `_layout.md §2.2/§3.1` 경로 표 slug-aware 갱신, (iii) 나열된 문서들의 bare-path 산문 정정. impl-prep 스코프 자체도 이 범위로 넓힐 것 |
| 3 | convention_compliance | `0-dashboard.md` / `11-error-empty-states.md` — Overview 섹션 부재로 3섹션(Overview/본문/Rationale) 구성 컨벤션 이탈. 같은 폴더 타 문서는 모두 `_product-overview.md §3` 앵커 또는 자체 `## Overview` 로 이 다리를 충족 | `spec/2-navigation/0-dashboard.md` 서두(앵커 없는 PRD 링크, `_product-overview.md §3` 에 Dashboard 서브섹션 부재), `spec/2-navigation/11-error-empty-states.md` 서두(PRD 링크 자체 없음, 자체 Overview 없음) | `spec/2-navigation/_product-overview.md` §3 (다른 12개 문서는 서브섹션 보유), `14-execution-history.md`(자체 Overview 완비 선례) | (a) `_product-overview.md §3` 에 두 문서 서브섹션 신설 + 앵커 연결, 또는 (b) `14-execution-history.md` 방식으로 자체 `## Overview` 절 추가. 의도적 예외(횡단 UI 문서)라면 SKILL.md 에 예외 명문화 |
| 4 | convention_compliance | impl-prep payload 스코프가 plan 이 지정한 실제 대상과 불일치 — `9-user-profile.md`(슬러그 전환의 실제 SoT) 누락, 무관 규약(`audit-actions.md`, `cafe24-api-catalog/**`) 포함, 실제 필요 규약(`error-codes`/`swagger`/`spec-impl-evidence`/`i18n-userguide`/`user-guide-evidence`) 누락 | 본 세션 `_prompts/convention_compliance.md` (target 파일 목록 + 규약 모음 절) | `plan/in-progress/workspace-slug-routing.md` 체크리스트 0번(실제 지정 대상: "9-user-profile·12-workspace·10-auth-flow") | orchestrator/워크플로우 스크립트의 payload 조립 로직에 plan 체크리스트 파일 목록과의 diff 검증 추가 권장(재발 패턴 — 과거 메모리에도 동일 기록: "impl-prep 대형 spec 영역 payload 오배선") |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Dashboard "Active" 카드 괄호 설명이 `Workflow.is_active`/`Trigger.is_active` 를 혼용하는 것처럼 읽힘 | `spec/2-navigation/0-dashboard.md` §3, `spec/1-data-model.md` §2.4/§2.8 | 괄호 설명을 `Workflow.is_active` 1차 필드로 명확화하거나 캐스케이드 관계를 `1-data-model.md` 에 명문화 |
| 2 | convention_compliance | `0-dashboard.md` PRD 링크가 앵커 없이 걸려 대상 서브섹션 부재를 셀프체크하기 어려움 | `spec/2-navigation/0-dashboard.md:39` | WARNING #3 해결과 함께 앵커 추가 |
| 3 | plan_coherence | `spec-sync-user-profile-gaps.md` 트래커의 슬러그 라우팅 항목 체크박스 갱신이 plan 에 명시돼 있지 않음 | `spec/2-navigation/9-user-profile.md` frontmatter `pending_plans` | `workspace-slug-routing.md` §8/§10 에 트래커 체크 + 잔여 항목 재확인 1줄 추가 |
| 4 | plan_coherence | plan 문서 내부 수치 불일치(마이그레이션 대상 링크 파일 "34개" vs "~24파일") | `plan/in-progress/workspace-slug-routing.md` 배경절 vs Phase 1 체크리스트 항목5 | 실제 파일 수 재계산 후 통일 — 완료 후 리뷰에서 오탐 판단 근거로 쓰일 수 있음 |
| 5 | naming_collision | `/w/<slug>/workspace` 경로에서 "w" 축약과 "workspace" 세그먼트가 한 URL 에 동시 등장해 문서 독자 혼동 소지(기능적 충돌 아님) | `(main)/w/[slug]/workspace/*` | planner 가 §8 spec 반영 시 예시 URL 을 한 번 명시적으로 보여줘 혼동 여지 해소 |
| 6 | naming_collision | 신규 hook 명 `useWorkspaceSlug()`/`useWorkspaces()` 가 기존 `useWorkspaceStore` 와 어근이 같아 import 자동완성 오선택 위험(실제 충돌 아님) | 구현 예정 hook (plan TL;DR #1) vs `codebase/frontend/src/lib/stores/workspace-store.ts:36` | 각 hook 상단 JSDoc 1줄로 역할 구분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `Workspace.slug` UNIQUE 미명시(WARNING), `/docs` 세그먼트명 충돌 인지(INFO), Dashboard Active 카드 서술 모호(INFO) |
| rationale_continuity | **재시도 필요** | 상태는 success 로 보고됐으나 `rationale_continuity.md` 파일이 실제로 존재하지 않아(Read 실패) 본 통합본에 반영 불가. 재실행/디스크 write 확인 필요 |
| convention_compliance | LOW (단, WARNING 2건 포함) | payload 스코프 오배선(WARNING), `0-dashboard`/`11-error-empty-states` Overview 부재(WARNING). 보강 확인한 실제 대상 규약 위반은 CRITICAL 없음 |
| plan_coherence | MEDIUM | spec 반영 체크리스트 스코프 과소평가(WARNING, `_layout.md` 등 build-가드 미대상 문서 다수 누락), 트래커 체크박스 미갱신(INFO), plan 내부 수치 불일치(INFO) |
| naming_collision | 자체보고 MEDIUM (본 통합에서 CRITICAL 1건 승격) | `[slug]` vs `/docs` `[...slug]` 파라미터 충돌 — plan 은 인지·완화 결정했으나 체크리스트 미반영(CRITICAL), URL 이중 표기·hook 명 유사성(INFO x2) |

## 권장 조치사항

1. **(BLOCK 해소)** `plan/in-progress/workspace-slug-routing.md` 에 다음 두 항목을 명시적 체크리스트 항목으로 추가: (a) `(main)/docs/[...slug]` → `(main)/docs/[...path]` rename 을 Phase 1 구현 작업 항목으로 승격(현재 상단 요약 prose 뿐), (b) §8 spec 반영 스텝에 `13-user-guide.md` frontmatter `code:` 경로 + 본문 §1/§3 표기 갱신 추가.
2. `spec/1-data-model.md` §2.2 Workspace 에 `slug UNIQUE` 제약 명시 + 마이그레이션, `10-auth-flow.md §6.2`/`9-user-profile.md §4` 에 slug 충돌 시 재시도/증가 로직 명문화.
3. `workspace-slug-routing.md` §8 spec 반영 스코프를 `spec/2-navigation/` 전체(특히 `_layout.md §2.2/§3.1`, `11-error-empty-states.md`, `0-dashboard.md §5`, `1-workflow-list.md §2.6`)로 확장.
4. `0-dashboard.md`/`11-error-empty-states.md` 의 Overview 섹션 갭을 project-planner 가 확인 후 정규화(또는 예외 문서화).
5. `spec-sync-user-profile-gaps.md` 트래커 체크박스 갱신 단계를 plan 에 추가.
6. plan 내부 "34개" vs "~24파일" 수치 불일치 정정.
7. `rationale_continuity` checker 결과 파일 부재(상태-실제 불일치) — 재실행하여 정상 output 확보 후 본 통합본 갱신 권장.
8. (낮은 우선순위) Dashboard Active 카드 문구 명확화, `0-dashboard.md` PRD 링크 앵커 추가, `/w/<slug>/workspace` 예시 URL 문서화, 신규 hook JSDoc 명확화.