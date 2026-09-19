# RESOLUTION — review/code/2026/09/19/15_02_57

수동 처리(main). 코드 처분은 커밋 `6bf7c026d`, spec 처분(W4)은 planner 턴(draft `plan/in-progress/spec-draft-integration-db-test-waits.md`).

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Warning 1 (preview-test 오라클) | 트래커(1라운드 등재) | — | planner 결정 대기 항목의 재확인 |
| Warning 2 (entity tester 가 동시 상한 밖) | 수정 | `6bf7c026d` | 2라운드엔 «위협 불성립(호스트 고정)» 으로 문서만 적었으나, 확장점의 **안전 기본값** 문제라는 지적이 옳다 — entity tester 도 같은 상한 안에서 돈다. 뮤턴트 E1(우회) RED |
| Warning 3 (query 자격증명 `append` vs `set`) | 수정 | `6bf7c026d` | `appendQueryParams` 를 `http-credentials.ts` 로 — 노드와 테스터가 같은 함수. 같은 키가 base_url 에 있는 입력으로 차이를 고정, 뮤턴트 Q1(옛 set 방식) RED |
| Warning 4 (`[SPEC-DRIFT]` §5.4 쿼리 대기) | **spec 반영(planner 턴)** | `975b1c3e5` | 구현이 옳다 — spec 문장을 «연결과 `SELECT 1` 각각 10초» 로. `--spec` 을 거쳐 반영 |
| Warning 5 (rotate 응답 `updatedAt` 이 회전 전 값) | 수정 — **첫 수정은 e2e 가 반증** | `6bf7c026d` → `48dfb2f0e` | 2라운드 부분 저장이 만든 회귀. 첫 수정(`6bf7c026d`)은 `updatedAt` 을 명시 저장하면 DB 가 그 값을 쓴다고 봤다 — 근거로 읽은 것은 `UpdateQueryBuilder` 였고 실제로 도는 `save()` 경로가 아니었다. e2e E 가 응답 1789799519069 · DB 1789799519070 으로 반증. `48dfb2f0e` 는 TypeORM 내부에 기대지 않는다: 바꾸는 컬럼만 저장한 뒤 **행을 다시 읽어** 응답을 만든다(`updated_at` 은 DB 값, 동시 `logUsage` 의 `lastUsedAt` 도 반영). unit(응답 = 재조회 행) + e2e E(응답 = DB). 뮤턴트(재조회 대신 메모리 엔티티) RED |
| Warning 6 (SSRF 검사 블록 중복) | 수정 | `6bf7c026d` | `http-redirect.ts` 의 `outboundBlockReason` 을 테스터가 재사용 |
| Warning 7 (동시 상한이 서비스 간 공유됨을 미검증) | 수정 | `6bf7c026d` | database · http · entity tester 혼합 테스트 |
| Warning 8 (`PreviewTestDto.credentials` 설명) | 수정 | `6bf7c026d` | «실제 외부 호출은 하지 않고» 를 실제에 맞춤. 모듈 전수 grep 으로 같은 서술 잔존 0 |
| Warning 9 (`:id/test` route throttle) | 트래커(W1 항목에 합류) | — | 엔드포인트 보안 태세 결정과 한 묶음 |
| INFO 5 (강제 파괴 무음) · 10 (`discardBody` 중복) · 11 (`opened`) | 수정 | `6bf7c026d` | 강제 파괴 · 소켓 미발견 경고 로그, `discardBody` export 재사용, 이름+주석 |
| INFO 그 밖 | 조치 불요 | — | 1 · 2 · 3 · 9 는 트래커에 이미 있다. 4(URL 3회 파싱)는 병목 아님. 6 · 7 · 8 · 12 · 13 은 구조 제안 — 이 PR 범위를 넓히지 않는다 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-152412.log`)
- unit: PASS — backend 9,827 · frontend 6,597 외 (`_test_logs/unit-20260919-152502.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-152617.log`)
- e2e: `6bf7c026d` 에서 **FAIL** — E 의 응답 `updatedAt` ≠ DB(1ms, `_test_logs/e2e-20260919-153001.log`). W5 행의 재수정 `48dfb2f0e` 로 다시 돌려 **통과** — backend 353 · Playwright 51 (`_test_logs/e2e-20260919-154019.log`)

## 보류·후속 항목

- `:id/test` 의 route throttle 을 preview-test 오라클 항목에 합류 (`plan/in-progress/spec-draft-nullable-notation-followups.md`)
- 트래커의 «§6 이 `§9.3` 으로 가리킨다(실제 §9.2)» 가 틀렸다 — 실제 §9.1. 항목을 정정했고 이번 planner draft 가 닫는다
