# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/conventions/interaction-type-registry.md`)의 uncommitted 변경은 "grep" → "AST(코드 리터럴) 스캔/AST 가드" 용어를 정정하는 순수 서술 정합화 4곳뿐이며, 실제 구현(`interaction-type-exhaustiveness.test.ts`, TS AST 파싱)과 문서를 더 일치시키는 정정이다. 신규 식별자·데이터 모델·API 계약 변경이 전혀 없어 Cross-Spec/Naming 위험은 NONE이나, 이 정정을 촉발한 plan 문서(`interaction-type-guard-comment-false-negative.md`)의 대응 체크박스가 아직 미갱신이라는 bookkeeping 성격의 WARNING이 1건 있다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | target diff(§1.2 rule 3·§2.1 `system_error`/`rag` 두 행·§4·§5 grep→AST 용어 정정)가 plan 이 위임한 project-planner 후속 작업을 정확히 이행했으나, 그 plan 문서의 해당 체크박스는 여전히 `[ ]` 로 미갱신 | `spec/conventions/interaction-type-registry.md` §1.2/§2.1/§4/§5 (uncommitted diff) | `plan/in-progress/interaction-type-guard-comment-false-negative.md` §"후속 (본 PR 범위 밖)" 첫 항목 | target spec 커밋과 같은 변경 세트에서 해당 plan 항목을 `[x]` 로 갱신 + 완료 근거(커밋 SHA/PR) 기록. 단 plan 의 나머지 3개 후속 항목(선택·비차단)이 남아있는 한 `complete/` 로 조기 이동하지 말 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `## Overview` 헤딩 명시 부재 (3섹션 권장 스타일) | 문서 상단 (제목 직후 헤더 없이 본문 진입) | 강제 아님. `spec/conventions/` corpus 상당수가 동일 관행 — target 고유 결함 아님. 가독성 위해 고려만 가능 |
| 2 | Convention Compliance | `## 5. Rationale` 번호매김 스타일 vs 타 문서의 standalone `## Rationale` 혼재 | `## 5. Rationale` | target 개별 수정 불요. 선호 스타일을 `project-planner/SKILL.md` 에 명문화하는 규약 갱신 대상으로 고려 |
| 3 | Rationale Continuity | 이번 호출에 제공된 "관련 Rationale 발췌" 번들이 target 의 실제 cross-reference 그래프(execution-engine.md/ai-agent.md/conversation-thread.md)와 어긋나고 무관한 0-overview/1-data-model/2-navigation 다수를 포함 | 프로세스 관찰 (orchestrator 번들 조립 로직) | Rationale 번들 조립 시 target 문서의 인바운드/아웃바운드 링크를 우선 활용하도록 점검. 이번 세션 결론에는 영향 없음(직접 열람으로 커버) |
| 4 | Rationale Continuity | target §5 의 자기 정정("영구히 차단한다" → 2026-07-17 실측 정정)은 근거 동반 정당한 번복의 모범 사례로 확인 | `spec/conventions/interaction-type-registry.md` §5 | 조치 불요, 참고 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | grep→AST 용어 정정 4곳뿐, 엔티티/API/요구사항ID/상태전이/RBAC 변경 없음. `conversation-thread.md` 가 이미 쓰던 "AST 가드" 표현과의 기존 불일치를 오히려 해소 |
| Rationale Continuity | NONE | target 미변경 파일이나 관련 코드(#975 `ResumableNodeHandler` 제네릭화)가 §4 "패키지가 SoT" 경계·`1-ai-agent.md` 의 `'out'` 기각 결정을 위반하지 않음을 실측 확인. 번들 조립 로직 개선 여지는 INFO |
| Convention Compliance | LOW | frontmatter/DTO명명/에러코드/SoT 경계/레이어 경계 전부 준수. Overview 헤딩·Rationale 번호매김은 corpus 전반 기존 비일관(INFO) |
| Plan Coherence | LOW | target 이 plan 위임 작업을 정확히 이행했으나 plan 체크박스 미갱신 (WARNING) |
| Naming Collision | NONE | 신규 식별자 도입 없음, 순수 용어 정정 |

## 권장 조치사항
1. (WARNING 해소) target spec 커밋과 같은 변경 세트에서 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 "후속 (본 PR 범위 밖)" 첫 항목을 `[x]` 로 갱신하고 완료 근거를 남긴다. plan 은 나머지 3개 후속 항목이 남아있는 한 `in-progress/` 에 유지.
2. (선택, 비차단) `spec/conventions/` 문서 구조 스타일(Overview 헤딩 유무, Rationale 번호매김)의 corpus 전반 비일관은 별도 규약 정비 이슈로 추적 가능하나 이번 target 수정 대상은 아님.
