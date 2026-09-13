# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 success, 전문 확보 완료. Critical 발견 0건.

## 전체 위험도
**LOW** — `spec/conventions/**` 델타 0(harness 테스트 리네임/확장 전용 PR). 유일하게 반복되는 이슈는 `user-guide-evidence.md §2` 가드 가족 미등재(WARNING) — 4라운드 연속 관측됐으나 developer 권한 밖으로 정확히 판별되어 planner 백로그에 이미 완결된 형태로 등재돼 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> Critical 없음. 다만 아래 WARNING 두 건은 근본 원인이 `spec/**` 쓰기 권한(project-planner 전용)에 있어, 참고용으로 인계 경로를 명시한다 — **BLOCK 사유 아님**(WARNING 이므로 `BLOCK: YES` 트리거 아님).

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/conventions/user-guide-evidence.md` 쓰기는 project-planner 전용 | project-planner | §2 "Build-time 가드" 표에 `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`guide-sanitized-message-parity.test.ts` 3건 추가, frontmatter `code:` 목록 갱신, 신규 `## Rationale` 항목(①"허용목록 없음" 원칙을 왜 유지 못했는가 ②`guide-error-code-truth.md §D` 기각 사유와 무엇이 다른가) | `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274` (초안 이미 있음, 복붙 수준) |
| 2 | `spec/conventions/cafe24-api-metadata.md` 쓰기는 project-planner 전용 (이번 PR 과 무관한 선재 결함) | project-planner | §4 "용어 주의" 박스의 "CONVENTIONS Principle 7" → "Principle 0" 오인용 정정 (node-output.md 실제 정의처 기준) | `plan/in-progress/spec-draft-nullable-notation-followups.md:3406-3414` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, cross_spec, convention_compliance, plan_coherence (4중 수렴) | `#1330` "허용목록 없음" 설계 원칙 번복의 Rationale 이 spec 문서에 미승격, 가드 가족이 SoT §2 표/frontmatter 에 미등재 | `spec/conventions/user-guide-evidence.md` §2 표, frontmatter `code:` / `guide-identifier-scan.ts` 상단 주석 | `plan/complete/guide-error-code-truth.md §D`(과거 "허용목록 없음" 결정) | planner 턴에서 §2 표 2행 추가 + frontmatter 갱신 + `## Rationale` 신설을 **한 턴에** 처리 (초안 `spec-draft-nullable-notation-followups.md:3247` 기존) |
| 2 | convention_compliance, plan_coherence (2중 수렴) | `cafe24-api-metadata.md §4` 가 node-output envelope 정의처를 "Principle 7"로 오인용(실제 Principle 0) | `spec/conventions/cafe24-api-metadata.md §4` | `spec/conventions/node-output.md` Principle 0 | planner 턴에서 "Principle 7"→"Principle 0" 정정 (이 PR 과 무관한 2026-05-16부터의 선재 결함) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 부분 재도입 — frontend 소스는 여전히 기준집합 미포함, `#1330` 기각 사유 중 "자기증명 오염" 축은 보존 | `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` | 없음 — WARNING #1 Rationale 신설 시 "무엇을 뒤집고 무엇을 보존했는가" 한 문장 포함 |
| 2 | naming_collision | 모듈-private 상수 `UPPER_SNAKE` 정규식 이름이 backend repo-guard 와 우연히 중복(비export, 무관계) | `guide-identifier-scan.ts` vs `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:60` | 조치 불필요 — 향후 공유 유틸화 시 이름 통합 고려 |
| 3 | naming_collision | 허용목록 이름 접두사(`GUIDE_EXTERNAL_VOCABULARY`) 가 무관 도메인 `KNOWN_*` 접두 회피 의도와 실측 일치 확인됨 | `plan/in-progress/guide-identifier-existence.md` | 없음 |
| 4 | plan_coherence | `user-guide-evidence.md §2` gap 은 이 PR 이후에도 열려 있음(방치 아니라 추적 중) | `spec/conventions/user-guide-evidence.md` §2/§2.1 | 다음 planner 턴에서 WARNING #1 과 함께 일괄 반영 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/conventions/**` 델타 0. 데이터모델·API·RBAC·계층 책임 충돌 없음. SoT 미등재 WARNING 은 선행 리뷰가 이미 등재. |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복이 spec `## Rationale` 로 미승격(4라운드 연속, developer 조치는 완료·잔여는 순수 planner 몫) |
| convention_compliance | LOW | 신규 위반 없음. 선재 WARNING 2건(SoT 미등재, cafe24 오인용) 모두 planner 백로그에 정확히 등재 확인 |
| plan_coherence | NONE | plan 자기 서술과 실제 저장소 상태 불일치 없음. 선행 gap 2건 모두 정상 추적 중 |
| naming_collision | NONE | 신규 식별자 전수 grep 결과 충돌 없음. `MESSAGE_CREATE` 등 외부 어휘도 의미 일관 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 이번 PR 은 push 가능.
2. 다음 project-planner 턴에서 `spec/conventions/user-guide-evidence.md` §2 표 + frontmatter `code:` + `## Rationale`(허용목록 원칙 번복 근거)을 **한 번에** 갱신 — 초안은 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274`.
3. 같은 planner 턴 또는 별도 턴에서 `spec/conventions/cafe24-api-metadata.md §4` 의 "Principle 7"→"Principle 0" 오인용 정정 — 이 PR 과 무관하므로 급하지 않음.
4. developer 는 위 두 항목에 대해 추가 조치 없이 진행 가능 — 권한 경계(spec/** 쓰기 금지)를 정확히 지키고 있음.