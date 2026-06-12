# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-refactor-04-security-drift.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-12

---

## 발견사항

### [INFO] CF-Connecting-IP opt-in 전환 — 번복 Rationale 적절히 작성됨

- **target 위치**: `spec-draft` §1 auth, `spec/5-system/1-auth.md §2.3` 표 및 `## Rationale 2.3.B`
- **과거 결정 출처**: `spec/5-system/1-auth.md` (commit 79f1d849 이전) §2.3 표 — "CF-Connecting-IP 헤더를 1순위, X-Forwarded-For 첫 IP, req.ip 순으로 추출" (별도 Rationale 항목 부재, 표 본문 기술만 있었음)
- **상세**: 기존 스펙에서 CF-Connecting-IP 는 Rationale 에 기각 사유 없이 단순 표 기술로만 등장했다. target 은 이를 opt-in 으로 전환하면서 `Rationale 2.3.B "클라이언트 IP 신뢰 (m-3)"` 항목을 신설해 변경 근거(위변조 가능 헤더, rate-limit 우회 위험, Cloudflare 뒤 배포의 fail-safe 폴백 안전성)를 명문화했다. 기존에 기각된 대안이 없었으므로 Rationale 연속성 위반은 없다. target 의 `spec-draft §Rationale "CF-Connecting-IP 번복"` 섹션이 "합의 원칙 번복이 아니라 보안 강화"라고 스스로 정당화하고 있어 내용상 충분하다.
- **제안**: 변경 없이 현행 유지.

---

### [INFO] SameSite=none 기본값 — 과거 기록 공백 대비 신규 Rationale 적절히 신설

- **target 위치**: `spec-draft` §1 auth, `spec/5-system/1-auth.md §2.3` 표 및 `## Rationale 2.3.B`
- **과거 결정 출처**: `spec/5-system/1-auth.md` (commit 79f1d849 이전) §2.3 표 — SameSite 항목 자체가 존재하지 않았다 (완전 공백)
- **상세**: 기존 스펙에 SameSite 관련 항목이 없었으므로 기각된 대안 없음. target 이 `SameSite=none` 을 기본값으로 도입하면서 `Rationale 2.3.B "SameSite (M-5)"` 신설로 cross-site 배포 필요성, web-chat 임베드 비의존성, CSRF 보완 메커니즘(CSRF 토큰 대신 Origin allowlist)을 명문화했다. Rationale 연속성 기준 문제 없음.
- **제안**: 변경 없이 현행 유지.

---

### [INFO] CSRF 방어: CSRF 토큰 대신 Origin allowlist 채택 — 기각된 대안 Rationale 에 명시됨

- **target 위치**: `spec/5-system/1-auth.md §2.3` 표 `/auth/refresh CSRF` 행 및 `## Rationale 2.3.B "none 모드의 CSRF 보완"`
- **과거 결정 출처**: 기존 auth spec 에 CSRF 방어 정책 항목 없음 (신규 도입)
- **상세**: CSRF 토큰 인프라(double-submit 등)를 채택하지 않고 Origin allowlist 로 대체하는 결정이 `Rationale 2.3.B` 에서 "(a) refresh 쿠키는 /auth/refresh 한 곳에서만 쓰이고 ... (b) credentials CORS allowlist 가 응답 읽기를 이미 차단한다" 근거와 함께 명시됐다. 신규 결정이며 기각된 Rationale 의 재도입이 아니다.
- **제안**: 변경 없이 현행 유지.

---

### [INFO] websocket 소유검증 채널 추가 — 기존 Rationale 와 정합

- **target 위치**: `spec-draft` §2 websocket, `spec/5-system/6-websocket-protocol.md §3.3`
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md ## Rationale` — 채널별 `channelAuthorizers` OCP 구조, ownership/JWT sub 일치 검증이 기존 Rationale 에 이미 확립됨 (refactor 04 M-6 표기)
- **상세**: target 은 `workflow:{workflowId}`(workspace 소유 검증)와 `notifications:{userId}`(JWT sub 일치, fail-closed) 두 채널을 표에 추가한다. 이는 기존 `channelAuthorizers` OCP 구조 원칙의 자연스러운 확장이며, 기각된 대안의 재도입이나 합의 invariant 위반이 아니다. `notifications:{userId}` 의 "emit 미구현이나 fail-closed 선제" 설계는 Rationale §3.3 행 비고에 명시됐다.
- **제안**: 변경 없이 현행 유지.

---

