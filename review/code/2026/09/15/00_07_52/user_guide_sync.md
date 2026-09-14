# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 범위

`.claude/config/doc-sync-matrix.json` (rows 21개, SSOT) 을 Read 하고 `PROJECT.md` §변경
유형 → 갱신 위치 매핑 본문을 보조로 적재했다. 변경 set(코드 19개 파일: `CHANGELOG.md`,
`hooks.service.{ts,spec.ts}`, `schedules.service.{ts,spec.ts}`,
`triggers/{__test-utils__/trigger-transaction-mock.ts, chat-channel-binder.service.ts,
chat-channel-input-rules.{ts,spec.ts}, trigger-config-lock.{ts,spec.ts},
triggers.service.{ts,spec.ts}, triggers.web-chat.spec.ts}`,
`repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts, endpoint-path-conflict-wrap.spec.ts,
fixtures/endpoint-path-save.fixture.ts}`, `test/trigger-config-lost-update.e2e-spec.ts`,
`plan/in-progress/trigger-config-lost-update.md`)를 21개 trigger 각각에 대조했다. 나머지
파일(20번 이후)은 이전 리뷰 라운드(2026-09-14 18:17~23:38, `review/code/2026/09/14/**`)의
산출물로 이번 변경 set 의 코드가 아니라 대조 대상에서 제외했다.

이 변경은 트리거 config 의 lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를
되돌려 인입 웹훅 서명 검증이 fail-open 되던 경합)를 advisory lock + 락 안 재읽기 +
컬럼 한정 `update()` 로 막는 순수 concurrency 버그 수정이다.

## 매트릭스 21개 trigger 대조 결과

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 변경 파일 0건. 불일치.
- **신규 UI 문자열** (`codebase/frontend/src/**/*.tsx`) — `codebase/frontend/**` 전체 변경 0건. 불일치.
- **신규 위젯 chrome 문자열** (`codebase/channel-web-chat/**`) — 변경 0건. 불일치.
- **통합 신규/제공자 변경** — 신규/변경 provider 없음(기존 chat-channel 트리거 내부 동시성
  수정일 뿐 provider 계약·설정 UI 변경 아님). 불일치.
- **유저 가이드 신규 섹션 디렉토리** (`content/docs/*/`) — 신규 디렉토리 없음. 불일치.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 컨트롤러·DTO 파일 0건. 이전 라운드
  `api_contract.md`(18:17:44)가 컨트롤러/DTO/라우트 미변경을 확인한 것과 일치. 불일치.
- **신규 BullMQ 큐** — `system-status.constants.ts` 미변경. 불일치.
- **신규 warningCode / errorCode 발행** — `warningRules`·`error-codes.ts` 변경 0건. `backend-labels.ts`
  갱신 요구 없음. 불일치.
- **신규 cross-cutting enum / backend zod ui.label 등 / handler output field** — 해당 패턴
  변경 0건. 불일치.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`, semantic) — glob 미매칭
  (`modules/auth/**` 아래 파일 0건). semantic 판단도 재검토했다: 이 수정이 다루는 것은
  `chatChannel.inboundSigningRef` — **외부 웹훅 인입 서명(HMAC) 검증**의 lost-update 이지,
  사용자 로그인·세션·워크스페이스 멤버 권한이 아니다. 매트릭스가 이 trigger 에 대해 지목하는
  타겟(`07-workspace-and-team/` — 워크스페이스/팀/초대/역할 안내)과 웹훅 서명 키 보존은 문서
  독자 관점에서 다른 층이라 semantic 불일치로 판단했다(그레이존으로 인지했음을 기록). 흐름
  변경 시 요구되는 e2e 보강도 `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  로 이미 이번 변경 set 안에 포함돼 있어, 설령 매칭된다 해도 e2e 요건은 충족된 상태다.
- **AuthConfig type enum 변경** — 변경 0건. 불일치.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 변경 0건. 불일치.
- **실행·디버깅 흐름 변경** — 실행 엔진 자체(`ExecutionEngine`)나 디버그 로깅·run 화면 관련
  변경 없음. `engine.execute` 호출부는 그대로이고 변경 대상은 트리거 config 영속화 경로뿐이라
  사용자에게 보이는 실행/디버깅 흐름의 변화가 아니다. 불일치.
- **환경 변수·기동 방법·런타임 변경** — 해당 없음.
- **spec 신규/대규모 변경** — `spec/**` 변경 0건.
- **user-guide GUI 흐름 절 신규/변경** — `content/docs/02-nodes/**`, `content/docs/06-integrations-and-config/**` 변경 0건.
- **spec 자체 결함 발견** — 해당 없음.

21개 trigger 전부 불일치(글로브 매칭 0, semantic 판단도 0)로 확인했다. `CHANGELOG.md` 갱신은
매트릭스 대상이 아니라 이 PR 자체의 변경 이력 기록이며, `plan/in-progress/trigger-config-lost-update.md`
는 작업 추적 문서로 별도 조건(`spec_impact` 등)은 developer 워크플로 영역이지 본 리뷰 관점
밖이다.

## 참고

동일 변경 set 에 대한 선행 리뷰 라운드(`review/code/2026/09/14/20_49_15/user_guide_sync.md`,
`21_18_21/user_guide_sync.md`, `21_50_09/user_guide_sync.md` 등, 09/14 18:17~23:38 전체
10라운드)가 모두 동일하게 "매칭 trigger 0건 / 위험도 NONE" 으로 수렴했다. 이번 라운드도
독립적으로 21개 trigger 를 재대조해 같은 결론에 도달했다.

## 요약

변경 set 은 `modules/triggers`·`modules/hooks`·`repo-guards`(정적 가드) 내부에 국한된 순수
concurrency/lost-update 버그 수정(advisory lock + 락 안 재읽기, `save()` → `update()` 컬럼
한정화, 정적 가드의 `manager.transaction` 콜백 추적 보강)과 그에 딸린 테스트·CHANGELOG·plan
갱신이다. `codebase/frontend/**`, `codebase/channel-web-chat/**`,
`codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/**`,
`codebase/backend/src/modules/auth/**`, `spec/**`, `content/docs/**` 어디에도 변경이 없어
doc-sync-matrix 의 21개 trigger 중 매칭되는 것이 없다(글로브 매칭 0 / semantic 판단도 0).
유저 가이드 동반 갱신 관점에서 발견사항·누락은 0건이다.

## 위험도

NONE
