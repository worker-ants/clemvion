# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실측 기반 SSRF 우회 두 건(HTTP/DB 의 IPv4-mapped IPv6 표기, SMTP 의 CGNAT/`::`)을 하나의 판정기(`http-safety.ts`)로 통합해 막은 순net 보안 개선. CRITICAL 없음. forced 7개 reviewer(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음. WARNING 7건은 전부 "차단 사유 아님"으로 명시된 구조 결합·테스트 커버리지·문서화 보완 사안이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/유지보수성 | `isSmtpHostBlocked` 가 `assertSafeOutboundHostResolved` 의 판정 실패를 오직 `Error.message` 문자열이 `'SSRF_BLOCKED'` 로 시작하는지로만 구분한다 — 타입이 아닌 매직스트링 계약. `http-safety.ts` 쪽 메시지 포맷을 바꾸면 컴파일 타임 신호 없이 조용히 오분류(정상 차단이 rethrow 되거나 진짜 오류가 삼켜짐)될 수 있다. (architecture, maintainability 중복 지적) | `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:25` | `http-safety.ts` 에 전용 에러 클래스(`SsrfBlockedError`) 또는 `code` 필드를 두고 `instanceof`/필드 비교로 판별하도록 변경 |
| 2 | 아키텍처 | 3개 노드 공용 SoT 라고 문서화된 `http-safety.ts` 가 여전히 "HTTP Request" 라는 특정 기능 폴더 안에 상주 — `database-query.handler.ts` 에 이어 이번에 `smtp-host-guard.ts` 도 형제 폴더의 내부 구현 파일에 직접 의존하게 됨(순환 참조는 없음) | `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:1`, `.../http-request/http-safety.ts:1-5` | 다음 정리 시점에 `nodes/integration/common/` 등 중립 위치로 이전 검토, 또는 최소한 이 폴더-소유권 트레이드오프를 convention 문서에 한 줄 기록 |
| 3 | 테스트 | 코드 주석이 "의도적으로 미차단" 이라고 못박은 4개 IPv4-in-IPv6 대안 표기(IPv4-compatible `::a.b.c.d` · SIIT `::ffff:0:a.b.c.d` · NAT64 `64:ff9b::/96` · 6to4 `2002::/16`)가 향후에도 계속 통과하는지 잠그는 회귀 테스트가 없음 — 정규식을 넓히는 리팩터가 들어와도 현재 스위트는 못 잡음 | `codebase/backend/src/nodes/integration/http-request/http-safety.ts:87-92`, `http-safety.spec.ts:158-179` | `it.each` 대조군 4행 추가(`::7f00:1`, `::ffff:0:7f00:1`, `64:ff9b::7f00:1`, `2002:7f00:1::` → `isBlockedHostname === false` 단언) |
| 4 | 테스트 | `isSmtpHostBlocked` 의 `host?.trim()` 방어적 optional-chaining 분기가 `undefined` 입력으로 테스트되지 않음 — 타입 시그니처는 `string` 이지만 실제 호출부는 미검증 값을 단언으로 넘김 | `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:17-18` | `isSmtpHostBlocked(undefined as unknown as string)` → `false` 단언 테스트 1건 추가 |
| 5 | 문서화 | 보안 관련 동작 변경(SSRF 우회 차단)인데 `CHANGELOG.md` 항목이 없음 — 직전 두 유사 커밋(`0a040b96c`, `19d9dedca`)은 모두 항목을 추가했음 | `CHANGELOG.md` (루트, 이번 diff 에 변경 없음) | 두 선례와 같은 형식으로 "## Unreleased" 항목 추가(무엇이 뚫려 있었는지 · 무엇을 고쳤는지 · 배포 영향) |
| 6 | 문서화 | `.env.example` 의 `ALLOW_PRIVATE_HOST_TARGETS` 헤더 주석이 적용 대상에서 Send Email 을 빠뜨려 본문(Send Email 포함)과 불일치 — 이번 통합으로 실제로는 Send Email 도 `http-safety.ts` 를 쓰게 됐으므로 더 오도하게 됨 | `codebase/backend/.env.example` (라인 367-369 부근) | 헤더를 "HTTP Request, DB Query, Send Email (SMTP)" 로 넓히고 `smtp-host-guard.ts` 경로도 병기 |
| 7 | API 계약 | 하위 호환성 — CGNAT(`100.64.0.0/10`)·IPv4-mapped IPv6 표기의 host 를 쓰던 기존 통합 설정이 코드 배포 시점부터 별도 요청 변경 없이 `EMAIL_HOST_BLOCKED`/`HTTP_BLOCKED`/`DB_HOST_BLOCKED` 로 조용히 차단 전환됨(의도된 보안 수정이나 self-host 배포에는 breaking behavior) | `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`, `.../http-request/http-safety.ts` (`isBlockedIPv6`/`mappedIPv4`) | 릴리스 노트/CHANGELOG 에 "필요 시 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out" 안내 명시 (위 #5 와 함께 처리 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | DNS rebinding TOCTOU(가드 시점 조회와 실제 connect 재조회 사이의 경쟁) 잔존 — 기존부터 있던 한계이며 SMTP 경로가 이를 공유하는 소비자로 하나 늘었을 뿐. JSDoc·plan §비대상에 이미 문서화됨 | `http-safety.ts` `assertSafeOutboundHostResolved` JSDoc | 현재 문서화 수준으로 충분, egress 방화벽이 필수 보완책임을 재확인 |
| 2 | 보안 | `ssrf.util.ts`(LLM 프로바이더·S3) 는 이번 통합 대상에서 의도적으로 제외되어 CGNAT·`::` 를 여전히 통과시킴 | `s3.config.ts`, `llm-preview.service.ts`, `model-config.service.ts` | 범위 밖. plan 체크리스트의 트래커 등재 완료 여부를 후속 세션에서 확인 |
| 3 | 보안 | 차단 사유 메시지가 서버 로그에만 상세 IP 를 남기고 클라이언트/usage-log 에는 일반화 문구만 전달 — 정찰 정보 축소가 올바르게 구현됨(양성 확인), e2e 회귀 테스트 존재 | `http-safety.ts`, `integrations.service.ts`, `send-email.handler.ts` | 없음 |
| 4 | 요구사항 | DNS 조회 실패 시 fail-open 정책이 SMTP 가드에도 이식됐으나 이 invariant 가 spec Rationale 에 명문화돼 있지 않음 — 동시 수행된 consistency-check 가 이미 INFO 로 별도 등재 | `smtp-host-guard.ts` | 코드 수정 불요, spec 보강은 별도 planner 턴 |
| 5 | 부작용 | `isBlockedHostname` 판정 범위 확장(IPv4-mapped IPv6 추가 차단)이 HTTP/DB/DB연결테스트 3개 공개 소비자에 동시 적용됨 — 의도된 fail-closed 강화 | `http-safety.ts` `isBlockedIPv6` | 릴리스 노트에 "IPv4-mapped IPv6 리터럴을 쓰던 기존 통합은 이제 차단됨" 명시 권장 |
| 6 | 부작용/유지보수성 | SMTP 경로의 DNS lookup 네트워크 호출은 신규가 아니라 기존 `ssrf.util.ts` 구현에도 있던 것이 구현체만 교체됨. `mappedIPv4` 로직도 `ssrf.util.ts` 와 사실상 동일한 정규식을 반복하나 이는 plan 이 명시한 의도적 통합 보류 사안 | `smtp-host-guard.ts`, `http-safety.ts:93-99` | 조치 불요(범위 밖, 후속 트래커에 등재됨) |
| 7 | 테스트 | `http-safety.spec.ts` IPv4-mapped `it.each` 표의 일부 대칭 주소(`a9fe:a9fe`, `808:808`) 행은 옥텟/그룹 순서 변이에 대한 판별력이 낮음(표 전체로는 비대칭 행이 커버) | `http-safety.spec.ts:158-165` | 향후 유사 표 확장 시 비대칭 입력 위주로 구성 |
| 8 | 테스트 | `smtp-host-guard.spec.ts` 가 리터럴 IP 입력 케이스에서 실제 `dns.lookup` 을 호출(모킹 없음) — 결정적이긴 하나 그 전제가 문서화돼 있지 않음 | `smtp-host-guard.spec.ts` | 파일 상단에 "리터럴 IP 는 네트워크 질의 없이 즉시 반환" 한 줄 주석 권장 |
| 9 | 문서화 | `isSmtpHostBlocked` JSDoc 이 DNS 실패 fail-open 은 언급하나 빈/공백 host 의 fail-open 은 언급하지 않음 | `smtp-host-guard.ts` | JSDoc 한 줄 보강(필수 아님) |
| 10 | API 계약 | `testEmailTransport` 의 SSRF 가드 호출이 `try/catch` 밖에 있어(다른 호출부 `send-email.handler.ts` 와 비대칭), 가드가 향후 SSRF 판정 이외 오류를 던지도록 바뀌면 표준 에러 봉투 대신 처리되지 않은 예외로 전파될 이론적 경로 — 현재는 관찰되지 않음 | `integrations.service.ts` `testEmailTransport` (게이트 1596 부근) | 후속으로 가드 호출도 넓은 try 안으로 이동해 응답 봉투 일관성 방어 |
| 11 | 스코프/범위 | 파일 이동(`common/utils` → `nodes/integration/send-email`)·주석 정정(phantom `SMTP_BLOCK_PRIVATE_HOSTS` → `ALLOW_PRIVATE_HOST_TARGETS`)·`backend-typecheck-baseline.json`(197→194) 변경 모두 plan 문서·커밋 이력에 근거가 명시되어 범위 이탈 없음(양성 확인) | `plan/in-progress/ssrf-guard-integration-unify.md` 외 | 없음 |

### 점검했으나 문제 없음 / 해당 없음으로 확인된 항목
- **database**: 이번 diff 에 SQL 쿼리·스키마·마이그레이션·커넥션 풀·트랜잭션 변경이 전혀 없음 — "해당 없음" (SSRF 가드 보강이 간접적으로 DB 연결 안전성에 긍정적이나 이는 보안 리뷰 영역).
- **API 계약**: 에러 응답 형식·상태 코드·에러코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)는 기존 컨벤션을 그대로 재사용해 회귀 없음.
- **요구사항**: spec(`4-integration.md` §5.5, `1-http-request.md`/`2-database-query.md`/`3-send-email.md` §4)이 요구하던 "3개 노드 동일 메커니즘" 을 코드가 놓치고 있던 것을 바로잡은 정상적 버그 수정 — SPEC-DRIFT 아님, `spec_impact: none` 타당.
- **스코프**: 프롬프트가 생략한 4개 파일도 `git diff origin/main` 원본과 대조해 일치 확인, 숨겨진 추가 변경 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 두 우회 실측 기반 차단 확인, 정보노출 방지 정상. 잔여 위험(TOCTOU, LLM/S3 미통합)은 기존부터 있었고 문서화됨 |
| architecture | LOW | `http-safety.ts` 폴더 위치 결합, SSRF_BLOCKED 문자열 계약 — 둘 다 WARNING이나 기존 관행의 연장 |
| requirement | NONE | spec 문언과 정확히 일치하는 버그 수정, IPv4-mapped 정규화 로직 직접 재현·검증, 관련 테스트 218건 GREEN |
| scope | NONE | plan 4개 항목에 diff 정확히 대응, 무관한 변경 없음 |
| side_effect | LOW | 파일 이동 4개 임포터 전부 동반 갱신, 옛 경로 참조 0건. 공개 함수 차단범위 확장은 의도된 것 |
| maintainability | LOW | SSRF_BLOCKED 매직스트링 커플링(architecture와 중복) |
| testing | LOW | 핵심 로직 테스트 충실, 다만 2개 회귀 테스트 공백(대안 표기 4종, undefined host) |
| documentation | LOW | JSDoc·spec 앵커 충실, CHANGELOG 누락·`.env.example` 헤더 불일치 |
| database | NONE | 해당 없음 — DB 계층 변경 없음 |
| api_contract | LOW | API 표면 변경 없음, 다만 CGNAT/mapped host 의 breaking behavior change 커뮤니케이션 필요 |

