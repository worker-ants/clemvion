# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target**: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
**비교 기준**: `origin/main` 의 나머지 spec 영역

---

## 발견사항

### [WARNING] `spec/1-data-model.md` §2.18.1 RefreshToken.ip_address 설명과 target auth spec §2.3 사이의 불일치

- **target 위치**: `spec/5-system/1-auth.md` §2.3 세션 정책 표 — 클라이언트 IP 행: "`CF-Connecting-IP` 는 `TRUST_CF_CONNECTING_IP=true` 일 때만 1순위 (기본 off)"
- **충돌 대상**: `spec/1-data-model.md` §2.18.1 RefreshToken — main 640행: `| ip_address | String? | 발급 시점 클라이언트 IP (CF-Connecting-IP 우선) |`
- **상세**: target(worktree)의 `1-auth.md` §2.3 는 `CF-Connecting-IP` 를 기본 off, `TRUST_CF_CONNECTING_IP=true` 일 때만 1순위로 명시한다. 반면 main 브랜치의 `spec/1-data-model.md` §2.18.1 RefreshToken.ip_address 필드 설명은 "CF-Connecting-IP 우선" 이라고 단순 기술해 조건부 신뢰 정책(`TRUST_CF_CONNECTING_IP`) 자체가 누락된 구 정의를 가지고 있다. 두 문서가 같은 런타임 동작을 설명하는데 정책이 충돌한다.
- **제안**: worktree의 `spec/1-data-model.md` §2.18.1는 이미 올바른 설명(`TRUST_CF_CONNECTING_IP=true 일 때만 1순위, 기본 off`)을 포함하고 있어 머지 시 자동 해소된다.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md` 채널별 인가 전략 기술 — target(worktree) vs main 불일치

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §3.3 권한 검증 — worktree 버전은 `channelAuthorizers` OCP 구조 + `workflow:{workflowId}` 및 `notifications:{userId}` 채널의 개별 인가 전략을 명시하는 표로 확장
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` main 143행 — `workflow:{workflowId}` 채널 인가 언급 없음; `notifications:{userId}` 채널 인가 언급 없음 (권한 검증 문장이 `execution:` / `kb:` / `background:run:` 만 나열)
- **상세**: main의 websocket-protocol §3.3은 `workflow:{workflowId}` 채널에 대한 workspace 소유 검증을 기술하지 않는다. 또한 `notifications:{userId}` 채널에 대한 user 단위 JWT `sub` 검증도 명시되지 않아, 임의 userId 구독이 허용될 것처럼 읽힌다. target(worktree)은 두 채널 모두에 인가 전략을 명문화했다. `notifications:{userId}` 채널의 인가 부재는 main spec 기준으로 security 정책 공백이다.
- **제안**: worktree 버전이 이미 올바른 정의를 포함하고 있어 머지 시 자동 해소된다. main 단독 참조 시 위험이 있음을 인지한다.

---

### [WARNING] `spec/conventions/swagger.md` — `§0 Swagger UI production 비노출` 섹션 + frontmatter code 항목이 main에 부재

