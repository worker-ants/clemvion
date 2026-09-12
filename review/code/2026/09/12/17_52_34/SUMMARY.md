# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 1건(테스트 커버리지 갭: provider 형식-불일치 에러 메시지 스왑을 어떤 테스트도 못 잡음, 30/30 GREEN 실측). 나머지 9개 reviewer 는 NONE~LOW. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | provider 별 **형식 불일치** 에러 메시지가 Slack↔Discord 로 서로 바뀌어도 어떤 테스트도 감지하지 못한다. 같은 함수의 "부재(필수 위반)" 분기는 이번 PR 이 정확히 이 클래스의 결함을 고쳤는데(`it.each` 로 `message` 라벨 단언 추가), 바로 아래 "형식 불일치" 분기는 여전히 `details.field`/`details.code` 만 단언하고 `message` 는 미검증. 실측: 두 메시지 문자열을 서로 바꿔치기해 `npx jest chat-channel-input-rules.spec.ts` 실행 결과 **30/30 GREEN**(회귀를 원리적으로 못 잡음). | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `assertInboundSigningPlaintextByProvider` 의 Slack/Discord 형식 불일치 분기 두 `throwInvalidField(...)` 호출 | 형식 불일치 케이스의 `it.each(['slack',32,64],['discord',64,32])` 비-hex(`'Z'.repeat(ownLen)`) 테스트에 `expect(res?.message).toContain(...)` 라벨 단언 한 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `chat-channel-input-rules.ts` 가 입력 검증과 출력 에러 변환(`translateSetupChannelError`) 두 책임을 한 파일에 겸유 — 헤더 주석으로 의도적 유예를 명문화(분리는 planner 축 결정, 트래커 등재됨) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (헤더 주석 블록) | 조치 불요 — 트래커의 planner 항목 집행 시 함께 분리 |
| 2 | Architecture / Side Effect | `TriggersController.rotateBotToken` 반환 타입이 `ChatChannelRotateBotTokenDto` 로 바뀌었으나 이는 컴파일타임 구조적 검사일 뿐, 런타임에 `TransformInterceptor` 가 실제 DTO 인스턴스화·화이트리스트 strip 을 수행하지 않음(저장소 전역 갭, 60개 엔드포인트 중 4개만 배선 — 이번 PR 신규 아님) | `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처 | 조치 불요 — 다음 `response-contract` 런타임 배선 확장 시 후보 포함 |
| 3 | Architecture | `botIdentity` 개념이 도메인 타입/입력 DTO/응답 DTO 3곳에 독립 선언됨(의도된 레이어 분리, 서비스 반환 타입은 도메인 타입 참조로 고정해 재입력 자리 하나는 제거) | `chat-channel/types.ts`, `dto/chat-channel-config.dto.ts`, `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | 조치 불요 — 도메인 타입에 필드 추가 시 응답 DTO 동반 갱신 유의 |
| 4 | Security / API Contract | `rotateBotToken` 의 `:id` 파라미터에 형제 엔드포인트와 달리 `ParseUUIDPipe` 미적용(사전 존재, `findById` 파라미터화 조회라 SQLi 아니고 비-UUID 는 404 로 귀결 — 인가 우회 아님) | `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처 | 이미 `plan/in-progress/chat-channel-rules-cleanup.md` 후속 항목 등재 — 재지적 불요 |
| 5 | Requirement | `dto/chat-channel-config.dto.ts` 주석이 "`TriggersService`가 `assertInboundSigningPlaintextByProvider`를 직접 호출한다"고 서술하나 실제로는 `assertChatChannelInputSafe` 경유(한 단계 다름) | `dto/chat-channel-config.dto.ts:36-38, 283-284` | 급하지 않음 — "경유" 한 단어 보강 |
| 6 | Requirement | `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트가 실제 완료된 작업에도 미체크 상태로 이월 | `plan/in-progress/chat-channel-rules-cleanup.md` §체크리스트 | 수렴 판정 시 마무리 커밋에서 일괄 체크 + `plan/complete/` 이동 |
| 7 | Maintainability | `throwInvalidField(field: string, ...)` 가 넓은 `string` 타입이라 `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부는 `ChatChannelBlockedField` 유니언의 오타-컴파일에러 보호를 못 받음(각 호출부에 `details.field` 단언 테스트가 있어 실제 회귀 위험은 낮음, 5라운드 연속 이월) | `chat-channel-input-rules.ts:56` (선언), 직접 호출부 4곳 | 즉시 조치 불요 — 호출부 증가 시 리터럴 유니언으로 좁히기 고려 |
| 8 | Maintainability | 신규 `dto-class-name-collision-guard.ts` 가 형제 가드(9개, 전부 `ts.forEachChild` 재귀)와 달리 최상위 statement만 보는 비재귀 순회 + `SRC_ROOT` 를 가드 모듈이 아닌 spec 이 계산(소유권 불일치) — 저장소 전 DTO 가 최상위 선언이라 현재 결과는 정확 | `repo-guards/__tests__/dto-class-name-collision-guard.ts:33`, `dto-class-name-collision.spec.ts` | 급하지 않음 — 스코프를 JSDoc 에 명시하거나 형제 가드처럼 재귀+`SRC_ROOT` export 로 통일 |
| 9 | User Guide Sync | backend 가 이번 PR 로 공식 계약화한 `botIdentity` 부가 필드(Slack `teamId`, Discord `publicKey`)를 frontend 소비 계층(`lib/api/triggers.ts`, `chat-channel-card.tsx`, `dict/{ko,en}/triggers.ts`)이 아직 모름 — 이 changeset 범위 밖 사전 존재 gap, wire 포맷 자체는 이전부터 스프레드로 이미 실려 있었음 | `codebase/frontend/src/lib/api/triggers.ts:40`, `chat-channel-card.tsx:483-503` | 이번 changeset 차단 사유 아님 — `spec-draft-nullable-notation-followups.md` 트래커에 "frontend botIdentity 부가 필드 표시" 후속 등재 권장 |
| 10 | Maintainability | `findDtoClassCollisions` 가 파일당 불변인 상대경로를 클래스 수만큼 재계산(성능 영향 없음, 순수 스타일) | `dto-class-name-collision-guard.ts:56-57` | 급하지 않음 — 다음에 만질 때 바깥 루프로 이동 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 결함 없음. 응답 DTO 비밀 미노출, 정적 가드(AST 기반) 확인, ParseUUIDPipe 이월 항목 재확인만 |
| architecture | NONE | 새 결함 없음. 책임 분리 유예·런타임 DTO 미배선·botIdentity 3중 선언은 전부 의도되었거나 이미 인지된 갭 |
| requirement | NONE | spec §5.4 필드/에러코드 전수 대조 일치, jest 242 passed·tsc 0 오류 재확인. 주석 정밀도·plan 체크리스트 INFO 2건만 |
| scope | NONE | 6개 커밋 전체 diff 를 plan 작업표+각 라운드 RESOLUTION.md 와 1:1 대조, 스코프 이탈 0건 |
| side_effect | NONE | 신규 helper 3개 비공개(export 표면 불변), 신규 가드는 읽기 전용/프로덕션 스캔 밖, 데코레이터는 문서 메타데이터뿐 |
| maintainability | LOW | 5라운드 연속 이월된 저위험 INFO 4건(넓은 타이핑, 가드 비재귀 순회, 중복 계산, it.each 중복)만, 회귀 없음 |
| testing | MEDIUM | WARNING 1건 — provider 형식-불일치 메시지 스왑 미검출(실측 30/30 GREEN). 이번 PR 이 고친 "부재 분기" 하드닝의 형제 분기 |
| documentation | NONE | 신규 diff(JSDoc 인용 체인 3단계)가 각 라운드 실제 SUMMARY 항목과 정확히 일치, 직전 WARNING(bare 인용) 전부 해소 확인 |
| api_contract | NONE | 이전 CRITICAL(DTO 이름 충돌)·WARNING(publicKey 누락) 소스 레벨 해소 재확인, 하위 호환성/인증·인가 변경 없음 |
| user_guide_sync | LOW | 매트릭스 21행 중 backend-api-change 만 매칭, target 충족 확인. INFO 1건(frontend botIdentity 부가 필드 미소비, 범위 밖) |

## 발견 없는 에이전트

architecture, scope, side_effect, documentation, api_contract — CRITICAL/WARNING 없음(INFO 는 위 표에 반영, 순수 확인성 기록 포함).

## 권장 조치사항

1. (WARNING 해소) `assertInboundSigningPlaintextByProvider` 의 형식-불일치 `it.each` 케이스에 `message` 라벨 단언을 추가해 Slack/Discord 메시지 스왑을 잡도록 한다.
2. (후속 트래커) frontend `botIdentity` 부가 필드(teamId/publicKey) UI·dict 반영을 `spec-draft-nullable-notation-followups.md` 에 등재.
3. (수렴 시 정리) 이번 라운드가 마지막이면 `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트 일괄 체크 + `plan/complete/` 이동.
4. (급하지 않음) `dto/chat-channel-config.dto.ts` 주석의 호출 체인 문구를 "`assertChatChannelInputSafe` 경유"로 한 단어 보강.
5. (급하지 않음) 신규 `dto-class-name-collision-guard` 의 비재귀 스캔 범위를 JSDoc 에 명시하거나 형제 가드처럼 재귀+`SRC_ROOT` export 로 통일.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 순수 헬퍼 추출/문서화/정적 가드로 성능 특성 변경 없음 |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단 — 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 관련 로직(락·트랜잭션) 변경 없음 |