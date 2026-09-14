# Rationale 연속성 검토 — trigger-canary-hardening (impl-done)

## 검토 범위와 방법

`--impl-done` 번들의 target scope(`spec/conventions/`) 델타는 0개다 — 이 브랜치는 spec 을
편집하지 않는 순수 코드 하드닝(`plan/in-progress/trigger-canary-hardening.md`, `spec_impact:
none`)이다. 번들 본문(`spec/conventions/*` 대부분)은 예산으로 절단됐고 "## 구현 변경 사항"
diff 도 프롬프트에 실리지 않았으므로(예산 절단), 실제 코드 diff 는 워킹트리에서 직접
`git diff origin/main`으로 확인했다 — 실질 변경은 6개 파일:

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}` (신규)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더/주석 표기 정리)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts` (teardown 주석)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 3건 추가)

이 작업은 2026-09-10 등재된 트래커 4건(`spec-draft-nullable-notation-followups.md`)을 닫는
배치이고, 착수 전 `--impl-prep`(`review/consistency/2026/09/14/10_44_37`)이 이미 rationale
연속성 관점에서 INFO 2건을 남겼다. 본 검토는 ① 그 INFO 들이 실제 구현에서 어떻게 처리됐는지,
② 새로 추가된 근거·선례 인용이 실제 이력과 일치하는지(지어낸 근거가 아닌지), ③ 기존
`## Rationale` 원칙(응답 경계 secret strip · repo-guard AST vs 정규식 경계 · review-citation
형식)과 diff 가 정합하는지를 확인했다. 다음 원본을 직접 열어 대조했다:
`spec/conventions/secret-store.md §R4`, `spec/1-data-model.md`(응답 경계 원칙),
`spec/2-navigation/2-trigger-list.md §R-17`, `spec/2-navigation/3-schedule.md §4`,
`spec/conventions/review-citations.md`, 및 `redis-fail-open-catalog-guard.ts` /
`masked-reject-callers-guard.ts`(AST 파서 선례).

## 발견사항

없음 — CRITICAL·WARNING 수준의 발견 없음.

## 확인된 정합 사항 (참고용, 비대상 확인)

- **secret-store.md §R4 (Trigger FK 미설정 — explicit application 경로 정리) 와 충돌하지
  않음.** `--impl-prep` INFO#1 이 "택일 시 R4 를 인용하라"고 권고했는데, 실제 구현
  (`trigger-workflow-ref.e2e-spec.ts` `afterAll` 註)이 정확히 그렇게 했다 — 옵션 (b)(raw
  `DELETE FROM` 유지)를 택하면서 "R4 가 요구하는 대상은 **프로덕션 삭제 경로**이고 그 경로
  (`TriggersService.remove()` → `deleteByPrefix`)는 R4 대로 동작한다. 이 한정을 적지 않으면
  '정리 안 해도 된다' 가 프로덕션 쪽으로 번진다"고 명시적으로 범위를 좁혔다. 이전엔 "미검증"
  으로만 남아 있던 문장을 두 개의 실측(세션 간 `e2e-down`=`docker compose down -v` 볼륨 삭제,
  세션 내 유일한 소비 e2e 가 `ref LIKE <접두>` 스코프)으로 "검증됨"으로 정정했다 — 근거
  없는 번복이 아니라 **번복된 적이 없고 근거만 보강**된 사례다.
