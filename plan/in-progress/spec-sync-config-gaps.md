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

## 미구현 — 결정 필요 / 후속 (본 PR 범위 밖)
- [ ] §A.3 **소스 IP** 컬럼 — **결정 필요**. webhook 호출의 소스 IP 가 `execution` 등 어디에도 저장되지 않는다(`hooks.service.ts` 가 `extractClientIp` 로 추출만 하고 미저장). 스키마(컬럼/별도 call-log) + 캡처 경로 결정 선행.
- [ ] §A.3 **응답 코드** 컬럼 — **결정 필요**. 현재 `execution.status`(워크플로 상태 enum)만 존재하고 HTTP 응답 코드 미저장. "응답 코드" 의미(HTTP code vs status enum) + 스키마 결정 선행.
- [ ] §A.3 **기간별 호출 수 (일/주/월)** — **표시형식 결정 필요**. `started_at` 데이터는 존재(버킷팅만 필요)하나, 롤링 윈도(24h/7d/30d) vs 캘린더 버킷·숫자 vs 차트 표시 결정 선행.
- [x] §A.2 **편집 폼** (2026-06-14, impl-config-auth-edit-form PR) — 행별 편집 버튼 → `PATCH /auth-configs/:id` 로 name·IP Whitelist·비-비밀 config(api_key `headerName`, hmac `header`/`algorithm`, basic_auth `username`) 수정. type·비밀값 불변(비밀 변경은 regenerate). 생성 다이얼로그를 `dialogMode` 로 재사용. **백엔드 안전성 fix**: `update` 가 config 를 wholesale-replace(`Object.assign`)해 암호화 비밀값을 파손하던 잠재 버그를 shallow-merge + SECRET_CONFIG_KEYS 무시로 수정. spec §A.2 callout·R-2·`update-auth-config.dto.ts` 설명 동기화. 테스트: `auth-config-form.test.ts`(순수)·`authentication-form.test.tsx`(편집 PATCH)·`auth-configs.service.spec.ts`(merge/비밀 보존).
  - [ ] TEST WORKFLOW (lint·unit·build·e2e)
  - [ ] /ai-review
  - [ ] /consistency-check --impl-done

## 후속 — God Component 분리 (ai-review 2026-06-14 WARNING 1·4 재확인)
- [ ] `authentication/page.tsx` God Component 분리 — `AuthConfigCreateForm` + `AuthConfigEditDialog` 컴포넌트·커스텀 훅(`useAuthConfigEditDialog`)으로 edit 흐름 추출. (ai-review 2026-06-14 WARNING 1·4 재확인 — edit 폼 `useState` 11개 통합 포함)
  - 우선순위: 저(현재 기능 동작 OK, 회귀 위험 대비 scope 분리가 적절)
  - 목적: `dialogMode === "edit"` 분기 4곳 분산 제거, `useState` 개수 축소, create+edit 통합 리팩토링을 별도 PR 에서 진행
  - 선행 조건: 현 PR 병합 후

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 `auth-configs.service.ts:399-450`, `authentication/page.tsx:81-89` 참조.
- §3 API 표 및 마스킹/Reveal/select-only(B.2/Rationale)는 코드와 1:1 정합 — 강등 대상 아님.
