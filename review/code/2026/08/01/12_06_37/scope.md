# 변경 범위(Scope) 리뷰 — 감사 로깅 커버리지 갭 13개 액션 구현

## 방법론

프롬프트에 제공된 19개 파일의 전체 컨텍스트 외에, 크기 제한으로 프롬프트에 실리지 못한
`triggers.service.ts`/`triggers.service.spec.ts`/`workflows.service.ts`/`workflows.service.spec.ts`
4개 파일은 `Read` 로 직접 열어 확인했다. 또한 `git diff origin/main...HEAD` 로 실제 변경분을
파일별로 전수 대조해, "무엇이 실제로 바뀌었는가"를 프롬프트의 전체 파일 컨텍스트가 아니라
diff 자체를 근거로 판단했다 (`git diff -b`로 공백 제외 비교도 병행해 재포맷과 실질 변경을
분리했다).

## 발견사항

- **[INFO]** `duplicate()` 리팩터링으로 인한 대량 재들여쓰기가 실질 변경과 섞여 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:294-394` (`duplicate()` 메서드 본문)
  - 상세: 트랜잭션 커밋 뒤 감사 기록을 추가하기 위해 `return this.dataSource.transaction(...)` 을
    `const duplicated = await this.dataSource.transaction(...)` 로 바꿨다. 이 한 줄 변경이
    Prettier 의 인자 줄바꿈 규칙을 트리거해 콜백 본문 전체(대략 90줄)가 한 단계 더 들여쓰기
    되었고, 그 결과 `git diff` 상으로는 246줄이 변경된 것으로 보인다. `git diff -b`(공백 무시)로
    대조한 결과 실질 변경은 재포맷 부분을 제외하면 `recordAudit` 호출 삽입 및 관련 주석 몇 줄뿐이며,
    콜백 내부 로직(노드/엣지 복사·remap 로직)은 문자 그대로 동일하다. 감사 로깅을 트랜잭션 커밋
    **이후**에 남기려면 트랜잭션 결과를 변수로 받아야 하므로 이 재포맷은 기능 변경에 종속된
    불가피한 부작용이며, 별도의 손질(gratuitous refactor)이 아니다.
  - 제안: 조치 불요. 리뷰어가 diff 를 읽을 때는 `git diff -b`(또는 동등 도구)로 재확인해 재포맷과
    실질 변경을 분리해서 보는 것을 권장한다는 점만 기록해 둔다.

## 스코프 대조 상세 (문제 없음으로 판정된 항목)

- **audit-action.const.ts**: `AUDIT_ACTIONS` 에 13개 신규 액션(`workflow.*` 3개, `trigger.*` 3개,
  `schedule.*` 3개, `model_config.*` 4개) 추가 + 관련 JSDoc 갱신뿐. spec §4.1 커버리지 갭과
  1:1 대응하며 여분의 액션·리소스는 없다.
- **model-config / schedules / triggers / workflows 의 `*.module.ts`(4개)**: 각각 `AuditLogsModule`
  import 한 줄과 `imports` 배열 항목 추가만 있고, 기존 import·provider 순서·다른 모듈 설정은
  손대지 않았다.
- **`*.controller.ts`(4개)**: `create`/`update`/`remove`(+ model-config 는 `setDefault`) 시그니처에
  `@CurrentUser('sub') userId: string` 파라미터를 추가하고 서비스 호출에 그대로 전달하는 기계적
  변경뿐이다. `workflows.controller.ts` 의 `create()`는 이미 `user.sub` 를 서비스에 넘기고 있어
  변경이 필요 없었고, 실제로 손대지 않았다 — 불필요한 파라미터 중복 추가를 하지 않은 점에서 오히려
  스코프를 절제한 사례다. EIA(`rotate-secret`/`revoke-token`)·`rotateBotToken` 등 CRUD 가 아닌
  트리거 엔드포인트는 전혀 건드리지 않았다 — spec §4.1 이 요구하는 CRUD 범위와 정확히 일치한다.
- **`*.service.ts`(4개)**: 각 서비스에 `private recordAudit()` 헬퍼 1개와, `create`/`update`/`remove`
  (+ model-config `setDefault`, workflow `duplicate`)에서의 호출만 추가됐다. 트랜잭션/외부 호출
  (BullMQ 등록, secret store 마이그레이션, chatChannel setup) 성공 여부와 무관하게 "커밋 직후"
  기록되도록 순서를 고정한 것은 감사 로깅 자체의 정확성 요구사항이지 별도 리팩터링이 아니다.
  `triggers.service.ts` 의 `create`/`update` 에서 조기 `return` 을 `let result = saved` 로 바꾼 것도
  분기별 중복 감사 기록(테스트가 "W5 회귀"로 명명한 버그)을 피하기 위한 최소 구조 변경이다.
  DTO·엔티티·다른 비즈니스 로직은 변경되지 않았다.
- **`*.spec.ts`(8개)**: 시그니처 변경(`userId` 파라미터 추가)에 따른 기존 테스트 호출부 갱신
  (`service.create(...)` 등에 `'u-spec'` 추가) + `AuditLogsService` mock 등록 + 신규 "감사 로깅"
  describe 블록 추가로 구성된다. 기존 단언(assert) 값 자체를 변경한 곳은 없다 — 전부 인자 추가에
  따른 순수 배관(plumbing) 변경과 신규 테스트 추가다. `model-config.controller.spec.ts` 의 기존
  `WARNING#1~#3 fix` 주석은 이번 diff 이전부터 있던 내용으로, 이번 변경이 만든 것이 아니다.
