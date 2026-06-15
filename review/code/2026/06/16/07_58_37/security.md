# 보안(Security) Review — config-c1b-auth-rbac-guard

리뷰 대상: authentication RBAC UI 가드 변경 (2026-06-16)
파일: `authentication/__tests__/authentication-form.test.tsx`, `authentication/page.tsx`, `plan/in-progress/spec-sync-config-gaps.md`

---

## 발견사항

### 인젝션 취약점

- **[INFO]** XSS — `config.name`, `config.type`, `call.triggerName`, `call.status` 등 서버 응답값을 React JSX 에 직접 렌더링
  - 위치: `page.tsx` L962, L1204, L1210
  - 상세: React 는 기본적으로 텍스트 노드를 이스케이프하므로 현재 구조에서는 XSS 위험 없음. `dangerouslySetInnerHTML` 사용 없음 확인.
  - 제안: 현 상태 유지. 향후 서버 응답을 HTML 로 렌더링하는 경우 별도 새니타이징 필수.

---

### 하드코딩된 시크릿

- **[INFO]** 테스트 코드에 더미 평문 키 값 `"wfk_live_abc123"` 포함
  - 위치: `authentication-form.test.tsx` L211
  - 상세: 테스트 픽스처용 가짜 값이며 실제 운영 자격증명이 아님. 단 `wfk_live_` 프리픽스가 실 키 포맷을 노출하여 공격자가 유효 키 패턴을 유추 가능.
  - 제안: 테스트용 더미이므로 즉각 조치 불필요. 실 키 포맷 노출을 최소화하려면 `"test_dummy_key_abc"` 같은 중립적 값으로 대체 가능.

---

### 인증/인가

- **[INFO]** UI 가드(`isAdmin`)는 클라이언트 사이드 Zustand 스토어 값(`useHasRole`) 기반
  - 위치: `page.tsx` L562, `role-gate.tsx` L40-43
  - 상세: 이번 변경의 핵심인 `{isAdmin && (...)}` 가드는 화면 노출 제어(UX 혼란 방지)를 목적으로 설계된 것이고, 실제 권한 강제는 백엔드 `@Roles('admin')` 데코레이터가 수행함. 컨트롤러 전체 확인 결과 모든 변경 엔드포인트(POST, PATCH, POST/regenerate, POST/reveal, DELETE)에 `@Roles('admin')` 적용 확인. UI 우회 시에도 API 레벨에서 403 반환. 보안 depth-of-defense 구조 정상.
  - 제안: 이번 변경 범위에서 문제 없음. 다만 클라이언트 스토어 값이 조작될 경우 UI 버튼이 노출될 수 있으나 실제 API 요청은 차단되므로 허용 가능한 설계.

- **[INFO]** Reveal 흐름 — 패스워드 재확인 후 평문 노출
  - 위치: `page.tsx` L705-722 (`revealMutation`), 컨트롤러 L178-211
  - 상세: 백엔드가 `POST /auth-configs/:id/reveal` 에 `@Roles('admin')` + 비밀번호 재확인 + audit_log 기록 구조로 올바르게 구현됨. UI 역시 `isAdmin` 조건부로 Reveal 버튼을 이번 변경에서 포함시켜 비-admin 에 노출하지 않음. 이중 방어 충족.
  - 제안: 현 상태 양호.

---

### 입력 검증

- **[INFO]** IP Whitelist 클라이언트 측 검증 — 토스트 에러 표시
  - 위치: `authentication-form.test.tsx` L189-204 (테스트 커버리지)
  - 상세: 프론트엔드에서 무효 IP/CIDR 항목 검증 후 제출 차단 및 toast.error 호출. 백엔드에서도 `@IsIpOrCidr({ each: true })` DTO 검증으로 이중 방어(plan 문서 §C-2 참고). 테스트가 `postMock` 비호출을 확인해 클라이언트 차단 동작을 검증함.
  - 제안: 현 상태 양호.

- **[INFO]** API 경로 파라미터 — `ParseUUIDPipe` 적용
  - 위치: `auth-configs.controller.ts` L77, L121, L149 등
  - 상세: 경로 파라미터 `:id` 에 `ParseUUIDPipe` 가 적용되어 UUID 포맷 강제. 경로 탐색·인젝션 위험 없음.
  - 제안: 현 상태 양호.

---

### OWASP Top 10

- **[INFO]** Broken Access Control (A01) — 위 인가 섹션에서 분석 완료. 백엔드 강제로 보완됨.

- **[INFO]** Insecure Design (A04) — 평문 키(`revealedSecret`, `generatedKey`) 30초 자동 클리어 구현 확인
  - 위치: `page.tsx` L580-596
  - 상세: `useEffect` + `clearTimeout` 패턴으로 언마운트 시 타이머 정리. 화면 방치 시 평문 노출 시간 제한으로 설계상 안전.
  - 제안: 현 상태 양호. 브라우저 탭이 백그라운드로 이동해도 JS 타이머는 계속 동작하므로 자동 클리어는 정상 기능.

- **[INFO]** Security Logging (A09) — 변경 엔드포인트 모두 `req.ip` + `userId` 를 audit 로그에 기록
  - 위치: `auth-configs.controller.ts` L105, L128-134, L175, L208-209
  - 제안: 현 상태 양호.

---

### 암호화

- **[INFO]** 이번 변경 범위에서 암호화 관련 신규 코드 없음. 기존 비밀값은 백엔드 암호화 레이어에서 처리되며 본 PR 변경 사항에서 평문 저장/전송 코드 없음.

---

### 에러 처리

- **[INFO]** 변경된 코드 내 오류 핸들러는 모두 일반적인 i18n 키(`t("authentication.configUpdateFailed")` 등) 반환
  - 위치: `page.tsx` L639, L656, L669 등
  - 상세: 스택 트레이스·내부 오류 메시지가 사용자에게 노출되지 않음. API 응답 에러 내용은 toast 에 전달하지 않고 일반 실패 메시지만 표시.
  - 제안: 현 상태 양호.

---

### 의존성 보안

- **[INFO]** 이번 변경 범위에서 신규 의존성 추가 없음. `package-lock.json` 변경이 git status 에 있으나 해당 파일은 리뷰 대상에 포함되지 않음.

---

## 요약

이번 변경은 Authentication 페이지의 변경 액션 버튼(Add Config·Toggle·Reveal·Edit·Regenerate·Delete) 전체를 `{isAdmin && (...)}` 조건부 렌더링으로 통합하는 UI 가드 강화 작업이다. 보안 관점에서 가장 중요한 특성은 실제 권한 강제가 백엔드 `@Roles('admin')` 데코레이터(모든 변경 엔드포인트에 적용 확인)에 의해 이루어지고, 프론트엔드 가드는 그 위의 UX 개선 레이어임이 명확하다는 점이다. 이중 방어 구조(클라이언트 UI 숨김 + 서버 `@Roles` 강제)가 올바르게 구현되어 있으며, Reveal 흐름은 추가로 비밀번호 재확인 + audit_log 까지 갖추고 있다. 평문 비밀값 자동 클리어(30초) 구현도 확인되었다. 신규 인젝션 취약점·하드코딩 시크릿·취약 알고리즘 도입은 없으며 전체적으로 보안 상태는 양호하다.

---

## 위험도

LOW

> 낮은 위험도 사유: 실제 권한 강제는 서버 사이드에서 fail-closed 로 동작하며, 이번 변경은 UI 노출 정책을 spec 의 RBAC 매트릭스에 정렬하는 것이 목적이다. 테스트 픽스처의 키 포맷 노출은 미미한 정보 노출 수준이며 운영 자격증명이 아니다.
