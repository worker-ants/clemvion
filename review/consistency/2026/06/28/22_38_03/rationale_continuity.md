# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/7-trigger/providers/` (discord.md, slack.md, telegram.md, _overview.md)
검토 모드: impl-done (diff-base=origin/main)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] Slack §5.3 file modal 제약 — Convention R-CCA-8 (a)와 표현 방식 미세 차이
- target 위치: `slack.md §5.3` — "modal 수용 타입 제약" 주석: `file` 필드만 §4.1 제외, 나머지 모든 type 은 modal 수용
- 과거 결정 출처: `spec/conventions/chat-channel-adapter.md Rationale R-CCA-8 (a)` — "§4.1 진입 조건은 fields ≤ 5 외에 '전 필드가 해당 provider 의 modal 수용 타입' 도 포함"
- 상세: R-CCA-8 (a)는 "각 `providers/<name>.md §5.3` SoT" 라 명시하며, Slack 의 경우 datepicker/checkboxes 등을 modal input block 으로 수용함을 구체 providers 파일에서 정의하도록 위임한다. slack.md §5.3 은 이를 올바르게 반영해 "Slack modal 은 모든 type 수용 (file 제외)" 로 기술한다. 불일치는 없으나, 표현이 "file 만 제외" 로 compact 하여 date picker 가 Slack modal 안에서 `datepicker` element 로 수용된다는 사실이 discord.md §5.3 의 "date = TEXT_INPUT + 형식 안내로 degrade" 와 대조적이다. 이는 두 provider 의 정당한 플랫폼 차이를 반영한 것으로 충돌이 아니다. R-CCA-8 (a)의 "provider 별 modal 수용 타입 차이" 원칙과 완전히 정합.
- 제안: 현 기술 그대로 유지 가능. 선택적으로 slack.md §5.3 주석에 "datepicker/checkboxes 포함" 을 명시해 Discord modal TEXT_INPUT-only 와의 차이를 독자가 쉽게 인지하도록 보완 가능.

### [INFO] Discord §5.1 — Reply 버튼 → Modal 의 현 구현 상태 기술
- target 위치: `discord.md §5.1` — "(b) Reply 버튼→modal 이 v1 default UX" + "현재는 (a) slash 만 동작한다. (b) 도입 시 (a) 는 power user 보조 옵션으로 병존."
- 과거 결정 출처: `spec/5-system/15-chat-channel.md Rationale R-CC-13` — "사용자 reply 는 (a) slash command 또는 (b) Modal TEXT_INPUT 으로만 가능" + "v1 default UX = (b) modal"
- 상세: R-CC-13 은 (a)·(b) 두 경로 병존을 normative 로 정의하고 "v1 default UX = (b) modal" 로 명시한다. discord.md §5.1 은 동일 내용을 기술하면서 "현재는 (a) slash 만 동작" 이라는 구현 현실도 솔직히 병기한다. 이는 spec 과 구현 사이의 gap 을 솔직하게 드러내는 것이지 Rationale 에서 기각된 설계를 재도입하는 것이 아니다. R-D-3 의 결론과 일관된다.
- 제안: 현 기술 유지. `pending_plans`에 (b) Modal UX 구현 완료 플랜이 없다면 별도 plan 파일에 추적하는 것이 바람직하나, Rationale 연속성 관점의 충돌은 없다.

### [INFO] discord.md frontmatter `status: partial` — _overview.md §1 "supported (v1)"과 불일치
- target 위치: `discord.md` frontmatter `status: partial` / `_overview.md §1` 표 `supported (v1)`
- 과거 결정 출처: `_overview.md Rationale "supported = spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료"` + `spec-defined / impl-pending 단계 도입` 항
- 상세: _overview.md §1 의 supported 정의는 "e2e 테스트 모두 완료" 를 포함한다. discord.md/slack.md/telegram.md 의 `status: partial` frontmatter 는 "pending_plans" 가 있음을 표현하는데, `_overview.md §1` 의 `supported (v1)` 분류 기준과 frontmatter status 의 의미가 미세하게 불일치한다. Rationale 은 supported ↔ spec-only ↔ future 3단계를 catalog 에서 정의하지만 개별 파일 frontmatter 의 partial 과의 관계를 명시하지 않는다. 기각된 설계의 재도입은 아니며, 단계 정의의 세밀화 부재.
- 제안: _overview.md Rationale 에 "개별 파일 frontmatter `status: partial` 은 supported 카탈로그 등록 후에도 후속 spec-sync plan 이 있을 때 사용 가능" 임을 보완하거나, supported 진입 조건에서 "e2e 완료" 를 "핵심 e2e 완료 (gap 별도 추적 가능)" 로 세밀화하는 것을 고려.

---

## 요약

대상 문서 4개 (`_overview.md`, `discord.md`, `slack.md`, `telegram.md`) 는 기존 Rationale 에서 기각된 설계 대안을 재도입하거나 합의된 invariant 를 위반하는 사례가 없다. 핵심 결정들 — Interactions Webhook only (R-D-3), DM only (R-D-4), inboundSigningRef 단일 슬롯 (R-D-1/R-S-1), native modal 예외 절 (R-CCA-8), file 필드 v1 미지원 (R-D-7/R-D-9), Slack socket mode v2 연기 (R-S-3), typing no-op (R-S-5) — 모두 해당 Rationale 항목과 정합하며 번복 없이 일관되게 서술되어 있다. 발견된 세 항목은 모두 INFO 수준으로, 표현상의 세밀화 보완 제안이지 Rationale 연속성을 위협하는 충돌이 아니다.

## 위험도

NONE

STATUS: SUCCESS
