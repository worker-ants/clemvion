# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-prep: trigger-canary-hardening)

## 발견사항

- **[WARNING]** cross_spec 프롬프트 번들이 대상 corpus 의 98%를 절단 — 검증 커버리지 결손
  - target 위치: `_prompts/cross_spec.md` 전체 — `@bundle-file` 387개 중 **380개**가 `> ⚠️ 본문 생략됨 — 컨텍스트 예산 초과` 한 줄로 대체됨 (실측: python 스캔, 각 헤더 뒤 첫 비공백 줄 검사). 온전한 파일은 단 7개 — `spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, `spec/conventions/cafe24-api-metadata.md`, `spec/0-overview.md`.
  - 충돌 대상: 없음 — 콘텐츠 자체의 모순이 아니라 조립 파이프라인(예산 컷) 이슈.
  - 상세: `--impl-prep, scope=spec/conventions/` 인데도 절단은 `spec/conventions/` 산하뿐 아니라 **cross-spec 비교 대상인 `spec/` 나머지 전체**(`5-system/*`, `4-nodes/*`, `data-flow/*`, `2-navigation/*`, `3-workflow-editor/*`, `7-channel-web-chat/*` 등 300여 개)까지 예외 없이 한 줄로 잘렸다. 이 상태로는 이 세션의 실제 target 이 다른 영역과 충돌하는지 번들 내용만으로는 원칙적으로 판정할 수 없다. 기존에 기록된 `feedback_consistency_spec_mode_budget.md`("conventions 를 통째로 떨군다")보다 절단 범위가 더 넓다 — 이번엔 `spec/` 트리 전체가 사실상 파일명 목록으로만 남았다.
  - 제안: 이번 세션에서는 파일시스템 직접 읽기로 보완했다(아래 INFO 항목 참고) — plan(`trigger-canary-hardening.md`, `spec_impact: none`)의 실제 작업 범위가 `codebase/**` 로 좁아 보완 가능했다. 그러나 번들 예산 로직 자체(오케스트레이터의 `--impl-prep` 조립 스크립트)는 별도로 점검이 필요하다 — 특히 scope 밖 spec 영역까지 통째로 잘라내는 것이 의도된 동작인지, 아니면 `related_specs` 우선순위 배정이 누락된 것인지 확인 요망.

- **[INFO]** 확인된 정합 근거 — plan 실작업 항목과 기존 spec 결정 대조 (충돌 없음)
  - target 위치: `plan/in-progress/trigger-canary-hardening.md` §B 항목 1·2·4
  - 충돌 대상: `spec/conventions/secret-store.md §R4`("Trigger FK 미설정") · `spec/data-flow/10-triggers.md` L120 · `codebase/backend/src/modules/triggers/triggers.service.ts` L112-161
  - 상세: 번들 절단으로 확인 불가능했던 부분을 실제 리포지토리 파일 직접 열람으로 보완 대조한 결과, 아래 세 지점 모두 충돌 없음을 확인했다.
    1. **항목 4 (e2e teardown / `secret_store` 고아 row)**: `secret-store.md §R4` 는 `secret_store` 가 trigger FK 를 갖지 않으며 삭제 시 정리 책임이 **명시적으로 `TriggersService.delete()`(서비스 경로)** 에 있다고 이미 문서화하고 있다(`deleteByPrefix('secret://triggers/{id}/')`). plan 이 제시한 옵션 (a) "서비스 경로 삭제로 관례 변경" 은 이 기존 결정과 정합적이다 — 채택해도 spec 저촉 없음.
    2. **항목 2 (`schedule` 트리거의 `workflow` 양성 커버리지)**: `data-flow/10-triggers.md` L120 이 스케줄 처리 흐름에서 `trigger.workflow_id 없음` 을 이미 전제·분기 조건으로 서술하므로, `workflow_id`/관계가 schedule 트리거에도 존재한다는 plan 의 전제와 데이터 모델이 어긋나지 않는다.
    3. **항목 1 (트리거 비밀 컬럼 repo-guard 대상)**: 실제 코드에는 이미 두 개의 독립된 축이 분리 구현돼 있다 — top-level 컬럼 축(`TRIGGER_RESPONSE_STRIP_COLUMNS` = `notificationSecretV2`/`chatChannelTokenV2`)과 `config.interaction` 중첩 축(`INTERACTION_RESPONSE_STRIP_KEYS` = `triggerToken`, `secret-store.md` 의 `itk_*` 평문-JSONB 결정과 정합). plan 의 repo-guard 는 축1 두 컬럼만을 대상으로 하므로 축2 와 충돌하지 않는다.
  - 제안: 없음 (정보성 — 실제 착수 시 그대로 진행 가능).

## 요약

이번 target 은 신규 spec 정의(엔티티·API·요구사항 ID·상태 머신·RBAC·계층 책임)를 도입하지 않는다 — plan 이 명시한 대로 `spec_impact: none` 이며 작업 범위는 `codebase/**`(repo-guard, e2e 커버리지, 주석 정리, teardown) 에 한정된다. 따라서 원 관점(1~6)의 "target 이 다른 영역과 충돌"할 표면 자체가 거의 없다. 다만 이 세션에 제공된 cross-spec 비교 corpus 는 387개 파일 중 380개가 컨텍스트 예산으로 절단되어 있어 번들만으로는 결론에 도달할 수 없었고, 이를 파일시스템 직접 열람으로 보완해 plan 의 세 핵심 작업 항목(비밀 컬럼 스코프·schedule workflow 관계·secret_store teardown 소유권)이 기존 `secret-store.md`·`data-flow/10-triggers.md`·실제 서비스 코드와 정합함을 확인했다. 남은 리스크는 콘텐츠 충돌이 아니라 **검토 파이프라인의 커버리지 결손**(WARNING)이며, 이는 이 특정 plan 보다 넓은 범위(--impl-prep 번들링 로직)의 개선 사항이다.

## 위험도

LOW
