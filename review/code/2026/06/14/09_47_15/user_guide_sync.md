# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [INFO] triggers.mdx — API Key 인증 설정 FieldTable에 신규 하위 필드 미반영 (회색 지대)

- **변경 파일**: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- **매트릭스 항목**: `new-ui-string` (id) — "신규 UI 문자열(TSX)". 매트릭스 targets: "codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts 양쪽 — 한쪽만 추가 금지 (parity 가드 fail)"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (및 `.en.mdx`) 의 `인증 설정 4종` FieldTable
- **상세**: `triggers.mdx` 의 FieldTable(line 127-132)은 API Key 인증 설정을 "요청 헤더에 발급된 API 키를 동봉해요." 수준으로만 기술하며, 이번 PR에서 생성 폼에 추가된 **Header 이름**(default `X-API-Key`)과 **IP Whitelist**(모든 type 공통) 필드를 언급하지 않는다. 사용자가 문서를 보고 인증 설정 생성 폼에 어떤 추가 구성 옵션이 있는지 파악할 수 없다. 단, 매트릭스에는 "인증 설정 폼 신규 필드 노출 시 triggers.mdx 갱신 필수"라는 명시적 행이 없어 확정적 의무 아님(회색 지대).
- **제안**: `triggers.mdx` 및 `triggers.en.mdx` 의 `인증 설정 4종` FieldTable 또는 Callout에 다음을 추가 권장.
  - API Key 행에: `Header 이름(default X-API-Key) 설정 가능` 사항 명시.
  - 공통 필드 안내: 모든 인증 설정 유형에서 IP Whitelist(허용 IP/CIDR 목록, 선택)를 설정할 수 있음을 명시.

---

## i18n parity 검증 결과 (PASS)

신규 UI 문자열 3건 — `apiKeyHeaderLabel`, `ipWhitelistLabel`, `ipWhitelistHint` — 이 `/Volumes/project/private/clemvion/.claude/worktrees/impl-config-auth-gaps-317fb4/codebase/frontend/src/lib/i18n/dict/ko/authentication.ts` 와 `/Volumes/project/private/clemvion/.claude/worktrees/impl-config-auth-gaps-317fb4/codebase/frontend/src/lib/i18n/dict/en/authentication.ts` 양쪽에 동일 PR 내에서 등록됨. i18n parity 가드 조건 충족.

---

## 기타 매트릭스 행 매칭 검토

| 매트릭스 행 | 판정 | 이유 |
|---|---|---|
| `new-node` / `node-schema-change` | 미매칭 | 변경 파일이 `codebase/backend/src/nodes/**` 아님 |
| `auth-session-flow-change` | 미매칭 | semantic 트리거가 `codebase/backend/src/modules/auth/**` (백엔드 인증 흐름 변경). 이번 변경은 프런트 폼 UI만 수정, 백엔드 인증·세션 로직 미변경 |
| `auth-config-type-enum-change` | 미매칭 | AuthConfig type enum(`api_key/bearer_token/basic_auth/hmac`) 변경 없음. 기존 type에 form 필드만 추가 |
| `integration-provider-change` | 미매칭 | 아웃바운드 통합 provider 변경 아님 |
| `backend-api-change` | 미매칭 | 변경 파일 중 `*.controller.ts` / `dto/**` 파일 없음 (백엔드 DTO는 이미 `ipWhitelist`/`headerName` 지원 중) |
| `new-warning-code` / `new-error-code` | 미매칭 | 신규 warningCode/errorCode 발행 없음 |
| `new-userguide-section-dir` | 미매칭 | 신규 docs 섹션 디렉토리 없음 |

---

## 요약

매트릭스 19개 행 중 `new-ui-string` 1개 행이 매칭되었으며, i18n parity(ko/en 양쪽 등록)는 동일 PR 내에서 충족됨. 나머지 18개 행은 매칭되지 않음. INFO 1건 — `triggers.mdx` 의 인증 설정 4종 설명이 이번에 신설된 Header 이름·IP Whitelist 옵션을 언급하지 않아 사용자 가이드가 stale이 될 수 있으나, 이를 명시하는 매트릭스 행이 없어 회색 지대. 누락 1건, 확정 의무 위반 0건.

## 위험도

LOW

STATUS=success ISSUES=1
