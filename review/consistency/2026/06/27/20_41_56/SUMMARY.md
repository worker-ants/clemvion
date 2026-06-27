# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 사유 없음

검토 대상: `spec/7-channel-web-chat/4-security.md`
검토 시각: 2026-06-27 20:41:56

---

## 전체 위험도

**LOW** — Critical 0건, WARNING 2건(서로 다른 checker), INFO 10건. spec 값 충돌·엔티티 의미 충돌 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | rationale_continuity | `allow-same-origin` sandbox 속성이 아키텍처 §R1 "완전 분리" 원칙과 명시적 긴장 관계에 있음에도 공식 Rationale 항 없이 표 셀 주석으로만 처리됨 | `4-security.md` §1 보안 정책 요약 표의 `iframe sandbox` 행 | `spec/7-channel-web-chat/0-architecture.md` §R1 — "쿠키·스토리지 완전 분리" | `## Rationale` 에 `R5. iframe sandbox allow-same-origin — 완전 격리 원칙의 한정 적용` 항 신설: (a) §R1이 cross-origin CDN 배포 기준임 명시, (b) same-origin 동봉 위젯 쿠키·스토리지 접근 필요성 및 공급망 무결성 전제 공식 문서화, (c) §R8 carve-out 관계 정리 |
| W2 | convention_compliance | §1.1이 메인 앱 렌더러(`markdown-renderer.tsx`)에 대한 "보안 동등성 + unit 검증"을 약속하면서도 해당 경로가 `code:` 에 미등재 — `status: implemented` 승격 시 `spec-code-paths.test.ts` 검증 누락 | `4-security.md` frontmatter `code:` 목록 | `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 의무 열거(status: partial 시 ≥1 매치 강제) | `code:` 에 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` 추가; 또는 해당 보안 책임이 타 spec 소유면 §1.1 에 위임 spec을 명시하고 본 `code:` 에서 제외 |

