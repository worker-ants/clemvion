# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문을 모두 확보했고, Critical 위배는 0건이다.

## 전체 위험도
**MEDIUM** — Critical 없음. cross_spec 이 지적한 두 WARNING(Trigger PATCH `name` null 케이스 미검증 · Execution 상세 응답 shape 의 REST/WS 문서 간 불일치)이 이번 plan 의 백로그 편입 대상으로 실질적이라 MEDIUM 으로 유지하되, 나머지는 pre-existing/이미 triage 된 항목이라 차단 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Trigger PATCH `name` 검증 실패=400 이라는 target 의 약속이, 이번 plan 이 실측한 "NOT NULL 필드에 null PATCH → 500" 결함 패턴과 미검증 상태로 상충할 위험 — `Trigger.name` 은 데이터 모델상 NOT NULL 이지만 프로브 표에 `null` 케이스가 없음 | `spec/2-navigation/2-trigger-list.md` §3 (197행) | `spec/1-data-model.md` §2.8 Trigger + `plan/in-progress/patch-body-followups.md` 프로브 표 | 이번 plan 이 열기로 한 백로그 항목("PATCH NOT NULL 필드의 null→500")의 실측 표에 `PATCH /triggers/:id { name: null }`(및 Schedule 의 다른 NOT NULL 필드)을 추가 등재하거나, target 문서에 "명시적 null 은 별도 트래킹" 각주 추가 |
| 2 | cross_spec | Execution 상세 `nodeExecutions[].node` 응답 폭이 REST 문서(좁은 3필드 예시)와 WS 문서("findById 그대로" 전체 객체) 사이에서 서로 다르게 서술됨. 실측(`findById`)은 WS 서술 쪽에 가까움 | `spec/2-navigation/14-execution-history.md` §5 (414행) | `spec/5-system/6-websocket-protocol.md` §6.2 (224행) | plan 이 이미 등재한 executions `findById` 트래커 항목에 "§5 샘플 vs §6.2 서술 중 어느 쪽이 목표 계약인지" 결정 하위 작업을 명시적으로 추가 |
| 3 | rationale_continuity | `1-workflow-list.md` §2.3 "상태" 필터 행이 이미 해소된 파라미터 불일치(#519)를 진행 중으로 서술 — 같은 절 하단 문구와 자기모순. **이번 PR 의 회귀는 아님**(pre-existing, 이미 `spec-draft-nullable-notation-followups.md` 항목(8)로 등재) | `spec/2-navigation/1-workflow-list.md` §2.3 필터 표 "상태" 행 | 같은 절 하단 보강 문구 | 새 조치 불요 — 기존 tracker 항목(8) "행의 경고를 걷는다"를 planner 턴에서 집행 |
| 4 | plan_coherence | `patch-body-followups.md` 가 다음 단계에서 새로 등재할 트래커 항목("검증 데코레이터 vs 필터의 23502 매핑")이, `keyset-cursor-uuid-validation.md §A`가 이미 근거 기반으로 기각한 "필터의 23502 매핑" 옵션을 인용 없이 다시 "결정 사항"으로 띄울 위험 (아직 미발생 · 다음 단계 리스크) | `plan/in-progress/patch-body-followups.md` §방향 항목 6 (미체크) | `plan/in-progress/keyset-cursor-uuid-validation.md §A` (이미 won't-do 귀결) | 트래커 등재 시 `keyset-cursor-uuid-validation.md §A`를 교차 인용해 "필터 매핑은 이미 기각된 방향"임을 명시하고, 항목 범위를 "PATCH DTO 필드 단위 `@IsNotEmpty()`/`nullable` 선언 정합"으로 좁혀 적을 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Folder 리소스 RBAC(`editor+`)가 `5-system/1-auth.md` §3.2 중앙 권한 매트릭스에 미등재 (명명 관례 공백, 결함 아님) | `spec/2-navigation/1-workflow-list.md` §3.1 vs `spec/5-system/1-auth.md` §3.2 | §3.2 에 Folder 행 추가 또는 "하위 리소스는 부모 리소스 행을 따른다" 각주 추가 |
| 2 | rationale_continuity | PATCH tri-state 원칙(§5.4)이 `1-workflow-list.md`/`6-config.md`에 명문화돼 있지 않음 (이미 tracker 항목(7)로 등재, 문서 갱신만 남음) | `spec/2-navigation/1-workflow-list.md` §3 API 표 | 기존 planner 항목(7) 처리 시 §3.2·`6-config.md`에 한 문장씩 추가 |
| 3 | convention_compliance | 컬렉션 수준 RPC 액션(`POST /api/workflows/import`, `POST /api/schedules/preview`)이 URL 명명 규칙 표(§2.2)의 어느 행에도 정확히 대응하지 않음 (기존 확립 패턴, 신규 아님) | `1-workflow-list.md` §3, `3-schedule.md` §4 | `spec/5-system/2-api-convention.md` §2.2 에 "id 불요 컬렉션 수준 액션" 행 추가 |
| 4 | convention_compliance | `1-workflow-list.md` frontmatter `pending_plans` 에 이미 `plan/complete/`로 이동한 `workflow-duplicate-nodes-edges.md` 잔존 (스키마 위반 아님) | `1-workflow-list.md` frontmatter | 다음 편집 기회에 완료 항목 제거 |
| 5 | plan_coherence | `2-trigger-list.md §2.3.1` 의 `eia-trigger-edit-ui` plan 참조가 dangling (이미 다른 PR 에서 "조치 안 함"으로 triage 완료) | `2-trigger-list.md:133` | 조치 불요 — 다음에 파일을 편집할 기회에 갱신/제거 고려 |
| 6 | naming_collision | 신규 식별자 충돌 없음 — `description`/`ipWhitelist` nullable 선언은 기존 PATCH tri-state 관례(§5.4) 재사용, 테스트 제목·e2e 케이스 라벨·트래커 항목 제목 모두 grep 확인 결과 충돌 없음 | `patch-body-followups` 코드 스코프 전체 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | Trigger PATCH null 케이스 미검증 + Execution 상세 응답 shape REST/WS 문서 불일치. 컨텍스트 예산으로 15/18 target 파일 절단 |
| rationale_continuity | LOW | pre-existing 자기모순(#519, tracker 항목(8))과 문서화 누락(tracker 항목(7)) 재확인, 이번 PR 회귀 아님 |
| convention_compliance | LOW | 전량 검토 3파일에서 CRITICAL/WARNING 없음, INFO 2건. 나머지 15파일 미검증 |
| plan_coherence | LOW | 다음 단계 트래커 등재 시 이미 기각된 결정을 인용 없이 재소환할 위험(미발생) |
| naming_collision | NONE | 신규 식별자 없음, 기존 관례 재사용 |

## 권장 조치사항
1. (필수 아님, BLOCK 없음) `plan/in-progress/patch-body-followups.md` 가 백로그 항목을 실제로 등재할 때 — (a) Trigger `name`/Schedule NOT NULL 필드의 null 케이스를 프로브 표에 추가, (b) Execution 상세 `nodeExecutions[].node` shape 결정 하위 작업 명시, (c) `keyset-cursor-uuid-validation.md §A` 교차 인용으로 "필터 23502 매핑" 재소환 방지 — 세 가지를 함께 적을 것.
2. `1-workflow-list.md` §2.3 "상태" 필터 행의 자기모순(pre-existing, tracker 항목(8))과 PATCH tri-state 문서화 누락(tracker 항목(7))은 planner 턴에서 기존 tracker 항목을 그대로 집행하면 해소됨 — 이번 developer PR 과 무관.
3. INFO 6건은 즉시 조치 불요, 각 항목 제안대로 다음 관련 편집 시점에 반영.
4. 방법론적 한계: `spec/2-navigation/` 18개 파일 중 15개가 컨텍스트 예산 초과로 절단됨(기존 harness 결함, `harness-review-gate-followups.md` 및 `spec-draft-nullable-notation-followups.md:4188` 에 이미 등재) — 이 리포트는 본문이 실린 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)에 대한 부분 인증으로 읽어야 한다.