## 발견 없는 에이전트

없음 — database 는 "해당 없음"(DB 계층 미변경)으로 분류되나 검토 자체는 수행되어 위 표에 포함됨.

## 권장 조치사항

1. `CHANGELOG.md` 에 "## Unreleased" 항목 추가 — 무엇이 뚫려 있었는지(IPv4-mapped IPv6 루프백/메타데이터 도달, SMTP CGNAT 통과) · 무엇을 고쳤는지 · 배포 영향(CGNAT/mapped host 를 쓰던 기존 통합은 이제 기본 차단, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out) 명시. (WARNING #5, #7 동시 해소)
2. `.env.example` 의 `ALLOW_PRIVATE_HOST_TARGETS` 헤더 주석에 Send Email 추가, 본문과 정합화. (WARNING #6)
3. 테스트 공백 2건 보강 — IPv4-in-IPv6 대안 표기 4종 "여전히 통과" 대조군, `isSmtpHostBlocked(undefined)` 케이스. (WARNING #3, #4)
4. 다음 관련 작업 시 `http-safety.ts` 의 SSRF 판정 실패를 문자열 접두어가 아닌 전용 에러 클래스/코드로 노출하도록 리팩터링 검토. (WARNING #1)
5. 장기 정리 항목으로 `http-safety.ts` 를 `nodes/integration/common/` 등 중립 위치로 이전하는 것을 백로그에 등재. (WARNING #2)
6. (선택) `testEmailTransport` 의 SSRF 가드 호출을 넓은 try 블록 안으로 이동해 `send-email.handler.ts` 와 방어 수준을 맞춤. (INFO #10)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨, 누락 없음
  - **제외**: 아래 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 diff 와 저관련(SSRF 판정 로직 변경, 성능 특성 변경 없음) |
  | dependency | 신규/변경 외부 의존성 없음 |
  | concurrency | 동시성 제어 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |
