# 요구사항(Requirement) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋 (2라운드)

## 검증 방법 메모

이번 라운드의 diff 는 (1) 1라운드에서 WARNING 2건을 조치한 실제 코드/테스트(`287aa2b89`) — 프롬프트의 파일 1~11 —
와 (2) 그 1라운드 리뷰·consistency-check 산출물 자체가 새 파일로 커밋된 것(`683023dfa`, 파일 13~31), (3) plan 문서(파일 12)로
구성된다. 프롬프트에서 컨텍스트 예산으로 잘린 `connection-test-codes.ts`·`integrations.service.ts`·
`integrations.service.spec.ts`·`cafe24-api.client.ts`·`makeshop-api.client.ts`·`makeshop-api.client.spec.ts`·
`database-connection-tester.ts`·`http-connection-tester.ts` 는 저장소에서 `Read`/`grep` 으로 직접 열람해 실제 런타임 분기와
diff 를 1:1 대조했다. 가설 검증을 위해 저장소 파일을 뮤테이션하지 않았다(1라운드 requirement 리뷰가 이미 `@ts-expect-error` 강제를
`tsc` 로 재현·원복까지 완료해 둔 상태라 재검증 없이도 결론이 바뀌지 않음을 확인했다) — `git status --short` 로 이 세션의 저장소
변경이 없음을 재확인.

## 1라운드 WARNING 조치 검증 (재현 확인)

- **W1 (MakeShop `pingConnection` 런타임 테스트 0건)** → `makeshop-api.client.spec.ts` 에 추가된 4개 테스트(200 성공·
  `INTEGRATION_INCOMPLETE`·`MAKESHOP_AUTH_FAILED`(403)·`MAKESHOP_TRANSPORT_FAILED`)를 실제 `makeshop-api.client.ts`
  `pingConnection`/`rawPing`/`mapPingError` 본문과 줄 단위로 대조했다 — 403 분기가 `refreshAccessToken`/`markAuthFailed`
  를 호출하지 않고 즉시 반환함(코드 342~348행)이 테스트 주석 "갱신 없이 · 상태 격하 없이"와 정확히 일치하고, 네트워크 실패는
  `rawPing` 의 `kind === 'transport'` 분기를 통해 `MAKESHOP_TRANSPORT_FAILED` 로 나간다. 조치 정확함.
- **W2 (타입 계약이 게이트 무리 누락 + 런타임 미검증)** → `connection-test-codes.spec.ts` 의 `accepted` 배열에
  `INTEGRATION_CREDENTIALS_UNREADABLE` 이 추가돼 6개 부분 union 전원이 최소 1개씩 커버됐고, `integrations.service.spec.ts`
  에 추가된 신규 테스트가 `credentials: { __unreadable: true }` 를 실제 센티널 키(`services/credentials-transformer.ts`
  `UNREADABLE_KEY = '__unreadable'`)와 정확히 일치시켜 `isUnreadableCredentials` 분기를 겨냥한다. `testConnection`
  본문(957~995행)을 확인한 결과 이 분기가 `entityTesters` 조회보다 먼저 실행되므로 `entityProbe` 가 호출되지 않는다는
  단언도 실제 코드 순서와 일치한다. 조치 정확함.

## 발견사항

- **[INFO]** spec §5.3 "결과:" 목록·§14.1 vocabulary 표가 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/
  `INTEGRATION_AUTH_UNSUPPORTED`(공유 `resolveHttpCredentials` 경로) 반환 가능성을 여전히 누락한다.
  - 위치: `spec/2-navigation/4-integration.md` §5.3(453~485행), §14.1(1100~1122행) — 두 섹션 모두 직접 `Read` 로 재확인.
  - 상세: 코드(`connection-test-codes.ts` 의 `Extract<HttpCredentialsResult, { ok: false }>['code']`)는 실제 반환값과
    정확히 일치한다 — 회색지대 아님, 코드가 옳고 spec 서술만 비어 있는 기존 갭이다. 이번 PR 이 만든 것이 아니라 이번
    developer 세션의 `--impl-prep`(`review/consistency/2026/09/19/23_02_33/cross_spec.md`)에서 이미 WARNING 으로 잡혀
    "별도 planner 턴" 으로 명시적으로 인계됐고, `plan/in-progress/connection-test-codes-and-gaps.md` 체크리스트
    항목 (1)에도 그대로 남아 있다. 1라운드 requirement/documentation 리뷰가 이미 동일하게 INFO 로 기록해 뒀다 — 재조사
    결과 달라진 것 없어 그대로 유지한다.
  - 제안: 조치 불필요(이미 등재, developer 권한 밖). planner 턴에서 §5.3 결과 목록 끝과 §14.1 표에 두 코드를 HTTP 연결
    테스트 반환 가능 코드로 명시 추가.

