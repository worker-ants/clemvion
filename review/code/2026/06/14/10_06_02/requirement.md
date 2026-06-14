# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 기능 완전성 — §A.2 생성 폼 신규 필드 모두 구현
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, `auth-config-form.ts`
- 상세: spec §A.2 가 요구하는 두 필드가 생성 폼에 모두 구현됐다.
  1. **IP Whitelist** (모든 type 공통, 선택): textarea(한 줄에 IP/CIDR 하나) → `parseIpWhitelist`로 배열 변환 → 비면 `ipWhitelist` 미포함. spec 요구사항과 일치.
  2. **API Key Header 이름** (api_key type 한정, default `X-API-Key`): 비우면 백엔드 기본값 적용(미송신). spec `config.headerName` 매핑과 일치.
  - hmac `header`/`algorithm`, basic_auth `username`/`password` 기존 필드도 `buildAuthConfigPayload`로 올바르게 조립된다.
- 제안: 해당 없음.

### [INFO] 기능 완전성 — 편집 폼(PATCH) 미지원은 명시적 범위 외
- 위치: `plan/in-progress/spec-sync-config-gaps.md` (신규 항목 §A.2 편집 폼)
- 상세: 신규 두 필드는 생성 폼(`POST`)에만 반영됐고, 편집 폼 자체가 없음(현 UI는 생성·토글·재생성·삭제만). plan 파일에 "편집 흐름 신설은 별도 범위"로 명시 추가됐으므로, 의도적 범위 제한임이 추적된다.
- 제안: 해당 없음 (plan 추적 완비).

### [INFO] spec fidelity — §A.2 구현 현황 blockquote 코드-spec 일치
- 위치: `spec/2-navigation/6-config.md` §A.2 blockquote
- 상세: spec §A.2 필드 표("Header 이름", "IP Whitelist")와 코드 구현(`config.headerName`, `ipWhitelist[]`)이 line-level로 일치한다. API Key 기본값 `X-API-Key`, HMAC 기본 헤더 `X-Hub-Signature-256`, 알고리즘 `sha256`/`sha512`도 `AUTH_CONFIG_DEFAULTS`와 spec 표가 정합한다.
- 제안: 해당 없음.

### [WARNING] 에러 시나리오 — `validateAuthConfigForm`에서 HMAC 헤더 이름 유효성 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` `validateAuthConfigForm`, 56~58행
- 상세: `validateAuthConfigForm`은 `api_key` type 에 한해서만 `apiKeyHeader` RFC 7230 token 검증을 수행한다. 그러나 `hmac` type 의 `hmacHeader`(서명 헤더명, 사용자 수정 가능, default `X-Hub-Signature-256`)는 동일한 RFC 7230 token 제약이 적용되는 HTTP 헤더명임에도 형식 검증이 없다. 사용자가 공백·콜론·개행이 포함된 잘못된 헤더명을 입력해도 제출이 허용되어 백엔드로 전달된다. `isValidHeaderName` 함수가 이미 존재하므로 추가 구현 비용은 낮다.
  - `buildAuthConfigPayload` 에서 hmacHeader 가 빈 경우 `AUTH_CONFIG_DEFAULTS.hmacHeader` 로 fallback 처리는 되나, 빈 값이 아닌 잘못된 형식 입력은 그대로 전달된다.
- 제안: `validateAuthConfigForm` 에서 `hmac` type 의 `hmacHeader` 에도 `isValidHeaderName` 검증을 적용:
  ```ts
  if (s.type === "hmac") {
    const header = s.hmacHeader.trim() || AUTH_CONFIG_DEFAULTS.hmacHeader;
    if (!isValidHeaderName(header)) return { key: "invalidHeaderName" };
  }
  ```
  i18n 키 `invalidHeaderName` 은 이미 존재하므로 추가 비용 없음.

