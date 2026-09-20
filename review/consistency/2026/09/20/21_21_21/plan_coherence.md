# Plan 정합성 검토 — spec/2-navigation (impl-done, dup-delete-audit)

## 검토 개요

이 PR 은 `spec/2-navigation` 을 변경하지 않는다(scope 델타 0개 파일, 정상). 구현 diff(9파일/611줄)는
워크플로·워크스페이스 동시 DELETE 감사 중복(`plan/in-progress/dup-delete-audit.md`)을 고치며, 그 근거로
`spec/2-navigation/2-trigger-list.md` §4.4 의 기존 트리거 동시-삭제 계약("두 번째는 404")을 **선례**로
인용한다. 따라서 본 검토는 target(변경 없음)과 `plan/in-progress/**`(변경 있음, 특히
`dup-delete-audit.md` · `spec-draft-nullable-notation-followups.md`) 사이의 정합성에 집중했다.

## 발견사항

- **[WARNING]** target §4.4 "동시 삭제 → 두 번째 404" 가 확정 사실로 서술되지만, 그 근거로 쓰인
  선례 자체가 실측 미검증 상태로 open plan 에 남아 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md:318` (§4.4 결과·에러) — "동시 삭제: 두
    클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4753-4759` (미체크,
    developer, 2026-09-20 등재) — "`TriggersService.remove()` 도 동시 삭제에서 감사 행을 두 번
    남길 수 있다"
  - 상세: `plan/in-progress/dup-delete-audit.md` 는 착수 시점에 "트리거는 이미 §4.4 대로 동작한다"를
    선례로 인용해 워크플로 삭제를 그 선례에 맞추는 것으로 `spec_impact: none` 을 정당화했다(74-78줄).
    그런데 같은 plan 문서 안에서 리뷰 3라운드(`review/code/2026/09/20/21_07_19` requirement
    WARNING 1)가 이 인용을 **실측 없이 한 것**이라고 스스로 반증했다(80-85줄): 실제
    `TriggersService.remove()`(`codebase/backend/src/modules/triggers/triggers.service.ts:1060-1094`,
    이 워크트리에서 직접 확인)는 무락 `findById` → advisory lock(행 락 아님) → `m.remove(trigger)` →
    `recordAudit` 순서로, 이 PR 이 워크플로·워크스페이스에서 고친 것과 **동일한 결함 구조**(0행
    삭제도 던지지 않음)를 갖는다. 즉 두 번째 동시 요청이 실제로는 404 가 아니라 200 성공 + 중복
    감사로 끝날 가능성이 높다. 이 사실은 새 plan 항목(위 경로, 미체크)으로 정확히 등재됐지만, target
    문서 §4.4 에는 이 불확실성이 전혀 반영되지 않은 채 여전히 단정문으로 남아 있다 — 다음 사람이
    §4.4 를 다시 "선례"로 인용하면 같은 실측 누락이 반복된다.
  - 제안: (a) plan 항목이 실측·수정을 마칠 때까지 §4.4 에 "구현 검증 대기 — 상세는
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 참고" 류의 짧은 caveat 을 추가하거나,
    (b) 최소한 열린 plan 항목에 "실측 결과에 따라 §4.4 문구 정정 여부도 함께 판단" 을 명시해 spec
    정정 누락을 방지한다. 같은 문서가 이미 R-17 에서 "캐너리가 고정하는 것은 구현이지 계약이 아니다"
    류의 caveat 패턴을 쓰고 있어 선례가 있다.

