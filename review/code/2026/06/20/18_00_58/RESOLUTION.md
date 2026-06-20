# RESOLUTION — ai-review 18_00_58 (C-3 §3 webauthn/sessions raw bcrypt 통합)

1차 ai-review(RISK LOW, Critical 0, **WARNING 4**) 조치. fix 후 fresh ai-review(`18_19_24`)에서 **Critical 0·WARNING 0**(전부 INFO) 확인 → 해소 완료.

## 조치 항목

| SUMMARY # | 분류 | 발견 | 조치 | commit |
|---|---|---|---|---|
| WARNING #2 | Testing | `revokeFamily` 테스트가 5번째 인자(`currentRefreshToken`) 생략 → self-revoke 분기 dead-path | 기존 6개 호출에 `null` 명시 | `681e6493` |
| WARNING #3 | Testing | self-revoke 방지 분기(`CANNOT_REVOKE_CURRENT_SESSION`) 테스트 부재 | 테스트 2건 신설 — self(현재 family)=`400` 차단·revoke 미수행, non-current=정상 revoke | `681e6493` |
| WARNING #4 | Side Effect | webauthn regenerate 에러 메시지가 `verifyPasswordForUser` 메시지에 간접 결합 (테스트가 메시지 미단언) | 에러 메시지 SoT 는 `auth.service.spec`(C-3) 소유, webauthn 은 위임 계약만 검증임을 테스트 주석에 명시 | `681e6493` |
| WARNING #1 | Security | `verifyPasswordForUser` early-exit 타이밍 사이드채널 | **보류** (아래 §보류 1) | — |
| INFO #4 | Documentation | `verifyReauth` JSDoc "bcrypt 검증" 잔존 | "comparePassword 헬퍼로 검증" 정정 | `681e6493` |
| INFO #5 | Testing | regenerate 성공 케이스가 `regenerateRecoveryCodes(user.sub)` 인자 미단언 | `toHaveBeenCalledWith('user-uuid')` 추가 | `681e6493` |
| INFO #8 | Maintainability | 신규 it 설명 한/영 혼용 | 파일 기존 패턴(영문) 통일 | `681e6493` |
| INFO #1·#2·#3 | SPEC-DRIFT | data-flow/2-auth §1.2 흐름·verifyReauth 에러코드·bcrypt→comparePassword 다이어그램 | **보류** → planner (아래 §보류 2) | — |
| INFO #6·#7·#9 | Testing/Maint | 미변경 메서드(`revokeOtherFamilies` audit 단언·`bcrypt.hash` 픽스처·`resolveCurrentFamilyId` 타입)의 pre-existing 소개선 | **보류** (비차단·범위 밖) | — |
| INFO #10 | Security | webauthn regenerate brute-force 보호 부재 | **보류** → 별도 보안 작업 | — |

> fresh review(`18_19_24`) 신규 INFO(#6 resolveCurrentFamilyId 타입, #7 hashRaw 복제, #8 @param 미구조화, #9 Swagger 설명, #10·#11 추가 negative 단언, #12 plan 추적)도 전부 INFO·비차단. plan 추적(#12)은 plan §변경 4·체크리스트에 반영, 나머지는 §보류로 종결.

## TEST 결과

review-fix(`681e6493`) 후 TEST WORKFLOW 재수행 — 전 단계 PASS:

- **lint**: PASS (prettier 1건 즉시 정정 후)
- **unit**: PASS — 356 suites / **7155 passed**(self-revoke 2건 신규 반영, 이전 7153), 1 skipped
- **build**: PASS (tsc clean)
- **e2e**: PASS — **205 passed** (auth 재인증 흐름 보존)

## 보류·후속 항목

1. **WARNING #1 타이밍 사이드채널 (defer)** — 대상 `auth.service.ts:65-70` 은 본 changeset 밖(C-3 #658 머지 코드). 호출 경로가 **JWT 인증 후 본인 비밀번호 재확인**(`user.sub`)이라 userId enumeration 불가(자기 계정만 조회)·실위험 ~0. dummy bcrypt 비교 삽입은 behavior-change 라 별도 보안 작업. fresh review 도 동일 판단(INFO#4, "plan defer 기록됨").
2. **SPEC-DRIFT·spec 동기화 (planner 위임)** — `data-flow/2-auth.md §1.2`(verifyPasswordForUser 흐름·bcrypt→comparePassword 다이어그램), `1-auth.md §2.3`(verifyReauth 에러코드 표), `§2`(self-revoke 정책), `error-handling.md §1`(PASSWORD_REQUIRED/INVALID 카탈로그), `Rationale`(단일 경로 근거). 전부 코드 옳음·spec 낡음 → `project-planner`. plan §범위 밖/후속에 추적.
3. **단일진실 완성 후보** — `auth-configs.service.ts:309` raw `bcrypt.compare`(`AUTH_FAILED`, 계약 상이) 별도 검토.
4. **brute-force 보호 (INFO#10, 별도 보안)** — webauthn regenerate·verifyReauth rate limiting.
