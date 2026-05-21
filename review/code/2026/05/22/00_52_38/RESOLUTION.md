# RESOLUTION — 00_52_38

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (INFO 하향) | `36ffed71` | `execution.cancelled /* EIA §6.5 (cancelled) */` 주석 구분 — `execution.ai_message` 도 대칭 정리 |
| #2 | 코드 | `2126a1b5` | `hooks.service.spec.ts` — Chat Channel 분기 5케이스 추가 (CCH-AD-04, CCH-CV-03, EIA-AU-08, secretToken 검증) |
| #3 | 코드 | `2126a1b5` | `channel-conversation.service.spec.ts` 신설 — MockRedis, TTL 만료, graceful degradation |
| #4 | 코드 | `2126a1b5` | `telegram.adapter.spec.ts` 신설 — setupChannel/teardown/parseUpdate pure계약/sendMessage/ackInteraction |
| #5 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-security.md` — CCH-SE-03 우선순위 조정 + §4.1 주석 |
| #6 | — | (이미 해결) | `secretToken?: string` 이 `ChatChannelConfig §2.3` 에 이미 존재 — 조치 불필요 |
| #7 | — | (이미 해결) | telegram.md §5.4 중복 anchor 이미 `## 6. 보안` 으로 수정됨 — 조치 불필요 |
| #8 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-behavior.md` — CCH-CV-03 running 케이스 추가 |
| #9 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-behavior.md` — telegram.md §5.3 phone type 명확화 |
| #10 | 코드 | `bb1e5e99` | triggers.mdx + triggers.en.mdx Chat Channel 절 추가, telegram.mdx + telegram.en.mdx 신규 작성 |
| #11 | user-decision | (escalate) | `spec/2-navigation/4-integration.md` cafe24 내용 변경 — 스코프 외 변경 여부 사용자 결정 필요 |
| #12 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-behavior.md` — parseUpdate pure계약 / group refusal null 구분 |
| #13 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-security.md` — EIA-AU-08 scope 외부 주입 방지 구현 제약 |
| #14 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-arch.md` — NotificationDispatcher 분리 후속 plan + 리스너 중복 방지 |
| #15 | spec | (draft 위임) | `plan/in-progress/spec-fix-chat-channel-arch.md` — rotate-bot-token API 응답 계약 |
| #16 | 코드 | `36ffed71` | `spec/conventions/chat-channel-adapter.md` 끝에 `## Changelog` 섹션 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4333 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

### INFO 항목 (자동 수정 대상 아님 — 추적용)

- consistency review Round 3 SUMMARY.md 부재 — Round 3 결과의 BLOCK 판정 여부 직접 확인 필요
- chat-channel.md §3 본문 섹션 번호 재시작 — `## 3. 처리 흐름` 이 Overview §3 과 충돌 → project-planner 위임
- telegram-message.renderer.spec.ts — 미지원 nodeType fallback 케이스 1건 미추가 (INFO 수준)
- `_retry_state.json` / `meta.json` 파일 끝 개행 누락 — 자동 생성 도구 레벨 수정 권장
- EIA-AU-08 in-process bypass InteractionService 시그니처 변경 — 구현 단계에서 가드 테스트 의무화 필요

### user-decision 항목

- **SUMMARY#11**: `spec/2-navigation/4-integration.md` 의 cafe24 `install_token` 관련 서술 변경 (Rationale (c) 항 단축 포함) — Chat Channel PR 범위 외 변경. 스코프 분리 또는 현상 유지 여부를 사용자가 결정.

### spec draft 위임 (project-planner 처리 후 resolution-applier 재호출 가능)

- `plan/in-progress/spec-fix-chat-channel-security.md` — SUMMARY#5 + SUMMARY#13
- `plan/in-progress/spec-fix-chat-channel-behavior.md` — SUMMARY#8 + SUMMARY#9 + SUMMARY#12
- `plan/in-progress/spec-fix-chat-channel-arch.md` — SUMMARY#14 + SUMMARY#15
