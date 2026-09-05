# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음 (cross_spec: WARNING 2·INFO 1 / convention_compliance: INFO 1 / rationale_continuity·plan_coherence·naming_collision: 발견 없음)

## 전체 위험도
**MEDIUM** — cross_spec 이 지적한 두 문서 간 상호 링크 미비(SoT 재해석 미동기화, DROP-먼저 패턴과 구 서술 캐비엇 부재)가 가장 높은 등급이며, 빌드/가드를 깨뜨리지는 않는 문서 정합성 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `code:` 필드를 "구현 경로"가 아닌 "준수 예시"로 재해석하면서 SoT 문서(`spec-impl-evidence.md`)를 갱신하지 않음 | `spec/conventions/review-citations.md` `## Rationale` (`### code: 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유`) | `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의(`code:` = "구현 경로") + R-1 | `spec-impl-evidence.md` §2.1/R-1 에 "시행 코드 없는 순수 문서형 convention" 예외 각주 추가 + `review-citations.md` 양방향 링크 |
| 2 | cross_spec | 신설 "인덱스 교체는 DROP-먼저" rerun-안전 규약이, 같은 V056 마이그레이션을 캐비엇 없이 서술하는 기존 spec 과 상호 링크되지 않음 | `spec/conventions/migrations.md` §5 신규 문단 → `codebase/backend/migrations/README.md` §5 | `spec/data-flow/8-notifications.md` (V056 CREATE→DROP 순서를 정상 절차처럼 서술) | `data-flow/8-notifications.md` 해당 문단에 각주 1줄 — "신규 인덱스 교체는 `migrations.md`/`README.md` §5 DROP-먼저 패턴 따를 것(본 문단의 V056 은 그 패턴 도입 이전)" |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `review-citations.md` §3 적용 범위 표가 `spec/**` 문서 자체를 다루지 않음 (실측 위반 사례는 없음) | `spec/conventions/review-citations.md` §3 표 | §3 표에 `spec/**` 행 추가(적용 — `codebase/**` 와 동일 논리) |
| 2 | convention_compliance | README.md 내부 cross-reference `"§인덱스 교체"` 가 문서 자체의 숫자 전용 `§<번호>` 관례에서 벗어남 (heading 아닌 볼드 텍스트라 앵커 없음) | `codebase/backend/migrations/README.md:127` | `§인덱스 교체` → `아래`/`같은 절(§5)` 로 수정하거나 실제 `####` 헤딩 부여 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | WARNING 2건(`code:` 재해석 SoT 미동기화, DROP-먼저 패턴과 `8-notifications.md` V056 서술 캐비엇 부재) + INFO 1건(§3 표 `spec/**` 미포함) |
| rationale_continuity | NONE | 직전 라운드(09_53_09) INFO 2건 반영 확인, 신규 발견 없음 |
| convention_compliance | LOW | 직전 두 라운드(09_13_39·09_53_09) 지적 전부 반영 확인(회귀 없음), INFO 1건(README 내부 `§` 표기 관례 이탈) |
| plan_coherence | NONE | target 전부가 `spec-draft-nullable-notation-followups.md` 트래커에 사전 등재된 항목과 일치, 미결정 항목(Flyway mixed=true, bare 인용 8건)도 defer 유지 확인 |
| naming_collision | NONE | 신규 식별자(frontmatter id, 파일 경로, 인덱스명 등) 전수 확인 결과 충돌 없음 |

## 권장 조치사항
1. `spec/data-flow/8-notifications.md` 해당 문단에 DROP-먼저 패턴 참조 각주 추가 (WARNING #2 해소).
2. `spec/conventions/spec-impl-evidence.md` §2.1/R-1 에 "시행 코드 없는 문서형 convention" 예외 각주 + `review-citations.md` 상호 링크 (WARNING #1 해소).
3. (선택) `review-citations.md` §3 표에 `spec/**` 행 추가, README.md `§인덱스 교체` 표기 정정 — 가독성 수준의 INFO, 조치 없어도 무방.
