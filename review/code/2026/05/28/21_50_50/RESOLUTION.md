# RESOLUTION — auth-config-webhook-wiring ai-review

대상 SUMMARY: `review/code/2026/05/28/21_50_50/SUMMARY.md` (전체 위험도 HIGH, Critical 6 / Warning 13 / Info 21)

> SUMMARY 의 Critical 6건 중 2건(C4·C5)은 reviewer 의 diff 오분석(false positive)이며, 코드·테스트·e2e 로 반박됨. 나머지 진짜 이슈는 본 commit 에서 fix 했고, scope 밖·spec 개정 선행 항목은 `plan/in-progress/auth-config-webhook-followups.md` 로 이관.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 위치 |
|---|---|---|---|
| C1 — AuthConfig CRUD RBAC | **fix (본 commit)** | controller `create`/`update`/`remove` 의 `@Roles('editor')` → `@Roles('admin')`. spec 인증 §3.2 (Auth Config CRUD = Admin+, Editor=R) 정합. controller.spec RBAC 기대 갱신 + reveal 케이스 추가 | `auth-configs.controller.ts` 86·105·200, `auth-configs.controller.spec.ts` |
| C3 — bearer_token 자동 발급 강제 | **fix (본 commit)** | create 의 `&& !config.token` 등 조건 제거 — api_key/bearer/hmac 비밀값을 항상 자동 발급(사용자 입력 무시). spec §2.17.1/§2.17.3 정합. service.spec 성공 케이스 5개를 발급값 검증으로 수정 | `auth-configs.service.ts` create, `auth-configs.service.spec.ts` |
| security W3 / requirement W2 — ip_whitelist bypass | **fix (본 commit)** | ip_whitelist 설정 시 `clientIp` 불명이면 거부(fail-closed) — `if (ipWhitelist?.length) { if (!clientIp || !includes) throw }`. fail-closed 케이스 테스트 추가 | `auth-configs.service.ts` verifyWebhookRequest |
| C4 — "verifyAuth 가 inline 사용" | **false positive (조치 불요)** | `hooks.service` 는 commit `5f62d797` 에서 `verifyWebhookRequest` 위임으로 재작성됨. `grep -c "private verifyAuth\|config.authType"` = 0, `verifyWebhookRequest` = 1. hooks.service.spec 18/18 위임 검증 통과 | — |
| C5 — "reveal 미구현" | **false positive (조치 불요)** | reveal 은 commit `258daca5` 에서 구현됨. controller `reveal` 7건, service `async reveal` 1건, service.spec reveal 3케이스. e2e 가 create→reveal 평문 검증 | — |
| C2 — chatChannel + isActive 순서 | **본 PR 무관 → follow-up** | 기존 chat-channel 동작이며 본 PR(webhook 인증)이 순서를 변경하지 않음. chat-channel e2e 통과 중. `auth-config-webhook-followups.md §2` 이관 | — |
| C6 — CRUD audit 미기록 | **follow-up** | reveal audit 는 본 PR 구현 완료. create/update/delete/regenerate audit 는 service 시그니처에 userId 전파 필요 → `auth-config-webhook-followups.md §1` 이관 | — |
| INFO/WARNING (reveal §5 등재, IP 추출 정책, ENCRYPTION_KEY 분리, 공개 webhook 재발급, reveal rate limit 등) | **follow-up (project-planner 영역)** | developer 는 spec read-only — `auth-config-webhook-followups.md §3·§4` 이관 | — |

## TEST 결과

- **lint**: 통과 (`run-test.sh lint` PASS, 28s)
- **unit**: 통과 (`run-test.sh unit` PASS, 4966 tests — auth-configs 33 / hooks 18 / triggers 43 포함)
- **build**: 통과 (`run-test.sh build` PASS, 40s)
- **e2e**: 통과 (`run-test.sh e2e` PASS, 127 tests — webhook-trigger 4 type + isActive + lastUsedAt 포함)

## 보류·후속 항목

`plan/in-progress/auth-config-webhook-followups.md` 신설:
- §1 AuthConfig CRUD audit 기록 (userId 전파 선행)
- §2 chatChannel + isActive 순서 (chat-channel 도메인 재검토)
- §3 spec 보완 (reveal §5 등재 / IP 추출 정책 / ENCRYPTION_KEY 분리 / 공개 webhook 재발급) — project-planner 위임
- §4 reveal rate limiting
