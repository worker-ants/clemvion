# 테스트(Testing) 리뷰 — trigger-uuid-and-guide-codes

## 검토 범위

`rotateBotToken` 의 `:id` `ParseUUIDPipe` 누락 수정, 이를 저장소 전수로 고정하는 신규
`param-uuid-pipe` 가드(순수 로직 + spec + fixture), `TriggersController` HTTP 왕복 테스트
3케이스, 그리고 유저 가이드/`backend-labels.ts` 의 `TRIGGER_NOT_FOUND` 귀속 정정을 테스트
관점에서 검토했다. `codebase/backend/src/common/filters/http-exception.filter.ts` ·
`codebase/backend/src/common/decorators/current-user.decorator.ts` · 컨트롤러 전체
소스를 직접 열어 diff 만으로는 안 보이는 부분(필터의 무인자 생성자, `@WorkspaceId()`/
`@CurrentUser()` 가 순수 파라미터 데코레이터인지 여부, 스캔 루트 밖에 컨트롤러가 없는지)을
실측했다. 저장소 파일은 건드리지 않았다(`git status --short` 로 뮤테이션 없음 확인 불필요 —
읽기만 수행).

## 발견사항

- **[INFO]** HTTP 왕복 테스트가 auth/roles 체인 없이 파이프 축만 겨냥한다 — 제목만 보면 오인 소지
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:229` (describe 제목),
    `:245-261` (`Test.createTestingModule` — `TriggersController` 만 등록, `RolesGuard`·
    `AuthGuard`·전역 `ValidationPipe` 없음)
  - 상세: `@CurrentUser('sub')` 는 `request.user` 를 그대로 읽는 순수 파라미터 데코레이터라
    (`common/decorators/current-user.decorator.ts:15-17`), 이 테스트 모듈에서는 인증 미들웨어가
    없어 `request.user` 가 항상 `undefined` 다. `@Roles('editor')` 도 이 모듈에는 그 메타데이터를
    소비하는 가드가 없어 완전히 무력하다. 즉 이 describe 는 **`:id` 파이프 + 에러 봉투** 만
    검증하고 인증·인가 계층은 전혀 태우지 않는다. 헤더 주석(`237-239`행)이 `@WorkspaceId()` 축을
    고정한 이유는 적어 두었지만, "HTTP 왕복" 이라는 제목이 인증까지 포함한 통합 테스트로 오독될
    여지가 있다.
  - 제안: 의도된 축소 범위라면(실제로 그렇게 보인다) describe 나 파일 헤더 주석에 "인증/인가는
    이 스위트의 범위 밖" 이라는 한 줄을 추가해 다음 사람이 이 테스트를 인증 회귀 테스트로 오인해
    확장하지 않도록 한다. 코드 결함은 아니다.

- **[INFO]** 성공 케이스가 4개 인자 중 1개(`id`)만 배선을 확인한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:291-299`
    (`'[대조군] 정상 UUID + 정상 본문 → 200...'`)
  - 상세: `rotateBotToken.mock.calls[0][0]).toBe(VALID_UUID)` 만 단언하고
    `workspaceId`/`newBotToken`/`userId` 는 검증하지 않는다. 이 describe 의 목적이 "파이프가
    정상 입력을 막지 않는다" 는 것뿐이라 축소가 합리적이며, 인자 전체 배선은 같은 파일의
    `'TriggersController — 행위자(userId) 배선'` describe(`188-199`행, `rotateBotToken` 케이스)가
    이미 전담한다 — 실질적 커버리지 갭은 아니다. 다만 두 describe 가 같은 메서드를 서로 다른
    이유로 부분 검증한다는 사실이 파일 어디에도 교차 참조되어 있지 않아, 한쪽만 본 리뷰어가
    "인자 배선이 검증 안 됐다" 고 오판할 소지가 있다.
  - 제안: 필수는 아니나, HTTP 왕복 describe 헤더 주석에 "인자 전체 순서 검증은 `'행위자(userId)
    배선'` describe 참조" 한 줄을 추가하면 두 스위트의 역할 분담이 명시된다.

