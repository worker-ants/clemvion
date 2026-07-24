# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 5건(전부 유지보수성/문서/테스트 보강 성격, 기능 결함 아님). 강제 포함(router_safety) 대상 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | trailing-slash 정규화 로직(`apiBase.replace(/\/$/, "")`)이 `session-store.ts`(신규 `normalizeApiBase`)·`use-widget.ts`(`fetchEmbedConfig`)·`eia-client.ts`(`joinUrl`) 3개 파일에 독립 구현되어 DRY 위반 — 정규화 규칙이 향후 바뀌면(다중 슬래시·대소문자 등) 한 곳만 고치고 나머지를 놓칠 drift 위험 | `codebase/channel-web-chat/src/lib/session-store.ts:37-39`, `codebase/channel-web-chat/src/widget/use-widget.ts`(fetchEmbedConfig), `codebase/channel-web-chat/src/lib/eia-client.ts:21` | 공용 모듈(예 `lib/url-utils.ts`)에 정규화 헬퍼를 두고 3개 호출부가 공유하도록 리팩터링 |
| 2 | Maintainability | 테스트 fixture 리터럴(`JSON.stringify({executionId, token, ...})`) 중복으로, 이번 diff 가 `apiBase` 필드 하나를 추가하기 위해 `use-widget-eager-start.test.ts` 내 15곳 이상을 개별 수정해야 했음 — 다른 두 테스트 파일(`session-store.test.ts`, `use-token-refresh.test.ts`)은 이미 `session(overrides)` 헬퍼로 이 문제를 해소했으나 이 파일만 인라인 리터럴 고수 | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (19곳 인라인 리터럴) | 동일 헬퍼 패턴(`sessionFixtureJson(overrides)`) 도입해 인라인 리터럴 대체 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/7-channel-web-chat/3-auth-session.md` §3.1 의 sessionStorage 스키마 열거(`{executionId, token, expiresAt, endpoints}`)가 이번 diff 로 추가된 신규 필수 필드 `apiBase`(발급 origin 바인딩) 및 "발급 origin 불일치/미기록 시 폐기" 조건을 반영하지 못함. 코드 자체는 의도적·근거 있는 보안 강화(재전송이 apiBase 를 바꿀 때 옛 origin 발급 토큰이 새 origin 으로 유출되는 결함 차단)이며 테스트·mutation 검증으로 고정돼 있어 정확하다 — spec 서술만 낡았다. `4-security.md` 위협 모델에도 이 축(재전송-origin 유출)이 미반영. plan(`webchat-session-apibase-binding.md`) 은 `spec_impact: none` 을 선언했으나 이는 "복원 계약 자체는 안 바뀜"이라는 판단이고, §3.1 이 필드를 문자 그대로 나열한 서술이 사실과 어긋난다는 점과는 별개 문제 | `spec/7-channel-web-chat/3-auth-session.md` §3.1 step 1(1건), `4-security.md`(위협 표 미반영) | 코드는 유지. project-planner 경유로 §3.1 필드 열거에 `apiBase` 추가 + "발급 origin 불일치/미기록 시 폐기" 한 줄 반영. `4-security.md` 위협 표에도 재전송-origin 축 한 줄 추가 검토 |
| 4 | Documentation | 이번 보안 성격 수정(세션↔발급 apiBase 바인딩)에 대한 `CHANGELOG.md` 항목 부재 — 같은 파일(`use-widget.ts`)의 과거 유사(세션/staleness 계열) 수정들은 모두 `## Unreleased — 웹채팅 위젯: ...` 형태의 서사형 CHANGELOG 항목을 남긴 확립된 관례가 있음 | `CHANGELOG.md`(Unreleased 섹션) | 기존 항목과 같은 톤으로 "웹채팅 위젯: 세션 ↔ 발급 apiBase 바인딩(재전송 시 토큰 오전송 방지)" 항목 추가 |
| 5 | Testing | 토큰 갱신(`scheduleRefresh`) 후 저장된 세션에 `apiBase` 가 보존되는지 검증하는 테스트 부재 — 현재는 스프레드(`{...currentSession, token, expiresAt}`)로 암묵 보존되어 정상이나, 향후 `updated` 를 필드 나열 방식으로 리팩터하면 `apiBase` 가 조용히 탈락하고 다음 새로고침 때 이번 PR 의 fail-safe 폐기 로직이 발동해 **정상 세션이 매번 리셋되는 회귀**가 생길 수 있는데 이 테스트로는 못 잡음 | `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:81-90`, 소스: `use-token-refresh.ts` `scheduleRefresh` | 갱신 테스트에 저장된 세션의 `apiBase` 가 원본과 동일함을 단언하는 라인 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `normalizeApiBase` 는 후행 슬래시 1개만 제거 — 중복 슬래시·대소문자·query/fragment 는 원문 그대로 비교되어 가용성 저하(불필요한 재대화) 가능성 있음(보안 완화 실패 아님, fail-closed 유지되므로 공격 표면 아님) | `session-store.ts:37-39` | 필요 시 `new URL(apiBase).origin` 기반 정규화로 확장 가능(필수 아님) |
| 2 | Security | `wc:boot`(postMessage) 경로로 들어오는 `apiBase` 는 query-param 폴백(`safeApiBaseFromQuery`)과 달리 스킴(`http(s)`) 검증을 거치지 않음 — 다만 이 신뢰 경계는 diff 이전부터의 기존 SDK 계약이며 이번 변경이 신규 유발한 표면이 아님 | `use-widget.ts:997-999`, `:99-109`(safeApiBaseFromQuery) | 후속 작업으로 `wc:boot` 경로에도 동등한 스킴 검증 확대 고려(이번 PR 불요) |
| 3 | Side Effect | `PersistedSession.apiBase` 필수 필드 도입으로 배포 시점에 이미 저장돼 있던(구버전) 활성 세션 전체가 fail-safe 로 일괄 폐기됨(진행 중이던 대화 1회 초기화) — plan 에 비용-편익 명시, 전용 회귀 테스트로 고정된 의도된 트레이드오프 | `session-store.ts:13-20`, `:87-96` | 조치 불필요. 원하면 배포 노트에 "이 배포 이후 새로고침 시 대화 1회 초기화 가능" 명시 |
| 4 | Side Effect | `loadSession` 공개 함수 시그니처 변경(breaking) — 저장소 전체에서 프로덕션 호출부는 1곳뿐이고 이미 갱신 확인됨(`tsc --noEmit` 클린) | `session-store.ts:70-74` | 조치 불필요. 향후 계약(2번째 인자=apiBase, 3번째 optional storage) 유지 권장 |
| 5 | Testing | `save → load 라운드트립` 테스트가 `apiBase` 필드 자체의 왕복을 단언하지 않음 — 현재는 `loadSession` 이 파싱 객체를 그대로 반환해 문제없지만, 향후 반환 객체를 필드별로 재구성하는 리팩터가 들어오면 누락을 못 잡음 | `session-store.test.ts:28-33` | `expect(loaded?.apiBase).toBe(API)` 한 줄 추가 |
| 6 | Testing | `normalizeApiBase` 의 중복 슬래시·역방향 대칭 케이스 미검증(기존 `use-widget.ts` 관행을 그대로 따른 것이라 이번 PR 신규 결함 아님) | `session-store.ts:37-39`, `session-store.test.ts:89-94` | 우선순위 낮음. 대칭 케이스 1건 + 이중 슬래시 케이스 1건 추가 고려 |
| 7 | Testing | plan 문서가 주장하는 위젯 통합 mutation RED 건수(18건)와 실측(17건)이 어긋남 — 테스트 자체는 유효(mutate 시 확실히 RED, 대조군 포함), 문서 수치만 오차 | `plan/complete/webchat-session-apibase-binding.md:84` | plan 문서 수치를 실측값(17건)으로 정정 권장(선택, 코드 리뷰 범위 밖일 수 있음) |
| 8 | Documentation | 모듈 최상단 요약 주석이 신규 폐기 트리거("발급 apiBase 불일치/미기록")를 언급하지 않음 — 개별 함수(`loadSession`, `normalizeApiBase`) JSDoc 은 충실히 갱신됨 | `session-store.ts:1-4` | 모듈 개요에 "발급 origin(apiBase) 불일치·미기록이면 폐기" 한 줄 추가 |
| 9 | Scope | 신규 `describe` 블록 앞 빈 줄 2개 연속(포맷팅 잡음, 기능 무관) | `session-store.test.ts:62-63` | 빈 줄 1개로 정리(선택) |
| 10 | Requirement | 지정 3개 테스트 파일 동시 실행 시 산발적 vitest flake 1회 관측 — 전체 스위트(400/400)·해당 서브셋 반복 재실행(84/84 ×2) 모두 그린이라 이번 diff 로직 결함으로 재현되지 않음(러너/워커 스케줄링 관련 flake 추정) | `use-widget-eager-start.test.ts` | 조치 불필요(비차단). 반복 재현 시 별도 조사 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `apiBase` 발급-origin 바인딩 fail-closed 설계 정확, 신규 취약점 없음. 정규화 경계·wc:boot 스킴검증 등 INFO만 |
| requirement | LOW | 핵심 로직 완전·정확 구현, mutation 검증 통과. spec §3.1 필드 열거 SPEC-DRIFT 1건(문서만 갱신 필요) |
| scope | NONE | 변경 7파일 전부 단일 작업 범위 내, 관련 없는 리팩토링 없음. 포맷팅 잡음 1건만 |
| side_effect | LOW | `loadSession` breaking 시그니처 변경·레거시 세션 일괄 폐기 모두 의도된 트레이드오프로 확인, 회귀 없음 |
| maintainability | LOW | trailing-slash 정규화 3중 중복(DRY) + 테스트 fixture 리터럴 중복 WARNING 2건 |
| testing | LOW | 직접 mutation 실측으로 회귀 테스트 RED 전환 확인(vacuity 배제). refresh 시 apiBase 보존 테스트 부재 WARNING 1건 + 경미한 보강 항목 |
| documentation | LOW | 코드 자체 문서화 품질 우수. spec 필드 열거 drift + CHANGELOG 누락 WARNING 2건 |
| user_guide_sync | NONE | 매트릭스 22행 전수 매칭 결과 trigger 0건, 동반 갱신 대상 없음 |

