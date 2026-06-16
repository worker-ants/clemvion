---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
spec_impact:
  - spec/2-navigation/6-config.md
  - spec/1-data-model.md
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
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS (e2e 191/191)
  - [x] /ai-review (--range origin/main..HEAD) — 3회 fresh review 모두 Critical 0. round1(15_02_15)·round2(15_22_11) 실질 발견 fix(cb51723e·18c87e06; setParameters cross-workspace 누출 W-1 은 TypeORM per-key merge 라 오탐 규명, lastUsedAt @ApiPropertyOptional 스코프 회귀 복원). round3(15_38_40) 잔여 18경고는 systemic/deferred/cosmetic → RESOLUTION.md 에 accept 기록.
  - [x] /consistency-check --impl-done (15_51_03) — BLOCK: NO. W-1·W-2(§2.13·§A.3 미반영 주장)는 checker 가 cross-ref spec 을 origin/main base 로 읽어 발생한 오탐(commit HEAD 에 이미 반영). W-3(workspace-gaps 마이그레이션 번호 스탈) fix.
- [x] §A.2 **편집 폼** (2026-06-14, impl-config-auth-edit-form PR) — 행별 편집 버튼 → `PATCH /auth-configs/:id` 로 name·IP Whitelist·비-비밀 config(api_key `headerName`, hmac `header`/`algorithm`, basic_auth `username`) 수정. type·비밀값 불변(비밀 변경은 regenerate). 생성 다이얼로그를 `dialogMode` 로 재사용. **백엔드 안전성 fix**: `update` 가 config 를 wholesale-replace(`Object.assign`)해 암호화 비밀값을 파손하던 잠재 버그를 shallow-merge + SECRET_CONFIG_KEYS 무시로 수정. spec §A.2 callout·R-2·`update-auth-config.dto.ts` 설명 동기화. 테스트: `auth-config-form.test.ts`(순수)·`authentication-form.test.tsx`(편집 PATCH)·`auth-configs.service.spec.ts`(merge/비밀 보존).
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS (e2e 190/190)
  - [x] /ai-review — RISK MEDIUM, Critical 0 / Warning 7. WARNING 2·3·5·6·7 fix(commit 29a24c5d), WARNING 1·4(God Component) → 후속 분리. RESOLUTION.md 기록.
  - [x] /consistency-check --impl-done — BLOCK: NO. W-1(Edit 버튼 Admin+ 가드 누락) fix(commit a47e3ea5). W-2·W-3 은 base-read 오탐(이미 반영됨).

## config C-2 (2026-06-16, gap-closure 마지막 슬라이스) — 구현 완료

- [x] **generatedKey 30초 자동클리어** (frontend): create/regenerate 로 1회 노출되는 평문 키(`generatedKey`)를 `useEffect([value]) + clearTimeout` 으로 30초 뒤 자동 비움(언마운트·재노출 시 타이머 정리). 동일 패턴을 reveal 경로(`revealedSecret`)에도 적용해 bare `setTimeout` 누수 제거, 공유 상수 `SECRET_AUTOCLEAR_MS` 도입. spec `6-config.md §A.4` + Rationale R-2 동기화.
- [x] **auth-config ipWhitelist 저장 시점 형식 검증** (backend): `Create/UpdateAuthConfigDto.ipWhitelist` 에 커스텀 `@IsIpOrCidr({ each: true })` 추가 — 무효 IP/CIDR 는 `400`. class-validator `@IsIP` 는 CIDR 거부라 `AuthConfigsService.parseIp` 와 동일한 `ip-address`(`Address4`/`Address6.isValid`) 수용 기준의 커스텀 validator 사용(저장↔런타임 drift 0). spec `1-data-model.md §2.17` 행 + §2.17.3 Rationale 동기화.
  - [x] TEST WORKFLOW (lint·unit·build·e2e) — 전 단계 PASS. unit: backend `auth-config-ip-whitelist.dto.spec`(33) + auth-configs 회귀 91, frontend `generated-key-autoclear.test`(create/reveal 자동클리어·언마운트 4) + authentication 회귀 40. e2e backend 202/202.
  - [x] /ai-review (--range merge-base..HEAD) — 2 fresh round 모두 Critical 0. round1(00_27_07) MEDIUM 6W → revealedSecret useEffect 통일·테스트·문서 fix(commit 8ab9f197). round2(00_43_24) LOW 5W → 의도된 설계·범위 밖·loop-avoidance 로 코드 무변경 수용. RESOLUTION.md 기록.
  - [x] /consistency-check --impl-done (00_54_33) — BLOCK: NO (Critical 0/Warning 0). INFO 7건 중 Rationale 보강(§2.17.3·R-2)·plan 추적(auth-config-webhook-followups §3)·SoT 경계는 본 PR 반영, 상수 export 는 loop-avoidance 로 후속 권고.

