# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전문을 모두 확보했고 Critical 발견은 없다.

- 모드: `--impl-done`, scope=`.claude/docs` (scope 델타 0개 파일), diff-base=`origin/main`
- 실제 변경: 프런트 가드 2개 파일(`spec-links.ts`, `spec-link-integrity.test.ts`)과 같은 브랜치의 NERV 미러 하네스(`guard_nerv_owned_paths.py`, `settings.json` 배선, consistency 오케스트레이터 필터, `pull.py`, CI 잡, `spec/` 미러 169편)
- 전문 미확보 checker: 없음 (5/5 반영). 5개 checker 파일이 모두 디스크에 이미 있어 영속화할 것도 없었다.

## 전체 위험도
**MEDIUM** — 차단할 Critical 은 없다. 다만 `spec/` 을 훅으로 먼저 잠근 탓에 거버넌스 문서·plan 이동 규칙·빌드 가드와 어긋나는 WARNING 6건이 남았고, 대부분 project-planner 턴에서 처리해야 한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| - | - | (없음) | - | - | - |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상도 없다. 아래 WARNING 1~3, 5, 6 은 근본 원인이 developer 권한 밖(거버넌스 문서·`spec/`·plan)이므로 후속 planner 턴에서 다뤄야 한다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence | 훅이 옛 `spec/` 트리까지 통째로 막아서, plan 완료 이동 시 필요한 인입 링크 갱신과 `status: partial` → `implemented` 승격이 교착한다. 훅 스스로 세운 도입 원칙("문서가 그 쓰기를 안내하는 동안은 막지 않는다")과도 어긋난다. 실측: 옛 트리 중 plan 링크를 가진 파일 29개, `plan/in-progress/` 를 가리키는 고유 대상 12개, `status: partial` + `pending_plans` spec 18개(plan_coherence 집계로는 22개가 in-progress plan 을 가리킴). "셸 편집 구멍은 CI 가 막는다"는 문장은 미러에만 참이고 옛 트리는 CI 도 못 잡는다. | `.claude/hooks/guard_nerv_owned_paths.py` `OWNED_ROOTS["spec"]`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `collectSpecMarkdown` | `.claude/docs/plan-lifecycle.md` §3 인입 참조·§4·§5, `spec-status-lifecycle.test.ts` (c), `spec-link-integrity` scope 1, `PROJECT.md` L170~L181·L223 동반 갱신 매트릭스 | 다음 중 하나를 정한다. (a) plan-lifecycle §3 에 "동결된 옛 트리의 인입 링크·frontmatter 는 `BYPASS_NERV_OWNED_PATHS=1` 로 그 부분만 고친다"는 좁은 예외를 적는다. (b) 단계 1 에서는 미러(`spec/CLE-*`·`spec/README.md`)만 막고 옛 트리는 거버넌스 개정 시점에 막는다. (c) 전환 기간 한정으로 옛 트리를 (c) 승격·plan 링크 검사에서 면제한다. |
| 2 | cross_spec, plan_coherence, rationale_continuity | 거버넌스 문서가 여전히 `spec/` 쓰기를 지시한다. 훅이 문서 개정 없이 `spec/` 을 먼저 막아 planner 워크플로와 developer 소정정 예외가 작동하지 않는다. 브랜치 diff 에는 `CLAUDE.md`·SKILL·`.claude/docs` 변경이 0개다. rationale 은 먼저 머지될 짝 planner PR 을 전제해 판단했으므로, 그 PR 이 함께 들어오지 않으면 이 어긋남이 그대로 남는다. | `.claude/hooks/guard_nerv_owned_paths.py` docstring, `.claude/settings.json` PreToolUse 배선 | `CLAUDE.md` §Skill 체계·§자기-반증형 소정정, `.claude/skills/project-planner/SKILL.md`, `.claude/skills/developer/SKILL.md` 4단계, `PROJECT.md` L170~L181·L223 | 같은 PR 또는 바로 다음 planner 턴에서 문서에 전환 상태를 적는다(planner 는 `spec/` 대신 NERV 초안, 소정정 예외는 옛 트리에 `BYPASS` 필요). 두 PR 은 `/merge-coordinate` 로 같은 시점에 머지하거나 머지 순서를 PR 본문에 고정한다. 그 전까지 어긋남을 CHANGELOG 나 `.claude/docs/README.md` 에 남긴다. |
| 3 | cross_spec | "spec/ 트리가 단일 진실"이라는 서술이 둘로 갈린다. 새 `spec/README.md` 는 미러만 서술하고 옛 트리의 지위(동결, 단계 5 삭제 예정)를 말하지 않는다. 옛 트리는 훅으로 잠겨 `0-overview.md` §8 도 고칠 수 없다. | `spec/README.md`, `spec/CLE-*` 미러 24개 영역 | `spec/0-overview.md` §8 문서 맵, `CLAUDE.md` §정보 저장 위치 | `pull.py` 가 만드는 `spec/README.md` 템플릿에 "옛 `spec/<영역>/` 트리는 동결, 단계 5 에서 삭제 예정, 그때까지 정본이 아님" 한 단락을 추가한다. 옛 트리 진입 문서 배너는 별도 planner 턴에서 넣는다. |
| 4 | rationale_continuity, convention_compliance | 링크·area-index 가드의 적용 범위를 좁힌 결정(미러 제외)이 SoT 에 반영되지 않았다. `spec-impl-evidence.md` §4.2 표(133·134행)와 L50, R-7, `PROJECT.md:392` 는 "생성형 `*-api-catalog/` 만 제외"로 남아 있고, NERV `CLE-ENG-SPECEVIDENCE` 에도 미러 예외 Rationale 이 없다. 기각한 대안(미러를 옛 가드에 통과시킴)의 근거 수치(49건 RED, 카탈로그 키 링크 125개, 앵커 1,372개)가 CHANGELOG 에만 있다. 미러 링크 무결성은 어떤 가드도 보지 않는다는 점도 명시되지 않았다. | `spec-links.ts` (`NERV_MIRROR`·`inNervMirror`·`collectSpecMarkdown`), `spec-link-integrity.test.ts`, `CHANGELOG.md` Unreleased 4번째 항목 | `spec/conventions/spec-impl-evidence.md` §4.2 표·L50·R-7·R-9, `PROJECT.md` L305·L390~L394 | `PROJECT.md:392` 는 developer 가 지금 고칠 수 있으니 "NERV 미러(`spec/README.md`·`spec/CLE-*`) 제외"를 덧붙인다. `spec-impl-evidence.md` 는 훅이 막으므로 NERV 초안에 Rationale 항(미러는 §4.2 링크·area-index 대상 아님, 대신 `pull.py --check`)과 실측 수치를 옮긴다. 후속으로 미루면 두 SoT 가 어긋나는 구간을 plan 에 적는다. |
| 5 | plan_coherence | 옛 트리 spec 편집을 전제한 열린 plan 항목들에 새 경로(NERV Task 이관 vs 우회 편집) 안내가 없다. 해당: `spec-update-node-cancellation-shutdown-classification.md`, `spec-draft-eia-notification-payload-contract.md:191`, `webchat-command-failure-is-not-termination.md:73-75`, `webchat-spec-rationale-followup.md:49·103`, `ai-agent-tool-connection-rewrite.md:56-72`, `spec-draft-nullable-notation-followups.md` 등. | 이 브랜치 전체 (`spec/` 동결, `plan/**` 델타 0) | 위 in-progress plan 들 | plan 마다(또는 한 곳에 모아) "옛 spec 트리 동결 — NERV Task `CLE-T-…` 로 이관 / 미러 반영 대기"를 표시한다. 이관 방침은 NERV 단계 3(plan 제거) Task 범위로 명시한다. |
| 6 | rationale_continuity | SPEC-DRIFT "정식 역류 경로"가 승인 대기 동안 `--impl-done` push 게이트를 닫는 방법이 없다(추론, 확인 필요). 옛 흐름은 같은 PR 에서 `spec/` 을 고쳐 다음 `--impl-done` 이 BLOCK:NO 가 됐지만, 새 흐름은 NERV 초안을 저장하고 승인을 기다리며 미러는 승인 뒤에 pull 되므로 같은 drift 가 BLOCK:YES 로 다시 나올 수 있다. `pull.py --task` 가 개발자 미승인 초안을 받는지는 diff 로 확인되지 않는다. | 짝 planner PR 의 `code-review-agents/SKILL.md` ESCALATE `spec` 행, `developer/SKILL.md` SPEC-DRIFT 항목, `consistency-checker/SKILL.md` "근본 원인이 스펙이면" 항목 | `developer/SKILL.md` 4단계(SPEC-CONSISTENCY push·턴종료 게이트), "BLOCK:YES 는 우회 말고 planner 턴으로" 운영 결정 | 승인 대기 중 drift 처리를 한 줄 명시한다(예: 초안 승인 후 `pull.py --task` 재실행 → `--impl-done` 재실행, 그 사이 push 보류. 또는 `--task` 가 초안을 받는 경우 그 사실). |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, naming_collision, convention_compliance | 미러 경로 정의가 TS(`NERV_MIRROR`, 테스트 인라인 정규식), orchestrator(`_NERV_MIRROR_REL`), `pull.py`(`KEY_RE`, `README`) 세 곳에 손으로 동기화돼 있고 엄격도도 다르다. 실파일 전수 대조로는 현재 오탐·미탐 0. | `spec-links.ts`, `consistency_orchestrator.py:200-205`, `.claude/tools/nerv-mirror/pull.py:48,140` | `pull.py` 가 쓰는 경로 전수가 두 정규식에 모두 매칭되는 패리티 테스트를 하나 둔다. `NERV_MIRROR` 주석에 "세 곳을 함께 고친다" 한 줄. |
| 2 | cross_spec, naming_collision | `BYPASS_NERV_OWNED_PATHS` 와 새 PreToolUse 훅이 `.claude/docs` 열거에 없다. 기존 `BYPASS_*_GUARD` 접미어 관례와도 다르다. WARNING 1 의 유일한 통과 경로가 문서에 없는 셈이다. | `guard_nerv_owned_paths.py:24,84` | `worktree-policy.md` §5 Enforcement 에 훅과 변수를 한 줄 등재한다(planner 턴). 이름 변경은 불요. |
| 3 | cross_spec, rationale_continuity, plan_coherence | consistency 코퍼스(`related_specs`·`conventions`·`rationale_excerpts`)에서 미러가 빠져, 전환 기간 `--spec`·`--impl-*` 검사는 동결 시점 옛 트리 기준이다. 코퍼스를 미러로 옮기는 단계 4e 에서는 번들 절단 백로그 항목들(`spec-draft-nullable-notation-followups.md:4301`·`:4640`, `harness-review-gate-followups.md`)의 측정 기준선도 다시 재야 한다. | `consistency_orchestrator.py` `collect_context` `is_nerv_mirror` 필터 | `consistency-checker/SKILL.md` 나 CHANGELOG 에 "4e 전까지 로컬 검사는 동결 시점 옛 트리 기준, 이후 결정은 `nerv_spec_check` 담당" 한 줄. 4e Task 에 "코퍼스 이전 시 재측정" 추가. |
| 4 | cross_spec, plan_coherence | 단계 번호(1, 2, 3, 4e, 5)의 정의가 훅 docstring·`spec-links.ts`·오케스트레이터 주석·커밋 메시지에만 있고 저장소 plan·docs 에 없다. 전환이 NERV Task 로만 추적돼 저장소에서 되돌아오는 포인터가 없다. | `spec-links.ts` 주석, `consistency_orchestrator.py` 주석 | 단계 표를 한 곳에 두고 세 주석이 가리키게 한다. 주석에 Task ID 를 적고, 단계 5 done 조건에 `inNervMirror`·`is_nerv_mirror` 제거·재조정과 테스트 단언 교체를 넣는다. |
| 5 | cross_spec, convention_compliance | 새 테스트 `excludes the NERV spec mirror from scope` 가 옛 트리 실재(`spec/5-system/1-auth.md`)와 미러 실재(`spec/CLE-VISION.md`)에 결합돼 단계 5 에서 의도적으로 RED 가 된다. 주석에는 그 사실이 없다. | `spec-link-integrity.test.ts` | 단언 옆에 "단계 5 에서 함께 제거"를 적거나, 옛 트리 단언을 합성 트리 fixture(`tree-walk.test.ts`)로 옮긴다. |
| 6 | convention_compliance | `spec-area-index.test.ts` 의 주석(`// excludes catalogs`, "Generated `*-api-catalog/` trees are exempt.")이 새 미러 제외를 반영하지 않는다. | `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts:36` 및 헤더 | 두 주석에 "NERV 미러도 제외"를 한 줄씩 더한다. |
| 7 | rationale_continuity | `review_guard._spec_code_patterns` 는 `code:` frontmatter 만 읽는데 미러 169편에는 `code:` 가 0개다. 옛 트리가 남은 동안은 기존 글로브가 작동하지만, NERV 신규 표면을 구현하는 코드는 `--impl-done` 강제 밖이고 단계 5 에서는 게이트가 통째로 비활성이 된다. | `.claude/hooks/_lib/review_guard.py`, `developer/SKILL.md` 4단계 "강제" 문구 | 4단계 문구에 범위를 적고, `review_guard` 가 `## 구현 위치`(또는 Task scope)를 읽게 하는 일을 단계 5 선행 조건으로 계획에 명시한다. |
| 8 | rationale_continuity | 훅 예외 경로가 `sys.exit(0)` 으로 조용히 fail-open 한다(`failopen_state` 미사용, exit 0 의 stderr 는 모델에게 안 보임). 옛 트리는 CI 안전망도 없다. docstring 문장 "막는 경로는 전환 단계를 따라 는다"에 단어 누락이 있다. | `guard_nerv_owned_paths.py` `except Exception` 블록과 docstring | `failopen_state` 를 쓰거나 최소한 stdout 으로 한 줄 알리게 한다. 오타를 함께 고친다. |
| 9 | naming_collision | `spec/README.md` 는 `spec/` 루트의 첫 README 이고 `spec-area-index.test.ts` 의 `INDEX_RE`(`README`)와 이름이 겹친다. 지금은 `collectSpecMarkdown` 이 제외해 판정이 이전과 같다. | `spec/README.md` | 조치 불필요. `inNervMirror` 를 우회하는 새 수집기가 생기면 index 로 잡힐 수 있다는 점만 기억한다. |
| 10 | naming_collision | `CLE-` 접두를 스펙 키(`CLE-TRIG` 등)와 NERV Task ID(`CLE-T-…`)가 함께 쓴다. `KEY_RE` 는 문법상 `CLE-T-0EZEYF` 도 받지만 현재 `T` 영역 키가 없어 충돌하지 않는다. | `.claude/tools/nerv-mirror/pull.py:48` | 조치 불필요. NERV ID 체계에서 오는 것이고 이 브랜치가 만든 충돌이 아니다. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | WARNING 3, INFO 4. 훅과 거버넌스 문서·plan 이동 규칙 사이 교착, `spec/README.md` 가 옛 트리 지위를 말하지 않음. |
| rationale_continuity | MEDIUM | WARNING 3, INFO 3. 훅이 자기 도입 원칙을 어김(실측 18개 spec, 12개 링크 파일), 가드 범위 축소가 SoT Rationale 에 없음, SPEC-DRIFT 역류 경로의 승인 대기 갭. |
| convention_compliance | LOW | WARNING 1, INFO 3. `spec-impl-evidence.md` §4.2 와 `PROJECT.md:392` 가 옛 스코프에 머묾. 3개 가드 테스트 56개 통과. |
| plan_coherence | MEDIUM | WARNING 2, INFO 2. 동결 훅 vs plan 이동 규칙, 열린 plan 다수의 옛 트리 편집 전제 미표시. |
| naming_collision | LOW | WARNING 0, INFO 4. 신규 식별자 충돌 없음. `BYPASS_NERV_OWNED_PATHS` 명명·문서 등재만 관찰. |

