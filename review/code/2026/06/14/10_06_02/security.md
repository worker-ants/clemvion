# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] IPv6 검증 정규식 부실 — 비-CIDR 악의적 문자열 통과 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-config-auth-gaps-317fb4/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L18–21 (`isValidIpOrCidr`, IPv6 분기)
- 상세: IPv6 검증에 사용된 정규식 `/^[0-9a-fA-F:]+(\/(\d|[1-9]\d|1[01]\d|12[0-8]))?$/`은 콜론(`:`)이 포함된 hex 문자열이라면 모두 통과시킨다. 예를 들어 `:::` , `ffff::::` , `aaaa:bbbb:cccc` 처럼 RFC 4291 에 위반하는 문자열도 콜론이 포함되면 `true`를 반환한다. 최종 방어선이 백엔드 DTO이라고 명시돼 있으므로 서비스 보안에 직접 위협이 되지는 않으나, 프런트엔드 검증이 사실상 무력화되어 잘못된 형식이 백엔드에 도달하게 된다. 백엔드가 `@IsIP()` / `@IsCIDR()` 없이 저장만 한다면 실제 운영에서 접근 제어 오작동으로 이어질 수 있다.
- 제안: IPv6 최소 검증을 강화하거나(예: 그룹 개수·연속 콜론 개수 제한), 또는 `net` 패키지 없이도 정확도를 높이는 `is-ip` 라이브러리 도입을 고려. 단기적으로는 백엔드 DTO에 `@IsIP(6)` / `@IsCIDR()` 데코레이터를 반드시 확인하고, 없으면 추가.

### [WARNING] 클라이언트 전용 검증 — 백엔드 DTO 방어선 미확인
- 위치: `auth-config-form.ts` `validateAuthConfigForm` + `page.tsx` `handleCreate`
- 상세: `isValidIpOrCidr` 와 `isValidHeaderName` 은 프런트엔드 클라이언트에서만 실행된다. 프런트엔드 검증은 HTTP 클라이언트(curl, Postman 등)를 통해 완전히 우회 가능하다. RESOLUTION 및 주석에서 "최종 방어선은 백엔드 DTO" 라고 명시하고 있으나, 현재 리뷰 대상 코드에서 백엔드 DTO(`create-auth-config.dto.ts`)의 `ipWhitelist` 및 `config.headerName` 필드에 `@IsIP()`, `@IsCIDR()`, `@Matches(RFC7230 regex)` 등의 class-validator 데코레이터가 적용되어 있는지 확인되지 않았다. 백엔드 검증이 누락된 경우, 임의의 문자열이 데이터베이스에 저장되어 IP 화이트리스트 우회(접근 제어 무력화) 또는 헤더 인젝션 공격으로 이어질 수 있다.
- 제안: 백엔드 `create-auth-config.dto.ts` 및 `update-auth-config.dto.ts` 에서 `ipWhitelist` 배열 원소에 `@IsIP()` 또는 `@IsCIDR()` 데코레이터가 적용되어 있는지, `config.headerName` 에 RFC 7230 token 형식 검증이 있는지 즉시 확인. 없다면 서버 측 DTO 검증 추가가 Critical 수준의 후속 작업이다.

### [INFO] `basic_auth` 비밀번호 평문 전송 — 설계 상 의도이나 기록
- 위치: `auth-config-form.ts` L32–33 (`buildAuthConfigPayload`, `basic_auth` 분기)
- 상세: `config.password = s.password` 로 비밀번호가 평문으로 POST 바디에 포함되어 전송된다. 이는 Basic Auth 설정 자료를 저장하는 행위 자체의 특성상 불가피하나, 전송 경로가 HTTPS 인지 보장되어야 한다. 프런트엔드 코드에서 TLS 강제 여부는 확인 불가(배포 인프라 수준 설정).
- 제안: 인프라 레벨에서 HTTPS 강제(HSTS)를 확인. 저장 시 백엔드에서 암호화 후 저장하는지도 점검.

### [INFO] `generatedKey` 타이머 자동 클리어 미적용 (선재 코드)
- 위치: `page.tsx` — `generatedKey` state 관련 로직 (이번 변경 미수정 영역)
- 상세: RESOLUTION W3 에서 이미 인식된 선재 이슈. 생성된 API 키가 setTimeout으로 자동 클리어되지 않으면 세션 중 화면에 계속 노출된다. 이번 PR 변경 범위 밖이나 보안 관점에서 후속 추적 필요.
- 제안: `revealedSecret` 패턴(30초 자동 숨김)을 `generatedKey` 에도 동일 적용.

### [INFO] 에러 메시지에 잘못된 IP 목록 노출
- 위치: `page.tsx` L605–611 (`validationError.invalid.join(", ")`) + `en/authentication.ts` L638 (`invalidIpWhitelist: "Invalid IP/CIDR: {{entries}}"`)
- 상세: 검증 실패 시 사용자가 입력한 잘못된 IP 문자열이 토스트 메시지에 그대로 포함되어 표시된다. 토스트는 UI 레이어에만 표시되며 서버로 전송되지 않으므로 정보 노출 위험은 낮다. 다만 공격자가 의도적으로 긴 문자열을 입력해 DOM에 주입을 시도할 경우, React 는 기본적으로 텍스트를 이스케이프하므로 XSS 위험은 없다. 단, `sonner` toast 가 `dangerouslySetInnerHTML` 을 사용하지 않는 한 안전.
- 제안: `sonner` 라이브러리의 toast 렌더링이 HTML을 해석하지 않는다는 것을 확인(기본 동작은 텍스트만). 현재로서는 INFO 수준.

---

## 요약

이번 변경(auth-config-form.ts 신설 + page.tsx 검증 로직 추가)은 이전 리뷰 사이클에서 지적된 입력 검증 부재(W1·W2)를 프런트엔드 레이어에서 해소한 것으로, 보안 방향성은 올바르다. 그러나 IPv6 검증 정규식이 RFC 4291 을 충족하지 않아 비정상 문자열이 통과할 수 있으며(WARNING), 프런트엔드 검증만으로는 API 직접 호출을 막지 못하므로 백엔드 DTO에서의 서버 측 검증이 반드시 존재해야 한다(WARNING). 특히 백엔드 DTO 검증 부재 여부는 이번 코드에서 확인되지 않았으며, 만약 누락된 경우 IP 화이트리스트 접근 제어 우회라는 High 수준의 취약점이 된다. 하드코딩 시크릿, SQL 인젝션, XSS, 인증 우회, 안전하지 않은 암호화 알고리즘 등 다른 OWASP Top 10 항목에 해당하는 신규 취약점은 이번 변경에서 발견되지 않았다.

## 위험도

MEDIUM
