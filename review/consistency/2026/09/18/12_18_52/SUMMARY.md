# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, WARNING 0건)

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL/WARNING 없이 통과, INFO 6건만 존재(대부분 사전 존재 갭 인지 또는 문구 보강 제안)

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `notification_health` 부분 인덱스가 `spec/1-data-model.md` §3 인덱스 전략 표에 이미 누락(target 도입 아닌 사전 존재 갭, V061 이후 미등재) | `spec/1-data-model.md` §3, Trigger 행 | S1 편집 시 해당 행도 함께 추가하거나 최소한 트래커에 별도 등재 |
| 2 | cross_spec | S2 Rationale 이 인용할 `integration_oauth_state`/`integration_oauth_preview` 가 `spec/1-data-model.md` 자체에는 엔티티로 미등재(스키마 SoT는 `data-flow/5-integration.md`) | `spec/1-data-model.md` `## Rationale` 신설 절 | 두 테이블 언급 시 `[data-flow/5-integration.md §2.1]` 링크 동행 (신규 등재 불요) |
| 3 | rationale_continuity | `V106 형태`(단일 CREATE, 짝 DROP 없음) 채택이 최신 선례 V110(3문장 DROP-먼저 패턴)과 다른 이유가 draft 에 명시돼 있지 않음 (README §5 스코프상 정당하나 미래 리뷰어 재지적 소지) | `## 구현` 섹션 / V111 마이그레이션 | S2 또는 V111 파일 주석에 "교체가 아닌 신규 추가라 README §5 DROP-먼저 대상 아님(V106 과 동일 분류)" 한 줄 추가 |
| 4 | convention_compliance | "새 식별자 grep 0건" 주장의 스코프 미명시 — 실제로는 `review/code/2026/09/17/19_14_29/*.md` 에 제안 문구로 이미 등장(정상, draft 가 그 제안을 실행하는 것) | `## 구현` 섹션 첫 불릿 | "실제 코드/마이그레이션 기준 grep 0건(제안 단계 review 문서 언급 제외)"으로 스코프 한 단어 명시 |
| 5 | plan_coherence | 신규 트래커 항목("선두 인덱스가 없는 여섯")이 draft 자체에만 존재, `spec-draft-nullable-notation-followups.md` 파일에는 아직 미반영 | `## 트래커 반영` | 체크리스트 마지막 항목이 커버 — 별도 조치 불요, 구현 PR 완료 시점까지 반영 여부만 추적 |
| 6 | naming_collision | `V111` 마이그레이션 번호는 현재 grep 0건으로 다음 순번이 맞으나, 병렬 세션이 동시에 `V111` 을 먼저 잡을 수 있는 구조적 race 존재 | `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` | 구현 착수 직전 재확인 권장 (`spec/conventions/migrations.md` 가 다루는 일반적 머지 race 안전망 범주) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | S1~S3 삽입 위치·문구가 실제 spec 원문과 정확히 일치. INFO 2건(사전 존재 인덱스 미등재 갭, Rationale 상호참조 링크 부재) |
| rationale_continuity | NONE | 세 축(Schedule 인덱스 원칙, select 투영 패턴, README §5 DROP-먼저 스코프) 모두 정합. INFO 1건(V110 대비 패턴 차이 사유 미기재) |
| convention_compliance | NONE | 마이그레이션 명명·V번호·CONCURRENTLY/.conf/롤백 주석·frontmatter 의무·표 서식 규약 전부 준수. INFO 1건(grep 스코프 표현) |
| plan_coherence | NONE | 선행 트래커의 정확한 부분집합만 해소, 미해결 항목은 명시적으로 열어 둠. 선행 구현(#1346)·코드 실측과 정합. INFO 1건(트래커 미기재, 절차상 커버됨) |
| naming_collision | NONE | 신규 식별자(V111, idx_trigger_workflow_id, Rationale 절 제목, 트래커 라벨) 전수 검색 결과 충돌 없음. INFO 1건(버전 번호 race 일반론) |

## 권장 조치사항
1. (선택) S1 편집 시 `notification_health` 부분 인덱스 행을 §3 표에 함께 추가하거나 트래커에 별도 등재
2. (선택) S2 Rationale 에서 `integration_oauth_state`/`integration_oauth_preview` 언급 시 `data-flow/5-integration.md` 링크 동행
3. (선택) V111 마이그레이션 주석 또는 S2 에 "신규 추가이므로 README §5 DROP-먼저 대상 아님(V106 과 동일 분류)" 한 줄 추가
4. (선택) 구현 착수 직전 `V111` 미점유 재확인
5. BLOCK 사유 없음 — 위 조치는 모두 보강 성격이며 draft 진행에 지장 없음
