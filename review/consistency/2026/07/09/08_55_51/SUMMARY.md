# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 중 [CRITICAL] 태그 발견 0건. 단, `plan_coherence` 가 보고한 Gate C `spec_impact` 미선언 건은 실제 `spec-plan-completion` 테스트를 FAIL 시키는 재현된 회귀이므로 병합 전 최우선 수정 권장(§권장 조치사항 1).

## 전체 위험도
**MEDIUM** — checker 5개 중 최고 위험도(`plan_coherence` = MEDIUM)를 채택. Critical 없음, 실질 위험은 낮으나 완료 plan 의 빌드 가드 FAIL(재현 확인)과 `rationale_continuity` checker 결과 유실이 겹쳐 있어 NONE/LOW 로 낮추지 않음.

## Critical 위배 (BLOCK 사유)

없음 (5개 checker 모두 [CRITICAL] 등급 발견 0건).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 완료 plan `workspace-slug-routing.md` Gate C `spec_impact` 미선언 — `spec-plan-completion` 테스트 실제 FAIL 재현 확인(ai-review round4 이후 신규 회귀, grandfather 면제 대상 아님) | `plan/complete/workspace-slug-routing.md` frontmatter | `.claude/docs/plan-lifecycle.md` §4/§5 Gate C, `spec-plan-completion.test.ts` | frontmatter 에 `spec_impact:` YAML 리스트(bare string 금지)로 target 변경 spec 경로 전체 추가 후 로컬 `spec-plan-completion` 재확인, 같은 PR 내 커밋 |
| 2 | plan_coherence | `spec-sync-user-profile-gaps.md` 의 `workspace-slug-routing.md` 경로 참조가 plan 이동으로 dangling | `plan/in-progress/spec-sync-user-profile-gaps.md:25` | `plan/complete/workspace-slug-routing.md`(이동 완료, 구 `plan/in-progress/`) | L25 경로를 `plan/complete/workspace-slug-routing.md` 로 갱신 |
| 3 | convention_compliance | 신규 서술 문장에서 `switch` 엔드포인트 표기가 `/api` prefix 누락 — 동일 엔드포인트를 다루는 다른 SoT 문서들과 표기 불일치 | `spec/2-navigation/9-user-profile.md` §3 "워크스페이스 전환" (diff 신규 라인) | `spec/5-system/2-api-convention.md` §2.1/§2.2, `spec/data-flow/12-workspace.md`(§Overview·§1.5·시퀀스 다이어그램) | `POST /auth/workspaces/:id/switch` → `POST /api/auth/workspaces/:id/switch` 로 정정 (plan 내 동일 오탈자는 참고용으로만 두고 spec 쪽 우선 정정) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 이전 회차(18_55_19) WARNING/INFO 2건 모두 이번 diff 에서 해소 확인 | `11-error-empty-states.md` §1.3, `4-ai-assistant.md` §4.1.2, `13-replay-rerun.md`, `rerun-modal.tsx` | 조치 불요(확인 완료) |
| 2 | cross_spec | target 문서 번들이 실제 `git diff --stat` 범위(27개 spec 파일)보다 좁음 — 핵심 SoT(`_layout.md`·`9-user-profile.md`·`data-flow/12-workspace.md`)가 이번에도 payload 누락(직접 확인 결과 내용상 문제는 없었음) | orchestrator target 번들링 로직 | orchestrator 가 diff-base 기준 `git diff --stat` 전체를 포함하도록 재점검 — 반복 지적이므로 우선순위 상향 권장 |
| 3 | cross_spec | 에디터(`(editor)/workflows/[id]`) vs 실행 내역(`(main)/w/[slug]/.../executions/**`) 라우트 그룹 분리가 문서·코드 모두 일관 (결함 아님) | `14-execution-history.md` §7, `9-user-profile.md` §3 | 조치 불요 |
| 4 | convention_compliance | 슬러그 라우팅 핵심 구현 파일(`lib/workspace/**`, `(main)/w/[slug]/layout.tsx`, `(main)/[...rest]/page.tsx`)이 어떤 nav spec 의 `code:` frontmatter 에도 미등재 (가드 자체는 다른 glob 로 통과, evidence 완전성 갭) | `9-user-profile.md`/`_layout.md` frontmatter `code:` | 필수 아님 — 여유 있을 때 `9-user-profile.md` 에 `lib/workspace/**` 등, `_layout.md` 에 `(main)/[...rest]/**` 추가 또는 `/spec-coverage` 다음 회차 위임 |
| 5 | plan_coherence | phase 2(에디터 slug화)·ai-review 하드닝 후속이 아직 `plan/in-progress/*` 로 등록되지 않음 (완료 plan/RESOLUTION 텍스트로만 존재) | `9-user-profile.md` §3, `_layout.md` §2.2/§3.1, `plan/complete/workspace-slug-routing.md` 잔여 절 | 조치 불요 — phase 2 착수 시 `plan/in-progress/` 신규 파일로 승격 |
| 6 | naming_collision | URL 파라미터 `slug` 가 workspace(`/w/[slug]`, string)와 docs(`/docs/[...slug]`, string[]) 두 도메인에서 이름만 중복(라우트 트리 분리로 빌드 충돌 0, 이미 plan 결정 로그에 검토·기각 기록) | `(main)/w/[slug]/layout.tsx`, `lib/workspace/use-workspace-slug.ts` vs `(main)/docs/[...slug]/page.tsx` | 조치 불요(이미 격리·방어됨) — 선택: `data-flow/12-workspace.md` 에 이 트레이드오프 1줄 Rationale 미러링 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 이전 회차 지적사항 전부 해소 확인, CRITICAL 급 모순 없음. INFO 3건(프로세스 갭 1건 포함) |
| rationale_continuity | **재시도 필요** | manifest 는 `success` 로 보고했으나 `output_file`(`rationale_continuity.md`)이 실제로 존재하지 않음(Read 시도 결과 "File does not exist") — `_prompts/rationale_continuity.md` 는 입력 프롬프트일 뿐 출력 아님. 이 checker 결과는 이번 통합에서 완전히 누락됨 |
| convention_compliance | LOW | WARNING 1건(`/api` prefix 누락 표기), INFO 1건(code: frontmatter evidence 갭). 6개 build-time 가드(spec-frontmatter 등) 전부 pass(982 tests) |
| plan_coherence | MEDIUM | WARNING 2건 — 완료 plan Gate C `spec_impact` 미선언(실제 test FAIL 재현), 자매 plan 의 dangling 경로 참조. INFO 1건(phase2 후속 미등록) |
| naming_collision | NONE | 신규 요구사항 ID/backend 식별자 충돌 0건. INFO 1건(`slug` 파라미터명 도메인 간 중복, 이미 기각된 리스크) |

