# Plan 정합성 검토 — `spec-draft-inputoverride-marker-reject.md`

## 발견사항

- **[WARNING]** re-run 엔드포인트 자체의 에러 카탈로그(§8.1)가 target 의 "spec 변경 3곳"에 없다
  - target 위치: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` §"에러 계약" ·
    §"spec 변경 3곳" (1~3번 목록, `13-replay-rerun.md §10.2` 만 등재)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W6
    (`inputOverride` 서버측 마커 리터럴 거부) — "착수 시 두 가지를 함께 한다: (1) 서버측
    체크, (2) planner 턴으로 §R17 에 범위 문장 추가"
  - 상세: target 이 거부 대상 1순위로 지목한 호출부는 `executions.service.ts:493` (re-run)
    이다. 그런데 `spec/5-system/13-replay-rerun.md` §8.1(실측: 236~246행)은 이 호출부의
    에러 계약을 이미 별도 표로 갖고 있다 — `400 INVALID_INPUT` 행이 *"`inputOverride` 가
    Manual Trigger parameters 스키마와 충돌 (`resolveTriggerParameters` 가 던지는 동일
    에러)"* 라 적는다. 이는 execute 경로의 `INVALID_TRIGGER_PARAMETERS` 와 **다른 top-level
    코드명**이다. target 은 "봉투는 기존과 같다 — `INVALID_TRIGGER_PARAMETERS`(execute) ·
    re-run 경로의 400" 이라고만 적어 re-run 쪽 실제 코드명(`INVALID_INPUT`)을 명시하지
    않았고, §8.1 의 그 표 행에 새 `details[].code`(`MASKED_VALUE_RESUBMITTED`)가 실린다는
    사실도 반영 대상에서 빠졌다.
    추가로 `3-error-handling.md §1.7`(188행)의 "동일 헬퍼를 쓰는 소비처" 서술 문장은 현재
    *"Manual 실행 경로(`POST /:id/execute`)와 저장 경로(`POST /:id/save`)"* 만 나열하고
    **re-run 은 이미 빠져 있다** — target 이 이 문장이 있는 §1.7 을 직접 편집하면서도 이
    선존 누락을 건드리지 않으면, 새 코드를 추가한 시점에 "이 헬퍟를 누가 쓰는가" 목록이
    한 번 더 stale 해진다.
  - 제안: target 의 "spec 변경 3곳"에 `13-replay-rerun.md §8.1` 표 갱신(코드명 `INVALID_INPUT`
    명시 + `details[].code` 참조)을 4번째 항목으로 추가하거나, 3번(§10.2) 범위에 §8.1 을
    포함하도록 명시한다. `3-error-handling.md §1.7`(188행) 문장에 re-run 을 소비처로 추가하는
    것도 같은 편집에서 함께 한다(target 이 어차피 그 줄을 여는 참이라 한계비용이 낮다 —
    이 저장소가 반복 기록한 "같은 파일을 열었을 때 자매 결함을 같이 줍는다" 패턴과 부합).

- **[WARNING]** target 이 "함께 확인된 사실"로 든 근거가 다른 plan 의 미해결 체크박스를
  실질적으로 답하는데 그 항목이 갱신되지 않았다
  - target 위치: `plan/in-progress/spec-draft-inputoverride-marker-reject.md`
    §"왜 지금인가" — *"함께 확인된 사실 — 저장소 밖에서 `GET /api/executions*` 의
    `inputData` 를 직접 소비하는 것은 없다(프런트가 유일 소비자)"*
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    — *"`Execution.inputData` 응답 의미 반전의 외부 소비자 확인"* (2026-08-20 등재,
    `14_44_08` W5, 체크박스 `[ ]` 미해결) — *"존재 여부를 확인하고, 있으면 릴리스 노트에
    breaking 으로 공지"*
  - 상세: W5 는 정확히 같은 엔드포인트(`GET /api/executions*`)의 `inputData` 를 읽는 저장소
    밖 소비자가 있는지를 묻는 미해결 조사 항목이다. target 이 같은 날(2026-08-20) 같은
    엔드포인트에 대해 *"직접 소비하는 것은 없다"* 를 사실로 못박았다면, 이는 W5 가 요구한
    조사 결과와 사실상 동일한 답이다. 그런데 target 은 이 확인을 자신의 안전성 근거로만
    쓰고 W5 체크박스를 닫거나 그 근거를 W5 자리에 옮겨 적지 않았다 — 이 트래커 파일이
    이미 여러 차례("유예의 근거로 '등재했다' 를 쓸 때 그 등재를 확인하라") 반복 지적한
    형태(반대 방향: 확인은 됐는데 등재가 안 됨)와 유사한 갭이다. 두 항목의 질문이 진짜
    동일한지(W5 는 "읽기"만 묻고 target 은 "왕복 재제출" 안전성을 위해 인용) 애매하므로,
    확인 자체가 없었을 가능성(즉 target 의 "확인된 사실"이 실측 없는 재진술)도 배제할
    수 없다.
  - 제안: (a) 실제로 2026-08-20 에 외부 소비자 부재를 확인했다면 그 근거(확인 방법·범위)를
    W5 체크박스 자리에 옮겨 적고 닫는다. (b) target 의 "확인된 사실" 문장이 별도 확인 없이
    §R17 마커 가드 논의에서 파생된 추정이라면, target 문서에서 "확인된"이라는 단정적
    표현을 낮추고 W5 를 여전히 미해결로 인용해야 한다 — 어느 쪽이든 두 문서가 같은 사실을
    다르게 취급하는 현재 상태로 두면 안 된다.

## 요약

target(`spec-draft-inputoverride-marker-reject.md`)은 트래커
`spec-sync-external-interaction-api-gaps.md` W6 이 요구한 "(1) 서버측 체크 (2) planner 턴
§R17 범위 문장" 두 축을 정확히 따르고, §R17 본문에 실제로 "UI 정상 흐름 한정" 캐비엇이
없다는 전제(§"왜 지금인가")도 spec 원문 대조로 확인된다. `coerce_failed` 미재사용·정확
일치만 감지·깊이 상한 순서 등 핵심 결정도 선행 plan(트래커의 유예 근거 반증)과 정합하고,
webhook/schedule 을 거부 대상에서 뺀 판단은 webhook ingestion 의 기존 `[REDACTED]` 마커
관용구(다른 완료 항목)와도 충돌하지 않는다. 다만 target 이 명시한 "spec 변경 3곳"은 re-run
엔드포인트 자체의 기존 에러 카탈로그(`13-replay-rerun.md §8.1`, `INVALID_INPUT` 행)와
`3-error-handling.md §1.7`(188행)의 소비처 나열 문장(re-run 누락)까지는 닿지 않아, 이
저장소가 반복 지적해 온 "같은 결정을 미러 자리 한 곳만 반영" 패턴이 재발할 소지가 있다.
또한 target 이 안전성 근거로 든 "외부 소비자 없음" 확인이 같은 트래커의 미해결 W5 항목과
사실상 같은 질문에 답하면서도 그쪽을 갱신하지 않는 점도 plan 동기화 갭이다. 두 건 모두
결정 자체를 뒤집는 수준은 아니고 sibling 문서·체크박스 반영 누락이라 WARNING 수준이다.

## 위험도

MEDIUM