## 후속 — God Component 분리 (ai-review 2026-06-14 WARNING 1·4 재확인)
- [x] `authentication/page.tsx` God Component 분리 (2026-06-16, config-c1-auth-god-split) — create/edit 폼을 단일-목적 컴포넌트 + 커스텀 훅으로 추출. **순수 구조 리팩토링 — 동작·UI·API 호출·i18n 키 불변** (기존 36 컴포넌트 테스트가 회귀 가드, 전부 통과).
  - 우선순위: 저(현재 기능 동작 OK, 회귀 위험 대비 scope 분리가 적절)
  - 목적: `dialogMode === "edit"` 분기 4곳 분산 제거, `useState` 개수 축소, create+edit 통합 리팩토링을 별도 PR 에서 진행
  - 산출 (신규 5파일 + page 슬림화 1066→621줄):
    - `use-auth-config-form.ts` — 폼 `useState` 11개 + dialogMode + collectFormState/validateAndProceed 를 단일 훅으로 통합. *(플랜의 `useAuthConfigEditDialog` 가칭 대신 create+edit 공유 상태를 모두 담으므로 `useAuthConfigForm` 로 명명 — 둘이 동일 필드를 공유해 단일 훅이 정확.)*
    - `auth-config-create-form.tsx` (`AuthConfigCreateForm`) — type 자유·password 입력·발급키 1회 표시.
    - `auth-config-edit-dialog.tsx` (`AuthConfigEditDialog`) — type 잠금·password 없음·Save.
    - `auth-config-form-fields.tsx` (`AuthConfigFormFields`) — 두 다이얼로그 공유 입력 필드. `dialogMode === "edit"` 분기를 명시적 capability prop(`typeDisabled`/`showTypeLockedHint`/`showPassword`)으로 대체해 **분산 분기 제거**.
    - `auth-config-types.ts` — 공유 타입(AuthConfig·UsageRecentCall·…)·상수(AUTH_TYPES·TYPE_LABEL_KEYS·STATUS_BADGE_VARIANT)·`pickPlaintextSecret`.
  - 범위 결정: 플랜이 한정한 **create/edit 폼**(WARNING 1·4)만 추출. 테이블·확인 모달(regenerate/reveal/delete)·usage 드로어는 별건 cohesive 라 page(오케스트레이터)에 유지 — "회귀 위험 대비 scope 분리" 원칙 준수.
  - 게이트: lint·tsc·unit(frontend 4435 pass, +16 회귀가드 테스트)·build PASS. /ai-review 2회(00_22_46·fresh 00_39_27) 모두 Critical 0, RESOLUTION 처분. authentication 화면 전용 e2e 없음(컴포넌트 테스트가 가드).

