# 유지보수성(Maintainability) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋 (fresh review, 1라운드 조치 반영 후)

## 검토 범위

`codebase/backend/src/modules/integrations/{connection-test-codes.ts,connection-test-codes.spec.ts,database-connection-tester.ts,database-connection-tester.spec.ts,database-driver-sockets.spec.ts,http-connection-tester.ts,integrations.service.ts,integrations.service.spec.ts}`,
`codebase/backend/src/nodes/integration/{cafe24/cafe24-api.client.ts,makeshop/makeshop-api.client.spec.ts,makeshop/makeshop-api.client.ts}` — 연결 테스트 결과 코드를 원시 문자열에서 `as const` 상수 + literal union 으로 좁히고, 테스트 빈칸 3건(mysql SSL 매핑, 드라이버 소켓 정리, rotate 404 분기)을 채운 뒤, 1라운드 리뷰(`review/code/2026/09/19/23_34_45`)의 WARNING 2건(MakeShop `pingConnection` 런타임 테스트 0건, 타입 계약 테스트의 `TestGateCode` 누락)을 커밋 `287aa2b89`로 조치한 상태.

`plan/in-progress/connection-test-codes-and-gaps.md`, `review/code/2026/09/19/23_34_45/*`, `review/consistency/2026/09/19/23_02_33/*` 는 plan/리뷰 산출물(마크다운·JSON)로 함수·복잡도·중첩 등 코드 유지보수성 지표의 대상이 아니라 평가 대상에서 제외했다(내용은 확인함 — 1라운드 리뷰가 자신이 지적한 항목을 정확히 조치 표로 남겼고, `RESOLUTION.md`의 커밋 해시가 실제 커밋과 일치함을 `git log`로 대조).

프롬프트가 잘라낸 파일(`database-connection-tester.spec.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `integrations.service.spec.ts`, `integrations.service.ts`, `cafe24-api.client.ts`, `makeshop-api.client.spec.ts`, `makeshop-api.client.ts`)은 전부 `Read`로 직접 열어 전체 맥락에서 확인했다.

## 1라운드 조치분 재확인

- `makeshop-api.client.spec.ts`에 신설된 `describe('pingConnection (test-connection probe)')` 4건(200 성공·자격증명 누락·403·네트워크 실패) — 각 `it` 이름이 검증 내용과 정확히 대응하고, Cafe24 형제 테스트와 같은 패턴(리터럴 기대값, `호출 안 됨`류 부작용 부재 단언)을 따른다. 함수 길이·중첩 문제 없음.
- `connection-test-codes.spec.ts`의 `accepted` 배열에 `INTEGRATION_CREDENTIALS_UNREADABLE`가 추가돼 6개 부분 union 전원이 최소 1회 나열된다. `integrations.service.spec.ts`에 대응 런타임 분기(복호화 불가 → entity tester 미호출) 테스트가 추가됐다 — 기존 `describe('testConnection')` 블록의 다른 `it`과 동일한 준비(`makeIntegration`, `integrationRepo.findOne.mockResolvedValue`) 패턴을 그대로 따른다.
- 1라운드 INFO였던 "`TestGateCode`만 상수화 없이 리터럴로 남음"은 `connection-test-codes.ts`의 `TestGateCode` JSDoc에 "상수로 빼지 않는다 — 쓰는 곳이 한 함수뿐이고, 둘 다 통합 전반의 코드라 테스터 어휘가 아니다" 근거가 실제로 들어가 있음을 코드에서 확인 — 재기재하지 않는다.

## 발견사항

- **[INFO]** `database-driver-sockets.spec.ts` 두 `it` 블록이 거의 동일한 `try { expect(...) } finally { ...destroy?.() }` 구조를 반복한다 (1라운드에서 이미 지적·"조치 없음" 처분된 항목, 처분 근거를 코드로 재확인)
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` — `pg Client는 connection.stream에 소켓을 둔다` 테스트의 try/finally, `mysql2 promise Connection은 connection.stream에 소켓을 둔다` 테스트의 try/finally
  - 상세: 두 테스트가 소켓을 얻는 방법(pg 생성자 vs mysql2 core connection)만 다르고, `try { expect(typeof stream?.destroy).toBe('function') } finally { stream?.destroy?.() }` 골격은 문자 그대로 동일하다. 다만 두 블록에 붙은 주석은 서로 다른 이유를 설명한다 — pg 쪽은 "생성만으로 연결하지 않는다", mysql2 쪽은 "코어는 생성과 동시에 연결을 시작하므로 unit에서 예외적으로 실제 소켓을 연다"는 드라이버별 사정이라, 공통 헬퍼로 묶으면 그 차이가 흐려진다는 1라운드 RESOLUTION의 판단은 실측(현재 코드)과 일치한다.
  - 제안: 조치 불필요 유지. 헬퍼 추출 시 이유가 흐려진다는 기존 판단이 타당하므로, 굳이 통합하려면 `finally` 절만 지역 함수(`const destroySocket = (s?: { destroy?: () => void }) => s?.destroy?.();`)로 뽑고 주석은 각 `it`에 남기는 절충안 정도 — 선택 사항.

- **[INFO]** `IntegrationTestResultCode`가 6개 producer(`TestGateCode`·`TransportTestCode`·`McpFailureCode`·`HttpCredentialsResult` 실패 코드·`Cafe24PingCode`·`MakeshopPingCode`)를 한 파일에 모으는 aggregator라, 7번째 producer가 생기면 이 파일을 잊고 지나가기 쉬운 구조 (1라운드와 동일 관찰, 재확인만)
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts` — `IntegrationTestResultCode` 타입 정의부(파일 끝 6줄)
  - 상세: JSDoc이 "생산자마다 자기 어휘를 내보내고 여기서 모은다"고 각 소스를 `{@link}`로 명시해 뒀고, `plan/in-progress/connection-test-codes-and-gaps.md`의 실측 표가 "타입을 좁히자 컴파일러가 일곱째 생산자(게이트 코드)를 찾아냈다"를 스스로 기록해 뒀다 — 좁힌 유니온이 위반 시 컴파일 에러로 드러나는 구조라, 실제 리스크는 낮다.
  - 제안: 조치 불필요.

새로 검토한 항목(`Cafe24PingCode`/`MakeshopPingCode`, `IntegrationTestResult.code` 타입 좁히기, `CONNECTION_TEST_CODES` 상수, 신규 SSL `it.each`)에서는 함수 길이·중첩 깊이·순환 복잡도·매직 넘버·네이밍 컨벤션 위반을 발견하지 못했다. `mapPingError`가 Cafe24/MakeShop 양쪽에 구조가 유사하게 존재하는 것은 이 저장소에서 이미 "의도된 미러 구조"로 결정된 패턴이라 중복 지적 대상이 아니다.

## 요약

1라운드에서 지적된 WARNING 2건(테스트 커버리지 갭)은 이번 조치 커밋(`287aa2b89`)에서 유지보수성 문제 없이 기존 코드베이스 패턴(리터럴 기대값, `it.each`, Cafe24/MakeShop 대칭 테스트)을 그대로 따라 해소됐고, 1라운드 INFO였던 `TestGateCode` 비상수화 사유도 실제 주석으로 반영됐다. 남은 두 INFO(드라이버 소켓 테스트 중복, aggregator 구조)는 모두 1라운드에서 이미 "조치 없음"으로 다뤄졌고 그 판단 근거가 현재 코드와 일치함을 재확인했을 뿐, 새로 발견된 문제는 아니다. 이번 diff 전체에서 함수 길이·중첩·순환 복잡도·매직 넘버 관점의 새 결함은 없다.

## 위험도

NONE
