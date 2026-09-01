# Plan 정합성 검토 — `spec-draft-audit-resource-type-count.md`

## 발견사항

- **[WARNING]** `spec-sync-auth-gaps.md` 체크박스가 target 이 아직 적용하지 않은 spec 반영을 이미 완료로 표시
  - target 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` §변경 제안 —
    `spec/5-system/_product-overview.md` §5 NF-OB-07 카탈로그 표 "실측 12종 → 실측 10종"은
    아직 **미적용 제안**으로 서술되어 있다 (developer 는 `spec/` write 권한이 없어 이 target
    자체가 그 write 를 게이팅하는 `--spec` consistency-check 입력이다).
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` L129 (작업 트리에 아직 커밋되지 않은
    수정 — `git diff` 로 확인) — 신설된 체크박스
    `- [x] resource_type "실측 12종" 오기산 정정 → 10종 (2026-09-01)... spec·JSDoc·plan 2곳
    전파분 동반 정정.`
  - 상세: 실측 확인 결과 같은 오기산이 퍼진 4곳 중 **3곳은 이미 정정됐다**
    (`codebase/backend/src/modules/metrics/business-metrics.service.ts` JSDoc,
    `plan/in-progress/spec-sync-auth-gaps.md` 자체 서술, `plan/complete/spec-draft-audit-write-failed-metric.md`
    — 전부 작업 트리 uncommitted diff 로 확인). 그러나 **주 위치인
    `spec/5-system/_product-overview.md` L91 은 여전히 "실측 12종"** 이다(`grep` 재확인,
    working tree 상 수정 없음 — `git status` 에도 안 잡힘). 그런데 위 체크박스는 "spec·JSDoc·
    plan 2곳 전파분 동반 정정" 을 **`[x]` 완료**로 적어, "spec" 항목까지 이미 고쳐진 것처럼
    읽힌다. 이 세션(`review/consistency/2026/09/01/16_16_39`)은 바로 그 spec 반영 직전에
    돌아가는 `--spec` 게이트이므로 지금 시점에 spec/ 미적용 자체는 정상이지만, 체크박스
    문구가 그 미적용 상태를 반영하지 않는다 — 이 턴이 spec 반영 없이 커밋되면(예: 이 라운드에서
    다른 checker 가 Critical 을 내 planner 가 재작업하거나, 세션이 여기서 끊기는 경우) plan
    트래커에는 "완료" 로 남고 `spec/5-system/_product-overview.md` 는 계속 틀린 채로 방치되는
    괴리가 생긴다. (`plan 체크박스 = 실제 상태` 원칙 — 수행 후에만 체크.)
  - 제안: 이번 planner 턴에서 `spec/5-system/_product-overview.md` 실제 반영까지 마쳐
    체크박스 문구를 사실로 만들거나(권장 — 이미 3/4 완료된 changeset 이라 마무리 비용이 작다),
    그게 이번 턴에 안 된다면 `spec-sync-auth-gaps.md` L129 체크박스 문구에서 "spec" 을
    "spec(반영 대기 — `spec-draft-audit-resource-type-count.md` 게이트 통과 후)" 처럼 조건부로
    바꿔 완료 범위를 companion 3곳으로 좁혀야 한다.

## 요약

target(`spec-draft-audit-resource-type-count.md`)이 `plan/in-progress/**` 의 미해결 결정과
정면으로 충돌하는 지점은 없다 — "클램핑 유지, 닫힌 유니온 기각" 이라는 기존 설계 결론을
번복하지 않는다고 명시하고, `spec-sync-auth-gaps.md` 의 다른 열린 항목(`workflow.executed`
보존 정책 유예, `login_history` 축 미결, `clampLabel` 대칭 테스트 INFO 등)과도 겹치지 않는다.
target 이 명시한 "동반 정정 3곳" 은 실제로 이미 작업 트리에 적용되어 있어 target 서술과
정확히 일치했다(파일 수 12 vs distinct 값 10 이라는 근거·10종 목록·설계 결론 불변 논거가
JSDoc·`spec-sync-auth-gaps.md`·`plan/complete/spec-draft-audit-write-failed-metric.md` 세 곳
모두에서 동일하게 재현됨). 유일한 갭은 진행 순서 상의 것으로, `spec-sync-auth-gaps.md` 에
새로 붙은 체크박스가 아직 미적용인 spec 본체 반영까지 "완료" 로 선언하고 있어 이번 턴에서
실제 spec 반영이 누락된 채 커밋되면 plan 이 거짓 상태를 남긴다. `plan/in-progress/**` 전수
검색(`resource_type`/`resourceType`/`write_failed`/`AuditLogsService`/`clampLabel`) 결과
이 주제와 관련된 다른 in-progress plan 은 없어 후속 항목 누락(관점 3)의 다른 사례는
발견되지 않았다.

## 위험도

LOW
