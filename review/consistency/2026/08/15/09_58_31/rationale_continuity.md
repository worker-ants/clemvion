# Rationale 연속성 검토 결과

## 검토 범위 확인

prompt 의 bundle 은 `spec/5-system/` 전체를 --impl-done 번들로 담고 있으나, 실제 target 변경은
`git diff origin/main` 대조로 확인한 아래 세 spec 파일 + backend 코드(EIA 종결 이벤트
`durationMs` 구현, plan `eia-terminal-payload.md` "재판정 ④")이다. 워크트리 이름
(`eia-r8-cache-scope-4ae434`)이 가리키는 R8(Idempotency-Key 캐시 스코프) 결정은 이미
완료·병합돼 있고(코드 #1157~#1163) 이번 diff 에서 전혀 건드려지지 않았다 — 직전 두 라운드
(`08_45_50`, `09_00_27`)와 동일 결론을 재확인.

- `spec/5-system/14-external-interaction-api.md` (§6 필드 집합 표 `durationMs` 행,
  §6.2/§6.3/§6.4/§6.5, §12 호환성 Re-run `/v1/` 표기)
- `spec/conventions/chat-channel-adapter.md` (`EiaEvent` 타입 캐비엇)
- `spec/3-workflow-editor/3-execution.md` (§8.1 이벤트 요약표)
- 코드: `execution-engine.service.ts` / `retry-turn.service.ts` / 신규
  `shared/utils/terminal-duration.ts`

직전 라운드(`09_00_27`)가 남긴 유일한 검증 보류 항목 — "`08_45_50` INFO 1(Planned→구현됨 전환
시 '해소' 형태 보존)이 실제 spec 편집 시점에 지켜지는지" — 이 이번 라운드에서 실제로 착수됐으므로
그 검증을 본 라운드에서 마감한다.

## 발견사항

없음(CRITICAL/WARNING).

- **durationMs Planned→구현 전환은 선례("해소" 보존 관행)를 그대로 따랐다** — 확인 완료
  - target 위치: `spec/5-system/14-external-interaction-api.md:575`(§6 필드 집합 표)·`:698`·
    `:743-744`·`:806`(§6.5)
  - 과거 결정 출처: 같은 문서 §6.4 필드 표(`error` 행) — "일부 경로는 string" 캐비엇을 삭제
    대신 "종전의 '일부 경로는 string' 캐비엇은 해소됐다" 형태로 이력 보존한 선례. 이 선례는
    직전 라운드(`08_45_50`) rationale_continuity INFO 1 이 durationMs 전환에도 적용하라고
    권고했고, `09_00_27` 라운드가 plan(`eia-terminal-payload.md` 재판정 ④)에 그 권고가
    명문화된 것을 확인했다.
  - 상세: 실제 spec 편집은 `~~cancelled 계열은 계산·영속조차 하지 않는다~~ **(2026-08-15
    해소)**` 형태로 취소선 + 해소 주석을 정확히 남겼고, §6.2 의 "Planned 표기 선례" 문구도
    삭제 대신 "durationMs 는 2026-08-15 구현돼 더는 선례가 아니다"로 갱신했다. §6.3/§6.4 도
    "둘 다 Planned" → "durationMs 는 구현, `result.outputs` 만 Planned (해소)" 형태로 이력을
    남겼다. §6.5(cancelled)는 새 필드라 캐비엇 대신 신규 설명(`markQueueWaitTimeout` 값이
    "실행 시간"이 아니라 "큐 대기 시간"이라는 caveat)을 정직하게 추가했다 — §6 표의 "종결까지의
    경과" 정의와 일관성을 명시적으로 재확인하며 도입했다.
  - 결론: 기각된 대안의 재도입도, 무근거 번복도 아니다. 이전 라운드가 요구한 "정정은 삭제가
    아니라 해소로 남긴다" 관행이 이번 실제 편집에서 그대로 집행됐다.

- **Re-run `/v1/` 세그먼트 제거는 기존 API 컨벤션·SoT 표기로의 정정이지 새 결정이 아니다** — 확인 완료
  - target 위치: `spec/5-system/14-external-interaction-api.md` §12 "호환성" (Re-run API 행)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §1 "버전 | URL 경로에 포함하지 않음",
    `spec/5-system/13-replay-rerun.md`(Re-run 의 SoT, 처음부터 `/api/executions/:id/re-run`
    무버전 표기)
  - 상세: EIA 문서 자신도 §6.2 본문 주석에 "절대 URL·`/v1/` 버전 세그먼트는 API 규약 위반"이라고
    명시하고 있어, `/v1/` 표기는 오탈자성 drift였다. 이번 diff 는 SoT 두 곳(자기 자신의 §6.2,
    13-replay-rerun.md)과 일치하는 방향으로 정정한 것이다. `09_00_27` 라운드가 이미 동일
    결론에 도달했고 이번 라운드에서 최종 diff 로 재확인했다.