## 권장 조치사항
1. **(최우선, 실제 FAIL)** `plan/complete/workspace-slug-routing.md` frontmatter 에 `spec_impact:` YAML 리스트 추가(target 변경 spec 경로 전체) 후 로컬 `pnpm --filter frontend test -- spec-plan-completion` 재확인 및 같은 PR 내 커밋.
2. `plan/in-progress/spec-sync-user-profile-gaps.md:25` 의 `workspace-slug-routing.md` 경로 참조를 `plan/complete/workspace-slug-routing.md` 로 갱신.
3. `spec/2-navigation/9-user-profile.md` §3 의 `POST /auth/workspaces/:id/switch` 표기를 `POST /api/auth/workspaces/:id/switch` 로 정정.
4. **`rationale_continuity` checker 재실행 필요** — 이번 세션(`08_55_51`)의 output file 이 생성되지 않아 rationale 연속성 축이 통합 보고서에서 완전히 빠져 있음. 별도 fan-out 또는 workflow 재시도로 결과 확보 권장.
5. (선택, 필수 아님) `9-user-profile.md`/`_layout.md` frontmatter `code:` 에 신규 `lib/workspace/**` 등 경로 추가해 evidence 완전성 보강.
6. (선택) `data-flow/12-workspace.md` 에 `slug` 파라미터명 workspace vs docs 도메인 중복이 라우트 분리로 실충돌 없다는 1줄 Rationale 미러링.
7. (프로세스 개선, 반복 지적) orchestrator 의 target 문서 번들링이 `git diff --stat` 전체를 반영하도록 재점검.