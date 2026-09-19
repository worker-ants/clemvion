# RESOLUTION — review/code/2026/09/19/13_58_22

수동 처리(main). 처분은 전부 커밋 `eebf0286a` 에 모았다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Critical 1 (DNS lookup 스레드풀) | **수정 — 제안과 다른 방법** | `eebf0286a` | 전제 «이 PR 이 처음 노출» 은 틀렸다 — preview-test 는 Email(`ssrf.util.ts` `resolvesToPrivate` 의 `dns.lookup`) · MCP(fetch 연결)로 이미 사용자 host 를 lookup 한다. 제안된 `Promise.race` 는 응답만 끊고 libuv 스레드는 lookup 이 끝날 때까지 잡혀 있어 서술한 실패(풀 고갈)를 막지 못한다. 대신 `dispatchTest` 에 transport 테스트 동시 상한 `CONNECTION_TEST_MAX_CONCURRENCY = 2`. 뮤턴트 L1(상한 우회) · L2(3) RED. 남는 것은 트래커 |
| Warning 1 (rotate lost-update) | 수정 | `eebf0286a` | 바꾸는 5컬럼만 `save`, 응답은 갱신한 엔티티. unit(저장 키 집합) + e2e E(부분 저장에도 암호화 · 회전 시각). 뮤턴트 P1 RED, P2 는 처음 GREEN(fixture 가 원래 `connected`) → fixture 를 `error` 로 바꿔 RED |
| Warning 2 (preview-test 연결 오라클) | **트래커** | — | 엔드포인트의 보안 태세 결정(받아들일 위험 · 워크스페이스 요구 · 메시지 일반화)이라 planner 결정. Email · MCP 부터 같은 성질 |
| Warning 3 (리다이렉트 루프 중복) | 수정 | `eebf0286a` | `http-redirect.ts` `followRedirectsSafely` · `MAX_REDIRECT_HOPS` 로 노드 · 테스터 공유. 뮤턴트 R1~R5 RED(R1 은 핸들러 테스트에 fetch 횟수 단언을 더한 뒤 양쪽 RED, R3 은 리다이렉트 대상 DNS 차단 테스트 추가 뒤 RED) |
| Warning 4 (떠 있는 JSDoc) | 수정 | `eebf0286a` | 핸들러의 orphan 블록 삭제, CWE-209 · Activity API 근거를 `http-safety.ts` JSDoc 에 합침 |
| Warning 5 (Rationale 이 `plan/complete/` 인용) | 이 PR 의 마무리 커밋 | (마무리) | draft 를 `plan/complete/` 로 옮기는 커밋이 같은 PR 에 들어간다 — 머지 시점엔 dangling 아님 |
| Warning 6 (CHANGELOG) | 수정 | `eebf0286a` | «Unreleased» 항목 — 배포 뒤 틀린 자격증명 통합의 테스트 · rotate 가 실패할 수 있음 |
| Warning 7 (`testHttpConnection` 복잡도) | 수정 | `eebf0286a` | W3 추출로 리다이렉트 루프가 빠졌다 |
| Warning 8 (HTTP clamp 미검증) | 수정 | `eebf0286a` | 원인 포함 · 길이 제한 테스트. 뮤턴트 C1 · C2 RED |
| Warning 9 (400/422) | **트래커(기존 항목)** | — | 이미 등재(`--impl-prep` `13_21_00` WARNING 1). e2e 는 그래서 상태 코드를 단언하지 않는다 — 결정 전 한쪽으로 굳히지 않으려는 것 |
| INFO 2 (DB 대기 «10초») | 수정 | `eebf0286a` | 가이드 문구 — 연결 · `SELECT 1` 각각 10초, HTTP 는 전체 10초. spec §5.4 는 «연결 대기 10초» 라 모순 아님 |
| INFO 4 (공유 `BLOCKED` 객체) | 수정 | `eebf0286a` | 호출마다 새 객체 |
| INFO 6 (결과 코드 지역화) | 트래커 | — | `EMAIL_*` 부터 없던 클래스 — UI 턴에서 네 계열 한 번에 |
| INFO 1 · 3 · 5 · 7 · 8 | 조치 불요 | — | 1 · 7 은 기존 accepted risk · 기존 트래킹. 3 은 Critical 처분(동시 상한)이 함께 줄인다. 5 는 e2e 가 사설 host 를 항상 막는 구조라 의식적 트레이드오프(plan 기록). 8 은 순환이 타입 전용 import 에만 기대는 것 — 지금 런타임 순환은 없다 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-142316.log`)
- unit: PASS — backend 9,807 · frontend 6,597 외 (`_test_logs/unit-20260919-142407.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-142531.log`)
- e2e: 통과 — backend 353(`integration-connection-test` E 포함) · Playwright 51, 커밋 `eebf0286a` 기준 (`_test_logs/e2e-20260919-142900.log`)

## 보류·후속 항목

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재(커밋 `eebf0286a`):
- preview-test 가 인증된 사용자의 외부 연결 오라클이다 (Warning 2)
- 연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다 — 동시 상한 뒤에 남는 것 (Critical 1 잔여)
- 연결 테스트 결과 코드가 지역화 사전에 없다 (INFO 6)
- rotate 400 vs spec 422 (Warning 9 — 기존 항목, 같은 커밋 계열에서 등재)
