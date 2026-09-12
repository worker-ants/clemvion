// 대조군 fixture — 가드가 **가르는** 자리를 한 파일에 모아 둔다.
//
// `param-uuid-pipe` 의 프로덕션 스캔 루트는 `src/modules` 라 이 파일은 그 판정에 안 걸린다
// (형제 가드 `dto-class-name-collision` 이 자기 fixture 를 잡고 죽은 뒤 적어 둔 규칙).
//
// **그게 "아무 가드도 안 본다" 는 뜻은 아니다** — `swagger-dto-contract` ·
// `nullable-type-lie-cast` 처럼 `src/` 전체를 훑는 형제 가드는 이 파일도 순회한다. 지금은
// 그들이 찾는 패턴이 여기 없어 통과할 뿐이다(`review/code/2026/09/12/20_01_18` side_effect INFO). 이 fixture 에
// DTO 나 `null as unknown as` 를 더할 일이 생기면 그쪽 가드부터 확인할 것.

import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiParam } from '@nestjs/swagger';

@Controller('fixture')
export class ParamUuidFixtureController {
  /** 두 축 다 갖춘 자리 — 위반 아님. */
  @Get(':id')
  @ApiParam({ name: 'id', description: '대상 UUID', format: 'uuid' })
  ok(@Param('id', ParseUUIDPipe) id: string): string {
    return id;
  }

  /** `new ParseUUIDPipe(...)` 형태도 파이프 축을 만족한다 (실측 28건이 이 형태). */
  @Get('instantiated/:workspaceId')
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  instantiated(
    @Param('workspaceId', new ParseUUIDPipe({ version: '4' }))
    workspaceId: string,
  ): string {
    return workspaceId;
  }

  /** 파이프만 빠진 자리. */
  @Get('pipeless/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  pipeless(@Param('id') id: string): string {
    return id;
  }

  /** 문서 축만 빠진 자리 — `format` 이 없으면 산문에 "UUID" 라고 써도 안 세어 준다. */
  @Get('undocumented/:id')
  @ApiParam({ name: 'id', description: '대상 ID (UUID)' })
  undocumented(@Param('id', ParseUUIDPipe) id: string): string {
    return id;
  }

  /** 두 축 다 빠진 자리. */
  @Get('bare/:nodeId')
  bare(@Param('nodeId') nodeId: string): string {
    return nodeId;
  }

  /**
   * 비-id 이름은 애초에 대상이 아니다 — 허용목록 없이 술어가 가른다.
   * (프로덕션 실측: `provider`·`installToken`·`endpointPath`·`token`·`type`)
   */
  @Get('provider/:provider')
  nonIdShaped(@Param('provider') provider: string): string {
    return provider;
  }

  /**
   * `@ApiExcludeEndpoint()` 는 OpenAPI 에서 통째로 빠지므로 **문서 축을 묻지 않는다**.
   * 런타임 축은 그대로 묻는다 — 그래서 여기 파이프가 있고, 위반이 0건이어야 한다.
   */
  @Post(':id/_test/backdoor')
  @ApiExcludeEndpoint()
  excluded(@Param('id', ParseUUIDPipe) id: string): string {
    return id;
  }

  /**
   * **면제의 반대 방향 캐너리** — `@ApiExcludeEndpoint()` 인데 파이프가 **없다**.
   *
   * 위 `excluded` 만으로는 *"면제가 문서 축만 끄는가, 판정 전체를 끄는가"* 를 가를 수 없다
   * (둘 다 0건이 나온다). 면제가 넓어져 런타임 축까지 스킵하면 이 자리가 조용해지므로,
   * e2e 백도어라도 파싱 불가 입력에 500 을 내면 안 된다는 계약이 그때 소리 없이 사라진다
   * (`review/code/2026/09/12/20_01_18` testing WARNING). 이 fixture 는 **파이프 축만** 위반으로 잡혀야 한다.
   */
  @Post(':workspaceId/_test/backdoor-pipeless')
  @ApiExcludeEndpoint()
  excludedPipeless(@Param('workspaceId') workspaceId: string): string {
    return workspaceId;
  }

  /** 인자 없는 `@Param()` 은 이름이 없어 판정 대상이 아니다. */
  @Get('whole')
  whole(@Param() params: Record<string, string>): string {
    return params.anything ?? '';
  }
}

// 정규식이었다면 속았을 자리 — 주석과 문자열 안의 선언 모양.
// @Get('decoy/:id') decoy(@Param('id') id: string) {}
const DECOY_SNIPPET = "@Param('id') decoyFromStringLiteral: string";
export const KEEP_REFERENCED = DECOY_SNIPPET;
