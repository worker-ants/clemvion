---
worktree: resolve-token-expiry-jwt-exp-284f57
started: 2026-05-19
owner: resolution-applier
---
# Spec Fix Draft — Cafe24 token 만료 SoT Rationale 에 resolveTokenExpiry 추가

## 원본 발견사항

documentation 리뷰 [INFO] spec Rationale 에 resolveTokenExpiry 변경 기술 누락:

> 2026-05-18 Rationale 에는 `parseTokenExpiresAt` 와 `refreshAccessToken` 두 위치에 JWT exp 우선 정책이 기술되어 있다(라인 1471~1472). 이번 fix 가 추가한 `resolveTokenExpiry` 의 JWT exp 최우선 적용은 별도 worktree(`resolve-token-expiry-jwt-exp-284f57`) 변경임에도 spec Rationale 에 이 세 번째 위치가 언급되지 않았다.

## 제안 변경

`spec/2-navigation/4-integration.md` 의 "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" Rationale 항 내에서:

### 현재 (라인 1471~1472)

```markdown
- `parseTokenExpiresAt(provider='cafe24', data)` — JWT exp → `expires_in` → `expires_at` ISO (TZ-less 면 `+09:00` 부여) → 2h default
- `Cafe24ApiClient.refreshAccessToken` 의 expiresAt 계산 — 동일 precedence
```

### 제안 변경 (세 번째 위치 추가 + 테스트 목록 보강)

```markdown
- `parseTokenExpiresAt(provider='cafe24', data)` — JWT exp → `expires_in` → `expires_at` ISO (TZ-less 면 `+09:00` 부여) → 2h default
- `Cafe24ApiClient.refreshAccessToken` 의 expiresAt 계산 — 동일 precedence
- `resolveTokenExpiry` (proactive refresh 경로 / BullMQ worker short-circuit 판정) — JWT exp → `Integration.tokenExpiresAt` → `credentials.expires_at` **(2026-05-19 보강)**: TZ-bugged `tokenExpiresAt` 가 proactive refresh 경로에서도 무력화됨. 이로써 L3 reactive_401 이 아닌 L1/L2 proactive 경로에서도 JWT exp 가 ground truth 로 작동.
```

### 테스트 목록 (라인 1498) 도 다음 항목 추가

```markdown
- `cafe24-token-refresh.processor.spec.ts` 추가 (2026-05-19) — TZ-bugged `tokenExpiresAt` + `credentials.expires_at` 이 양쪽 미래 값이어도 JWT exp 과거면 proactive/background source 에서 refresh 발동 (resolveTokenExpiry 의 JWT exp 최우선)
```

## 적용 절차

1. `project-planner` 역할로 spec 변경 전 `consistency-check --spec` 실행
2. BLOCK: NO 확인 후 위 변경 내용을 `spec/2-navigation/4-integration.md` 에 Edit
3. spec 변경 commit 후 이 draft 파일을 `plan/complete/` 로 이동
