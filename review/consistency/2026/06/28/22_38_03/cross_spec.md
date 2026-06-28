# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/7-trigger/providers/` (discord.md / slack.md / telegram.md / _overview.md)
검토 모드: impl-done (diff-base: origin/main)
실제 변경 파일: `codebase/backend/test/` 하위 e2e spec 3개 + 신규 헬퍼 파일 1개 (spec 파일 변경 없음)

---

## 발견사항

- **[INFO]** Discord §5.5 / Slack §5.5 절 번호가 시스템 spec §5.5 와 이름 충돌
  - target 위치: `spec/4-nodes/7-trigger/providers/discord.md §5.5 "Typing (CCH-MP-04 - typing 등가)"`, `spec/4-nodes/7-trigger/providers/slack.md §5.5 "Typing (CCH-MP-04 - typing 등가)"`
  - 충돌 대상: `spec/5-system/15-chat-channel.md §5.5 "Inbound HTTP Contract"`
  - 상세: provider spec 내부의 §5.5 절 (Typing 등가)과 시스템 spec 의 §5.5 (Inbound HTTP Contract) 가 동일 번호를 사용한다. provider spec 들이 시스템 spec §5.5 를 `#55-inbound-http-contract` anchor 로 cross-reference 할 때 — 예: `[Spec Chat Channel §5.5 Inbound HTTP Contract]` — 독자가 provider 파일 자체의 §5.5 (Typing) 와 혼동할 수 있다. 문서 상호참조가 명시적 anchor 를 사용하므로 런타임 동작 충돌은 없으나, 독자 혼란 가능성이 있다. Telegram.md 에는 §5.5 절이 없어(§5.4 → §5.6 으로 건너뜀) 일관성이 부족하다.
  - 제안: 동기화 권장 수준(낮음). provider spec 의 typing 절을 §5.5 에서 다른 번호로 이동하거나, cross-reference 텍스트에 "시스템 spec §5.5" 를 명확히 구분하는 주석을 추가. telegram.md 의 §5.5 누락도 함께 정렬하면 provider 간 번호 체계가 통일된다.

- **[INFO]** Slack §8 retry 백오프 간격이 Discord §8 과 미세하게 다르게 기술됨
  - target 위치: `spec/4-nodes/7-trigger/providers/slack.md §8` — "시도 사이 대기는 1s · 2s 두 번 — 3번째(마지막) 시도 실패 후엔 더 대기하지 않으므로 4s 대기는 실제로 발생하지 않는다"
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/discord.md §8` — "5초 타임아웃 + 3회 지수 백오프 (1s / 2s / 4s)"
  - 상세: CCH-SE-01 (`spec/5-system/15-chat-channel.md`) 는 "5초 타임아웃 + 3회 지수 백오프 재시도" 만 기술하고 구체 간격을 지정하지 않는다. Slack 은 "1s / 2s (4s 미발생)" 으로 구현 사실을 정직하게 반영하나, Discord 는 "1s / 2s / 4s" 로 이론적 지수를 기재해 두 provider 의 실제 동작 차이가 있을 수 있다. 두 어댑터가 공통 CCH-SE-01 을 따른다고 주장하지만 실제 간격이 다를 경우 spec 이 구현 사실을 정확히 반영하지 못한다.
  - 제안: 실제 구현 (`discord-client.ts` 의 retry 로직)을 확인해 discord.md §8 의 "4s" 기술이 정확한지 검증. 만약 Discord 도 Slack 과 동일하게 3번째 시도 후 대기가 없다면 discord.md 를 Slack 과 동일하게 정정 권장.

- **[INFO]** Discord §5.1 (b) "현재는 (a) slash 만 동작한다" vs _overview.md §1 "supported (v1)" 상태 표기
  - target 위치: `spec/4-nodes/7-trigger/providers/discord.md §5.1` — "계획상 v1 default UX = (b) modal…이나, 현재는 (a) `/<prefix> reply` slash 만 동작한다."
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/_overview.md §1` — discord: `supported (v1)`
  - 상세: _overview.md §1 은 discord 를 "supported (v1)" 으로 표시하지만, discord.md §5.1 이 AI Multi Turn 의 (b) Reply 버튼→Modal 경로가 미구현임을 명시한다. `supported` 정의("spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료")와 (b) 미구현이 모순처럼 보인다. `pending_plans`(`spec-sync-discord-gaps.md`) 가 이를 추적하고 있고 `status: partial` frontmatter 도 기술되어 있으므로 실질적 충돌은 아니나, _overview.md 의 `supported` 분류가 `partial` frontmatter 와 불일치한다.
  - 제안: _overview.md §1 표에 discord 상태를 `supported (v1, partial)` 또는 `partial (v1)` 로 표기하거나, _overview.md §2 "Spec-defined / impl-pending" 에 미구현 기능 주석을 추가해 _overview 와 discord.md frontmatter 간 정합을 맞출 것을 권장.

---

## 요약

`spec/4-nodes/7-trigger/providers/` 의 세 provider spec (discord.md / slack.md / telegram.md) 과 _overview.md 는 상위 spec (`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/1-data-model.md`) 과 데이터 모델·API 계약·RBAC·상태 전이 관점에서 직접적인 충돌 없이 정합적이다. 이번 실제 diff 는 spec 파일 변경을 포함하지 않고 e2e 테스트 헬퍼(`nextE2eClientIp`)와 테스트 요청에 `x-forwarded-for` 헤더를 주입하는 코드만 변경했으므로, target spec 영역과 다른 spec 영역 간 새로운 충돌을 유발하지 않는다. 발견된 세 건은 모두 INFO 수준 — 절 번호 명명 비일관성, provider 간 retry 간격 기술 차이, _overview.md 상태 표기와 frontmatter 간 미세 불일치 — 으로, 기존 spec 에 이미 내재된 사항이며 이번 변경이 새로 생성한 충돌이 아니다.

---

## 위험도

LOW