### [INFO] 엣지 케이스 — `name` 필드 비어 있음 처리는 `handleCreate` 에서 선행 체크
- 위치: `page.tsx` `handleCreate` 243-251행
- 상세: `validateAuthConfigForm` 은 `name` 검증을 담당하지 않으나, `handleCreate` 에서 `formName.trim()` 과 `formType` 을 먼저 확인하고 `fillRequired` 토스트를 띄우므로 비즈니스 로직상 누락이 아니다. `validateAuthConfigForm` 의 인터페이스(`AuthConfigFormState`)에도 `name` 은 포함되나 검증하지 않는 것이 의도(함수 주석: "제출 전 검증")와 일치한다.
- 제안: 해당 없음.

### [INFO] 엣지 케이스 — `basic_auth` username/password 공백 처리
- 위치: `auth-config-form.ts` `buildAuthConfigPayload` 내 basic_auth 분기
- 상세: `config.username = s.username.trim()`, `config.password = s.password` — username은 trim하고 password는 그대로 전달한다. password에 공백 포함을 허용하는 것은 일반적으로 올바른 처리이며, username trim은 실수 방지 처리로 합리적이다. 단, username이 trim 후 빈 문자열이 되는 경우(`handleCreate`의 `formUsername.trim()` 체크)는 `handleCreate`에서 차단되므로 문제없다.
- 제안: 해당 없음.

### [INFO] spec fidelity — `AuthConfigType` 유니온 타입 spec §A.2 정합
- 위치: `auth-config-form.ts` line 3
- 상세: `"api_key" | "bearer_token" | "basic_auth" | "hmac"` — spec §A.2 필드 표 4개 type 과 완전히 일치한다.
- 제안: 해당 없음.

### [INFO] 반환값 — `buildAuthConfigPayload` 모든 경로에서 `AuthConfigPayload` 반환
- 위치: `auth-config-form.ts` `buildAuthConfigPayload`
- 상세: 모든 type 분기를 통과한 후 무조건 `{ name, type, config, ...(ipWhitelist) }` 를 반환하며 누락 경로가 없다. `bearer_token` type의 경우 config 분기에 해당 없어 `config: {}` 가 반환되는데, 이는 올바른 동작(spec §A.2 Bearer Token 표에 config 하위 필드 없음).
- 제안: 해당 없음.

### [INFO] TODO/FIXME — 없음
- 상세: 변경된 모든 파일에서 TODO, FIXME, HACK, XXX 주석이 확인되지 않는다.
- 제안: 해당 없음.

### [INFO] 데이터 유효성 — IPv6 검증의 느슨함은 의도적
- 위치: `auth-config-form.ts` `isValidIpOrCidr`, line 12
- 상세: IPv6 정규식(`/^[0-9a-fA-F:]+(\/...)?$/`)은 `::1`, `2001:db8::/32` 같은 정상 입력을 허용하지만 일부 비유효 16진수 그룹 패턴도 통과시킬 수 있다(예: `:::::::::`). 주석에 "pragmatic — 전체 RFC 검증 아님, 최종 방어선은 백엔드 DTO" 라고 명시돼 있으므로 의도적 설계다.
- 제안: 해당 없음 (주석으로 의도 명시됨, 백엔드 DTO가 최종 검증).

---

## 요약

spec §A.2 에서 요구하는 두 가지 신규 입력 필드 — IP Whitelist(모든 type 공통) 와 API Key Header 이름(api_key 한정) — 가 생성 폼에 완전히 구현됐다. `AUTH_CONFIG_DEFAULTS` 상수, `buildAuthConfigPayload` 순수 함수, `validateAuthConfigForm` 검증 함수가 spec 필드명·기본값·타입과 line-level 로 정합하며, i18n(ko/en) 도 양쪽 모두 반영됐다. 편집 폼 미지원은 plan 에 명시적으로 추적된다. 단 한 가지 요구사항 미완: `hmac` type 의 `hmacHeader` 는 사용자 수정 가능한 HTTP 헤더명임에도 `validateAuthConfigForm` 에서 RFC 7230 형식 검증이 누락됐다(`api_key` header 에는 적용됐으나 `hmac` header 는 미적용). `isValidHeaderName` 함수가 이미 존재하므로 추가 비용은 낮으나, 잘못된 헤더명이 백엔드로 전달될 수 있어 WARNING 으로 기록한다.

## 위험도

LOW

STATUS: SUCCESS
