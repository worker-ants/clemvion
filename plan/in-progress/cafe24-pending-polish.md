---
worktree: cafe24-pending-polish-7fdb7e
started: 2026-05-14
owner: developer
---

# Cafe24 Private "Pending install" 멈춤 — 관측성 보강 + 후속 정비

## Context

Cafe24 private 모드 통합 연동에서 사용자가 Cafe24 Developers 의 "테스트 실행" 으로 OAuth 흐름을 진행했는데, 팝업이 닫힌 뒤에도 통합 상태가 `pending_install` 에 머무는 문제가 보고됐다. 새로고침으로도 회복되지 않으며, 백엔드 로그/DB 접근이 즉시 어려운 환경에서 원인을 좁히기 어렵다.

자세한 분석은 `/Users/gehrig/.claude/plans/cafe24-private-piped-pudding.md` 에 정리되어 있다. 진단 결과 다음이 확인됐다:

- 팝업의 자동 닫힘은 `handleCallback` 진입만 보장하며, 내부 예외 (`OAUTH_TOKEN_EXCHANGE_FAILED` · `OAUTH_STATE_MISMATCH` · `OAUTH_STATE_EXPIRED` · `RESOURCE_NOT_FOUND` · 복호화 결함) 시에도 동일하게 닫힘 스크립트가 실행되어 시각적으로 구분이 안 됨.
- `handleCallback` 은 실패 시 어떤 row 도 갱신하지 않아 UI 만으로는 원인 진단 불가.
- Cafe24 가 띄운 팝업의 `window.opener` 는 Cafe24 탭이라 우리 FE 의 `postMessage` 리스너가 절대 발동하지 않음 → FE 폴링 부재가 별도 결함으로 존재.
- `install_token` 컬럼이 식별 키로 활용되지 않고(`W1`), 중복 `pending_install` 방지 및 TTL 정리도 없음(`W3`/`W6`, AI review `review/2026-05-14_13-57-48/` 기록).

본 plan 은 이 다섯 결함을 **한 PR** 로 해소한다. Private + Public 모드 공통 사항도 포함.

---

## 변경 0 — BE: callback 실패 관측성 (최우선)

**왜 우선?** 현 사례의 정확한 분기 식별이 이 변경 없이는 영구히 추측에 머문다.

- [ ] `handleCallback` 의 실패 경로에 컨텍스트 첨부:
  - state 소비 이후의 모든 throw 에 `(err as any).context = { integrationId: record.integrationId, mode: record.mode }` 부착, 또는 신규 `CallbackFailure` 클래스로 캡슐화.
  - state 소비 *전* 의 throw 는 컨텍스트 없음 (의도적; 컨트롤러가 식별 못 함).
- [ ] `markIntegrationCallbackError(integrationId, code, message)` 보조 메서드 추가:
  - `pending_install` 또는 `connected` 상태 row 만 갱신 (other states 무시).
  - `last_error = { code, message, at: ISO }`, `status_reason = code`.
  - `status` 는 **유지** (`pending_install` → 그대로 / `connected` → 그대로).
- [ ] `integrations.controller.ts` 의 `oauthCallback` try/catch 에서 컨텍스트 추출 → 위 메서드 호출.
- [ ] **팝업 auto-close 지연**: `oauth-callback.template.ts:91` 변경 — 실패 시 3~5초 표시 후 close 또는 "Close" 버튼만. 성공은 즉시 close 유지.
- [ ] Frontend `status-badge` / detail 페이지에 `pending_install` + `statusReason` 또는 `lastError` 가 있을 때 진단 메시지 노출.
- [ ] spec 갱신 (`spec/2-navigation/4-integration.md` §6 / §10): callback 실패 처리 정책 명시 — **project-planner 위임 후 consistency-check 통과**.

## 변경 1 — FE: pending step 폴링 + 목록 갱신 정책

- [ ] `Cafe24PrivatePendingStep` 에 `useQuery({ queryKey: ["integrations", "get", integrationId], queryFn: integrationsApi.get, refetchInterval: 3000 if pending, refetchOnWindowFocus: true })` 추가.
- [ ] `status === 'connected'` 관측 시: toast → `invalidateQueries(["integrations"])` → `router.replace(/integrations/${id})`.
- [ ] `statusReason`/`lastError` 채워졌으면 UI 에 노출, 폴링 계속.
- [ ] 10분 타임아웃 후 폴링 정지 + 안내 토스트.
- [ ] Public 흐름의 `oauth_callback` 메시지 미수신 timeout 보완 (`new/page.tsx:194-219` 부근): popup `.closed` 폴링 + 5초 cutoff 토스트.
- [ ] 통합 목록 `useQuery` 에 `refetchOnWindowFocus: true, staleTime: 0` 명시.

## 변경 2 — BE W1: install_token 식별 키 승격 (Private 전용)

