# RESOLUTION — `review/code/2026/09/26/11_53_46` (1라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 12. forced 6명 전원 리포트 확보(`forced_missing` 없음).
정지 규칙(결과 보기 전 선언): «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건». 이 라운드는 codebase 를 고쳤으므로
**2라운드를 돈다**.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 서열 밖 문자열 방어(`Object.hasOwn`)를 실행하는 테스트가 없다 | 대조군에 `@Roles('editor', 'constructor')` 라우트(프로토타입 키 — 캐스트로만 만들 수 있다) + 모델 단언 `['NOT_A_MEMBER']`. 방어를 지운 뮤턴트 F12 가 KILLED 인지 실측했는데, 예측한 «가드 코드 모델» 케이스는 **살아 있었다** — jest `toEqual` 이 배열의 `undefined` 원소를 무시해 `['NOT_A_MEMBER', undefined]` 를 통과시켰다. 모델 단언 12개를 `toStrictEqual` 로 바꿔 재실측 — 예측 케이스 사망 | `37aff2a37` · `cb8999dfb` |
| W2 복합 403 문장이 두 파일에서 각 두 번씩 복제 | `workspaces` 삭제 · 이양 → `FORBIDDEN_OWNER_OR_PERSONAL`, `workflow-test-datasets` 수정 · 삭제 → `FORBIDDEN_EDITOR_OR_NOT_OWNER` 모듈 상수 | `37aff2a37` |
| INFO1 모델 캐너리 대조군에 가장 흔한 실제 모양(`@Roles` + `@WorkspaceParam`)이 없다 | 대조군에 `pathAdmin`(`@Roles('admin')` + `@WorkspaceParam('id')`) — 캐너리가 실제 `RolesGuard` 와 대조 | `37aff2a37` |
| INFO4 `lowestRequiredRole([])` 가 던지는 것을 고정하지 않았다 | `TypeError` 단언 추가 | `37aff2a37` |
| INFO5 매개변수가 `string[]` 인 이유가 JSDoc 에 없다 | «가드 · 검사 모두 reflection 메타데이터(타입이 지워진 문자열)를 넘긴다» 한 문장 | `37aff2a37` |
| INFO2 `forbiddenForRole` 이 단일 역할만 받는다(다중 역할 문턱은 호출자 책임) | 이 라운드 미조치 — 저장소 전 라우트가 단일 역할이고 오용은 가드 대조군 `multiDescribedAsAdmin` 이 잡는다. API 를 배열로 넓히는 것은 쓰는 자리가 생길 때 | — |
| INFO3 문구 표(`ROLE_SHORTFALL`)와 런타임 메시지(`ROLE_REQUIRED.message`)가 따로 | 조치 불요(리뷰어 판정 — 의도된 톤 분리). 코드(`.code`)는 단일 출처다 | — |
| INFO6~INFO12 | 조치 불요(기존 관례 · 정상 확인 · 범위 밖 기록) | — |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260926-120931.log`)
- unit: PASS (`_test_logs/unit-20260926-121030.log`)
- build: PASS (`_test_logs/build-20260926-121150.log`)
- e2e: 통과 — 409건 (`_test_logs/e2e-20260926-121435.log`)
