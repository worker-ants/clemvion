# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(모두 output_file 이미 존재, 인라인과 동일), Critical 0건.

## 전체 위험도
**NONE** — scope(`spec/2-navigation/`) 델타 0, 실제 diff(TypeORM 엔티티 8개 컬럼 선언 정정 + 컬럼 층 가드 테스트)는 순수 스키마-DB 정합화이며 `synchronize: false`로 런타임 동작 불변. 5개 checker(cross_spec/rationale_continuity/convention_compliance/naming_collision=NONE, plan_coherence=LOW) 전원 CRITICAL·WARNING 0건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 컬럼 층 가드 확장은 번복이 아니라 `plan/complete/entity-schema-declaration-drift.md`에서 트래커로 이연해 둔 항목의 계획된 완료 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 상단 주석 | 조치 불요 |
| 2 | rationale_continuity | `WorkflowAssistantSession.lastInteractionAt` default 추가는 "선언 정정=동작 불변" 전제가 컬럼 default 층에는 그대로 성립하지 않음(RETURNING 채움, 값은 동일)을 plan이 스스로 실측·기록 | `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts` | 조치 불요 — 향후 유사 일반화 주장 시 이 사례 함께 인용 권고 |
| 3 | convention_compliance | `languageHints`(`Record<string,string>`) 가 실제 DTO 코드에서 닫힌 union이어야 하는지 spec 문면만으로 판별 불가 | `spec/2-navigation/2-trigger-list.md` §2.3.1 | 코드 대조 가능한 세션에서 `chat-channel-config.dto.ts` 1회 확인 권장 |
| 4 | convention_compliance | 예산 절단으로 `4-integration.md`·`6-config.md`·`9-user-profile.md` 본문 미검토(frontmatter만 확인) | `spec/2-navigation/*.md` | 필요 시 별도 세션에서 절대경로 직접 Read 재검토 |
| 5 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md:4651`) 체크박스 아직 `[ ]` — 계획대로 진행 중 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4651`, `plan/in-progress/entity-column-declaration-drift.md` 체크리스트 마지막 줄 | `--impl-done` 통과 후 트래커 체크 + plan `complete/` 이동 마무리 커밋 |
| 6 | plan_coherence | 미커밋 트래커 추가분이 아직 `in-progress/`에 있는 plan을 `plan/complete/…`로 선참조(dangling) | `plan/in-progress/spec-draft-nullable-notation-followups.md` (워킹트리 diff) | 마무리 커밋에서 plan 이동과 트래커 커밋을 같은 순서로 묶을 것; 세션 중단 시 in-progress 표기로 되돌릴 것 |
| 7 | plan_coherence | plan 체크리스트 `/ai-review` 항목 미체크 — 실제로는 4라운드 진행·수렴 완료 | `plan/in-progress/entity-column-declaration-drift.md:127` | 같은 턴에 체크박스 갱신 + 라운드 이력 한 줄 요약 |
| 8 | plan_coherence | scope 내 3개 문서(`9-user-profile.md`·`4-integration.md`·`6-config.md`)가 diff 엔티티를 `code:` glob으로 물지만 예산 절단 — 직접 확인 결과 충돌 없음 | 해당 3개 spec 문서 frontmatter | 조치 불요(확인 완료) |
| 9 | naming_collision | `enumName` 파라미터가 TypeORM(snake_case, `edge_type`/`node_category`)과 Swagger(PascalCase, `EdgeType`/`NodeCategory`)에서 다른 케이싱으로 쓰임(기존 관행, 충돌 아님) | `edge.entity.ts`/`node.entity.ts` vs `edge-response.dto.ts` 등 | 조치 불요, 필요 시 데코레이터 주석 1줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 변경 8개 엔티티가 `spec/2-navigation/` 소유 엔티티·API·상태머신·RBAC와 교집합 없음 |
| rationale_continuity | NONE | 트리거·스케줄 Rationale 위반 없음; 컬럼 층 확장은 사전 이연 항목의 계획된 완료 |
| convention_compliance | NONE | frontmatter·secret 비노출·Swagger DTO·감사 액션·advisory lock·chat-channel enum 전축 정합 |
| plan_coherence | LOW | 마무리 절차(트래커 체크·complete 이동·/ai-review 체크박스) 진행 중이나 계획된 in-flight, 정합성 결함 아님 |
| naming_collision | NONE | 신규 식별자는 기존 DB enum 재확인 또는 파일-로컬 스코프뿐, grep 0-hit 충돌 |

## 권장 조치사항
1. `--impl-done` 통과 확인 후 같은 마무리 커밋에서: (a) `spec-draft-nullable-notation-followups.md:4651` 체크, (b) `entity-column-declaration-drift.md`를 `plan/complete/`로 이동, (c) 그 plan의 `/ai-review` 체크박스 갱신(4라운드 이력 요약 포함) — 순서: 코드 커밋 → 리뷰 → 트래커/plan-이동 커밋.
2. (선택) 여유 있는 세션에서 `chat-channel-config.dto.ts`의 `languageHints` 실제 타입이 닫힌 union인지 1회 확인.
3. (선택) `4-integration.md`·`6-config.md`·`9-user-profile.md` 본문을 별도 세션에서 직접 대조해 예산 절단 갭을 해소.
