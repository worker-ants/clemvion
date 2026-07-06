### 발견사항

- **[INFO]** 변경 범위가 단일 리터럴 값(`'both'` → `'in_app'`) 갱신에 한정, 기존 테스트가 그대로 유효
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts:203-227` (`기존 가입자(비멤버) 초대 시 team_invite 알림 발사` 테스트), `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:1007-1032` (`dispatchTeamInviteNotification`)
  - 상세: 실제 실행 결과 `workspace-invitations.service.spec.ts` 30개 테스트 전부 통과(`npx jest workspace-invitations.service.spec.ts` → `Tests: 30 passed, 30 total`). 테스트명·assertion 의 `channel` 값이 프로덕션 코드의 실제 하드코딩 값과 정확히 일치하며, 회귀 위험이 낮다.
  - 제안: 없음(현행 유지로 충분).

- **[INFO]** `in_app` 채널의 다운스트림 동작(이메일 미발송)은 `NotificationsService` 쪽에서 이미 별도로 커버됨 — 이번 diff 로 새로 열리는 미검증 경로 없음
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:474` (`"channel='in_app' 이면 이메일 미발송 (user 조회·발송 모두 skip)"`)
  - 상세: `WorkspaceInvitationsService` 는 `notificationsService.notify()` 를 호출만 하고 실제 채널별 분기(이메일 발송 여부)는 `NotificationsService` 책임이다. 그 분기 로직은 기존에 이미 전용 테스트로 커버되어 있으므로, 이번 변경으로 인해 "이메일 중복 회피"라는 의도가 실제로 지켜지는지 확인하는 테스트 커버리지 공백은 없다. 다만 이번 diff 만 보면 `notify()` 가 mock 이라 "실제로 이메일이 안 나간다"는 것은 이 spec 파일 단독으로는 검증되지 않는다 — 별도 파일의 기존 테스트에 의존하는 구조이며, 이는 unit 테스트 경계상 정상이다.
  - 제안: (선택) 회귀 방지를 원한다면 `spec/data-flow/8-notifications.md` §1.1 team_invite 행을 참조하는 e2e/integration 테스트(초대 API 호출 → 실제 이메일 발송 mock 호출 횟수가 1회(초대 링크 메일)뿐임을 확인)를 추가하면 "이메일 중복 회피"라는 커밋의 핵심 의도를 end-to-end 로 고정할 수 있다. 현재는 unit 레벨에서 `channel` 값만 검증하고, "실제로 이메일이 1통만 나간다"는 통합 관점 검증은 두 spec 파일에 분산되어 암묵적으로만 성립한다. Critical 은 아니며 강화 제안 수준.

- **[INFO]** 테스트명이 한글로 의도(회피 대상 채널 값)를 명확히 표현
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts:203`
  - 상세: `'기존 가입자(비멤버) 초대 시 team_invite 알림 발사(channel=in_app)'` — 테스트명 자체가 무엇을 검증하는지 즉시 파악 가능. mock 구성(`memberRepo.findOne` 2회 순차 mock, `userRepo.findOne` 2회 순차 mock)도 각 호출이 어떤 조회에 대응하는지 인라인 주석으로 명시되어 가독성이 좋다.
  - 제안: 없음.

- **[INFO]** Mock 구성이 실제 서비스 호출 순서에 강하게 결합(순차 `mockResolvedValueOnce` 체이닝)되어 있어 브리틀할 수 있으나, 이번 변경 범위에서는 문제 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts:204-206` 등 전체 파일 패턴
  - 상세: 이는 기존 파일 전반의 기존 관례이고 이번 diff 로 새로 도입된 패턴이 아니다. 향후 `invite()` 메서드 내부 조회 순서가 바뀌면(예: `memberRepo.findOne` 호출이 추가/재배치) 이 테스트들이 잘못된 값을 매칭해 silent 하게 깨질 여지가 있다. 이번 커밋 범위에서는 해당 없음(순서 변경 없음).
  - 제안: 장기적으로 `mockImplementation` 기반 조건부 반환(인자 기반 분기)으로 전환하면 순서 의존성을 낮출 수 있으나, 현재 변경 범위와 무관한 개선 제안이므로 우선순위 낮음.

### 요약
이번 변경은 `team_invite` 알림의 `channel` 값을 `'both'` 에서 `'in_app'` 으로 하향하는 단일 라인 수정이며, 대응하는 테스트도 테스트명과 assertion 값을 정확히 동기화해 갱신했다. 실행 확인 결과 해당 spec 파일의 30개 테스트가 모두 통과하고, `in_app` 채널의 실제 부수효과(이메일 미발송)는 `NotificationsService` 쪽 기존 테스트(`notifications.service.spec.ts`)로 이미 커버되어 있어 새로운 커버리지 갭이나 회귀 리스크는 발견되지 않았다. Mock 구성과 테스트 가독성도 기존 파일의 양호한 패턴을 그대로 따른다. 개선 여지가 있다면 "이메일 중복 회피"라는 커밋의 핵심 의도를 두 서비스에 걸쳐 end-to-end 로 고정하는 통합 테스트 추가 정도이나, 이는 강화 제안이지 결함은 아니다.

### 위험도
NONE
