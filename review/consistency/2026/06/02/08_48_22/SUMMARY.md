# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 또는 INFO 수준.

## 전체 위험도
**MEDIUM** — 3개 WARNING 이 동일 사안(cross-node-warning-rules.md §3 타입 정의 미갱신, i18n-userguide.md "후속 plan" 문구 미제거, 자동 가드 표 갱신 누락)을 다각도로 지적. 구조적 모순(Critical)은 없으며, spec draft 확정 및 PR 병합 시 동일 PR 내 동반 갱신으로 전부 해소 가능.

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 경고 (WARNING)

중복 통합: Cross-Spec W-1 / Convention-Compliance W-3 은 동일 사안(GraphWarningRuleResult 타입 미갱신), Cross-Spec W-2 / Plan-Coherence W-1 은 동일 사안(i18n-userguide "후속 plan" 문구 잔존)이므로 가장 강한 표현으로 통합.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec + Convention-Compliance | `cross-node-warning-rules.md §3` 의 `GraphWarningRule` / `GraphWarningRuleResult` 타입 정의에 `params?` 가 없어, spec draft 가 확정되면 두 spec 이 동시 공존하는 불일치 발생 | §2 결정 C, §3-2 | `spec/conventions/cross-node-warning-rules.md §3` 타입 코드 블록 | 동일 PR 내에서 `GraphWarningRuleResult` 에 `params?: Record<string, string \| number>` 줄을 직접 diff 형태로 추가. `evaluate` 반환 타입도 동시 갱신. |
| W-2 | Cross-Spec + Plan-Coherence | `i18n-userguide.md §errorCode` L76-80 의 "후속 plan: `ERROR_KO` 신설 + `translateBackendError` 도입 검토" 문구가 spec 승격 시 삭제되지 않으면 "정책 확정 완료 vs 미래 검토" 모순 발생 | §1 문제 정의, §3-1 | `spec/conventions/i18n-userguide.md` §errorCode L76-80 | spec 승격 PR 에서 L76-80 의 "현재 갭" 절 전체를 Principle 3-C 본문으로 대체. target §3-1 에 이미 의도 기술되어 있으나 실제 수행이 중요. |
| W-3 | Convention-Compliance | `i18n-userguide.md` 의 "자동 가드 요약" 표에 G-1(graphWarning parity), G-2(ERROR_KO parity) row 추가가 §3-1 반영안에 명시되지 않음 | §3-1 | `spec/conventions/i18n-userguide.md` 자동 가드 요약 표 | §3-1 반영안에 "자동 가드 요약 표에 G-1·G-2 row 추가" 를 명시적으로 포함. 동시에 기존 P1-B 가드와 G-1 의 커버리지 경계(graphWarningRule 동적 message 는 P1-B 미커버 — G-1 전담) 도 명문화. |
| W-4 | Plan-Coherence | `parallel-p2-followups.md §6` 항목 1의 "신설 시" 조건절이 target 의 결정 D(ERROR_KO 신설 의무)와 충돌 — 조건부 표현이 확정 의무를 모호하게 만듦 | §1 문제 정의, §2 결정 A/D | `plan/in-progress/parallel-p2-followups.md §6` 항목 1 | target spec draft merge 시 §6 항목 1의 "신설 시" 조건절을 "의무" 로 갱신. target §5 에 이 갱신 절차를 체크박스로 추가. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Rationale-Continuity | `GraphWarningRule.evaluate` 타입 확장 근거가 `cross-node-warning-rules.md ## Rationale` 에 미기재 — target draft 에만 있어 피참조 spec 의 Rationale 단일 진실 분산 | spec-draft §결정 C, §3-2 | §3-2 반영안에 cross-node-warning-rules.md `## Rationale` 에 "params 추가 근거" 항목 명시 포함 |
| I-2 | Rationale-Continuity | Principle 3 본문의 매핑 테이블 목록(`WARNING_KO`) 에 `GRAPH_WARNING_KO` 누락 — 신구 테이블 역할 분담이 Principle 3 본문에서 불명확 | §3-1 | §3-1 반영안에 Principle 3 본문 테이블 목록을 두 테이블로 분리 기술, 자동 가드 요약 표에도 `GRAPH_WARNING_KO` 행 추가 |
| I-3 | Rationale-Continuity | `ERROR_KO` 가 `i18n-userguide.md Principle 6-B` 금지 목록에 이미 포함 — 신설해도 사용자 가이드 노출 위험 구조적 차단됨 | §3-1 | 조치 불필요 (정보 목적) |
| I-4 | Cross-Spec | `translateBackendError` 시그니처가 기존 예고(3인자)와 다른 4인자로 확정 — 과도기 불일치 | §2 결정 A | spec 확정 즉시 i18n-userguide §errorCode 예고 문구를 4인자 시그니처로 교체 |
| I-5 | Cross-Spec | `node-output.md §3.2` cross-ref 가 §4 side-effect 에만 있고 §3 공식 반영안에 미포함 | §4 | §3 에 "3-3. `spec/conventions/node-output.md §3.2` — 한 줄 cross-ref 추가" 항목 명시 |
| I-6 | Cross-Spec | G-1 가드의 테스트 파일 위치(기존 `ui-label-parity.test.ts` 에 추가 vs 신규 `graph-warning-label-parity.test.ts`)가 target 에서 미결정 | §3-1 / §5 가드 항목 | §3-1 또는 §5 에 G-1 가드의 구체적 테스트 파일 위치를 명시 |
| I-7 | Convention-Compliance | `Principle 3-C` 승격 시 기존 절 제목 변경 여부가 draft 에 미명시 | §3-1 | draft §3-1 에 기존 "errorCode 의 처리 (현재 갭)" 절 제목 → "Principle 3-C — ..." 로 변경 여부 한 줄 명시 |
| I-8 | Convention-Compliance | plan 파일이 spec 확정 내용을 영구 보관하는 형태로 굳어질 위험 | 문서 전체 구조 | 채택 확정 시 §3 내용을 target spec 에 직접 반영하고 plan 파일은 메타데이터(phase·worktree)만 남김 |
| I-9 | Plan-Coherence | plan frontmatter 에 `worktree` 필드 없음 | 문서 frontmatter | 파일 생성 시 `worktree: (spec-draft, no impl worktree)` 또는 현재 worktree 기재 |
| I-10 | Plan-Coherence | `backend-msg-i18n-impl.md` 구현 plan 이 아직 없어 spec merge 후 추적 끊길 위험 | §5 | spec PR 에서 구현 plan 파일을 함께 생성하거나 §5 에 생성 체크박스 추가 |
| I-11 | Plan-Coherence | `close-cross-node-warning-c4c4d9` worktree 가 동일 파일(`cross-node-warning-rules.md`) frontmatter 를 수정 중이나 충돌 구간이 다른 줄(frontmatter vs §3 타입 블록) | `spec/conventions/cross-node-warning-rules.md` | merge 시 자동 해소 가능. 동일 파일을 두 worktree 가 수정한다는 사실 인지 |
| I-12 | Plan-Coherence | `GraphWarningRuleResult` 타입 갱신 의무가 §5 구현 follow-up 항목에 미명시 | §5 구현 follow-up | 항목 1에 "shared package `GraphWarningRule.evaluate` 반환·`GraphWarningRuleResult` 타입 갱신(하위호환)" 명시 |
| I-13 | Plan-Coherence | i18n-userguide spec frontmatter `status` 변경 여부가 §3-1 에 미언급 | §3-1 | "이미 implemented, §errorCode 갭 제거 후 완전 satisfied" 또는 전이 절차 한 줄 명시 |
| I-14 | Naming-Collision | `GRAPH_WARNING_KO` 가 `no-internal-refs.test.ts` L64 금지 패턴에 미등록 — user-guide 가드 커버리지 갭 | 구현 follow-up | 구현 PR 에서 `no-internal-refs.test.ts` L64 정규식에 `GRAPH_WARNING_KO` 추가 |
| I-15 | Naming-Collision | 자동 가드 ID `G-1`/`G-2` 가 기존 `P<principle>-<subcode>` 체계와 이질적 | §결정 E | spec 확정 시 가드 ID 를 `P3-C-1`, `P3-C-2` 로 조정하여 i18n-userguide 요약 테이블과 일관성 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `cross-node-warning-rules.md §3` 타입 미갱신(W-1), i18n-userguide "후속 plan" 문구 잔존 위험(W-2), P1-B vs G-1 커버리지 경계 미명시(W-3 연관) |
| Rationale-Continuity | LOW | Critical/Warning 없음. 피참조 spec Rationale 분산(I-1), Principle 3 테이블 목록 미갱신(I-2) INFO 2건 |
| Convention-Compliance | LOW | 자동 가드 요약 표 갱신 누락(W-3), `node-output.md` side-effect 가 §3 공식 반영안 누락(I-5). Critical 없음 |
| Plan-Coherence | LOW | `parallel-p2-followups.md §6` 조건절 불일치(W-4), 구현 타입 갱신 의무 미명시(I-12). Critical 없음 |
| Naming-Collision | LOW | Critical/Warning 없음. `GRAPH_WARNING_KO` 가드 패턴 미등록(I-14), 가드 ID 체계 이질(I-15) INFO 2건 |

