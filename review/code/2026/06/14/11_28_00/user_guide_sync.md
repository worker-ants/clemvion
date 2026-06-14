# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [INFO] 인증 설정(AuthConfig) 편집 폼 — 유저 가이드 페이지 부재
- **변경 파일:** `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`, `codebase/frontend/src/app/(main)/authentication/page.tsx`, `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts`
- **매트릭스 항목:** `backend-api-change` — "controller·DTO 의 swagger jsdoc + API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- **누락된 동반 갱신:** `codebase/frontend/src/content/docs/06-integrations-and-config/` 내 auth config 관련 페이지 (현재 미존재)
- **상세:** 이번 PR 은 (1) 백엔드 update service 의 shallow-merge 동작 수정, (2) 프론트엔드 auth config 편집 폼 신규 추가(Edit 버튼, PATCH 경로, 폼 pre-populate)를 포함한다. `UpdateAuthConfigDto` 의 swagger 설명도 갱신됐다. auth config 관리 기능은 `06-integrations-and-config/` 에 대응 유저 가이드 페이지가 존재하지 않는다. "API 노출 변경이 사용자 안내에 영향" 트리거에 해당하나, 해당 페이지 자체가 없으므로 지금 당장 "갱신 누락"이라기보다 "페이지 미존재" 상태다. shallow-merge 시맨틱(비밀값 보존, 마스킹값 역류 무시)은 사용자가 이해해야 하는 동작 변경이므로 후속에 auth config 관리 가이드 페이지 신설 검토가 권장된다.
- **제안:** 후속 plan 에서 `codebase/frontend/src/content/docs/06-integrations-and-config/auth-config.mdx` + `.en.mdx` 신설 검토 — 편집 폼 동작(type lock, 비밀값 불변, ipWhitelist 비움 의도), 재발급 흐름을 안내.

---

### [PASS] i18n parity — ko/en 양쪽 완비
- `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts` 와 `codebase/frontend/src/lib/i18n/dict/en/authentication.ts` 양쪽에 `editConfigDialogTitle`, `editButton`, `editTypeLocked`, `configUpdated`, `configUpdateFailed` 등 편집 폼 관련 신규 키가 동시 등록됨. 키 개수 및 목록이 동일 — parity 이슈 없음.

---

### [PASS] auth-session-flow-change 트리거 — 해당 없음
- 변경 파일 경로(`codebase/backend/src/modules/auth-configs/**`)는 glob `codebase/backend/src/modules/auth/**` 에 패턴 매칭되나, 본 변경은 사용자 세션·로그인·권한 부여 흐름이 아니라 웹훅 인증 설정(AuthConfig) CRUD 의 update 병합 전략을 수정한다. 대상 문서인 `07-workspace-and-team/` (password-and-sessions, workspaces-and-members 등)과 내용 관련성 없음 — 무관 판정.

---

### [PASS] 신규 warningCode / errorCode 발행 — 해당 없음
- 이번 변경에서 backend warningRules 또는 `error-codes.ts` 의 ErrorCode enum 추가 없음. `backend-labels.ts` 동반 갱신 불필요.

---

### [PASS] 신규 노드 / 노드 schema 변경 — 해당 없음
- `codebase/backend/src/nodes/**` 변경 없음.

---

### [PASS] 표현식 언어 / 실행·디버깅 흐름 — 해당 없음
- expression-engine 및 실행 엔진 변경 없음.

---

## 요약

매트릭스 총 19개 trigger 중 2개가 변경 파일에 매칭됐다(글로브 매칭: `backend-api-change` — DTO 경로; 의미 매칭: `auth-session-flow-change` 패턴 후보). i18n parity(ko/en 양쪽 동시 갱신)와 backend-labels 매핑은 완비됐다. `auth-session-flow-change` 는 내용 무관으로 판정됐다. `backend-api-change` 는 auth config 관리 유저 가이드 페이지가 현재 미존재하므로 "갱신 누락"이 아닌 "페이지 미신설" 상태로 INFO 1건 기록한다. 실질적 문서 누락(CRITICAL/WARNING)은 없다.

## 위험도

LOW
