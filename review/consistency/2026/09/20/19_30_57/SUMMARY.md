# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 전문 확보, Critical 발견 없음.

> 참고: `convention_compliance` 는 status 가 `no_status` 로 보고됐으나, 인라인 전문이 완전한 형태로 제공되어 있어 정상 결과로 반영했다(파일이 디스크에 없어 이번 턴에 영속화함: `/Volumes/project/private/clemvion/.claude/worktrees/dup-delete-audit-8b2e41/review/consistency/2026/09/20/19_30_57/convention_compliance.md`). 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(모두 문서 정합성/교차참조 누락 수준), INFO 6건. `plan/in-progress/dup-delete-audit.md` (spec_impact: none) 는 `spec/2-navigation` 과 정합적이며 기존 트리거 삭제 정책·에러 코드 관례를 워크플로우 삭제로 자연스럽게 확장하는 변경으로 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `details.field` 표기가 문서 내에서 불일치 — 6곳 중 5곳은 wire camelCase(`botTokenRef`, `chatChannel`, `provider`, `type`, `inboundSigningPlaintext`), 1곳만 DB 컬럼명 snake_case(`endpoint_path`) | `spec/2-navigation/2-trigger-list.md` §3 (line 436, PATCH body 키는 §2.3.1·§3 여러 곳에서 `endpointPath` 로 명시) | `spec/conventions/swagger.md` §1 (DTO 필드 camelCase) + 문서 자체 내부 관행 | `details.field='endpoint_path'` → `'endpointPath'` 로 정정, 또는 의도적 예외라면 각주로 명시. 재발 방지로 `spec/conventions/error-codes.md` §4 에 "`details.field` 는 요청 wire 필드명(camelCase)" 한 줄 추가 |
| 2 | plan_coherence | `lockParentAndListTriggerIds` 반환 타입 변경(`string[]｜null` → `{parent, triggerIds}`)이 동일 헬퍼를 대상으로 한 미해결 설계 항목과 교차 참조되지 않음 | `plan/in-progress/dup-delete-audit.md` §B ↔ 시행 코드 `trigger-resource-release.ts` / `trigger-resource-releaser.service.ts` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4492~4521 (2026-09-17, "네 자리 공용 형태" 설계 미착수 항목 `- [ ]`) | dup-delete-audit 플랜 체크리스트/커밋 본문에 "이 PR 이후 `lockParentAndListTriggerIds` 반환 형태는 `{parent, triggerIds}` — 향후 4-자리 공용 형태 설계 시 이 계약을 전제로 할 것" 한 줄 교차 참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Folder 리소스가 RBAC 매트릭스 SoT 에 개별 행으로 없음(값 자체는 모순 없음) | `spec/2-navigation/1-workflow-list.md §3.1` ↔ `spec/5-system/1-auth.md §3.2` | 후속 planner 턴에서 §3.2 에 `Folder \| CRUD \| CRUD \| CRUD \| R` 행 추가 |
| 2 | rationale_continuity | duplicate 관련 과거 기각 대안(메타-only, export/import 재사용, 자동 Manual Trigger)이 target 에 재도입되지 않음을 확인 | `spec/2-navigation/1-workflow-list.md §2.6/§3` ↔ `spec/data-flow/11-workflow.md` Rationale | 조치 불요 — 정합 확인 기록 |
| 3 | rationale_continuity | 트리거 "동시 삭제 → 두 번째 404" 선례와 이번 코드 수정(워크플로우도 동일 패턴)의 방향 일치 | `spec/2-navigation/2-trigger-list.md §4.4` ↔ `plan/in-progress/dup-delete-audit.md` | `spec_impact: none` 유지 타당. 향후 `1-workflow-list.md §2.6` 에 대칭 문구 추가 고려(범위 밖) |
| 4 | convention_compliance | `pending_plans` 에 이미 `plan/complete/` 로 이동한 항목이 정리 안 됨(가드 통과, R-11 예외로 정당화 가능) | `spec/2-navigation/1-workflow-list.md` frontmatter | 다음 frontmatter 편집 시 완료 항목 정리 |
| 5 | plan_coherence | workflow-list.md 는 trigger-list.md §4.4 와 달리 "동시 삭제 시 두 번째 요청" 동작을 명시하지 않음(일반 에러 규약으로 이미 커버) | `spec/2-navigation/1-workflow-list.md §2.6` | 차단 사유 아님. 문서 대칭성 원하면 후속 편집 고려 |
| 6 | naming_collision | 신규 식별자(`{parent, triggerIds}` 반환 필드, `'present'｜'absent'` 리터럴, `RESOURCE_NOT_FOUND` 재사용) 전수 확인, 충돌 없음 | `trigger-resource-release.ts` 등 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Folder RBAC 매트릭스 SoT 미등재(INFO) 외 전 항목 일치. 데이터 모델·RBAC·API 계약·에러 코드·요구사항 ID 모두 SoT 와 정합 |
| rationale_continuity | NONE | 과거 기각 대안 재도입 없음, 트리거 삭제 선례와 방향 일치. CRITICAL/WARNING 없음 |
| convention_compliance | LOW | `details.field` 표기 자기 불일치 1건(WARNING), `pending_plans` 신선도(INFO). 나머지 규약(frontmatter·에러코드·audit taxonomy·DTO 명명) 전부 준수 |
| plan_coherence | LOW | 동일 헬퍼를 대상으로 한 별도 트래커의 미해결 설계 항목과 교차 참조 누락(WARNING). 플랜 자체는 spec 및 선행 트래커 처방과 정합 |
| naming_collision | NONE | 신규 식별자 표면 극히 작음(헬퍼 반환 타입 지역 확장, 기존 에러 코드 재사용). 충돌 없음 |

## 권장 조치사항
1. (WARNING #1) `2-trigger-list.md` line 436 `details.field='endpoint_path'` → `'endpointPath'` 정정 또는 의도적 예외 각주 추가 — 후속 project-planner 턴에서 처리 권장.
2. (WARNING #2) `dup-delete-audit` 플랜 완료 전, `spec-draft-nullable-notation-followups.md` 라인 4501 트래커 항목에 `lockParentAndListTriggerIds` 반환 계약 변경 사실 한 줄 교차 참조 — developer 가 이번 PR 마무리 커밋에서 직접 처리 가능(spec 변경 아님, 같은 트래커 문서 내 갱신).
3. (INFO) 위 6건은 차단 사유가 아니므로 이번 PR 진행에 지장 없음 — 후속 정리 항목으로 기록.
