# 요구사항(Requirement) 리뷰 — refactor-04-security (2차 라운드 21:06:59)

리뷰 대상: 이전 라운드(20:32:29) SUMMARY.md·각 reviewer md + 이를 토대로 이미 커밋된 소스 코드의 현재 상태
리뷰 일시: 2026-06-12 21:06:59

---

## 발견사항

### [INFO] 이전 라운드(20:32:29) SPEC-DRIFT 4건 — 현 spec 에 이미 반영 확인

이전 라운드의 requirement.md(20:32:29)는 SPEC-DRIFT 4건을 지적하며 코드 유지 + spec 갱신을 권고했다.

1. `spec/5-system/6-websocket-protocol.md §3.3` workflow:/notifications: 소유 검증 채널 목록 미등록:
   - 현재 spec: §3.3 권한 검증 표에 workflow:{workflowId} (workspace 소유, 비-UUID 선차단), notifications:{userId} (JWT sub 일치, emit 미구현 Planned) 모두 등재됨. 반영 완료.

2. `spec/5-system/1-auth.md §2.3` CF-Connecting-IP 무조건 신뢰로 기술:
   - 현재 spec: §2.3 세션 정책 표에 "CF-Connecting-IP 는 TRUST_CF_CONNECTING_IP=true 일 때만 1순위 (기본 off)" 으로 정정됨. Rationale §2.3.B 에 설계 근거 기술. 반영 완료.

3. `spec/4-nodes/5-data/1-transform.md` / regex ReDoS 정책 "길이 200" 만 언급, safe-regex 미기재:
   - transform.md L68/L134, filter.md L103, if-else.md §6 각주 모두 compileUserRegex + safe-regex 위험 패턴 거부를 명시함. 반영 완료.

4. `spec/conventions/swagger.md` production 비노출 정책 미기재:
   - swagger.md 에 "§0) Swagger UI 노출 정책 (non-production 전용 — refactor 04 M-1)" 섹션과 Rationale §0 신설됨. 반영 완료.

모두 SPEC-DRIFT(코드가 옳고 spec 이 낡아 갱신이 필요했던 건)로, 이번 라운드에서는 4건 전부 해소됨.

---

### [INFO] 이전 라운드 WARNING(refresh 쿠키 path 회색지대) — spec §2.3 반영 확인

이전 라운드 WARNING(코드 유지 + spec 명시 권고): spec/5-system/1-auth.md §2.3 Refresh 쿠키 Path 항목 신설.
현재 spec: §2.3 세션 정책 표에 Refresh Token row 에 Path /api/auth 명시됨. 반영 완료.

---

### [INFO] compileUserRegex — safeRegex() 예외 처리 이미 구현 확인

이전 보안·테스팅 리뷰(19:49:22, 20:32:29)에서 safeRegex(source) 호출에 try/catch 부재를 지적했다.
현재 소스 코드(condition-evaluator.util.ts L89-93)를 확인한 결과, safe-regex 내부(regexp-tree) 예외를
별도 try/catch 로 감싸 { regex: null, reason: 'unsafe' } (fail-closed) 를 반환하는 방어 코드가 이미 구현됨.
이전 지적이 현재 코드에는 해당하지 않는다.

---

### [INFO] clearRefreshTokenCookie — "경로 일치" 경고 주석 이미 추가 확인

이전 라운드 documentation.md / SUMMARY.md W5에서 clearRefreshTokenCookie 에 "set/clear 경로 일치" 제약
경고 주석 부재를 WARNING 으로 지적했다. 현재 소스 코드(refresh-cookie.ts L52-55)를 확인한 결과,
함수 JSDoc 에 path 불일치 시 쿠키 삭제 실패 경고가 정확히 추가됨. 이전 라운드 W5 해소 완료.

---

### [INFO] Promise.resolve 래핑 의도 — 이전 라운드 W7 해소 확인

