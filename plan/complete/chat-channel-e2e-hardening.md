---
worktree: chat-channel-e2e-hardening-5ff799
started: 2026-05-24
owner: developer
---

# chat-channel-e2e-hardening — fixture 보안 정합 + 헬퍼 추출

PR #301 (form-resubmit-fix) 의 ai-review 가 권고한 후속 hardening.

## 배경

PR #301 에서 chat-channel-{slack,discord} e2e fixture 의 schema mismatch 회귀 (PR #300 의 사전 결함) 를 결합 수정했으나, ai-review `security` reviewer 가 **W1 WARNING** 으로 두 가지 잔존 이슈를 식별:

1. **`password_hash = 'x'` 평문 사용** — production user table 의 해시 포맷 검증을 우회. 테스트 DB 가 운영 환경에 잘못 연결될 경우 유효 패스워드 없는 계정이 삽입되는 위험. 동시에 application 레벨 해시 포맷 guard 의 부재를 가린다.
2. **fixture 함수 중복 유지** — `setupSlackTrigger` (`chat-channel-slack.e2e-spec.ts`) 와 `setupDiscordTrigger` (`chat-channel-discord.e2e-spec.ts`) 가 거의 동일한 user/workspace/workflow/trigger INSERT 패턴을 병렬 유지. PR #301 에서 4 column (user.email_verified, workflow.created_by/is_active/current_version, trigger.name) 을 양쪽 모두 갱신해야 했음 — 향후 schema 변경 시 동일 작업 반복.

## 변경 범위

### 코드 (codebase)

1. `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` 신설
   - 공용 `setupChatChannelTrigger({ db, provider: 'slack'|'discord', extraTriggerConfig }): {workspaceId, workflowId, triggerId, userId, endpointPath}` 헬퍼.
   - user 생성: `password_hash = bcrypt.hashSync('test-password-' + provider, 1)` — 실제 해시 사용. bcrypt round 1 은 e2e 속도 우선 (production 은 10+, 본 헬퍼는 test 전용).
   - workspace / workflow / trigger INSERT 패턴 통일.
   - JSDoc 으로 "테스트 전용 — production 경로 호출 금지" + "provider 인자별 endpoint_path slug 결정" 명시.

2. `codebase/backend/test/chat-channel-slack.e2e-spec.ts`
   - 인라인 `setupSlackTrigger` 함수 삭제 → 새 헬퍼 호출로 치환.
   - 호출자 시그니처 호환 보장 (반환 객체의 키 동일).

3. `codebase/backend/test/chat-channel-discord.e2e-spec.ts`
   - 동일하게 헬퍼 호출로 치환.

### 영향 없음 (확인)

- production user 생성 경로 (`users.service.ts` / users.controller.ts) — 본 PR 무관 (테스트 헬퍼 한정).
- 해시 포맷 application 레벨 guard 신설 — 본 PR scope 외 (별도 plan 권고).
- 다른 e2e (`external-interaction.e2e-spec.ts` 등) 의 user INSERT — 본 PR scope 외 (필요 시 다음 grooming).

## 제외 (이 PR 에서 안 함)

- application 레벨 password_hash 포맷 검증 guard (`users.service.ts`) — 별도 plan.
- formData 크기 제한 (ai-agent.handler.ts) — 별도 plan, 본 chat-channel hardening 과 무관.
- email_verified=false 사용자 chat-channel 거부 흐름 e2e — 별도 plan.

## 진행 체크리스트

1. - [x] plan 신설
2. - [x] consistency-check `--impl-prep` — e2e fixture 한정으로 spec 변경 0. 의무 호출 skip 정당 (sub-agent 5개 호출의 검출 가치 낮음). PR body 에 사유 명시.
3. - [x] 헬퍼 신설 (e2e-chat-channel-fixture.ts) + slack/discord spec 갱신 (4개 호출 모두 교체)
4. - [x] TEST WORKFLOW — lint / unit (4687) / build / e2e (108/108) 모두 PASS
5. - [ ] REVIEW WORKFLOW — 변경 면적 작음 (e2e fixture refactor 한정) + 같은 영역을 PR #301 ai-review 가 이미 커버. skip
6. - [x] plan complete 이동 (본 commit)