## 후속 — Auth Config 액션 버튼 Admin(RBAC) UI 가드 (ai-review·consistency 2026-06-16 fresh W1·W2)
- [x] `authentication/page.tsx` 의 모든 변경 액션 버튼에 `{isAdmin && …}` 가드 추가 (2026-06-16, config-c1b-auth-rbac-guard) — **"Add Config"(헤더) + 행 액션 셀 전체(Toggle Activate/Deactivate·Reveal·Edit·Regenerate·Delete)**. 액션 셀을 단일 `{isAdmin && (...)}` 로 감싸 통합(Reveal/Edit 의 중복 내부 가드 제거). 목록 행 클릭(usage 드로어 = 읽기)은 모든 역할 허용이라 가드하지 않음.
  - **Toggle(isActive) 포함 근거**: spec §3.2 매트릭스가 Auth Config = Owner/Admin **CRUD**, Editor/Viewer = **R** 로 명시 → isActive 토글도 Update(쓰기)라 Admin+. 백엔드 PATCH `:id` 도 `@Roles('admin')`. (당초 plan 은 Add/Regenerate/Delete 만 열거했으나 spec 상 Toggle 도 동일 권한이라 포함.)
  - 근거: spec/5-system/1-auth.md §3.2 RBAC(Auth Config: Admin=CRUD, Editor/Viewer=R). 실제 권한상승 아님(백엔드 `@Roles('admin')` fail-closed) — UI 일관성·403 혼란 방지.
  - 동작 변경(비-admin 에 버튼 숨김)이라 God-split(순수 리팩토링) PR 과 분리한 별도 PR.
  - 테스트: `authentication-form.test.tsx` — 비-admin 전체 mutation 버튼 숨김 + admin 노출 2건. 게이트: lint·tsc·unit(4440 pass)·build PASS.

## spec 동기화 종결 + status 승격 (2026-06-16, spec-sync-config-c PR) — 완료

> Part A(본 plan) 의 모든 surface 가 #614~#618 슬라이스로 구현 완료됐고, Part B/C(Models)를 담당하던 `unified-model-management.md` 는 이미 `plan/complete/` 로 이동됨(Models 구현 surface — `models/page.tsx`·`model-config-manager.tsx`(chat/embedding/rerank 탭)·`model-config` 모듈 전부 실재 확인). ⇒ `6-config.md` frontmatter `status: partial → implemented` 승격 + `pending_plans` 제거 + 본 plan 완료 이동.

- [x] **frontmatter `code:` God-split 5파일 등재**: 단건 `authentication/page.tsx` → glob `codebase/frontend/src/app/(main)/authentication/**` 로 교체(#616 의 `use-auth-config-form.ts`·`auth-config-create-form.tsx`·`auth-config-edit-dialog.tsx`·`auth-config-form-fields.tsx`·`auth-config-types.ts` + 향후 파일 커버). 빌드 가드 `spec-code-paths` glob 매칭 지원 확인.
- [x] **RBAC UI 가드 문서화**(#618 정합): §A.4 권한 소절을 Reveal 단독 → 모든 변경 액션 버튼(Add Config·활성 토글·Reveal·Edit·Regenerate·Delete) Admin+ 로 확장, §3 Authentication API 표 mutation 행에 `(Admin+)` 주석 + 표 헤더 RBAC 한 줄, Rationale R-2 에 "isActive 토글도 Update 라 Admin+" 근거 추가.
- [x] **status 승격**: `partial → implemented`, `pending_plans` 제거. 빌드 가드 `spec-status-lifecycle` (c) (pending_plans 전건 complete 시 implemented 승격 강제) 충족 — plan 이동과 동일 PR.
  - 게이트: `/consistency-check --spec` BLOCK:NO, docs 빌드 가드(`spec-code-paths`·`spec-status-lifecycle`) PASS. spec/plan 전용 변경이라 ai-review/`--impl-done`(codebase 트리거) 무관.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 `auth-configs.service.ts:399-450`, `authentication/page.tsx:81-89` 참조.
- §3 API 표 및 마스킹/Reveal/select-only(B.2/Rationale)는 코드와 1:1 정합 — 강등 대상 아님.
