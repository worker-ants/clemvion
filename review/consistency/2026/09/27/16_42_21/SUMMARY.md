# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 위험도 NONE, Critical/Warning 0건. `spec/2-navigation/` 델타 0(순수 codebase 정정 PR)이며, 3개 요청 DTO nullable 선언 정정이 `spec/5-system/2-api-convention.md §5.4` 기존 예외 규정과 정확히 일치함을 5개 관점 모두 독립적으로 확인.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | 요청 DTO nullable 선언이 §5.4 선례(`UpdateAssistantSessionDto.llmConfigId`)를 정확히 따름 | `update-workflow.dto.ts` · `update-node.dto.ts` · `update-auth-config.dto.ts` | 조치 불요. 원하면 §5.4 선례 문장에 이번 세 필드를 추가 선례로 병기 가능 |
| 2 | Rationale Continuity | "필터 계층에서 23502 매핑" 대안 재도입을 스스로 차단(§A 인용) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목, `patch-body-followups.md` --impl-prep W4 | 조치 불요 — 후속 PR 착수 시 인용 유지 |
| 3 | Rationale Continuity | 3R에서 응답 DTO 축과 요청 DTO 축의 방어 메커니즘(래칫 vs 선언 캐너리) 구분을 재확인 | `plan/in-progress/patch-body-followups.md` /ai-review 3R 절 | 조치 불요 |
| 4 | Convention Compliance | `response-contract.ts`의 `contractForDto` 헬퍼(이름은 "response"용)를 요청 DTO 스키마 검사에 재사용 | `*-validation.spec.ts` 신규 선언 캐너리 | 조치 불요 수준. 원하면 `schemaForDto` 류로 개명하거나 주석 한 줄 추가 |
| 5 | Plan Coherence | 상위 트래커 항목 좁히기(executions findById)·신규 500 항목 등재가 plan 서술과 실제 파일 내용 일치 확인됨 | `spec-draft-nullable-notation-followups.md:1405-1450` | 조치 불요. `--impl-done` 체크 시 plan을 `plan/complete/`로 이동할 것(트래커 전방 참조 유효화) |
| 6 | Plan Coherence | 변경된 3개 DTO를 참조하는 다른 in-progress plan과의 충돌 없음 확인 | 전체 `plan/in-progress/**` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델(§2.4/§2.6/§2.17 nullable)·API 규약(§5.4 요청 바디 예외)·권한·상태 전이 어느 층에서도 충돌 없음 |
| Rationale Continuity | NONE | 기각된 대안(필터-레벨 23502 매핑) 재도입 없이 명시 인용으로 차단, §5.4 선례 정확히 준수, INFO 3건 |
| Convention Compliance | NONE | DTO 명명·JSDoc 분리·응답 래핑·CHANGELOG 형식 모두 규약 준수, INFO 1건(헬퍼 명명) |
| Plan Coherence | NONE | 상위 트래커와 plan 본문 서술 일치, 미해결 사안은 "planner 결정 선행"으로 명시 보류, INFO 2건 |
| Naming Collision | NONE | 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV·spec 파일 경로 도입 없음(기존 필드 타입만 nullable 확장) |

## 권장 조치사항
1. (BLOCK 사유 없음 — 즉시 조치 불요)
2. `--impl-done` 체크 완료 후 `plan/in-progress/patch-body-followups.md`를 `plan/complete/`로 이동해 `spec-draft-nullable-notation-followups.md`의 전방 참조를 유효화할 것.
3. (선택) `response-contract.ts`의 `contractForDto` 헬퍼를 요청 DTO 검증에도 쓰는 점을 캐너리 주석 한 줄로 명시하거나 중립적 이름(`schemaForDto`)으로 개명 검토.