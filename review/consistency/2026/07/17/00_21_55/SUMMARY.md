# Consistency Check 통합 보고서

**BLOCK: YES** — 5개 checker 전원이 동일하게 보고한 payload 손상(호출 규약 위반)을 `convention_compliance` 가 CRITICAL 로 판정했으므로 차단.

> **본 세션은 무효 — 호출자(main) 의 payload 조립 오류.** `--impl-prep SCOPE` 는 `spec/<area>/`
> 경로만 받는데 scope 자리에 수정 계획 설명 문장 전체를 전달해 checker 프롬프트의
> "Target 문서 `경로:`" 필드가 손상됐다. 정정 재실행 세션: `../00_33_*/` (아래 §후속 참조).
> 본 파일은 감사 추적용으로 보존한다.

## 전체 위험도
**MEDIUM** — 유일한 Critical 은 실제 spec/코드 불일치가 아니라 이번 호출의 payload 조립 결함(호출 규약 위반)이며, 5개 checker 모두 best-effort 로 대체 분석한 결과 대상 버그 수정 계획 자체의 실질 충돌은 발견되지 않음. 다만 재현 가능한 payload 로 재실행하기 전까지는 이번 검토를 "정식 통과"로 신뢰할 수 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (cross_spec/rationale_continuity/plan_coherence/naming_collision 전원 동일 현상 보고) | prompt_file 의 "Target 문서" `경로:` 필드에 실제 spec 파일 경로 대신 `--impl-prep` scope 설명 문장 전체가 그대로 병합돼 있고, "구현 대상 영역"/코드블록은 `(없음)` — [`subagent-call-contract.md`](../../../../../.claude/docs/subagent-call-contract.md) §2 "prompt_file Read → target 문서에 관점 적용" 절차의 전제(유효한 단일 target 문서)가 깨짐 | `_prompts/*.md` 의 "## Target 문서" 절 (`경로:` 필드), 5개 checker 프롬프트 전원 동일 | 정상 target 후보 `spec/2-navigation/_layout.md`, `spec/2-navigation/9-user-profile.md`, 및 실질 작업 문서 `plan/in-progress/user-guide-routing-loop-fix.md` | 호출자가 `--impl-prep` 에 `spec/2-navigation/` 만 전달해 5개 checker 재호출. 본 세션은 5개 checker 전원이 payload 내 언급된 좌표(`_layout.md:85`, `9-user-profile.md:155-158`)와 plan, 관련 코드(`sidebar.tsx`, `(main)/[...rest]/page.tsx`, `href.ts`)를 best-effort 로 직접 대조해 대체 분석했으며, 실질적 spec/plan/명명 충돌은 발견되지 않음(아래 경고/참고 제외) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 2 | rationale_continuity | `(main)/[...rest]` catch-all 을 "redirect-only" 에서 "redirect ∪ notFound() 이원화"로 확장하는데, 이 성격 변화를 반영하는 새 Rationale/spec 문구가 수정 계획에 없음 | 수정 계획 항목 (2) — `rest[0]=='w'` 이면 재-prefix 금지, `/w/<slug>` 단독은 dashboard forward, 그 외 `notFound()` | `spec/2-navigation/10-auth-flow.md:443` ("...redirect-only 중간 경로") 및 `(main)/[...rest]/page.tsx` 상단 docstring — 둘 다 현재 "redirect-only" 로만 서술 | `_layout.md §2.2` 각주(85행) 또는 `data-flow/12-workspace.md` Rationale 에 catch-all 의 신규 terminal 계약을 반영하고, `10-auth-flow.md:443`/코드 docstring 의 "redirect-only" 서술도 동시 정정 |
| 3 | rationale_continuity | `buildWorkspaceHref` idempotent 화 미채택 결정에 근거가 계획 텍스트에 없고, 저장소의 "호출부 산재 → 구조적 제거" 관행(PR #865, `buildExecutionHref`/`buildEditorHref` guard 테스트)과 결이 다름 | 수정 계획 항목 (3) | `href.ts` 의 `buildExecutionHref`/`buildEditorHref` 주석 + `no-raw-*-href.test.ts` guard 관행 | `href.ts` 주석에 미채택 근거 명시하거나, `path.startsWith('/w/')` 방어 분기 추가 재검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 4 | plan_coherence / cross_spec | catch-all terminal 동작이 기존 spec 문언("구 무-slug 경로 흡수") 범위를 넘는 신규 동작이나, `11-error-empty-states.md` 의 일반 404 정책과는 정합 — 차단 사유 아님 | `_layout.md:85`, `11-error-empty-states.md:56,70` | `_layout.md:85` 또는 `11-error-empty-states.md` §1.3 부근에 "`/w/<slug>` 하위 미지의 경로는 catch-all 이 `notFound()` 로 종결(무한 리다이렉트 방지)" 한 줄 추가 |
| 5 | rationale_continuity | `(main)/[...rest]/page.tsx` docstring "specific route 가 우선하므로 `/w/[slug]/...`·`/docs/...` 는 여기 오지 않는다"가 이번 버그로 반증됨 | `(main)/[...rest]/page.tsx` 상단 docstring | 같은 PR 에서 docstring 정정 |
| 6 | naming_collision | 신규 식별자는 `workspaceScoped` 1개뿐이며 전수 검색 결과 충돌 없음 | `sidebar.tsx` (신설 예정 필드) | 없음 |
| 7 | plan_coherence | `(main)/w/[slug]/page.tsx` 부재 확인 — "부수 발견"과 일치. `(editor)` 그룹에는 대응 catch-all 자체가 없어 동일 결함 클래스 없음 | `(main)/w/[slug]/`, `(editor)/w/[slug]/` | 없음 (수정 범위 충분함 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | payload 손상 외에는 기존 spec("docs 는 slug 밖 유지")과 상충 없음, 오히려 구현 버그를 spec 대로 바로잡는 정합화 |
| rationale_continuity | LOW | 핵심 축(slug=FE SoT, docs 예외) 존중, CRITICAL 없음; WARNING 2건 |
| convention_compliance | MEDIUM (payload 손상 자체는 CRITICAL) | best-effort 확인한 3개 spec 문서는 명명·frontmatter·구조 규약 모두 준수 |
| plan_coherence | NONE | target plan 의 spec 근거·코드 상태 일치, 다른 plan 과 정합, 후속 누락 없음 |
| naming_collision | NONE | 신규 요구사항ID/엔티티/API/이벤트/ENV/파일경로 도입 없음 |

## 권장 조치사항
1. (BLOCK 해소) `--impl-prep spec/2-navigation/` 로 5개 checker 재호출 → 정식 재검토.
2. catch-all 의 신규 "redirect ∪ notFound() 이원화" 계약을 spec 에 반영 + `10-auth-flow.md:443`/코드 docstring 의 "redirect-only" 서술 동기화. (developer 는 spec 직접 수정 불가 → `plan/in-progress/spec-update-*.md` 로 project-planner 위임)
3. `buildWorkspaceHref` idempotent 화 미채택 근거를 `href.ts` 주석에 명시.
4. `(main)/[...rest]/page.tsx` docstring 의 반증된 가정 정정.
