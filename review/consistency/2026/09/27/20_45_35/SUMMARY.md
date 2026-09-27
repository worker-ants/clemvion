# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**CRITICAL** — `spec/1-data-model.md`가 frontmatter-evidence 가드의 `EXCLUDE_BASENAMES` 제외 대상인데도 draft가 "가드가 승격을 강제한다"고 반증 가능한 허위 근거를 서술한다 (cross_spec·convention_compliance CRITICAL, rationale_continuity·plan_coherence 는 동일 근본원인을 WARNING 으로 지적 — 하향 금지 원칙에 따라 최강 등급으로 병합).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance (동일 이슈를 rationale_continuity·plan_coherence 가 WARNING 으로도 지적 — 병합) | `spec/1-data-model.md`는 (a) `spec-frontmatter-parse.ts`의 `INCLUDE_PREFIXES`가 spec 루트 직속 파일과 매치하지 않고 (b) 설령 매치해도 `EXCLUDE_BASENAMES`에 basename 이 등재돼 있어 이중으로 frontmatter-evidence 가드 대상이 아닌데(`isApplicable()`이 `false` 반환, `spec-frontmatter-parse.test.ts:28` 회귀 단언), draft 는 "`spec/conventions/spec-impl-evidence.md` §3 이 승격을 가드로 강제한다"고 근거를 대며 이 파일의 `status`/`pending_plans` 를 다른 두 문서와 동일하게 바꾸려 한다. 저장소 이력(커밋 `f0fa0bac`→`db496a3c2`)이 이 파일의 승격은 실제로 **사람이 수동으로** 처리했음을 이미 실증한다 | `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## 변경안` 3번 (`spec/1-data-model.md status: implemented → partial`, `pending_plans:` 추가) + `## Rationale` 두 번째 불릿 | `spec/conventions/spec-impl-evidence.md` §1 "제외"(`EXCLUDE_BASENAMES` = `0-overview.md`·`1-data-model.md`·`6-brand.md`) 및 그 구현 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`(`isApplicable()`, `collectApplicableSpecs()`) — `spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts`/`spec-frontmatter.test.ts`/`spec-code-paths.test.ts` 4개 가드 전부가 이 파일을 순회 목록에서 건너뜀 | (a) 근거 문장에서 "§3 이 가드로 강제한다"를 삭제하고 `spec-impl-evidence.md` R-11 패턴을 따라 "이 파일은 `EXCLUDE_BASENAMES` 대상이라 가드 미적용 — 승격은 구현 plan 이 `complete/` 로 이동하는 커밋에서 **수동으로** 되돌려야 하며 판정 근거를 그 커밋에 남긴다"로 정정. (b) `plan/in-progress/cross-workspace-refs.md` 체크리스트(또는 완료 커밋 설명)에 "`spec/1-data-model.md` frontmatter `status` 를 `implemented` 로 되돌리고 `pending_plans` 제거" 항목을 명시적으로 추가. (c) 대안: 정말 가드 보호가 필요하면 `spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`/`INCLUDE_PREFIXES` 에서 `1-data-model.md` 를 빼는 별도 명시적 convention 변경 + `spec-frontmatter-parse.test.ts:28` 회귀 단언 갱신을 이 draft 범위 밖에서 별도 진행 |

## planner 인계 (권한 밖 Critical)

> target(`spec-draft-cross-workspace-refs-2.md`)은 project-planner 가 `spec/` 변경 직전 `--spec` 게이트로 작성 중인 draft 자체이며, 위 Critical 의 수정(근거 문장 정정 + Rationale 표현 교체)은 이 draft 문서 본문 안에서 호출자(작성자) 권한으로 바로 처리 가능하다. `codebase/` 나 다른 역할의 권한을 필요로 하지 않으므로 인계 대상 없음.

(없음)

## 경고 (WARNING)