## 권장 조치사항

1. **BLOCK 해소**: 해당 없음 (Critical 0건). `--impl-done` push 게이트 관점에서 차단 사유는 없다.
2. **지금 developer 가 할 수 있는 것**: `PROJECT.md:392` 에 미러 제외를 덧붙인다(WARNING 4). `spec-area-index.test.ts`·`spec-links.ts` 주석과 `guard_nerv_owned_paths.py` docstring 오타·fail-open 알림을 정리한다(INFO 5, 6, 8). 미러 경로 정규식 패리티 테스트를 추가한다(INFO 1).
3. **다음 planner 턴(또는 짝 planner PR 과 같은 시점 머지)**: WARNING 1·2·6 의 결정 세 가지를 정한다.
   - 옛 트리 동결과 plan 이동·승격 규칙의 교착을 어떻게 풀지.
   - 거버넌스 문서(`CLAUDE.md`, planner·developer SKILL, `plan-lifecycle.md`, `worktree-policy.md` §5)의 `spec/` 쓰기 지시와 `BYPASS_NERV_OWNED_PATHS` 안내를 어떻게 고칠지.
   - SPEC-DRIFT 승인 대기 중 push 처리를 어떻게 할지.
4. **NERV 초안**: `CLE-ENG-SPECEVIDENCE` 에 미러 예외 Rationale 과 실측 수치를 옮기고(WARNING 4), `spec/README.md` 템플릿에 옛 트리 지위 단락을 넣는다(WARNING 3).
5. **plan 정리**: 옛 트리 spec 편집을 전제한 in-progress plan 에 이관 표시를 남기고(WARNING 5), 단계 표와 Task ID 를 한 곳에 둔다(INFO 4). 단계 4e 에 코퍼스 이전 시 재측정을 추가한다(INFO 3).
6. **머지 순서**: 짝 planner PR 과 이 브랜치를 `/merge-coordinate` 로 같은 시점에 머지하거나 순서를 PR 본문에 고정한다. 역순이면 훅이 문서가 시키는 쓰기를 막는 상태가 된다.