- **[INFO]** 유저 가이드 식별자(에러 코드·환경변수)의 실재 여부를 세는 자동 가드가 아직 없다 —
  이미 트래커에 등재된 기지(旣知) 갭
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신설 항목 "가이드가 적는
    식별자(에러 코드·환경변수)가 실재하는지 세는 가드가 없다"), `plan/in-progress/
    trigger-uuid-and-guide-error-codes.md:190` (§C "이번 배치에서 하지 않는 것")
  - 상세: 이번 배치가 고친 두 결함 클래스 중 `ParseUUIDPipe` 누락은 AST 전수 가드
    (`param-uuid-pipe`)로 회귀가 고정됐지만, `TRIGGER_NOT_FOUND` 오귀속·`MCP_ALLOW_INSECURE_URL`
    오타 쪽은 1회성 정규식 스윕으로 손으로 고쳤을 뿐 커밋된 가드가 없다. 개발자 스스로 "다음
    사람이 같은 발견을 같은 방식으로 반복해야 한다" 고 정확히 진단하고 후속 항목으로 등재했다 —
    은폐된 갭이 아니라 명시적으로 유예된 갭이다.
  - 제안: 처분 변경 불요(이미 등재됨). 리뷰 관점에서는 이 배치의 "테스트 존재 여부" 축을 100%로
    보지 않는 근거로만 기록해 둔다.

## 강점 (참고용, 조치 불요)

- `param-uuid-pipe.spec.ts` 가 vacuity floor(스캔 대상 0건 방지)를 판정 로직과 **같은 루프에서
  나온 `scanned` 값**으로 검증하고, 이를 뮤테이션(M8: `scanned` 상수 고정 → 예측 GREEN, 실측
  GREEN)으로 "floor 가 무엇을 못 잡는지" 까지 문서화했다 — floor 의 한계를 스스로 인정하는
  드문 형태.
  (`codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:57-67`)
- `@ApiExcludeEndpoint()` 면제 방향을 **양쪽**에서 캐너리로 고정했다 — `excluded`(파이프 있음,
  면제)는 0건, `excludedPipeless`(파이프 없음, 면제)는 파이프 축만 위반으로 남는 것을 별도
  fixture 로 검증해, "면제가 문서 축만 끄는가 / 판정 전체를 끄는가" 를 실제로 가른다
  (`fixtures/param-uuid-pipe/sample.controller.ts:62-84`,
  `param-uuid-pipe.spec.ts:100-114`).
- HTTP 왕복 3케이스가 대조군을 세 개 둬 "무엇이 400 을 냈는지" 를 구분한다(파이프 vs 핸들러
  vs 정상) — 단일 400 단언이 "무언가 거부됐다" 이상을 말하지 못하는 흔한 vacuous 패턴을
  피했다. 첫 판본이 `@WorkspaceId()` 부재로 세 케이스가 같은 코드로 수렴하는 무의미한 대조군이
  됐던 것을 `X-Workspace-Id` 헤더로 고정해 재발을 막은 이력도 plan 에 남아 있다.
- 가드 로직(`collectMethodViolations`)이 판정과 카운트를 분리하지 않고 한 루프에서 반환하도록
  설계되어, "판정 조건과 카운트 조건이 갈릴 수 있다" 는 구조적 위험을 원천 차단한다.

## 요약

이번 PR 은 실제로 방치돼 있던 500 마스킹 결함(`rotateBotToken` 의 `:id`)을 고치면서, 같은
클래스의 재발을 AST 전수 가드로 봉인하고 HTTP 계층까지 3종 대조군으로 검증했다. 가드
로직·fixture·spec 이 모두 상호 뮤테이션 테스트(M1~M10, 예측/실측 병기)를 거쳤고, vacuity
floor·면제 방향 캐너리 등 이 저장소가 과거에 반복 지적당했던 실패 패턴들을 선제적으로
막아 두었다. 남은 것은 실질적 결함이 아니라 문서화 여지(HTTP 왕복 테스트의 범위 한정을 더
명시)와 이미 트래커에 등재된 후속 가드 부재뿐이다. `codebase/**` 를 바꿔야 하는 새 발견은
없다.

## 위험도

LOW
