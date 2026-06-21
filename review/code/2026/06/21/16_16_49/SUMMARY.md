# Code Review 통합 보고서

## 전체 위험도
**LOW** — 구조적으로 우수한 DIP/Strategy 패턴 리팩터링. Critical 결함 없음. WARNING 3건(중복 관리 패턴 2건 + 모듈 순환 잔존 1건)은 모두 인지된 trade-off 또는 prior DEFER 계승이며 즉각 차단 사유 아님. SPEC-DRIFT 2건은 코드 수정 불필요, spec 갱신 대상.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 유지보수성 / 테스팅 | `useFactory` inject 배열이 `websocket.module.ts`와 `websocket.gateway.spec.ts` 두 곳에 이중 관리됨. 신규 authorizer 추가 시 두 파일 중 한 곳 누락 시 prod wiring과 다른 wiring으로 테스트가 통과하는 거짓 신뢰 위험. authorizer 개수 assertion(5개)이 완화책으로 동작 중. | `websocket.module.ts` providers 블록 / `websocket.gateway.spec.ts` L138-L150 | `buildChannelAuthorizerProvider()` 헬퍼를 module에서 export하거나 inject 배열을 별도 상수 파일로 추출해 단일 소스화. 현재 개수 assertion 봉인으로 urgent하지 않음 — DEFER 계승 가능. |
| W-2 | 유지보수성 | 채널 prefix 리터럴(`'background:run:'` 등)이 각 authorizer의 `matches`/`slice` 인라인과 gateway의 `VALID_CHANNEL_PREFIXES` 배열에 이중 하드코딩. 신규 채널 추가 또는 prefix 변경 시 두 곳 누락 시 silent regression(fail-closed W-5 거부). 직전 리뷰에서 DEFER 처리됨. | `websocket.gateway.ts` `VALID_CHANNEL_PREFIXES` / 각 `*-channel-authorizer.ts` `matches`/`slice` | 각 authorizer에 `static readonly PREFIX = '...'` 상수 추가 후 `matches`/`slice` 양쪽에서 참조. `VALID_CHANNEL_PREFIXES`를 주입된 authorizer 배열에서 동적 파생하도록 전환하면 단일 출처 수렴. DEFER 유지 시 기존 W-5+W-6 봉인 근거 계승. |
| W-3 | 아키텍처 | 모듈-레벨 양방향 순환(C-2 클러스터) 잔존 — 도메인 모듈이 WS 모듈을 import하고(spec §4.4 emit), WS 모듈이 도메인 모듈을 import(authorizer 집계)하는 구조적 순환. M-7은 gateway 생성자의 서비스-레벨 forwardRef 3개를 제거했으나 모듈-레벨 양방향은 유지됨. e2e 205 PASS로 부팅 안정성 확인. NestJS 초기화 순서 취약성 내포, 향후 모듈 추가 시 순환 확장 위험. | `websocket.module.ts` `forwardRef(() => ExecutionsModule)` 외 2건 | C-2 클러스터 후속 과제에서 공유 이벤트 버스 도입 또는 도메인→WS 단방향화 검토. 이번 범위에서 수용. plan에 명시된 의도된 결과. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `kb:{documentId}` 비-UUID 선차단이 코드에 추가됐으나 spec §3.3 권한 검증 표에 미기재. `execution:`/`workflow:`/`background:run:` 행엔 "(비-UUID 선차단)" 명시 있으나 `kb:` 행만 누락. 코드가 합리적·의도적 개선 — 코드 유지 + spec 반영 대상. | `spec/5-system/6-websocket-protocol.md` §3.3 table (kb 행) / `kb-channel-authorizer.ts` | project-planner에 위임: spec §3.3 `kb:{documentId}` 행을 "workspace 문서 소유 검증 (비-UUID 선차단)"으로 갱신. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] fail-closed 정책(매칭 authorizer 없는 valid 채널 = 기본 거부)이 코드에 구현됐으나 spec §3.3에 미기재. 방어적 보안 추가이며 정상 경로 무영향 — 코드 유지 + spec 반영 검토 대상. | `websocket.gateway.ts` L175-184 / `spec/5-system/6-websocket-protocol.md` §3.3 | project-planner 판단: spec §3.3에 "매칭 authorizer 없는 valid 채널 = 기본 거부" 정책 명시 갱신 검토. |
| 3 | 유지보수성 | `NotificationsChannelAuthorizer.authorize`가 `Promise.resolve()` 래퍼를 사용하는 반면 나머지 4개 authorizer는 `async/await` 패턴 사용 — ESLint `require-await` 제약으로 인한 불가피한 선택. RESOLUTION.md W-7에 설명됨. | `notifications-channel-authorizer.ts` L17-25 | 코드 내 `// async 무-await ESLint 위반 방지용 Promise.resolve 래퍼` 주석 1줄 추가 권장. 코드 변경 불필요. |
| 4 | 유지보수성 | 각 authorizer 내 동일 prefix 리터럴이 `matches`의 `startsWith`와 `slice` 두 곳에 각각 등장. 오탈자로 불일치 시 `matches` 통과 후 `slice`가 잘못된 길이를 자름. | 각 `*-channel-authorizer.ts` `matches`/`slice` | W-2 WARNING의 `static readonly PREFIX` 상수화로 동시 해소. |
| 5 | 아키텍처 | `BackgroundRunsService`가 M-7 이후 gateway 직접 의존 제거됐음에도 `executions.module.ts` exports에 계속 포함됨. 다른 소비자 미확인 상태. RESOLUTION.md에 "audit 후 후속 PR 검토"로 기록됨. | `executions.module.ts` exports 배열 | 소비처 audit 후 follow-up PR에서 export 제거 검토. |
| 6 | 아키텍처 | `WorkflowChannelAuthorizer.authorize`에서 `findById` + `.then(() => true).catch(() => false)` 패턴 사용 — 다른 authorizer의 `verifyOwnership` 패턴과 약간 불일치. 인라인 주석으로 의도 설명됨. | `workflow-channel-authorizer.ts` L24-27 | `WorkflowsService`에 전용 `verifyWorkflowOwnership` 메서드 추가 또는 `findById` JSDoc에 소유 검증 겸용 명시. 현 상태 수용. |
| 7 | 부작용 | 도메인 모듈이 authorizer 클래스를 직접 export함으로써 클래스 토큰 직접 주입이 이론적으로 가능. 의도된 소비자는 WS 모듈 `useFactory` 뿐. | `executions.module.ts`, `knowledge-base.module.ts`, `workflows.module.ts` exports | `CHANNEL_AUTHORIZER` 토큰을 통해서만 authorizer를 소비하도록 팀 코드 리뷰 가이드라인 문서화 권장. |
| 8 | 부작용 | `authorize()` 내 `.catch(() => false)` 패턴이 DB 오류를 인가 거부로 위장해 운영 디버깅을 어렵게 만들 수 있음. M-7 이전부터 존재하던 패턴. fail-closed 보안 관점은 올바름. | `background-run-channel-authorizer.ts` L30 / `kb-channel-authorizer.ts` L32 | catch 블록에 `this.logger.warn(...)` 추가로 DB 오류와 인가 거부 구분 가능. M-7 범위 외 개선. |
| 9 | 보안 | `handleSubscribe`에 추가된 `!workspaceId` 가드 — `notifications:` 채널의 JWT에 `workspaceId`가 항상 포함되는지가 런타임에만 검증되는 암묵적 가정. JWT payload 타입이 `{ workspaceId?: string }`(optional). | `websocket.gateway.ts` L190-195 | RESOLUTION.md W-2 DEFER "workspaceId non-optional 강화" 과제와 연관. 현재 방어적 가드로 적절. |
| 10 | 테스팅 | `ExecutionChannelAuthorizer` spec에 `verifyOwnership`이 정상 resolve되는 허가 경로에 대한 테스트 이름이 설계 의도를 충분히 표현하지 않음. `verifyOwnership`은 throw 기반 거부 계약이므로 resolve = 항상 허가. | `execution-channel-authorizer.spec.ts` | 테스트 이름을 `'allows when verifyOwnership resolves (throw = denied, any resolve = allowed)'` 수준으로 강화. 선택적 개선. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | UUID 가드(W-6) 전 채널 일관 적용, fail-closed, IDOR 방어, 에러 정보 비노출 — 모두 양호 |
| architecture | LOW | WARNING 2건: useFactory 명시 집계(신규 채널 추가 시 2곳 편집) + C-2 모듈-레벨 양방향 순환 잔존. 구조적 DIP/Strategy 패턴 달성은 우수 |
| requirement | NONE | 5개 채널 인가 전부 구현, ack 계약 보존. SPEC-DRIFT 2건(kb 비-UUID 선차단 + fail-closed 정책) — spec 갱신 대상 |
| scope | NONE | 모든 변경 파일이 커밋 메시지 및 plan §M-7 범위 내. review/ 산출물 커밋 포함도 규약 준수 |
| side_effect | LOW | WARNING 1건: `BackgroundRunsService` export 유지로 불필요한 서비스 노출 지속. 전역 상태 신규 도입 없음 |
| maintainability | LOW | WARNING 2건: 채널 prefix 이중 하드코딩 + useFactory inject 이중 관리. 직전 리뷰 DEFER 계승. 개수 assertion 봉인 |
| testing | LOW | WARNING 1건: gateway.spec의 useFactory inject 배열이 websocket.module과 이중 관리. 개수 assertion 완화책 동작 중. 전체 테스트 커버리지 우수 |
| documentation | NONE | 채널 authorizer JSDoc, 모듈 인라인 주석, plan §M-7 동기화 모두 양호. 차단 결함 없음 |
| user_guide_sync | NONE | doc-sync-matrix 19개 trigger 매칭 0건. 유저 가이드 동반 갱신 의무 없음 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항을 보고함. 단, security / requirement / scope / documentation / user_guide_sync는 전원 INFO 또는 SPEC-DRIFT 수준이며 WARNING/CRITICAL 없음).

