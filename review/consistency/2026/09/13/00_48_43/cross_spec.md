# Cross-Spec 일관성 검토 — filter-pg-invalid-text (impl-done, scope=spec/5-system)

## 검토 방법 메모

이 세션의 `spec/5-system` 델타는 0(정상 — 코드 전용 PR). 프롬프트 번들의 diff 섹션이
예산으로 절단돼 있어, 실제 구현 diff 는 워킹트리를 절대경로로 직접 열어 확인했다:

```
git -C /Volumes/project/private/clemvion/.claude/worktrees/filter-pg-invalid-text diff origin/main...HEAD -- codebase/
```

대상 코드 diff(8파일): `common/utils/uuid.ts`(JSDoc 갱신) · `common/utils/uuid.spec.ts` ·
`modules/auth/login-history.service.ts`(+`isUuidShaped` 커서 id 검증) · 동 spec ·
`modules/executions/background-runs/background-runs.service.ts`(+`isUuidShaped` 커서 `i`
검증) · 동 spec · `test/session-revocation.e2e-spec.ts`(+회귀 e2e 1건) ·
`test/background-monitoring.e2e-spec.ts`(+회귀 e2e 1건). 요지: keyset 커서의 id 성분이
검증 없이 `uuid` 컬럼(`LoginHistory.id` / `NodeExecution.id`, 둘 다
[데이터 모델 §2.14](../../../../../spec/1-data-model.md#214-nodeexecution)·
[§2.18.2](../../../../../spec/1-data-model.md#2182-loginhistory))에 바인딩돼 SQLSTATE
22P02 → 500 마스킹이 나던 것을 각 디코더의 **기존 실패 계약을 유지한 채** id 만
`isUuidShaped` 로 조기 거부하도록 고쳤다. 함께 커밋된
`plan/in-progress/keyset-cursor-uuid-validation.md`(신규) ·
`plan/in-progress/spec-draft-nullable-notation-followups.md`(항목 추가)도 대조했다.

## 발견사항

- **[WARNING]** 두 "커서 기반 페이지네이션" 엔드포인트의 실패 계약이 `spec/5-system/2-api-convention.md §8.2` 의 단일 서술과 어긋난 채로 이번 배치에서 더 굳어진다
  - target 위치: `spec/5-system/`(scope, 델타 0) — 직접 편집 없음. 실제 근거는 코드 diff `codebase/backend/src/modules/auth/login-history.service.ts`(`decodeCursor`, id 무효 시 `null` → 조용히 1페이지) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`(`decodeCursor`, `i` 무효 시 `throw` → 400 `INVALID_CURSOR`)
  - 충돌 대상: `spec/5-system/2-api-convention.md §8.2`(cursor 기반 페이지네이션은 opaque base64 cursor + 실패 시 400 `INVALID_CURSOR` 하나만 서술 — `GET /api/executions/{executionId}/background-runs/{backgroundRunId}` 예시뿐). `GET /api/users/me/login-history`([spec/2-navigation/9-user-profile.md:366](../../../../../spec/2-navigation/9-user-profile.md) "커서 페이징")도 같은 "커서 기반 페이지네이션" 범주인데 평문 `<iso>|<id>` 인코딩 + 실패 시 **무시**라는 §8.2 에 없는 예외를 쓴다
  - 상세: 이번 diff 는 두 디코더 각각에 `isUuidShaped` id 검증을 추가하면서 **기존 계약을 통일하지 않고 각자 강화**했다(양쪽 다 명시적으로 "형제는 다르게 동작한다" 주석 + e2e 대조군을 남겼다). 그 결과 §8.2 를 "cursor 페이지네이션의 단일 표준"으로 읽으면 `login-history` 는 그 표준에서 어긋난 예외가 문서화 없이 남는다. 이 사실 자체는 이번 diff 가 새로 만든 결함이 아니다 — 같은 세션의 이전 `--impl-prep` cross_spec 라운드(`review/consistency/2026/09/12/22_51_25`)에서 이미 WARNING 으로 지적됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **"planner 항목"**(§8.2 예외 각주 필요 여부는 계약 통일 여부와 같이 결정)으로 정확히 등재돼 있다(`spec_impact: none` 이 맞는 이유 — 발견 자체는 코드 diff 가 아니라 별도 planner 결정 대상이라 이 PR 범위 밖). 다만 이번 diff 가 **두 계약을 각각 하드닝**했다는 점에서 "언젠가 통일" 이 아니라 "비대칭이 각자 강화되어 굳어짐" 으로 상태가 바뀌었다는 것은 정확히 이 PR 의 영향이다
  - 제안: 새로 조치할 필요는 없음 — 이미 올바른 위치(`plan/in-progress/`)에 planner 항목으로 정확히 걸려 있고 근거(코드 주석 3곳, e2e 주석 2곳, plan §C)가 일관된다. 다음 project-planner 턴에서 그 항목을 처리할 때 "① §8.2 에 login-history 예외 각주 추가" 또는 "② 두 디코더 계약 통일(관측 가능한 동작 변경)" 중 하나를 택일하면 닫힌다. 이 PR 을 위해 지금 spec 을 고칠 필요는 없음(BLOCK 대상 아님)

- **[INFO]** 같은 tracker 에 이미 등재된 인접 planner 항목 2건 — 이번 diff 의 신규 결함 아님, 참고용 교차 확인만
  - target 위치: 없음(이번 diff 는 관련 코드를 건드리지 않음)
  - 충돌 대상: `spec/5-system/3-error-handling.md §1`(카탈로그) vs `spec/4-nodes/1-logic/12-background.md §8.7`(Background Runs 4개 에러 코드 `INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND` 가 §1 에 미등재) · `3-error-handling.md §1.6` 각주(`EXECUTION_NOT_FOUND` 분류)가 같은 문서 §1.9 기준과 불일치
  - 상세: 둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-12 자 "planner 항목"으로 이미 정확히 등재돼 있음(출처: `review/consistency/2026/09/12/22_51_25` cross_spec·convention_compliance WARNING). 이번 diff 가 `INVALID_CURSOR` 를 실제로 발생시키는 새 경로(id-shape 검증)를 추가했지만, §1 카탈로그 미등재 상태 자체는 이번 diff 이전부터의 기존 상태이고 변경 없음
  - 제안: 조치 불필요(중복 등재 방지 목적으로만 기록). project-planner 턴에서 위 WARNING 항목과 함께 §1.13 신설 + 역링크로 일괄 처리 권장(plan 문서의 기존 제안과 동일)

## 요약

이번 diff 는 spec/5-system 을 직접 변경하지 않는 순수 코드 픽스(keyset 커서 id 성분에 `isUuidShaped` 조기 검증 추가)이며, `common/utils/uuid.ts` 의 JSDoc·`spec/5-system/3-error-handling.md §1`·`spec/data-flow/12-workspace.md` UUID 검증 강도 비대칭 Rationale·`spec/4-nodes/1-logic/12-background.md §8.7` 의 `INVALID_CURSOR` 카탈로그와 정확히 정합한다. 데이터 모델(`LoginHistory.id`/`NodeExecution.id` UUID 컬럼)·RBAC·계층 책임 측면의 모순은 발견되지 않았다. 유일한 Cross-Spec 쟁점은 두 커서 디코더의 실패 계약 비대칭이 `2-api-convention.md §8.2` 의 단일 서술과 어긋난 채로 이번 배치에서 더 굳어진다는 점인데, 이는 이미 이전 라운드에서 WARNING 으로 지적돼 `plan/in-progress/` 에 planner 결정 대기 항목으로 정확히 등재돼 있어 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
