# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 범위 및 전제

- target: `spec/5-system/1-auth.md`(status: partial), `spec/5-system/10-graph-rag.md`(status: implemented)
- 대조 대상: 두 target 문서 자체의 `## Rationale` 섹션 + 발췌 제공된 타 spec(`0-overview.md`, `1-data-model.md`, `2-navigation/*.md` 등)의 `## Rationale`
- **사전 확인**: `git status`/`git diff` 결과 두 target 파일은 워킹트리에서 **변경 사항이 없다** (커밋된 spec 그대로). 즉 이번 호출은 신규 변경분에 대한 continuity 검토가 아니라, 구현 착수 전(`pending_plans: plan/in-progress/spec-sync-auth-gaps.md` — LDAP/SAML 미구현 갭) 기존 스펙 번들의 자기정합성 standing 점검으로 판단된다.
- 실제 예정 구현 범위(`spec-sync-auth-gaps.md`)는 §1.3 LDAP/SAML 뿐이며, 두 항목 모두 spec 본문에 "미구현·Planned" 로 이미 명시돼 있어 과거 결정을 뒤집는 논쟁적 대안 도입이 아니다.

## 점검 방법

1. auth.md 내 각 Rationale 항목(1.1.B-1~6, 1.4.A~K, 2.3.A~C, 1.5.A~D, 4.1.A~B, Production fail-closed 가드)이 본문 규칙과 모순 없이 인용되는지 대조.
2. graph-rag.md 의 "본문 범위 밖(§2.2)" 기각 목록(community detection, Neo4j/AGE, 룰 기반 추출, 모드 사후 변경)이 본문 요구사항·API·데이터 모델과 재도입 없이 일치하는지 대조.
3. 코드 스팟체크로 "기각된 대안" 계열 주장이 실제로도 유지되고 있는지 확인 (auth.md 는 read-only 대상이라 코드가 spec 주장을 이미 따르는지가 곧 continuity 신호).

## 발견사항

### INFO — `rag_mode` 불변성 주장은 코드로 확인, 문서 내 명시적 대조는 없음
- target 위치: `spec/5-system/10-graph-rag.md` §2.2 "KB 모드 사후 변경 (vector ↔ graph)" 기각 행, §3.1 KB-GR-MD-02
- 과거 결정 출처: graph-rag.md 자체 §4 "KB 모드 선택 — 생성 시 결정, 불변" (근거: "사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬")
- 상세: 이 결정은 graph-rag.md 자체 "기술 결정 사항" 표에만 근거가 있고 별도 `## Rationale` 섹션 항목으로는 승격되어 있지 않다(본문에 인라인). `knowledge-base.service.ts` 를 스팟체크한 결과 `rag_mode` 갱신 경로가 없어 실제로 불변이 유지되고 있음을 확인했다 — 즉 continuity 위반은 아니다. 다만 향후 "그래프 모드 전환 UX 개선" 같은 요구가 들어올 경우, 이 인라인 근거가 정식 `## Rationale` 항목 형태가 아니라서 검토자가 놓치기 쉽다.
- 제안: 향후 KB 모드 사후 변경을 다시 논의하게 되면 §2.2 기각 사유를 `## Rationale` 섹션으로 승격해 명시적 대안 비교(마이그레이션 비용 vs 새 KB 생성 UX) 기록을 남길 것을 권장. 현재는 조치 불필요(INFO).

### INFO — LDAP/SAML 구현 착수 시 Rationale 신설 여지 확인 필요
- target 위치: `spec/5-system/1-auth.md` §1.3 "셀프 호스팅 추가 인증 (미구현 · Planned)"
- 과거 결정 출처: 해당 없음 — 신규 기능 최초 구현이라 기각/번복 이력 없음.
- 상세: `plan/in-progress/spec-sync-auth-gaps.md` 가 추적하는 실제 예정 작업(LDAP/SAML)은 §1.3 자체에 이미 "선택 기능·Planned" 로 정의돼 있어 과거 Rationale 과 충돌하지 않는다. 다만 구현 시 인증 방식이 늘어나면 §1.4.2 "WebAuthn 우선, TOTP fallback 자동 금지"(Rationale 1.4.D) 원칙과의 상호작용(LDAP/SAML 사용자에게도 2FA 우선순위 규칙이 동일 적용되는지)이 spec에 명시돼 있지 않다.
- 제안: LDAP/SAML 구현 착수 시, 해당 사용자의 2FA 흐름이 §1.4.2 표(WebAuthn ≥1 → TOTP 미노출)와 동일하게 적용되는지를 확인하고 필요하면 §1.3 또는 §1.4.2에 명시 문구를 추가. 현 시점 조치 불필요(INFO) — 신규 Rationale 항목이 필요한 시점은 실제 구현 착수 시.

## 정합성 확인된 항목 (참고용 — 문제 없음)

- **1.4.I (`requiresTotp` 필드 제거 종결)**: `codebase/frontend/src/lib/api/auth.ts` 의 `isTwoFactorChallenge()` 만 존재, `requiresTotp` 필드 재도입 없음 — Rationale 과 코드 일치.
- **2.3.B (`ip_whitelist`/rate-limit 헤더 기반 IP, `req.ip`/`socket` 폴백 명시적 배제)**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `hooks.service.ts` 가 `extractClientIpFromHeaders` 를 사용 — 세션/감사 경로(`extractClientIp`)와 분리되어 "기각된 대안"(req.ip 우선/대체)이 재도입되지 않음.
- **1.4.E (counter 역행 시 credential 삭제, suspend 미채택)**: 문서 서술과 §1.4.4 흐름 설명이 일관되게 "즉시 삭제" 로 기술.
- **graph-rag.md §2.2 (Neo4j/AGE, community detection, 룰 기반 추출, 모드 사후 변경 기각)**: 본문 §3~§7 요구사항·API·데이터 모델 어디에도 이 4개 대안이 재도입된 흔적 없음 (P0~P2 구현 완료 표와 §8 미결 항목이 일관되게 "P2 이후 검토" 로 유지).
- **1.1.B 계열 (이메일 변경 재인증·확인 인증 필수·raw 이메일 미저장)**: §4.1 감사 카탈로그와 §Rationale 1.1.B-6 이 동일한 "raw 이메일 미저장" 원칙을 공유하며 모순 없음.
- **Production fail-closed 가드 (JWT_SECRET·ENCRYPTION_KEY·MCP·OAUTH_STUB·LLM_STUB)**: §2.1 인용과 Rationale 항목 내용이 대상 집합·근거 모두 일치.

## 요약

두 target 문서(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)는 현재 워킹트리에서 변경 사항이 없는 기존 커밋 스펙이며, 예정된 구현 작업(`plan/in-progress/spec-sync-auth-gaps.md` 의 LDAP/SAML)도 spec 이 이미 "미구현·Planned" 로 선언한 항목이라 과거 Rationale 을 뒤집거나 기각된 대안을 재도입하는 정황이 없다. 문서 내부 Rationale 항목들(1.1.B, 1.4.A~K, 2.3.A~C, 1.5.A~D, 4.1.A~B 등)은 본문 서술·타 spec 교차 참조·실제 코드(스팟체크 3건: `isTwoFactorChallenge`, `extractClientIpFromHeaders`, `rag_mode` 불변)와 모두 일치하며, graph-rag.md 의 "범위 밖" 기각 목록도 본문에 재도입된 흔적이 없다. CRITICAL/WARNING 급 위반은 발견되지 않았고, INFO 2건은 향후 LDAP/SAML 구현·KB 모드 정책 재논의 시 참고할 사전 권고에 해당한다.

## 위험도

NONE
