# 요구사항(Requirement) Review

## 발견사항

### [INFO] 파일 1·2 (triggers.mdx / triggers.en.mdx) — 에러 코드 목록 현행화

- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 460, `triggers.en.mdx` line 447
- 상세: KO/EN callout 양쪽에 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 가 추가됐고, 한국어 안내 완료 문구로 갱신됐다. 두 코드 모두 spec §5.4 실패 응답 표(lines 345-346)에 등재된 정식 chat-channel 에러 코드다. 의도와 구현이 일치한다.
- 제안: 없음.

---

### [WARNING] 파일 3 — `CHAT_CHANNEL_CODES` 배열 comment 과 배열 크기 불일치

- 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` line 476 (`it("(7) ko + chat-channel 에러 코드 5종"`)과 line 464 주석 `// chat-channel API 에러 코드 5종`
- 상세: 테스트 it-block 제목과 인라인 주석 모두 "5종"으로 명시하고 있으나 실제 `CHAT_CHANNEL_CODES` 배열에는 7개 요소(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)가 들어 있다. "5종"은 이전 review SUMMARY W1 이 언급한 기존 코드 5종(rotate-bot-token 직접 경로)을 가리키나, RESOLUTION 에서 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 2종이 추가되면서 총 7종이 됐다. 의미상 오해를 유발한다.
- 제안: it-block 제목과 주석을 "7종" 또는 "5종+2종"으로 정정한다. 예: `"(7) ko + chat-channel 에러 코드 7종 → 각 ERROR_KO 한국어 메시지 반환 (영문 fallback 아님)"`.

---

### [INFO] 파일 3 — `TRIGGER_NOT_FOUND` spec §5.4 참조 범위 과도 클레임

- 위치: `backend-labels.test.ts` line 464 주석 `// chat-channel API 에러 코드 5종 (spec/5-system/15-chat-channel.md §5.4)`
- 상세: `TRIGGER_NOT_FOUND` 는 `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표에 등재되지 않는다 (§5.4 표는 `RESOURCE_NOT_FOUND` 를 404 trigger-미존재 코드로 등재). `TRIGGER_NOT_FOUND` 는 `hooks.service.ts:86` 의 webhook inbound 경로에서 발생하며, `spec/data-flow/10-triggers.md line 72` 에 해당 흐름이 정의돼 있다. 결과적으로 주석이 가리키는 §5.4 는 `TRIGGER_NOT_FOUND` 에 정확한 출처가 아니다. 기능 결함은 아니나, `ERROR_KO` 에 등록된 것 자체는 올바르다(triggers.mdx user-doc 에도 포함됨).
- 제안: line 464 주석에 `TRIGGER_NOT_FOUND` 는 `spec/data-flow/10-triggers.md §1` (webhook inbound 경로) 출처임을 명시하거나, 배열 내부에 별도 줄 주석으로 분리한다. spec §5.4 전체 클레임의 포괄성을 낮추는 표현 수정 권장(INFO).

---

### [INFO] 파일 3 — 이전 Warning 전부 해소 확인 (W1·W9)

- 위치: `backend-labels.test.ts` lines 466-498
- 상세: 이전 review SUMMARY Warning#1 (translateBackendError 직접 케이스 부재) → 케이스 (7)(8) 추가로 해소. SUMMARY INFO#1 (`WORKSPACE_ID_REQUIRED` parity guard 미포함) → `LOCALIZED_ERROR_CODES` 에 추가 + 케이스 (9) 추가로 해소. 두 항목 모두 기능 완전성 측면에서 충족됐다.
- 제안: 없음.

---

### [INFO] 파일 4 — `ERROR_KO` 신규 7종 spec 대응 확인

- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` lines 603-618
- 상세: 추가된 7종(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`) 중 `INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED`·`CHAT_CHANNEL_PROVIDER_UNKNOWN`·`CHAT_CHANNEL_ENDPOINT_REQUIRED`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 6종은 spec §5.4 실패 응답 표와 정확히 일치한다. `TRIGGER_NOT_FOUND` 는 `hooks.service.ts:86` / `spec/data-flow/10-triggers.md` 출처이며 user-doc `triggers.mdx` callout 에 포함된 코드다. 한국어 메시지 내용이 각 코드의 사유 설명과 의미상 일치한다.
- 제안: 없음.

---

### [INFO] 파일 1 (triggers.mdx) — `WORKSPACE_ID_REQUIRED` callout 미포함 상태 유지

- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 460 callout 목록
- 상세: `WORKSPACE_ID_REQUIRED` 는 spec §5.4 표(line 341)에 rotate-bot-token 경로 400 코드로 명시돼 있으나 callout 목록에 없다. `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 에는 이번 변경에서 추가됐으나 문서 callout 은 갱신되지 않았다. 기존 callout 목록이 이미 이 코드를 포함하고 있었던 상태이므로 이번 변경에서의 누락이 아님 — 선행부터의 기존 상태다. 이전 review SUMMARY INFO#1 에서 다뤄졌고 test-level 에서만 fix 됐다.
- 제안: spec §5.4 에 rotate-bot-token 400 코드로 명시된 `WORKSPACE_ID_REQUIRED` 를 차후 callout 목록에 추가하는 것을 검토한다 (비차단 — 기능 결함 아님).

---

### [SPEC-DRIFT] 파일 1·2 (triggers.mdx / triggers.en.mdx) — `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` user-doc 등재가 spec §5.4 이후 추가

- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 460, `triggers.en.mdx` line 447
- 상세: spec `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표에는 `BOT_TOKEN_INVALID`(400, setupChannel 401/403)·`CHAT_CHANNEL_SETUP_FAILED`(502, setWebhook 실패) 가 line 345-346 에 이미 정의돼 있다. 그러나 user-doc callout 이 이 두 코드를 목록에서 누락하고 있던 것이 이번 변경에서 추가됐다. 코드 구현이 spec 을 올바르게 반영한 것이며 되돌리기 오답 — user-doc 이 spec 의 완전한 error code 목록을 반영하지 않던 낡은 상태였다. 코드 버그가 아니라 이전 user-doc 상태가 spec 에 대해 incomplete 했던 것이 이번 변경으로 정합화됐다.
- 제안: 코드 유지. spec 갱신 대상 없음 (spec §5.4 표 자체는 이미 완전). user-doc 이 spec 을 완전히 반영하게 됐으므로 추가 조치 불필요.

---

## 요약

이번 변경(post-RESOLUTION fix set)은 이전 review의 Warning 3건과 INFO#1을 모두 해소한다. `translateBackendError` 직접 단위 테스트 케이스 (7)(8)(9) 추가, `WORKSPACE_ID_REQUIRED` parity guard 포함, EN callout 갱신이 의도대로 구현됐다. `backend-labels.ts` `ERROR_KO` 에 추가된 7종은 spec §5.4 및 user-doc triggers.mdx 와 일관성 있게 정합화됐다. 소규모 주의사항은 두 가지다: (1) it-block 제목과 주석이 "5종"으로 표기되나 실제 배열은 7종 — 의미 오해 가능한 코멘트 불일치(WARNING); (2) `TRIGGER_NOT_FOUND` 의 spec 출처 주석이 §5.4 로 돼 있으나 실제 출처는 `spec/data-flow/10-triggers.md`(hooks webhook inbound 경로)이다(INFO). 두 항목 모두 기능 결함이 아니다. 전반적으로 요구사항 충족이 완전하다.

## 위험도

LOW

STATUS: SUCCESS
