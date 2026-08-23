# Rationale 연속성 검토 — masking-gate-consolidation (impl-prep, scope=spec/5-system/)

## 조사 방법 메모

Target 번들(`spec/5-system/`)은 대부분 컨텍스트 예산 초과로 절단되어 있었다(`1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 만 전문 포함). 절단된 파일은 "없다는 사실을
근거로 삼지 말라"는 지시에 따라 실제 작업 대상인
`spec/5-system/14-external-interaction-api.md`(§R17, egress 마스킹 정본)를 `Read`로 직접
열어 대조했다. 아울러 `plan/in-progress/masking-gate-consolidation.md`(이번 impl-prep 이
게이팅하는 작업 자체)와 그 spec_impact `spec/conventions/egress-masking.md`, 그리고 이미
워킹트리에 반영된 코드 diff(`git diff HEAD` — `redact-stored-error.ts`·`executions.service.ts`·
`background-runs.service.ts`·`egress-masking.md`)까지 함께 대조했다. 이는 대상 밖처럼 보이나,
"target 문서가 과거 Rationale 을 위반하는가"를 판정하려면 target 이 실제로 참조하는 SoT 와
그 SoT 를 이번에 바꾸려는 변경분을 함께 봐야 판정 가능하기 때문이다.

## 발견사항

### INFO 1 — 플랜 문서와 워킹트리 상태의 불일치 (rationale 자체는 무결)

- target 위치: `plan/in-progress/masking-gate-consolidation.md` §"작업" 체크리스트
  (`- [ ] 헬퍼 2개 신설 + 4개 호출부 교체` 등 전항 미체크)
- 근거: 현재 워킹트리(`git diff HEAD`)에는 이미 `redactStoredFieldsForResponse`/
  `redactNodeExecutionRow` 두 헬퍼가 `redact-stored-error.ts` 에 추가돼 있고,
  `executions.service.ts`(`toExecutionDto`·`toResponseExecution`·노드 레벨 루프)와
  `background-runs.service.ts` 네 호출부가 이미 그 헬퍼로 교체돼 있으며,
  `egress-masking.md §3` 의 stale 트리거 문장도 이미 취소선 + 정정 문단으로 갱신돼 있다 —
  플랜이 checklist 로 예고한 산출물과 **글자 그대로 일치**한다.
- 상세: 이것은 Rationale 위반이 아니다(아래 결론 참고) — 다만 plan 체크박스가 실제 상태를
  반영하지 못한 채로 이번 impl-prep 리뷰가 돌고 있다. 다음 턴이 이 plan 을 "아직 안 한 일"로
  읽고 동일 리팩터를 다시 시도하면 중복 정의·불필요한 재작업 위험이 있다.
- 제안: `/consistency-check` 이후 developer 턴에서 체크박스를 실제 상태로 동기화
  (MEMORY "plan 체크박스 = 실제 상태" 규약). rationale_continuity 관점에서는 차단 사유
  아님 — plan_coherence 검토자의 1차 소관으로 넘긴다.

## 상세 대조 — 이번 변경이 건드리는 세 개의 기존 Rationale

아래는 "위반이 없었다"는 결론에 이르기까지 실제로 대조한 과거 결정 3건이다 (부재 보고가
곧 근거가 되지 않도록 명시한다).

1. **"세 상한을 하나로 합친다" — 이미 기각된 대안** ([`egress-masking.md` §Rationale "기각한
   대안"](../../../spec/conventions/egress-masking.md#기각한-대안)): `MAX_MASK_DEPTH`(표1)·
   `MAX_SANITIZE_DEPTH`(표4, WS)·`stripExternalOnlyFields`(표5)를 하나로 합치는 안은
   `masked-markers/src/index.ts` 의 "별개 불변식이므로 합치지 않는다" 결정으로 기각되어 있다.
   이번 변경(`redactStoredFieldsForResponse`)은 표2행(`MAX_REDACT_DEPTH`→`deepRedactSecrets`)
   호출부 **4곳의 중복 호출**만 한 파일로 묶을 뿐, 표4·표5 계열에는 손대지 않는다 —
   기각된 "상한 병합"이 재도입되지 않았음을 diff 로 확인했다.
2. **"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합" 착수 시 §3 표가 낡는다는 예고**
   (`egress-masking.md §3` 알려진 stale 트리거, 2026-08-22 작성): 실제 착수 후 실측하면
   표 2행(`deepRedactSecrets`)·표 5행(`stripExternalOnlyFields`) 소비처는 이 통합과 접점이
   없어 **표는 무변경**이었다 — 즉 예고가 반증됐다. 이 경우는 "과거 결정의 무근거 번복"이
   아니라 "과거 **예고**(prediction)의 유근거 정정"이며, `egress-masking.md` 는 취소선 +
   날짜 있는 정정 문단으로 왜 틀렸는지(마스커 좌표계 vs 호출부 좌표계 혼동)를 남겼다 —
   점검 관점 3("결정의 무근거 번복")이 요구하는 "번복 시 새 근거 동반"을 충족한다.
3. **EIA §R17 "적용 범위는 총칭이 아니라 열거다" — 표면 6개/컬럼 2개가 정본**
   (`spec/5-system/14-external-interaction-api.md`, 2026-08-16 갱신): 이 spec 은 이미
   "'넷'이라는 수치가 낡았다"고 스스로 정정한 바 있다(호출부 4곳 vs 표면 6곳 — `findById`/
   `getChain`/`stop` 이 `toResponseExecution` 한 함수를 공유하므로 함수 단위로 세면 4,
   표면(엔드포인트) 단위로 세면 6). 플랜·코드가 다시 "4곳"이라 부르는 것은 표면 재도입이
   아니라 **동일 6표면을 함수 단위로 재-카운트**한 것 — `toExecutionDto`(=표면4)·
   `toResponseExecution`(=표면1+2+3 공유 관문)·노드 레벨 루프(=표면5)·
   `background-runs.service.ts`(=표면6)로 1:1 매핑되어 모순이 아니다. (처음엔 이 카운트
   불일치를 CRITICAL 후보로 의심했으나, 코드의 `toResponseExecution` JSDoc 표를 EIA §R17
   표와 대조해 완전한 1:1 대응을 확인, 판정을 낮췄다 — 오탐 방지 목적으로 과정을 남긴다.)

## 요약

이번 impl-prep 대상 변경(마스킹 게이트 4곳→헬퍼 2개 통합, `egress-masking.md §3` 정정)은
기존 spec Rationale 을 위반하지 않는다. 명시적으로 기각된 유일한 인접 대안("세 깊이 상한을
하나로 합친다")은 건드리지 않았고, 과거 "표가 낡는다"는 예고를 뒤집는 부분은 날짜·근거를
갖춘 정정 문단으로 함께 갱신되어 있으며, EIA §R17 이 스스로 명시한 "6표면/2컬럼" 정본과
플랜의 "4곳" 프레이밍은 셈의 단위(표면 vs 함수)가 다를 뿐 동일 사실의 재기술이다. 유일한
지적 사항은 rationale 문제가 아니라 위생 문제 — `plan/in-progress/masking-gate-consolidation.md`
의 체크리스트가 이미 완료된 워킹트리 상태를 반영하지 못해 다음 턴의 중복 작업 위험이 있다.

## 위험도

LOW
