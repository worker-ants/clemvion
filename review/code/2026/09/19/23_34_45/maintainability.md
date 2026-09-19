# 유지보수성(Maintainability) 리뷰

## 검토 범위

`codebase/backend/src/modules/integrations/{connection-test-codes.ts,connection-test-codes.spec.ts,database-connection-tester.ts,database-connection-tester.spec.ts,database-driver-sockets.spec.ts,http-connection-tester.ts,integrations.service.ts,integrations.service.spec.ts}`,
`codebase/backend/src/nodes/integration/{cafe24/cafe24-api.client.ts,makeshop/makeshop-api.client.ts}` — 연결 테스트 결과 코드를 원시 문자열에서 `as const` 상수 + literal union 으로 좁히고, 테스트 빈칸 3건(mysql SSL 매핑, 드라이버 소켓 정리, rotate 404 분기)을 채운 변경.
`plan/in-progress/connection-test-codes-and-gaps.md`, `review/consistency/2026/09/19/23_02_33/*` 는 plan/리뷰 산출물(마크다운·JSON)로 함수·복잡도·중첩 등 코드 유지보수성 지표의 대상이 아니라 이번 관점에서는 평가 대상에서 제외했다(내용은 확인함 — 구조·서식에 이상 없음).

## 발견사항

- **[INFO]** 게이트 코드(`TestGateCode`)만 상수화 없이 리터럴 문자열로 남아 있어, 같은 파일 안에서 두 가지 스타일이 공존한다
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts` — `TestGateCode` 타입 정의(35-36번째 줄대), 사용처는 `codebase/backend/src/modules/integrations/integrations.service.ts` `testConnection` 내부 `'INTEGRATION_CREDENTIALS_UNREADABLE'` · `'INTEGRATION_INCOMPLETE'` 리터럴(965번째 줄대, 978번째 줄대)
  - 상세: 이번 변경의 핵심 동기가 "연결 테스트 결과 코드가 원시 문자열로 흩어져 있다"였는데, transport tester 셋(EMAIL·DB·HTTP)은 `CONNECTION_TEST_CODES.*` 런타임 상수로 좁혔지만, 같은 `IntegrationTestResultCode` union 을 구성하는 `TestGateCode` 두 값은 여전히 리터럴 문자열로 남아 상수화 대상에서 빠졌다. 타입 레벨 안전성(`tsc`)은 동일하게 확보되지만, "상수를 쓰는 코드"와 "리터럴을 쓰는 코드"가 같은 파일 내에 공존해 다음 사람이 왜 갈리는지 추가로 추론해야 한다.
  - 제안: 사소한 스타일 차이이며 오타 위험도 낮아(호출부가 1곳뿐) 지금 당장 상수화가 필수는 아니다. 다만 `TestGateCode` 정의부 주석에 "이 둘은 단일 호출부라 상수화하지 않았다"는 한 줄을 남기면, 다음 리뷰에서 동일 지적이 반복되는 것을 막을 수 있다.

- **[INFO]** `database-driver-sockets.spec.ts` 두 `it` 블록이 거의 동일한 `try { expect(...) } finally { ...destroy?.() }` 구조를 반복한다
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` — `pg Client` 테스트의 try/finally, `mysql2 promise Connection` 테스트의 try/finally(둘 다 diff 상 새로 추가된 블록)
  - 상세: 두 테스트가 소켓을 얻는 방법(pg 생성자 vs mysql2 core connection)만 다르고, "타입 단언 → destroy 여부 확인 → finally 에서 안전하게 정리"하는 이 패턴 자체는 문자 그대로 동일하다. 테스트 파일이라 실무적으로 큰 문제는 아니지만, 향후 정리 로직이 바뀌면 두 곳을 동시에 고쳐야 한다.
  - 제안: `const destroyed = (s: {destroy?: () => void} | undefined) => s?.destroy?.();` 같은 로컬 헬퍼로 finally 절만 추출하면 중복이 줄어든다. 파일이 2개 테스트뿐이라 지금 상태로 두어도 유지보수 비용은 낮다 — 선택 사항.

- **[INFO]** `connection-test-codes.ts` 의 `IntegrationTestResultCode` union 이 6개 소스(`TestGateCode`·`TransportTestCode`·`McpFailureCode`·`HttpCredentialsResult` 실패 코드·`Cafe24PingCode`·`MakeshopPingCode`)를 한 파일에 모으는 aggregator 라는 점에서 향후 7번째 producer 가 추가될 때 이 파일을 잊고 지나가기 쉬운 구조다
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts` — `IntegrationTestResultCode` 타입 정의부(47-53번째 줄대)
  - 상세: 다만 이 파일 자체의 JSDoc 이 "생산자마다 자기 어휘를 내보내고 여기서 모은다"고 명시하고 각 소스를 링크해 뒀고, `plan/in-progress/connection-test-codes-and-gaps.md` 의 실측 표에서 "일곱째 생산자를 타입을 좁히다가 컴파일러가 찾아냈다"고 스스로 기록해 뒀다 — 즉 이 aggregator 패턴이 갖는 리스크를 저자가 이미 인지하고 문서화한 상태다. 새 findings 라기보다 구조적 특성에 대한 참고로만 남긴다.
  - 제안: 조치 불필요. 다음에 새 producer 를 추가하는 사람이 이 파일의 JSDoc 목록을 갱신하는 관례만 지키면 된다.

## 요약

변경 규모가 작고(원시 문자열 → 상수/literal union 치환 + 테스트 3건 보강) 각 파일의 함수 길이·중첩 깊이·순환 복잡도에 새로 문제가 될 만한 지점은 없다. 새로 추가된 `connection-test-codes.ts` 는 6개 producer 의 코드 vocabulary 를 한곳에 모으면서 JSDoc 으로 "노드와 의미 공유" vs "이름만 근접"을 구분해 설명해 두어 가독성이 좋고, 상수화 작업 자체가 향후 오타·네임스페이스 혼동을 컴파일 타임에 잡아주므로 유지보수성에 순기여한다. 다만 게이트 코드 2건은 상수화 대상에서 빠져 파일 내 스타일이 완전히 통일되지는 않았고, 드라이버 소켓 정리 테스트에 소소한 구조적 중복이 남아 있다 — 둘 다 기능에 영향 없는 INFO 수준이다.

## 위험도

NONE
