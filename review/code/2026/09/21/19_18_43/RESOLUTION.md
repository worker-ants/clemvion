# RESOLUTION — 19_18_43 (라운드 4, 수렴)

**Critical 0 · Warning 0.** 착수 전 선언한 정지 규칙(«Critical·Warning 0 인 라운드, 또는
`codebase/**` 수정 0 인 라운드»)의 **첫째 절**로 수렴했다.

Warning 추이: **4 → 3 → 2 → 0**. 심각도도 함께 내려갔다 — 라운드 1 은 감사 중복 인접
동시성 주장(W4)과 CHANGELOG 누락, 라운드 2 는 테스트 판별력, 라운드 3 은 주석 속 줄 번호,
라운드 4 는 없음.

## 조치 항목

Warning 0 이라 조치 항목 없음. 이전 세 라운드의 WARNING 6건이 전부 해소됐음을 9개 reviewer 가
독립적으로 재확인했다.

| 라운드 | WARNING | 해소 |
|---|---|---|
| `18_03_54` | CHANGELOG 누락 · JSDoc `@throws` · 헬퍼 미추출 · **«다른 credential 동시삭제 시 `remaining` 오판»** | 앞의 셋은 조치, 마지막은 **순서 논증 + e2e 캐너리로 반증** |
| `18_31_57` | 캐너리의 공허성 가드 부재 · 트래커 줄 번호 stale · CHANGELOG 취소선 비대칭 | 전부 조치 — 가드는 **문구를 낮추는 대신 테스트를 강화**하는 쪽으로 |
| `18_58_48` | JSDoc 의 새 줄 번호 · plan 의 stale 줄 번호 | 전부 메서드명 기반으로 교체 |

## 이번 라운드 INFO 중 종결 단계에서 처리할 것

- **INFO 6** — 트래커 체크박스·«해소» 마커·plan 이동·frontmatter `status` 가 아직 미반영이라,
  CHANGELOG 의 «아홉 자리로 종료» 선언과 시점이 어긋난다. **종결 커밋에서 네 가지를 함께**
  처리한다(이 저장소가 반복해 놓친 «체크와 `complete/` 이동은 한 동작» 이다).
- **INFO 7** — 트래커의 `webauthn.service.ts:532` 인용이 이 PR 편집으로 stale 해졌다.
  형제 항목들과 같은 관례(발견 시점 줄 번호 동결 + «해소» 각주)를 따르고 줄 번호는 갱신하지 않는다.

## 유예 — 근거와 함께

| INFO | 유예 사유 |
|---|---|
| 8 (`delete→count→update` 비트랜잭션 durability 창) | 이번 diff 가 만든 갭이 아니다. «서로 다른 credential 이중 삭제 시 둘 다 오판» 시나리오는 순서 논증 + e2e 캐너리로 **반증**됐고, 남은 것은 «delete 성공 후 크래시» 라는 **다른 축**이다. 라운드 1 W4 로 이미 추적 중이라 재등재하지 않는다 |
| 10 (`findOne → null` 분기 단위 미커버) | 선재 갭. 이번 PR 이 그 조건 구조를 바꾸지 않았다 |
| 11 (주석 분량 · e2e 오케스트레이션 중복 · 매직 넘버) | `plan` §0 결정 1 이 **전용 PR 에서 `raceUnderHeldLock()` 추출 + 상수화**로 이미 결정·등재했다 |
| 13 (`renameCredential` 의 무락 `findOne`+`save` lost-update) | 이 PR 의 축(«지우고 감사한다»)과 다른 결함 클래스다. 이번 diff 가 만들지 않았다 |
| 9 (정상 경로에서도 `finally` 가 `ROLLBACK` 재호출) | Postgres 가 끝난 트랜잭션의 ROLLBACK 을 에러 없이 처리하고 `.catch` 가 흡수한다. 형제 e2e 여덟과 동일 관례 |

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260921-190912.log`)
- unit  : 통과 (`_test_logs/unit-20260921-191002.log`)
- build : 통과 (`_test_logs/build-20260921-191112.log`, 백엔드 타입체크 ratchet 포함)
- e2e   : 통과 (378/378, `_test_logs/e2e-20260921-191354.log`)

## 보류·후속 항목

- `deleteCredential()` 트랜잭션 래핑 — 라운드 1 W4 추적. **착수 시 «삭제 중 신규 credential
  등록(INSERT)» 인터리빙도 시나리오에 넣을 것**(이번 라운드 INFO 8 의 추가 관찰).
  그리고 **그 작업은 이 PR 의 e2e 캐너리를 RED 로 만든다** — 캐너리의 순서 논증이 «트랜잭션이
  없다» 를 전제하기 때문이다. 그때 RED 는 회귀가 아니라 전제가 바뀌었다는 신호다.
- 동시성 e2e 공용 헬퍼(`raceUnderHeldLock()`) 추출 — 트래커 등재, 전용 PR.
- `WEBAUTHN_CREDENTIAL_NOT_FOUND` 401/404 혼용 + 카탈로그 미등재 + §1.11 «유일한 예외» 거짓 —
  planner 트랙 등재.