- **[INFO]** tracker 의 종결 선언이 실제 plan 체크리스트보다 앞서 있다
  - target 위치: 해당 없음 (plan-plan 간)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4741-4751`
    (이미 `[x]` "2026-09-20 해소", `plan/complete/dup-delete-audit.md` 인용) vs
    `plan/in-progress/dup-delete-audit.md` 체크리스트(109-111줄) — `/ai-review → Critical/Warning 0`,
    `--impl-done → BLOCK: NO`, "트래커 항목 해소 + `plan/complete/` 이동" 세 항목 모두 아직 `[ ]`
  - 상세: `plan/complete/dup-delete-audit.md` 는 이 워크트리에 아직 존재하지 않는다
    (`plan/in-progress/dup-delete-audit.md` 만 있음, `find plan -iname '*dup-delete*'` 로 확인).
    `review/code/2026/09/20/21_07_19/RESOLUTION.md` 는 Critical 0 · Warning 3(전부 문서 성격, `codebase/**`
    수정 0) 으로 수렴을 확인했으므로 실질적으로는 완료에 근접했지만, 그 결과가 아직
    `dup-delete-audit.md` 자신의 체크박스에는 반영되지 않았다. 이 저장소 관례(체크와
    `plan/complete/` 이동은 한 동작, 마무리 커밋은 리뷰 뒤가 정상)를 따르면 이번 `--impl-done`
    세션(현재 이 검토)이 BLOCK: NO 로 끝난 뒤의 마무리 커밋에서 함께 처리될 것으로 보이나, 지금
    시점 기준으로는 tracker 의 완료 선언이 실제보다 앞서 있다.
  - 제안: push 전 마무리 커밋에서 `dup-delete-audit.md` 체크리스트 3항목 체크 + `plan/complete/`
    이동을 함께 수행해 tracker 의 "2026-09-20 해소" 서술을 실제 상태와 맞춘다.

- **[INFO]** `--impl-prep` W2 교차참조가 열린 항목의 칸이 아니라 이미 닫힌 항목의 칸에 붙었다
  - target 위치: 해당 없음 (plan-plan 간)
  - 관련 plan: `spec-draft-nullable-notation-followups.md:4492-4511` (열린 항목 "`trigger-config`
    advisory lock 이 남긴 developer 범위 후속" #1, 미체크) vs 같은 문서 `:4751`(닫힌 "동시 중복
    DELETE" 항목의 마지막 줄)
  - 상세: `dup-delete-audit.md` 의 `--impl-prep` 결과(65-70줄)는 "같은 헬퍼를 겨냥한 열린 설계
    항목과 교차 참조 — 트래커의 그 칸에 한 줄 남긴다" 를 요구했다. 실제로는 `{ parentPresence,
    triggerIds }` 반환 계약 변경 사실이 이미 **닫힌** "동시 중복 DELETE" 항목의 부기(4751줄)에
    적혔을 뿐, 정작 그 설계를 착수할 담당자가 볼 **열린 항목 #1**(4501줄 표 행)에는 이 전제 변경이
    언급되지 않는다. 정보 자체는 문서 안에 존재하므로 CRITICAL 은 아니지만, 항목 #1 만 보고
    착수하면 새 반환 계약을 놓칠 수 있다.
  - 제안: 항목 #1 표 행에도 "반환 계약이 `{ parentPresence, triggerIds }` 로 바뀜(`dup-delete-audit.md`,
    2026-09-20)" 한 줄을 직접 추가해 양방향 참조로 만든다.

## 요약

이번 PR 은 `spec/2-navigation` 자체를 바꾸지 않고, 그 안의 트리거 삭제 계약(§4.4)을 선례로 삼아
워크플로/워크스페이스 삭제 경로를 대칭으로 맞췄다. 그 과정에서 자체 리뷰가 그 선례를 "실측 없이
인용했다"고 스스로 반증했고, 이는 정확히 새 plan 항목으로 등재돼 있어 추적 체계 자체는 건전하다.
다만 target 문서 §4.4 는 여전히 그 불확실성을 반영하지 않은 단정문으로 남아 있어(WARNING), 다음
독자가 다시 무비판적으로 선례 인용을 반복할 위험이 있다. 그 외 두 건은 plan 문서 간 체크리스트·
교차참조 동기화가 아직 마무리 커밋 이전 단계에 있음을 보여주는 절차적 사안(INFO)으로, 병합을
막을 사유는 아니다.

## 위험도

LOW
