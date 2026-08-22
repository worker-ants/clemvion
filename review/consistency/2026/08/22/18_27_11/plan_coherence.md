# Plan 정합성 검토 — `plan/in-progress/spec-draft-egress-masking-convention.md`

## 발견사항

- **[WARNING]** "마스킹은 한 번" 규율이 미검증 전제 위에 세워진다
  - target 위치: `## 마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다` 섹션(줄 136~148). "소유한다"
    목록 3번 — *"마스킹은 한 번 — 그 뒤 단계가 마커를 덮지 않는다는 순서 계약"*
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` `## 후속 (이 PR 범위 밖) > ### 그 밖` —
    `[ ] TerminalErrorPayload 를 채우는 호출부의 sanitizeErrorMessage 경유 여부 전수 확인
    (19_27_37 INFO2 — 기존 설계이고 이번 diff 와 무관)`
  - 상세: target 은 "마스킹은 한 번"을 정식 규율로 명문화하면서 근거를
    `WebsocketService.toFanoutEnvelope` 의 호출 순서(`maskWireEnvelope` → `stripExternalOnlyFields`
    → `attachRoutingContext`) 하나만 제시한다. 그런데 이 규율이 실제로 지켜지는지 여부는
    "`TerminalErrorPayload` 를 채우는 **모든** 호출부가 `sanitizeErrorMessage` 를 경유하는가"에도
    달려 있고, 그 전수 확인은 자매 plan 에 아직 `[ ]`(미완료)로 남아 있다. 확인되지 않은 채로
    "규율"이라는 확정형 문구로 정식 conventions 문서에 박제하면, 추후 검증에서 경유하지 않는
    호출부가 발견될 경우 문서가 실제와 어긋나는 상태로 출발하게 된다.
  - 제안: (a) target 작업 항목에 위 전수 확인을 선행 조건으로 명시하거나, (b) 문서에 "이 순서
    계약은 `toFanoutEnvelope` 경로에 한정해 확인됐다"는 범위 caveat 를 추가해 미검증 부분과
    확인된 부분을 구분한다.

- **[WARNING]** 좌표계 표의 "소비처" 열이 자매 plan 의 통합 작업으로 stale 해질 수 있는데
  target 이 이를 언급하지 않는다
  - target 위치: `## 실측한 좌표계` 표 2행(`MAX_REDACT_DEPTH` 소비처: `deepRedactSecrets`)·5행
    (`stripExternalOnlyFields` 호출부 "`InteractionService` 공개 표면 조립부" · `toFanoutEnvelope`)
    및 `## 작업` 체크리스트의 신설 문서 항목
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 미체크 항목
    `[ ] inputData 마스킹 게이트 4곳을 단일 헬퍼로 통합 (2026-08-20 등재, 14_44_08 W4)` —
    `toResponseExecution` · `toExecutionDto` · 노드 레벨 `maskIfPresent` 루프 ·
    `background-runs.service.ts` 를 `redactExecutionFields(row)` 공유 헬퍼 또는 interceptor 로
    통합 검토 중
  - 상세: target 은 좌표계 표를 "실측 출처를 가지되 심볼 기준"으로 고정하겠다고 명시했다(검증
    기준 3번째 항). 그런데 이 W4 항목이 실행되면 표가 지금 가리키는 개별 호출부 심볼(예:
    `InteractionService` 공개 표면 조립부)이 단일 헬퍼로 흡수되어 사라질 수 있다. target 의
    Rationale 은 "좌표계를 기계가 검사하게 하는 것은 범위 밖이며 문서가 stale 해지는 실패
    모드는 남는다"고 **일반론**으로만 인정할 뿐, 이 **구체적으로 이미 등재된** 트리거(W4)는
    언급하지 않는다.
  - 제안: target 신설 문서 또는 `spec-sync-external-interaction-api-gaps.md` W4 항목 어느
    한쪽에 상호 참조를 남겨, W4 착수 시 `egress-masking.md` 좌표계 표(특히 5행 호출부 열)를
    함께 갱신하도록 명시한다.

## 요약

target 초안은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)가 "신설 여부는
planner 판단"으로 열어 둔 항목(`15_35_56` convention_compliance W1)을 정확히 처분하고 있고,
같은 트래커가 이미 확정한 "세 상한을 합치지 않는다"는 결정을 재확인하는 형태라 **미해결 결정을
우회하는 CRITICAL 은 없다**. 다만 (1) 문서가 확정형으로 서술하는 "마스킹은 한 번" 규율의 전수
검증이 자매 plan(`ws-event-types-extract.md`)에 아직 미완료로 남아 있고, (2) 같은 정본
트래커의 열려 있는 통합 작업(W4, `inputData` 마스킹 게이트 단일화)이 target 이 심볼 기준으로
못박겠다고 선언한 좌표계 표의 정확성을 실제로 위협하는데도 target 이 이를 인지하지 못한 채
Rationale 을 일반론 수준에서만 방어하고 있다. 두 건 모두 정식 문서 신설 자체를 막을 사유는
아니지만, 신설 직후 자매 plan 진행에 따라 stale 해질 수 있는 지점이므로 plan 갱신(상호 참조)
또는 캐비엇 추가가 필요하다.

## 위험도

LOW
