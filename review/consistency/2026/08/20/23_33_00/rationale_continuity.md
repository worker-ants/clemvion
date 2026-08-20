# Rationale 연속성 검토 — `spec/5-system/` (`inputOverride` 서버측 마커 거부 spec 초안)

## 대상 변경 요약

`origin/main` 대비 spec-only diff. `Execution.inputData` re-submission 경로(re-run `inputOverride` ·
manual execute 파라미터)에서 값 leaf 가 egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)와
정확히 일치하면 서버가 `400` `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부하도록 명문화.
건드린 문서: `14-external-interaction-api.md`(§R17) · `3-error-handling.md`(§1.3·§1.7) ·
`13-replay-rerun.md`(§8.1·§10.2) · `1-manual-trigger.md`(§6) · `1-data-model.md`(§2.14) ·
`3-workflow-editor/3-execution.md`(§2.2) · `12-webhook.md`(§5.2).

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 찾지 못했다.

검토한 항목:

1. **기각된 대안의 재도입 여부** — 확인 대상 없음. 오히려 target 자체가 `coerce_failed` 재사용·
   부분-포함 매칭 두 대안을 **명시적으로 기각**하고 근거를 적었다(`spec-draft-inputoverride-marker-reject.md`
   "기각한 대안" 절, EIA §R17 "보장의 경계 — 정확 일치만 감지한다"). 기각 이력은 실제 리뷰 세션
   (`review/code/2026/08/20/17_38_33/{api_contract,security}.md`, `review/consistency/2026/08/20/19_34_37/`,
   `19_48_56/`)에 grounding 이 있음을 실측 확인했다 — 지어낸 이력이 아니다.

2. **합의된 원칙 위반 여부** —
   - `error-codes.md §2` rename-stability: 기존 `INVALID_INPUT` 코드명은 유지하고 `details[].code`
     에 신규 항목(`MASKED_VALUE_RESUBMITTED`)만 추가 — rename 이 아니라 확장이라 위반 없음. §1.3 에
     추가된 각주("`RERUN_` prefix 미부여는 §2 상 유지")도 실제 §2 문언과 일치.
   - EIA §R17 "round-trip 되는 값만 카브아웃/가드 대상" 축과 "boundary parity"(마스킹 범위=수신
     인구) 축은 이 변경에서 서로 다른 메커니즘(마스킹 범위 vs. 재제출 거부 범위)에 각각 적용되며,
     문서 스스로 "두 사례는 이제 같은 갈래(마커 가드)이고 도달한 경로만 다르다" 로 구분해 서술 —
     혼동 없음.
   - `resolveTriggerParameters` 공유 함수 내부가 아니라 호출부(re-run·execute 2곳)에서 거부하는
     설계는, 같은 문서가 다른 곳(§1.3 `X-Workspace-Id` 검증)에서 "소비처가 둘이면 헬퍼 1곳에서
     throw"라고 한 것과 표면적으로 다른 방향처럼 보이지만 원칙이 다르다 — 그 사례는 **동일 동작을
     요구하는 두 소비처의 우발적 분기 방지**가 목적이었고, 본 건은 **의도적으로 webhook/schedule
     과 다른 동작이 필요**한 경우라 호출부 판정이 맞다. target 문서(EIA §R17)가 이 구분을 "판정
     기준은 값의 성질이 아니라 출처의 성질" 로 명시해 자기 정합적이다.
   - `resolveTriggerParameters` 실제 호출부 5곳(`executions.service.ts:493` · `workflows.controller.ts:314` ·
     `hooks.service.ts:183` · `schedule-runner.service.ts:78,88`)을 grep 으로 재확인 — plan 의 "5곳"
     실측 주장과 일치, 대상 2곳/제외 2곳(webhook·schedule) 분류도 정확하다.

3. **결정의 무근거 번복 여부** — `Execution.inputData` 마스킹 카브아웃(2026-08-20 이전 결정)을
   닫는 이번 변경은 새 Rationale 을 **함께** 작성했다(§R17 "닫는 조건은 충족됐다" 절이 프런트
   3소비처 + 서버 표를 갱신). 번복이 아니라 §R17 이 미리 명시했던 "닫는 조건"의 충족을 그대로
   실행한 것 — 조건("프런트가 마스킹 마커를 감지해 재입력을 강제하는 가드")은 이미 문서에
   존재했고 이번 변경이 그 조건표에 네 번째(서버) 행을 더했을 뿐이다.

4. **암묵적 가정 충돌 여부** — 없음. `deepRedactSecrets` 는 이미 마스킹된 값을 재마스킹하지 않는다는
   기존 invariant("egress 층은 ingestion 층의 마커를 덮지 않는다")와, 이번에 추가되는 "마커
   정확 일치 시 거부" 판정은 같은 마커 어휘(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)를 공유하도록
   서술돼 있어 어긋나지 않는다.

부수적으로 확인한 점(발견사항 아님, 참고): `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
의 관련 체크박스는 "spec 명문화만으로 닫지 않는다 — 구현이 머지될 때 닫는다"로 명시돼 있어, 이번
docs-only 커밋이 완료를 참칭하지 않는다(plan 체크박스=실제 상태 규약 준수).

## 요약

target 은 `Execution.inputData` 재제출 마스킹 카브아웃을 닫는 기존 §R17 결정의 연장선에서, 서버측
2차 방어(`MASKED_VALUE_RESUBMITTED`)를 추가하는 spec 초안이다. 과거 Rationale 에서 명시적으로
기각된 대안(코드 재사용·부분-포함 매칭)을 재도입하지 않았고, 오히려 그 기각 이유를 문서에 반복
서술했다. 합의된 설계 원칙(rename-stability, egress-only 마스킹, round-trip 축, boundary parity)과
충돌하지 않으며, 결정 번복(카브아웃 폐쇄)에는 새 Rationale 이 함께 갱신됐다. 이 변경 자체가 이미
같은 세션 내 여러 라운드의 review(`17_38_33`·`19_34_37`·`19_48_56`)를 거쳐 봉투 버그·근거 출처
누락 등 실질 결함을 처분한 뒤의 상태이며, 독자적으로 재검토한 결과 추가로 지적할 CRITICAL/WARNING
은 없었다.

## 위험도

NONE
