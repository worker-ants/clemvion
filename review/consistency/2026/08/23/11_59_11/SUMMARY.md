# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 target(`plan/in-progress/swagger-decisions.md`)에 대해 CRITICAL 위배를 보고하지 않았다.

## 전체 위험도
**LOW** — 직접적 모순·규약 위반·plan 상충·식별자 충돌은 없음. 문서 완결성(인용 누락·수치 병존·패턴 카탈로그 미편입) 관련 WARNING 4건이 실제 `swagger.md` 개정 시점에 처리돼야 함.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | ③ "강제 대상 아님" 범위가 `swagger.md §3` 세 번째 길이 기준(엔드포인트 `description` 50~150자)을 언급하지 않음. 같은 문서에서 과거 이 두 기준을 혼동한 전례(트래커 L924-926)가 있어 재발 위험 실측됨 | `## ③ 길이 규칙` (line 64-77) | `spec/conventions/swagger.md` §3 본문 (L256-257) | §3 개정 시 DTO description / 엔드포인트 summary / 엔드포인트 description 3-way 표로 정리, 강제 여부 각각 명시 판정 |
| 2 | Cross-Spec | ③ 결정("DTO description 전체 비강제")이 반영되면 기존 "보안·정책 캐비엇 예외" 절이 강제 원칙 없는 예외로 남아 자기모순 발생 | `## ③ 길이 규칙` 전체 | `swagger.md` §3 "예외 — 보안·정책 캐비엇" 블록(L260-270) + Rationale(L406-431) | 캐비엇 절을 "비강제 원칙 위의 굳이 남긴 강제 최소선"으로 재정의하거나 톤을 낮춰 재작성 |
| 3 | Rationale Continuity | ③이 `swagger.md` Rationale 이 명시적으로 "별개 판단이라 여기서 건드리지 않는다"고 유보해 둔 지점을 해제하면서, 그 유보 문구를 한 번도 인용·연결하지 않음(방향 자체는 정당, "기각된 대안 재도입" 아님) | `## ③ 길이 규칙` | `spec/conventions/swagger.md` `## Rationale` → `### §3 보안·정책 캐비엇 예외` 마지막 문단 | 신설 Rationale 문단에 (a) 유보 문구 인용 (b) 전제 해소 명시 (c) 트래커 (a)/(b)/(c) 3택 항목과 상호 링크. `cafe24-token-refresh` "defer 해제" 서술 패턴 재사용 |
| 4 | Convention Compliance | ②`deprecated: true` 패턴(형제 DTO 동명이의 필드 해소)이 `swagger.md` §1 DTO 패턴 카탈로그로 편입되지 않아, 다음에 같은 상황이 오면 재조사해야 하는 갭이 남음(실측: `grep deprecated spec/conventions/swagger.md` 0건) | `## ② \`deprecated\` 표시` 섹션 전체 | `spec/conventions/swagger.md` §1 (특히 §1-4 oneOf, §1-5 writeOnly/readOnly 선례) | §1 에 짧은 소절(예: "§1-6 동명이의 back-compat 필드") 추가, 또는 최소한 일반화하지 않는다는 판단을 `## Rationale` 에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance | target 실측 표(요청 DTO 116/335, 34%)와 `swagger.md` 기존 Rationale 실측(114/333, 34%, 2026-08-22)이 같은 모집단에 대해 소폭 다른 절대값으로 병존. 백분율은 우연히 일치해 눈에 안 띔 | `## ③ 길이 규칙` 표 / `swagger.md:423` vs `:463-464` | 두 실측을 하나로 통일하거나, 재실측치 병기 시 "재실측일" 각주 명시 |
| 2 | Rationale Continuity | ① "현행 유지" 결정이 이미 한 달 전(`execute-body-dto`, 2026-08-22) 확정된 결정·캐너리(`workflows-execute-body.spec.ts`)를 인용하지 않아, "오늘 처음 결정"과 "재확인" 구분이 안 됨 | `## ① 현행 유지` | 트래커 종결 문구에 `execute-body-dto`·캐너리 명시 인용 |
| 3 | Convention Compliance | frontmatter `owner: developer` 가 planner 전속 작업(③ spec/conventions 편집)을 함께 묶음. target 자신은 표에서 이미 ③을 "성격: planner"로 구분해 둠 | frontmatter / 표 | (선택) `owner` 혼합 표기 또는 항목별 owner 필드 — 강제 아님 |
| 4 | Naming Collision | `ExecuteWorkflowDto.input` ↔ `ExecuteNodeDto.input` 동명이의는 target 이 만든 충돌이 아니라 선행 리뷰(`00_33_31 naming_collision W1`)가 이미 판정한 상태를 target 이 집행하는 것뿐 | ② 섹션 | 트래커 항목(`00_33_31`)을 target 의 "트래커 3건 종결" 단계에서 함께 닫을 것 |
| 5 | Naming Collision | §3 문서 개정 시 신설 콜아웃 제목이 기존 "예외 — 보안·정책 캐비엇" 과 겹치면 두 예외의 적용 범위 혼동 가능(아직 구체 문구 없음, 사전 권고) | ③ 섹션 | 새 콜아웃 제목을 "비강제 명문화"/"스타일 힌트" 등으로 구분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | ①②는 기존 spec·런타임과 정합. ③은 §3 자체가 예견해 둔 후속 판단 자리이나, 세 번째 길이 기준 미언급 + 예외절 자기모순 위험 + 실측치 drift (WARNING 2 + INFO 1) |
| Rationale Continuity | LOW | 세 결정 모두 기존 트래커의 "사용자 판단 필요" 항목 종결, 기각된 대안 재도입 없음. ③의 "defer 해제" 서술 패턴 미적용이 유일한 WARNING |
| Convention Compliance | LOW | CRITICAL 규약 위반 없음. ②의 패턴 카탈로그 미편입(WARNING) + 실측치 병존(INFO) + owner 필드(INFO) |
| Plan Coherence | NONE | 정본 트래커 3항목과 1:1 대응, 다른 65개 in-progress plan 과 상충 없음, 코드/스펙 diff 가 서술과 일치 |
| Naming Collision | NONE | 신규 식별자 도입 없음. 유일한 동명이의는 target 이전에 이미 발견·판정된 상태 |

## 권장 조치사항
1. `swagger.md §3` 실제 개정 시(target 작업 목록 3번째 항목) WARNING 1·2 를 함께 처리 — 엔드포인트 `description`(50~150자) 강제 여부를 3-way 표로 명시하고, 보안·정책 캐비엇 예외절을 비강제 원칙과 자기모순 없이 재서술.
2. 신설 `## Rationale` 문단에 "별개 판단이라 건드리지 않는다" 유보 문구를 인용하고 전제 해소를 명시(WARNING 3), `execute-body-dto`(2026-08-22) 결정·캐너리도 함께 인용(INFO 2).
3. `swagger.md §1` 에 `deprecated: true` 패턴을 일반 규칙으로 편입하거나, 편입하지 않기로 한 판단을 Rationale 에 명시(WARNING 4).
4. 요청 DTO 실측치(114/333 vs 116/335)를 통일하거나 재실측일 각주로 정합(INFO 1).
5. 트래커(`spec-sync-external-interaction-api-gaps.md`)의 대응 3개 `[ ]` 항목(①②③) 및 `00_33_31 naming_collision W1` 항목을 target 작업 완료 시 함께 종결.