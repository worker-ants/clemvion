# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 모두 전문 확보, 전원 CRITICAL 0건).

## 전체 위험도
**LOW** — 사실 정정 2건(§5.4 대기 시간, §6 절 번호)은 모든 checker 에서 문제 없이 확인됐으나, `plan_coherence` 가 관련 트래커 항목의 부분 해소가 반영되지 않은 WARNING 1건을 지적.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 트래커 항목 "4-integration.md 소소한 표기 두 건"(§6/§9.3 오기재 + §14.1 `HTTP_{status}` 혼용 두 하위 문제를 한 항목으로 등재)이 target 의 변경 B 로 §6/§9.3 부분만 해소되는데, 그 분리·축소가 target 체크리스트에 반영돼 있지 않음 | `plan/in-progress/spec-draft-integration-db-test-waits.md` §변경-B / «비대상» / 체크리스트 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "4-integration.md 소소한 표기 두 건" 미체크 항목 | target 체크리스트(또는 dev plan `integration-db-http-testers.md`)에 "해당 트래커 항목을 §14.1 단독 항목으로 축소(§6/§9.3 부분은 이 PR 로 해소돼 제거)" 명시 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "계약 vs 견고성 장치"(동시 실행 상한·닫기 상한을 spec 밖에 두는 판단 기준)가 아직 Rationale 에 명문 원칙으로 기록되지 않음 | target `## 비대상` 첫 항목 | 향후 유사 판단 재논의를 줄이기 위해 Rationale 에 "API 응답 계약을 바꾸지 않는 견고성 장치는 CHANGELOG 로 충분하다" 등 원칙 한 줄 추가 (차단 사유 아님) |
| 2 | convention_compliance | 인용 형식(`review-citations.md` §3)은 애초 `plan/**` 문서라 적용 대상 외이며, 설령 대상이었어도 최고 등급("전체 경로+날짜+지적 번호")을 이미 충족 | target `## 왜` §1·§2 | 조치 불필요 |
| 3 | convention_compliance | 대상 spec 인용(§5.4 원문, §6 괄호, §9.1/§9.3 실제 위치)이 `spec/2-navigation/4-integration.md` 실측과 정확히 일치, 병렬 stale §9.3 참조도 저장소 전체 grep 으로 추가 발견 없음 확인 | target `## 변경` A·B | 조치 불필요 — 실측 검증 통과 |
| 4 | convention_compliance | 참조만 하는 `INTEGRATION_INCOMPLETE` 코드가 `spec/conventions/error-codes.md` §1 의 기존 등재 예시·명명 규약과 일치 | target `## 변경` B | 조치 불필요 |
| 5 | plan_coherence | dev plan `integration-db-http-testers.md` 및 원조 draft `spec-draft-integration-connection-tests.md` 의 종결 체크리스트가 여전히 "spec draft" 단수를 가리킴 — 이제 마무리 커밋에서 함께 이동해야 할 draft 가 2개(원조 + target) | target 체크리스트 3항 vs `plan/in-progress/integration-db-http-testers.md` 종결 항목 | 마무리 커밋 시 두 spec draft 모두 체크박스 완료 후 `plan/complete/` 로 이동, 여유 있으면 dev plan 문구를 "두 spec draft" 로 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 두 정정 모두 같은 문서 내부 사실 정정이며, 데이터 모델·데이터 흐름·노드 spec·관련 컨벤션 전수 확인 결과 충돌·동반 갱신 필요 없음 |
| rationale_continuity | NONE | 기존 `## Rationale` 과 충돌 없음. §5.4 는 과거 미논의 공백을 메움(기각된 대안 재도입 아님), §6 은 기존 Rationale·표 위치와 정합. INFO 1건(경계 원칙 명문화 여지) |
| convention_compliance | NONE | 새 식별자·API·에러코드·문서구조 도입 없음. 인용 사실관계 실측 검증 통과, `INTEGRATION_INCOMPLETE` 명명도 기존 등재와 일치 |
| plan_coherence | LOW | 관련 트래커 항목의 부분 해소가 target 체크리스트에 미반영(WARNING 1건). 종결 체크리스트 단수 표현 관련 INFO 1건 |
| naming_collision | NONE | 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 도입 없음 — 검토 표면 자체가 없음 |

## 권장 조치사항
1. (WARNING 해소) target 체크리스트 또는 dev plan `integration-db-http-testers.md` 에 "`spec-draft-nullable-notation-followups.md` 의 '4-integration.md 소소한 표기 두 건' 항목을 §14.1 단독 항목으로 축소(§6/§9.3 부분은 이 PR 로 해소돼 제거)" 를 명시적으로 추가.
2. (선택) 마무리 커밋 시 `spec-draft-integration-connection-tests.md` 와 `spec-draft-integration-db-test-waits.md` 두 spec draft 모두의 남은 체크박스를 채우고 함께 `plan/complete/` 로 이동.
3. (선택) target 이 spec 에 반영될 때 Rationale 에 "계약 vs 견고성 장치" 판단 기준 한 줄 추가.
