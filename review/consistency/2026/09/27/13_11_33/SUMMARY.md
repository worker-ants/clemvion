# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 결과 확보(전문 인라인 제공, 디스크 파일 모두 기존 존재 확인). Critical 발견 없음.

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 4건(모두 spec 문서 동기화/누락 성격, 코드 수정 자체를 막는 사유 아님), INFO 5건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Schedule 타임존 최종 fallback 값이 `1-data-model.md`(UTC 계열)와 `3-schedule.md`/구현(도메인 전용 `'Asia/Seoul'`)에서 서로 다른데, `1-data-model.md`가 이를 AI 노드와 동일한 체인으로 서술 | `spec/1-data-model.md` §2.2 Workspace `settings` 필드 설명 | `spec/2-navigation/3-schedule.md` §2.2, `spec/4-nodes/3-ai/0-common.md` §11.3, `schedules.service.ts resolveTimezone` | `1-data-model.md` §2.2 괄호 서술에서 Schedule 분기를 분리하거나 "Schedule 최종 fallback은 도메인 전용 `'Asia/Seoul'`"이라는 각주 추가 (planner 후속) |
| 2 | cross_spec | PATCH "키 생략=값 불변" tri-state 계약이 `2-trigger-list.md`에만 명시되고 `1-workflow-list.md`(settings)·`6-config.md`(AuthConfig)에는 없음 | `spec/2-navigation/1-workflow-list.md` §3.2, `spec/2-navigation/6-config.md` §A.2/R-2 | `spec/2-navigation/2-trigger-list.md` §3 註, `spec/5-system/2-api-convention.md` §5.4 | 두 문서에 "PATCH는 §5.4 tri-state를 따른다 — 생략 시 기존 값 유지" 한 문장 추가해 trigger-list.md 수준으로 정합 (코드 수정과 무관, 후속 spec 정비 권고) |
| 3 | rationale_continuity | 이미 해소된 상태 필터 파라미터 불일치를 여전히 "현재 진행 중"으로 서술하는 stale 경고가 3개월 이상 방치(하단 보강 문구와 자기모순) | `spec/2-navigation/1-workflow-list.md` §2.3 필터 표 "상태" 행 | 같은 절 하단 보강 문구(커밋 `af7effe673`, #519 — 불일치 수정 완료 서술) | "상태" 행의 경고 문구 제거 또는 "과거 불일치 있었으나 수정 완료(§2.3 하단 참고)"로 축약 |
| 4 | plan_coherence | `omit-undefined.ts` 헬퍼의 spec `code:` 등록처 미해결 planner 결정(모집단=folders/triggers 2곳 전제)이 이번 작업으로 workflows/nodes/auth-configs 3곳(그중 `nodes.service.ts`는 스코프 밖 `spec/3-workflow-editor/1-node-common.md`)으로 확장되는데 tracker에 반영 안 됨 | `plan/in-progress/patch-omit-undefined.md` §방향 1 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6) (약 6298~6302행) | `patch-omit-undefined.md` 구현 착수 전/완료 커밋에서 followups tracker 항목 (6)에 확장된 호출부 3곳 + 새 spec 영역(`spec/3-workflow-editor/1-node-common.md`)을 추가 (developer의 `plan/**` 쓰기 권한 범위 내 — spec 쓰기 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `GET /api/folders`가 §5.2(목록 응답 페이징/비페이징) 인용 없이 응답 shape 불명확 | `spec/2-navigation/1-workflow-list.md` §3.1 | 실제 컨트롤러 응답 shape 확인 후 "페이지네이션 없음 — `{ data: [...] }` 전량 반환" 등 §5.2 문구 명시 |
| 2 | convention_compliance | Folder API 400/409 에러의 `details.field`/`code` 짝이 트리거 절과 달리 미명시(정밀도 비대칭) | `spec/2-navigation/1-workflow-list.md` §3.1 `POST/PATCH /api/folders` | 위반 필드(`parentId`/`name`)를 `details.field`/`details.code`로 명시하거나 의도적 생략이면 한 줄로 근거 기록 |
| 3 | convention_compliance | 최근 merge된 `ExportedNodeDto`/`ExportedEdgeDto`(#1412)가 spec 문구에 이름으로 반영 안 됨 | `spec/2-navigation/1-workflow-list.md` §3.2 | 후속 spec 갱신(planner 턴)에서 §3.2에 두 DTO 명칭 반영 — impl-prep 차단 사유 아님 |
| 4 | plan_coherence | "settings는 strict DTO" Rationale과 이번 fix(빈 객체 시 병합 보존)의 관계 — 기존 설계 의도의 정상화로 확인, 조치 불요 | `spec/2-navigation/1-workflow-list.md` ## Rationale §2 | 조치 불요, 근거만 기록 |
| 5 | naming_collision | 신규 e2e 파일 `patch-partial-body.e2e-spec.ts`가 형제 `<도메인>-<시나리오>` 명명 대신 "결함 클래스" 축을 사용(의도적, plan에 명시, 실제 충돌 없음) | `codebase/backend/test/patch-partial-body.e2e-spec.ts` | 차단 사유 아님. 파일 상단 JSDoc(이미 존재)에 근거 유지로 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Schedule 타임존 fallback 값 drift(1-data-model.md vs 3-schedule.md), PATCH tri-state 계약 문서화 불균일 — 2건 WARNING, 코드 수정 자체는 무관 |
| rationale_continuity | LOW | `1-workflow-list.md` §2.3 상태 필터에 3개월 전 해소된 불일치를 여전히 미해결로 서술하는 stale 경고 1건 |
| convention_compliance | LOW | 전문 확인된 3개 파일은 핵심 규약(에러코드·DTO명명·null-vs-키생략·secret 비노출) 준수. INFO 3건(Folder API 응답형식/에러상세 미명시, export DTO명 spec 미반영)만 |
| plan_coherence | LOW | omit-undefined 헬퍼 spec `code:` 등록 미해결 결정의 모집단이 이번 작업으로 조용히 확장되는데 tracker 미반영 — WARNING 1건 |
| naming_collision | NONE | 신규 요구사항ID/DTO/endpoint/이벤트/설정키 없음. 신규 e2e 파일명 1건은 의도적 이탈이며 충돌 없음 |

## 권장 조치사항
1. `patch-omit-undefined.md` 구현 완료 커밋(또는 그 전)에서 `spec-draft-nullable-notation-followups.md` 항목 (6)에 확장된 헬퍼 호출부 3곳(`workflows.service.ts`/`nodes.service.ts`/`auth-configs.service.ts`, 그중 `nodes.service.ts`는 새 spec 영역 `spec/3-workflow-editor/1-node-common.md`)을 반영 — 다음 planner 턴이 좁은 모집단(2곳)으로 잘못 판단하지 않도록 (developer 권한 내, `plan/**` 갱신).
2. (후속 spec 정비, planner 턴) `1-data-model.md` §2.2에 Schedule 타임존 최종 fallback이 `'Asia/Seoul'` 도메인 전용값임을 각주로 반영.
3. (후속 spec 정비, planner 턴) `1-workflow-list.md` §3.2·`6-config.md` §A.2/R-2에 PATCH §5.4 tri-state 계약 문구 추가.
4. `1-workflow-list.md` §2.3 "상태" 행의 stale 경고 문구를 하단 보강 문구와 정합하도록 정리.
5. (선택, INFO) Folder API 응답 포맷·에러 details·export DTO 명칭 spec 반영은 이번 impl-prep을 막지 않으므로 여유 있을 때 처리.