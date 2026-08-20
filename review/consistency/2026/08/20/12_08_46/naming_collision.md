# 신규 식별자 충돌 검토 — `eia-inputdata-marker-guard`

## 발견사항

- **[CRITICAL]** `MASKED_INPUT_DATA_REASON` 앵커 — "폐기 또는 반전" 중 반전을 택하면 동일 식별자가 정반대 의미로 재사용된다
  - target 신규 식별자: `plan/in-progress/eia-inputdata-marker-guard.md` 범위 체크리스트의
    `backend — Execution.inputData egress 마스킹으로 전환 (MASKED_INPUT_DATA_REASON 앵커 폐기
    또는 반전)` 항목. 두 선택지 중 하나가 아직 결정되지 않은 채 impl-prep 을 통과하려 한다.
  - 기존 사용처(동일 식별자, 전부 backend, 6개 파일):
    - `codebase/backend/src/modules/executions/executions.service.ts:59,90,94,152,729,1044,1109`
      — 상수 정의부 + JSDoc 앵커 본체("`Execution.inputData` 를 egress 마스킹하지 않는 이유")
    - `codebase/backend/src/modules/executions/executions.service.spec.ts:1115,1118`
    - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:55,179`
      — Swagger 설명문에서 인용
    - `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:304`
      — "`Execution` 레벨 한정(`MASKED_INPUT_DATA_REASON` 참조)" — **NodeExecution 은 마스킹한다는
      대비 진술이 이 앵커의 "옛 방향" 자체에 의존**
    - `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:224`
    - `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:51`
    - spec 쪽 산문(동일 앵커 이름을 직접 쓰진 않지만 같은 방향의 서술): `spec/5-system/14-external-interaction-api.md`
      §R17 "잔여 ②"(1539~1567행) — "`Execution.inputData` 를 마스킹하지 않는 이유는 그것이
      **재제출되는 값**이기 때문이다" + "닫는 조건" 문단
  - 상세: `MASKED_INPUT_DATA_REASON` 은 현재 `Execution.inputData` 를 **마스킹하지 않는** 이유를
    설명하는 JSDoc 앵커이고, 상수 값 자체도 그 방향으로 고정돼 있다 (`'inputData 는
    Re-run/히스토리-로드가 재제출하는 값이라 egress 마스킹 대상이 아니다'`). 이번 target 작업은
    정확히 이 카브아웃을 **닫아 마스킹으로 전환**하는 작업인데, 계획서는 앵커 처리 방식을
    "폐기 또는 반전" 둘 다 열어 두고 있다. **"반전"을 택하면서 식별자 이름을 그대로 두면**,
    이름·이름이 암시하는 서사("~REASON" = 카브아웃 근거)는 그대로인 채 의미만 뒤집혀
    "동일 식별자, 반대 의미" 충돌이 발생한다. 특히 `background-runs.service.ts:304` 의
    "Execution 레벨만 예외" 라는 대비 진술은 Execution 레벨이 더 이상 예외가 아니게 되는 순간
    거짓이 되므로, 이 자리를 포함해 6개 참조처를 **전부 동시에** 새 방향으로 다시 쓰지 않으면
    stale JSDoc/Swagger 설명이 마스킹 정책(보안 관련 문서)의 SoT 로 계속 인용된다. 계획서의
    "캐너리 4건 방향 반전" 항목(`①`·`②`·`⑧`·`⑧-b`)은 테스트 기대값을 뒤집는 것만 명시했고,
    앵커·주석·Swagger 문구까지 동반 갱신하라는 지시는 없다 — 누락 시 코드 리뷰 라운드에서
    "주석이 동작과 모순" 류의 재발(이 저장소가 이미 여러 차례 겪은 형태)로 이어질 가능성이 높다.
  - 제안:
    1. "반전"을 택할 경우 식별자를 **새 이름**으로 바꿀 것(예: 카브아웃 종료를 알리는
       `INPUT_DATA_MASKING_TRANSITION_NOTE` 류, 또는 단순히 방향 중립적이지 않은 이름 대신
       "이제 마스킹한다"는 새 진술을 담는 새 상수). 기존 이름을 재사용하지 말 것 — 재사용 시
       위 6개 참조처를 diff 에서 전수 나열해 "동시 갱신 완료" 를 리뷰 체크리스트에 명시.
    2. "폐기"를 택할 경우 카브아웃 자체가 사라지므로 앵커를 삭제하고, `Execution.inputData` 를
       표준 `redactStoredDataForResponse` 관문(§R17 "표면 여섯" 열거)에 그대로 편입시켜 별도
       설명 상수가 불필요함을 명시.
    3. 어느 쪽이든 `background-runs.service.ts:304` 의 "Execution 레벨만 예외" 대비 문장은
       반드시 함께 재작성 대상 목록에 포함할 것 — 이 줄이 새 상태에서 거짓이 되는 유일한
       비-앵커 파일이다.
    4. plan 체크리스트 항목 자체를 "폐기 또는 반전" 양자택일 서술에서 **착수 전 확정된 단일
       선택**으로 좁혀 impl-prep 단계에서 결정을 완료해 둘 것 — 구현 중 결정하면 6개 참조처
       동시 갱신이 누락되기 쉽다.

## 요약

target(`eia-inputdata-marker-guard`)이 새로 도입하는 표면(Re-run 모달·에디터 히스토리 로드
마커 가드)은 기존 `isMaskedMarker`/`MASKED_MARKERS` 명명 관례를 그대로 재사용해 충돌이 없고,
새 API endpoint·이벤트명·ENV/설정키·spec 파일 경로도 도입하지 않는다. 다만 backend 측 계획이
명시한 `MASKED_INPUT_DATA_REASON` 앵커 처리("폐기 또는 반전" 미확정)는, 반전을 택하고 이름을
유지할 경우 6개 파일에 흩어진 기존 참조가 정반대 의미로 오독될 수 있는 실질적 식별자 충돌
위험을 안고 있다 — 마스킹 정책이라는 보안 문서화 영역이라 파급이 작지 않다. 캐너리 테스트
번호(`①②⑤⑥-b⑧⑧-b`)나 spec 의 "잔여 ①②③" 순환숫자 재사용은 이 저장소가 이미 아라비아
숫자/원형숫자 분리로 선제 대응해 둔 관례라 이번 target 이 새로 깨는 충돌은 아니다.

## 위험도

HIGH