## 발견 없는 에이전트

- user_guide_sync — 변경 파일이 유저 가이드 동반 갱신 매트릭스의 어떤 trigger 행과도 매칭되지 않음(신규 사용자 가시 문자열 없음, `.tsx` 아닌 `.ts` 전용 변경, backend auth 모듈과도 무관).

## 권장 조치사항

1. `spec/7-channel-web-chat/3-auth-session.md` §3.1 의 세션 스토리지 필드 열거에 `apiBase` 추가 + "발급 origin 불일치/미기록 시 폐기" 조건 반영 (SPEC-DRIFT, project-planner 경유, 코드 변경 불요).
2. `CHANGELOG.md` 에 이번 보안성 수정 항목 추가(기존 관례와 동일 톤).
3. `use-token-refresh.test.ts` 에 갱신 후 `apiBase` 보존 여부를 단언하는 테스트 추가(향후 조용한 회귀 방지).
4. trailing-slash 정규화 로직을 공용 모듈로 추출해 `session-store.ts`/`use-widget.ts`/`eia-client.ts` 3중 중복 해소.
5. `use-widget-eager-start.test.ts` 의 인라인 세션 fixture 리터럴을 다른 두 테스트 파일과 같은 헬퍼 패턴으로 통일.
6. (낮은 우선순위) `save → load 라운드트립` 테스트에 `apiBase` 왕복 단언 추가, 모듈 최상단 주석에 신규 폐기 트리거 언급, plan 문서의 mutation 건수(18→17) 정정, `session-store.test.ts` 포맷팅 잡음(중복 빈 줄) 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 완료(누락 없음)
  - **제외**: 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 변경(sessionStorage 필드 추가·비교 로직)과 성능 관련성 낮음 |
  | architecture | router 판단 — 아키텍처 구조 변경 없음(기존 함수 시그니처 확장 수준) |
  | dependency | router 판단 — 신규/변경 외부 의존성 없음 |
  | database | router 판단 — DB 스키마·쿼리 변경 없음(클라이언트 sessionStorage 전용) |
  | concurrency | router 판단 — 동시성/레이스 관련 로직 변경 없음 |
  | api_contract | router 판단 — 외부 API 계약(엔드포인트/페이로드) 변경 없음 |