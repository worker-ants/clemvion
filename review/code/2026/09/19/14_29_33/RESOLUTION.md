# RESOLUTION — review/code/2026/09/19/14_29_33

수동 처리(main). 처분은 커밋 `edd468476` 에 모았다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Critical 1 (MySQL 닫기 hang → 동시 상한 슬롯 영구 점유) | 수정 — **범위를 pg 까지 넓혀** | `edd468476` | 드라이버 소스로 확인: mysql2 3.23.2 는 쿼리 타임아웃 뒤 Query 커맨드를 큐에 남기고 `end()` 의 Quit 이 그 뒤에 선다. 리뷰는 pg 를 안전하다고 했으나 **성공 뒤** pg `end()` 는 Terminate 뒤 서버가 소켓을 닫기를 기다린다 — 종료를 무시하는 서버면 같은 결함. `closeWithin` 으로 닫기를 1초까지만 기다리고 넘기면 `connection.stream` 파괴. 가짜 타이머 테스트 둘(mysql 쿼리 타임아웃 · pg 성공 뒤 종료 무시), 뮤턴트 D1(파괴 제거) · D2(무한 대기) RED |
| Warning 1 (`resolveHttpCredentials` 누락 분기 미검증) | 수정 | `edd468476` | `http-credentials.spec.ts` — `||` 항마다 따로(api_key 셋 · basic 둘), 미지원 방식, base_url · default_headers 정규화 |
| Warning 2 (`plan/complete/` 선인용) | 이 PR 의 마무리 커밋 | (마무리) | 두 plan 을 같은 PR 에서 `plan/complete/` 로 옮긴다 — 머지 시점엔 유효 |
| Warning 3 (entity tester 가 상한 밖) | **위협 불성립 — 문서만** | `edd468476` | 호스트가 `*.cafe24api.com`(`cafe24-api.client.ts` 가 `endsWith('.cafe24api.com')` 검사) · `connect.makeshop.co.kr`(`MAKESHOP_API_HOST` 고정)이라 사용자가 응답하지 않는 DNS 서버를 고를 수 없다. 상한 JSDoc 에 범위를 적었다 |
| Warning 4 (preview-test 오라클) | 트래커(1라운드 등재) | — | 리뷰도 «신규 결함 아님, open 상태 재확인» 으로 판정 |
| INFO 8 (rotate Swagger) | 수정 | `edd468476` | 새 값의 연결 테스트 선행 · 실패 코드 명시 |
| INFO 9 (rotate 가 세부 code 를 버림) | 트래커(400/422 항목에 묶음) | `edd468476` | 같은 응답 형태 결정이다 |
| INFO 12 (`clampMessage` 폴백 미검증) | 수정 | `edd468476` | `clamp-message.spec.ts` |
| INFO 1 · 2 · 3 · 5 · 6 · 7 · 10 · 11 · 13 · 14 · 15 | 조치 불요 | — | 1 · 2 · 11 은 트래커에 이미 있다. 3(http base_url)은 노드와 같은 설계 — 플랫폼 결정. 5 · 6 은 이 PR 이전부터의 rotate 동작. 7 은 spec 이 «연결 대기 10초» 만 말하고 쿼리 상한은 구현이 더한 것이라 모순이 아니다. 10 은 기존 DTO 관례. 13 은 이름 접미 차이 — 새 상수를 늘리지 않는다. 14 는 의도(1라운드 Critical 처분). 15 는 스코프 이탈 아님으로 판정됨. 4(부분 save 의 추가 SELECT)는 `update()` 로 바꾸면 transformer 적용을 다시 증명해야 해서 두었다 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-145728.log`)
- unit: PASS — backend 9,821 · frontend 6,597 외 (`_test_logs/unit-20260919-145824.log`). 직전 한 번은 무관한 suite(`dto-class-name-collision`)의 jest 워커 SIGSEGV 로 실패, 재실행 통과
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-145939.log`)
- e2e: 통과 — backend 353 · Playwright 51, 커밋 `edd468476` 기준 (`_test_logs/e2e-20260919-150237.log`)

## 보류·후속 항목

- rotate 400 vs 422 항목에 «세부 code 를 details 로 실을지» 를 같은 결정으로 추가 (`plan/in-progress/spec-draft-nullable-notation-followups.md`)
