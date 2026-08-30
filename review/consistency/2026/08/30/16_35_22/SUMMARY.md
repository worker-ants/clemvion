# Consistency Check 통합 보고서

**BLOCK: YES** — plan frontmatter 필수 필드(`started`/`owner`) 누락으로 build guard 가 즉시 실패하는 Critical 1건 발견

## 전체 위험도
**HIGH** — 구조적 spec/plan 논리에 CRITICAL 은 없으나, target 문서 자체가 build guard 를 실측으로 즉시 깨뜨리는 상태로 커밋되면 CI 를 확정적으로 깬다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | plan frontmatter 필수 필드 `started`/`owner` 누락 — `plan-frontmatter.test.ts` build guard 실측 2건 FAIL(`npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts`) | frontmatter (문서 최상단, `id`/`status`/`worktree`/`spec_impact` 4필드만 선언) | `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마(top-level in-progress plan 필수 3필드: `worktree`/`started`/`owner`) + `spec/conventions/spec-impl-evidence.md §4.2` 표 | `started: 2026-08-30`, `owner: project-planner` 추가. 자매 문서(`spec-draft-eia-62-waiting-payload.md` 등) 필드 순서를 그대로 따를 것 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 target 문서 자신의 frontmatter 결손이며, 이 검토를 수행 중인 role(project-planner, spec draft 작성 단계) 의 쓰기 권한 범위 안에서 직접 수정 가능하다. 권한 밖 spec drift 사례가 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `node-cancellation.md` §2.4 소급 footnote 위치가 실제 영향 12곳 중 2곳(`retry-turn.service.ts`)만 커버 — 나머지는 §2.4 3번째 불릿, §6 표 전용 행, 또는 §2.4/§6 어디에도 함수명이 없는 6곳(`execution-engine.service.ts` 3 + `ai-turn-orchestrator.service.ts` 3)에 흩어져 있음 | §B 표 5번째 항목 "붙일 위치: §2.4 네 번째 불릿" | `spec/conventions/node-cancellation.md` §2.4 본문(불릿 4개) + §6 구현 현황 표 | footnote 를 §2.4 3번째 불릿(`finalizeFailedExecution`/`failFirstSegmentSetup`)·§6 표의 `finalizeCancelledExecution` 전용 행·§2.4 4번째 불릿(`retry-turn.service.ts`)에 개별 소급 표시하거나, 최소한 12곳 전체 목록을 footnote 에서 참조해 "네 번째 불릿"이 대표 사례일 뿐임을 명시 |
| 2 | cross_spec | `execution-engine.md` footnote 목표 위치(§1.1)가 "admission gate" 내용을 포함하지 않음 — §1.1(종결 이벤트)과 §8(admission gate, `admitExecutionOrDefer`)에 걸친 내용을 §1.1 단일 앵커에만 지정 | §B 표 1행 "붙일 위치: `### 1.1 Execution 상태`" | `spec/5-system/4-execution-engine.md` §1.1(35~100행, admission 언급 0건) vs §8(1121~1140, 1705~1723행, admission gate 서술 소재지) | admission gate 관련 서술은 §8 에 별도 소급 각주를, §1.1 각주는 "종결 이벤트(동시 cancel 선점)" 부분으로 범위를 좁히거나 §8 참조를 명시 |
| 3 | plan_coherence | `node-cancellation.md` §6 "구현 현황" 표의 `mutation 6/6`(`:197`, park↔resume 짝 전이)·`mutation 13/13`(`:199`, retry 재진입) "검증됨" 과대 주장 정정이 `retry-turn-terminal-guard.md` → `update-returning-tuple-shape.md` 위임 경로를 거치며 "§2.4 프로즈 1곳"으로 축소돼 target 초안에도 반영되지 않음. 실측 확인: `:197` 행이 지목하는 `failFirstSegmentSetup`/`finalizeFailedExecution` 도 동일한 `updateExecutionStatus`/`persisted` 반환값 분기 결함 클래스 | §B 표(5번째 항목 범위), §C frontmatter | `spec/conventions/node-cancellation.md` §6 표 `:197`/`:199` 행("✓ mutation N/N 검증") | §B 에 6번째 소급 각주 항목을 추가해 §6 표 두 행에 "이 mutation 수치는 driver mock 경계 안쪽만 검증했고 실제 RETURNING 튜플은 `#1168`(2026-08-13) 이전까지 항상 `true` 였다"는 caveat 을 걸 것. `retry-turn-terminal-guard.md` 쪽에도 위임이 실제 반영됐는지 재확인 라인 추가 |
| 4 | convention_compliance | §A 가 신규 `spec/conventions/raw-query-results.md` 의 필수 frontmatter(`id`/`status`/`code:`)를 지시하지 않음 — 대상 구현(`update-returning-rows.ts` 등)은 이미 `#1241` 로 완료돼 `status: implemented` + `code:` 목록이 자연스러운데 초안에 누락 | §A 절 전체 | `spec/conventions/spec-impl-evidence.md §1·§2`(frontmatter 의무 + `spec-code-paths.test.ts` 가드) | §A 말미에 권장 frontmatter 블록(`id: raw-query-results`, `status: implemented`, `code: [...]`) 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 규약 문서 위치·명명이 기존 `spec/conventions/` 구조·명명 컨벤션과 일관 | §A | 조치 불요(확인용) |
| 2 | convention_compliance | frontmatter 가 plan 스키마와 spec 스키마를 혼용(`id`/`status: draft`) — 자매 spec-draft 문서는 `title` 만 사용 | frontmatter | `id`/`status` 제거하거나, 유지 시 plan 필수 3필드를 추가로 채워 스키마 정합 |
| 3 | convention_compliance | `worktree:` 값이 스키마 예시(`<task_name>-<slug>`)와 달리 `.claude/worktrees/` 경로 접두를 포함(기능은 정상 동작, `plan_guard.py` 가 정규화 처리) | frontmatter `worktree:` | 급하지 않음. 다음 편집 기회에 경로 접두 제거해 자매 문서와 표기 일치 |
| 4 | plan_coherence | 소급 각주 대상 개수("12곳 vs 11곳") 정정이 target 에는 반영됐으나 source plan(`update-returning-tuple-shape.md`)의 "11곳" 표 자체는 그대로 남음 | §B "영향 범위 실측" 콜아웃 | `update-returning-tuple-shape.md` 의 "11곳" 표를 "12곳" 으로 갱신하거나 동일 정정 배너 추가 |
| 5 | naming_collision | `pending_plans` 갱신 지시(`update-returning-tuple-shape.md` 등재)가 다른 in-progress spec-draft(`spec-update-node-cancellation-shutdown-classification.md:664`)에도 동일하게 존재 — 값은 같아 의미 충돌은 아니나 중복 출처 | §C | planner 반영 시 한쪽 지시를 소거하거나 상호 참조 각주로 정리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | 소급 각주 5건 중 3건은 정확, 2건(node-cancellation §2.4, execution-engine §1.1)은 커버 범위 과소 대표 |
| rationale_continuity | NONE | 인용 근거(#1168/#1172/#1241, 기각 대안, 각주 위치 5건) 전부 실측 대조 일치. 발견 없음 |
| convention_compliance | HIGH | plan frontmatter 필수 필드 누락으로 build guard 즉시 FAIL(실측). §A frontmatter 지시 누락 등 WARNING/INFO 다수 |
| plan_coherence | MEDIUM | `retry-turn-terminal-guard.md` → `update-returning-tuple-shape.md` 위임 경로에서 §6 표 과대 주장 정정이 누락(실측으로 결함 클래스 동일함 확인) |
| naming_collision | LOW | CRITICAL 급 identifier 충돌 없음. `pending_plans` 중복 지시 출처만 INFO |

## 권장 조치사항
1. (BLOCK 해소) frontmatter 에 `started: 2026-08-30`, `owner: project-planner` 추가.
2. §B 에 6번째 소급 각주 항목 추가 — `node-cancellation.md` §6 표 `mutation 6/6`·`mutation 13/13` 검증 행에 driver mock 경계 caveat.
3. cross_spec WARNING 2건 반영 — `node-cancellation.md` §2.4 footnote 커버 범위 확장(12곳 목록 참조 또는 개별 소급), `execution-engine.md` footnote 를 §1.1/§8 로 분리.
4. §A 에 신규 `raw-query-results.md` 의 권장 frontmatter 블록(`id`/`status: implemented`/`code:`) 명시.
5. 여유 시 INFO 5건 반영 — frontmatter 스키마 정합(`id`/`status: draft` 정리), `worktree:` 경로 정규화, `update-returning-tuple-shape.md` "11곳→12곳" 갱신, `pending_plans` 중복 지시 정리.
