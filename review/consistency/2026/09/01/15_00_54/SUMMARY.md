# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 spec 충돌·규약 위반 없음. `resource_type` 라벨의 open-string+클램핑 설계가 `9-observability.md` Rationale 의 "닫힌 집합 유지" 원칙과 문면상 긴장이 있으나 `error_code` 선례로 정당화되고(실측 확인), plan 트래커 갱신 하나가 누락 상태.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `resource_type` 의 open-string+클램핑 설계 정당화가 원 원칙의 출처 문서(`9-observability.md` Rationale)가 아니라 파생 카탈로그(`_product-overview.md`)에만 기록되어, "닫힌 집합 유지" 원칙과 그 예외(`error_code`/`resource_type`)의 관계가 한 곳에서 완결되지 않음 | 변경안 A-2/A-3 | `spec/data-flow/9-observability.md` Rationale "`clemvion.redis.fail_open` 의 `component`…" 문단 | `9-observability.md` 해당 Rationale 끝에 "이 원칙은 코드 유니온이 있는 라벨에 적용되며, 시그니처가 이미 `string` 인 라벨(`error_code`/`resource_type`)은 클램핑으로 방어한다(→ NF-OB-07 참조)" 교차 참조 추가. 또는 A-3 에 "9-observability.md 원칙 문장은 별도 갱신하지 않는 의도적 생략" 한 줄 명시 |
| 2 | plan_coherence | `login_history` 카운터 후속 항목을 두 번(§C, Rationale) "등재한다"고 명시하나 실제 등재 안 됨. `plan/in-progress/spec-sync-auth-gaps.md` 에 바로 이 결정을 가리키는 기존 미체크 항목(`- [ ] 적재 실패 카운터/알림 도입 여부 결정 — 전 producer 공통이라 별도 트랙`)이 이미 있는데 target 이 이를 인지·연결하지 않음 | §C "`login_history` 쪽을 이번에 넓히지 않는 이유", `## Rationale`→"기각한 대안" 첫 항목 | `plan/in-progress/spec-sync-auth-gaps.md` 의 해당 체크박스 | target 적용(spec 커밋)과 같은 턴에 `spec-sync-auth-gaps.md` 체크박스를 (a) `audit_log` 축 결정 완료로 좁히고 (b) `login_history` 카운터 도입 여부를 새 하위 체크박스로 등재. target 문서/커밋 메시지에 등재 위치 링크 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Overview 의 "규칙" 인용이 `9-observability.md` Rationale 원문(`redis.fail_open` 라벨 한정)보다 넓게 일반화됨 | Overview 2번째 단락 | "카탈로그가 SoT" 원칙 인용으로 좁히거나 `redis.fail_open` 사례 한정임을 명시 |
| 2 | cross_spec | `login_history` "후속 항목 등재" 구체 위치 미지정 (plan_coherence WARNING #2 와 동일 사안, 상위 등급으로 통합 반영됨) | 변경안 C | `plan/in-progress/` 구체 트래커 지목 |
| 3 | convention_compliance | `resource_type` 라벨 명명·표기(dot 표기, snake_case, "실측 12종")가 코드 실측과 정확히 일치, 규약 준수 확인 | A-2, A-3 | 없음 — 준수 |
| 4 | convention_compliance | 문서 구조(3섹션)·frontmatter·anchor 슬러그 모두 SKILL/convention 규칙과 일치 | 파일 전체 | 없음 — 준수 |
| 5 | naming_collision | `clemvion.audit.write_failed`, 라벨 `resource_type` 신규 식별자 전수 검색 결과 타 도메인과 충돌 없음, 코드 선행 구현과 이름 일치 | 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3개 target 파일 라인 앵커까지 실제 파일과 일치, 데이터 모델·AlertRule·다른 영역 서술과 충돌 없음. INFO 2건(인용 정밀도, 후속 등재 위치) |
| rationale_continuity | LOW | 대부분 결정이 기존 Rationale 과 정합. `resource_type` open-string 정당화가 원칙 출처 문서가 아닌 파생 문서에만 기록되는 연속성 공백 (WARNING) |
| convention_compliance | NONE | 명명·문서구조·frontmatter·anchor 전부 규약 준수. 코드 실측과 draft 서술 정확히 일치 |
| plan_coherence | LOW | 기술적으로 견고, spec 라인 인용 정확. `login_history` 후속 등재 약속이 기존 plan 체크박스와 연결되지 않는 갭 (WARNING) |
| naming_collision | NONE | 신규 식별자 2개(`clemvion.audit.write_failed`, `resource_type`) 전수 검색 충돌 없음, 구현과 이름 일치 |

## 권장 조치사항
1. `plan/in-progress/spec-sync-auth-gaps.md` 의 관련 체크박스를 target spec 커밋과 같은 턴에 갱신 — `audit_log` 축 완료 반영 + `login_history` 신규 하위 체크박스 등재 (WARNING #2 해소).
2. `spec/data-flow/9-observability.md` Rationale 에 "닫힌 집합 유지" 원칙의 예외(시그니처가 이미 `string` 인 라벨은 클램핑 방어)를 한두 문장으로 교차 참조 추가 (WARNING #1 해소).
3. (선택) Overview 의 "규칙" 인용 범위를 `redis.fail_open` 사례로 좁히거나 "카탈로그=SoT" 원칙 인용으로 대체 (INFO #1).

이상 두 WARNING 모두 target 채택을 막을 사유는 아니며(BLOCK: NO), 다음 편집 턴에서 반영 권장.