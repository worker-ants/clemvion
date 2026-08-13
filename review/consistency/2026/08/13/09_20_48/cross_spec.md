# Cross-Spec 일관성 검토 — CCH-SE-02 (chat-channel update dedup)

## 검토 범위 확인

프롬프트 번들에 실제 target(`spec/5-system/14-external-interaction-api.md`)과 `<git diff origin/main...HEAD -- code_areas>` 가 예산 초과로 절단되어 있었다. 절단분은 원 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접 `git diff origin/main...HEAD` / `Read` / `grep` 으로 재확인했다.

실제 diff(`origin/main`(`f59e2343d`) → `HEAD`(`f9e544a73`))는 branch/디렉토리명(`eia-r8-cache-scope`)과 달리 **EIA §R8 캐시 스코프 작업이 아니라 CCH-SE-02 (chat-channel update dedup) 구현**이었다 (브랜치 `claude/cch-se02-dedup`). EIA §R8 관련 커밋들(`a80599700` 등)은 이미 `origin/main` 에 병합되어 이번 diff 범위 밖이다. 변경 spec: `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/data-flow/14-chat-channel.md`. 변경 코드: `ChatChannelDedupService`(신규) + `chat-channel.module.ts` + `hooks.service.ts` 배선.

## 발견사항

### 검증 완료 — 충돌 없음 확인 항목

다음은 잠재 충돌 후보로 조사했으나 **실제 충돌이 아님을 코드/spec 대조로 확인**했다:

- **EIA-AU-08 in-process trusted caller 전제**: 신규 Rationale `R-CC-20`(`spec/5-system/15-chat-channel.md:710`)은 "chat-channel inbound 가 HTTP `IdempotencyInterceptor` 를 통과하지 않는다"는 전제로 별도 dedup 서비스 도입을 정당화한다. `codebase/backend/src/modules/external-interaction/interaction.controller.ts` 확인 결과 `IdempotencyInterceptor` 는 `@UseInterceptors` 로 컨트롤러 메서드(HTTP 파이프라인)에만 걸려 있고, chat-channel 은 `InteractionService.interact()` 를 in-process 직접 호출(EIA-AU-08, `spec/5-system/14-external-interaction-api.md:96`)하므로 실제로 그 인터셉터를 우회한다. 전제 사실.
- **Redis 키 네임스페이스 충돌**: 신규 `cc:dedup:{triggerId}:{idempotencyKey}` (TTL 30s) 와 기존 `cc:rl:{triggerId}:{conversationKey}` (rate-limit), EIA 의 `interaction:idempotency:<executionId>:<route>:<key>` (§R8, `spec/5-system/14-external-interaction-api.md:1061`) 는 접두사가 모두 달라 충돌 없음.
- **요구사항 ID 충돌**: `CCH-SE-02`, `R-CC-20` 모두 `spec/` 전체에서 이 변경 위치 외 재사용처 없음 (grep 전수 확인).
- **처리 순서 정합**: spec 은 "dedup 게이트가 rate-limit(CCH-NF-03) 보다 앞" 이라고 명시하는데, `codebase/backend/src/modules/hooks/hooks.service.ts` 실제 배선도 `chatChannelDedup.claim`(L339) → `chatChannelRateLimiter.consume`(L354) 순서로 일치.
- **모듈 계층 책임**: `ChatChannelDedupService` 는 `chat-channel` 모듈에 상주하고 `providers`/`exports` 양쪽에 등록되어 `ChatChannelRateLimiterService` 와 동일 패턴으로 `HooksModule` 에 노출된다 — 기존 계층 분리 결정과 일치.

### [INFO] Slack/Discord provider spec 이 동일 구현 완료를 반영하지 않음

- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md:235` (변경분 — "구현됨 (2026-08-13)" 주석 추가)
- 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md:301`, `spec/4-nodes/7-trigger/providers/discord.md:324`
- 상세: 신규 dedup 게이트(`ChatChannelDedupService.claim`)는 `HooksService.handleChatChannelWebhook` 공통 경로에 배선되어 **provider 무관하게 (telegram/slack/discord 전부) 적용**된다. 그런데 이번 diff 는 telegram.md 에만 "미구현 (Planned)" → "구현됨 (2026-08-13)" 주석을 갱신했고, slack.md/discord.md 의 동일 취지 문장("Events API dedup — ...", "interaction.id 기반 dedup — ...")은 애초에 구현 상태 주석이 없어 (사실상 이전에도 미구현이었다는 사실이 telegram.md 처럼 명시된 적이 없다) 이번 구현 완료로 그 문장들이 처음으로 참이 됐다는 사실이 기록되지 않는다. 모순은 아니지만 세 provider 문서 간 "구현 상태 주석" 관례가 비대칭해졌다.
- 제안: slack.md/discord.md 에도 telegram.md 와 동일하게 `ChatChannelDedupService` 참조 + 구현 완료 주석을 추가해 세 provider 문서의 서술 정합도를 맞출 것 (spec 수정, `project-planner` 소관).

### [INFO] 신규 Rationale 내 앵커 링크 불일치 (문서 내 참조, 참고용)

- target 위치: `spec/5-system/15-chat-channel.md:718` (신규 R-CC-20 본문)
- 상세: `[R-CC-12 (b)](#r-cc-12-telegram-safe-2xx)` 앵커가 실제 `### R-CC-12. Inbound HTTP Contract — \`202 Accepted\` 고정 + \`401\` (auth) / \`404\` (endpointPath) 예외` 헤딩이 생성하는 슬러그와 일치하지 않는다 (해당 문자열로 된 헤딩이 파일 내에 없음 — `telegram-safe 2xx` 는 CCH-NF-03 행의 inline 문구일 뿐 헤딩이 아니다). 링크는 깨져 있지만 참조 대상 자체(R-CC-12 (b), 2xx 응답 유지 이유)는 실존하고 내용상 정합하다 — 순수 앵커 표기 오류로 cross-spec 충돌은 아니며 naming/convention 검토 영역에 더 가깝다.
- 제안: 앵커를 실제 슬러그로 정정 (사소, 선택적).

## 요약

이번 diff(CCH-SE-02 chat-channel update dedup 구현)는 EIA-AU-08 in-process trusted caller 예외, EIA §R8 idempotency 캐시 스코프, 기존 rate-limit(CCH-NF-03) 처리 순서, Redis 키 네임스페이스, 모듈 export 계층과 모두 정합하며 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 를 침해하는 CRITICAL/WARNING 급 모순을 발견하지 못했다. 유일한 아쉬움은 동일 구현이 적용되는 slack/discord provider 문서가 telegram 문서만큼 구현 상태를 명시하지 않아 생긴 문서 간 서술 비대칭(INFO)과, 신규 Rationale 의 앵커 링크 오타(INFO) 뿐이다.

## 위험도
LOW
