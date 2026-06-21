# RESOLUTION — 21_27_56 (이메일 변경 후속)

> ai-review 후속(V101·테스트·data-flow·plan). Critical 0, WARNING 3(전부 신규 테스트 코드 품질) + INFO 14. WARNING 3 전부 fix + cheap INFO 3건 fix.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 | 코드(Testing) | fix | resend e2e 에 `email_change_expires_at > before` 단언 추가 — 제목("만료 시각 갱신")과 검증 범위 일치 |
| W2 | 코드(Testing/Req) | fix | `auth.service.spec` resendEmailChange 에 "메일 실패 시 토큰 롤백 안 함(request 와 비대칭)" 단위 테스트 추가 (update 1회·pendingEmail NULL화 없음 검증) |
| W3 | 코드(Maintainability) | fix | e2e DB seed UPDATE 4회 중복 → `seedPendingEmailChange()` 헬퍼 추출 |
| INFO 10 | 코드(Doc) | fix | e2e JSDoc "검증 대상" 에 resend/race 케이스 반영 |
| INFO 11 | spec(Doc) | fix | `data-flow/2-auth.md §2.3` SMTP 행에 이메일 변경 확인·통지 메일 추가 |
| INFO 12 | plan(Doc) | fix | followup plan §할 일 `- [x]` 체크박스 형식 (EXPLAIN 은 deferred 명시) |
| INFO 1 | Perf/DB | 수용 | V101 non-CONCURRENTLY — 현 규모 미미. 운영 대용량 시 CONCURRENTLY 검토를 plan 에 명시 |
| INFO 2 | Perf | 보류 | EXPLAIN ANALYZE — 데이터 충분한 환경 필요, plan §할 일 deferred 항목으로 기록 |
| INFO 3~9,13,14 | 비차단 | 미조치 | i18n mock 중복·일부 단언 보강·OAuth-only e2e·대소문자 e2e·throttle 경계 등 — 핵심 경로는 기존 unit+e2e 로 커버. 비차단 nit |

## TEST 결과
- lint  : 통과 (0 errors)
- unit  : 통과 (40 affected — resend mail-fail 신규 테스트 포함)
- build : 통과 — production `src/` 는 91ea84ea(build-20260621-212326 통과) 이후 불변(수정은 test/doc 파일만). 재실행 no-op
- e2e   : 통과 — 214 passed (seed 헬퍼 리팩터 후 동일, resend/선점 케이스 포함). log: e2e-20260621-214252.log

## 보류·후속 항목
- INFO 2 EXPLAIN ANALYZE: `plan/complete/email-change-followup-email-lower-index.md` §할 일 deferred 체크박스로 추적(데이터 규모 환경 필요).
- INFO 3 (i18n mock 공유 util), INFO 4~9/13/14 (선택 단언·시나리오 보강): 비차단. 핵심 경로(request/verify/resend/cancel·세션revoke·감사) 는 e2e+unit 으로 커버됨.
