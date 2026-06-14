---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# config — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/6-config.md
>
> **Scope**: 본 plan 은 `6-config.md` 중 **Part A(인증 설정)** 의 미구현 gap 만 다룬다. **Part B/C(Models — Chat/Embedding/Rerank 통합)** 는 `plan/in-progress/unified-model-management.md` 가 담당한다 (두 plan 이 같은 spec frontmatter 에 공존하므로 scope 분리 명시).

> **구현 진척 (2026-06-14, impl-config-auth-gaps PR)**: decision-free §A.2 폼 2건 구현.
> §A.3 항목은 데이터 캡처/스키마·표시형식 결정이 필요해 분리(아래).

## 구현 완료 (decision-free)
- [x] §A.2 공통 **IP Whitelist 설정 폼 UI**: `authentication/page.tsx` 생성 폼에 모든 type 공통 textarea(한 줄에 IP/CIDR 하나) 추가, 빈 줄 제거 후 top-level `ipWhitelist` 배열로 송신(비면 미송신). i18n ko/en. 테스트 `authentication-form.test.tsx`.
- [x] §A.2 API Key **Header 이름 입력 필드** (default `X-API-Key`): api_key type 선택 시 노출, `config.headerName` 으로 송신(비우면 백엔드 기본값).

## §A.3 호출 이력 (2026-06-14, impl-config-call-history PR) — 구현 완료

> 결정 확정(사용자) + 구현. spec §A.3 표 ✅ 승격 + Rationale R-6 + 데이터 모델 §2.13 동기화. 게이트: consistency-check --impl-prep BLOCK:NO(`review/consistency/2026/06/14/14_33_40`).

- [x] §A.3 **소스 IP** 컬럼 — **결정: `Execution.source_ip VARCHAR(45)` 컬럼 추가 (V096, NULL).** `hooks.service` 가 `extractClientIp` 결과를 인증 IP whitelist 검증과 호출 이력 영속에 공용으로 전달(`execute()` options `sourceIp?`). 비-HTTP 트리거·추출 불가 시 NULL → UI `—`.
- [x] §A.3 **응답 코드** 컬럼 — **결정: "둘 다" — `Execution.response_code VARCHAR(10)` (V096, NULL).** webhook 은 실제 HTTP 코드(성공 = `202`) 저장, 비-HTTP 트리거는 NULL → `getUsage` 가 `status` enum 으로 폴백 표시. WH-MG-05 이행.
- [x] §A.3 **기간별 호출 수** — **결정: 롤링 윈도(24h/7d/30d) + 막대 차트(recharts BarChart).** `getUsage` 가 `Execution.started_at` 단일 쿼리 조건부 집계(`COUNT(*) FILTER`)로 `periodCounts {last24h,last7d,last30d}` 반환.
  - 구현: V096 migration + `Execution` 엔티티 컬럼 / `ExecuteOptions` triggerId variant `sourceIp?`/`responseCode?` + `execute()` 영속 / `hooks.service` handleWebhook·handleChatChannelWebhook 전달 / `getUsage` 컬럼+periodCounts / DTO `AuthConfigUsageCallDto`·`AuthConfigUsagePeriodCountsDto`·`AuthConfigUsageDto` / frontend authentication usage drawer 컬럼+BarChart / i18n ko·en.
  - spec 동기화: `6-config.md` §A.3 표 ✅ + §3 API `/usage` 응답 shape + Rationale R-6; `1-data-model.md` §2.13 `source_ip`/`response_code` + AuthConfig 호출 집계 경로 SoT (consistency W-1·W-2·I-1 해소).
  - 테스트: `execution-engine.service.spec`(sourceIp/responseCode 영속 + NULL) · `hooks.service.spec`(XFF 소스IP + 202 전달, chat-channel 포함) · `auth-configs.service.spec`(periodCounts 파싱 + responseCode status 폴백) · frontend `usage-drawer.test.tsx`(컬럼·값·기간 차트).
  - I-11 메모: 본 PR 은 `authentication/page.tsx` 의 usage drawer 만 수정(create/edit 폼 영역 무변경) — 후속 God Component 분리 스코프와 충돌 없음.
  - [ ] TEST WORKFLOW (lint·unit·build·e2e)
  - [ ] /ai-review (--branch main)
  - [ ] /consistency-check --impl-done
- [x] §A.2 **편집 폼** (2026-06-14, impl-config-auth-edit-form PR) — 행별 편집 버튼 → `PATCH /auth-configs/:id` 로 name·IP Whitelist·비-비밀 config(api_key `headerName`, hmac `header`/`algorithm`, basic_auth `username`) 수정. type·비밀값 불변(비밀 변경은 regenerate). 생성 다이얼로그를 `dialogMode` 로 재사용. **백엔드 안전성 fix**: `update` 가 config 를 wholesale-replace(`Object.assign`)해 암호화 비밀값을 파손하던 잠재 버그를 shallow-merge + SECRET_CONFIG_KEYS 무시로 수정. spec §A.2 callout·R-2·`update-auth-config.dto.ts` 설명 동기화. 테스트: `auth-config-form.test.ts`(순수)·`authentication-form.test.tsx`(편집 PATCH)·`auth-configs.service.spec.ts`(merge/비밀 보존).
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS (e2e 190/190)
  - [x] /ai-review — RISK MEDIUM, Critical 0 / Warning 7. WARNING 2·3·5·6·7 fix(commit 29a24c5d), WARNING 1·4(God Component) → 후속 분리. RESOLUTION.md 기록.
  - [x] /consistency-check --impl-done — BLOCK: NO. W-1(Edit 버튼 Admin+ 가드 누락) fix(commit a47e3ea5). W-2·W-3 은 base-read 오탐(이미 반영됨).

## 후속 — God Component 분리 (ai-review 2026-06-14 WARNING 1·4 재확인)
- [ ] `authentication/page.tsx` God Component 분리 — `AuthConfigCreateForm` + `AuthConfigEditDialog` 컴포넌트·커스텀 훅(`useAuthConfigEditDialog`)으로 edit 흐름 추출. (ai-review 2026-06-14 WARNING 1·4 재확인 — edit 폼 `useState` 11개 통합 포함)
  - 우선순위: 저(현재 기능 동작 OK, 회귀 위험 대비 scope 분리가 적절)
  - 목적: `dialogMode === "edit"` 분기 4곳 분산 제거, `useState` 개수 축소, create+edit 통합 리팩토링을 별도 PR 에서 진행
  - 선행 조건: 현 PR 병합 후

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 `auth-configs.service.ts:399-450`, `authentication/page.tsx:81-89` 참조.
- §3 API 표 및 마스킹/Reveal/select-only(B.2/Rationale)는 코드와 1:1 정합 — 강등 대상 아님.
