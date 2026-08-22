# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. WARNING 1건(§3 Rationale 미러링 이탈 답습)은 착수를 막을 사유가 아님.

## 전체 위험도
**LOW** — 두 spec 편집(401 코드명 정정, swagger.md §3 예외 양방향 확장) 모두 기존 정본 식별자·기존 관행을 문서에 뒤늦게 반영하는 drift 정정으로, 실측 재검증(코드 라인·grep 건수·git log -S) 결과 전 항목 일치. 유일한 WARNING 은 swagger.md 자신의 "본문=규칙/`## Rationale`=근거" 이중 구조 관행에서 벗어난 기존 이탈(target 이전부터 존재)을 target 이 답습한다는 구조적 지적.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | §3 예외 확장 제안이 swagger.md 자신이 다른 5개 결정(§0/§1-4/§5/§5-4)에서 지키는 "본문=규칙 / `## Rationale`=근거" 이중 구조에서 벗어난 기존 이탈(2026-08-17 원본부터 이미 없었음)을 그대로 답습 | `plan/in-progress/spec-draft-swagger-401-drift.md` ② 제안 diff (라인 100-115) | `spec/conventions/swagger.md` §0/§1-4/§5/§5-4 의 `## Rationale` 미러링 관행 | 제안 diff 에 `## Rationale` 쪽 "### §3 보안·정책 캐비엇 예외 — 양방향 확장 (2026-08-22)" 서브섹션을 신설해 근거(9곳 실측·요청측 34%/114개 실측·양방향 대칭 논거)를 옮기고 본문 blockquote 는 규칙+요약만 남길 것. 의도적으로 이 구조 밖에 두기로 한 것이면 그 사실을 target 에 1줄 명시 |

> 참고 — rationale_continuity checker 도 동일 지점을 발견했으나 "target 이 새로 만든 drift 가 아니라 선존 패턴 답습" 이라는 근거로 INFO 등급을 매겼다(하향 아님 — 별개 checker 의 독립 판정). 본 통합 보고서는 §요약 지침 3 "하향 금지" 에 따라 convention_compliance 의 등급(WARNING, 근본 이유는 동일하나 등재된 등급이 더 강함)을 채택한다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | ① 401 코드명 정정 — `UNAUTHORIZED` spec 전역 정확히 2곳(같은 파일), `AUTH_REQUIRED` 는 이미 타 spec·런타임에서 표준 | `13-replay-rerun.md:240,269` | 조치 불요, 그대로 진행 가능 |
| 2 | cross_spec | ② swagger.md §3 예외 확장 — `MASKED_VALUE_RESUBMITTED` 는 이미 EIA §R17 SoT·타 spec 문서·코드 JSDoc 에 안정적으로 등재됨 | `spec/conventions/swagger.md:260-267` | 조치 불요. 기본 수치 규칙(10~40자) 재검토는 별도 트래커 항목으로 계속 분리 유지 |
| 3 | rationale_continuity | ① "오기 정정 vs rename" 분류 판단 근거를 `1-data-model.md`·`2-api-convention.md` 의 "문서 정직화" 선례와 1줄 교차 인용하면 왕복 감소 | target §① | 선택 사항, 필수 아님 |
| 4 | rationale_continuity | ③ "기본 수치 규칙 재검토는 범위 밖" 결정이 `3-error-handling.md`·`2-api-convention.md §1.9` 의 "범위 한정" 관행과 정합 | target "넓히지 않는 것" | 조치 불요, 원칙 준수 사례로 기록할 만함 |
| 5 | convention_compliance | 제안 diff 코드펜스가 동일 문서군(`spec-draft-*.md`) 선례(````diff````) 대신 ````text```` 사용 | 라인 41, 80 | ````text```` → ````diff```` 로 통일 |
| 6 | convention_compliance | "요청 DTO 파일 73개 · description 333개" 집계 기준(대상 디렉토리 패턴 등)이 문서에 명시되지 않음 — 개별 필드 값은 100% 재현 확인됨 | ② 표 (라인 89-94) | 집계 기준을 표 옆에 1줄 부기 |
| 7 | plan_coherence | target 이 집행하는 두 항목은 정본 트래커 `spec-sync-external-interaction-api-gaps.md:989-998, 1000-1016` 의 미해결 항목과 문자 그대로 일치 — 우회 없음 | target 전체 | 조치 불요. 작업 완료 시 tracker 체크박스 `:989`, `:1000` 플립 |
| 8 | plan_coherence | 배치 3번째 항목(`POST /workflows/:id/execute` body DTO 승격)이 developer 턴으로 미뤄졌으나 tracker `:900-907` 에 별도 등재돼 orphan 아님 | target 도입부 blockquote | 조치 불요 |
| 9 | plan_coherence | swagger.md 관련 다른 in-progress plan 들(§1-4/§2-4/§5-1/§5-4)과 target 의 §3 편집 섹션 충돌 없음 | target ② | 조치 불요 |
| 10 | naming_collision | 두 편집 모두 신규 식별자 도입 없음 — `AUTH_REQUIRED`·`MASKED_VALUE_RESUBMITTED` 둘 다 기존 정본 식별자의 사후 반영 | target 전체 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 두 편집 모두 실측 완전 일치, 교차 충돌 없음 |
| rationale_continuity | LOW | 기각된 대안 재도입 없음. swagger.md §3 Rationale 미러 부재는 선존 패턴 답습(INFO 등급 부여) |
| convention_compliance | LOW | §3 Rationale 미러링 이탈 답습(WARNING) + 코드펜스 태그·집계 기준 미부기(INFO 2건). 명명·안정성 규약 위반은 없음 |
| plan_coherence | NONE | 정본 트래커 항목을 문자 그대로 이행, 우회·중복 등재·orphan 없음 |
| naming_collision | NONE | 신규 식별자 도입 자체가 없음, 충돌 없음 |

## 권장 조치사항
1. (선택, WARNING 해소) swagger.md 제안 diff 에 `## Rationale` "### §3 …" 서브섹션 신설 — 근거를 본문에서 이관.
2. (선택, INFO) 제안 diff 코드펜스 ` ```text ` → ` ```diff ` 로 통일 (라인 41, 80).
3. (선택, INFO) "요청 DTO 73개 · description 333개" 집계 기준 1줄 부기.
4. target 작업은 그대로 착수 가능 — BLOCK 사유 없음.