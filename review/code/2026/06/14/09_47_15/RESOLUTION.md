# RESOLUTION — impl-config-auth-gaps ai-review 후속

대상 SUMMARY: `review/code/2026/06/14/09_47_15/SUMMARY.md` (RISK MEDIUM, Critical 0, Warning 9 통합)
비고: 1차 실행에서 security/scope 미기록 → 재실행(security MEDIUM 3건, scope LOW 0건) 후 통합 처리.

## 조치 내역

### Security W1·W2 — 입력 형식 검증 [FIXED]
- `auth-config-form.ts` 신설: `isValidIpOrCidr`(IPv4/IPv4-CIDR/IPv6 pragmatic), `isValidHeaderName`(RFC 7230 token), `validateAuthConfigForm`.
- `page.tsx handleCreate`: 제출 전 검증 — 잘못된 헤더명/IP·CIDR 시 인라인 토스트(`invalidHeaderName`/`invalidIpWhitelist`) + 차단. i18n ko/en 추가.
- 백엔드 DTO 가 최종 방어선임을 명시(아래 후속).

### Architecture W4 + Maintainability W5 — 순수 함수·상수 추출 [FIXED]
- `buildAuthConfigPayload(formState)` 순수 함수로 페이로드 조립을 `mutationFn` 밖으로 분리.
- `AUTH_CONFIG_DEFAULTS`(apiKeyHeader/hmacHeader/hmacAlgorithm) 상수 단일화 — page.tsx 하드코딩 제거.

### Testing W9 [FIXED]
- `auth-config-form.test.ts`: parseIpWhitelist·isValidIpOrCidr·isValidHeaderName·buildAuthConfigPayload(api_key/bearer/hmac/basic_auth)·validateAuthConfigForm 단위 테스트(헤더 공백·non-api_key IP 경계 포함).
- `authentication-form.test.tsx`: 검증 차단(잘못된 IP → post 미호출) 통합 케이스 + afterEach cleanup·locale reset(INFO 5/8) + openDialogAsApiKey waitFor(INFO 13).
- 전체 96 통과 / 1 skip.

### INFO 10 [FIXED]
- `spec-sync-config-gaps.md` 후속에 "편집 폼 IP Whitelist / api_key Header 이름 미지원" 항목 추가.

## 범위 외 / 후속 (RESOLUTION 기록)
- **Security W3** `generatedKey` 30초 자동 클리어: 본 PR 이 손대지 않은 선재 생성-키 표시 흐름. 별도 보안 개선으로 추적(revealedSecret 패턴 동일 적용 권장).
- **Maintainability W6·W7** God Component 분해 / 공통 Modal 추출: 선재 ~550줄 컴포넌트. §A.2 필드 추가 PR 에서 전면 리팩토링은 범위 노이즈 — 별도 리팩토링 과제.
- **Maintainability W8** `<textarea>` → ui 컴포넌트: `@/components/ui/textarea` 미존재. 동일 폼의 native `<select>`(type/algorithm)와 일관된 패턴이라 현행 유지, 공통 Textarea 신설은 별도.
- **백엔드 DTO IP/헤더 검증(@IsIP 등)**: 클라이언트 검증이 최종 방어선이 아니므로 백엔드 하드닝 권장 — 단 기존 데이터/API 계약 영향 검토 필요한 별도 변경. 후속.
- 기타 INFO(memoization·setTimeout cleanup·AUTH_TYPES dedup·ko satisfies·triggers.mdx·JSDoc): 경미/선재, 후속.

## 검증
- `auth-config-form.test.ts` + `authentication-form.test.tsx` + i18n parity 96 통과/1 skip. tsc 0. eslint 0.

## ESCALATE
- 없음 (no). Critical 0, actionable warning 해소. §A.3(소스 IP·응답 코드·기간 분해)·편집 폼은 plan 에 결정 필요/후속으로 분리.