- **target 위치**: `spec/conventions/swagger.md` §0 (worktree 버전) — Swagger UI production 비노출 정책 + `ENABLE_SWAGGER_IN_PROD` opt-in + `isSwaggerEnabled` 단일 함수 + Rationale 섹션 + frontmatter code에 `production-guards.ts`·`main.ts` 포함
- **충돌 대상**: `spec/conventions/swagger.md` main 버전 — §0 전체 부재, frontmatter code에 `production-guards.ts`·`main.ts` 미포함
- **상세**: worktree의 swagger.md는 production Swagger UI 비노출 정책(§0)과 `isSwaggerEnabled` 함수 참조를 추가했다. main 브랜치의 swagger.md는 이 섹션이 없어 production에서 Swagger 노출 통제 정책의 spec 근거가 없는 상태다. `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드" 에서 동형 패턴을 언급하나, swagger.md 자체에 섹션이 없으면 운영자가 swagger 정책만 단독으로 참조할 때 정보를 찾지 못한다.
- **제안**: worktree 버전이 이미 올바른 정의를 포함하고 있어 머지 시 자동 해소된다.

---

### [INFO] `spec/5-system/1-auth.md` §2.1 Refresh 쿠키 기술 — main 버전의 구 정의 잔존

- **target 위치**: `spec/5-system/1-auth.md` §2.1 JWT 토큰 구조 표 — Refresh Token 행: `HttpOnly · Secure Cookie (SameSite 는 §2.3, Path /api/auth)` + §2.3 표에 `Refresh 쿠키 SameSite`, `Refresh 쿠키 Path`, `/auth/refresh CSRF` 행 추가 + Rationale 2.3.B 섹션 신설
- **충돌 대상**: `spec/5-system/1-auth.md` main 245행: `HttpOnly Cookie` (SameSite/Path/CSRF 언급 없음); §2.3 표에 해당 행 없음; Rationale 2.3.B 없음
- **상세**: main의 auth spec은 Refresh 쿠키를 단순히 `HttpOnly Cookie`로 기술하며 `SameSite=none` 기본값, `Path=/api/auth` 제한, CSRF 보완 정책(`/auth/refresh` Origin 대조)을 명세하지 않는다. target(worktree)은 이 세 가지를 §2.3 표에 추가하고 Rationale 2.3.B를 신설했다. 구현은 이미 `COOKIE_SAMESITE`, `Path=/api/auth` 를 따르고 있으므로 main spec이 구현보다 뒤처진 상태다.
- **제안**: worktree 버전이 이미 올바른 정의를 포함하고 있어 머지 시 자동 해소된다.

---

### [INFO] `spec/5-system/1-auth.md` §Rationale Production fail-closed 가드 — OAUTH_STUB_MODE·LLM_STUB_MODE 항목의 크로스-spec 일관성 확인

- **target 위치**: `spec/5-system/1-auth.md` Rationale "Production fail-closed 가드" — OAUTH_STUB_MODE, LLM_STUB_MODE를 assertProductionConfig 응집 목록에 포함
- **충돌 대상**: `spec/5-system/7-llm-client.md` §7.1 (main·worktree 동일) — `assertProductionConfig` 가 `OAUTH_STUB·LLM_STUB` 를 응집한다고 참조
- **상세**: worktree auth spec Rationale은 `OAUTH_STUB_MODE`·`LLM_STUB_MODE`를 production fail-closed 가드 목록에 포함시켰다. 이는 `spec/5-system/7-llm-client.md` §7.1의 기술과 일치한다. 별도 모순 없음.
- **제안**: 변경 불필요. auth spec Rationale이 SoT, llm-client는 참조만 하는 구조가 의도적이다.

---

## 요약

Cross-Spec 일관성 관점에서 target(`spec/5-system` worktree 버전)과 main 브랜치의 나머지 spec 영역 사이에 3건의 WARNING이 확인된다. (1) `spec/1-data-model.md` §2.18.1의 RefreshToken.ip_address 필드 설명이 target auth spec §2.3의 `TRUST_CF_CONNECTING_IP` 조건부 신뢰 정책을 반영하지 않아 IP 신뢰 정책이 문서마다 다르게 읽힌다. (2) `spec/5-system/6-websocket-protocol.md`의 main 버전이 `workflow:{workflowId}` 및 `notifications:{userId}` 채널의 인가 전략을 누락하여 특히 `notifications` 채널에 대해 임의 userId 구독이 허용될 것처럼 보이는 security 정책 공백이 있다. (3) `spec/conventions/swagger.md`의 main 버전에 Swagger UI production 비노출 정책 §0이 없어 운영자 참조 시 공백이 발생한다. 세 WARNING 모두 worktree에서는 이미 올바르게 기술돼 있으므로 worktree를 main에 머지하면 자동 해소된다. Graph RAG(10-graph-rag.md)와 MCP Client(11-mcp-client.md)는 cross-spec 충돌이 발견되지 않았다.

---

## 위험도

MEDIUM