---

## 권장 조치사항

1. **[SPEC-DRIFT — spec 갱신 필수]** `spec/5-system/6-websocket-protocol.md` §3.3 권한 검증 표의 `kb:{documentId}` 행에 "(비-UUID 선차단)" 추가. project-planner 위임.
2. **[SPEC-DRIFT — spec 갱신 검토]** spec §3.3에 "매칭 authorizer 없는 valid 채널 = 기본 거부(fail-closed)" 정책 명시. project-planner 판단.
3. **[WARNING — DEFER 가능]** `useFactory` inject 배열 단일 소스화: `buildChannelAuthorizerProvider()` 헬퍼 export 또는 별도 상수 파일 추출. 현재 개수 assertion(5개)이 봉인 중이므로 즉각 blocking 아님.
4. **[WARNING — DEFER 가능]** 채널 prefix 리터럴 `static readonly PREFIX` 상수화로 `matches`/`slice` 이중 리터럴 제거 + `VALID_CHANNEL_PREFIXES` 단일 소스화.
5. **[WARNING — 후속 과제]** C-2 클러스터 모듈-레벨 양방향 순환 구조적 해소(공유 이벤트 버스 또는 단방향화) 백로그 등록.
6. **[INFO — 즉시 가능]** `notifications-channel-authorizer.ts`에 `Promise.resolve` 래퍼 이유 주석 1줄 추가.
7. **[INFO — 후속 audit]** `BackgroundRunsService` 외부 소비처 audit 후 follow-up PR에서 export 제거 검토.

---

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

**실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync`

**강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별에 의해 제외 |
| dependency | 라우터 선별에 의해 제외 |
| database | 라우터 선별에 의해 제외 |
| concurrency | 라우터 선별에 의해 제외 |
| api_contract | 라우터 선별에 의해 제외 |