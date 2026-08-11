# consistency SUMMARY — `11_37_27` (`--impl-done spec/7-channel-web-chat`)

`origin/main` 머지(#1132 install 게이트 + dependabot) 이후 재실행. 직전 라운드(`11_10_16`)의
WARNING 처분을 확인하는 라운드다.

## BLOCK: NO

Critical **0**. 5 checker 중 3이 WARNING 도 0.

| checker | Critical | Warning | 위험도 |
|---|---|---|---|
| rationale_continuity | 0 | 0 | **NONE** |
| naming_collision | 0 | 0 | **NONE** |
| convention_compliance | 0 | 0 | **NONE** |
| plan_coherence | 0 | 0 | **PASS** |
| cross_spec | 0 | 1 | LOW |

## 직전 라운드 처분 확인 — 전부 통과

- **rationale_continuity**: 새 캐비엇("EIA §5.5 본문은 이 분기를 아직 담지 않는다")을 EIA 원문
  (`14-external-interaction-api.md:505-518` — `401` 만 적고 `410` 없음)과 대조해 **정확**함을 확인.
  코드 SoT 인용(`interaction.controller.ts:149` `@ApiGoneResponse`, `interaction.service.ts:253`
  `GoneException`)도 실재 확인. 갭이 EIA 소유 plan 에 경위·후속 체크박스와 함께 등재된 것도 확인.
- **plan_coherence**: 내가 고친 두 서술(`webchat-usewidget-extraction` 의 "추출 시 함께 옮겨야 하는
  것" 목록 / reconcile plan 9행 요약표)을 **HEAD 워킹트리 코드와 직접 대조** — 모두 정합.
- **convention_compliance**: 완료 plan 의 "그 시점의 기록" 명시, `status: implemented` + `spec_impact`
  가 머지 후에도 규약 부합.
- **naming_collision**: 머지로 유입된 33파일 전수 대조 — `spec/**` 변경 0건, 충돌 표면 없음.

## Warning (1건) — **이 PR 이 만든 것이 아니다. SUMMARY 기록으로만 처분.**

`spec/7-channel-web-chat/1-widget-app.md §3.1` 상태표가 `refresh-token` 의 `410` 을 반영하지
않는다(오래된 서술). 이 PR 은 `3-auth-session.md` 쪽을 정확히 만들었고, 그 인접 문서의 표는
같은 사실을 아직 담지 않는다.

**왜 지금 안 고치나**: 이 게이트는 spec-linked 파일 변경을 세므로, spec 을 또 고치면 이 라운드가
무효화되고 consistency 를 다시 돌아야 한다. 이 티켓은 코드 리뷰 13라운드 + consistency 2라운드를
돌았고, 매 라운드 fix 가 그 라운드를 무효화하는 루프가 그 절반의 원인이었다. **이 라운드를
종결 가능하게 하려면 여기서 멈춰야 한다.**

`1-widget-app.md` 표 갱신은 `3-auth-session.md` 와 같은 사실을 미러하는 작업이라 planner 턴
한 번이면 끝난다 — 이 SUMMARY 가 그 근거다.

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 1