- **비대상 파일 전수 확인**: `git diff origin/main...HEAD --name-only -- codebase/` 결과가 정확히
  프롬프트의 19개 파일과 일치했다 — `codebase/` 하위에서 4개 모듈(`audit-logs`/`model-config`/
  `schedules`/`triggers`/`workflows`) 밖의 파일, DTO, 엔티티, 공통(`common/`) 코드, 설정 파일
  변경은 전혀 없다.
- **이전 라운드에서 이미 조치된 스코프 이슈**: 커밋 `950d1aad4`(`style(backend): 포맷 정정 +
  eslint --fix 의 범위 밖 hunk 재차단`)에서 `eslint --fix` 가 모듈 전체를 대상으로 실행되며
  `notification-config.dto.ts` 에 무관한 변경을 주입했던 것을 되돌린 이력이 있다. 현재
  `origin/main` 대비 해당 파일의 diff 는 0줄로, 이 문제는 이번 리뷰 대상 상태에서 완전히
  해소되어 있다.
- **CHANGELOG.md / plan/in-progress/spec-sync-auth-gaps.md**: 리뷰 대상 19개 파일에는 포함되지
  않지만 같은 커밋 세트에 존재한다. 두 파일 모두 이번 감사 로깅 작업 자체를 기술하는 통상적인
  변경 로그·plan 추적 갱신이며(CLAUDE.md 의 "완료된 작업"/"진행 중 작업" 규약과 일치), 무관한
  내용은 섞여 있지 않다.

## 요약

19개 대상 파일의 실제 diff(`git diff origin/main...HEAD`)를 전수 대조한 결과, 모든 변경이
"spec §4.1 감사 로깅 커버리지 갭 13개 액션 구현"이라는 단일 목적에 정확히 대응한다 — 신규
`AUDIT_ACTIONS` 상수, `AuditLogsModule` 배선, 컨트롤러의 `userId` 파라미터 배관, 서비스의
`recordAudit` 헬퍼와 호출 지점(커밋 후 고정), 그리고 이에 종속된 테스트 갱신뿐이다. 의도 밖
리팩터링·기능 확장·무관한 파일 수정·불필요한 임포트/설정 변경은 발견되지 않았고, `codebase/`
diff 파일 목록이 프롬프트의 19개 파일과 정확히 일치함을 확인했다. `workflows.service.ts` 의
`duplicate()` 재들여쓰기는 diff 상 눈에 띄게 크지만 `git diff -b` 대조로 실질 변경이 아님을
확인했다(불가피한 Prettier 부작용). 이전 리뷰 라운드에서 발견된 `eslint --fix` 범위 밖 변경
(`notification-config.dto.ts`)도 이미 완전히 되돌려져 있다.

## 위험도

NONE
