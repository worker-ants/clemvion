# 보안(Security) 코드 리뷰

## 발견사항

### [INFO] `$thread` 자동완성 노출 — 런타임 주입 완료 여부 교차 확인 권장
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts` (파일 1), `plan/in-progress/spec-sync-expression-language-gaps.md` (파일 19)
- 상세: `$thread` 를 ROOT_VARIABLES 에 추가한 변경 자체는 무해하다. 단, `plan/in-progress/spec-sync-expression-language-gaps.md` 에 `$trigger`/`$env` 는 **여전히 런타임 미주입** 임이 명시되어 있다. 두 변수도 ROOT_VARIABLES 에는 등재되어 있으므로, 에디터에서 사용자가 `$trigger` / `$env` 를 입력하면 실행 시 `undefined` 로 평가된다. `$env` 는 "allowlist 기반 노출, self-hosting only" 설계 의도가 있는데, 현재 에디터가 이를 조건 없이 제안하므로 사용자가 환경변수 접근 가능 여부를 오인할 수 있다.
- 제안: `$trigger`/`$env` 의 런타임 주입 설계가 확정되기 전까지, ROOT_VARIABLES 에서 이 두 항목에 `scopeKey` 유사 메커니즘으로 "미주입" 표시를 추가하거나, 자동완성에서 일시적으로 제외하는 것을 검토할 것. 특히 `$env` 는 보안 allowlist 설계가 선행돼야 하므로 조기 노출에 주의가 필요하다.

---

### [WARNING] `llmCalls` 외부 수신자 strip — 구현 게이트 미확인
- 위치: `plan/complete/spec-draft-eia-strip-llmcalls.md` (파일 2)
- 상세: spec 은 `llmCalls` (시스템 프롬프트·대화 이력·tool 정의 등 민감 데이터 포함 가능한 raw debug payload) 를 external-interaction SSE, notification webhook fanout, chat-channel 아웃바운드에서 strip 하는 L1 결정을 확정했다. 그러나 이 파일은 **spec 문서만 갱신한 plan draft** 이며, 실제 backend fanout seam 의 strip 구현 커밋이 이번 diff 에 포함되지 않는다. spec 정책이 앞서가고 구현이 뒤따르는 패턴인데, 구현 전 병합이 되면 "spec 에는 strip 한다고 명시됐으나 실제로는 노출" 상태가 일시적으로 존재할 수 있다.
- 제안: (a) fanout strip 구현 커밋이 이 spec 변경과 동일 PR 에 포함되는지, 또는 선행 PR 로 완료됐는지 확인할 것. (b) 구현이 미완인 경우, `llmCalls` strip 을 보장하는 통합 테스트(fanout 경로에서 `llmCalls` 키 부재 assertion)가 배포 전 추가되어야 한다.

---

### [INFO] `interactionAllowedOrigins` CORS 빈 배열 의미 — secure-by-default 유지 확인
- 위치: `plan/complete/spec-draft-workspace-settings-api.md` (파일 4)
- 상세: spec draft 에서 빈 배열(`[]`) = "추가 origin 없음 (모든 외부 origin 차단 유지)" 으로 명시하고 있으며, built-in 위젯 CDN origin 은 항상 허용이라고 기술하고 있다. 이 invariant 가 backend `PATCH /api/workspaces/:id/settings` 구현(서비스 레이어의 부분 머지 로직)에서도 동일하게 보장되는지 확인이 필요하다.
- 제안: `updateWorkspaceSettings` 서비스에서 `interactionAllowedOrigins` 를 빈 배열로 업데이트하더라도 CORS resolver 가 여전히 built-in CDN origin 만 허용하는지 단위 테스트로 검증할 것. 또한 임베드 soft 검증의 `enforce=false` (allow-all) 경로가 CORS 하드 게이트를 우회하지 않음을 명확히 문서화할 것.

---

### [INFO] `emailVerifyToken` SHA-256 해시 저장 — 이미 구현 완료, spec 명문화
- 위치: `plan/complete/spec-fix-impl-marker-flips.md` §D (파일 5), `spec/5-system/1-auth.md` (파일 33)
- 상세: `emailVerifyToken` 을 SHA-256 해시로만 저장(raw 토큰 DB 미저장)하는 보안 개선이 커밋 7fc682c3 으로 이미 구현됐으며, 본 diff 에서 `spec/5-system/1-auth.md §1.1` 에 명문화됐다. 토큰 at-rest 보호 관점에서 올바른 방향이다.
- 제안: `passwordResetToken` 도 동일 패턴을 이미 따르고 있는지(spec 에서 "passwordResetToken 과 동일" 로 기술) 코드 레벨에서 교차 확인할 것. 두 토큰의 검증 경로가 timing-safe comparison(`crypto.timingSafeEqual` 등)을 사용하는지도 확인 권장.

---

### [INFO] `POST /auth/resend-verification` email-enumeration-safe 응답 — 구현 확인 권장
- 위치: `spec/2-navigation/10-auth-flow.md` (파일 24), `spec/5-system/1-auth.md` (파일 33)
- 상세: spec 이 "이메일 enumeration-safe 응답(존재 여부 무관 동일 응답)"을 명시하고 있으며, 커밋 27b6c362 로 구현됐다고 기록되어 있다. 이는 올바른 보안 설계다.
- 제안: 구현 코드에서 실제로 (a) 존재하지 않는 이메일에 대해서도 성공 응답과 동일한 HTTP status/body 를 반환하는지, (b) 처리 시간 차이로 사이드채널이 발생하지 않는지 단위 테스트로 검증 여부를 확인할 것.

---

### [INFO] `PATCH /api/workspaces/:id/settings` — `@Get(':id/settings')` 접근 제어 범위
- 위치: `plan/complete/spec-draft-workspace-settings-api.md` §Phase: 구현 (파일 4)
- 상세: `@Get(':id/settings')` 는 "멤버 read — viewer 포함" 으로 명세되어 있다. `interactionAllowedOrigins` 가 CORS allowlist(외부 접근 가능 origin 목록)이므로 이를 viewer 까지 읽을 수 있는 것이 의도된 범위인지 확인이 필요하다. 워크스페이스 멤버라면 어차피 에디터 URL 에서 embed 설정을 볼 수 있으므로 큰 위험은 없으나, 정보 노출 범위를 명시적으로 결정해야 한다.
- 제안: viewer 에게도 origins 목록을 노출하는 것이 제품 의도인지 재확인하고, spec 에 명시할 것.

---

### [INFO] `$env` 자동완성 노출 — 보안 allowlist 설계 전 사전 노출 위험
- 위치: `plan/in-progress/spec-sync-expression-language-gaps.md` (파일 19)
- 상세: `$env` 는 spec 에 "allowlist 기반 노출, self-hosting only" 설계 의도가 있으나 현재 런타임 미주입 상태다. ROOT_VARIABLES 에 이미 등재되어 있어 에디터 자동완성에서 제안된다. self-hosting 이 아닌 환경에서 사용자가 `$env` 를 사용하면 실행 시 undefined 로 평가되는데, 향후 allowlist 없이 성급하게 주입 구현이 추가될 경우 환경변수 전체가 노출될 위험이 있다.
- 제안: `$env` 런타임 주입 구현 시 반드시 (a) allowlist 검증 로직 동반, (b) 주입 가능한 환경변수 키 범위를 명시적으로 제한하는 구현이 선행되도록 plan 에 명시할 것.

---

### [INFO] webhook 비활성 트리거 chatChannel 분기 — 인증 우선 실행 보안 정합성 확인
- 위치: `spec/5-system/12-webhook.md` (파일 34), `spec/5-system/15-chat-channel.md` (파일 35)
- 상세: "비활성 chatChannel 트리거에서 inbound 서명 검증을 `!trigger.isActive` 검사보다 먼저 수행한다"는 정책이 spec 에 명문화됐다(WH-EP-07 + R-CC-12(d)). 이는 (a) auth 실패한 요청에 202 를 주면 공격자가 trigger 활성 여부를 inference 불가하게 하는 보안 이점, (b) 운영자 디버깅 가시성 확보 두 가지 근거로 올바른 설계다.
- 제안: 현재 구현(커밋 d12932ab)이 실제로 이 순서(chatChannel 분기 → 서명 검증 → isActive 검사)를 따르는지 코드 경로를 재확인할 것. 순서가 뒤바뀌면 비활성 트리거의 서명 검증 우회가 가능하다.

---

## 요약

이번 diff 는 주로 spec 문서 갱신(미구현 marker flip, 구현 완료 명문화)과 plan 문서 정리로 구성되어 있으며, 실제 코드 변경은 `expression-constants.ts` 에 `$thread` 자동완성 항목 추가 1건뿐이다. 직접적인 코드 레벨 보안 취약점(인젝션, 하드코딩된 시크릿, 평문 전송 등)은 발견되지 않았다. 주요 보안 관련 발견사항은 두 가지 아키텍처 수준의 관찰이다: (1) `llmCalls` raw debug payload 외부 수신자 strip 이 spec 에만 확정됐고 backend 구현 완료 여부를 이 diff 에서 확인할 수 없다는 점, (2) `$env` 변수가 보안 allowlist 설계 없이 에디터 자동완성에 노출되어 있어 향후 성급한 런타임 주입 시 환경변수 전체 노출 위험이 잠재한다는 점. `emailVerifyToken` SHA-256 저장, resend-verification email-enumeration-safe 응답, 비활성 chatChannel 트리거의 서명 검증 선행 실행 등은 모두 적절한 보안 결정으로 평가된다.

## 위험도

LOW