(없음 — 동일 근본원인의 WARNING 등급 지적은 위 Critical 항목에 병합)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/3-workflow-editor/0-canvas.md` §11.2.2 는 여전히 미구현 동작(cross-workflow 참조 400 거부)을 현재형으로 서술하고 e2e 실측(현재 200 통과, 아직 RED)과 다르지만, draft 의 "본문은 목표 상태를 현재형, 추적은 `pending_plans` 단독" 패턴을 그대로 따르는 것으로 설계 의도로 보임 | 변경안 2 (`0-canvas.md`는 `pending_plans:` 만 추가) | 조치 불필요 — 위 Critical 항목(`1-data-model.md` 만 이 패턴이 깨짐)의 대조 사례로만 기록 |
| 2 | rationale_continuity, convention_compliance | `spec/1-data-model.md` 는 컨벤션상 "단순 overview 성격"(`EXCLUDE_BASENAMES` 근거)으로 분류돼 있어 `data-flow/11-workflow.md`·`12-workspace.md`(frontmatter `status` 자체 없음)와 같은 "라이프사이클 비추적" 범주인데, draft 는 이 파일에만 `status`/`pending_plans` 스키마를 그대로 적용해 겉보기엔 가드가 있는 것처럼 보이는 frontmatter 를 만든다 | 변경안 3번 | 위 Critical 항목을 정정하는 김에, `1-data-model.md` 도 `data-flow/*.md` 두 파일과 같은 방식(frontmatter 건드리지 않고 §1.1 본문에 프로즈 각주만 추가)으로 처리할지, 가드 대상에 넣을지(위 제안 (c)) draft 안에서 명시적으로 선택할 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | `1-data-model.md` 는 `EXCLUDE_BASENAMES` 대상이라 가드가 승격을 강제한다는 draft 서술이 사실과 다름 (저장소 이력 `f0fa0bac`→`db496a3c2` 로 실증) |
| rationale_continuity | MEDIUM | 동일 이슈 + `1-data-model.md`"단순 overview" 분류·`code:` bespoke 용법과의 결 어긋남 |
| convention_compliance | HIGH | 동일 이슈, `spec-frontmatter-parse.ts` 소스로 이중 미적용(INCLUDE_PREFIXES 미매치 + EXCLUDE_BASENAMES) 직접 반증 |
| plan_coherence | MEDIUM | 동일 이슈를 "구현 plan 완료 시 수동 되돌림이 어느 체크리스트에도 없는 후속 항목 누락"으로 프레이밍 |
| naming_collision | NONE | draft 는 기존 frontmatter 키(`status`/`pending_plans`) 재사용뿐 신규 식별자 없음 — 위반 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) `plan/in-progress/spec-draft-cross-workspace-refs-2.md` 변경안 3번의 근거 문장에서 "`spec/conventions/spec-impl-evidence.md` §3 이 … 가드로 강제한다"를 삭제하고, R-11 패턴을 따라 "이 파일은 `EXCLUDE_BASENAMES` 대상이라 가드 미적용 — 승격은 구현 plan 이 `complete/` 로 이동하는 커밋에서 수동으로 되돌려야 하며 판정 근거를 그 커밋에 남긴다"로 정정.
2. `plan/in-progress/cross-workspace-refs.md` 체크리스트(또는 완료 커밋 설명)에 "`spec/1-data-model.md` frontmatter `status` 를 `implemented` 로 되돌리고 `pending_plans` 제거" 항목을 명시적으로 추가.
3. (선택, non-blocking) `1-data-model.md` 에 `status`/`pending_plans` 스키마를 계속 붙일지, `data-flow/*.md` 두 파일처럼 프로즈 각주만 남길지 draft 안에서 명시적으로 선택.
4. (선택, non-blocking) 진짜 가드 보호가 필요하다면 `spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`/`INCLUDE_PREFIXES` 에서 `1-data-model.md` 를 빼는 별도 convention 변경 + `spec-frontmatter-parse.test.ts:28` 갱신을 별도 PR/draft 로 진행.
5. `0-canvas.md` §11.2.2 비대칭(INFO #1)은 조치 불요 — 기록만 유지.