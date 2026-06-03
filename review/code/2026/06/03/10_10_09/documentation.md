# 문서화(Documentation) 리뷰 결과

리뷰 대상: channel-web-chat spec 갭 보완 및 consistency-check 산출물
리뷰 일시: 2026-06-03

---

## 발견사항

### [INFO] `spec/7-channel-web-chat/4-security.md` — `blocked` enum 이름이 본문 §3-①에는 명기됐으나 §1 보안 정책 요약표에는 반영되지 않음
- 위치: `spec/7-channel-web-chat/4-security.md` §1 보안 정책 요약표 "임베드 allowlist" 행
- 상세: §3 본문에서 "불일치 시 렌더 거부 + 시작 차단(위젯 상태 `blocked`)"을 추가했으나, §1 요약표의 "임베드 allowlist" 행은 여전히 "v1 = 부팅 시 host origin soft 검증"만 기술하고 있어 `blocked` 상태를 언급하지 않는다. 요약표와 본문 사이 경미한 설명 불일치.
- 제안: §1 요약표 "임베드 allowlist" 셀에 "불일치 시 위젯 `blocked` 상태" 한 줄을 추가하면 요약과 본문이 자기 완결됨.

---

### [INFO] `spec/7-channel-web-chat/1-widget-app.md` — §3 상태기계 다이어그램에 `visible`/`hidden` 축이 미반영
- 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 ASCII 상태기계 다이어그램
- 상세: §3.2 에서 위젯 가시성 축(`visible`/`hidden`)과 패널 전개 축(`collapsed`/`open`)을 직교 2축으로 신규 정의했다. 그러나 §3 의 ASCII 상태기계 다이어그램(`[collapsed]──open──▶...`)은 패널 전개 축만 나타내며 `show`/`hide`(가시성 축)가 표현되지 않는다. 독자가 다이어그램만 보면 가시성 축 존재를 알 수 없다.
- 제안: 다이어그램 위에 "※ 아래는 패널 전개 축만 표시. 가시성 축(show/hide)은 §3.2 참조" 한 줄 주석을 추가하거나, 가시성 축 전이를 다이어그램에 병기한다.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` — §1 추가 항목에 inline 괄호 설명이 있으나, §6 Rollout 정책의 "§1 대상 spec 60여개" 숫자가 갱신 대상 영역 확대와 함께 outdated 가능성
- 위치: `spec/conventions/spec-impl-evidence.md` §6 Rollout 정책 1번 항
- 상세: §6 는 "§1 대상 spec 60여개 일괄 frontmatter 추가" 라고 기술한다. `spec/7-channel-web-chat/` 영역 추가로 대상 파일 수가 늘었지만 숫자 "60여개"는 갱신되지 않았다. 이는 이 PR 이전부터 있던 기술이므로 이번 변경의 직접 문제는 아니나, 이번 spec/7 추가로 부정확도가 증가했다.
- 제안: §6 의 "60여개"를 실제 대상 파일 수 또는 "60여개(spec/7 영역 추가로 확대)" 로 보정하거나, 파일 수 대신 패턴 설명으로 교체한다.

---

### [INFO] `spec/7-channel-web-chat/3-auth-session.md` — §3.1 에서 `1-widget-app §3.1` 을 cross-ref 하나, 두 섹션이 서로를 참조하는 순환 구조 — 독자 탐색 부담
- 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 재로드 복원 시퀀스 2번 항
- 상세: §3.1 의 200 분기에서 "SSE 재연결(`Last-Event-Id` 절차 = [1-widget-app §3.1])"을 참조하고, `1-widget-app §3.1` 표에서는 "(b) 복원" 항목이 `3-auth-session` 을 다시 참조할 수 있다. 순환 참조는 규약 위반이 아니나, 최초 진입점이 명확하지 않으면 독자가 두 문서 사이를 왕복해야 한다.
- 제안: `3-auth-session §3.1` 은 "인증 토큰 관점의 복원 절차"이고 `1-widget-app §3.1` 은 "SSE 재연결 절차"라는 분담 범위를 각 섹션 도입부 1줄에 명시하면 순환 탐색 부담을 줄일 수 있다.

---

### [INFO] consistency-check 산출물 파일들(`review/consistency/2026/06/03/09_46_31/`) — `_retry_state.json` 의 `agents_success`/`agents_fatal`이 초기 빈 값으로 커밋됨
- 위치: `review/consistency/2026/06/03/09_46_31/_retry_state.json`
- 상세: `agents_success: []`, `agents_fatal: []`, `agent_history: {}` 가 빈 초기 상태로 커밋됐다. 실제 검토 성공 후 기록이 갱신된 최종 상태가 아니라 세션 시작 시점 스냅샷이다. 검토 결과물(SUMMARY.md, 각 checker.md)은 완성됐으므로 기능상 문제는 없으나, 이 파일을 사후 감사용으로 참조할 경우 "검사가 시작만 되고 결과가 없다"고 오해할 수 있다.
- 제안: 워크플로 완료 후 `agents_success` 에 완료된 checker 목록이 기록된 최종 상태를 커밋하도록 오케스트레이터 패턴을 검토하거나, 파일 상단에 "이 파일은 세션 초기 상태 스냅샷" 주석을 추가한다.

---

### [INFO] `spec/7-channel-web-chat/0-architecture.md` §4 — `WEB_CHAT_WIDGET_ORIGINS` 환경변수 설명에 `.env.example` 파일 위치 명시 없음
- 위치: `spec/7-channel-web-chat/0-architecture.md` §4, diff 추가 2줄
- 상세: "`.env.example` 에 샘플 항목 제공"이라고 기술했으나 `.env.example` 의 실제 경로(`codebase/backend/.env.example`)가 명기되지 않았다. 4-security §2.1 에서도 동일하게 경로 없이 언급한다. 독자(특히 새 개발자)가 어느 위치의 `.env.example` 인지 추측해야 한다.
- 제안: "backend `.env.example`(`codebase/backend/.env.example`)"로 명확히 기재한다.

---

## 요약

이번 변경은 `spec/7-channel-web-chat/` 의 여러 명세 갭(SSE 재연결·가시성 축·보안 Rationale·env 키 문서화)을 spec 에 보완하고, consistency-check 산출물을 추가한 것이다. 문서화 관점에서 CRITICAL 또는 WARNING 수준의 결함은 없다. 신규 §3.2(가시성 축)와 Rationale 신설은 cross-ref, 결정 근거, 기각 대안을 모두 적절히 기술하고 있다. 다만 §3 ASCII 다이어그램이 가시성 축을 반영하지 않아 독자가 다이어그램에서 신규 축의 존재를 파악하기 어렵고, §1 보안 요약표가 `blocked` 상태를 아직 언급하지 않는 경미한 불일치가 있다. `spec-impl-evidence.md` §6의 "60여개" 숫자는 영역 확대 후 부정확도가 높아졌다. 이 세 항목은 모두 INFO 수준으로 기능 동작에 영향을 주지 않으나, 명세 문서의 자기 완결성을 위해 후속 보완이 권장된다.

---

## 위험도

NONE
