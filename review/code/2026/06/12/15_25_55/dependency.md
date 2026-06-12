# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 외부 의존성 변경 없음
  - 위치: 전체 변경 파일 (파일 1–7)
  - 상세: 이번 PR 에서 변경된 7개 파일(`.spec.ts`, `.controller.ts`, `.mdx` ×2, `.md` ×3) 중 어느 것도 `package.json` / `package-lock.json` 을 수정하지 않는다. 새 외부 패키지가 추가되지 않았다.
  - 제안: 해당 없음.

- **[INFO]** 내부 모듈 의존 방향 변경 — `@nestjs/common.Headers` / `UnauthorizedException` 제거, `../../common/decorators` 경유 `WorkspaceId` 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-cleanup-45ffef/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` L12
  - 상세: `Headers`, `UnauthorizedException` import 가 제거되고 프로젝트 공용 barrel `../../common/decorators` 를 통해 `WorkspaceId` 를 import 한다. `common/decorators/index.ts` 가 `WorkspaceId` 를 re-export 하는 형태로 이미 정착된 패턴이므로 새 내부 의존이 아니라 기존 의존으로의 *수렴*이다.
  - 제안: 해당 없음.

- **[INFO]** 테스트 파일 import 정리 — `UnauthorizedException` 제거
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-cleanup-45ffef/codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` L1
  - 상세: 삭제된 테스트 케이스(`X-Workspace-Id 미전달 시 UnauthorizedException`)에 대응하는 미사용 import 가 정리되었다. dead import 제거는 의존성 관점에서 올바른 방향이다.
  - 제안: 해당 없음.

- **[INFO]** 문서 파일(`triggers.mdx`, `triggers.en.mdx`, `15-chat-channel.md`, plan `.md`)에 의존성 변화 없음
  - 위치: 파일 3–7
  - 상세: 에러 코드 문자열(`WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED`) 및 spec/plan 텍스트 수정으로, 외부·내부 패키지 의존에는 아무 영향이 없다.
  - 제안: 해당 없음.

## 요약

이번 변경은 순수한 리팩터링 및 문서 동기화 PR 이다. 신규 외부 패키지가 추가되지 않았고, 기존 의존성의 버전 변경도 없다. 유일한 의존 변화는 `chat-channel.controller.ts` 가 `@nestjs/common` 의 `Headers`·`UnauthorizedException` 직접 사용에서 프로젝트 내부 공용 데코레이터(`../../common/decorators`)로 이전한 것으로, 이는 의존 방향을 더 일관적으로 만든다. 라이선스·취약점·번들 크기·버전 충돌 관점에서 검토할 사항이 없다.

## 위험도

NONE
