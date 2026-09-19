# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — SSRF DNS 사전검사(`assertSafeOutboundHostResolved`)에 타임아웃이 없어, 이번 PR 이 새로 도입한 전역 동시 상한(`pLimit(2)`)의 슬롯 2개를 영구히 고갈시켜 전체 연결 테스트 기능(모든 workspace)을 마비시킬 수 있다(concurrency reviewer). 그 외 데이터 정합성(MEDIUM, rotate 낙관적 잠금 부재)과 여러 LOW 급 이슈가 있으나, 이미 대부분 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 결정 대기로 투명하게 등재돼 있다.

**forced 화이트리스트 이행 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

**프로세스 관측 사항 (코드 결함 아님)**: 리뷰 진행 중 워킹트리가 병렬 세션에 의해 커밋 없이 계속 편집되는 것을 6개 reviewer(performance·requirement·side_effect·testing·database·api_contract)가 각자 독립적으로 관측·보고했다 — 공통적으로 `integrations.service.ts`/`integrations.service.spec.ts` 의 `rotate()` 가 "메모리 값 반환"에서 "저장 후 재조회 반환" 방식으로 바뀌는 중이었다. 어떤 reviewer 도 Write/Edit 을 사용하지 않았음을 각자 확인했다(읽기 전용 도구만 사용). api_contract reviewer 는 이 변경이 최종적으로 커밋된 것도 확인했고 내용상 회귀가 아니라 개선(응답-DB 정합성 향상)임을 재확인했다. 다만 이는 **본 리뷰 라운드가 참조한 diff 스냅숏이 이미 부분적으로 stale 함**을 의미하므로, `rotate()` 관련 판정(아래 database WARNING #1 등)은 다음 라운드에서 최신 커밋 기준 재검증이 필요하다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | SSRF DNS 사전검사(`assertSafeOutboundHostResolved`, 내부 `dns.lookup`)에 타임아웃이 없다. Database/HTTP 테스터 모두 `connect`/`fetch` 자체 타임아웃(10초)이 걸리기 **이전** 단계에서 이 호출을 거치며, 이 대기가 전역 `pLimit(2)` 세마포어 안에서 일어난다. 응답 없는 DNS(blackhole)를 겨냥한 단 2건의 요청만으로 슬롯 2개가 영구 점유되어, 프로세스 재시작 전까지 **모든 workspace** 의 `preview-test`·`:id/test`·`rotate`(entity tester 포함)가 멈춘다. 기존에 같은 유형의 버그(`closeWithin` 소켓 close 무한대기)는 이미 타이머로 고쳤으나, 이 SSRF 사전검사 단계만 그 불변식(모든 대기 지점은 유계)에서 빠져 있다 — 설계적 트레이드오프가 아니라 누락으로 보인다. | `database-connection-tester.ts:137`, `http-connection-tester.ts:115`, `http-request/http-redirect.ts:27`, `integrations.service.ts:410-411,976,1551` | `assertSafeOutboundHostResolved` 호출을 `closeWithin` 과 같은 `Promise.race`+타이머 패턴으로 감싸 자체 타임아웃 부여. 타임아웃 시 fail-open(성공 처리) 하면 SSRF 완화 의도가 무너지므로 `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 류로 fail-closed 처리하고 슬롯을 반드시 반환하게 할 것. 배포 전 수정 권장. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database | `rotate()` 는 ①행 읽기 → ②merge → ③실제 DB/HTTP 접속(최대 10~20초, 게다가 이번 PR 의 전역 `pLimit(2)` 대기까지 겹칠 수 있음) → ④partial `save()` 순서인데, `Integration` 엔티티에 낙관적 잠금(`@VersionColumn` 등)이 없다. (a) 동시 `rotate()` 두 건이 같은 스냅숏에서 merge 해 나중 저장이 먼저 통과한 값을 조용히 덮어쓸 수 있다(lost update, 양쪽 다 성공 응답). (b) `dispatchTest` 대기 중 다른 요청이 같은 통합을 `remove()` 하면 partial `save()` 가 NOT NULL 제약 위반으로 정체불명의 500 을 낼 수 있다(404 대신). 두 경쟁 모두 테스트 커버리지 없음. **주의**: 이 판정은 리뷰 스냅숏 기준이며, 상단 "프로세스 관측 사항"대로 `rotate()` 가 그 사이 재조회 방식으로 바뀌었으나 이는 읽기 방식 변경일 뿐 낙관적 잠금 부재 자체는 해소되지 않았을 가능성이 높다 — 다음 라운드 재확인 필요. | `integrations.service.ts:1065-1146`(`rotate()`) | 최소한 `save()` 직전 조건부 UPDATE(`WHERE id=:id AND updated_at=:expected`) 또는 `@VersionColumn` 으로 낙관적 잠금 도입, 실패 시 409 안내. `remove()` 경쟁은 `save()` 를 try/catch 해 NOT NULL 위반을 `RESOURCE_NOT_FOUND` 로 변환. 동시 rotate/삭제-중-rotate 재현 테스트 선행 권장. |
| 2 | concurrency | `registerEntityTester` 로 등록되는 콜백(cafe24·makeshop `pingConnection`)이 이번 PR 로 전역 `connectionTestLimit`(`pLimit(2)`) 안에서 실행되도록 바뀌었다. 현재 등록된 tester 는 안전하지만, 향후 어떤 tester 가 내부적으로 같은 `connectionTestLimit` 을 타는 경로(`testConnection`/`previewTest`/`dispatchTest`)를 재귀 호출하면 자기 데드락이 될 수 있다 — `registerEntityTester` 문서에 이 제약이 명시돼 있지 않음. | `integrations.service.ts:976`, `registerEntityTester` calling contract(~:460-465) | `registerEntityTester` 문서에 "등록 tester 는 연결 테스트 경로를 재귀 호출 금지"를 명시하거나, 재진입 감지 구조 도입. |
| 3 | security | `preview-test` 가 (JWT 인증만 요구, 워크스페이스·역할 검사 없이 분당 20회 제한만 걸린 채) 로그인한 아무 사용자에게나 임의 공개 host:port 에 대해 실제 접속 시도 결과(연결 성공/인증 거부/타임아웃/TLS 실패, 원문에 가까운 실패 메시지)를 구분해 알려주는 오라클이며, 이번 PR 로 그 대상이 Database·HTTP 까지 확장됐다. SSRF 가드가 사설/loopback 대역은 막지만 외부 인터넷 자원 정찰에는 노출된다. | `integrations.controller.ts:158-178`(`previewTest`), `integrations.service.ts:1533-1556`(`dispatchTest`) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 결정 대기로 등재됨(워크스페이스 컨텍스트 요구 / 메시지 일반화 / 수용 위험으로 spec Rationale화 중 택1). 추가 코드 조치 불요 — planner 턴에서 결정. |
| 4 | requirement / api_contract | `rotate()` 의 자격증명 거부가 `BadRequestException`(400)을 던지는데 `spec/2-navigation/4-integration.md §9.4` 는 422 를 명시해 spec-코드 불일치가 있고, `spec/5-system/11-mcp-client.md`(400 실측 서술)와도 다른 문서끼리 어긋난다. 이번 PR 로 Database·HTTP 에 실제 연결 테스트가 붙으면서 이 경로(rotate 자격증명 거부)가 실무에서 훨씬 자주 트리거되게 됐다. | `integrations.service.ts` `rotate()` 내 `INTEGRATION_TEST_FAILED` throw, `spec/2-navigation/4-integration.md §9.4` | 이미 트래커(`spec-draft-nullable-notation-followups.md`)에 등재. 코드 수정 불요 — planner 턴에서 400/422 통일 및 세 문서 동시 갱신. |
| 5 | architecture / database | DB 커넥션 종료 강제 파괴 폴백이 `pg`/`mysql2` 의 비공개 내부 구조(`connection.stream`)에 `as unknown as HasSocket` 캐스팅으로 직접 접근한다. 두 드라이버의 암묵적 계약에 결합돼 있어 마이너 업그레이드 한 번으로 폴백이 조용히 무력화될 수 있다(결과 판정에는 영향 없음, `logger.warn` 만 남음). | `database-connection-tester.ts:25-26,34-61,115`(`closeWithin`, `HasSocket`) | 드라이버 버전 pin 또는, 이 가정이 깨졌을 때 알아챌 수 있는 회귀 테스트를 드라이버 업그레이드 CI 경로에 추가. |
| 6 | testing | `closeWithin` 의 "드라이버 소켓을 못 찾음" fallback 분기(`else` + 두 번째 `logger.warn`)가 어떤 테스트로도 도달하지 않는다 — 실측 `jest --coverage` 로 확인(branch coverage 81.81%, uncovered line #58). 테스트의 pg/mysql mock 이 항상 `connection.stream.destroy` 를 정의해 두어 이 방어 로그 분기가 뮤테이션에 걸리지 않는 상태다(결과값엔 영향 없음). | `database-connection-tester.ts:56-61` | pg/mysql 각 1건씩 `connection`(또는 `connection.stream`) 이 없는 mock 으로 닫기-초과 시나리오를 재현하는 테스트 추가. |
| 7 | documentation | `plan/in-progress/spec-draft-nullable-notation-followups.md` 세 곳(3594, 4761, 4788행)이 아직 `plan/in-progress/` 에 있는 두 plan(`integration-db-http-testers.md`, `spec-draft-integration-connection-tests.md`)을 `plan/complete/` 경로로 전방 참조(dangling)한다 — 실제 파일은 `plan/complete/` 에 존재하지 않고(확인함), 원본 plan 의 체크리스트도 4개 항목이 미완료다. | `plan/in-progress/spec-draft-nullable-notation-followups.md:3594,4761,4788` | 두 plan 이 실제로 `complete/` 로 이동하는 커밋에서 참조 경로 확정, 그 전까지는 `plan/in-progress/...` 로 인용하거나 "완료 예정" 표현 사용. |
| 8 | side_effect | 리뷰 세션 진행 중 `integrations.service.ts`/`integrations.service.spec.ts`/`spec-draft-nullable-notation-followups.md` 가 커밋 없이 계속 수정되는 것을 다수 reviewer 가 관측함(코드 결함 아님, 리뷰 프로세스 이슈). 프롬프트가 준 diff 는 이미 stale 하며 `rotate()` 관련 판정은 재검증 대상이다. | `integrations.service.ts`(`rotate()`), `integrations.service.spec.ts` | 이 편집이 끝나고 커밋된 뒤 다음 라운드 code-review fan-out 을 다시 돌릴 것. |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] Database 연결 테스트의 spec 서술 "연결 대기는 10초"가 실제 2단계(연결 10초 + 쿼리 10초, 독립적으로 각각 적용, worst-case 총 ~20초+close grace 1초) 타임아웃을 가리지 않는다. 구현(`database-connection-tester.ts`)·`CHANGELOG.md`("연결 · 쿼리 각 10초")·사용자 가이드 ko/en("각각 최대 10초")·유닛 테스트 제목 모두 "각각"을 명시적으로 일치시키고 있어, spec 본문 문장만 이 뉘앙스를 빠뜨린 전형적 spec-drift다(HTTP §5.3 의 "대기는 10초"는 리다이렉트 체인 전체를 포함한 단일 예산이라 대칭이 아님). | `spec/2-navigation/4-integration.md §5.4` "연결 대기는 10초" 문장 | 코드는 유지. spec 문장을 "연결·쿼리 대기는 각각 10초(합쳐 최대 20초)"로 갱신해 HTTP §5.3 과의 비대칭을 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | user_guide_sync | 신규 연결테스트 실패 코드(`DB_AUTH_FAILED`·`HTTP_AUTH_FAILED` 등)가 `backend-labels.ts` ko 매핑 없이 도입돼 한국어 로케일에서도 영문 원문이 섞여 노출된다. 다만 `code` 필드 자체가 애초에 ko 로 옮겨지지 않는 기존 MCP_*/EMAIL_* 과 동일한 미배선 설계의 연장이라 이번 PR 이 새로 만든 회귀는 아니다. | `database-connection-tester.ts`, `http-connection-tester.ts`, `backend-labels.ts` | 후속 plan 에서 `ERROR_KO`/전용 ko 매핑 테이블 배선 여부 결정. 이 PR 차단 불요. |
| 2 | database | `rotate()` 저장 직후 `findOne` 이 `null`(그 사이 삭제)이면 메모리 엔티티로 대체해 이미 삭제된 행을 성공 응답으로 감춘다 — 발생 확률 극히 낮음. | `integrations.service.ts:1131-1134` | 로그 추가 검토, 새 조치 시급성 낮음. |
| 3 | testing | `describeFailure`/`outboundBlockReason` 의 비-`Error` throw `String(err)` fallback 분기가 두 파일(`http-connection-tester.ts:66`, `http-redirect.ts:30`) 모두 테스트로 검증되지 않는다(실측 커버리지 리포트로 확인). | `http-connection-tester.ts:66`, `http-request/http-redirect.ts:30` | `fetchMock.mockRejectedValue('raw string reason')` 류 케이스 1건씩 추가. |
| 4 | security / performance | 연결 실패 메시지가 드라이버/네트워크 원문을 길이만 잘라(clamp) 그대로 노출하며(SSRF 차단만 일반화 문구), `pLimit` 대기열 자체엔 길이 제한이 없다. 둘 다 developer 가 이미 낮은 우선순위로 트래커에 등재. | `database-connection-tester.ts:157-162`, `http-connection-tester.ts:143-147`, `integrations.service.ts:128,410` | 조치 불요(트래커 추적 중). |
| 5 | performance | SSRF 사전검사(`assertSafeOutboundHostResolved`)와 실제 연결/리다이렉트 각 홉이 같은 host 를 중복 DNS 해석 — 5홉 리다이렉트면 최대 10회. 새 회귀 아님, 근본 해법은 이미 백로그에 defer. | `http-redirect.ts`, `database-connection-tester.ts` | 조치 불요(트래킹 중). |
| 6 | architecture | 공유 계약 타입 `IntegrationTestResult` 가 여전히 god service(`integrations.service.ts`, 1600줄+) 안에 정의돼 있어, 새 순수 함수 테스터 2개가 상위 orchestrator 타입을 역참조하는 역전된 의존 방향이다(런타임 순환은 없음, `import type`). | `integrations.service.ts:76` ← `database-connection-tester.ts:13`, `http-connection-tester.ts:14` | 별도 파일(`integration-test-result.ts`)로 분리해 테스터·서비스가 동등하게 import. |
| 7 | maintainability | `testHttpConnection` 한 함수가 8단계(자격증명 해석~예외 처리)를 순차 처리, HTTP 상태 임계값 리터럴, 테스트 파일의 동시성 헬퍼 보일러플레이트 반복 — 모두 경미. | `http-connection-tester.ts:87,40`, `integrations.service.spec.ts` | 헬퍼 분리 고려(병합 차단 사유 아님). |
| 8 | documentation | `CHANGELOG.md:17-18` 동시 상한 설명 문장이 두 줄로 쪼개져 스타일이 어색함. | `CHANGELOG.md:17-18` | 한 문장으로 합치기(비차단). |
| 9 | api_contract | `rotate()` 응답을 재조회 행으로 만드는 방향 전환은 응답-DB 정합성을 개선하는 방향(회귀 아님) — 위 "프로세스 관측 사항" 참고. | `integrations.service.ts` `rotate()` | 없음(참고). |
| 10 | requirement | HTTP §5.3 이 선언한 `auth_type=none`·`default_headers` 가 서비스 레지스트리 `http` 항목에 없어 해당 조합이 검증 단계에서 거부됨 — 기존 갭, 트래커 등재. | `service-registry.ts`(`type:'http'`), `http-credentials.ts` | 조치 불요(트래커 추적 중). |

## 정합성 확인 (문제 없음으로 판정)

- SSRF 가드(리터럴+DNS 해석, 리다이렉트 매 홉 재검증)가 Database·HTTP 에 동일하게 적용되어 공개→내부 host 리다이렉트 우회 불가 (security)
- SQL 인젝션 벡터 없음(`SELECT 1` 리터럴만 실행) (security, database)
- TLS 인증서 검증(`rejectUnauthorized: true`) 유지, 하드코딩 시크릿 없음 (security)
- 스키마 마이그레이션 변경 없음, 기존 쿼리 로직 무변경 (database)
- 순환 참조 회피가 의도적으로 설계된 공유 커널 모듈(`database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`)로 잘 구현됨, "테스트 통과=실행 성공" 불변식 확보 (architecture, maintainability, requirement)
- 요구사항 결과 코드 매핑(HTTP/DB) 이 spec 과 line-level 로 일치, 유닛(26+21개)·e2e(5개 시나리오)로 실증됨 (requirement, testing)
- 신규 파일 헬퍼 추출은 전부 이전에 모듈-비공개였던 함수의 이동이라 하위호환 깨지 않음 (side_effect, scope)
- `DTO`(`PreviewTestResultDto.code?`) 는 애디티브 변경, `assertMatchesContract` 로 계약 검증 배선됨 (api_contract)
- spec·CHANGELOG·사용자 가이드(ko/en) 동기화 양호, `--impl-prep`/`--impl-done` 경계에서 role 분리(spec 커밋 vs 구현 커밋) 유지 확인 (documentation, scope)
- 두 기존 노드 핸들러 리팩터(`database-query.handler.ts`, `http-request.handler.ts`)는 순수 위치 이동+얇은 위임이며 동작 로직 변경 없음 (scope)
- 테스트 위생(fetch/timer mock 복원) 양호, 신규 e2e 는 미확정 계약(400/422)을 의도적으로 단언하지 않음 (testing)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | preview-test 오라클 표면이 Database·HTTP 로 확장(이미 트래커 등재) |
| performance | NONE | 성능 결함 없음. 리뷰 중 워킹트리 뮤테이션 관측(코드 결함 아님) |
| architecture | LOW | DB 커넥션 종료가 드라이버 비공개 구조 의존, entityTester 재진입 데드락 잠재 리스크 |
| requirement | LOW | SPEC-DRIFT 1건(§5.4 연결 대기 10초 서술), 기존 트래커 항목 재확인 |
| scope | NONE | 범위 이탈 없음, 백로그로 스코프 확장 스스로 억제 |
| side_effect | LOW | 리뷰 세션 중 워킹트리 병렬 편집 관측(프로세스 이슈, 코드 결함 아님) |
| maintainability | LOW | 다중 책임 함수·매직넘버 등 경미한 개선점 |
| testing | LOW | `closeWithin` 방어 분기·non-Error fallback 커버리지 누락 2건 |
| documentation | LOW | plan/complete/ 전방 참조(dangling) 3곳 |
| database | MEDIUM | `rotate()` 낙관적 잠금 부재 — lost update / 삭제-중-rotate 500 가능성 |
| concurrency | **CRITICAL** | SSRF DNS 사전검사 무타임아웃 — 전역 세마포어(2슬롯) 영구 고갈 가능 |
| api_contract | LOW | 계약 breaking 없음(additive), 기존 트래커 항목(throttle 비대칭, 400/422) 재확인 |
| user_guide_sync | LOW | 신규 실패 코드 ko 매핑 누락(기존 미배선 패턴의 연장) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상을 보고했다(단, performance·scope 는 실질 결함 없이 NONE 위험도).

## 권장 조치사항

1. **(최우선, 배포 차단급)** `assertSafeOutboundHostResolved` 에 `closeWithin` 과 동일한 `Promise.race`+타이머 패턴으로 자체 타임아웃을 부여해 전역 `pLimit(2)` 세마포어 영구 고갈을 방지 (concurrency CRITICAL).
2. `rotate()` 에 낙관적 잠금(조건부 UPDATE 또는 `@VersionColumn`)을 추가해 동시 회전 lost update 와 삭제-중-rotate 500 오류를 방지 (database WARNING). 단, 리뷰 중 관측된 병렬 편집이 완료된 뒤 최신 코드로 재검증 필요.
3. `registerEntityTester` 계약에 재진입(연결 테스트 경로 재귀 호출) 금지를 명시하거나 구조적 가드 도입 (concurrency WARNING).
4. `closeWithin` fallback 분기·non-Error throw fallback에 대한 테스트를 추가해 방어 코드의 사실상 무검증 상태를 해소 (testing).
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `plan/complete/` 전방 참조 3곳을 정정 (documentation).
6. **(planner 턴)** `preview-test` 워크스페이스 검사 여부, `INTEGRATION_TEST_FAILED` 400/422 통일, spec §5.4 "연결 대기 10초" SPEC-DRIFT 문장 갱신을 함께 결정 — 이미 트래커에 선택지 등재됨.
7. DB 커넥션 close 의 드라이버 내부 구조(`connection.stream`) 의존에 대비해 드라이버 업그레이드 CI 경로에 회귀 테스트 추가 (architecture/database).
8. 리뷰 도중 관측된 워킹트리 동시 편집이 커밋으로 정착된 뒤, `rotate()` 관련 변경분에 한해 다음 라운드 code-review 를 재실행 (side_effect).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨, 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(사유 미기재, diff 에 의존성 파일 변경 관련성 낮다고 판단한 것으로 추정) |
