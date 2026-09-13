# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보, CRITICAL 발견 0건. WARNING 다수는 대부분 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히 등재되어 있음(재발 방지 조치 포함).

## 전체 위험도
**MEDIUM** — CRITICAL은 없으나, "허용목록 없음" 설계 원칙 번복 근거가 spec `## Rationale` 로 아직 승격되지 않은 상태가 impl-prep 이후에도 지속되고, 같은 가드 계열이 과거(`#1330`) "등재했다고 적고 실제로는 안 함"을 3회 반복한 전력이 있어 계속 표면화할 필요가 있음(rationale_continuity 판정 근거 채택, 하향하지 않음).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 0건 보고)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 자체가 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, plan_coherence(INFO로 재확인) | `user-guide-evidence.md §2` "Build-time 가드" 표가 신규/확장된 가드 가족(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`, `guide-sanitized-message-parity.test.ts`)을 등재하지 않음 — `PROJECT.md`/코드 JSDoc 은 이 문서를 SoT 로 명시 인용하는데 정작 문서엔 없음 | `spec/conventions/user-guide-evidence.md §2` 표 + frontmatter `code:` 목록(7경로) | 코드 쪽 SoT 인용(`PROJECT.md`, `guide-identifier-scan.ts` 주석) | `#1330`부터의 pre-existing gap, developer 권한 밖(spec 쓰기 불가). `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 이미 정확히 등재됨 — 별도 조치 불요, 다음 planner 턴에서 표 2행 + frontmatter 3경로 갱신 |
| 2 | rationale_continuity | `guide-error-code-truth.md §D` 가 세운 "허용목록 없음" 설계 원칙을 이번 PR(`GUIDE_EXTERNAL_VOCABULARY` 4강제)이 실측 근거로 번복했으나, 그 근거가 CLAUDE.md 가 정한 자리(`spec/*.md` 끝 `## Rationale`)로 승격되지 않고 plan 문서에만 남음 | `spec/conventions/user-guide-evidence.md` (신설되어야 할 `## Rationale` 항목) | `plan/complete/guide-error-code-truth.md §D`(과거 기각 결정) vs 이번 PR 의 번복 근거(§B 실측 + §C 4강제) | 번복 자체는 근거 있고 절차(developer→planner 위임)도 올바름. `spec-draft-nullable-notation-followups.md` 에 Rationale 초안 문구까지 이미 마련돼 있음 — 다음 planner 턴에서 §2 표/frontmatter 갱신과 **한 턴에** 처리해 과거 3회 반복된 "좁은 등재" 재발 방지 |
| 3 | convention_compliance | `cafe24-api-metadata.md §4` "용어 주의" 박스가 `node-output.md` 의 5필드 envelope 정의처를 "Principle 7"로 오인용(실제 Principle 0), `status` 필드도 누락 | `spec/conventions/cafe24-api-metadata.md §4` | `spec/conventions/node-output.md` `## Principle 0` | 2026-05-16 최초 작성부터의 pre-existing 오류, 이번 PR 무관. developer 권한 밖 → `spec-draft-nullable-notation-followups.md` 에 planner 항목으로 이미 등재됨. 별도 조치 불요 |
| 4 | convention_compliance, naming_collision | 리네임(`guide-error-code-existence.test.ts`→`guide-identifier-existence.test.ts`)이 자매 파일의 "현재형" 상호 참조 주석에 전파되지 않아 dangling 참조 발생 | `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` | (신규) `guide-identifier-existence.test.ts` | `spec/` 무관, `codebase/**` 내 경미한 정정. developer 권한 안 — 이번 PR 에서 바로 고칠 수 있음: 해당 줄을 `guide-identifier-existence.test.ts`(리네임 전 `guide-error-code-existence.test.ts`) 형태로 갱신 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "환경변수 실재성" 판정 기준집합(`.env.example`·compose YAML)을 소유하는 spec 문서가 아직 없음(`secret-store.md` 는 무관한 범위) | `spec/conventions/secret-store.md` | 지금은 무충돌, 향후 "환경변수 명명 규약" 문서 신설 시 조율 필요하다는 점만 기록 |
| 2 | convention_compliance | `cafe24-api-metadata.md` 도입부에 `## Overview` 헤딩 없음(다른 conventions 문서와 불일치) | `spec/conventions/cafe24-api-metadata.md` 도입부 | 급하지 않음, 다음 편집 시 헤딩만 추가 |
| 3 | rationale_continuity | 백로그 문서(`spec-draft-nullable-notation-followups.md`)에 이번 라운드에서 Rationale 초안 문구가 이미 심어져 재발 방지에 진전 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 긍정적 관찰 |
| 4 | rationale_continuity | 넓힌 기준집합(env 선언처 포함)은 `guide-error-code-truth.md §D` 가 기각한 "frontend 소스 포함"과 형식적으로 다른 자원이라 재도입 아님 | `plan/in-progress/guide-identifier-existence.md §B` | 조치 불요, 판단 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0, 유일 실질 이슈(§2 미등재)는 이미 plan 에 정확히 등재됨 |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복 근거가 spec Rationale 밖에 머무는 상태가 impl-prep 이후에도 미해소, 과거 3회 반복 전력 고려해 지속 표면화 |
| convention_compliance | LOW | spec 자체 위반 0(델타 0), 기존 두 gap(§2 미등재, Principle 오인용) 및 신규 dangling 참조 1건(codebase, 즉시 정정 가능) |
| plan_coherence | NONE | plan/spec 간 모순 없음, 기존 gap 들이 정확한 위치·문구로 이미 트래커에 등재됨을 재확인 |
| naming_collision | LOW | 신규 식별자 전수 충돌 없음, 명명 컨벤션 준수. 유일 흠은 리네임 후 dangling 주석 참조 1건 |

## 권장 조치사항
1. `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` 의 옛 파일명 참조를 `guide-identifier-existence.test.ts` 로 갱신 (developer 권한 안, 이번 PR 에서 즉시 처리 가능 — WARNING #4).
2. 다음 `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신: (a) §2 표에 신규/확장 가드 2행 추가, (b) frontmatter `code:` 에 3개 경로 추가, (c) "허용목록 없음" 원칙 번복 근거를 `## Rationale` 신규 항목으로 승격 — `spec-draft-nullable-notation-followups.md` 에 이미 마련된 초안 활용, 세 조각을 **한 턴에** 처리해 과거 3회 반복된 "좁은 등재" 재발 방지 (WARNING #1, #2).
3. 같은 planner 턴 또는 별도 턴에서 `spec/conventions/cafe24-api-metadata.md §4` 의 "Principle 7" → "Principle 0" 정정 + `status` 필드 언급 추가 (WARNING #3).
4. 여유 있을 때 `cafe24-api-metadata.md` 도입부에 `## Overview` 헤딩 추가 (INFO #2, 비긴급).
