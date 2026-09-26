# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 정상 응답, Critical 발견 없음.

## 전체 위험도
**LOW** — target(`spec/3-workflow-editor/5-version-history.md` 등, 실제 diff 는 `plan/in-progress/workflow-version-creator.md` 의 `WorkflowVersion*Dto` §5.4 정정 + `select` 상수화)은 데이터 모델·API 계약·Rationale·명명 어느 축에서도 새로운 충돌이 없다. 발견된 항목은 전부 이번 PR 스코프 밖의 기존(pre-existing) 문서 이격이거나 추적성 보완 제안(WARNING 2건, INFO 4건)이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | §7.2 가 응답 타입을 엔티티와 동명인 `WorkflowVersion` 으로 표기 (실제 응답 DTO 는 `WorkflowVersionDto`) | `spec/3-workflow-editor/5-version-history.md` §7.2 (104-108행) | `spec/conventions/swagger.md` §5-1 (엔티티를 그대로 노출 문서화 금지); 형제 §7.1 은 `WorkflowVersionListItemDto[]` 로 정확히 표기해 내부 비대칭 | "응답: `WorkflowVersionDto` 단건 + `snapshot` 포함" 으로 정정. 이번 PR diff 범위 밖이나 소정정 라인으로 별도 처리 가능 |
| 2 | convention_compliance | `## Rationale` 섹션 부재 — 같은 디렉터리 5개 파일은 전부 보유 | `spec/3-workflow-editor/5-version-history.md` 전체 | `CLAUDE.md`/`project-planner` SKILL "Spec 문서 3섹션 구성"; `0-canvas.md`·`1-node-common.md`·`2-edge.md`·`3-execution.md`·`4-ai-assistant.md` 전부 `## Rationale` 보유 | 본문에 흩어진 근거(§7.1 "`snapshot` 제외, m-3", §6 "페이지 리로드" 사유)를 `## Rationale` 로 승격. pre-existing 상태이므로 이번 PR 비블로킹 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `m-3` 참조가 링크 없는 bare 토큰 | `spec/3-workflow-editor/5-version-history.md` §7.1 | `plan/complete/refactor/05-database.md#m-3-...` 앵커로 역참조 링크 추가 |
| 2 | rationale_continuity | 프런트엔드 `creator?: {…} \| null` 을 좁히지 않기로 한 판단 근거가 plan 문서에만 존재 | `plan/in-progress/workflow-version-creator.md` §실측 마지막 문단 | `lib/api/workflows.ts` `WorkflowVersionSummary.creator` 선언 옆 또는 서비스 JSDoc 에 근거 한 줄 남기기 (선택, 비블로킹) |
| 3 | convention_compliance | §7.1~§7.3 응답 표기가 `TransformInterceptor` 의 `{ data: ... }` 봉투를 명시하지 않음 | `spec/3-workflow-editor/5-version-history.md` §7.1(95행)·§7.2(108행)·§7.3(144행) | `spec/5-system/16-system-status-api.md` 스타일로 "`{ data: WorkflowVersionListItemDto[] }`" 형태로 봉투 명시 (사소, 비블로킹) |
| 4 | plan_coherence | 프런트엔드 미러 미변경 결정을 트래커 완료 각주로 남기는 절차가 plan 체크리스트에 없음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1052-1054` (creator 항목) | `--impl-done` 이후 트래커 항목 닫을 때 "프런트엔드 미러는 의도적으로 유지 — 근거: 방어 코드/테스트 의존" 을 완료 각주로 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 데이터 모델·API 계약·RBAC·계층 책임 전 축 정합. `m-3` bare 참조 1건(INFO)만 추적성 이슈 |
| rationale_continuity | NONE | `select` 투영 방식·DTO §5.4 선언 정정 모두 기존 Rationale/규약과 정합. 프런트 미러 근거 위치만 INFO |
| convention_compliance | LOW | 이번 PR 의 실제 diff(§5.4 조합 정정)는 spec §7.1 표와 합치. 단 같은 문서의 기존 이격(§7.2 엔티티-동명 표기, Rationale 부재) 2건 WARNING |
| plan_coherence | LOW | 대상 plan 은 트래커 항목과 정확히 일치, 선행 조건 충족 확인. 트래커 완료 각주 누락 가능성만 INFO |
| naming_collision | NONE | 신규 식별자 `VERSION_METADATA_SELECT`·`workflow-version-response.dto.spec.ts` 전수 grep 결과 충돌 없음, 명명 컨벤션 부합 |

## 권장 조치사항
1. (비블로킹, 권장) §7.2 응답 타입 표기를 `WorkflowVersionDto` 로 정정 — 이번 PR 의 소정정 라인으로 포함 가능.
2. (비블로킹, 향후) `5-version-history.md` 에 `## Rationale` 섹션 신설해 본문에 흩어진 결정 근거를 승격.
3. (비블로킹, 권장) `--impl-done` 이후 `spec-draft-nullable-notation-followups.md` 트래커의 `creator` 항목을 닫을 때 프런트엔드 미러 미변경 결정을 완료 각주로 기록.
4. (선택) `m-3` bare 참조에 앵커 링크 추가, 응답 봉투(`{ data: ... }`) 명시 — 급하지 않음.