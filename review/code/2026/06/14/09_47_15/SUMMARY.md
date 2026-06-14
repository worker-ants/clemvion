# Code Review 통합 SUMMARY — impl-config-auth-gaps (§A.2)

> 대상: 인증 설정 생성 폼 IP Whitelist UI + API Key Header 이름 필드.
> 비고: 1차 실행에서 `security.md`/`scope.md` 미기록 → 두 reviewer 재실행 후 통합.

## 전체 위험도
**MEDIUM** — 기능/spec 정합은 양호하나, 입력 형식 검증 부재(보안)·God Component 심화(유지보수)·테스트 갭이 경고로 존재.

- **Critical**: 0 · **Warning**: 9(통합) · **Info**: 다수

## Critical
없음.

## 경고 (WARNING) — 처리

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | Security | IP/CIDR 입력 클라이언트 형식 검증 부재 | **수정** — `isValidIpOrCidr` + `validateAuthConfigForm` 로 제출 차단·인라인 토스트 |
| 2 | Security | API Key 헤더 이름 형식(RFC 7230 token) 검증 부재 | **수정** — `isValidHeaderName` 검증 |
| 3 | Security | `generatedKey` 30초 자동 클리어 미적용 | **범위 외(선재 흐름)** — 본 PR 미변경. RESOLUTION 기록 |
| 4 | Architecture | 비즈니스 로직(IP 파싱·헤더 분기)이 `mutationFn` 인라인 | **수정** — `buildAuthConfigPayload` 순수 함수 추출 + 단위 테스트 |
| 5 | Maintainability | `"X-API-Key"`/`"X-Hub-Signature-256"` 기본값 하드코딩 분산 | **수정** — `AUTH_CONFIG_DEFAULTS` 상수 단일화 |
| 6 | Maintainability | `AuthenticationPage` God Component 심화 | **범위 외(선재 550줄 컴포넌트)** — 필드 추가 PR 에서 전면 분해 부적절. RESOLUTION 기록 |
| 7 | Maintainability | 모달 overlay 패턴 5중 중복 | **범위 외(선재)** — 공통 Modal 추출은 별도 리팩토링 |
| 8 | Maintainability | `<textarea>` 직접 사용(ui 키트 이탈) | **범위 외** — `@/components/ui/textarea` 부재, 동일 폼의 native `<select>` 와 일관. RESOLUTION 기록 |
| 9 | Testing | non-api_key IP 전송·헤더 공백 경계값 미테스트 | **수정** — `auth-config-form.test.ts` 헬퍼 단위 테스트 + 통합 테스트 보강 |

## Info — 처리 요약
- INFO 10 (편집 폼 gap 미추적): **plan 후속 항목 추가**.
- INFO 5/8 (테스트 cleanup 패턴): **afterEach + locale store reset 추가**.
- INFO 13 (조건부 필드 렌더 대기): **openDialogAsApiKey 에 waitFor 추가**.
- INFO (성능 memoization·setTimeout cleanup·AUTH_TYPES dedup·ko satisfies·triggers.mdx·컴포넌트 JSDoc): 선재/경미 — 범위 외, 일부 후속.

## 에이전트별 위험도
security MEDIUM(검증 부재) · performance LOW · architecture LOW · requirement NONE · scope LOW(0건) · side_effect LOW · maintainability MEDIUM · testing MEDIUM · documentation LOW · dependency NONE · database NONE · concurrency LOW · api_contract NONE · user_guide_sync LOW

## 결론
Critical 0. 보안 검증 부재(W1·W2)·페이로드 순수함수화(W4)·상수 단일화(W5)·테스트 갭(W9)을 본 PR 에서 해소. God Component 분해(W6·W7)·Textarea 컴포넌트(W8)·generatedKey 타이머(W3)는 선재 코드/별도 범위로 RESOLUTION 기록. **BLOCK 없음 — 머지 가능.**
