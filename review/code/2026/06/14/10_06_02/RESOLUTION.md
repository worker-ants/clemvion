# RESOLUTION — config-gaps fix-delta 재리뷰 후속

대상 SUMMARY: `review/code/2026/06/14/10_06_02/SUMMARY.md` (RISK MEDIUM, Critical 0, Warning 6)
배경: 직전 RESOLUTION 의 fix 커밋(검증 로직 신설)을 재리뷰한 결과.

## 조치 내역

### W2 (Security) — 백엔드 검증 미확인 → **조사 결과 fail-closed 확인** [RESOLVED via 조사]
- `auth-configs.service.ts` `ipInWhitelist`/`parseIp` 확인: 백엔드는 `ip-address` 라이브러리(`Address4/6.isValid`)로 각 항목을 파싱하며, **파싱 불가 항목은 매칭에서 제외(fail-closed)** — 잘못된 화이트리스트 항목은 접근을 허용하지 못하고 조용히 무시된다. 즉 "화이트리스트 우회" 위험은 성립하지 않는다.
- 헤더명 역시 incoming 요청 헤더 **조회 키**로만 쓰여(`ctx.headers[headerName]`) 잘못된 값은 매칭 실패(fail-closed) — 응답 헤더 인젝션 경로 아님.
- 결론: 프런트 검증은 입력 단계 UX/데이터품질 가드이며, 보안 경계는 백엔드 fail-closed 매칭이 이미 담당. 백엔드 DTO storage-validation(@IsIP 등) 추가는 **선택적 데이터품질 개선**으로 후속(코드는 옳음). isValidIpOrCidr 주석에 이 사실 명시.

### W1 (Security) — IPv6 정규식 강화 [FIXED]
- `isValidIpv6OrCidr` 신설: `:::`(3+ 연속 콜론)·중복 `::`·비-hex·4 hex 초과 그룹·prefix>128 배제. 경계 테스트(`:::`, `ffff::::`, `2001::db8::1`, `/129`, `12345::1`) 추가.

### W3 (Requirement) — hmac 서명 헤더명 검증 [FIXED]
- `validateAuthConfigForm` 에 hmac 분기 추가 — `isValidHeaderName(hmacHeader)`. 테스트 추가.

### W4 (Maintainability) — 폼 상태 조립 중복 제거 [FIXED]
- `collectFormState(): AuthConfigFormState` 단일 수집 지점 신설 — `handleCreate`(검증)·`createMutation.mutationFn`(페이로드) 양측 재사용.

### W5 (Maintainability) — 파라미터 이름 [FIXED]
- `buildAuthConfigPayload`/`validateAuthConfigForm` 의 `s` → `state`.

### Info [FIXED]
- INFO 8/9/13: IPv6 `:::` 경계·공백 헤더 null 경로·CRLF(`\r\n`) 테스트 추가. `parseIpWhitelist` 를 `split(/\r?\n/)` 로 수정.
- INFO 11: invalid-IP 토스트 메시지 내용(offending entry 포함) 검증 추가.
- INFO 5/12: `vi.clearAllMocks()`(beforeEach)로 mock 누적 방지 — 기존 적용 확인.

## 범위 외 (선재/별도)
- W6 (God Component 분해), INFO 2 (generatedKey 30초 타이머), INFO 10 (hmac/basic 통합 테스트), INFO 6/7/14/15 (ko satisfies·config 판별유니온·JSDoc): 선재/경미 — 별도 리팩토링·후속.
- 백엔드 DTO IP/헤더 storage-validation: 위 W2 조사대로 보안 경계 아님 — 데이터품질 개선 후속.

## 검증
- `auth-config-form.test.ts`(IPv6 경계·hmac·CRLF 포함) + `authentication-form.test.tsx`(메시지 검증) + i18n parity — 100 통과/1 skip. tsc 0. eslint 0.

## ESCALATE
- 없음 (no). Critical 0, actionable warning 해소, 보안 경계(W2) fail-closed 확인.
