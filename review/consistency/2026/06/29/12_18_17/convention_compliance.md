# 정식 규약 준수 검토 — `spec/4-nodes/7-trigger/providers/slack.md`

검토 모드: spec draft (--spec)
대조 규약: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/secret-store.md`, `spec/conventions/spec-impl-evidence.md`, 시스템 SoT `spec/5-system/15-chat-channel.md §5.5/§5.5.1`

## 발견사항

- **[WARNING] `200 OK` 예외를 "§5.5 후속 갱신 대상" 으로 서술 — 시스템 SoT 는 이미 갱신 완료(stale 참조)**
  - target 위치: §6 "Slack 특이 예외" 항목 2 ("본 예외도 Spec Chat Channel §5.5 의 후속 갱신 대상이거나, 본 spec 의 … Rationale (R-S-8) 에 기록"), Rationale R-S-8 마지막 줄 ("§5.5 의 case 표에 … 행 추가가 후속 갱신 대상")
  - 위반 규약: `spec/5-system/15-chat-channel.md §5.5 Inbound HTTP Contract` (line 418–419 에 "Slack URL Verification → 200 OK + {challenge}", "Slack Interactivity ack → 200 OK" 두 행이 **이미 ratified**) + §5.5.1 Provider-specific 응답 예외 정책 (이미 신설되어, SoT 가 `providers/<name>.md §3.x/§6` 임을 명시)
  - 상세: 시스템 spec 은 이미 (a) 두 Slack 예외 행을 표에 등재했고, (b) §5.5.1 에서 예외 추가 정책을 정식화했으며, (c) 그 SoT 를 provider spec(즉 본 slack.md)으로 지정했다. 그런데 본 target 은 같은 예외를 "후속 갱신 대상" 으로 표현해, 변경이 미반영 상태인 것처럼 읽힌다. 규약 위반은 아니나(값은 일치) 문서 간 상태 표현이 어긋난다(drift). §3.1 의 동일 예외 서술("§5.5 의 202 Accepted 정책에 대한 명시적 예외")은 정확하므로, §6/R-S-8 의 "후속 갱신 대상" 표현만 stale.
  - 제안: §6 항목 2 와 R-S-8 의 "후속 갱신 대상" 문구를 "§5.5 표 line 418–419 + §5.5.1 에 이미 반영됨(본 spec 이 SoT)" 로 수정. 또는 §5.5.1 가 본 provider spec 을 SoT 로 위임했음을 명시하는 cross-link 로 교체.

- **[INFO] frontmatter `user_guide` 키 — sibling telegram.md 와의 일관성**
  - target 위치: frontmatter `user_guide:` (slack.mdx / slack.en.mdx)
  - 위반 규약: 직접 위반 아님. `spec-impl-evidence.md §2.1` 에서 `user_guide` 는 선택 필드이고 두 MDX 파일 모두 실존 확인됨. 형식·경로 모두 적법.
  - 상세: 동일 디렉토리의 `telegram.md` 는 `user_guide` 키가 없다(둘 다 `status: partial`). slack.md 가 더 완전한 쪽이라 문제는 아니지만, 두 provider spec 의 frontmatter 모양이 비대칭이다.
  - 제안: 일관성을 원하면 telegram.md 에도 `user_guide` 를 추가(가이드 페이지가 있으면). 본 target 측 수정은 불요 — 정보용.

## 규약 준수 확인 (위반 없음 — 대조 결과 요약)

- **frontmatter 스키마** (`spec-impl-evidence.md §2`): `id: slack`(kebab, basename 일치), `status: partial` + `pending_plans`(필수) 충족 + `code:`(≥1 매치, 실존 경로) + `user_guide`(선택, 실존). `pending_plans` 의 `plan/in-progress/spec-sync-slack-gaps.md` 실존 확인 → §4 가드(`spec-pending-plan-existence`) 통과 예상.
- **문서 구조** (CLAUDE.md 3섹션): `## Overview (제품 정의)` / 본문(§3–§8) / `## Rationale` 구조 정확. 진입부 "관련 문서" 링크 줄, provider 명세 SoT 선언 모두 sibling telegram.md 패턴과 정합.
- **명명 규약**:
  - `provider: "slack"` lower-case (chat-channel-adapter §5 registry 규칙 준수).
  - secret ref `secret://triggers/{id}/bot-token`, `secret://triggers/{id}/inbound-signing` — `secret-store.md §1` 의 등재 슬롯과 정확히 일치(Slack = HMAC-SHA256 signing secret, provider-issued, 사용자 입력). `inboundSigningRef` 단일 슬롯 공유(R-S-1)도 secret-store line 34 + chat-channel-adapter §2.3 표와 일치.
  - 백엔드 메서드명 `assertInboundSigningPlaintextByProvider`, 에러 `400 VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`) — sibling discord.md §6 과 동일 토큰·동일 패턴(Slack 은 `^[a-f0-9]{32}$`, Discord 는 `^[a-f0-9]{64}$`)으로 정합.