## 권장 조치사항

1. **(W-1 해소 최우선)** spec draft 를 main 에 merge 하는 PR 에서 `spec/conventions/cross-node-warning-rules.md §3` 의 `GraphWarningRuleResult` 타입 블록에 `params?: Record<string, string | number>` 를 직접 추가하고 `evaluate` 반환 타입도 동시 갱신. draft §3-2 에 구체적 diff 형태로 명시 권장.
2. **(W-2 해소)** 동일 PR 에서 `spec/conventions/i18n-userguide.md §errorCode` L76-80 의 "현재 갭" 절 전체를 Principle 3-C 본문으로 대체. 문구 "검토" 잔존 차단.
3. **(W-3 해소)** §3-1 반영안에 i18n-userguide "자동 가드 요약" 표에 `GRAPH_WARNING_KO` / G-1·G-2 row 추가를 명시. P1-B 와 G-1 의 커버리지 경계(정적 vs 동적)도 Principle 3 본문에 명문화.
4. **(W-4 해소)** target §5 에 "`parallel-p2-followups.md §6` 항목 1 조건절 → 의무 갱신" 체크박스 추가. spec merge 시 동일 PR 또는 직후 별도 commit 으로 처리.
5. **(I-14)** 구현 PR 에서 `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L64 정규식에 `GRAPH_WARNING_KO` 추가 — 구현 plan(`backend-msg-i18n-impl.md`) 에 명시.
6. **(I-15)** spec 확정 문서 작성 시 가드 ID 를 `P3-C-1`, `P3-C-2` 로 조정하여 i18n-userguide 요약 테이블과 명명 체계 통일.
7. **(I-1)** `cross-node-warning-rules.md ## Rationale` 에 "params 추가 근거" 항목 추가 — 피참조 spec 에서 Rationale 단일 진실 유지.
8. **(I-10)** spec PR 병합 시 또는 직후 `plan/in-progress/backend-msg-i18n-impl.md` 구현 plan 파일 생성. 추적 누락 방지.