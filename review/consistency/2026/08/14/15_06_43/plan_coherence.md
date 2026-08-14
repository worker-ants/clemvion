# Plan 정합성 검토 — `plan/in-progress/spec-draft-eia-62-waiting-payload.md`

## 발견사항

- **[WARNING]** 이름 충돌 해소 항목이 "spec 반영" 카운트 체크리스트에서 빠져 있다
  - target 위치: `## 🔴 조사 중 발견 — turnDebug.llmCalls 가 외부 fanout 으로 새는 것으로 보인다` →
    `### 처분 (실제 상태)` 의 `[ ] 이름 충돌은 이 커밋에 포함되지 않았다 — 별도 잔여` 항목
    (L211~217) vs. 문서 최하단 `## 체크리스트` 의 `[ ] spec 반영 — **7항목** (1)~(7)` (L260~262)
  - 관련 plan: 이 항목 자체가 target 문서 안에서 `10_32_29 naming_collision CRITICAL 1` 을
    인용하며 "**§6.2 재작성 시** top-level 을 리네임(`turnDebugSnapshot` 등)하거나
    disambiguation 문구를 예시 옆에 부착. 그대로 옮겨 적으면 spec 에 정식 충돌로 고착된다" 고
    스스로 planner 인계를 명시한 채 미체크(`[ ]`)로 남아 있다.
  - 상세: target 문서의 "변경 제안" 은 `(1)`~`(7)` 로 번호가 매겨져 있고, 문서 최하단
    `## 체크리스트` 는 정확히 이 번호 매긴 항목만 "spec 반영 대상" 으로 카운트한다
    (`> 초판은 "6항목" 이라 적었다 … 개수만 보고 (7)을 누락할 수 있다` 는 자기 경고까지 붙어
    있다). 그런데 이름 충돌 disambiguation 처방은 이 `(1)~(7)` 목록에 없다 — 별도 절
    (`## 🔴 조사 중 발견`)의 독립 체크박스로만 존재한다. 이 저장소가 이미 반복적으로 겪은
    "본문 체크박스 + 하단 `## 체크리스트` 양쪽 동기화 실패"(메모리
    `feedback_stale_plan_claims_and_checklist_sync.md`) 와 같은 형태다 — planner 가 "7항목만
    반영하면 된다" 는 하단 체크리스트를 SoT 로 삼아 실행하면, 이 CRITICAL 급 disambiguation
    항목이 조용히 누락될 수 있다. item (3)(blockquote 를 "논리 표기 ↔ 실 wire 필드명" 매핑으로
    재작성)이 AI 표면의 실제 wire 필드명(top-level `turnDebug` 스냅샷 vs
    `nodeOutput.meta.turnDebug` 배열)을 blockquote 에 노출시킬 가능성이 있어, 바로 이 지점에서
    사전 경고된 명명 충돌이 재현될 위험이 가장 크다.
  - 제안: target 문서의 `## 체크리스트`에 8번째 항목으로 이름 충돌 disambiguation 을 명시
    등재하거나, item (3) 본문에 "AI turnDebug 명명 충돌 처방(`10_32_29`)을 함께 적용" 이라는
    상호 참조를 추가할 것.