- [ ] `createPrivatePendingIntegration` 의 `appUrl` 을 `${appUrl}/api/integrations/oauth/install/cafe24/${installToken}` 로 변경.
- [ ] 컨트롤러 신규 라우트 `@Get('oauth/install/cafe24/:installToken')`.
- [ ] `handleInstall(installToken, query)`: 단일 row 조회 → `client_secret` 으로 HMAC 1회 검증 → 통과 시 OAuthState 생성 + 302.
- [ ] 기존 토큰 없는 `/oauth/install/cafe24` 라우트 410 Gone 또는 제거 (외부 등록 URL 영향 사전 확인).
- [ ] spec 갱신 (`spec/2-navigation/4-integration.md` §9.2 / §9.4 / §9.8).

## 변경 3 — BE W3: 중복 `pending_install` 방지 (Private 전용)

- [ ] `createPrivatePendingIntegration` 진입 시 동일 `(workspaceId, serviceType, mall_id, app_type='private', status='pending_install')` row 검색.
- [ ] 찾으면 기존 row 의 `installToken` / credentials 새 값으로 교체 후 save (status·name 유지).
- [ ] 동일 `(workspaceId, mall_id)` 에 `connected` 가 이미 있으면 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (400) 반환.

## 변경 4 — BE W6: pending_install TTL 정리 (Private 전용)

- [ ] TTL 정책 결정: **24시간** (spec 에 명시).
- [ ] 구현: `purgeExpired()` 확장 또는 1시간 주기 `@Cron`. `pending_install` + `createdAt < now - 24h` → `status='expired', statusReason='install_timeout', installToken=null`.
- [ ] spec §6 상태 머신에 `pending_install → expired` 자동 전이 추가.

## 변경 5 — 테스트 보강 (C3 follow-up)

- [ ] `handleInstall` 단일 토큰 lookup happy/invalid/expired/HMAC fail/replay.
- [ ] `handleCallback` happy path `pending_install → connected` (현재 전무).
- [ ] `handleCallback` 실패 경로 (TOKEN_EXCHANGE_FAILED · STATE_MISMATCH · STATE_EXPIRED · RESOURCE_NOT_FOUND) 가 `markIntegrationCallbackError` 호출하는지.
- [ ] `createPrivatePendingIntegration` 중복 reuse 경로.
- [ ] E2E private: begin → install (HMAC fixture) → callback → connected.
- [ ] E2E public: 성공 + 실패 (잘못된 code) 시 callback HTML 의 error 노출.
- [ ] FE: pending polling 훅 status 전이 동작. Public popup closed-without-message 타임아웃.

## Consistency-check 결과 (2026-05-14_16-48-25)

`review/consistency/2026-05-14_16-48-25/SUMMARY.md` — **BLOCK: YES**.

- **Critical**: C1 (status enum 에 pending_install 부재), C2 (install_token 컬럼 미등재), C3 (변경 4 의 expired 전이가 spec 의 삭제 정의와 반대), C4 (변경 2 의 새 라우트가 §9.2 와 충돌).
- **Warning**: W1 (callback 실패 시 pending_install 유지 정책 미기술 — 변경 0 의 코드와 직결), W6 (DTO enum 누락), 외 5건.

조치: `plan/in-progress/spec-update-cafe24-pending-polish.md` 에 모든 spec 갱신 요구를 정리. **project-planner 에 위임 → spec 본문 반영 → consistency-check 재실행** 까지 마친 뒤 본 plan 의 구현 단계로 복귀.

## 실행 순서

0. **(BLOCK 해소)** project-planner 가 spec/1-data-model.md §2.10, spec/2-navigation/4-integration.md §2.2/§2.4/§3.2/§6/§9.2/§9.4/§10/§14.2, spec/data-flow/integration.md §3.2 를 갱신. 결과적으로 spec 의 OAuth callback 실패 정책·install_token 식별·pending_install→expired TTL 전이가 명문화된다. → 재 consistency-check.
1. **변경 0** 부터: 가장 큰 진단 가치. 다음 재현 시 H1/H2/H4/H5 자동 식별 가능.
2. **변경 1**: FE 폴링 — 변경 0 의 `last_error` 노출과 결합되어 UX 회복.
3. **변경 2/3/4**: spec 개정 동반 (project-planner 위임 → consistency-check) → 구현.
4. **변경 5**: 각 변경 단위로 테스트 작성 → 마지막에 보강.
5. `/ai-review` 자체 수행, `review/<ts>/RESOLUTION.md` 작성.
6. PR 머지 후 worktree 제거, 본 plan `complete/` 로 `git mv`.

## 비포함

- 백엔드 → FE 실시간 채널(SSE/WebSocket) 재설계.
- AI review I1/I2 또는 이미 적용된 C1/C2/W4/W5/W7/W11/W13 재검토.
- cafe24 외 provider 의 OAuth 흐름 자체.
