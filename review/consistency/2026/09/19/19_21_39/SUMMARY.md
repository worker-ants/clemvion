# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 확보했고, CRITICAL·WARNING 판정은 없음.

대상: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` — 이번 라운드 신규 판정 대상은 **변경 F**(`spec/1-data-model.md` frontmatter `code:` 한 줄 예고 + Rationale «하지 않은 것» 한 줄 신설) 두 곳. 변경 A~E 는 이미 커밋 `c8dd613e0` 으로 spec 본문에 반영되었고 직전 `--spec`(18_56_41)·`--impl-prep`(19_11_16) 라운드에서 대조를 마쳤다.

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. rationale_continuity 가 자체적으로 LOW 로 판정(신규 전용 e2e 파일의 "전용 vs 기능" 경계가 이름만으로는 모호할 수 있다는 절차적 관찰), 나머지 4개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 신규 전용 e2e `webhook-endpoint-reservation.e2e-spec.ts` 가 이름만으로는 "전용(메커니즘) vs 기능(API) e2e" 경계가 모호 — 향후 이 파일에 서비스 레벨 409 시나리오 등이 곁들여지면 `1-data-model.md` Rationale 의 "기능 e2e 는 code: 에 넣지 않는다" 배제 원칙을 슬며시 침식할 위험 | 변경 F 첫 불릿 (`spec/1-data-model.md` frontmatter `code:` 추가 예고) | 변경 F 반영 시 `code:` 주석 또는 새 e2e 파일 상단에 "이 파일은 V133 마이그레이션 메커니즘(백필·DB 트리거)만 검증하며 서비스 레벨 기능 검증은 별도 e2e 가 맡는다"는 한 줄 스코프 고지 추가 |
| 2 | convention_compliance | `1-data-model.md` frontmatter `code:` 확장이 `spec-impl-evidence.md` §1 의 EXCLUDE_BASENAMES(`1-data-model.md` 는 build 가드 면제)와 표면적으로 긴장 관계 — 실제로는 "build 가드 면제 + 자율적 문서 위생 수동 유지"가 병존하는 기존 확립된 패턴(선례 `53335867a`)이라 위반 아님 | 변경 F 첫 항목 / `spec/conventions/spec-impl-evidence.md` §1 | target 수정 불요. `spec-impl-evidence.md` §1 또는 `1-data-model.md` code: 인접 주석에 "이 파일은 build 가드 면제지만 자체 관례로 code: 를 수동 유지한다"는 상호 참조 한 줄 추가(규약 문서 쪽 개선 권고, 차단 아님) |
| 3 | cross_spec | `data-flow/12-workspace.md` §2.1 워크스페이스 삭제 cascade 표에 `webhook_endpoint_reservation`(SET NULL) 신규 부수효과 미등재 | `spec/data-flow/12-workspace.md` §2.1 (draft 범위 밖) | 조치 불요 — 이 표는 애초에 workspace 참조 테이블 전체(~20여개)를 나열하지 않는 4개 핵심 sink 요약 문서이며, 이번 draft 가 새로 만든 갭이 아니라 기존 문서 스코프의 연장 |
| 4 | cross_spec | `spec/1-data-model.md` L1049 가 아직 `plan/in-progress/` 인 이 draft 를 `plan/complete/` 경로로 앞당겨 인용 — 지금 열면 착지하지 않음 | `spec/1-data-model.md` L1049 (변경 A Rationale 인접) | 조치는 draft 자신의 체크리스트("`plan/complete/` 이동 전 경로 인용 — 마무리에서 해소")에 이미 반영돼 있음, `--impl-prep`(19_11_16) 에서 이미 인지된 이월 항목이라 신규 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 변경 F 두 줄이 이미 반영된 A~E(§2.8.1 엔티티·409 에러 코드 통합·필드 매트릭스·삭제 다이얼로그·data-flow 흐름표) 및 참조 spec 어느 축에서도 모순 없음. `workspace_id SET NULL` 은 데이터 모델 유일 예외이나 draft 자신의 의도된 설계로 이미 Rationale 근거 있음 |
| Rationale Continuity | LOW | 과거 결정("삭제 시점 묘비" → "사용 시점 예약") 전환에 대한 새 Rationale 명시, DB 트리거 채택 근거가 V132 원칙(동시 경합은 DB 만 방어)과 정합. 기각된 대안 무단 재도입 없음. 유일한 절차적 제안은 신규 e2e 스코프 명확화 |
| Convention Compliance | NONE | 명명·에러코드 재사용·FK 표기·마이그레이션 V번호·앵커 링크 모두 기존 확립 패턴과 일치. `details.field='endpoint_path'` 스네이크케이스는 오히려 `api-convention.md §5.3` 의 정본 예시로 실측 확인(오탐 방지) |
| Plan Coherence | NONE | 변경 F 두 줄은 직전 `--impl-prep`(19_11_16) 이 남긴 선택적 INFO 를 정확히 그 방식대로 닫음. 새로 여는 미해결 결정 없음, 다른 in-progress plan 과 겹치는 항목 없음(전수 grep 확인), V133 번호 미선점 확인 |
| Naming Collision | NONE | 신규 식별자(엔티티/테이블/DB 트리거/제약 라벨/e2e 파일명/spec 헤딩 번호) 전수 grep 결과 기존 코드베이스·spec 어디에도 다른 의미로 선점된 동일 식별자 없음. 재사용 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 의도적 재사용으로 명시적 근거 있음 |

## 권장 조치사항

1. (선택, 비차단) 변경 F 반영 시 `webhook-endpoint-reservation.e2e-spec.ts` 상단 또는 `code:` 주석에 "메커니즘 전용, 기능 검증 아님" 스코프 고지 한 줄 추가 — 다음 사람이 이 파일에 기능 케이스를 얹어 배제 원칙을 침식하는 것을 예방.
2. (선택, 비차단) `spec-impl-evidence.md` §1 (또는 `1-data-model.md` code: 인접 주석)에 "build 가드 면제 + 수동 관례 병존" 상호 참조 한 줄 추가 — 다음 검토자의 재조사 비용 절감.
3. 위 두 항목 모두 BLOCK 사유가 아니므로, `--spec` 승인 및 이후 구현 착수를 막지 않음.