- **"삭제된 약속" (`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`) 은 되살아나지 않았다** — 확인 완료
  - target 위치: `spec/5-system/14-external-interaction-api.md:577-580`
  - 과거 결정 출처: 같은 절 "삭제된 약속" 캐비엇 — "엔진에 개념 자체가 없다···되살리지 않는다"
  - 상세: 이번 diff 는 `durationMs`·Re-run 경로만 건드렸고 이 네 필드는 diff·구현 어디에도
    등장하지 않는다.

- **single-SoT + pointer 원칙(R10 facade, redis-keys.md 선례) 유지** — 확인 완료
  - target 위치: `spec/conventions/chat-channel-adapter.md:158-161`,
    `spec/3-workflow-editor/3-execution.md:307-308`
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md:560-562` "같은 필드를 여러
    문서에 나열하면 그 각각이 두 번째 SoT 가 된다"(#1166 4문서 통합 결정)
  - 상세: 두 문서 모두 필드를 재나열하지 않고 EIA §6 을 SoT 로 가리키는 형태를 유지한 채,
    `durationMs` 상태 변화만 짧게 반영했다(chat-channel-adapter 는 optional 표기 유지 근거를
    "알 수 없으면 null"로 명시, 3-execution.md 요약표는 `duration` 컬럼만 추가). 필드 열거
    회귀 없음.

- **[INFO]** `spec/data-flow/3-execution.md:111` 시퀀스 다이어그램은 plan 이 스스로 지목한
  "spec 동반 변경" 대상이었으나 이번 diff 에서 편집되지 않았다
  - target 위치: (미변경 파일) `spec/data-flow/3-execution.md:111`
    — `UPDATE execution SET status='completed'/'failed'/'cancelled', finished_at, duration_ms, ...`
  - 과거 결정 출처: `plan/in-progress/eia-terminal-payload.md` "재판정 ④ § spec 동반 변경(전수)"
    표 — 이 행을 "`cross_spec W1`" 근거로 명시 등재하며 "지금은 EIA §6 표와 불일치이고, 이 PR
    이 그걸 참으로 만든다"라고 스스로 판단해 등재
  - 상세: plan 의 판단(구현 후 이 다이어그램의 "cancelled 도 duration_ms 를 쓴다"는 서술이
    우연히 참이 됨)은 diff 로 확인해도 맞다 — Rationale 위반은 아니다. 다만 이 다이어그램은
    "하나의 UPDATE" 로 뭉뚱그려 3종을 표기해, 실제로는 16개 emit 경로·11개 emit 문·그중
    raw UPDATE(엔티티 미로드) 5경로가 SQL 계산+`RETURNING`으로 별도 처리된다는 구조와
    `markQueueWaitTimeout` 경로의 "durationMs = 큐 대기 시간(실행 시간 아님)" caveat 를 전혀
    반영하지 않는다. 원칙 위반은 아니지만, plan 이 스스로 "동반 변경 대상"으로 지목한 항목을
    설명 없이 넘긴 것이라 문서 정합 관점의 갭으로 남는다.
  - 제안: 이 다이어그램에도 "요약이며 상세는 EIA §6 이 SoT" 캐비엇 한 줄(또는 §6 로의 포인터)을
    추가하거나, plan 의 해당 행에 "액션 불요 — diff 로 우연히 정합" 사유를 명시적으로 기록해
    다음 세션이 재조사하지 않게 할 것. CRITICAL/WARNING 은 아님(코드·spec 어디에도 실제 거짓
    서술이 남지 않았다).

## 요약

이번 라운드의 실질 변경(EIA 종결 이벤트 `durationMs` 3종 구현 + Re-run `/v1/` 표기 정정)은
기존 Rationale 어느 항목도 재도입·번복하지 않는다. Planned→구현됨 전환은 직전 라운드가 권고한
"해소" 보존 관행(§6.4 `error` 선례)을 정확히 따랐고, 이는 그 권고가 plan 문서에만 머물지 않고
실제 spec 편집에 반영됐음을 확인한 것이다. `/v1/` 제거는 새 결정이 아니라 문서 자신의 SoT
표기·API 컨벤션 원칙(URL 비버전화)으로의 정정이다. "삭제된 약속" 필드 부활, R8 캐시 스코프 회귀,
single-SoT 원칙 위반은 모두 없음을 확인했다. 유일한 잔여 항목은 INFO 수준 — plan 이 스스로
"동반 변경 대상"으로 지목했던 `data-flow/3-execution.md` 다이어그램이 이번 diff 에서 편집되지
않은 채 남아 있는데, 결과적으로 거짓이 되지는 않았으나 새로 추가된 caveat(큐 대기 시간 의미
차이 등)를 반영하지 못해 문서 정합의 개선 여지로 남는다.

## 위험도

LOW
