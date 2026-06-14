# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [INFO] 인증 설정 호출 이력 기능(§A.3)에 대응하는 유저 가이드 페이지 부재

- 변경 파일: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신: `codebase/frontend/src/content/docs/06-integrations-and-config/authentication.mdx` + `.en.mdx` (현재 미존재)
- 상세: 이번 PR 은 `GET /api/auth-configs/:id/usage` 응답에 `periodCounts(last24h/last7d/last30d)`, `recentCalls[].sourceIp`, `recentCalls[].responseCode` 세 신규 필드를 추가했다. `06-integrations-and-config/` 디렉토리에 인증 설정(auth-config) 전용 유저 가이드 페이지가 현재 없으므로, 소스 IP · 응답 코드 · 기간별 호출 수 기능이 무엇이고 어떻게 활용하는지를 사용자가 문서에서 확인할 수 없다. 기존 페이지가 없어 "갱신 누락"이 아닌 "신규 문서 미작성" 상태다.
- 제안: 후속 작업으로 `codebase/frontend/src/content/docs/06-integrations-and-config/authentication.mdx` + `authentication.en.mdx` 를 신설해 §A.3 호출 이력 테이블(소스 IP, 응답 코드, 기간별 호출 수) 사용법을 기술한다. 또는 기존 `plan/in-progress/spec-sync-config-gaps.md` 후속 항목에 유저 가이드 페이지 신설을 추가해 추적한다. 현재 기능은 동작하고 i18n 도 완비되어 있으므로 이 문서 부재가 사용자에게 UI 오류를 유발하지는 않는다.

---

### i18n Parity 확인 (이상 없음)

- `codebase/frontend/src/app/(main)/authentication/page.tsx` 에 추가된 신규 i18n 키: `authentication.sourceIp`, `authentication.responseCode`, `authentication.periodCounts`, `authentication.callCount`, `authentication.period24h`, `authentication.period7d`, `authentication.period30d`
- `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts`: 위 7개 키 전부 한국어로 등록됨 (소스 IP, 응답 코드, 기간별 호출 수, 호출 수, 최근 24시간, 최근 7일, 최근 30일)
- `codebase/frontend/src/lib/i18n/dict/en/authentication.ts`: 위 7개 키 전부 영어로 등록됨 (Source IP, Response Code, Calls by Period, Calls, Last 24h, Last 7d, Last 30d)
- 판정: ko/en parity 완전 충족. CRITICAL 사유 없음.

### 신규 warningCode/errorCode 확인 (이상 없음)

- `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음 — `new-error-code` trigger 비해당.
- backend warningRules 변경 없음 — `new-warning-code` trigger 비해당.
- `codebase/frontend/src/lib/i18n/backend-labels.ts` 동반 갱신 불필요.

### 기타 trigger 비해당 확인

- `codebase/backend/src/nodes/**` 변경 없음 → `new-node`, `node-schema-change` 비해당.
- `codebase/packages/expression-engine/**` 변경 없음 → `expression-language-change` 비해당.
- `codebase/frontend/src/content/docs/` 신규 디렉토리 없음 → `new-userguide-section-dir` 비해당.
- `codebase/backend/src/modules/auth/**` (세션/권한 미들웨어) 변경 없음, 변경 대상은 `auth-configs` (webhook 인증 설정) → `auth-session-flow-change` 의미 비해당.
- 새 integration provider 추가 없음 → `integration-provider-change` 비해당.
- 실행·디버깅 사용자 흐름 변경 없음 (execution 엔티티 컬럼 추가는 데이터 저장 로직이며 사용자 디버그 UI 흐름 변경 아님) → `run-debug-flow-change` 비해당.

## 요약

매트릭스 총 19개 trigger 중 2개가 이번 변경 set 에 매칭됐다. `new-ui-string` trigger: 신규 i18n 키 7개가 `dict/ko` + `dict/en` 양쪽에 동시 등록되어 parity 가드 완전 충족. `backend-api-change` trigger: `auth-config-response.dto.ts` DTO 변경으로 trigger 됐으나, 인증 설정 전용 유저 가이드 MDX 페이지 자체가 존재하지 않아 갱신 대상 파일이 없는 상태다 — 기능 문서 미작성(INFO 1건). 동반 갱신 누락(CRITICAL/WARNING)은 0건이다.

## 위험도

LOW