> **본 종결 작업과의 관계**: W1·W2 및 아래 INFO 전부 **pre-existing** — 이번 비목표 정정(동시 ≤3 캡·비용가드·sdk 배선)과 무관하다. 어떤 checker도 비목표 격하를 Rationale 번복/cross-spec 충돌로 지목하지 않았다. W2는 `status: implemented` 승격 시에만 발화하며 본 작업은 `partial` 유지라 비차단. W1/W2 는 4-security.md 의 별도 품질 백로그로 분리한다.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | cross_spec | EIA §8.4 interact 분당 60이 Planned(미구현)임을 security spec이 미구분 — 두 제한을 한 문장으로 묶어 독자 오해 가능 | `4-security.md` §4 EIA §8.4 인용 행 | "EIA §8.4 유지(SSE 동시 3/execution 구현됨, interact 분당 60/execution 미구현·Planned)"로 구현 상태 구분 기재 |
| I2 | cross_spec | webhook spec "POST 전용" SoT 선언이 `/embed-config` 서브경로 스코프를 암묵적으로 처리 — 경계가 문서상 불명확 | `spec/5-system/12-webhook.md` Rationale / `4-security.md` §3-① | 12-webhook Rationale의 "POST 전용" 항에 "트리거 엔드포인트에 한정, 서브경로는 각 영역 spec이 별도 정의" 스코프 한정 문구 추가 |
| I3 | rationale_continuity | 인증 webhook(`authConfigId NOT NULL`)을 `enforce:false`로 처리하는 결정의 공식 Rationale 미기재 | `4-security.md` §3 `/embed-config` 동작 서술 | R2에 "임베드 제어는 공개 봇(`authConfigId IS NULL`) 전용이며, 인증 webhook은 서버-to-서버 채널이므로 embed-config 제어 대상 외(WH-SC-01 정합)" 한 문장 추가 |
| I4 | rationale_continuity | CORS 레이어(empty→CDN only) 와 임베드 레이어(empty→allow-all) 비대칭이 Rationale에 의도된 설계 결정으로 미기록 | `4-security.md` §3 마지막 blockquote | R1 또는 R2 하단에 이 비대칭 동작을 의도된 설계 결정으로 한 줄 기록 |
| I5 | convention_compliance | `id: web-chat-security`가 basename `4-security`와 불일치 — 의도인지 오기인지 판별 주석 없음 | `4-security.md` frontmatter | 인라인 주석으로 "타 영역 `4-security`와 충돌 방지를 위해 의도적으로 다름" 명시 또는 현상 유지(규약 허용 패턴) |
| I6 | convention_compliance | `## Overview` 섹션 부재 — `_product-overview.md` 분리 패턴으로 완화되나 가독성 개선 여지 | `4-security.md` 전체 구조 | 본 spec이 다루는 보안 표면 범위를 선언하는 `## Overview` 한 단락 추가(권장, 차단 아님) |
| I7 | plan_coherence | `webchat-eager-start.md` 비차단 backlog의 "localStorage→sessionStorage 토큰" 항목이 `spec_impact`에 `4-security.md` 미포함 — 구현 격상 시 security spec 갱신 누락 가능성 | `plan/in-progress/webchat-eager-start.md` `spec_impact` 목록 | 해당 항목이 구현 단계로 격상될 때 `spec_impact`에 `spec/7-channel-web-chat/4-security.md` 추가 |
| I8 | naming_collision | `id: web-chat-security` — 기존 식별자와 중복 없음, 패턴 준수 확인 | `4-security.md` frontmatter | 없음 |
| I9 | naming_collision | `EmbedConfigDto { allowlist, enforce }` / `EmbedConfigService` — 기존 구현·인접 spec과 의미 완전 일치, 신규 충돌 없음 | `4-security.md` §3-① | 없음 |
| I10 | naming_collision | `WEB_CHAT_WIDGET_ORIGINS`, `interactionAllowedOrigins`, `blocked`, `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService` — 모두 기존 확립 식별자, 충돌 없음 | `4-security.md` §2/§3/§4 | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | EIA §8.4 구현 상태 미구분(I1), webhook spec POST 전용 스코프 모호성(I2) — spec 값 충돌 없음 |
| rationale_continuity | LOW | `allow-same-origin` sandbox가 아키텍처 §R1과의 긴장을 공식 Rationale에 미기록(W1) |
| convention_compliance | LOW | 메인 앱 렌더러 경로 `code:` 미등재(W2) — status 승격 시 검증 누락 위험 |
| plan_coherence | NONE | 활성 결정 충돌 없음 — eager-start `spec_impact` 누락(I7) 만 관찰 |
| naming_collision | NONE | 신규 충돌 식별자 없음 — 모든 식별자 기존 확립 또는 패턴 준수 |

---

## 권장 조치사항

> 아래 1~6 은 전부 **본 종결 작업 범위 밖의 pre-existing 백로그**다(비목표 정정과 무관). 본 PR 은 비차단(BLOCK: NO)으로 진행하고, 필요 시 별도 spec 품질 plan 으로 분리한다.

1. **(W2 — status 승격 전 필수)** `4-security.md` frontmatter `code:` 에 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` 추가. `status: partial → implemented` 승격 시 `spec-code-paths.test.ts` 누락 방지.
2. **(W1 Rationale 신설)** `4-security.md` `## Rationale` 에 `R5. iframe sandbox allow-same-origin — 완전 격리 원칙의 한정 적용` 항 추가. 아키텍처 §R1·§R8 과의 긴장 관계 및 공급망 무결성 전제 공식 문서화.
3. **(I1 명확성)** §4 EIA §8.4 인용 행에서 SSE 동시 3(구현됨)과 interact 분당 60(Planned)을 구분 기재.
4. **(I2 스코프 명시)** `spec/5-system/12-webhook.md` Rationale "POST 전용" 항에 서브경로 스코프 제외 문구 한 줄 추가.
5. **(I3/I4 Rationale 보완)** R2에 인증 webhook embed-config 제외 이유 및 레이어별 비대칭 동작 의도 한 문장씩 추가.
6. **(I7 plan 갱신 — eager-start 구현 격상 시)** `webchat-eager-start.md` `spec_impact`에 `spec/7-channel-web-chat/4-security.md` 추가.