- **[WARNING]** §R17 재서술이 인접한 미해소 "잔여" 트래커 항목과 상호 참조 없이 진행된다
  - target 위치: `### (7) llmCalls strip SoT 가 실제 누출 표면을 안 덮는다` 의
    `**§R17 정정**` 불릿 (L153~156)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    `[ ] getStatus 일반 nodeOutput 키-allowlist (§R17 잔여)` (미해소, `[ ]`)
  - 상세: 현재 `spec/5-system/14-external-interaction-api.md` §R17 은 "마스킹은 secret-shape
    만 치환(정상 결과 데이터는 copy-on-change 로 보존)" 이라는 문장(L1350~1352 부근)과, 바로
    다음 불릿으로 "`nodeOutput` 일반 키 allowlist (**미구현·잔여**)" (L1353~1355) 를 담고
    있다. `spec-sync-external-interaction-api-gaps.md` 의 열린 항목은 바로 이 "잔여" 문구를
    문자 그대로 인용해 자신의 트리거로 삼는다("§R17 이 'conversationConfig 이외의 일반
    nodeOutput 키-allowlist 만 잔여 항목' 이라 명시했으나 등재된 plan 이 없었다"). target 의
    item (7) 은 §R17 의 "secret-shape 만 치환" 문장을 "값 마스킹 + 필드 삭제 병행, 세 출구
    전부 적용" 으로 **다시 쓴다**고 명시하는데, 이 재서술이 바로 아래 "일반 키 allowlist
    (미구현·잔여)" 불릿의 표현·경계를 건드리거나 삭제할 위험을 검토·언급하지 않는다.
    target 문서 전체에 `allowlist` 문자열이 한 번도 등장하지 않는다(grep 확인). §R17 문단
    구조가 바뀌면 그 열린 tracker 항목이 인용하는 문구가 stale 해지거나, 재서술 과정에서
    "잔여" 프레이밍 자체가 실수로 지워질 수 있다.
  - 제안: item (7) 실행 시 §R17 의 "일반 키 allowlist (미구현·잔여)" 불릿을 그대로 보존하거나,
    보존이 어렵다면 `spec-sync-external-interaction-api-gaps.md` 의 해당 항목 인용문을 함께
    갱신할 것을 target 체크리스트에 명시.

- **[INFO]** `error.code` 옵셔널 결정의 근거(4개 emit 지점)가 SIGTERM 종료 경로를 포함하지
  않으며, 그 경로의 최종 분류는 별도 plan 에서 아직 미결 상태다
  - target 위치: `### (4) error.code 를 옵셔널로 (§6.4 + 필드 집합 표)` (L122~128)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    상단 `## 결정이 필요하다 (택일)` — (a) SIGTERM/timeout 유발 abort 를 기존 `failed` 계약
    유지 vs (b) `cancelled` 로 재정의 (미해소, `[ ]`)
  - 상세: target 의 "실측: 4개 emit 지점 중 code 를 실제로 갖는 것은 `finalizeFailedExecution`
    의 sentinel 경로뿐" 이라는 근거는 `eia-terminal-payload.md` 가 감사한 emit 호출부
    (`execution-engine.service.ts` + `retry-turn.service.ts`) 범위로는 정확하다 — 실측
    결과 `shutdown-state.service.ts` 의 `error.code='SERVER_INTERRUPTED'` bulk UPDATE 는
    emit 을 전혀 호출하지 않아(`emitExecution`/`eventEmitter` grep 0건) 이 emit 스키마 범위
    밖이다. 다만 그 값은 DB `Execution.error` 컬럼에 직접 쓰여 REST `getStatus`(§5.3) 를 통해
    외부에 노출될 수 있고, `spec-update-node-cancellation-shutdown-classification.md` 의
    (a)/(b) 택일이 아직 결정되지 않아 이 경로의 최종 상태(`failed`+code 유지 vs `cancelled`
    로 재분류돼 code 자체가 사라짐)가 유동적이다. target 이 `1-data-model.md §2.14` 를
    수정하는 item (5) 와 §R17/§6.5 strip 서술을 넓히는 item (7) 이 이 경로를 명시적으로
    스코프 밖이라 언급하지 않으므로, (a) 가 채택되면 "code 를 실제로 갖는 것은
    finalizeFailedExecution 뿐" 이라는 Rationale 문구가 사실과 어긋나게 된다.
  - 제안: item (4)/(5) 의 spec 반영 시 "emit payload 한정" 임을 명시하거나, 완료 전
    `spec-update-node-cancellation-shutdown-classification.md` 의 (a)/(b) 결정 상태를
    한 번 더 확인.

## 요약

target 문서(`spec-draft-eia-62-waiting-payload.md`)는 자기 반증·소급 정정을 여러 라운드
반복해 온 성숙한 draft 로, `eia-terminal-payload.md`("차단 해제 조건")·
`spec-draft-eia-notification-payload-contract.md`(형제 plan 반증 각주 상호 확인 완료)와의
주요 교차 참조는 이미 정합하다. 다만 (1) target 자신이 발견한 CRITICAL 급 이름 충돌
disambiguation 처방이 실행 체크리스트의 카운트("7항목")에 포함되지 않아 드롭될 위험이 있고,
(2) §R17 재서술이 `spec-sync-external-interaction-api-gaps.md` 의 열린 "nodeOutput allowlist
잔여" 항목과 상호 참조 없이 진행돼 그 트래커를 stale 하게 만들 소지가 있다. 둘 다 CRITICAL 급
결정 충돌은 아니며, spec 반영 실행 단계에서 체크리스트 갱신만으로 해소 가능하다.

## 위험도
LOW
