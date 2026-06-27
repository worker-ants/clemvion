# 변경 범위(Scope) 리뷰 결과

리뷰 대상: Channel Web Chat — B1: useWidget God hook 분리 (`webchat-usewidget-split`)
리뷰 일시: 2026-06-28

---

## 발견사항

범위를 벗어나는 의도하지 않은 변경은 발견되지 않았다.

### 파일 1: `use-pending-message-queue.ts` (신규)
- **[INFO]** 범위 적합. plan `§B1`에서 명시한 `usePendingMessageQueue` 추출 그대로 구현. `pendingSendRef`·flush effect·enqueue/clearQueue 반환만 포함. 추가 기능 없음.

### 파일 2: `use-pending-message-queue.test.ts` (신규)
- **[INFO]** 범위 적합. 7개 케이스(enqueue→flush, buttons 폐기, form 폐기, 중복→최신 1건, clearQueue, 세션 없음, pending=null)가 plan 명세와 직접 대응. 무관한 테스트 케이스 없음.

### 파일 3: `use-token-refresh.ts` (신규)
- **[INFO]** 범위 적합. `useTokenRefresh` 추출 그대로. `refreshDelayMs`·`TOKEN_REFRESH_LEAD_MS`·`TOKEN_REFRESH_MIN_DELAY_MS` 상수가 `use-widget.ts`에서 이 파일로 이동 — plan 설계에 명시된 분리 범위 내.

### 파일 4: `use-token-refresh.test.ts` (신규)
- **[INFO]** 범위 적합. `refreshDelayMs` 순수함수 5케이스 + `useTokenRefresh` fake timer 5케이스. plan 명세(refresh 발화·재예약·clear·cancelled·no-session)와 1:1 대응.

### 파일 5: `use-widget.test.ts` (수정)
- **[INFO]** 범위 적합. `refreshDelayMs`·`TOKEN_REFRESH_LEAD_MS`·`TOKEN_REFRESH_MIN_DELAY_MS` 본 검증을 `use-token-refresh.test.ts`로 이관하고 하위호환 smoke-check 1건으로 대체. 기존 5케이스 제거는 신규 파일로 이관된 것이지 삭제가 아님.

### 파일 6: `use-widget.ts` (수정)
- **[INFO]** 범위 적합. 제거 항목: `SessionRef` 인터페이스(→`PersistedSession` 재사용), `TOKEN_REFRESH_LEAD_MS`·`TOKEN_REFRESH_MIN_DELAY_MS`·`refreshDelayMs` 선언(→이관), `refreshTimerRef`·`scheduleRefreshRef`·인라인 `scheduleRefresh` 함수·`pendingSendRef`·C1 flush effect(→두 hook으로 이전). 추가 항목: `useTokenRefresh`·`usePendingMessageQueue` import 및 호출, 하위호환 re-export 라인. 변경 목록 전부 plan 명세에 열거된 항목.
- **[INFO]** `saveSession` import는 `use-widget.ts`에서 삭제되지 않았으나(`use-token-refresh.ts`가 별도 import), `use-widget.ts`에서 `persist()` 내에 `saveSession(cfg.triggerEndpointPath, session)` 호출이 남아있어 삭제되지 않은 것이 정상. 무관한 변경 아님.

### 파일 7: `plan/in-progress/web-chat-quality-backlog.md` (수정)
- **[INFO]** 범위 적합. §B `useWidget` God hook 분리 항목 체크박스 완료 표시 + PR 참조 추가. §A 항목도 PR #744로 완료 표시. 체크박스 갱신은 plan 라이프사이클 규약의 일반적 작업 흐름.

### 파일 8: `plan/in-progress/webchat-usewidget-split.md` (신규)
- **[INFO]** 범위 적합. 본 worktree에 대응하는 plan 파일. frontmatter·추출 설계·작업 목록이 실제 변경과 일치.

### 파일 9: `plan/in-progress/webchat-widget-refactor.md` (수정)
- **[INFO]** 범위 적합. 후속 항목(B1, A) 체크박스 완료 표시 + PR 참조만 변경. 내용 수정 없음.

### 파일 10: `review/consistency/2026/06/28/00_48_37/SUMMARY.md` (신규)
- **[INFO]** 범위 적합. `/consistency-check --impl-prep` 산출물. plan §작업의 첫 체크박스에 명시된 절차 산출.

### 파일 11: `review/consistency/2026/06/28/00_48_37/_retry_state.json` (신규)
- **[INFO]** 범위 적합. consistency-check 오케스트레이터 상태 파일. 리뷰 인프라 파일로 규약상 `review/consistency/**` 경로 정상.

### 파일 12: `review/consistency/2026/06/28/00_48_37/convention_compliance.md` (신규)
- **[INFO]** 범위 적합. consistency-check 하위 검토자 산출물. 내용이 spec 문서 규약 검토이며 B1 범위와 무관한 발견은 모두 `pre-existing` / `planner` 로 명확히 표기.

---

## 요약

이번 변경은 `plan/in-progress/webchat-usewidget-split.md`에 설계·명시한 범위(`useWidget` God hook → `useTokenRefresh` / `usePendingMessageQueue` 분리)를 정확하게 따른다. 신규 파일 6개(구현 2 + 테스트 2 + plan 1 + consistency SUMMARY 1)와 수정 파일 6개(use-widget.ts·test + plan 2 + consistency 산출물 2) 전부 plan 명세에 열거된 작업의 직접 산물이다. 미사용 import 추가나 불필요한 리팩터링·포맷팅 변경·주석 과잉 추가·설정 파일 의도치 않은 수정은 없다. `use-widget.ts`의 `SessionRef = PersistedSession` 타입 단순화는 plan의 명시 결정("`SessionRef` = session-store `PersistedSession` 재사용")이며 over-engineering이 아니다.

---

## 위험도

NONE
