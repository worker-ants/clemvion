# RESOLUTION — review/code/2026/09/19/15_30_04

수동 처리(main). 코드 처분은 커밋 `e6b98cd65`. 이 라운드의 리뷰 스냅숏은 `6bf7c026d` 였고, 그 사이 `48dfb2f0e`(rotate 재조회)가
들어왔다 — 리뷰가 관측한 «진행 중 편집» 이 그것이다(W8). 판정은 최종 코드 기준으로 했다.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Critical 1 (SSRF DNS 사전검사 → 슬롯 **영구** 점유) | **전제 반증 — 문서 정정** | `e6b98cd65` | 실측: backend 이미지와 같은 `node:24-alpine`(musl)에서 응답 없는 네임서버(`docker run --dns 192.0.2.1`)로 `dns.lookup` 은 5,006ms 뒤 `EAI_AGAIN`. 영구가 아니다 — Database 약 26초(가드 lookup 5 · 연결 10 · 쿼리 10 · 닫기 1), HTTP 약 20초에 슬롯을 놓는다. 제안된 JS 쪽 타임아웃은 스레드를 잡아 둔 채 슬롯만 먼저 놓아, 상한이 지키려던 스레드 수를 푼다 — 채택하지 않았다. 오독의 뿌리였던 상한 JSDoc «타임아웃이 없어» 를 실측값 · 상한 계산으로 바꿨다. 슬롯을 오래 쥐어 연결 테스트 기능만 느려지는 것(프로세스 전체는 아님)은 트래커 «동시 상한 뒤에 남는 것» 항목 |
| Warning 1 (a) 동시 rotate lost update | 트래커 | `e6b98cd65` | 버전 컬럼 · 409 설계가 필요하다(마이그레이션). 이 PR 전에도 같은 창 |
| Warning 1 (b) rotate 중 삭제 → 부분 `save` 가 INSERT | 수정 | `e6b98cd65` | `update({ id }, changes)` + 0행이면 404, 감사 · broadcast 없음. transformer 는 `update` 에도 걸림(TypeORM `UpdateQueryBuilder` → `preparePersistentValue`) — e2e E 가 암호문으로 확인 |
| Warning 2 (entity tester 재귀 교착) | 문서 | `e6b98cd65` | `registerEntityTester` 계약에 «연결 테스트 경로를 다시 부르지 말 것» |
| Warning 3 · 4 (preview-test 오라클 · 400/422) | 트래커(기존) | — | planner 결정 대기 |
| Warning 5 (드라이버 내부 구조 결합) | 수정 | `e6b98cd65` | `database-driver-sockets.spec.ts` — 모킹 없는 실제 pg · mysql2 객체로 `connection.stream.destroy` 존재를 고정. 드라이버를 올려 구조가 바뀌면 여기서 RED |
| Warning 6 («소켓을 못 찾음» 분기 미도달) | 수정 | `e6b98cd65` | 그 분기 테스트(경고 로그 · 결과 불변) |
| Warning 7 (`plan/complete/` 선인용) | 마무리 커밋 | (마무리) | 같은 PR 의 plan 이동 커밋이 경로를 유효하게 만든다 |
| Warning 8 (리뷰 중 편집 관측) | 조치 불요 | — | 스냅숏 이후 커밋 `48dfb2f0e` 였다. 다음 라운드가 최종 코드로 돈다 |
| SPEC-DRIFT 1 (§5.4) | 반영됨 | `975b1c3e5` | planner 커밋(`--spec` `review/consistency/2026/09/19/15_30_56` BLOCK: NO) |
| INFO 2 (재조회 null 이면 메모리 엔티티로 성공 응답) | 수정 | `e6b98cd65` | W1 (b) 와 함께 — 0행 · 재조회 null 모두 404 |
| INFO 그 밖 | 조치 불요 | — | 1(결과 코드 지역화)은 트래커. 비-`Error` throw 폴백 등 커버리지 제안은 이 PR 범위를 넓히지 않는다 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-155525.log`)
- unit: PASS (`_test_logs/unit-20260919-155613.log`). 첫 build 에서 타입체크 ratchet 이 새 spec 의 타입 오류(mysql2 타입 정의에 `PromiseConnection` 없음)를 잡아 `jest.requireActual` 로 고친 뒤 통과
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-155723.log`)
- e2e: 통과 — backend 353(`integration-connection-test` E 가 `update` 경로의 암호화 · 응답 = DB `updated_at` 확인) · Playwright 51, 커밋 `e6b98cd65` 기준 (`_test_logs/e2e-20260919-160003.log`)

## 보류·후속 항목

- 동시 rotate 두 건의 lost update (`plan/in-progress/spec-draft-nullable-notation-followups.md`)