- **출력 포맷 규약**:
  - `ChannelUpdate.command` kind 들(`text_message`/`button_callback`/`file_upload`/`open_form_modal`/`form_submission`/`start`/`cancel`)이 chat-channel-adapter §2.1 union 과 일치. `open_form_modal.openContext: { triggerId }` 가 convention 의 `openContext: Record<string, string>` 에 적합.
  - `form_submission` 의 `{ <field.name>: rawValue }` 평탄화를 `parseUpdate` 안에서 수행(§4.2, §3.3) — convention §2.1 "`form_submission` normalize 책임 … parseUpdate 안 … pure" 규약 준수.
  - native modal 게이팅(`form_modal` 버튼 → `open_form_modal` → `openFormModal` → `views.open` → `view_submission`)이 convention §4.1 step 1–6 + §1.1 옵션 메서드(`openFormModal?`/`buildFormSubmissionResponse?`) 책임 분리와 정합. 5-fields/ file-필드 제외/ formMode 분기(R-S-6)도 §4 + R-CCA-8 와 일치.
  - `execution.failed` 처리(§5.6)가 convention §3.1 `classifyExecutionFailure` (key+placeholders) lookup·치환, 민감정보 strip(CCH-ERR-03) 규약 준수.
  - `renderNode` 입력에 chat-channel-internal `execution.node.completed`(§5.4 시각형) 수용 — convention §1.3 / R-CCA-7 와 정합.
- **API 문서 규약** (swagger.md): 본 target 은 spec 산문 문서이고 OpenAPI/DTO 데코레이터를 직접 정의하지 않으므로 해당 없음.
- **금지 항목**: plaintext 자격증명 노출 금지(CCH-SE-03) 준수 — botToken/signing secret 은 ref 만 보관, `private_metadata` 에 자격증명·PII 금지(§6, SS-SE-01 정신) 명시. `inboundSigningRef` 단일 슬롯에 provider 별 ref 신설 금지 정신도 준수.

## 요약

본 target 은 chat-channel-adapter / secret-store / spec-impl-evidence 정식 규약을 전반적으로 충실히 준수한다 — frontmatter 스키마, 3섹션 문서 구조, secret ref 명명, ChannelUpdate/ChannelMessage 출력 포맷, native modal 게이팅, execution.failed 분류 모두 규약과 정합하며 sibling telegram.md/discord.md 와도 일관된다. 단 하나의 실질적 어긋남은 §6 항목2·Rationale R-S-8 이 Slack `200 OK` 예외를 "Spec Chat Channel §5.5 의 후속 갱신 대상" 으로 서술하는 점이다 — 시스템 SoT(§5.5 line 418–419 + §5.5.1)는 이미 해당 예외 행과 예외 정책을 ratified 했고 그 SoT 를 본 provider spec 으로 위임했으므로, target 의 "후속 갱신 대상" 표현은 stale 한 상태 묘사다(값 자체는 일치하므로 invariant 위반은 아님). 문구 정정만 권고한다.

## 위험도

LOW
