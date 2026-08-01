# 변경 범위(Scope) 리뷰 — 감사 로깅 커버리지 갭 13개 액션 구현 (4차 리뷰 조치 포함)

## 방법론

프롬프트는 20개 파일의 "전체 파일 컨텍스트"만 제공하고 diff 블록은 없었다. 대상 파일 목록이
`git diff origin/main...HEAD --name-only -- codebase/` 결과와 정확히 일치해(20/20), 이번
프롬프트는 origin/main 대비 전체 기능 diff의 재검토임을 확인했다. 이전 라운드(`12_06_37/scope.md`)가
이미 이 전체 diff를 대조해 위험도 NONE으로 판정했으므로, 이번 라운드는 그 이후 실제로 추가된
커밋(`db7dbd468`→`HEAD`: `4b9f50a87` "4차 리뷰 조치" + `d538d909b` "prettier 포맷")의 diff를
`git diff db7dbd468..HEAD -- codebase/`(및 `-b` 공백무시 대조)로 전수 확인하는 데 집중했고,
그 결과를 커밋 메시지가 선언한 항목(C1/W1/W2·W5/W4/W7)과 1:1 대조했다.

## 발견사항

없음.

## 스코프 대조 상세

- **C1 (`triggers.service.ts`)**: `update()` 내부에서 `syncScheduleActivation`(BullMQ) 호출과
  `recordAudit` 호출의 **순서만** 맞바꿨다. 로직·조건·다른 호출부는 문자 그대로 동일 — 순수 순서
  교정 + 갱신된 주석뿐이다. 커밋 메시지의 "같은 함수의 다른 두 외부 호출은 원칙대로 뒤에 두고 이
  하나만 앞에 남아 있었다"는 서술이 diff와 정확히 일치한다.
- **W1 (`workflows.service.ts` `importWorkflow`)**: 트랜잭션 결과를 `const imported = await ...`로
  받도록 바꾸고, 커밋 뒤 `recordAudit({..., action: WORKFLOW_CREATED, details: { imported: true }})`
  호출과 `return imported;`를 추가했다. 트랜잭션 콜백 내부 로직(노드/엣지 생성)은 손대지 않았다.
- **W2/W5 (`schedules.service.spec.ts`, `workflows.service.spec.ts`)**: 각각 `update()`/`duplicate()`의
  커밋→감사→외부호출 순서 회귀 테스트 1건씩 추가. 프로덕션 코드 변경 없이 테스트만 추가된 것으로
  보아, 서비스 코드의 순서는 이미 올바르고 커버리지 갭만 메운 것으로 판단된다(회귀 방지 목적에
  부합, 기능 확장 아님).
- **W4 (`audit-action.const.ts`)**: JSDoc 블록에 "1:1 결합 리소스는 주 리소스만 기록한다"는 설계
  근거 단락만 추가했다. 코드 변경 없음 — 이미 구현되어 있던 Schedule↔Trigger 상호 직접 쓰기
  동작(다른 라운드에서 이미 구현·리뷰됨)을 사후 명문화한 것으로, 새 동작을 만들지 않는다.
- **W7 (`audit-log-response.dto.ts`)**: Swagger `description` 리터럴에서 액션 목록을 직접 나열하던
  부분을 "SoT는 `AUDIT_ACTIONS`" 참조로 교체했다. API 응답 스키마·필드·타입은 변경되지 않았고
  문서 문자열만 바뀌었다 — DRY 목적의 문서 수정으로 이번 감사 로깅 작업 범위 안이다.
- **prettier 포맷 커밋(`d538d909b`)**: `workflows.service.spec.ts` 단 1개 파일, W5로 방금 추가한
  콜백의 줄바꿈만 재포맷했다. 커밋 메시지 자체가 "--fix 대상을 해당 파일 1개로 좁혔다 — 모듈
  전체에 돌리면 범위 밖 hunk 가 다시 유입된다(2·3차에서 실제로 두 번 났다)"고 명시하며, 실제로
  `git show --stat` 결과도 그 1파일만 변경됐다. 과거 라운드에서 반복됐던 `eslint/prettier --fix`
  범위 이탈 문제에 대한 학습이 이번엔 정확히 적용됐다.
- **비대상 파일**: 이번 델타(`db7dbd468..HEAD`)에서 `review/` 산출물을 제외하면 위 7개 파일만
  변경됐다(`git diff db7dbd468..HEAD --stat -- . ':!review/'`). `CHANGELOG.md`·plan 파일·공통
  모듈·설정 파일 변경은 이번 델타에 없다.
- **누적 전체 diff 재확인**: `git diff origin/main...HEAD --name-only -- codebase/` 결과가 여전히
  프롬프트의 20개 파일과 정확히 일치한다 — 이전 라운드 이후 범위 밖 파일이 새로 유입되지 않았다.

## 요약

`db7dbd468`(직전 리뷰 시점) 이후 추가된 두 커밋은 각각 (1) 직전 라운드가 지적한 Critical/Warning
항목(C1/W1/W2/W5/W4/W7)에 대한 **정확히 대응되는 최소 수정**이고, (2) 그 수정 과정에서 생긴 포맷
불일치를 단일 파일에 한정해 교정한 것이다. 코드 변경은 순서 교정 1곳, 신규 `recordAudit` 호출 1곳,
JSDoc/Swagger 문서 문자열 2곳뿐이며 회귀 테스트도 지적된 결함과 1:1 대응한다. 의도 밖 리팩터링,
기능 확장, 무관한 파일 수정, 불필요한 임포트·설정 변경은 발견되지 않았고, 이전 라운드가 지적했던
`eslint/prettier --fix` 범위 이탈 패턴도 이번엔 재발하지 않았다(커밋 메시지가 이를 명시적으로
회피했음을 밝히고 있다).

## 위험도

NONE
