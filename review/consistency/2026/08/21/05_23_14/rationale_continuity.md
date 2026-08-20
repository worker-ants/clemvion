# Rationale 연속성 검토 — `spec/5-system/` (impl-done, eia-inputoverride-reject)

## 검토 범위·방법

diff-base `origin/main` 대비 spec 변경 7파일(`spec/1-data-model.md` · `spec/3-workflow-editor/3-execution.md` ·
`spec/4-nodes/7-trigger/1-manual-trigger.md` · `spec/5-system/{3-error-handling,12-webhook,13-replay-rerun,14-external-interaction-api}.md`)
을 `git diff origin/main...HEAD` 로 직접 열어 line-level 대조했다(prompt 번들이 컨텍스트 예산 초과로
`14-external-interaction-api.md` 등 핵심 파일 본문을 생략했으므로 워킹트리에서 절대경로로
재취득). 대응 코드(`reject-masked-resubmission.ts`·`trigger-parameter.types.ts`·`executions.service.ts`·
`workflows.controller.ts`)와 이 브랜치의 선행 plan 문서(`plan/complete/spec-draft-inputoverride-marker-reject.md`·
`plan/complete/spec-update-masked-reject-framing.md`) · 선행 11라운드 리뷰(`review/code/2026/08/21/*`,
`review/consistency/2026/08/2{0,1}/*`)도 대조해 "기각된 대안" 인용이 실제 이력인지 `git log`/`git show` 로
검증했다.

## 발견사항

없음 — CRITICAL·WARNING 모두 미발견.

target 은 §R17(`14-external-interaction-api.md`)이 이미 여러 라운드에 걸쳐 확립한 결정들을
정확히 계승한다:

- **기각된 대안을 재도입하지 않음**: (1) `resolveTriggerParameters` 결과만 검사하는 "직후 1회"
  방식 — `boolean` 완전 우회(`Boolean('***')→true`)로 이미 CRITICAL 이 났던 설계(커밋
  `50f799efd` 이전)를 target 은 raw-우선 2단계로 유지한다(`reject-masked-resubmission.ts`
  `resolveTriggerParametersRejectingMasked`, 실측). (2) 부분 포함 매칭(`a***b` 차단) — 프런트
  `isMaskedMarker` 가 이미 기각한 경계(근거: `review/consistency/2026/08/20/12_08_46/rationale_continuity.md`
  W1, `git show`로 실재 확인)를 target 코드 `hasMaskedLeaf`/spec 문구("정확 일치만") 모두 그대로
  따른다. (3) `coerce_failed` 코드 재사용 — `review/code/2026/08/20/17_38_33/{security,api_contract}.md`
  에서 실제로 제안됐던 대안(`git show`로 실재 확인)을 target 은 신규 `MASKED_VALUE_RESUBMITTED`
  코드로 명시적으로 기각·대체했고, 그 사유("사용자가 취할 행동이 다르다")를
  `trigger-parameter.types.ts` JSDoc·spec Rationale·CHANGELOG 세 곳에 일관되게 남겼다.
- **합의된 원칙 준수**: "공유 프리미티브(`resolveTriggerParameters`)를 넓히면 무관한 경로가
  오염된다" 원칙(§R17 기존 서술)을 그대로 지켜 새 거부 로직을 별도 wrapper
  (`resolveTriggerParametersRejectingMasked`)로 만들고 webhook(`hooks.service.ts`)·schedule
  (`schedule-runner.service.ts`) 호출부는 무변경으로 남겼다(diff stat 확인, 두 파일 미포함).
  마스킹의 "egress-only" 원칙(§R17 "내부 소비처는 faithful 텍스트 유지")과도 축이 다르다 —
  본 변경은 ingress(요청 검증)이지 egress 마스킹 자체를 바꾸지 않는다.
- **결정 번복에 새 Rationale 동반**: 2026-08-20 "카브아웃 폐지" 결정이 "닫는 조건 = 프런트
  마커 가드"로 서술했던 것을 이번 target 이 "서버 2층 거부"로 확장하면서, §R17 표에 행 추가
  + 범위 캐비엇(4개 문단) + `1-manual-trigger.md` 신규 `## Rationale` 항목
  (`masked_value_resubmitted` 검사 시점)을 함께 신설했다. 이 신규 Rationale 항목은 앞선
  라운드(`review/consistency/2026/08/21/00_55_25/rationale_continuity.md` INFO)가 "표 캐비엇
  한 줄로는 재발(다음 사람이 '직후'로 되돌림) 위험이 남는다"며 `## Rationale` 정식 항목 승격을
  제안했던 것과 정확히 같은 제목·위치로 반영됐다 — 그 INFO 가 해소됨을 확인했다.
- **자매 문서 동기화**: "재제출 경로 한정" → "Manual 실행 경로 한정(저작 주체 기준)" 프레이밍
  정정이 `3-error-handling.md`·`12-webhook.md`·`1-data-model.md` 세 자매 파일 전부에 반영됐다
  (grep 전수 확인, "재제출 경로" 잔존 1건은 §R17 표 안 과거형 서술로 무관 컨텍스트).
- **암묵적 가정과의 충돌 없음**: 마스킹 마커 3종이 Manual 파라미터 값 공간에서 "예약어"가
  되는 트레이드오프는 §R17 "알려진 제약" 문단에서 명시적으로 disclosure 됐고(은닉된 invariant
  위반이 아님), `RR-PL-02`(Re-run 원본 미리보기+편집 원칙)의 기존 예외 문장("마스킹된 값은
  프리필하지 않는다")과도 이미 정합돼 있었다.

## 요약

target(`inputOverride` 서버측 마커 거부, EIA §R17 관련 spec 7곳 변경)은 Rationale 연속성
관점에서 모범적이다 — 과거 세 차례 기각된 설계(직후-1회 검사·부분 포함 매칭·`coerce_failed`
재사용)를 재도입하지 않고 명시적으로 다시 기각·근거를 남겼으며, "공유 프리미티브 비오염"·
"egress-only 마스킹" 등 §R17 기존 원칙을 위반 없이 확장했다. 결정 번복(카브아웃 → 서버측
거부)에는 §R17 표·범위 캐비엇·`1-manual-trigger.md` 신규 `## Rationale` 항목이라는 다층
근거가 동반됐고, 자매 문서(§1.7·§1.3·데이터 모델) 간 프레이밍 drift 도 이번 target 자체가
정정했다. "기각된 대안"·세션 라벨 인용은 전부 `git show`로 실재를 확인했다(지어낸 이력 없음).

## 위험도

NONE
