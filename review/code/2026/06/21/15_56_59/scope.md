# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] executions.module.ts — BackgroundRunsService export 유지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m7-channel-authorizer-inversion/codebase/backend/src/modules/executions/executions.module.ts`, exports 배열
- 상세: 변경 전 exports 에 `BackgroundRunsService` 를 포함시킨 주석("BackgroundRunsService 는 WebsocketGateway 가 채널 subscribe 가드 (`verifyBackgroundRunOwnership`) 호출 때문에 export 한다")이 있었다. M-7 이후 gateway 가 더 이상 `BackgroundRunsService` 를 직접 참조하지 않으므로 이 export 는 다른 소비처가 없다면 과잉 export 일 수 있다. 단, 기존 주석이 삭제되고 `BackgroundRunChannelAuthorizer` export 코멘트만 남아 있어 잔여 소비처가 있는지 이 diff 에서 확인할 수 없다. 이 PR 범위(authorizer 역전)에서 export 정리까지 의도했는지 불명확하다.
- 제안: `BackgroundRunsService` 의 다른 외부 소비처를 확인한다. 소비처가 없다면 후속 PR 에서 export 제거 검토. 현재 변경 범위에서 즉시 조치 불필요.

### [INFO] websocket.gateway.spec.ts — 기존 mock 구조(BackgroundRunsService/KnowledgeBaseService/WorkflowsService)가 spec 파일에서 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m7-channel-authorizer-inversion/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`, import 목록 (14행)
- 상세: diff 를 보면 `BackgroundRunsService`, `KnowledgeBaseService`, `WorkflowsService` 의 import 와 mock provider 등록이 유지된 채 새 authorizer 클래스 import + useFactory 집계만 추가됐다. 이 세 서비스의 mock 이 여전히 테스트 모듈에 남아 있다면 사용되지 않는 provider 가 잔류하는 것이다. 단 전체 파일 컨텍스트에서는 제공되지 않은 부분(providers 배열 이전 mock 설정부)이 있어 실제 사용 여부를 완전히 확인할 수 없다. 앞선 subscribe 인가 동작 테스트가 authorizer 클래스를 통해 서비스 mock 을 사용한다면 이 mock 은 의도된 것이다(commit 메시지에도 "서비스 mock 위"라고 명시).
- 제안: 확인 수준. authorizer 클래스가 service mock 을 통해 wiring 된다면 이 import 들은 필요하며 scope 위반 아님.

## 요약

이번 변경은 commit 메시지에 명시된 M-7 authorizer 도메인 역전 작업의 범위와 일치한다. 18개 파일 변경이 모두 단일 목적(gateway 인라인 authorizer 배열 + 서비스-레벨 forwardRef 3개 제거 → ChannelAuthorizer 인터페이스/토큰 신설 + 5개 도메인 authorizer 클래스 분리 + useFactory 집계 + 테스트 갱신/신설)에 수렴한다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 혼입, 주석 무분별 변경 등은 관찰되지 않는다. `plan/in-progress/refactor/02-architecture.md` 수정은 플랜 파일의 완료 체크박스 및 구현 결과 기록으로 개발자 SKILL 규약상 정상 범위다. `common/utils/uuid.ts` 신설은 gateway 로컬 함수의 필요 최소 추출로 authorizer 공유 목적이 명확하다. INFO 2건은 모두 의도성이 합리적으로 설명되거나 후속 검토 사항 수준이라 즉시 차단이 불필요하다.

## 위험도

NONE
