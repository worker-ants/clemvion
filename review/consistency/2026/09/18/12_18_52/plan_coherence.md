# Plan 정합성 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md`

## 발견사항

- **[INFO]** 새 트래커 항목은 draft 자체에만 존재, 아직 트래커 파일에 미기재
  - target 위치: `## 트래커 반영` — "새 항목: «`workflow`·`workspace` FK 중 선두 인덱스가 없는 여섯»"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: draft 는 이 신규 항목을 트래커에 추가하겠다고 서술하지만, 실제 파일에는 아직 반영되지 않았다(grep 0건). 체크리스트 마지막 항목("트래커 반영 · 이 draft `complete/` 이동")이 이를 커버하므로 절차상 누락은 아니나, 구현 PR 완료 시점까지 실제 반영 여부를 추적할 필요가 있다.
  - 제안: 별도 조치 불필요 — 체크리스트 준수로 자연히 해소됨. 참고용 기록.

## 검증한 정합성 항목 (문제 없음)

1. **미해결 결정과의 충돌 없음** — 선행 트래커 `spec-draft-nullable-notation-followups.md` 의 «부모 삭제 경로의 성능 후속» 항목(첫째: 인덱스, 둘째: 순차 처리 지연, 셋째: `select` 좁히기)을 실제로 읽어 대조한 결과, draft 는 첫째·셋째만 닫고 **둘째("부모 하나의 트리거 수가 작다" 는 미실측 가정)는 명시적으로 열어 둔다** — 트래커가 "결정 필요"로 남긴 항목을 우회하거나 일방적으로 닫지 않았다.
2. **선행 plan 이 이미 해소됨** — draft 가 전제하는 `trigger-resource-releaser.service.ts` 의 `releaseExternalForParent`/`lockParentAndListTriggerIds` 구조는 `#1346`(a9288bf6e, 머지됨) 구현 그대로이고, stale 주석 후속(`trigger-release-stale-comments.md`)도 트래커상 2026-09-18 해소로 표시되어 있다. 선행 조건 미해소 없음.
3. **코드·spec 실측 정합** — `releaseExternalForParent` 는 `find({ where: parent })`(컬럼 전체, `select` 없음), `lockParentAndListTriggerIds` 는 `Workflow`/`Workspace` `pessimistic_write` 락 뒤 `find({ select: { id: true }, where: parent })` — draft 의 grep 표와 정확히 일치. `spec/2-navigation/2-trigger-list.md` §2.3.1(`workflowId` read-only)·§4.3(부모 잠금 뒤 열거 서술)도 draft 인용과 일치.
4. **식별자 충돌 없음** — `idx_trigger_workflow_id`·`V111` 은 저장소 전체 grep 0건(마이그레이션 디렉터리 최신 파일은 V110). 다른 `plan/in-progress/**` 어느 것도 V111 이나 동일 인덱스명을 선점하지 않는다.
5. **spec 문구 정합** — `spec/1-data-model.md` §3 의 Schedule 행(V106·V110) 서술 형식과 `## Rationale` "Schedule 인덱스 …(2026-09-04)" 절 구조가 draft 의 S1·S2 가 따르겠다는 선례와 일치. `spec/data-flow/10-triggers.md` §2.1 `trigger` 행의 "… 인덱스는 V002." 종결부도 S3 의 patch 대상과 정확히 일치.
6. **후속 항목 누락 없음** — draft 가 "같은 클래스 전수"로 찾은 FK 6개(`integration_usage_log`·`alert_rule`·`auth_config`·`knowledge_base`·`integration_oauth_state`·`integration_oauth_preview`)에 대해 다른 `plan/in-progress/**` 문서를 grep 했으나 겹치는 항목이 없다(`spec-sync-auth-gaps.md` 의 `auth_config` 언급은 audit action 타입 문제로 무관). 새 트래커 항목이 기존 항목과 중복되지 않는다.

## 요약
`spec-draft-trigger-workflow-index.md` 는 선행 트래커(`spec-draft-nullable-notation-followups.md`)의 정확한 부분집합(1·3번 불릿)만 닫고 미해결 항목(2번 불릿)은 명시적으로 남겨 두었으며, 선행 구현(#1346)·spec 서술·마이그레이션 번호 체계와 실측 대조 결과 모두 일치한다. 새로 발견한 FK 인덱스 부재 클래스(6개)도 기존 plan 과 중복되지 않게 별도 항목으로 분리했다. Plan 정합성 관점에서 구조적 결함은 발견되지 않았다.

## 위험도
NONE