### [INFO] regex ReDoS 정책: 길이 200 단독 → safe-regex 1차 + 길이 2차 — 기각 대안 기록 필요성 낮음

- **target 위치**: `spec-draft` §3, `spec/4-nodes/1-logic/8-filter.md §5`, `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/1-logic/1-if-else.md`
- **과거 결정 출처**: 해당 노드 spec 들에 `## Rationale` 섹션 없음. 변경 전 본문에 "길이 200자" 단독 기술만 존재
- **상세**: 기존 노드 spec 들에 regex 정책에 대한 Rationale 섹션이 없었으므로, 기각된 대안이 Rationale 에 등장하지 않는다. target 은 `compileUserRegex` 헬퍼 신설과 `safe-regex` 1차 방어 도입을 spec 본문 괄호 주석(`길이 200 단독은 ReDoS 방지 불충분이라 safe-regex 가 1차 방어`)으로 인라인 설명한다. 별도 `## Rationale` 섹션이 없는 spec 문서들에서 이 수준의 인라인 근거는 허용 범위다.
- **제안**: 향후 해당 노드 spec 에 `## Rationale` 섹션 추가 시 `safe-regex` 도입 근거를 이관 권장(선택적 개선). 현재 spec-draft 범위에서는 문제 없음.

---

### [INFO] swagger 노출 정책 신설 — Rationale 없음 (낮은 위험)

- **target 위치**: `spec-draft` §4, `spec/conventions/swagger.md §0`
- **과거 결정 출처**: `spec/conventions/swagger.md` 기존 본문에 `## Rationale` 섹션 자체가 없음
- **상세**: swagger.md 는 convention 가이드 문서로 `## Rationale` 섹션이 없다. §0 신설로 Swagger UI non-production 전용 정책과 `ENABLE_SWAGGER_IN_PROD` opt-in 를 도입하면서 "OWASP 정보 노출" 근거를 본문 §0 에 짧게 인라인 설명한다. spec 3섹션 구성(Overview/본문/Rationale) 원칙 기준 Rationale 섹션 부재가 있으나, `swagger.md` 는 기존부터 Rationale 없이 운영된 convention 가이드이며 이번 변경의 보안 근거는 §0 본문 내 인라인으로 존재한다. 기각된 대안의 재도입 문제는 없다.
- **제안**: `swagger.md` 에 `## Rationale` 섹션 추가 후 "IP 제한/Basic Auth 등을 escape hatch 에 포함하지 않은 이유", "opt-in 선택이 opt-out 보다 나은 이유"를 간략히 기록하면 연속성 문서화가 완성됨 (선택적 개선).

---

### [INFO] code 노드 staging 운영 가이드 — spec 정합 확인, Rationale 불필요

- **target 위치**: `spec-draft` §5, `spec/4-nodes/5-data/2-code.md §5.3`
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md ## Rationale` — 격리 방식, echo 정책, output root 배치 등 기존 결정 다수 존재
- **상세**: target 은 `NODE_ENV=production` 으로 staging 운영을 권고하는 1단락을 추가한다. 이는 기존 `spec/4-nodes/5-data/2-code.md §5.3` 본문(`details.stack` 은 `NODE_ENV !== 'production'` 일 때만 포함)의 자연스러운 운영 지침이며, 기존 Rationale 내 기각 대안을 재도입하는 내용이 없다. 새로운 제품 결정이 아닌 운영 가이드라 별도 Rationale 항목 불필요.
- **제안**: 변경 없이 현행 유지.

---

## 요약

target `spec-draft-refactor-04-security-drift.md` 의 6건 변경 모두 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사례가 없다. CF-Connecting-IP opt-in 화는 기존 Rationale 공백 항목을 보안 강화 근거로 새로 기록했고, SameSite=none 과 CSRF Origin 검증도 신규 Rationale 신설로 결정 근거를 명문화했다. websocket 채널 추가는 기존 OCP 구조 원칙의 자연스러운 확장이며, regex ReDoS 정책, swagger 정책, code 노드 운영 가이드는 Rationale 공백 항목에 인라인 근거를 두거나 운영 지침 수준의 추가에 해당한다. spec-draft 가 스스로 "Rationale 연속성 주의점" 섹션을 두어 번복처럼 보일 수 있는 항목에 선제 설명을 제공한 것이 연속성 리스크를 낮추고 있다. 잠재적 개선 사항은 `swagger.md` 에 `## Rationale` 섹션 추가 정도이며, 이는 필수가 아닌 권고 수준이다.

---

## 위험도

NONE
