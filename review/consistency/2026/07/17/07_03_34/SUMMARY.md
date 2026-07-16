# Consistency Check 통합 보고서 — `--spec` draft 검토

**모드**: spec draft 사전 검토 (`--spec plan/in-progress/spec-update-catch-all-terminal-contract.md`)
**성격**: `project-planner` 가 `spec/` 에 쓰기 **직전** 의무 호출 (CLAUDE.md §Skill 체계)

**BLOCK: NO** — Critical 0. Warning 1건(조건부)은 반영 중 조치 완료.

> **커버리지**: 5/5 확보. 1차 workflow 는 5개 전원 `status=success` 였으나
> `convention_compliance`·`naming_collision` 2개의 output_file 이 미생성(알려진 FS-write
> flakiness) → `ls` 대조 후 직접 Agent 재호출로 확보.

## 전체 위험도
**LOW** — Critical 0. Warning 1건과 INFO 4건 **전부 반영**했다(제안 5·6 신설, `11-error-empty-states.md`
`code:` 보강, stale 경로·`spec_area` 정정). 지적이 모두 draft 를 개선하는 방향이었다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 조치 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | **제안 3(선택) 채택 시 `11-error-empty-states.md` 에 제안 4 와 동형인 `code:` 완결성 갭이 새로 생김** — 제안 3 이 §1.3 표에 "catch-all 이 `notFound()` 로 종결" 이라는 **명시적 약속**을 신설하는데, 그 문서의 `code:` 에는 `(main)/not-found.tsx`(404 바운더리)만 있고 그 404 를 **발생시키는 주체**인 catch-all 이 없다. 다른 파일로 ≥1 매치해 `spec-code-paths.test.ts` 는 green — 제안 4 가 고친 것과 똑같은 "가드가 못 잡는 갭" 이 이 문서에만 남는다 | draft 제안 3·4 | `spec/conventions/spec-impl-evidence.md` §2.1 | **fix** — 제안 3 을 채택했으므로 `11-error-empty-states.md` frontmatter `code:` 에 `(main)/[...rest]/page.tsx` 추가. draft 제안 4 표에도 해당 행 추가 |

> **정확한 지적**: 제안 4 는 "본문이 약속하는데 `code:` 가 안 가리키는" **기존** 갭 3건만 잡았고,
> 제안 3 이 **새로 만드는** 네 번째 갭을 놓쳤다. 검토가 없었으면 이번 PR 이 스스로 만든 갭을
> 남길 뻔했다.

## 참고 (INFO) — 전건 반영

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | cross_spec | `spec/data-flow/12-workspace.md:311` 도 catch-all 을 언급하는 **네 번째 문서**인데 보강 대상에서 빠짐(반증되지는 않으나 같은 오독 경로가 남음) | **반영** — draft 제안 5 신설 → `12-workspace.md` 에 terminal 각주 + `_layout.md` R-3 참조 추가 |
| 2 | rationale_continuity | terminal 계약에서 기각된 두 대안(strip 재-forward, idempotent href)이 `## Rationale` 이 아니라 **코드 docstring·완료 plan 에만** 남아 발견성이 낮음. CLAUDE.md 의 "결정 근거 = spec 의 `## Rationale`" 3-섹션 관행과 어긋남 | **반영** — draft 제안 6 신설 → `_layout.md` `## Rationale` 에 **R-3** 추가(기각 대안 2건 + `buildWorkspaceHref` 비-idempotent 근거를 코드에서 spec 으로 승격) |
| 3 | plan_coherence | "선행 PR" 인용 경로 stale — `user-guide-routing-loop-fix.md` 는 이미 `plan/complete/` 로 이동(커밋 `6da2c8b36`) | **반영** — draft 상단 인용을 `plan/complete/…` 로 정정 |
| 4 | naming_collision | `(terminal)` 어휘가 라우팅 종결 vs 실행 상태 terminal(`4-execution-engine.md` 등 100회+) 두 도메인에 교차 사용 — 파일·문맥 분리로 실질 충돌 아님(01_25_26 과 동일 판정) | **반영** — R-3 말미에 무효 slug 처리와의 계층 구분을 명시해 문맥을 고정 |
| 5 | convention_compliance | `spec_area` frontmatter 가 `_layout.md` 하나만 기재하나 실제 대상은 4~5개 — 기존 plan 들의 콤마 나열 관행과 불일치(가드 없음, build 무영향) | **반영** — 대상 5개 문서를 콤마 나열로 정정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 인용 라인·앵커·코드 경로 전부 실측 일치. 신규 엔티티/API/RBAC 없음. INFO 1(네 번째 문서) |
| rationale_continuity | NONE | 기각 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회 전무. 선행 검토(00_32_57 W#2)의 판정 상속. INFO 1(Rationale 배치) |
| convention_compliance | LOW | (재실행 확보) 제안 3 이 신설하는 `11-error-empty-states.md` 의 `code:` 갭 1건(WARNING, fix 완료). INFO 2(`spec_area` 다중경로 미표기 — 반영) |
| naming_collision | NONE | (재실행 확보) 신규 ID/엔티티/endpoint/이벤트/ENV/파일경로 도입 없음. INFO 1(terminal 어휘, 실질 충돌 아님) |
| plan_coherence | NONE | 다른 진행 중 plan 과 충돌 없음. INFO 1(stale 경로 인용) |

## 반영 결과 (project-planner)

| 제안 | 대상 | 내용 |
|---|---|---|
| 1 | `2-navigation/_layout.md` §2.2 각주 | terminal 계약 3-행 표(무-slug forward / `/w/<slug>` → dashboard / 그 외 `notFound()`) + 무한 리다이렉트 근거. `workspaceScoped: false` 가 §2.2 예외의 구현 표현임을 명시 |
| 2 | `2-navigation/9-user-profile.md` §3 | "`/w/` 접두는 흡수 대상 아님" 보정 + R-3 링크 |
| 3 | `2-navigation/11-error-empty-states.md` §1.3 | "`/w/<slug>` 하위 미지의 경로 → 404" 행 + **무효 slug 행과의 구분선**(slug 해석 실패 vs 라우트 부재) |
| 4 | `_layout.md`·`9-user-profile.md`·`10-auth-flow.md`·**`11-error-empty-states.md`** frontmatter | `code:` 에 `(main)/[...rest]/page.tsx`(+`_layout.md`·`9-user-profile.md` 는 `lib/workspace/href.ts`) 등록. 앞 3건은 impl-done 01_25_26 WARNING 해소, 4번째는 본 검토 WARNING #1(제안 3 이 신설한 갭) 해소 |
| 5 | `data-flow/12-workspace.md:311` | terminal 각주 + `_layout.md` 참조 (INFO #1) |
| 6 | `_layout.md` `## Rationale` **R-3** | 기각한 두 대안 + `buildWorkspaceHref` 비-idempotent 근거를 코드 docstring 에서 spec 으로 승격 (INFO #2) |

가드 검증: `run-test.sh unit` PASS — `spec-frontmatter` · `spec-code-paths`(신규 `code:` 경로 실존) · `spec-link-integrity`(신규 문서 간 링크) 전부 통과.
