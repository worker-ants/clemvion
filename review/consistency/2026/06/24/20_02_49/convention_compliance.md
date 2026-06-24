# 정식 규약 준수 검토 — 03-maintainability M-2

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `plan/in-progress/refactor/03-maintainability.md` §M-2 + 연관 구현 파일 6종
정식 규약 기준: `spec/conventions/**`

---

## 발견사항

### [INFO] ws-client.ts 의 WS_URL fallback 포트가 M-2 개선 방안 "grep 3001 0건" 목표와 충돌
- target 위치: `plan/in-progress/refactor/03-maintainability.md` §M-2 개선 방안 3 ("grep -rn '3001' frontend/src 0건 확인")
- 위반 규약: `spec/conventions/` 에 직접 규정된 항목은 없으나 M-2 내 자체 일관성 요건과 불일치
- 상세:
  - 검토 모드 prompt 에서 `ws-client.ts` 가 6파일 교체 목록에 포함돼 있다.
  - 실제 `codebase/frontend/src/lib/websocket/ws-client.ts:4` 에 `WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001"` 가 존재한다. 이 변수는 API URL 이 아닌 WebSocket 연결 URL 이지만 포트 3001 을 fallback 으로 사용한다.
  - plan §M-2 의 "grep 3001 0건 확인" 검증 기준을 `frontend/src` 전체에 적용하면 이 라인이 잔류해 0건 달성에 실패한다.
  - `login-form.tsx`, `register-form.tsx` 는 이미 3011 fallback 을 사용 중이고 (`API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"`), 잘못된 3001 fallback 은 `client.ts:4` 와 `assistant.ts:315` 두 곳이다. `ws-client.ts:4` 의 3001 은 WS 포트이므로 성격이 다르다.
- 제안: (a) plan §M-2 검증 항목을 "grep -rn '3001/api' frontend/src 0건 확인" 으로 API URL 한정 표현으로 수정하거나, (b) `ws-client.ts:4` 의 WS fallback 도 정포트로 교정해 grep 범위를 유지하는 두 방향 중 하나를 명시한다. 어느 쪽이든 plan 과 구현 범위가 일치해야 한다. 규약 직접 위반이 아니므로 INFO.

### [INFO] plan 파일이 subfolder 이므로 frontmatter 가드 면제 — 현 상태 정상
- target 위치: `plan/in-progress/refactor/03-maintainability.md` (frontmatter 없음)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` + `spec/conventions/spec-impl-evidence.md §4.2`
- 상세:
  - `plan-frontmatter.test.ts` 가드는 `plan/in-progress/*.md` top-level 만 적용한다. `plan/in-progress/refactor/` 하위 파일은 클러스터 부속 문서로 plan-lifecycle §4 에서 명시 면제된다.
  - 현재 frontmatter 없음은 규약상 정상이다.
- 제안: 조치 불요.

### [INFO] 신규 파일 `lib/api/constants.ts` 명명 — 프로젝트 파일 명명 패턴과 일관
- target 위치: `plan/in-progress/refactor/03-maintainability.md` §M-2 개선 방안 1
- 위반 규약: `spec/conventions/` 에 frontend 파일 명명 규칙을 직접 규정한 문서 없음
- 상세:
  - `lib/api/` 하위 파일들은 `client.ts`, `assistant.ts`, `auth-providers.ts` 등 의미 기반 kebab-case 를 사용한다. `constants.ts` 는 이 패턴과 일관된다.
  - `getServerApiBaseUrl()` 는 camelCase 함수명으로 TypeScript 관용 패턴이다.
- 제안: 조치 불요. 명명은 적절하다.

---

## 요약

`plan/in-progress/refactor/03-maintainability.md` §M-2 와 연관 구현 파일 6종은 `spec/conventions/**` 를 직접 위반하는 항목이 없다. 문서 구조(subfolder plan frontmatter 면제), 파일 명명, 에러코드 규약, API 문서 규약, 금지 패턴 모든 관점에서 정식 규약 준수 상태다. 단 INFO 수준으로, plan 의 검증 목표 "grep 3001 0건" 과 `ws-client.ts:4` 의 WS fallback 포트 3001 사이에 scope 불명확성이 있어, 구현 착수 전 plan 텍스트 또는 구현 범위를 일치시킬 것을 권고한다.

## 위험도

LOW
