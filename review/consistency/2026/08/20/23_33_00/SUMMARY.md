# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 Critical 없음. WARNING 2건은 BLOCK 사유 아님(규약상 Critical만 차단).

## 전체 위험도
**MEDIUM** — Critical 없음. cross_spec 이 지적한 §R17 "재제출 경로 한정" 범위 서술과 Manual JSON 에디터 실사용 범위 불일치가 최고 등급(WARNING)이며, 나머지는 프로세스성 리스크(WARNING 1) 또는 정보성.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | "재제출 경로 한정" 범위 서술이 실제 엔드포인트 사용 범위와 어긋난다 — `POST /workflows/:id/execute` 는 재제출 전용이 아니라 Manual 실행 전체(자유 JSON 직접 편집 포함)의 단일 진입점이며, 값 출처(히스토리 재적재 vs 신규 타이핑)를 구분할 플래그가 없다. 사용자가 필드 값으로 정확히 `***`/`[REDACTED]` 등을 의도적으로 입력하면 재제출과 무관하게 `400 MASKED_VALUE_RESUBMITTED` 로 거부되어, §R17 스스로 세운 "출처 판정" 원칙(webhook/schedule 을 리터럴 값이 정상일 수 있다는 이유로 제외한 논거)과 어긋난다 | `spec/5-system/14-external-interaction-api.md` §R17 "서버 (재제출 API)" 행 + "가드의 범위 — 재제출 경로 한정" 캐비엇 | `spec/3-workflow-editor/3-execution.md` §2.2 "JSON 에디터" 행 · `spec/4-nodes/7-trigger/0-common.md:30` · `spec/data-flow/10-triggers.md:13` | (a) 서버 거부를 진짜 재제출 신호(예: 프런트가 "히스토리에서 로드됨" 플래그 전달, 서버는 그 경우만 검사)로 좁히거나, (b) 범위를 "Manual 실행 경로 전체(fresh 입력 포함)"로 있는 그대로 정정하고 3-execution.md "JSON 에디터" 행에 리터럴 마커 문자열 입력 불가 제약을 명시. (b) 선택 시 §R17 "출처의 성질" 논거 문장도 Manual 쪽엔 적용 안 됨을 인정하도록 수정 |
| 2 | convention_compliance | `status: implemented` 5개 위성 문서에 미구현 서버측 약속(`MASKED_VALUE_RESUBMITTED`)이 `pending_plans` 없이 얹혔다 — SoT 문서(`14-external-interaction-api.md`)만 `status: partial`+`pending_plans` 로 미구현을 정직 신호하고, 나머지 5곳은 frontmatter 만으로는 갭이 드러나지 않는다(`spec-impl-evidence.md` R-5 경고 형태와 동일) | `spec/5-system/3-error-handling.md` §1.3·§1.7 / `spec/5-system/13-replay-rerun.md` §8.1·§10.2 / `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 / `spec/1-data-model.md` `input_data` 행 / `spec/3-workflow-editor/3-execution.md` 히스토리 로드 행 | `spec/5-system/14-external-interaction-api.md`(SoT, `status: partial`+`pending_plans: plan/in-progress/spec-sync-external-interaction-api-gaps.md`) | (a) 5개 문서에 임시로 `pending_plans: plan/in-progress/spec-draft-inputoverride-marker-reject.md` 추가 + `status: partial` 로 격하 후 구현 커밋에서 되돌리거나, (b) 같은 worktree 세션 내 spec→impl 연속 커밋이 확실하면 `spec-impl-evidence.md` 에 짧게 예외 명문화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `masked_value_resubmitted` 내부 분류 문자열이 자매 문서(`error-handling.md` §1.7, `webhook.md` §5.2)엔 있는데 manual-trigger.md 응답 봉투 문장에만 누락 | `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 "응답 봉투" 단락 | 내부 분류 문자열 목록에 `masked_value_resubmitted` 추가해 자매 문서와 동기화 |
| 2 | convention_compliance | 신설 `masked_value_resubmitted` 표 행의 볼드 밀도가 형제 행과 다름(강제 규약 아님, 의도된 강조로 보임) | `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러 코드 표 | 강제 아님. 의도된 강조라면 유지 |
| 3 | naming_collision | `INVALID_INPUT` 의 `details[].code` 카탈로그를 "§1.7"(제목상 "Webhook 수신 에러 코드")로 참조하는 기존 명명 관성 재확인 — 이 diff 가 만든 게 아니라 기존 패턴을 re-run 소비처로 확장한 것 | `spec/5-system/13-replay-rerun.md` §8.1 · `spec/5-system/3-error-handling.md` §1.3 | 정보용 기록만, 조치 불요(cross_spec/convention_compliance 관점의 섹션 표제-범위 정합성 이슈이지 명명 충돌 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §R17 "재제출 경로 한정" 범위가 Manual JSON 에디터 자유편집 실사용 범위와 불일치(WARNING) + manual-trigger.md 내부분류문자열 누락(INFO) |
| rationale_continuity | NONE | 기각된 대안(코드 재사용·부분매칭) 재도입 없음, 합의 원칙(rename-stability·egress-only 마스킹·round-trip 축) 위반 없음, 카브아웃 폐쇄 결정에 새 Rationale 동반 |
| convention_compliance | LOW | 명명(`MASKED_VALUE_RESUBMITTED` UPPER_SNAKE_CASE)·응답 봉투 포맷·문서 구조 규약 전부 준수. 5개 위성문서 `status: implemented`+`pending_plans` 부재(WARNING) |
| plan_coherence | NONE | plan(`spec-draft-inputoverride-marker-reject.md`) 선언 "spec 변경 7곳(+선택 1)" 전항목 반영 확인, 트래커 W6 상태("spec 완료·구현 대기") 정합 |
| naming_collision | NONE | 신규 식별자 `MASKED_VALUE_RESUBMITTED`(및 `masked_value_resubmitted`) 1개, repo 전체 grep 결과 충돌 없음 |

## 권장 조치사항
1. (WARNING 우선) §R17 서버측 거부 범위를 Manual JSON 에디터 자유편집 케이스까지 고려해 재정의 — "출처 판정" 원칙과 실제 엔드포인트 사용 범위를 정합시킨다 (cross_spec WARNING #1).
2. 5개 위성 문서의 `spec-impl-evidence.md` frontmatter 정합 — `pending_plans` 추가 또는 status 격하, 혹은 같은 세션 내 구현 연속 진행을 규약에 명문화 (convention_compliance WARNING #2).
3. `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 내부 분류 문자열 목록에 `masked_value_resubmitted` 추가해 자매 문서와 동기화 (cross_spec INFO #1).
4. (선택) 신설 표 행의 볼드 스타일을 형제 행과 맞출지 판단 — 강제 아님 (convention_compliance INFO #2).
