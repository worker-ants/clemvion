# RESOLUTION — 21_30_17

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #5 (W5) | 코드 | aa06ab9c | JSDoc Precedence 를 JWT exp → tokenExpiresAt → credentials.expires_at 3단계로 갱신 (documentation 리뷰 WARNING) |
| #8 (W8) | 코드 | aa06ab9c | `.claude/test-stages.sh` `cmd_lint()` 를 `npx eslint` 직접 호출로 변경 — `eslint: command not found` 해소 (maintainability/security 리뷰 WARNING) |

## TEST 결과

- lint  : 경고 (pre-existing 3 errors — sessions.controller.ts / llm.service.ts / node-component.interface.ts, 이번 PR 변경 파일과 무관. `npx eslint` 가 정상 실행되어 W8 목표 달성)
- unit  : 통과 (4064 passed)
- build : (이번 sub-agent 실행에서 별도 실행 안 함 — 직전 CI 빌드 로그 `_test_logs/build-20260519-212718.log` PASS 확인)
- e2e   : 통과 (93/93)

## 보류·후속 항목

### 별도 plan 이관 (이번 PR scope 밖)

- W1 (Security): `otplib@12` → v13 업그레이드 — 별도 plan 필요
- W2 (Security): `npm audit` 15건 moderate — `npm audit fix` 실행 + 잔여 검토 필요
- W3 (Security): `INTEGRATION_ENCRYPTION_KEY` 미설정 시 평문 저장 — production 부트스트랩 가드 추가 필요
- W4 (Security): HMAC 검증 실패 로그에 내부 필드 노출 (`dbMallId` 등) — 로그 마스킹 파이프라인 검토 필요
- W6 (Maintainability): `(integration.credentials ?? {}) as Cafe24Credentials` 캐스팅 패턴 반복 — `getCredentials()` 헬퍼 추출 리팩터링

### 별도 plan 불필요 (현재 위험 없음)

- W7 (Testing): `makeFakeJwt` signature 고정 문자열 `sig-not-verified` — 현재 signature 검증 없으므로 기능 무관. 향후 검증 추가 시 마이그레이션 필요 (현재 주석에 명시됨)

### spec 위임

- INFO (Documentation): spec Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 에 `resolveTokenExpiry` 세 번째 위치 미기재 — spec draft 작성 완료: `plan/in-progress/spec-fix-resolve-token-expiry-rationale.md`
