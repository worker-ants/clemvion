# RESOLUTION — ai-review 재검토(리뷰-픽스 델타)

직전 ai-review(00_39_22) Warning 처분 커밋(11c53cb1)이 review-stop 가드를 재무장(리뷰 세션 타임스탬프 < 코드 커밋 시각)하여, 미리뷰 델타를 새 세션(01_01_29)으로 재검토. **RISK LOW / Critical 0 / Warning 4** — 전수 처분, **추가 코드 변경 없음**(루프 회피).

## 조치 항목

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| W1 | 보안 | 복구 코드 SHA-256(KDF 아님) | **백로그(이월)** | pre-existing 코드(`hashRecoveryCode`, 본 PR 미변경). 72비트 엔트로피·일회성 소비로 단기 위험 낮음 — 리뷰어도 "즉각 수정 불필요". argon2id/scrypt 전환은 별도 보안 task |
| W2 | 테스트 | `disable()` idempotency 케이스 미커버 | **수용(현 커버리지 충분)** | `disable()` 은 조건 분기 없는 3필드 무조건 reset — 이미 비활성 사용자 재호출도 동일 update 산출. 정상경로 단언으로 동작 보장 충분 |
| W3 | 테스트 | 빈 html `toBe("")` 가 DOMPurify 버전 의존 | **수용** | `DOMPurify.sanitize("")` 는 결정적으로 `""` 반환(안정 동작). markdown 변형은 이미 `not.toContain("<script")` 사용. 회귀 시 build 가 즉시 검출 |
| W4 | 문서 | spec/4-security.md 변경 미커밋 | **false positive** | spec §1.1 매트릭스는 **commit b51f9750 에 이미 커밋**됨. 본 재검토 스코프가 `--commit 11c53cb1`(코드 델타만)이라 그 단일 커밋 diff 에 spec 파일이 없어 "미커밋"으로 오인. 브랜치 기준 정상 커밋 상태 |

INFO 처분: OWASP A09 로깅·disable 3필드·user-null·safe-html 경계값(INFO #1-4)은 직전 RESOLUTION 에서 이미 반영 완료. 캐스팅/JSDoc/티켓참조(INFO #5-12)는 경미 — 코드 재변경이 가드를 재무장하므로 본 PR 미반영, 가치 있는 항목은 follow-up.
SPEC-DRIFT INFO #13(spec §1 빈입력 동작 1행) → planner follow-up.

비고: 통합 시 `scope`/`testing` reviewer 출력 파일 누락(manifest success). 테스트 관점은 requirement reviewer 가 커버(disable idempotency·SPEC-DRIFT surfacing). CRITICAL 0·LOW 로 재실행 불요.

## TEST 결과

- **lint / unit / build / e2e**: 직전(리뷰-픽스 반영분)에서 전 stage PASS — lint PASS · unit(totp+auth 208·safe-html 21) PASS · build PASS · e2e 202 PASS. 본 재검토는 **코드 변경 0**(처분만)이라 재수행 불요.

## 보류·후속 항목

- 복구 코드 KDF(argon2id/scrypt) 전환 — 별도 보안 개선 task (W1).
- spec §1 빈입력 sanitize 동작 1행 명시 + sanitize deny-by-default / otplib v13 Rationale 등재 — project-planner follow-up (consistency-check INFO + 본 SPEC-DRIFT).