- **응답 경계 secret-strip 원칙(`spec/1-data-model.md` "응답 경계에서 지운다 —
  `select:false` 금지") 과 정합.** 신규 `trigger-secret-columns-guard.ts` /
  `.spec.ts` 는 이 원칙이 이미 요구하는 "정본(`TRIGGER_RESPONSE_STRIP_COLUMNS`) + 사본 둘"의
  값·순서 동일성을 정적으로 강제한다 — 원칙을 우회하는 설계가 아니라 원칙의 실행을 보강한다.
- **AST vs 정규식 경계 판단이 저장소 선례와 일치.** plan 은 "처음엔 blind 정규식이 맞는 자리라고
  적었다가 형제 가드(`redis-fail-open-catalog-guard.ts`)를 읽고 뒤집었다"고 스스로 기록한다.
  실측 결과 그 형제 가드가 실제로 AST(`ts.createSourceFile`)를 쓰고 "정규식이면 JSDoc 의
  예시 문자열이 값으로 잡혀 가드가 자기 오판을 사실로 굳힌다"는 동일 근거를 명시하고 있어
  (`grep` 확인), 인용이 정확하고 판단이 이 저장소의 "TS 소스는 정본 파서(AST) 승"이라는
  합의된 경계와 정합한다.
- **`CREATOR_PROJECTION` 선례 인용이 지어낸 근거가 아님.** "동일 리터럴 4중 복사가 실제
  Critical 로 터진 뒤 단일 상수로 통합됐다"는 서술을 `review/code/2026/09/06/15_30_59`,
  `2026/09/08/14_01_56` 등 실제 이력으로 대조 확인했다 — `WorkflowVersionsService` 의 무투영
  `relations:['creator']` 가 `User` 전 컬럼(passwordHash 등)을 노출한 실제 Critical 을 닫은
  전례가 맞다.
- **`3-schedule.md §4` "양성 3 + 생성 음성 대조 1" 인용이 정확.** 원문 대조 결과 그 문구가
  그대로 존재하며(§4 註), plan 이 "이 표면(`ScheduleDto.trigger.workflow`)은 이미 이행돼
  있었고, 실제로 비어 있던 건 다른 표면(`TriggerDto.workflow`)"이라고 정정한 것도 두 헬퍼
  (`expectNarrowedScheduleTriggerRef` vs `expectTriggerWorkflowRef`)의 실제 호출 위치로
  뒷받침된다 — `--impl-prep` INFO#2("§4 주장이 미이행")를 반증하며 근거를 남긴 것은 무근거
  번복이 아니라 실측에 의한 정정이다.
- **`2-trigger-list.md §R-17`("이 축의 캐너리가 고정하는 것은 구현이지 계약이 아니다")과
  충돌 없음.** R-17 이 다루는 `trigger-workflow-ref.e2e-spec.ts` 자체의 양성/음성 캐너리
  개수는 이번 diff 가 건드리지 않았다(수정은 teardown 주석뿐). `schedule-trigger.e2e-spec.ts`
  에 추가된 3건은 별개 표면이며, 그 표면엔 생성 엔드포인트가 없어 R-17 이 요구하는 "음성 대조로
  경계를 증명해야 한다"는 조건 자체가 적용되지 않는다는 plan 의 설명이 맞다(schedule 트리거는
  `POST /api/triggers` 로 생성되지 않음).
- **`review-citations.md` 와 충돌 없음.** `trigger-workflow-ref.spec.ts` 헤더에서 두 개의
  전체경로 리뷰 인용(`review/code/2026/09/10/{15_52_06,16_26_57}`)이 삭제됐으나, 이는 이
  규약이 요구하는 "인용 형식(bare 시각 금지)"을 위반한 것이 아니라 "코드가 스스로 설명해야
  하는 규칙(가드 11개 순번·가드 5 의 진단 품질 근거)"은 남기고 "리뷰 라운드 자기수정 서술"만
  트래커로 옮긴 것이다 — 트래커(`spec-draft-nullable-notation-followups.md`)에 해당 이력이
  그대로 보존돼 있어(§ 위 diff 확인) git 이력 손실도 없다.

## 참고 (낮은 우선순위, Rationale 연속성 범위 밖일 수 있음)

- 신규 `trigger-secret-columns-guard.ts`/`.spec.ts` 는 `spec/1-data-model.md` 또는
  `spec/conventions/secret-store.md` 의 `code:` 프론트매터 어디에도 등재돼 있지 않다
  (`grep -rl trigger-secret-columns spec/` 결과 0건). `audit-actions.md`·`review-citations.md`·
  `2-trigger-list.md` 가 이미 "시행 코드는 `code:` 에 등재해 근거 추적성을 준다"는 동일 패턴을
  쓰고 있어, 이 신규 가드도 같은 패턴을 따르면 정합이 더 분명해진다. 다만 이번 PR 의 target
  scope(`spec/conventions/`) 델타가 0이고 developer 는 spec 을 편집할 권한이 없으므로(자기
  반증형 소정정 요건에도 해당하지 않음 — 이 가드는 예고 문장의 정정이 아니라 신규 시행 코드다),
  이는 CRITICAL/WARNING 이 아니라 **차기 planner 턴에서 등재를 검토할 항목**으로만 남긴다.
  Rationale 위반이 아니라 spec-impl-evidence 커버리지 성격의 항목이다.

## 요약

이번 diff(`trigger-canary-hardening`)는 spec 을 전혀 편집하지 않는 순수 코드 하드닝이며,
기존 `## Rationale`(secret-store §R4, 1-data-model 응답 경계 원칙, trigger-list §R-17,
review-citations.md, repo-guard AST 경계)과 대조한 결과 기각된 대안의 재도입이나 합의 원칙의
위반은 발견되지 않았다. 오히려 이 배치는 착수 전 `--impl-prep` rationale_continuity 검토가
남긴 두 INFO(― e2e teardown 결정에 §R4 를 인용할 것, `3-schedule.md §4` 서술과 실제 커버리지의
관계를 명확히 할 것 ―)를 정확히 그 방식대로 해소했다: teardown 관례를 바꾸지 않고 근거를
R4 범위(프로덕션 경로 한정)로 명시적으로 좁혔고, "이미 이행돼 있다"는 반증을 실측으로 뒷받침한
뒤 실제로 비어 있던 별도 표면을 채웠다. 인용된 선례(`CREATOR_PROJECTION`, 형제 AST 가드,
`§R-17`, `§4` 註)는 모두 저장소에서 실재를 확인했고 지어낸 근거는 없었다.

## 위험도

NONE
