# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 모두 CRITICAL/WARNING 없음. 전문 확보 못 한 checker 없음(5/5 인라인 전문 확보, 디스크 파일도 모두 기존재 확인).

## 전체 위험도
**LOW** — 순수 OpenAPI 설명 문자열 리팩터(spec 델타 0)로 규약·Rationale·plan 교차 참조가 전부 일치하며, 남은 것은 plan 자신이 이미 추적 중인 마무리 절차(트래커 닫기·`plan/complete/` 이동)뿐이다.

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
| 1 | Cross-Spec / Convention Compliance | 이음 구두점(` 또는 ` vs `, 또는 `) 결정 근거가 spec Rationale 이 아니라 코드 JSDoc 에만 있음 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` `forbiddenWithService` JSDoc | 조치 불필요 — `--impl-prep` INFO2 로 이미 처분된 의도적 선택(헬퍼를 쓰는 사람이 읽는 자리). 향후 §5-4 개정 시에만 spec Rationale 승격 고려 |
| 2 | Plan Coherence | 마무리 절차 잔여 2건 미완료 — `spec-draft-nullable-notation-followups.md` L5077 트래커 항목 미닫힘, `forbidden-helper-sentences.md` 의 `plan/complete/` 미이동 | `plan/in-progress/forbidden-helper-sentences.md` 체크리스트, `plan/in-progress/spec-draft-nullable-notation-followups.md` L5077 | 새 조치 불필요 — plan 체크리스트가 이미 순서를 명시. 단 `integration-personal-owner-followup.md` 가 `plan/complete/forbidden-helper-sentences.md` 경로를 선행 인용 중이므로 마무리 커밋에서 이동을 빠뜨리면 그 인용이 거짓이 됨 |
| 3 | Naming Collision | 신규 식별자 `forbiddenWithService` 가 `spec/conventions/swagger.md` §5-4 본문에 아직 이름으로 등장하지 않음(추상도 차이, 충돌 아님) | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:47` vs `spec/conventions/swagger.md:511` | 조치 불필요 — plan 이 의도적으로 남긴 gap. 다음에 §5-4 편집할 사람이 세 번째 헬퍼로 언급하면 코드-스펙 이름 미러가 더 촘촘해짐(planner 소관) |
| 4 | Naming Collision | `FORBIDDEN_` 접두 식별자 군집이 저장소에 이미 다수 존재(403 설명 상수 vs `FORBIDDEN_HEADER_NAMES` 차단 헤더 집합) — 의미·모듈·타입이 달라 실제 충돌 아님 | `integrations.controller.ts` 등 vs `modules/mcp/mcp-client.service.ts:198` | 조치 불필요 — 관찰만. 이 PR 이 새로 만든 군집도 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 라우트 가드·에러 코드·RBAC 값 불변, `swagger.md` §5-4·`12-workspace.md`·`13-replay-rerun.md`·`0-overview.md` 와 모두 일치 |
| Rationale Continuity | NONE | 기각 대안 재도입·무근거 번복 없음. 구두점 변경은 "우연한 불일치의 정리"이며 새 근거를 JSDoc 에 즉시 성문화 |
| Convention Compliance | NONE | §5-4 규약(헬퍼 사용·이음 방식)을 13곳 전부에서 정확히 따름. 명명·export·저장소 가드 판정과도 충돌 없음 |
| Plan Coherence | LOW | 트래커(`spec-draft-nullable-notation-followups.md`)·후속 plan(`integration-personal-owner-followup.md`)과 diff 가 정확히 일치하나, 마무리 이동(트래커 닫기·`plan/complete/`)이 아직 미완료 |
| Naming Collision | NONE | 신규 식별자는 `forbiddenWithService` 하나뿐이며 저장소 전체에 이름 충돌 없음. spec 미기재는 추상도 차이일 뿐 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 마무리 커밋에서 두 가지를 함께 처리: (a) `plan/in-progress/spec-draft-nullable-notation-followups.md` L5077 항목에 닫힘 주석을 달고 체크, (b) `plan/in-progress/forbidden-helper-sentences.md` 를 `plan/complete/` 로 이동 — `integration-personal-owner-followup.md` 의 선행 인용을 유효하게 유지하기 위함.
2. (선택, 낮은 우선순위) 다음에 `spec/conventions/swagger.md` §5-4 를 편집할 사람은 `forbiddenWithService` 헬퍼명과 이음 구두점 근거를 spec Rationale 로 승격하는 것을 고려(현재는 코드 JSDoc 에만 있고, 이는 의도된 층위 분리).