- **[INFO]** MakeShop 403 처리(§5.9 → §5.8 "동일" 위임)와 실제 코드의 세분화 차이는 스펙 위반이 아니라 이미 문서화된
  비대칭.
  - 위치: `spec/2-navigation/4-integration.md` §5.9(696행 "401 자동 회복·403 처리·transport 카운터 제외는 §5.8 정책
    동일"), `spec/4-nodes/4-integration/5-makeshop.md:181`("현재 구현은 403/401 모두 `auth_failed` 로 격하한다 —
    `insufficient_scope` 세분 전이는 cafe24 한정이며 makeshop 은 미구현").
  - 상세: Cafe24 는 403 을 `CAFE24_INSUFFICIENT_SCOPE` 로 세분하지만 MakeShop 은 `MAKESHOP_AUTH_FAILED` 하나로 묶는다
    (`makeshop-api.client.ts` `MakeshopPingCode` 에 별도 "insufficient scope" 멤버 없음) — 코드와
    `5-makeshop.md:181` 의 명시적 서술이 정확히 일치하며, `4-integration.md` §5.9 의 "§5.8 정책 동일"은 상태 격하
    유무(둘 다 즉시 격하하지 않음)를 가리키는 것으로 코드 이름 자체의 동일성을 주장하지 않는다. 불일치 아님.
  - 제안: 조치 불필요.

## 관점별 확인 결과

1. **기능 완전성** — 순수 타입 리팩터(런타임 동작 불변) + 1라운드 WARNING 2건에 대한 테스트 보강(MakeShop
   `pingConnection` 3분기 + 게이트 코드 타입/런타임 커버리지). plan 의 "할 것" 3항목 + RESOLUTION.md 의 조치 항목과
   1:1 대응하며 실측으로 확인했다.
2. **엣지 케이스** — MakeShop 403(즉시, 갱신·격하 없음) vs 401(갱신 후 재시도, 재실패 시 격하) 두 경로가 모두
   `dataSource.transaction`/`repo.update` 호출 여부까지 테스트로 구분됐다. 자격증명 누락(`INTEGRATION_INCOMPLETE`,
   fetch 호출 없음)도 고정됐다.
3. **TODO/FIXME** — 없음.
4. **의도와 구현 간 괴리** — 없음. `TestGateCode` 의 "쓰는 곳이 한 함수뿐" 이라는 JSDoc 주장은 `testConnection` 의
   965·978행 두 리터럴을 가리키는 것으로 확인(`IntegrationCredentialsUnreadableError`, 392행의 동일 문자열은
   execution-engine 예외 클래스의 별도 code 필드이며 `IntegrationTestResult.code` 유니온과 무관 — 괴리 아님).
5. **에러 시나리오** — 변경 없음(리팩터) + 신규 테스트가 기존 미검증 에러 경로(rotate 삭제 레이스 404, mysql SSL
   `require` 매핑, MakeShop 세 실패 분기)를 정확히 고정.
6. **데이터 유효성** — 해당 없음(타입 좁히기, 런타임 검증 로직 변경 없음).
7. **비즈니스 로직** — DB·HTTP·Email 세 producer 전량이 `CONNECTION_TEST_CODES.*` 로 치환됐고 잔여 raw 리터럴 없음을
   grep 으로 재확인. Cafe24(4종)·MakeShop(3종) ping 코드도 실제 반환 지점과 전수 대조 일치.
8. **반환값** — 모든 실패 분기가 `IntegrationTestResultCode` 부분집합을 반환한다. `testConnection` 의 게이트 두 분기
   (unreadable → 962행, pending_install → 975행)와 테스터 위임(988·990행) 모두 값을 빠짐없이 반환하며 falls-through
   경로 없음을 확인.
9. **spec fidelity** — §5.3~§5.5(453~524행)·§9.1(814행 pending_install 가드)·§14.1(1100~1122행) vocabulary 표를
   line-level 로 재대조 — 9개 transport 코드 전부와 원인 서술이 코드와 일치. 유일한 갭은 위 INFO 항목(HTTP
   `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` spec 서술 누락)이며 코드 결함이 아닌 기존 spec 공백으로,
   이미 별도 트래커에 등재돼 재차 격상하지 않는다.

## 요약

이번 2라운드 diff 는 1라운드에서 지적된 WARNING 2건(MakeShop `pingConnection` 런타임 테스트 부재, 타입 계약 테스트의
게이트 코드 무리 누락 + 그 런타임 분기 미검증)에 대한 조치(`287aa2b89`)와, 그 1라운드 리뷰·consistency-check 산출물이
저장소에 커밋된 것(`683023dfa`)으로 구성된다. 조치된 테스트를 실제 프로덕션 코드(`makeshop-api.client.ts`
`pingConnection`/`mapPingError`, `integrations.service.ts` `testConnection`)와 줄 단위로 재대조한 결과 두 조치 모두
정확하다 — 테스트가 주장하는 분기·부작용 부재(갱신 없음·상태 격하 없음·entityProbe 미호출)가 실제 코드 흐름과 일치한다.
spec(`2-navigation/4-integration.md` §5.3~§5.5, §9.1, §14.1, `5-makeshop.md` §"MAKESHOP_AUTH_FAILED")과의 line-level
대조에서도 새 타입·상수·테스트 주장이 spec 본문과 어긋나지 않음을 확인했다. 유일하게 남는 항목은 이전부터 추적 중인
spec 공백(HTTP 게이트 코드 2종의 §5.3/§14.1 미기재, INFO)뿐이며 이번 PR 이 만든 결함이 아니다. TODO/FIXME, 반환값 누락,
비즈니스 로직 불일치, CRITICAL/WARNING 급 요구사항 결함은 발견되지 않았다.

## 위험도

NONE
