# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 `spec/conventions/frontend-layering.md` status 승격(`partial→implemented`) + `LOWER_LAYERS` 스코프 확장(`src/lib/**` → `src/lib/**, src/types/**`) 변경에 대해 위험도 NONE 을 보고했으며, Critical/Warning 급 위반은 발견되지 않았다.

## 공통 프로세스 관찰 (참고, 조치 대상 아님)
5개 checker 전원이 독립적으로 동일한 payload 결함을 보고했다: `--impl-prep` 의 `scope=spec/conventions/` 가 디렉터리 단위로 지정돼 프롬프트가 `audit-actions.md`·`cafe24-api-catalog/**`(수백 개 field-level 문서) 등 무관 파일로 채워지며 실제 diff 대상(`spec/conventions/frontend-layering.md`, `plan/in-progress/spec-draft-frontend-layering.md`)이 truncate 로 누락됐다. 전원이 워킹트리(`.claude/worktrees/frontend-layering-types-scope-351061`)를 직접 열어 `git diff 29aa918a6...HEAD` 등으로 재구성해 검토를 완주했으므로 이번 결과 자체의 신뢰도에는 영향이 없다. 다만 향후 `--impl-prep` 스코프 직렬화 로직이 파일 단위(변경분 diff 기준)로 좁혀지지 않으면 더 큰 변경 건에서 payload 누락이 실제 검토 공백으로 이어질 위험이 있다 — 하네스 개선 백로그 항목으로만 기록.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | "레이어/계층" 용어가 `frontend-layering.md`(디렉터리 의존 방향) / `execution-context.md`(변수 예약 시점 3계층) / `0-overview.md` §2.6(Data Layer) / `error-codes.md`(에러 분류)에서 각기 다른 의미로 재사용되나, target 문서 Overview 각주가 이미 명시적으로 스코프를 분리해 두어 실제 충돌 없음 | `spec/conventions/frontend-layering.md` Overview 각주 | 조치 불요. 5번째 "레이어" 용례 추가 시에만 재확인 |
| 2 | Rationale Continuity | 계획된 Phase(D1~D4) 순서와 실제 실행(spec `partial`→`implemented` 승격 + `pending_plans` 제거 + plan rename)이 완전히 합치 — 모범 사례로 기록 | `spec/conventions/frontend-layering.md` frontmatter, `plan/complete/spec-draft-frontend-layering.md` | 조치 불필요 |
| 3 | Rationale Continuity / Convention Compliance | §4(규칙 표 아래 "PR #969" 유지) vs §4.1("— PR #969" 삭제) 사이 PR 번호 각주 보존 정책 비일관 — 기존 `/ai-review` INFO#13 재확인, 이미 "조치 불필요"로 처분됨 | `spec/conventions/frontend-layering.md` §4 / §4.1 | 이미 처분된 사안. 원하면 두 곳 모두 PR 각주 제거로 통일(선택 사항) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 순수 frontend 디렉터리 의존 방향 규약이라 데이터 모델/API/요구사항ID/상태전이/RBAC 교차 축 자체가 없음. "레이어" 용어 재사용은 target 문서가 이미 방어 |
| Rationale Continuity | NONE | 직전 spec 커밋이 미리 기록한 "2026-07-17 결정" Rationale 을 그대로 실행. 기각된 대안 재도입·원칙 위반 없음 |
| Convention Compliance | NONE | frontmatter 스키마·상태 전이(`partial→implemented`+`pending_plans` 제거와 plan 이동 동일 커밋)·문서 3섹션 구조·`code:` 글로브 실존 모두 `spec-impl-evidence.md` 기준 충족 |
| Plan Coherence | NONE | 자기 plan(`plan/complete/spec-draft-frontend-layering.md`) Phase 1~3 완결 후 정상 이동. 미해결 결정·선행 plan 미해소·후속 누락 전부 없음 |
| Naming Collision | NONE | 신규 식별자(`LOWER_LAYERS` 등)는 정의부/소비부 2곳 밖에서 미사용. `src/types/**` 는 기존 디렉터리 스코프 편입일 뿐 신규 경로 아님. plan 이동 목적지 중복 없음 |

## 권장 조치사항
1. (선택, 비차단) §4/§4.1 의 "PR #969" 인용 비일관을 원하면 이번 기회에 양쪽 통일 — 이미 별도 코드리뷰 트랙에서 INFO 로 추적 중이므로 급하지 않음.
2. (백로그, 비차단) `--impl-prep` scope 직렬화가 디렉터리 단위 알파벳 순 dump 대신 실제 diff 파일 기준으로 좁혀지도록 하네스 개선 검토 — 5개 checker 전원이 동일 payload 누락을 겪었고, 이번엔 워킹트리 재구성으로 만회했으나 재현 가능한 구조적 결함.
