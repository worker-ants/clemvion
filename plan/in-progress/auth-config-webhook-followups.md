---
worktree: (assigned at impl-start)
started: 2026-05-28
owner: TBD
status: backlog
---

# auth-config-webhook-wiring 후속 작업

본 PR (`plan/complete/auth-config-webhook-wiring.md`) 의 `/ai-review` (`review/code/2026/05/28/21_50_50/SUMMARY.md`) 에서 발견됐으나 본 PR scope 밖이거나 spec 개정이 선행돼야 하는 항목.

## 1. AuthConfig CRUD audit 기록 (review C6)

`spec/5-system/1-auth.md §4.1` 이 `auth_config.create/update/delete/regenerate/reveal` 5종 감사 로그를 명시 열거했으나, 현재 구현은 `reveal` 만 audit 기록한다 (`AuthConfigsService.reveal`). create/update/delete/regenerate 는 미기록.

- 작업: `AuthConfigsService.create/update/remove/regenerate` 에 `AuditLogsService.record` 추가.
- 선결: 이 메서드들이 `userId` 를 받지 않으므로 (controller 가 `@WorkspaceId` 만 전달), service 시그니처에 `userId` 추가 + controller 가 `@CurrentUser('sub')` 전파 필요.
- 테스트: 각 메서드 audit mock 검증.
- spec frontmatter: 본 PR 에서 `12-webhook.md`·`6-config.md` 를 `implemented` 격상 시 본 갭이 `partial` 사유가 될 수 있음 — 등재 필요.

## 2. chatChannel 트리거 + isActive=false 처리 순서 (review C2)

`hooks.service.handleWebhook` 의 `isActive=false → 410` 체크가 chatChannel 분기보다 먼저 실행돼, `config.chatChannel` 비활성 트리거가 `spec/5-system/12-webhook.md §7 step 5` 의 "202 + { ignored: true }" 대신 410 을 반환한다.

- **본 PR 무관**: 기존 chat-channel 동작이며 본 PR (webhook 인증 wiring) 은 이 순서를 변경하지 않았다. chat-channel e2e 가 현재 통과 중.
- 실제 spec ↔ 코드 불일치인지, 아니면 chat-channel 의 의도된 동작인지 chat-channel 도메인에서 재검토 필요.
- 작업 시: handleWebhook 의 chatChannel 분기를 isActive 체크보다 앞으로 이동 + chat-channel e2e 의 비활성 트리거 202 케이스 확인.

## 3. spec 보완 (project-planner 영역)

본 PR 은 developer 가 spec read-only 라 직접 못 고침. project-planner 위임 필요:

- `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (현재 §3.2 권한 매트릭스·Rationale 에만 언급).
- `spec/5-system/12-webhook.md` 에 IP 추출 정책 (CF-Connecting-IP → X-Forwarded-For → req.ip) 명시 또는 `1-auth.md §2.3` cross-reference. ip_whitelist fail-closed (clientIp 불명 시 거부) 동작도 명시 (본 PR 구현 반영).
- `spec/conventions/secret-store.md §3.3` — `ENCRYPTION_KEY` 다도메인(LLM API key / secret_store / AuthConfig.config) 재사용 위험. 중기 도메인별 키 분리 또는 HKDF 파생 검토 메모.
- `spec/5-system/12-webhook.md` — `auth_config_id IS NULL` 공개 webhook 의 endpointPath 재발급(regenerate) 수단 또는 운영 위험 경고.
- IP whitelist CIDR/IPv6 지원 여부 명시 (현재 구현은 exact match).

## 4. reveal 엔드포인트 rate limiting (review INFO)

`POST /api/auth-configs/:id/reveal` 에 rate limiting 미적용 — 단기간 다수 비밀번호 추측 시도 제한 수단 부재. Throttler 적용 검토.

## 비고 — review false positive (조치 불요)

- review C4 ("hooks.service.verifyAuth 가 inline 사용") / C5 ("reveal 미구현") 는 **오분석**. 실제로 `hooks.service` 는 `verifyWebhookRequest` 위임으로 재작성됐고 (commit `5f62d797`, verifyAuth 0건), reveal 은 구현됨 (commit `258daca5`, controller/service/spec). e2e 127 통과가 증거. RESOLUTION 에 반박 기록.
