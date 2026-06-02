# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 신규 백엔드 API(`system-status`) 에 대응하는 유저 가이드 MDX 페이지 없음

- **변경 파일:**
  - `codebase/backend/src/modules/system-status/system-status.controller.ts` (신규)
  - `codebase/backend/src/modules/system-status/dto/system-status-response.dto.ts` (신규)
  - `codebase/frontend/src/app/(main)/system-status/page.tsx` (신규 UI 페이지)
  - `codebase/frontend/src/components/layout/sidebar.tsx` (사이드바 메뉴 항목 추가)

- **매트릭스 항목:** `backend-api-change` — `"controller·DTO 의 swagger jsdoc"` + `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"`

- **누락된 동반 갱신:**
  - `codebase/frontend/src/content/docs/` 하위 어느 MDX 에도 "시스템 상태" 기능에 대한 신규/갱신 항목 없음. 현재 존재하는 섹션(`01~07, 99`)에 system-status 설명이 추가되지 않았으며, 별도 섹션 디렉토리도 생성되지 않았음.

- **상세:** `GET /api/system-status/overview` 는 사이드바에 메뉴가 노출되고 모든 로그인 사용자가 접근하는 신규 UI 페이지이므로 유저 가이드에 이 기능의 목적·구조·health 해석 방법을 설명하는 페이지가 있어야 한다. 현재 `spec/2-navigation/15-system-status.md` 에 UI 스펙은 존재하지만 `codebase/frontend/src/content/docs/` 의 유저 대면 가이드 문서는 전혀 없다.

- **제안:**
  - `codebase/frontend/src/content/docs/07-workspace-and-team/` 하위 기존 섹션에 system-status 관련 짧은 서술 추가, 또는
  - 별도 섹션이 필요하면 신규 `NN-system-status/` 디렉토리를 만들고 `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 에 KO/EN 양쪽 등록 (그렇지 않으면 `new-userguide-section-dir` CRITICAL 트리거)
  - 단, 이 기능이 "관리자용 운영 지표"가 아니라 "모든 로그인 사용자 대상" 이라면 기존 07 섹션 내 서브페이지로 추가하는 것이 가장 부담이 적음.

---

## i18n parity 확인 (매트릭스 `new-ui-string`)

`codebase/frontend/src/app/(main)/system-status/page.tsx` 에서 사용하는 모든 `t(...)` 키가 `dict/ko/systemStatus.ts` 와 `dict/en/systemStatus.ts` 양쪽에 동일하게 등록되어 있음. `sidebar.systemStatus` 도 `dict/ko/sidebar.ts` + `dict/en/sidebar.ts` 양쪽 등록 확인됨.

**i18n parity: 충족** — CRITICAL 이슈 없음.

---

## 신규 섹션 디렉토리 locale 등록 확인 (매트릭스 `new-userguide-section-dir`)

변경 set 안에 `codebase/frontend/src/content/docs/<NN>-<name>/` 형태의 신규 디렉토리가 없음. 따라서 `locale.ts` 미등록에 의한 CRITICAL 은 발생하지 않음.

---

## backend warning/error code 확인 (매트릭스 `new-warning-code`, `new-error-code`)

`system-status` 모듈은 `warningRules` 및 `error-codes.ts` 의 `ErrorCode` enum 을 변경하지 않음. `backend-labels.ts` 미등록 CRITICAL 없음.

---

## 인증·권한 흐름 변경 확인 (매트릭스 `auth-session-flow-change`)

변경 set 에 `codebase/backend/src/modules/auth/utils/device-label.ts` + `device-label.spec.ts` 가 포함되어 있으나, 이는 디바이스 라벨 파싱 유틸리티 수정으로 인증·세션 흐름 자체의 변경이 아님. 07-workspace-and-team 유저 가이드 갱신 필요 없음.

---

## 요약

매트릭스 총 19개 트리거 중 이번 변경 set 에 매칭되는 trigger 는 `backend-api-change`(semantic), `new-ui-string`(semantic) 2개이다. `new-ui-string` 은 ko/en 양쪽 dict 가 모두 추가되어 parity 충족. `backend-api-change` 는 신규 시스템 상태 API + UI 페이지 신설임에도 `codebase/frontend/src/content/docs/` 에 대응 유저 가이드 페이지가 전혀 없어 WARNING 1건 발생. CRITICAL 이슈는 없음.

## 위험도

LOW

---

STATUS=success ISSUES=1
