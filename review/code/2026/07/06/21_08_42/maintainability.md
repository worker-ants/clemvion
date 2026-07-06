# 유지보수성(Maintainability) 리뷰

## 대상
- `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`
- `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts`

commit 56c72ba9f — `team_invite` 알림의 `channel` 값을 `'both'` → `'in_app'` 로 변경하는 단일 리터럴 수정 + 관련 docstring/주석/테스트 단언 갱신.

### 발견사항

- **[INFO]** 매직 스트링(`'in_app'`, `'both'`)이 리터럴로 하드코딩됨
  - 위치: `workspace-invitations.service.ts:1023` (`channel: 'in_app'`), `workspace-invitations.service.spec.ts:301`
  - 상세: `channel` 값이 문자열 리터럴 유니온 타입(예: `'in_app' | 'email' | 'both'`)으로 추정되며 이번 diff 는 기존 관례(`'both'`도 리터럴)를 그대로 따른 것이라 새로 도입된 문제는 아님. 다만 이런 값이 여러 서비스에서 반복 사용된다면 오탈자 시 컴파일 타임에 걸러지는지(즉 실제로 union 타입인지) 확인 가치가 있음.
  - 제안: `NotificationsService.notify()` 의 `channel` 파라미터가 이미 리터럴 유니온 타입으로 강제되고 있다면 별도 조치 불필요. 아니라면 향후 상수/enum 화 고려.

- **[INFO]** docstring 이 길어지고 있음 (`dispatchTeamInviteNotification`)
  - 위치: `workspace-invitations.service.ts:998-1006`
  - 상세: 이번 커밋으로 JSDoc 블록이 3줄→7줄로 확장되며 결정 배경(중복 회피 rationale)을 코드 주석에 상세히 재서술하고 있다. 근거 설명 자체는 이후 유지보수자가 "왜 in_app 만 쓰는지" 파악하는 데 유용하나, spec 문서(`spec/data-flow/8-notifications.md` Rationale)에 이미 동일 내용이 있어 두 곳에 동일 설명이 중복 존재하게 됨.
  - 제안: 현재 수준은 허용 범위(짧은 요약 + spec 참조 링크 패턴, 실제로 `(spec/data-flow/8-notifications.md §1.1 team_invite)` 참조가 포함되어 있어 SoT 원칙은 지켜짐). 문제로 격상할 정도는 아님.

- **[INFO]** 테스트 케이스명과 실제 검증 내용의 일치성
  - 위치: `workspace-invitations.service.spec.ts:277`
  - 상세: 테스트명이 `'...channel=in_app)'` 로 변경되어 실제 단언(`channel: 'in_app'`, line 301)과 정확히 일치. 가독성 좋음.

### 요약
변경 범위가 매우 작고(운영 로직상 문자열 리터럴 1곳 변경) 명확한 단일 책임의 diff다. 함수 길이, 중첩, 복잡도, 네이밍, 중복 코드 등 유지보수성 핵심 항목에 부정적 영향이 없다. docstring 을 결정 배경과 함께 갱신하고 spec 문서를 참조하도록 한 점, 테스트 케이스명을 실제 단언과 동기화한 점 모두 기존 코드베이스의 "주석에 spec 앵커 남기기" 컨벤션을 일관되게 따른다. 지적할 만한 이슈는 INFO 수준의 경미한 사항뿐이며 CRITICAL/WARNING 은 없다.

### 위험도
NONE
