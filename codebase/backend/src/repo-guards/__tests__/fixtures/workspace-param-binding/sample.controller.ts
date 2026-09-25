// 대조군 fixture — 가드가 **가르는** 자리를 한 파일에 모아 둔다.
//
// `workspace-param-binding` 의 프로덕션 스캔 루트는 `src/modules` 라 이 파일은 그 판정에 안 걸린다
// (`param-uuid-pipe` fixture 와 같은 규칙). `src/` 전체를 훑는 형제 가드(`swagger-dto-contract` ·
// `nullable-type-lie-cast`)는 이 파일도 순회하므로 DTO 나 `null as unknown as` 를 여기 더하지 말 것.

import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { WorkspaceId, WorkspaceParam } from '../../../../common/decorators';

@Controller('fixture')
export class WorkspaceParamBindingFixtureController {
  /** 종전 15곳의 모양 — 경로 이름은 `id` 인데 워크스페이스 ID 로 받는다. */
  @Get(':id')
  plainId(@Param('id', ParseUUIDPipe) workspaceId: string): string {
    return workspaceId;
  }

  /** 접미 규칙 — 전환 라우트의 `targetWorkspaceId` 모양. */
  @Get('switch/:id')
  suffixed(@Param('id', ParseUUIDPipe) targetWorkspaceId: string): string {
    return targetWorkspaceId;
  }

  /** 경로 이름이 워크스페이스 ID 인 자리 — 식별자 이름이 규칙 밖이어도 잡는다. */
  @Get('by-route/:workspaceId')
  routeNamed(@Param('workspaceId', ParseUUIDPipe) id: string): string {
    return id;
  }

  /** 파라미터 객체를 구조분해해 꺼내는 자리. */
  @Get('destructured/:workspaceId')
  destructured(@Param() { workspaceId }: { workspaceId: string }): string {
    return workspaceId;
  }

  /** 대체재 — 가드가 인식하는 바인딩이라 위반이 아니다. */
  @Get('bound/:id')
  bound(@WorkspaceParam('id') workspaceId: string): string {
    return workspaceId;
  }

  /** 헤더 · 토큰 컨텍스트 — `@Param` 이 아니다. */
  @Get('header')
  headerContext(@WorkspaceId() workspaceId: string): string {
    return workspaceId;
  }

  /** 워크스페이스가 아닌 id — 이름이 규칙 밖이다. */
  @Get('member/:memberId')
  otherId(@Param('memberId', ParseUUIDPipe) memberId: string): string {
    return memberId;
  }

  /** 복수형은 규칙 밖이다 — `WorkspaceId` 로 **끝나야** 한다. */
  @Get('plural/:workspaceIds')
  plural(@Param('workspaceIds') workspaceIds: string): string {
    return workspaceIds;
  }

  /** 데코레이터 없는 파라미터(라우트가 아닌 메서드)는 바인딩이 아니다. */
  undecorated(workspaceId: string): string {
    return workspaceId;
  }
}

// 정규식이었다면 속았을 자리 — 주석과 문자열 안의 선언 모양.
// @Get(':id') decoy(@Param('id') workspaceId: string) {}
const DECOY_SNIPPET = "@Param('id') decoyWorkspaceId: string";
export const KEEP_REFERENCED = DECOY_SNIPPET;
