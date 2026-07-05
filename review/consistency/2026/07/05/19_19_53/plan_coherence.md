# Plan 정합성 검토 — spec-draft-cross-audit-doc-batch.md

## 발견사항

- **[CRITICAL] V-18 "재검증 결과 정합, 변경 불요" 종결은 코드 재확인 결과 근거 부족 — 미해결 결정을 일방적으로 우회**
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` §V-18 (라인 54-56), Rationale
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-18(라인 119-125, "옵션: 코드 구현 vs 보류+spec 명시", "권장: 보류+spec 명시" — **아직 미결 상태로 "잔여: V-12·V-13·V-18" 목록(라인 46)에 명시적으로 남아 있음**)
  - 상세: target 은 `use-widget.ts:201-239` 의 `seedWaitingFromStatus` 가 "200/종료/404/401 분기 + 401 낙관적 refresh 1회를 spec §3.1 대로 구현" 한다고 주장하나, 실제 코드를 재확인한 결과:
    - `seedWaitingFromStatus` 는 `getStatus` 응답이 `status==="waiting_for_input"` 인 성공 케이스만 처리(WAITING dispatch)한다.
    - 그 외 모든 경우(200+terminal, 404, 401, 네트워크 오류)는 `catch` 블록에서 `console.warn("[widget] getStatus seed failed:", …)` 만 남기고 **그대로 진행** — spec §3.1 이 요구하는 `[ended]` 전이·storage 정리·401 낙관적 refresh 1회는 이 경로에 전혀 없다.
    - `applyConfig`(복원 진입점, 라인 415-438)는 `seedWaitingFromStatus` 호출 결과와 무관하게 무조건 `openStream(saved, "0")` 을 호출한다 — 404/401/종료 상태를 REST 로 판별해 SSE 연결을 막거나 `[ended]` 로 보내는 분기가 없다.
    - `[ended]` 전이는 오직 SSE 의 `TERMINAL_EVENTS` 수신(`handleEiaEvent`, 라인 166-171)으로만 발생한다 — 이는 spec §3.1 이 명시한 "버퍼(5분) 내면 SSE terminal replay 로도 동일 도달" 케이스에 해당할 뿐, "GET 상태 확인" 1차 경로(§3.1 step 2)를 대체하지 못한다. 버퍼 만료 후 복원(§3.1 이 명시적으로 상정하는 시나리오, cross-audit 원문 "5분 만료 후 복원 시 SSE replay 만으로는 채울 수 없는 현재 표면" 참조)의 경우 401/404 확정 종료를 감지할 REST 분기가 존재하지 않는다.
    - `refreshToken` 은 코드베이스에서 `use-token-refresh.ts` 의 **사전 예약형(스케줄) 갱신**에서만 호출된다(만료 30분 전 타이머). `getStatus` 401 실패 시 "낙관적으로 1회 refresh 시도" 하는 코드 경로는 존재하지 않는다.
  - 이는 완료된 `plan/complete/webchat-spec-polish-followups.md` (2026-06-28) 이 이미 "§3.1 서술은 실제 코드 동작과 정합한다"고 기록한 것과 같은 방향의 재확인 오류를 반복하는 것으로 보인다 — 해당 plan 조차 "V-18 audit 의 '§3.1 복원 시퀀스 구현범위 단서를 달지' 결정은 **별개 open 항목**"이라고 명시적으로 유보했다(라인 35, 41). target 은 이 유보를 뒤집어 "정합 확인 종결"로 격상하면서 근거로 든 코드 동작(200/404/401 분기 + 401 refresh)이 실제로는 구현돼 있지 않다.
  - 제안: V-18 을 "종결"이 아니라 cross-audit plan 이 이미 제시한 두 옵션(코드 구현 재개 / §3.1 본문에 "v1 은 waiting-seed 전용, 404/401/종료 REST 분기 및 낙관적 refresh 는 미구현(범위 외)" 명시)중 하나로 재결정해야 한다. "변경 불요"로 닫으려면 최소한 `console.warn` catch 블록이 실제로 401/404/`[ended]` 분기를 수행하는지 재차 코드 라인 단위로 검증한 근거를 제시해야 하며, 현재 재확인 결과로는 근거가 반대다.

- **[WARNING] V-18 관련 다른 in-progress plan(스토리텔링 상충) 미반영**
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` §V-18
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` 라인 65 — `getStatus seed failed` 콘솔 경고를 2026-07-05 에 검증하며 "브라우저 console.warn 을 정확히 기술" 이라고 재확인. 이 항목은 `seedWaitingFromStatus` 가 **soft-fail(진행) 전용**이라는 성격을 재차 확인하는 근거이지 "200/404/401 분기 구현 완료"를 뒷받침하지 않는다.
  - 상세: 같은 세션(2026-07-05)에 진행 중인 두 plan 이 동일 함수(`seedWaitingFromStatus`)를 서로 다른 결론으로 인용하고 있다 — 하나는 "soft-fail 로만 존재(정정 불요, 오탐)", 다른 하나(target)는 "401/404/[ended] 분기까지 구현됨". 두 서술이 같은 코드를 가리키며 상충하므로 최소 하나는 갱신돼야 한다.
  - 제안: target V-18 서술을 `spec-sync-structural-followups.md` 의 재확인 내용과 맞춰 정정(= 위 CRITICAL findings 반영)하거나, 만약 다른 근거(예: 다른 브랜치/커밋의 최신 코드)가 있다면 그 근거를 target 에 명시.

- **[INFO] V-13/V-05/V-14 는 cross-audit plan 의 "권장" 방향과 일치 — 정합**
  - target 위치: §V-13, §V-05, §V-14
  - 관련 plan: `spec-code-cross-audit-2026-06-10.md` §V-13(권장: spec 하향 + `{N} tools` 즉시 삭제, 라인 108), V-05 후속 항목(라인 37-40), V-14 후속 항목(라인 43-45)
  - 상세: V-13 은 cross-audit 의 "spec 하향(부분) + 코드 위생, `{N} tools` 즉시 삭제" 권장과 정확히 일치하고, 코드 확인(`text-classifier.schema.ts:234` 만 `summaryTemplate` 보유)도 재검증됐다. V-05·V-14 의 변경 4~8 은 각각 cross-audit 이 이관한 후속 항목(탭 열거·Config 탭 masking Rationale·dry-run 스코프 확장·trigger-param 타입 통합은 별도 refactor 트랙으로 남김·fallback 각주·new-tab/same-tab 상호 각주)을 빠짐없이 커버한다. 다만 V-05 후속의 "refactor: run-results-drawer.tsx 와 page.tsx 의 props 중복 → 공용 hook 추출"(cross-audit 라인 39) 은 target 범위에 없음 — 이는 코드 변경이라 spec-doc 배치(코드 변경 없음 선언) 밖이므로 누락이 아니라 의도된 스코프 밖으로 타당하다.
  - 제안: 별도 조치 불요. cross-audit plan 의 V-05/V-14 체크박스는 target 이 커버하는 spec-doc 후속 항목이 반영되면 해당 sub-item 을 `[x]` 로 갱신할 수 있다(단 V-18 은 CRITICAL 재검토 후).

## 요약
V-13·V-05·V-14 세 항목은 cross-audit plan(`spec-code-cross-audit-2026-06-10.md`)이 이미 제시한 "권장" 방향 및 이관된 후속 항목과 정확히 정합하며 코드 재확인도 일치한다. 그러나 V-18 을 "재검증 결과 정합, 변경 불요"로 종결하는 판단은 cross-audit plan 이 **아직 미결(잔여)로 명시적으로 남겨둔 결정**(코드 구현 재개 vs spec 에 v1 범위 단서 명시)을 근거 없이 뒤집는 것이다. `use-widget.ts` 를 라인 단위로 재확인한 결과 `seedWaitingFromStatus` 는 waiting_for_input 성공 케이스만 처리하고 나머지(200+terminal/404/401)는 `console.warn` 후 진행할 뿐이며, `applyConfig` 복원 경로는 이 결과와 무관하게 무조건 SSE 를 연다 — spec §3.1 이 요구하는 REST 기반 200/404/401 분기와 401 낙관적 refresh 1회는 코드에 존재하지 않는다. 같은 세션에 진행 중인 `spec-sync-structural-followups.md` 도 동일 함수를 "soft-fail 콘솔 경고"로만 재확인해 target 의 결론과 상충한다. V-18 을 종결 처리하려면 이 상충을 해소하고 실제 코드 분기 존재 여부를 재입증해야 한다.

## 위험도
HIGH
