# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, (1) `rotate()` 부분 저장 전환이 응답 `updatedAt` 을 회전 이전 시각으로 되돌리는 신규 회귀, (2) `preview-test`(및 이번 diff 로 동급 위험이 된 `:id/test`)가 워크스페이스/역할 검사 없이 임의 host 실접속 오라클로 쓰일 수 있는 기존 미해소 이슈, (3) 신설 동시성 안전장치가 `registerEntityTester` 확장점을 관통하지 못하는 구조적 틈이 겹쳐 WARNING 9건으로 수렴. forced whitelist(7명) 전원 결과는 정상 확보되어 "결과 없음" 은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `preview-test` 가 워크스페이스/역할 검사 없이 인증된 임의 사용자에게 공개 host:port 에 대한 실접속(포트 열림/거부/타임아웃/TLS/인증 실패 구분) 오라클을 제공 — 제한적 포트 스캐너로 오용 가능. `spec-draft-nullable-notation-followups.md` 에 이미 planner 결정 대기로 등재됐으나 이번 diff 로도 미해소 | `integrations.controller.ts:149-163` (`previewTest`, `@WorkspaceId`/`@Roles` 없음, `@Throttle` 20/min 뿐) | (a) 워크스페이스 멤버십 요구 (b) 실패 메시지 추가 일반화 (c) spec Rationale 에 수용 위험으로 명시 — 이번 트래커 턴에 셋 중 하나 확정 |
| 2 | Architecture | 이번 PR 이 세운 동시성 안전장치(`connectionTestLimit`)가 공개 확장점 `registerEntityTester`(Cafe24/MakeShop) 경로는 관통하지 못함 — "host 고정이라 안전"은 주석으로만 강제되는 관례라, 향후 host 입력 서비스가 이 경로로 등록되면 이 PR 이 막으려던 libuv 스레드풀 고갈이 재현 가능 | `integrations.service.ts:1545`(dispatchTest 제한 래핑) vs `:974`(getConnectionTest 직접 호출), 확장점 `:465` | `EntityAwareTester` 등록 시 host-fixed 여부를 타입/팩토리로 명시하거나, `registerEntityTester` 도 기본적으로 `connectionTestLimit` 적용(안전 기본값 우선) |
| 3 | Architecture | HTTP 노드 실행과 연결 테스트가 query parameter 자격증명을 URL 에 붙이는 방식이 다름(`append` vs `set`) — 이 PR 의 핵심 목표("테스트 통과 = 실행 성공 보장")가 이 지점에서 미완결 | `http-connection-tester.ts:39-48`(`withQuery`, `URLSearchParams.set`) vs `http-request.handler.ts:265-273`(`URLSearchParams.append`) | URL query 반영 마지막 단계를 공유 모듈로 옮기거나 두 구현이 같은 메서드를 쓰도록 통일 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] Database 연결 테스트의 대기 상한이 "연결"과 "쿼리" 각각 별도 10초(worst-case 최대 20초+닫기 유예 1초)인데 spec §5.4 본문은 "연결 대기 10초"만 기술 — 코드·unit spec 은 이 이중 타임아웃을 의도적으로 걸어 인증 후 멈춘 서버 대기를 막고 있어 코드가 옳고 spec 서술이 그 정교화를 놓침 | `spec/2-navigation/4-integration.md:499` vs `database-connection-tester.ts:72-73,96` | 코드는 유지, spec §5.4 문구를 "연결과 쿼리를 각각 최대 10초까지 기다린다"로 갱신(project-planner 경로) |
| 5 | Side Effect | `rotate()` 의 부분 컬럼 `save({id, ...changes})` 전환으로 DB 의 `updated_at` 은 정확히 갱신되지만, 응답 바디의 `updatedAt` 은 `Object.assign(entity, changes)` 이 이 필드를 포함하지 않아 회전 **이전** 시각을 그대로 반환 — 옛 전체-엔티티 `save()` 경로에서는 정확했던 필드라 이번 전환이 만든 신규 회귀 | `integrations.service.ts` `rotate()` 1120-1139행 | `changes` 에 `updatedAt: new Date()` 포함, 또는 `save()` 반환값(`updateGeneratedMap`)에서 `updatedAt` 을 뽑아 `entity` 에 대입 |
| 6 | Maintainability | SSRF "URL 리터럴 + DNS 해석" 체크-후-사유문자열화 블록이 `http-connection-tester.ts` 와 `http-redirect.ts` 에 동일하게 중복 — 이 PR 이 다른 곳(자격증명·리다이렉트 로직)에서는 정확히 이런 중복을 막으려 공유 모듈을 만든 것과 대비됨 | `http-connection-tester.ts:29-37`(`ssrfBlockReason`) / `http-redirect.ts:48-56` | `http-safety.ts` 에 순수 헬퍼(예: `describeOutboundSafetyViolation`) 추가해 양쪽에서 재사용 |
| 7 | Testing | 프로세스 전역 동시 상한이 "서비스 종류를 가리지 않고 공유된다"는 핵심 설계 주장을 `database` 단일 서비스 5건 동시 호출로만 검증 — `database`+`http` 혼합 시나리오가 없어 서비스별로 상한이 분리되도록 회귀해도 이 테스트는 계속 통과함 | `integrations.service.spec.ts:2026`(동시성 테스트, database 전용) | `mockedDbTester`+`mockedHttpTester` 를 함께 동시 호출해 전체 in-flight 합이 2 를 넘지 않음을 단언하는 케이스 추가 |
| 8 | Documentation | `PreviewTestDto.credentials` 의 Swagger 필드 설명이 "실제 외부 호출 안 함" 옛 문구를 그대로 남겨, 같은 엔드포인트의 `@ApiOperation` 설명("MCP·Email·Database·HTTP 는 실제 접속")과 정면 모순 — 컨트롤러 docstring 은 이 PR 이 정확히 고쳤는데 같은 파일의 DTO 필드 앞에서 스윕이 멈춤 | `integrations.controller.ts` / `integration.dto.ts:175`(`PreviewTestDto.credentials` `@ApiProperty`) | `description` 을 컨트롤러 `@ApiOperation` 문구와 일치시킴 |
| 9 | API Contract | `POST /api/integrations/:id/test` 가 이번 PR 로 `preview-test` 와 동급의 실제 outbound 프로브(DB 접속·HTTP GET·5홉 리다이렉트) 표면이 됐는데, route 레벨 throttle 이 없음(전역 기본 100/60s 만 적용, `preview-test` 는 20/60s 명시) | `integrations.controller.ts` `testConnection()`(`@Post(':id/test')`) | `:id/test` 에도 상응하는 `@Throttle` 명시, 또는 낮은 위험으로 판단한 근거를 spec Rationale/트래커에 기록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SSRF 가드의 DNS-rebinding TOCTOU 창(기존 설계, HTTP/DB 노드와 공유)이 이번 PR 로 Database 커넥션 테스터에도 적용 — 새 취약점 클래스는 아니나 공격 표면이 "노드 실행"에서 "저장 전 preview-test"(워크스페이스 무관)로 넓어짐 | `database-connection-tester.ts:119-131`, `http-safety.ts:120-131` | egress 방화벽 defense-in-depth 고려, 해석 IP 직접 연결 근본해법 우선순위 상향 검토(이미 트래커) |
| 2 | Security/Performance/Concurrency/Side-Effect | 연결 테스트 동시 상한(`pLimit(2)`)이 mcp·email·database·http 4종 전역 공유 + 대기열 길이 무제한 — 응답 없는 host 를 반복 요청하면 슬롯을 점유해 다른 워크스페이스의 연결 테스트 기능이 지연될 수 있음(프로세스 전체 다운은 아님). `spec-draft-nullable-notation-followups.md` 에 이미 낮은 우선순위로 등재된 잔여 리스크 | `integrations.service.ts:127,409-411,1545` | 워크스페이스별 상한 또는 대기열 길이 제한(이미 defer 확정, 재조치 불요) |
| 3 | Security | 드라이버·전송 오류 원문이 길이(clamp)만 제한된 채 `preview-test` 응답에 그대로 실림 — WARNING#1(워크스페이스 무관 preview-test)과 결합 시 정찰 정밀도 향상 | `database-connection-tester.ts:145`, `http-connection-tester.ts:168` | WARNING#1 해소책에 자연 흡수, 별도 조치 불요 |
| 4 | Performance | `testHttpConnection` 안에서 같은 URL 을 최대 3번 `new URL()` 로 파싱(`isValidUrl`/`withQuery`/`ssrfBlockReason`) | `http-connection-tester.ts:32,44,52` | `URL` 객체 하나 재사용으로 리팩터 가능(우선순위 낮음, 트래픽 규모상 병목 아님) |
| 5 | Architecture | DB 연결 닫기가 `pg`/`mysql2` 의 비공개 내부 프로퍼티(`connection.stream`)에 구조적으로 의존 — optional chaining 이라 드라이버 업그레이드로 구조가 바뀌면 예외 없이 조용히 no-op 됨 | `database-connection-tester.ts:25-26,49,100` | `closeWithin` 이 `destroy` 를 실제 호출했는지 관측 가능하게(로그 1줄) 만들어 조기 감지 |
| 6 | Architecture | "이 모듈은 의존성이 없어야 한다"는 순환참조 회피 불변식이 `database-connection.ts`/`http-credentials.ts` 에 주석으로만 강제되고 기계적 검증 장치(`import/no-cycle` 등)가 없음 | `database-connection.ts:1-9`, `http-credentials.ts:1-10` | 이 두 파일 한정 `import/no-cycle` 또는 상응하는 정적 검사 추가 고려 |
| 7 | Architecture | `transportTesters` 맵 내 구현 형태 혼재(mcp/email=서비스 private 메서드, database/http=독립 순수 함수) — 다음 tester 추가 시 판단 기준이 소스에 명시 규칙으로 없음 | `integrations.service.ts:427-433` | 맵 초기화부 주석에 "노드와 로직 공유 필요 시 독립 파일, 아니면 private 메서드" 한 줄 규칙 추가 |
| 8 | Architecture | 공유 SSRF 가드 모듈(`assertSafeOutboundHostResolved`)이 소비처 4곳으로 늘었는데 여전히 `nodes/integration/http-request/` 아래(HTTP 전용처럼 보이는 경로)에 위치 | `http-safety.ts`, 신규 소비 `database-connection-tester.ts:5` | 향후 `nodes/integration/_shared/` 류 중립 위치 이동 고려(당장 불요) |
| 9 | Requirement / API Contract | 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 owner·rationale 과 함께 등재된 기지(旣知) spec-코드 갭 다수 — `rotate()` 실패가 400(spec 은 §9.4 422 기술, 세부 `code` 도 rotate 응답엔 미반영) · spec §5.3 `auth_type` 표기(`bearer` vs 실제 `bearer_token`, `none` variant 부재) · HTTP 4xx "확인 못 함" 안내가 UI 에 노출되지 않음(UX 결정 대기) · `preview-test` 오라클 위험(WARNING#1 과 동일 사안) | `integrations.service.ts` rotate `INTEGRATION_TEST_FAILED`, `service-registry.ts:470-497`, `http-connection-tester.ts` `classify()` 59-82행 | 이번 PR 스코프 밖, 트래커 결정 대기 유지(중복 조치 불요) |
| 10 | Maintainability / Testing | `discardBody`(응답 본문 미독취-취소) 패턴이 `http-connection-tester.ts` 에서는 헬퍼로, `http-redirect.ts` 에서는 인라인으로 중복되며, 실제 `cancel()` 호출 여부를 검증하는 테스트 단언도 없음(호출이 사라져도 GREEN 유지) | `http-connection-tester.ts:92-94,154`, `http-redirect.ts:37` | `discardBody` 재사용 통일 + `jest.spyOn` 으로 최소 1개 케이스에서 `cancel` 호출 검증(사소, 선택) |
| 11 | Maintainability | `probeMysql` 의 `const opened = connection;` 재바인딩(TS 클로저 narrowing 우회 관용구)이 이름만으로 의도를 설명하지 않음 | `database-connection-tester.ts:98-101` | 이름에 이유 담기(`nonNullConnection` 등) 또는 짧은 주석 추가 |
| 12 | Testing | 신규 공유 모듈(`database-connection.ts`, `http-redirect.ts`)에 전용 unit spec 이 없음 — 호출자 spec 을 통한 간접 커버리지뿐이라 한쪽 spec 이 약해지면 공유 모듈 회귀를 못 잡을 수 있음 | `database-connection.ts`, `http-redirect.ts`(신규 파일, spec 없음) | 공유 모듈 자체에 얇은 spec(SSL 매핑 3분기, 리다이렉트 홉/SSRF 재검증 1~2케이스) 추가 고려 |
| 13 | Testing | rotate 부분 저장 리팩터링 후 `broadcastCredentialChange` 호출 인자(`entity.id`)를 직접 검증하는 단언이 없음(값 자체는 리팩터 전후 동일해 현재 회귀는 아님) | `integrations.service.ts:1138` | unit 레벨에서 `broadcastCredentialChange` 스파이 인자 단언 추가(선택) |
| 14 | User Guide Sync | 신규 `IntegrationTestResult.code` 값들(`DB_*`/`HTTP_*`)이 `backend-labels.ts` 의 `ERROR_KO`, `integration-error-codes.ts` 의 화이트리스트에 미등록 — 한국어 UI 에서 영문 `message` 원문이 그대로 노출됨(`test-step.tsx`). 기존 `EMAIL_*`/mcp 패턴과 일관된 확장이며 트래커에 이미 등재(4계열 일괄 정리 예정) | `database-connection-tester.ts`, `http-connection-tester.ts`; `backend-labels.ts:568-631`; `test-step.tsx` | 후속 plan 착수 시 mcp·email·database·http 4계열 `ERROR_KO`/`INTEGRATION_ERROR_CODE_TO_I18N` 매핑 일괄 신설(이미 계획됨) |
| 15 | Concurrency | `rotate()` 동시 호출은 last-write-wins — 데이터 손상은 아니나 감사로그·broadcast 순서와 최종 DB 값의 대응 관계가 요청 완료 순서에 따라 달라질 수 있음(기존부터 있던 성격, 이번 diff 는 오히려 `logUsage` 와의 충돌만 좁혀 고침) | `integrations.service.ts:1105-1139` | 필요시 `WHERE last_rotated_at = :expected` 조건부 update 고려(이 PR 스코프 밖, 현재 위험 수용 가능) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | preview-test 워크스페이스 무관 접속 오라클(WARNING#1), TOCTOU·에러노출 등 잔여 리스크(INFO) |
| performance | LOW | 동시상한 서비스 공유(INFO), URL 3중 파싱(INFO). N+1·과다 메모리 없음 |
| architecture | MEDIUM | registerEntityTester 안전장치 미적용(WARNING#2), query param 부착 방식 불일치(WARNING#3) |
| requirement | LOW | [SPEC-DRIFT] DB 쿼리 타임아웃 spec 미반영(WARNING#4), 기지 갭 다수 재확인(INFO), 기능 완전성 결함 없음 |
| scope | NONE | 44개 파일 전부 단일 의도(실접속 연결 테스트)로 수렴, 스코프 이탈 없음 |
| side_effect | MEDIUM | rotate() `updatedAt` 응답 staleness 신규 회귀(WARNING#5) |
| maintainability | LOW | SSRF 체크-후-사유문자열화 블록 중복(WARNING#6), 나머지는 사소한 INFO |
| testing | LOW | 동시상한 cross-service 시나리오 미검증(WARNING#7), 그 외 커버리지 갭은 INFO |
| documentation | LOW | PreviewTestDto Swagger 자기모순(WARNING#8), 그 외 문서화 수준 높음 |
| dependency | NONE | 신규 의존성 없음(pg/mysql2/p-limit 모두 기존 재사용), 라이선스·버전 문제 없음 |
| database | NONE | 스키마/마이그레이션 변경 없음, rotate 부분저장이 lost-update 를 오히려 개선 |
| concurrency | LOW | 대기열 무제한(INFO, 기추적), rotate last-write-wins(INFO). 신규 Critical/Warning 동시성 결함 없음 |
| api_contract | LOW | `:id/test` throttle 비대칭(WARNING#9), 스키마는 전부 additive·계약검증 배선됨 |
| user_guide_sync | NONE | docs(ko/en)·swagger·spec 동반 갱신 완료, i18n 사전 갭은 기추적(INFO#14) |

## 발견 없는 에이전트

- scope — 스코프 이탈·무관 변경 없음 (NONE)
- dependency — 신규/버전 변경 의존성 없음, 라이선스·보안 이슈 없음 (NONE)
- database — 스키마·마이그레이션·인젝션·N+1 관점 결함 없음 (NONE)

## 권장 조치사항

1. `rotate()` 부분 저장이 응답 `updatedAt` 을 회전 이전 값으로 되돌리는 신규 회귀를 수정 — `changes` 에 `updatedAt` 포함 또는 `save()` 반환값에서 추출 (WARNING#5)
2. `preview-test`(및 이번 diff 로 동급 위험이 된 `:id/test`)의 워크스페이스/역할 검사 또는 에러 일반화 여부를 이번 트래커 턴에 확정 — 이미 지연 중인 결정 사안 (WARNING#1, #9)
3. `registerEntityTester` 확장점에도 동시성 상한을 기본 적용하거나 host-fixed 여부를 타입으로 강제 (WARNING#2)
4. HTTP 노드/연결테스트의 query parameter 부착 방식을 공유 모듈로 통일 (WARNING#3)
5. spec §5.4 에 "쿼리 대기 10초" 반영 — `[SPEC-DRIFT]`, project-planner 경로로 갱신 (WARNING#4)
6. `PreviewTestDto.credentials` Swagger 설명을 실제 동작(§5.3/§5.4 접속 확인)과 일치시킴 (WARNING#8)
7. SSRF 체크-후-사유문자열화 중복 블록을 `http-safety.ts` 공유 헬퍼로 통합 (WARNING#6)
8. 동시 상한 cross-service(database+http 동시) 테스트 케이스 추가 (WARNING#7)
9. 나머지 INFO 항목은 대부분 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 잔여 리스크이므로 별도 조치 없이 해당 트래커의 다음 정리 턴에서 일괄 처리

## 라우터 결정

- `routing=fallback-all` — 이번 세션은 router 판단 없이 **14개 reviewer 전원 실행**(skipped 없음).
- **강제 포함(router_safety) whitelist**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 확인**(forced 인데 결과 없는 항목 없음, 거짓 "clean" 위험 없음).
- 실행된 14명 전원 `status=success` 이며 인라인 전문으로 통합에 반영됨. 재시도 필요 항목 없음.
