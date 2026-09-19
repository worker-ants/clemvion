# RESOLUTION — review/code/2026/09/19/16_00_06

수동 처리(main). 리뷰 스냅숏 = 최종 코드 커밋 `e6b98cd65`. **이 라운드는 `codebase/` 를 고치지 않고 종결한다** — developer SKILL
§ISSUE FIX 정책 «수렴 예외» 를 적용한다:

- (a) 남은 지적에 **동작 결함이 없다** — Critical 0. Warning 8 은 구조(재진입 런타임 가드 · 코드 상수화) · 테스트 빈칸 · 이 PR 이전부터의
  주석 · 이미 결정 대기로 등재된 항목의 재지적이다. 발견의 성격이 1~2라운드의 동작 결함(DB 닫기 hang · rotate lost-update · 리다이렉트
  URL 불일치)에서 3~4라운드의 구조 · 근거 반증을 거쳐 여기서 문서 · 테스트 위생으로 옮겨 왔다.
- (b) 어느 것을 고쳐도 `codebase/**` 수정이라 리뷰 freshness 가 다시 무장되고, 그 라운드가 같은 성격의 잔여를 낼 형태다(4라운드가
  JSDoc 한 문장 · 테스트 하나로 새 라운드를 부른 것처럼).
- (c) 이 표에 근거와 함께 인용한다.
- (d) 트래커 등재 · 갱신은 이 턴에 했다(`plan/in-progress/spec-draft-nullable-notation-followups.md`).

## 조치 항목

| SUMMARY # | 처분 | 근거 |
|---|---|---|
| Warning 1 (entity tester 재진입 금지가 문서뿐) | 트래커 신규 | 지금 두 테스터는 재진입하지 않는다 — 계약은 `registerEntityTester` JSDoc(`e6b98cd65`). 런타임 가드는 새 테스터를 붙일 때 |
| Warning 2 (preflight DNS 무제한 — 다른 환경) | 트래커 갱신 | 배포 이미지(musl)는 실측 5.0초로 유계(`15_30_04` RESOLUTION). glibc 미측정 · 리다이렉트 홉 lookup 이 `AbortSignal` 밖이라는 남은 창을 기존 «dns.lookup 이 스레드풀을 쥔다» 항목에 적었다 |
| Warning 3 (rotate vs rotate lost update) | 트래커(기존, 재지적 인용) | 버전 컬럼 · 409 설계 필요 — `15_30_04` 에서 등재 |
| Warning 4 (결과 코드 원시 문자열) | 트래커 신규 | `EMAIL_*` 와 함께 상수화 · 지역화를 한 턴에 |
| Warning 5 (mysql SSL 매핑 단언 없음) | 트래커 신규(«spec 빈칸 셋» 1) | 매핑 코드는 이 PR 이 노드에서 옮긴 그대로다(노드 spec 이 경로를 덮는다) — 테스트 대칭은 후속 |
| Warning 6 (드라이버 소켓 spec 의 실제 소켓 · 정리) | 트래커 신규(같은 항목 2) | 테스트 위생 |
| Warning 7 (`SMTP_BLOCK_PRIVATE_HOSTS` 주석) | 트래커 신규 | 이 PR 이전 주석(두 곳, grep 확인). SMTP 가드 CGNAT 항목과 같은 턴에 |
| Warning 8 (400/422) | 트래커(기존, 인용 추가) | planner 결정 대기 |
| INFO 5 (재조회 null 분기 테스트 없음) | 트래커 신규(같은 항목 3) | 분기는 404 로 닫혀 있다 — 테스트만 없다 |
| INFO 그 밖 | 조치 불요 | 1 · 2 · 3 은 트래커의 preview-test 오라클 · DNS rebinding(기존 accepted risk)과 같은 사안. 4 · 6 은 의도된 설계(근거 기록됨). 7 · 8 은 이름 · 위치 제안 |

## TEST 결과

이 라운드는 코드를 바꾸지 않았다 — 직전 코드 커밋 `e6b98cd65` 의 결과가 유효하다.

- lint: PASS (`_test_logs/lint-20260919-155525.log`)
- unit: PASS (`_test_logs/unit-20260919-155613.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-155723.log`)
- e2e: 통과 — backend 353 · Playwright 51 (`_test_logs/e2e-20260919-160003.log`)

## 보류·후속 항목

`plan/in-progress/spec-draft-nullable-notation-followups.md` — 신규 4(entity tester 재진입 · 결과 코드 상수화 · spec 빈칸 셋 · SMTP 가드
주석), 갱신 3(dns.lookup 남은 창 · rotate lost update · 400/422).
