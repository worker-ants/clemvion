# Plan 정합성 검토 — target `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`(변경 F, `--spec` 후 반영분)

## 검토 범위

본 draft 의 변경 A~E 는 앞선 `--spec`(`review/consistency/2026/09/19/18_56_41`, BLOCK: NO)을 거쳐 커밋
`c8dd613e0` 이 이미 spec 5개 파일에 반영했고, 그 반영 상태는 직후 `--impl-prep`(`review/consistency/2026/09/19/19_11_16`)
의 plan_coherence 세션(NONE)이 이미 대조를 마쳤다. 이번 라운드가 새로 판정할 대상은 draft 자신에 그 뒤
추가된 **「F. 구현 착수 뒤 추가」 두 줄**이다 — ① `spec/1-data-model.md` frontmatter `code:` 에 아직 없는
e2e 파일(`webhook-endpoint-reservation.e2e-spec.ts`) 한 줄 예고, ② 같은 문서 Rationale에 "UI 고지를
더하지 않았다" 는 신설 하지 않은 것" 줄.

## 발견사항

(없음 — CRITICAL/WARNING 없음)

## 교차 확인한 항목 (충돌 없음)

- **F①(frontmatter `code:` 예고)과 기존 spec 상태 대조**: `spec/1-data-model.md` 현재 frontmatter `code:`
  목록(`deletion-cascade-indexes.e2e-spec.ts` · `trigger-endpoint-path-dedupe.e2e-spec.ts` ·
  `entity-schema-declarations.e2e-spec.ts`)에는 아직 `webhook-endpoint-reservation.e2e-spec.ts` 가 없다
  — draft 의 체크리스트(`- [ ] 변경 F — --spec 후 반영`)와 정확히 일치하는 미반영 상태이며, F 는 "아직
  없는 e2e 파일을 먼저 `code:` 에 적는" 순서를 스스로 명시해 뒀다(같은 문서 Rationale
  «`code:` 에 전용 e2e 가드 셋» 이 "새 전용 가드는 그 가드를 만드는 PR 이 여기에 더한다" 고 이미
  예약해 둔 자리 — 1051~1061행 실측 확인). 새로운 결정을 우회 내리는 것이 아니라 기존 관례를 따른다.
- **F②(UI 고지 미추가)와 그 출처**: `review/consistency/2026/09/19/19_11_16/SUMMARY.md` INFO #1 이
  "필수는 아님. 추가하거나, 추가하지 않기로 한다면 근거를 Rationale 인접에 짧게 남길 것" 이라 제안했고,
  F② 는 그 INFO 를 정확히 그 방식(추가하지 않기로 결정 + 근거)으로 닫는다. 현재
  `spec/2-navigation/2-trigger-list.md` §4.2 webhook 행("...즉시 404가 됩니다")과 §2.3.1 `endpointPath`
  행(409 `RESOURCE_CONFLICT` 서술만 있고 소유자 대상 사전 고지는 없음)을 직접 확인해, F② 의 "달라지는
  것이 없다"는 전제(옛 URL 404·같은 워크스페이스 재사용 가능 그대로, 다른 워크스페이스로 옮기려는
  시도는 그 자리 409 가 알림)가 실제 문서 상태와 부합함을 확인했다 — 지어낸 근거가 아니다.
  이는 「결정 필요」로 남겨진 항목에 대한 우회가 아니라 **선택적 INFO 권고**에 대한 처분이므로 미해결
  결정과의 충돌에 해당하지 않는다.
  - INFO #1 (F②) — F 가 대체하지 않고 유지한 원출처 흔적을 후속 세션이 다시 "미해소"로 재-flag 하지
    않도록 남긴다: `spec/2-navigation/2-trigger-list.md` §4.2·§2.3.1 에는 F② 반영 후에도 "다른
    워크스페이스는 영구 예약" 문구가 사용자 대상 UI 텍스트로는 여전히 없다 — 이것은 이번 검토가
    의도된 것으로 확인한 상태이며 재조사가 필요한 결함이 아니다.
- **F 가 새로 여는 미해결 결정 없음**: F 두 줄 모두 이미 완료된 `--impl-prep` 라운드의 INFO 를 닫는
  성격이며, 다른 `plan/in-progress/**` 문서가 "결정 필요"로 남겨 둔 항목과 겹치는 지점이 없다 —
  `spec-draft-nullable-notation-followups.md:4644-4649`(이 draft 가 닫으려는 선행 트래커)의 4가지
  「결정할 것」은 F 이전(변경 A/설계/비대상)에서 이미 전부 해소돼 있고, F 는 그 결정들을 재론하지
  않는다.
- **선행 plan 미해소 여부**: F 가 전제하는 것(A~E 가 이미 spec 에 반영돼 있다는 사실, `code:` 관례가
  기존에 확립돼 있다는 사실)은 모두 이미 완료된 커밋/plan(`c8dd613e0`, `plan/complete/spec-draft-code-guards-and-change-summary.md`)
  으로 충족돼 있다 — 선행 조건 미해소 없음.
- **후속 항목 누락 여부**: F 는 draft 자신의 체크리스트("변경 F — `--spec` 후 반영")에만 영향을 주고,
  다른 in-progress plan 의 후속 항목을 무효화하거나 새로 만들 필요가 있는 변경이 아니다(전수 grep —
  `webhook_endpoint_reservation`·`endpoint_path`·`tombstone`·`TRIGGER_ENDPOINT_PATH_CONFLICT` 로
  `plan/in-progress/**` 를 훑어 이 draft 자신과 선행 트래커 항목 외에 F 의 두 줄과 겹치는 다른 진행 중
  항목은 없음을 확인).
- **버전 번호 충돌 없음**: F 가 참조하는 `V133` 마이그레이션 번호는 저장소 실제 마이그레이션
  (`codebase/backend/migrations/`, 최신 V132)과 다른 in-progress plan(전수 grep, 매치는 이 draft
  자신뿐) 어디에서도 선점되지 않았다.

## 요약

이번 라운드가 새로 판정할 대상인 「F. 구현 착수 뒤 추가」 두 줄은 직전 `--impl-prep`
(`review/consistency/2026/09/19/19_11_16`)이 남긴 선택적 INFO(UI 고지 여부 결정)를 정확히 그 방식대로
닫고, 이미 확립된 문서 관례(`code:` 전용 e2e 가드는 그 가드를 만드는 PR 이 추가)를 따를 뿐 새로운
결정을 우회 내리지 않는다. draft 가 닫으려는 선행 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md:4644`)의 미해결 결정 4건은 F 이전 단계에서
이미 전부 해소돼 있어 F 와는 무관하고, F 로 인해 새로 열리거나 무효화되는 다른 in-progress plan 의
후속 항목도 없다. 트래커 체크박스·draft 자신의 구현/트래커-해소 체크리스트가 아직 미완인 것은
`--impl-prep` 라운드에서 이미 "정상적인 spec-first 순서" 로 판정된 사안이며 F 가 그 판단을 바꾸지
않는다.

## 위험도

NONE
