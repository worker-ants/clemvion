# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (convention_compliance: `IntegrationTestResult.code` 케이스 위반)

## 전체 위험도
**MEDIUM** — target(`spec/2-navigation/`)의 전량 열람 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)은 cross-spec·rationale·plan·naming 4개 축에서 전반적으로 정합적이나, `4-integration.md` §5.4 에서 규약 위반 CRITICAL 1건이 확인됐고, plan 체크리스트 스코프 공백(WARNING)도 발견됐다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `IntegrationTestResult.code` 에 lower_snake_case 값 3종(`auth_failed`/`network`/`unknown_error`)이 UPPER_SNAKE_CASE 규약 위반 — 15줄 아래 형제 절(§5.5)이 "같은 필드는 UPPER_SNAKE_CASE" 라고 스스로 명시한 것과도 모순 | `spec/2-navigation/4-integration.md` §5.4 Database (line 490) | `spec/conventions/error-codes.md` §1 (의미 기반 UPPER_SNAKE_CASE 명명 규율, §3 예외 레지스트리에 미등록) + 같은 문서 §5.5 (`EMAIL_CONNECT_FAILED` 등 UPPER_SNAKE_CASE 자기 선언) | §5.4 를 `DB_AUTH_FAILED`/`DB_NETWORK_ERROR`/`DB_UNKNOWN_ERROR`(또는 `DATABASE_*` 접두) 로 정정. 아직 미구현이라 정정 비용은 spec 문구 3토큰뿐 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 위 Critical 은 `spec/2-navigation/4-integration.md` 본문 문구 자체의 내부 모순(spec 문서 자기 오류)이며, 이번 세션(`developer`, `plan/in-progress/entity-column-declaration-drift.md`)의 실제 코드 변경 범위(백엔드 엔티티 컬럼 선언 8건)와 무관한 **별개의 기존 spec 결함**이다. 이 target 문서 자체를 developer 가 이번 작업으로 편집하는 것이 아니므로 지금 이 세션이 직접 고칠 권한 소재는 아니지만, 근본 원인이 "코드 구현이 spec 을 어겼다"가 아니라 "spec 텍스트 자체가 스스로 모순"이므로 통상적인 developer→planner spec drift 인계 사유(§4)에는 해당하지 않는다. planner 턴에서 `4-integration.md` §5.4 세 토큰만 정정하면 되는 저비용 건으로, 다음 `project-planner` spec 편집 시 함께 처리 권장.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | (없음 — 위 설명 참고, 저비용 spec 문구 정정으로 별도 트래킹 없이도 다음 planner 턴에서 처리 가능) | — | `spec/2-navigation/4-integration.md` §5.4 | 미등재 (본 SUMMARY 가 기록) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Folder 리소스가 중앙 RBAC 매트릭스에 개별 행으로 없음 (값 모순은 아니고 SoT 커버리지 갭) | `spec/2-navigation/1-workflow-list.md` §3.1 (Folder CRUD API, `editor+` 게이트) | `spec/5-system/1-auth.md §3.2` "리소스별 권한 매트릭스" (Folder 행 부재) | `1-auth.md §3.2` 에 `Folder \| CRUD \| CRUD \| CRUD \| R` 행 추가 또는 "Workflow 하위 리소스로 동일 floor" 각주 |
| 2 | plan_coherence | plan 체크리스트의 `--impl-prep`/`--impl-done` 스코프가 `spec/1-data-model.md`(변경된 엔티티 8개 파일 전부를 무는 유일한 전-엔티티 SoT)를 빠뜨림. `--impl-prep` 는 `spec/3-workflow-editor/` 도 누락 | `plan/in-progress/entity-column-declaration-drift.md` 하단 `## 체크리스트` 1행·5행 | `spec/1-data-model.md` frontmatter `code:` (전-엔티티 와일드카드로 이번 diff 8파일 전부 커버) | `--impl-prep`/`--impl-done` 스코프에 `spec/1-data-model.md` 추가, `--impl-prep` 에 `spec/3-workflow-editor/` 도 추가 |
| 3 | convention_compliance | `Cafe24PrecheckResultDto` 가 MakeShop precheck 엔드포인트 응답 스키마로도 재사용되는데 spec 텍스트가 이 사실을 언급하지 않음 (기존 구현, 이번 변경 범위 밖) | `spec/2-navigation/4-integration.md` §9.2 (`GET /api/integrations/makeshop/precheck`) | `spec/conventions/swagger.md` §5-1 (동일 개념 층별 선언 시 이름 분리 취지) | §9.2 에 "Cafe24PrecheckResultDto 를 공유(provider 무관 공용 shape)" 한 줄 추가 또는 후속 PR 에서 `IntegrationPrecheckResultDto` 개명 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 검토 범위 제한 — navigation 15개 파일이 프롬프트 예산 절단으로 미검토(발견 없음 아니라 미검증) | `spec/2-navigation/*` (target 이외 파일들) | 후속 라운드에서 절단 없이 재확인 |
| 2 | rationale_continuity | 검토 가능한 3개 target 문서는 Rationale 연속성 관례(취소선 보존+대체 근거, "영구 기각 아님" 명시)를 모범적으로 지킴 | `2-trigger-list.md` R-2·R-17, `1-workflow-list.md` §2.3/§4 | 현행 유지 권장 |
| 3 | rationale_continuity | endpointPath 전역 유일성(V131/V132) 반영이 target 내부에서 일관됨 | `2-trigger-list.md` §2.3.1, §3 | 없음 |
| 4 | rationale_continuity | chat-channel 관련 Rationale(R-CC-10/11/12/18/19/21) 인용이 현재 정본과 어긋나지 않음 | `2-trigger-list.md` §2.3.1, §3 | 없음 |
| 5 | rationale_continuity | 13개 navigation 문서 + 다수 5-system 문서 Rationale 미대조 (이번 작업 spec_impact:none 이면 게이트 사유 아님) | 해당 문서 전반 | 향후 그 영역을 만지는 작업이면 별도 라운드에서 직접 대조 |
| 6 | naming_collision | target 번들은 이번 diff(백엔드 엔티티 컬럼 선언 8건)에 포함되지 않은 기존 안정화 spec 재번들 — 신규 식별자 없음, 6개 관점 전수 대조 결과 충돌 없음 | `spec/2-navigation/` 전체 | 조치 불필요 |
| 7 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`)의 "e2e 가드 범위 결정" 항목에 이번 컬럼 층 확장 사실 미반영 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4698-4702` | `complete/` 이동 시 트래커 항목에 "컬럼 층까지 확장됨" 한 줄 추가 |
| 8 | plan_coherence | 상위 트래커의 "결정할 것" 3가지(고칠지/가드 확장/구분 기준)를 이번 plan 이 정합적으로 닫음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4649-4658` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 10여 개 교차 참조 전부 일치. Folder RBAC 매트릭스 누락 WARNING 1건. 15개 파일 미검토 |
| rationale_continuity | NONE | 3개 target + 인용된 data-model/webhook/chat-channel Rationale 전문 대조, 위반 없음. 다수 문서 미검증(INFO) |
| convention_compliance | MEDIUM | `IntegrationTestResult.code` UPPER_SNAKE_CASE 위반 1건 CRITICAL(미구현 상태, 정정 비용 낮음). Cafe24/MakeShop DTO 재사용 INFO 1건 |
| plan_coherence | MEDIUM | plan 체크리스트 스코프가 `spec/1-data-model.md`(전-엔티티 SoT) 누락 WARNING. 트래커 결정 항목은 정합적으로 해소 |
| naming_collision | NONE | target 이 실제 diff 밖의 기존 안정화 spec 재번들이라 신규 식별자 없음. 6개 관점 전수 대조 충돌 0건 |

## 권장 조치사항

1. **(BLOCK 해소)** `spec/2-navigation/4-integration.md` §5.4 의 `error.code` 예시 3개(`auth_failed`/`network`/`unknown_error`)를 UPPER_SNAKE_CASE(예: `DB_AUTH_FAILED`/`DB_NETWORK_ERROR`/`DB_UNKNOWN_ERROR`)로 정정 — 미구현 상태라 spec 문구만 고치면 되는 저비용 수정. `project-planner` 턴에서 처리(§planner 인계 참고, 별도 승인 절차 불요할 만큼 좁은 정정).
2. `plan/in-progress/entity-column-declaration-drift.md` 체크리스트에 `--impl-prep`/`--impl-done` 스코프로 `spec/1-data-model.md` 를 추가하고, `--impl-prep` 에는 `spec/3-workflow-editor/` 도 함께 추가한다 (`--impl-done` 실행 전 필수).
3. `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에 Folder 행을 추가하거나 각주로 Workflow 동일 floor 를 명시한다 (선택적, 다음 auth.md 편집 시 병행 권장).
4. `spec/2-navigation/4-integration.md §9.2` 에 `Cafe24PrecheckResultDto` 공유 재사용 사실을 한 줄 명시한다 (선택적, 낮은 우선순위).
5. 이번 세션의 실제 diff(백엔드 엔티티 컬럼 선언 8건, `spec_impact: none`)는 CRITICAL/WARNING 어느 것과도 직접 충돌하지 않으므로, 위 1번 항목만 해소되면(또는 §planner 인계로 별도 트래킹되면) 이번 작업 자체의 진행을 막을 사유는 없다.
