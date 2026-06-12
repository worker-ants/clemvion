# 요구사항(Requirement) Review

## 발견사항

### [INFO] 파일 4 — `backend-labels.ts` ERROR_KO 신규 매핑 7종 — spec §5.4 line-level 일치

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/backend-labels.ts` line 601–618
- 상세: 추가된 7종 에러 코드(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)가 `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표의 `error.code` 열거값과 정확히 일치한다. `WORKSPACE_ID_REQUIRED` 는 동 §5.4 표에 등재돼 있으나 별도 처리(아래 INFO 참조). `TRIGGER_NOT_FOUND` 은 `spec/data-flow/10-triggers.md` 소관 코드로 chat-channel 경로(hooks webhook inbound)에서도 노출되므로 등재 근거 충분.
- 제안: 없음.

---

### [INFO] 파일 1·2 — triggers.mdx / triggers.en.mdx Callout 에러 코드 목록 parity 확인

- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` · `triggers.en.mdx` Callout
- 상세: 이번 변경 set 에서 두 파일 모두 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 2종이 추가됐고 "영문 그대로 노출" 문구가 현행화됐다. `WORKSPACE_ID_REQUIRED` 는 triggers.mdx/en.mdx 에 이미 포함돼 있으므로 (기존 목록 유지) parity 에 문제 없다.
- 제안: 없음.

---

### [INFO] 파일 3 — `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 에서 `WORKSPACE_ID_REQUIRED` 처리 방식

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열
- 상세: `spec/5-system/15-chat-channel.md §5.4` 표에 `WORKSPACE_ID_REQUIRED` 가 chat-channel rotate-bot-token 경로의 user-facing 에러 코드로 명시돼 있고 triggers.mdx 에도 포함돼 있다. `ERROR_KO` 에는 이미 존재하나 이번 변경에서 `LOCALIZED_ERROR_CODES` P3-C-2 parity 가드 배열에 추가됐다(케이스 (9) 테스트도 추가됨). 이는 기능 결함이 없고 RESOLUTION.md 에서 INFO#1 fix 로 처리됐으며 올바르다.
- 제안: 없음. 처리 완료.

---

### [INFO] 파일 3 — `translateBackendError` 직접 단위 테스트 — 7종 루프 + WORKSPACE_ID_REQUIRED 개별 케이스

- 위치: `backend-labels.test.ts` describe `"translateBackendError — 직접 단위 테스트"` line 460+
- 상세: 케이스 (7) (ko→ERROR_KO 반환), (8) (en→fallback 반환) 이 chat-channel 에러 코드 7종 전부에 대해 루프로 추가됐다. 케이스 (9) 는 `WORKSPACE_ID_REQUIRED` 를 독립 검증한다. 이는 이전 review WARNING#1(테스트 커버리지 갭)을 해소하며 기존 (5)/(6) 패턴과 일관성이 유지된다.
- 제안: 없음.

---

### [INFO] 파일 6 — `spec-sync-chat-channel-gaps.md` `worktree` sentinel 수정

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter
- 상세: `worktree: spec-sync-audit` → `worktree: (unstarted)` 변경. `.claude/docs/plan-lifecycle.md §39` 의 미착수 sentinel 규약과 일치. 실존하지 않는 worktree 이름을 가리키던 문제가 해소됐다.
- 제안: 없음.

---

### [INFO] spec fidelity — `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 추가 (spec §5.4 대비 이전 요구사항 누락 해소)

- 위치: `backend-labels.ts` + `backend-labels.test.ts` + `triggers.mdx` / `triggers.en.mdx`
- 상세: 이전 변경 set(PR #566)에서 i18n 등재가 누락됐던 `BOT_TOKEN_INVALID`(400)·`CHAT_CHANNEL_SETUP_FAILED`(502) 2종이 이번 변경으로 `ERROR_KO`, parity 가드, 두 언어 문서에 모두 등재됐다. spec §5.4 실패 응답 표의 7종 전부가 이제 frontend i18n 에 반영된 상태다.
- 제안: 없음. 기능 완전성 달성.

---

### [INFO] 비즈니스 로직 — `BOT_TOKEN_INVALID` vs `INVALID_BOT_TOKEN` 의미 구분 반영 여부

- 위치: `backend-labels.ts` line 603–615
- 상세: spec §5.4 는 두 코드를 별도 행으로 명확히 구분한다: `INVALID_BOT_TOKEN`(400) = controller 입력 검증 (newBotToken 누락/비-string), `BOT_TOKEN_INVALID`(400) = setupChannel 401/403 (provider 인증 실패). 코드 구현도 이 구분을 반영해 별도 한국어 메시지("봇 토큰이 올바르지 않아요. 새 봇 토큰을 입력해 주세요." vs "봇 토큰이 유효하지 않아요 (제공자 인증 401/403). 토큰을 확인해 주세요.")로 각각 등재했다. 비즈니스 로직이 spec 과 line-level 로 일치한다.
- 제안: 없음.

---

## 요약

이번 변경 set 의 핵심 기능 — chat-channel 에러 코드 7종 i18n 매핑(`ERROR_KO`), parity 가드(`LOCALIZED_ERROR_CODES`), 직접 단위 테스트 케이스(7)(8)(9), 한·영 사용자 가이드 callout 갱신 — 은 `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표와 line-level 로 완전히 일치한다. 이전 review 에서 지적된 WARNING 3건(테스트 커버리지 갭, generator docstring 미반영, EN 문서 stale)과 INFO#1(`WORKSPACE_ID_REQUIRED` parity 미포함)이 모두 해소됐다. `TRIGGER_NOT_FOUND` 번역("해당 웹훅 엔드포인트를 찾을 수 없어요")은 영문 SoT(`hooks.service.ts` "Webhook endpoint not found")를 충실히 번역한 것이므로 spec fidelity 문제 없다. Critical/Warning 수준의 요구사항 미충족 또는 spec 불일치는 발견되지 않는다.

## 위험도

NONE

STATUS: SUCCESS
