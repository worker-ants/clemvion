# RESOLUTION — webhook 하드닝 후속 fresh review (17_16_16)

원 SUMMARY: ai-review RISK=LOW, **CRITICAL=0, WARNING=0** (전 reviewer PASS).
동반 `--impl-done`(review/consistency/2026/06/28/17_16_16) **BLOCK:NO**, 전 checker NONE/LOW.

이전 라운드(17_00_25)의 WARNING 1건(W1 비-413 4xx 테스트)·INFO 다수가 본 변경에서 해소됨을
fresh review 가 확인. 본 라운드는 차단 사유 없음 — 아래는 비차단 INFO 의 선택 처리 내역.

## 조치 항목

| # | 출처 | 카테고리 | 발견 | 조치 |
|---|---|---|---|---|
| ai-review I3·I4 | Side Effect | 구 413 원문(`'request entity too large'`)에 의존하는 e2e/통합 테스트 회귀 가능성 | **확인 완료(무회귀)**: `grep -rn "request entity too large" codebase/backend/{src,test}` → 매칭은 `http-exception.filter.spec.ts` 2줄뿐(L51 에러 생성, L61 `not.toBe` 비-echo 단언). 응답 기댓값으로 쓰는 e2e/통합 없음. 코드 변경 불요. |
| impl-done I4 (rationale) | Rationale | `3-error-handling.md` Rationale 에 413 message 고정 문구(CWE-209) 근거 부재 | **FIXED**: §Rationale 에 "4xx http-error message 고정 문구 — CWE-209 방지" 항목 추가(WebSocket `EXECUTION_INTERNAL_ERROR` 결정과 일관). |
| impl-done I3 (rationale) | Rationale | `12-webhook.md` Rationale 에 DB 조회 실패 fail-open 결정 근거 부재 | **FIXED**: §Rationale 에 "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅" 항목 추가(채택/기각 대안·`error` 레벨 보완 명시). |

## 보류·후속 항목 (비차단 INFO)

- **ai-review I2 / 권장1 (hooks.service `extractClientIp` 로컬 래퍼 잔존)**: guard 측은 본 PR 에서 제거 완료.
  service 측 동일 래퍼 제거는 별도 surface — **후속 PR 권장**(동작 차이 없음, 단일 구현 통합의 잔여 절반).
- **ai-review I10/I11/I8 (테스트 env 복원·spy mockRestore·afterEach 통일)**: 격리 강화 nice-to-have.
  현재 테스트는 통과·격리 정상(unit green) — 후속 정리.
- **ai-review I5/I6/I7/I9/I12/I13 (413 리터럴 상수화·기본 메시지 dedup·인라인 타입 추출·주석 중복·requestId 단언·이관 주석)**: 경미한 유지보수.
  I5(413 리터럴)는 `no-unsafe-enum-comparison` 으로 상수 치환 불가 — 주석으로 회피 근거 유지(현행).
- **ai-review I15 / 권장7 (IP 미식별 fail-open rate-limit 우회)**: 설계 의도(rate-limit 책임 한정). 인프라 레벨
  XFF 차단·`req.socket.remoteAddress` 폴백은 **중장기 별도 plan** 추적.
- **ai-review I1 / impl-done I-cross-spec (whitespace 헤더 폴백·api-convention §5.3 포인터·web-chat §4 fail-open 언급)**:
  코드는 정확. 선택적 spec 단방향 포인터 — 후속 spec 정리 기회에(SoT 는 본 PR 의 webhook.md·error-handling.md).
- **운영 절차(권장6)**: 모니터링에서 fail-open `error` 로그 alert storm 억제 정책 — 운영 측 설정(코드 밖).

## TEST 결과

- lint·unit·build·e2e(225) 통과 (직전 커밋 6af79346d 기준, `*-171052`·`*-171132`·`*-171228`·`*-171408`).
- 본 RESOLUTION 의 추가 변경은 **spec Rationale 2건(문서만)** — 코드 무변경이라 unit/build/e2e 영향 없음.
  spec 링크 무결성은 lint 재실행으로 확인.