이전 라운드 SUMMARY.md W7: channelAuthorizers 인터페이스 정의 근처에 Promise.resolve() 필수 래핑 이유
주석 부재. 현재 소스 코드(websocket.gateway.ts L82-84)에 "authorize 반환은 항상 Promise — 동기 판별도
Promise.resolve() 로 감싸 시그니처를 통일한다(호출부의 await 단일화)" 주석이 인터페이스 정의 직전에 명시됨.
이전 라운드 W7 해소 완료.

---

### [SPEC-DRIFT] [WARNING] spec/4-nodes/1-logic/2-switch.md safe-regex 정책 미기재

- 위치: spec/4-nodes/1-logic/2-switch.md §3 compileRegexCache 설명
- 상세: if-else.md §6 각주, filter.md §3, transform.md L68 은 compileUserRegex + safe-regex 위험 패턴 거부
  정책을 명시하고 코드도 이를 구현한다. 그러나 switch.md §3 의 compileRegexCache 설명에는 safe-regex 위험
  패턴 거부 문구가 없다. 코드 구현은 compileRegexCache → compileUserRegex 를 경유하므로 safe-regex 방어가
  실제로 동작한다 — spec 이 낡은 것이며 코드가 옳다.
- 제안: 코드 유지. spec/4-nodes/1-logic/2-switch.md §3 의 compileRegexCache 설명에 "safe-regex 위험 패턴
  (지수 백트래킹) 거부 포함 — if-else §6 각주 동일 정책" 1줄 추가. 담당: project-planner.

---

### [INFO] shouldTrustCfConnectingIp 직접 단위 테스트 부재 — 기능 동작 정상

이전 라운드 testing.md WARNING / SUMMARY W6: shouldTrustCfConnectingIp 함수에 직접 단위 테스트 없음.
요구사항 충족 관점에서는: 함수 로직(v === 'true' || v === '1')이 단순하고, extractClientIp 통합 테스트에서
간접 검증 중이다. plan m-3 요구사항(TRUST_CF_CONNECTING_IP opt-in, isFlagOn 규칙과 동일) 을 코드가 충족한다.
기능 미충족 아님 — 테스트 일관성 이슈만 존재. (testing 리뷰 담당 사항)

---

### [INFO] isOriginAllowed null-origin 거부 — spec §2.3 반영 확인

이전 라운드 requirement.md INFO: null-origin CSRF 방어가 spec 에 미기재. 현재 spec/5-system/1-auth.md §2.3
에 "allowlist 외·불투명('null') Origin 은 403" 이 명시됨. 반영 완료.

---

## 요약

refactor-04-security 2차 라운드 요구사항 충족 검토 결과, 이전 라운드(20:32:29)에서 지적된 SPEC-DRIFT 4건
(websocket-protocol §3.3 채널 목록, auth §2.3 CF-IP opt-in, transform/filter/if-else safe-regex 정책,
swagger.md production 비노출 규약)은 현재 spec 에 모두 반영됐다. refresh 쿠키 path 회색지대 WARNING 도
auth §2.3 에 Path 명시로 해소됐다. 코드 레이어에서는 compileUserRegex 의 safeRegex() 예외 처리(fail-closed),
clearRefreshTokenCookie 경고 주석, Promise.resolve() 래핑 의도 주석이 이미 구현됐음을 확인했다. CRITICAL
또는 일반 요구사항 미충족 WARNING 은 없다. 유일한 SPEC-DRIFT 잔여건은 switch.md §3 에 safe-regex 정책이
직접 명시되지 않은 것이며, 코드 동작은 올바르고 if-else.md 각주와 구현이 이를 커버한다. 기능 완전성 관점에서
M-1(Swagger 게이팅), M-3(ReDoS), M-5(쿠키·CSRF), M-6(WebSocket IDOR), m-1(DOMPurify 화이트리스트),
m-3(CF-IP opt-in) 전 항목이 코드와 spec 모두 정합하게 구현 및 문서화됐다.

## 위험도

LOW

STATUS=success ISSUES=1
