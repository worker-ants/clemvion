# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 없음)

## 전체 위험도
**MEDIUM** — 구조적 충돌·명명 충돌은 0건이나, 로그 테이블 두 곳의 쓰기 비용 실측 누락이 target 자신이 이관하려는 선행 Rationale 의 방법론 합의("따로 잰다")를 충족하지 못한 채 추론으로 대체됐다는 점이 2개 checker(cross_spec, rationale_continuity)에서 독립적으로 지적됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `integration_usage_log`/`llm_usage_log` 네 인덱스의 쓰기 비용이 "추론"이며, target 이 그대로 이관하려는 같은 문서의 선행 Rationale("Trigger `(workflow_id)` 인덱스" 절 "같은 클래스 전수" 문단)이 로그 테이블 인덱스는 쓰기 비용을 **따로 잰다**고 명시적으로 예고한 실측 요건을 충족하지 못함 | target `## 실측 > 쓰기 비용`, `## 변경안` S1(V113~V116), `## Rationale > 왜 llm_usage_log 두 인덱스만 partial 인가` | `spec/1-data-model.md` `## Rationale > ### Trigger (workflow_id) 인덱스 (2026-09-18)` "같은 클래스 전수" 문단 — "INSERT 가 잦은 테이블에 인덱스를 더하는 것은 쓰기 비용과 맞바꾸는 판단이라 **따로 잰다**" | (a) `node_execution` 과 동일 절차(10만 행 INSERT×5, 인덱스 있음/없음 median)로 두 로그 테이블 실측을 추가하거나, (b) 추론으로 충분하다는 판단 근거(외부 I/O 호출 1회당 1행이라 상대 비중이 작음)를 `## Rationale`(S3, "삭제 연쇄의 FK 인덱스 다섯" 절)에 명시적으로 옮겨 적어 "측정 대신 추론으로 충족했다"를 선언. `## 실측` 절에만 있는 disclosure 를 S3 spec 이관 시 누락하지 않는 것이 최소 조치 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 캔버스 노드 삭제의 `node_execution` CASCADE 가 "실행 이력 보존" 원칙(`spec/2-navigation/2-trigger-list.md` §2.1, 트리거 삭제는 SET NULL)과 대비되나 target 은 이미 정확히 비대상 처리, 상호 참조만 없음 | target `## 비대상` 표 3번째 행 | 필수 아님 — 이 비대상 항목을 후속 트래커 항목으로 승격할 때 대비 근거로 §2.1 인용 |
| 2 | cross_spec | `spec/data-flow/5-integration.md` S4 삽입 앵커가 셀 전체가 아니라 셀 앞부분만 지정(다른 두 파일은 셀 끝을 앵커로 사용) | target `## 변경안 > S4` 2번째 불릿 | 실질 영향 없음(grep 으로 유일 특정) — developer 턴에서 최종 셀 값 자연스러움만 확인 |
| 3 | rationale_continuity | 새 Rationale 절(S3)이 "부모를 둘로 한정했다"는 스코프 차이만 언급하고, 선행 절이 `integration_usage_log` 를 콕 집어 "따로 잰다"고 예고한 사실 자체는 인용하지 않음 | target `## 변경안 > S3`, `## Rationale > 왜 범위를 트래커 항목보다 넓혔나` | S3 또는 새 Rationale 절에 "선행 절이 예고한 별도 검토가 이 PR" 한 문장 추가 — 위 WARNING #1 과 한 곳에서 추적 가능하게 |
| 4 | convention_compliance | 마이그레이션 로컬 검증 스텝(`check-migration-versions.py`)이 체크리스트에 별도 항목으로 명시되지 않음(CI 가 대신 강제하므로 머지 차단 아님) | target `## 체크리스트` | 선택: `python3 scripts/check-migration-versions.py --base origin/main` 를 별도 항목으로 명시 |
| 5 | convention_compliance | 인덱스 명명 패턴(`idx_<table>_<column>`)이 target 은 선례와 정확히 일치하나 이 패턴 자체가 `spec/conventions/migrations.md` 에 성문화돼 있지 않음(target 결함 아님, 규약 문서 쪽 갭) | 해당 없음 (참고 사항) | 조치 불필요 — 원하면 별도 planner 턴에서 `migrations.md` 에 명명 규칙 절 추가 |
| 6 | plan_coherence | 트래커 반영 문구가 "전제 정정으로 갱신"이라고만 서술, 교체될 정확한 문구는 구현 시점 재량(선례와 동일한 관례) | target `## 트래커 반영` | 구현 커밋에서 트래커 갈아 끼울 때 존치하기로 한 다섯 항목(`alert_rule.workflow_id` 등)이 누락되지 않도록 확인 |
| 7 | naming_collision | 신규 Rationale 절과 기존 «Trigger `(workflow_id)` 인덱스» 절이 같은 날짜(2026-09-18) 타이틀을 공유(제목 문자열 자체는 다름, 충돌 아님) | `spec/1-data-model.md` 신규 절 vs :959 기존 절 | 조치 불요 — 소재가 이미 제목으로 구분됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 실측 수치·신규 식별자 전수 일치 확인, 유일 지적은 로그 테이블 쓰기비용 실측 누락(WARNING) |
| rationale_continuity | MEDIUM | 선행 Rationale 이 요구한 "따로 잰다" 실측을 추론으로 대체(WARNING), 나머지 방법론(단독 컬럼 정당화, partial index nullable 조건, 소급 미수정)은 충실 준수 |
| convention_compliance | NONE | frontmatter/문서구조/마이그레이션 절차/명명/V번호/spec 표 서식 전부 선례(V111) 대조 일치, 위반 없음 |
| plan_coherence | NONE | 선행 트래커 여섯 항목 대조 일치, 다섯 항목 존치 확인, 선행 조건(V111 머지) 충족, 신규 식별자 충돌 없음 |
| naming_collision | NONE | 마이그레이션 버전·인덱스명·파일경로·앵커 텍스트 전수 grep 0건, 실질 충돌 없음 |

## 권장 조치사항
1. (BLOCK 무관, 우선 권장) `integration_usage_log`/`llm_usage_log` 쓰기 비용을 `node_execution` 과 동일 절차로 실측해 표에 추가하거나, 추론으로 대체한다는 판단과 근거를 `## Rationale` S3 절(spec 이관본)에 명시적으로 남긴다 — `## 실측` 절의 disclosure 가 spec 본문 이관 시 누락되지 않게 할 것.
2. S3/새 Rationale 절에 "선행 «Trigger `(workflow_id)`» 절이 예고한 `integration_usage_log` 별도 검토가 이 PR" 한 문장을 추가해 WARNING #1 근거와 연결한다.
3. (선택) 체크리스트에 `check-migration-versions.py` 실행을 별도 항목으로 명시.
4. 트래커 반영 시 존치하기로 한 다섯 항목(`alert_rule.workflow_id` 포함)이 새 문구에서 누락되지 않는지 구현 커밋에서 확인.
