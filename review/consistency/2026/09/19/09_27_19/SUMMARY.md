# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 CRITICAL 없음(전문 5/5 확보, 재시도 필요 항목 없음).

## 전체 위험도
**LOW** — 신규 CRITICAL/WARNING 급 결함 없음. cross_spec 이 이번 PR 범위 밖(제약 컬럼 자체는 변경 안 됨)에서 표면화한 WARNING 1건과, 5개 checker 공통의 INFO(문서 완결성·이미 추적된 항목 재확인) 다수만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `integration_expired` 중복 방지 키 서술이 실제 DB 제약(3컬럼 UNIQUE)과 다름 — 같은 threshold 라도 `token_expires_at` 이 바뀌면 재알림 가능, spec 문구 "임계치별 최대 1회" 와 의미가 다름 | `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts` (`@Unique(['integrationId','threshold','tokenExpiresAt'])`, 이번 PR 이 이름만 제거) | `spec/2-navigation/4-integration.md` §11.2 (약 1006행) | spec 문구를 3컬럼 기준으로 수정하거나 "영구 1회" 의도라면 별도 설계 결정 필요. spec 수정은 planner 권한 — 이번 PR 을 막을 CRITICAL 은 아니므로 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 신규 등재 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | (이미 추적됨) Workspace `owner_id` 행에 `ON DELETE CASCADE` 미기재 | `spec/1-data-model.md` §2.2 | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:4680-4683` 등재 확인됨 |
| 2 | cross_spec | (이미 추적됨) §13 i18n 표에 사전 키 3개(`continueAfterBudgetButton` 등) 서술 없음 | `spec/3-workflow-editor/4-ai-assistant.md` §13 | 조치 불요 — 커밋 `ff530fc8a` 메시지 + 트래커(`:4685-4688`)에 이미 등재 |
| 3 | cross_spec | `spec/1-data-model.md` §3 인덱스 전략 표에 `Workspace` 행 없음(Rationale·`data-flow/12-workspace.md` 에는 정확히 기술됨 — 완결성 갭, 모순 아님) | `spec/1-data-model.md` §3 (898~976행) | 다음 §3 편집 시 `Workspace \| (owner_id) UNIQUE WHERE type='personal'` 행 추가 고려(선택, planner) |
| 4 | convention_compliance | 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)가 `spec/1-data-model.md` frontmatter `code:` glob 밖(`test/` 디렉토리)이라 등재되지 않음 — CI 비차단, 문서 완결성 관찰 | `spec/1-data-model.md` frontmatter | 다음 §2/§3 편집 시 `code:` 에 해당 e2e 경로 추가해 `migrations.md` 선례와 일관성 확보(선택) |
| 5 | convention_compliance | 가드 JSDoc 이 아직 `plan/in-progress/`인 경로를 `plan/complete/...` 로 선인용 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:15` | 조치 불요 — 기존 코드 리뷰 라운드(`08_54_39` W3, `09_16_00` INFO4)가 "마무리 커밋의 plan 이동으로 해소" 로 이미 처분 확정 |
| 6 | plan_coherence | plan 체크리스트 마지막 두 항목(`--impl-done` 완료 대기, 트래커 반영+`complete/` 이동)이 이 리뷰 결과 및 병행 세션(`spec/2-navigation/` scope, `09_27_26`) 결과를 함께 기다림 | `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 | 별도 조치 불요 — 두 impl-done 세션(`09_27_19`·`09_27_26`) 모두 BLOCK:NO 확인 후 마무리 커밋 진행 |
| 7 | naming_collision | 신규 인덱스/제약 이름 6개·i18n 키 1개·e2e 파일명/헬퍼명 전수 대조 — 전부 기존 마이그레이션·사전과 1:1 대응, 충돌 없음(양성 결과) | 6개 엔티티 + `entity-schema-declarations.e2e-spec.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WARNING 1(만료 알림 중복방지 키가 spec 서술과 실제 3컬럼 제약 불일치, 이번 PR 기인 아님) + INFO 3(2건 기추적, 1건 §3 표 완결성 갭) |
| rationale_continuity | NONE | 신규 Rationale 충돌 없음 — 두 변경 모두 기존 확정 결정(V109/V095/AssistantSession 4컬럼 인덱스)을 코드/문서가 뒤늦게 따라가는 정정. 열린 트래커 항목 실제 등재 재확인 |
| convention_compliance | NONE | CRITICAL/WARNING 없음 — 직전 라운드 i18n 금지어·보간 문법·오탈 위반은 `ff530fc8a` 로 해소 재확인. INFO 2(frontmatter `code:` 미등재, JSDoc 선인용) |
| plan_coherence | NONE | scope 내 세 엔티티 정정이 미해결 결정·미해소 선행조건과 충돌 없음. 파생 후속 항목 2건 모두 트래커에 실제 등재 확인 |
| naming_collision | NONE | 신규 식별자로 보인 6개 인덱스/제약명·e2e 파일/헬퍼명·i18n 키 전부 기존 DB 객체·사전 값과 1:1 대응, 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `spec/2-navigation/4-integration.md` §11.2 의 만료 알림 중복 방지 키 서술을 실제 3컬럼 UNIQUE(`integration_id, threshold, token_expires_at`) 기준으로 정정하거나, "임계치별 영구 1회" 의도를 유지하려면 별도 설계 결정을 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 신규 항목으로 등재 — planner 권한.
2. (선택) `spec/1-data-model.md` §3 인덱스 전략 표에 `Workspace` 행 추가로 Rationale/`data-flow/12-workspace.md` 와의 표 완결성 확보.
3. (선택) 다음 `spec/1-data-model.md` 편집 시 frontmatter `code:` 에 `entity-schema-declarations.e2e-spec.ts` 등재.
4. 마무리 커밋 전 병행 세션(`review/consistency/2026/09/19/09_27_26/`, scope=`spec/2-navigation/`)의 BLOCK 판정도 NO 인지 확인한 뒤 트래커 반영 + `plan/complete/` 이동 진행 (plan_coherence INFO 1 참조).
