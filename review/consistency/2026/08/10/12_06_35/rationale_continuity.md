# Rationale 연속성 검토 — `spec/7-channel-web-chat/2-sdk.md`

## 발견사항

- **[WARNING]** `resetSession`/`newChat` 시퀀스 서술이 R9-B-1 의 "이전 execution best-effort cancel" 을 누락
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §3 "`resetSession` 명령" 단락 (L117-121), 특히 "`newChat`: closeStream→clearSession→start" 시퀀스 표기
  - 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md` `## Rationale` R9 "B-1. '새 대화' 는 이전 execution 을 best-effort `cancel` 후 재시작" (L256, L272) — "#874 당시의 optimistic-local 단순성 선택('명시 종료 미발신')이 낳던 서버 orphan 을 근원 제거한다"
  - 상세: target 은 `resetSession` 이 "위젯 내부의 대화 종료 후 '새 대화 시작'과 동일 동작"이라고 명시하면서 그 시퀀스를 `closeStream→clearSession→start` 세 단계로 요약한다. 그러나 R9-B-1 은 확립 세션(streaming/awaiting)발 "새 대화"가 재시작 전에 **이전 execution 을 best-effort `cancel`** 하는 것을 서버 orphan 제거의 핵심 결정으로 명시했고, 실제 구현(`codebase/channel-web-chat/src/widget/use-widget.ts` `newChat()`, L714-742)도 `resetSessionRefs()` 이후 `client.interact(..., { command: 'cancel', reason: 'user_new_chat' })` 를 발사한 뒤 `start()` 한다 — 즉 실제 시퀀스는 `closeStream/clearSession → cancel(best-effort) → start` 이다. target 의 3단계 요약에는 R9-B-1 이 명시적으로 도입한 "cancel" 단계가 없어, 이 SDK 계약 문서만 읽는 독자(예: 향후 유지보수자·통합 파트너)가 "resetSession 은 서버 execution 을 정리하지 않는다"고 오인할 수 있다 — R9-B-1 이 막으려던 바로 그 orphan 회귀를 스펙 서술 층위에서 재도입할 위험.
  - 제안: `newChat` 시퀀스 표기에 cancel 단계를 추가(`closeStream→clearSession→cancel(best-effort)→start`)하거나, 최소한 `[1-widget-app §R9 B-1]` 을 명시적으로 인용해 "확립 세션이 있었다면 이전 execution 을 best-effort cancel 한다" 한 문장을 덧붙인다.

- **[INFO]** `use-session-generations.ts` SoT 주석에 "boot 세대 비교" 기각 이력과의 경계 명시 부재
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 목록 주석 (`use-session-generations.ts` 설명부, "부팅 시도 세대 발급(`beginBootAttempt`)과 ... 판정(`cannotApplyConfig`/`isAttemptStale`)")
  - 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md` `## Rationale` R7 "표면 되감기 방어는 '세션 확립' 축이다 — boot 세대 비교가 아니다" — "대안(boot 세대 비교)이 두 번 실패한 이력이 여기 있으므로, 되살리려면 위 두 구멍을 먼저 반증해야 한다"
  - 상세: target 의 code 목록 주석이 명명하는 "부팅 시도 세대"(`bootGenRef`/`beginBootAttempt`/`isAttemptStale`)는 실제 코드(`use-session-generations.ts` L64-153)를 확인한 결과 **§3(재전송) `wc:boot` config 적용 순서** 전용이며, R7 이 명시적으로 기각한 "표면 되감기 방어용 boot 세대 비교"(SSE 표면 갱신 축, `sessionEstablished()` 별도 사용)와는 다른 축으로 코드 JSDoc 이 스스로 경계를 명확히 긋고 있다(`이 훅은 applyConfig 의 config 적용 경합에만 쓴다... seedWaitingFromStatus 의 표면 되감기 방어는 boot 세대 비교가 아니라 sessionEstablished() 로 한다`). 즉 실질적 위반은 없다. 다만 "boot 세대"라는 동일 어휘가 R7 이 두 번 실패했다고 못박은 대안과 같은 용어를 쓰고, 이 목록 주석 자체가 이 계약의 "정본"이라고 선언하는 자리이므로, 코드 JSDoc 을 열어보지 않고 spec 만 읽는 독자에게는 두 축이 같은 것으로 오인될 여지가 있다.
  - 제안: 이 code 목록 주석 또는 §3 재전송 문단에 "이 세대 축은 config 적용 순서 전용이며, 재로드 표면 되감기 방어 축([3-auth-session §R7](./3-auth-session.md))과는 분리되어 있다"는 한 줄을 덧붙여 두 축의 경계를 spec 층위에서도 명시.

- **[INFO]** 관련 Rationale 일부(`4-security.md`, `0-architecture.md`, `5-admin-console.md`)가 번들 예산 초과로 절단되어 교차검증 불가
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` 전체 — 특히 §3 origin pin("첫 `wc:boot` 의 origin 만 host 로 핀되므로") 서술과 `4-security.md §1 "저장 세션의 발급-origin 바인딩"` 교차참조 지점
  - 과거 결정 출처: 없음(교차검증 대상 문서 자체가 이번 번들에서 절단됨)
  - 상세: 이번 회차 번들에서 `spec/7-channel-web-chat/4-security.md`(원 6,677자), `0-architecture.md`(원 2,277자), `5-admin-console.md`(원 3,562자)가 "컨텍스트 예산 초과"로 본문이 생략되었다. target 이 이 문서들의 Rationale/위협모델을 직접 참조하는 지점(예: postMessage origin pin, 관리자 콘솔 라이브 미리보기 연동)은 이번 패스에서 원문 대조를 하지 못했다.
  - 제안: 다음 회차 검토에서 이 세 문서를 우선 포함하는 좁은 번들로 별도 재검토 권장. 이번 패스에서 위 두 항목 외 추가 CRITICAL/WARNING 이 존재할 가능성을 완전히 배제하지 않는다.

## 요약

`spec/7-channel-web-chat/2-sdk.md` 는 자신의 `## Rationale`(R2-R6)과 형제 문서 `1-widget-app.md`(R4-R10)·`3-auth-session.md`(R3-R8)의 기존 결정들을 대체로 정확히 인용·정합시키고 있다 — show/hide vs open/close 두 축(R4/R5), 전역명 재지정 `data-global`(R3), locale 예약 활성화(R6/R10), `apiBase` origin 바인딩 예외(R8) 모두 원 출처를 명시하며 새 결정을 "번복"이 아니라 "예약된 경로의 실행"으로 정확히 프레이밍했다. 기각된 대안(lazy 시작, localStorage, per_trigger 토큰, boot-세대 기반 표면 방어, `/toggle` 서브경로 등)의 무단 재도입은 발견되지 않았고, 코드 대조를 통해 `use-session-generations.ts` 의 "boot 세대" 사용이 R7 이 기각한 축과 실질적으로 분리되어 있음도 확인했다. 유일한 실질 갭은 `resetSession` 의 `newChat` 시퀀스 서술이 `1-widget-app.md` R9-B-1 이 명시한 "이전 execution best-effort cancel" 단계를 누락한 것으로, orphan 방지 원칙이 spec 서술 층위에서 흐려질 위험이 있는 WARNING 이다. 그 외에는 용어 근접성에 따른 잠재적 오독 방지(INFO)와, 예산 초과로 절단된 인접 문서(4-security 등) 미교차검증(INFO) 정도로, 전반적으로 continuity 는 양호하다.

## 위험도

LOW
