# 변경 범위(Scope) 리뷰

## 검증 방법

- `git diff --stat origin/main...` 로 실제 변경 파일 목록을 프롬프트에 나열된 17개 파일과
  전수 대조 — **정확히 일치**한다(숨겨진/누락된 파일 없음).
- `MCP_ALLOW_INSECURE_URL` / `TRIGGER_NOT_FOUND` / `RESOURCE_NOT_FOUND` 관련 주장은
  `grep` 으로 직접 재확인했다(아래 근거 참조).
- `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 전문을 읽고 이 배치가 스스로
  정의한 범위(A: `rotateBotToken` UUID 파이프 누락, B: 유저 가이드/코드 주석의 오귀속 식별자
  6곳 + MCP 환경변수명 오기 2곳, C: 스코프 밖 항목의 등재-only)와 실제 diff 를 대조했다.

## 발견사항

- **[INFO]** `auth.controller.ts` 의 `switchWorkspace` 수정은 태스크명("trigger-uuid")이
  가리키는 컨트롤러가 아니다
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:436-440` (`@ApiParam` 에
    `format: 'uuid'` 추가)
  - 상세: 이 배치의 핵심은 `TriggersController.rotateBotToken` 인데, 새로 만든 저장소 전수
    가드(`param-uuid-pipe`)를 **베이스라인 0** 으로 두려다 보니 같은 결함 클래스가 `triggers`
    바깥의 `auth` 모듈에도 1건 있음을 발견해 같이 고쳤다. `plan/in-progress/
    trigger-uuid-and-guide-error-codes.md` §A 표와 CHANGELOG.md 양쪽에 그 사실과 근거
    (`format` 키만 빠져 있었고 런타임 파이프는 이미 있었다는 점)가 명시돼 있어 은폐된
    drive-by 수정은 아니다. 다만 "trigger 하나의 UUID 파이프를 고친다"는 태스크명 관점에서는
    diff 가 `auth` 모듈까지 넓어진 것이 사실이므로 스코프 리뷰 관점에서 기록해 둔다.
  - 제안: 조치 불필요(이미 문서화됨). 다음에 유사 상황(전수 가드의 베이스라인을 0으로
    맞추다 인접 모듈 결함을 발견)이 생기면 커밋 메시지/CHANGELOG 에 "가드 도입에 딸려온
    부수 수정"임을 지금처럼 명시하는 관행을 유지할 것.

- **[INFO]** 서로 다른 두 문제 축(A: 백엔드 런타임 검증 버그, B: 프런트엔드 문서·i18n 라벨의
  존재하지 않는 식별자 서술)이 한 배치·한 세션에 묶여 있다
  - 위치: 태스크 전체 — `codebase/backend/src/modules/triggers/**`,
    `codebase/backend/src/repo-guards/**` (축 A) vs.
    `codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/**` (축 B)
  - 상세: 두 축은 코드/문서 표면이 겹치지 않고 소비자도 다르다(전자는 API 클라이언트, 후자는
    문서 독자). `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 도입부가
    "둘은 다른 축처럼 보이지만 같은 성질이다(선언과 실제가 어긋난 자리가 조용하다)"라고
    명시적으로 묶은 이유를 밝히고 있고, 상위 트래커(`spec-draft-nullable-notation-followups.md`)
    의 인접한 두 체크리스트 항목을 같은 세션에서 닫는 정상적인 배치 처리로 보인다. 다만 리뷰
    표면이 backend 런타임 계약과 frontend 문서 정확성 양쪽에 걸쳐 있어, 순수 "범위" 기준으로는
    두 개의 별도 PR 로 나눌 수도 있었던 지점이다.
  - 제안: 조치 불필요(의도적 배치이며 근거가 충분히 기록됨). 향후 유사 배치 시 PR 설명/커밋
    메시지에서 두 축을 구분해 리뷰어가 각 축을 독립적으로 판단할 수 있게 하면 충분하다.

- **[INFO]** 단일 엔드포인트 결함 수정치고 신규 인프라(저장소 전수 가드) 볼륨이 크다
  - 위치: 신규 파일 3개 — `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`
    (222줄), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (123줄),
    `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
    (96줄)
  - 상세: `rotateBotToken` 하나의 `ParseUUIDPipe` 누락을 고치는 데 그치지 않고, 같은 결함
    클래스가 재발하지 않도록 AST 기반 전수 가드·대조군 fixture·vacuity floor 를 새로
    도입했다. 이는 이 저장소에 이미 존재하는 `repo-guards/` 관례(`dto-class-name-collision`,
    `swagger-dto-contract` 등 형제 가드)를 따르는 것이고, 3차례의 선행 `/ai-review` 라운드
    (`20_01_18`·`20_26_58`·`20_53_01`)에서 이미 이 설계를 놓고 논의·수정이 이루어졌다. 요청하지
    않은 기능 확장(over-engineering)이라기보다 이 코드베이스의 확립된 "결함 발견 → 가드로
    고정" 패턴을 따른 것으로 판단되나, diff 볼륨의 대부분(987줄 중 약 440줄)을 차지하므로
    범위 인지 목적으로 기록한다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 배치와
  직접 관련 없는 후속 백로그 3건(§C, `LLM_AUTH_ERROR` 등 미구현 에러 코드·`ERROR_KO` 미배선·
  spec 문서 2건)이 함께 등재됐다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3141` 이하
  - 상세: 코드는 건드리지 않고 "이번 배치에서 하지 않는다"고 명시하며 등재만 하는 정상적인
    plan 위생 행위다(`.claude/docs/plan-lifecycle.md` 관례와 일치). 실제 코드 변경이 아니므로
    스코프 위반은 아니다.
  - 제안: 조치 불필요.

포맷팅/주석/임포트/설정 관점에서는 실질 변경과 무관한 잡음(의미 없는 공백 재정렬, 미사용
임포트, 무관한 리팩토링)이 발견되지 않았다. 신규 임포트(`INestApplication`, `Test`,
`supertest`, `GlobalExceptionFilter`)는 모두 같은 파일 내에서 실사용된다.

## 요약

diff 는 자체 plan 문서(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)가 명시적으로
정의한 두 축(A: `rotateBotToken` UUID 파이프 누락 + 전수 가드, B: 유저 가이드·i18n 라벨의
존재하지 않는 식별자 6곳 + 환경변수명 오기 2곳)과 정확히 일치하며, `git diff --stat` 대조 결과
숨겨진 파일도 없다. `auth.controller.ts` 의 부수 수정과 두 문제 축의 동시 배치는 모두 plan에
근거와 함께 명시돼 있어 은폐된 스코프 확장으로 보기 어렵다. 가드 인프라 신규 도입은 볼륨은
크지만 저장소의 기존 관례를 따른 것이고 이미 3라운드의 리뷰를 거쳤다. 요청 이상의 리팩토링,
무관한 파일 수정, 의미 없는 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

LOW
