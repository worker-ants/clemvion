# Plan 정합성 검토 — target: `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

이번 diff 는 `codebase/backend/src/modules/websocket/` 4개 파일에 국한된다:

- `websocket-events.types.ts` — `NotificationEventType` → `InAppNotificationEventType` 개명
- `websocket.service.ts` — re-export/사용처 갱신
- `websocket-events.types.spec.ts` — `hasDefaultExport()` 헬퍼로 세 형태(`ExportAssignment` ·
  default modifier · `NamedExports` `as default` 별칭) 소진 + `canHaveModifiers` 가드 교체 +
  합성 소스 테이블 테스트
- `triggers/dto/notification-config.dto.ts` — disambiguation JSDoc 갱신

`plan/in-progress/ws-event-types-extract.md` (정본 트래커, 본 worktree 소속)의 `## 후속 (이 PR
범위 밖) > 그 밖` 절이 이 두 항목(`NotificationEventType` 개명, `hasDefaultExport`/
`canHaveModifiers`)을 **"완료 (2026-08-29, `ws-event-types-followups`)"** 로 이미 갱신해
두었고, 그 서술이 diff 내용과 정확히 일치한다 (6곳 개명, 세 형태 표, 근거까지 동일).

## 검증한 것

1. **spec 영향 주장 재검증** — plan 은 "spec 은 이 이름을 인용하지 않는다(`grep -rn
   NotificationEventType spec/` → 0건) → spec 변경 불요" 라고 적었다. 실측(`grep -rn
   "NotificationEventType\|InAppNotificationEventType" spec/`)으로 **양쪽 다 0건**임을
   확인 — 개명 전후 어느 이름도 spec 에 없다. `spec/data-flow/` 번들 전체에서도 두 이름
   미검출. 주장은 참이고, target(`spec/data-flow/`) 에 반영 누락은 없다.
2. **다른 in-progress plan 의 line-anchor staleness** — `websocket.service.ts:<line>` /
   `websocket-events.types.ts:<line>` 형태의 절대 라인 인용이 이번 diff 로 새로 stale
   해지는지 확인. 번들 전수 grep 결과 남은 인용은 `websocket-events.types.ts:26`
   (R10 문구 위치, `node-output-redesign/…` 계열이 아니라 `ws-event-types-extract.md` 자신의
   기록) 하나뿐이고, 이번 diff 의 변경 지점(`@@ -210,18 +210,25 @@` 부근)보다 훨씬 앞이라
   영향 없음. 3개 자매 in-progress plan(`node-output-redesign/background.md` ·
   `spec-draft-eia-62-waiting-payload.md` · `spec-draft-eia-notification-payload-contract.md`)은
   선행 PR(#1175)에서 이미 심볼 기준 인용으로 전환됐고, 이번 diff 는 새 절대 라인 인용을
   추가하지 않는다.
3. **미해결 결정과의 충돌 여부** — `spec-draft-eia-notification-payload-contract.md`(별도
   worktree `eia-r8-cache-scope-4ae434`)는 종결 이벤트 payload 구조(webhook 화이트리스트인
   `NotificationEventType`, `triggers/dto` 쪽)를 다루지만, 이번 diff 는 그 타입을 건드리지
   않는다(disambiguation JSDoc 문구만 갱신, "무관" 판정 자체는 원래도 있었고 이번엔 이름으로
   더 명확해졌을 뿐). 두 plan 사이 결정 충돌 없음.

## 발견사항

- **[INFO]** `ws-event-types-extract.md` 의 `plan/complete/` 이동이 여전히 막혀 있음 (target 과 무관, 참고용)
  - target 위치: 해당 없음 (`spec/data-flow/` 자체는 영향받지 않음)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` `## 체크리스트` 마지막 미체크 항목
    (`- [ ] **plan/complete/ 이동 시 spec_impact 갱신**`)
  - 상세: 이 plan 은 이미 머지된 PR #1175 의 정본 트래커이고, `spec/conventions/egress-masking.md:89`
    의 dead link(이 plan 파일을 가리킴)가 `complete/` 이동을 막고 있다. plan 자신이 "그 캐비엇
    문구는 developer 가 아니라 planner 턴 산출(`bdcfdc514`)이라 CLAUDE.md 자기-반증형 소정정
    조건 1 을 불충족 → 남은 것은 planner 턴 하나" 라고 이미 정확히 진단·기록해 두었다.
    이번 리뷰가 대상으로 하는 `spec/data-flow/` 와는 직접 관련이 없고(그 캐비엇은
    `spec/conventions/`), 이번 diff(개명·테스트 하드닝)가 이 상태를 악화시키거나 우회하지도
    않는다 — 새로 발견한 문제가 아니라 plan 자체가 이미 정확히 self-track 중임을 확인한 것.
  - 제안: 조치 불요. 다음 planner 턴에서 `egress-masking.md:89` 캐비엇 처리 + plan
    `complete/` 이동을 함께 처리하면 된다 (이미 plan 에 그렇게 적혀 있음).

## 요약

이번 diff(백엔드 WS 이벤트 타입 개명 + 테스트 하드닝 4파일)는 그 자체로 spec 을 인용하지
않는 순수 개명·테스트 리팩터이며, 소유 plan(`ws-event-types-extract.md`)이 이미 같은 날짜에
동일한 diff 내용을 "완료" 로 정확히 갱신해 두어 target(`spec/data-flow/`)과 plan/in-progress
사이에 충돌·누락된 후속 항목·미해소 선행 조건이 없다. plan 이 스스로 기록한 별도의
"`complete/` 이동 차단(planner 턴 필요)" 항목은 이번 diff 와 무관한 기존 이슈이며 이미
정확히 진단·추적되고 있어 재차 지적할 필요가 없다.

## 위험도
NONE
