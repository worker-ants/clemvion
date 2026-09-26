// 대조군 fixture — 가드가 **가르는** 자리를 한 파일에 모아 둔다.
//
// `http-status-advertised` 의 프로덕션 스캔 루트는 `src/modules` 라 이 파일은 그 판정에 안 걸린다.
// `src/` 전체를 훑는 형제 가드(`swagger-dto-contract` · `nullable-type-lie-cast`)는 이 파일도 순회하지만,
// 그들이 찾는 패턴(DTO · `null as unknown as`)이 여기 없다.

import {
  All,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiPartialContentResponse,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiOkWrappedResponse } from '../../../../common/swagger';

/** `@HttpCode(<식>)` 대조군 — 가드가 값을 읽지 못하는 형태. */
const COMPUTED_STATUS = 200;

/** 표에 없는 `Api*Response` 이름 대조군 — 새 래퍼가 판정 밖으로 조용히 새는 모양. */
const ApiMadeUpSuccessResponse = (): MethodDecorator => () => undefined;

class FixtureResultDto {
  ok!: boolean;
}

@Controller('fixture')
export class HttpStatusAdvertisedFixtureController {
  /** POST + 200 광고 + `@HttpCode` 없음 — 실제 201. 이 PR 이 고친 14곳의 모양. */
  @Post('post-default')
  @ApiOkResponse()
  postDefaultAdvertisedOk(): void {}

  /** 위 모양에 `@HttpCode(HttpStatus.OK)` 를 붙인 자리 — 위반 아님. */
  @Post('post-http-code')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  postHttpCodeOk(): void {}

  /** 숫자 리터럴 `@HttpCode(200)` — 위반 아님. */
  @Post('post-numeric')
  @HttpCode(200)
  @ApiOkResponse()
  postNumericHttpCode(): void {}

  /** POST + 201 광고 — 기본값과 맞는다. */
  @Post('post-created')
  @ApiCreatedResponse()
  postCreated(): void {}

  /** DELETE + 204 광고 + `@HttpCode` 없음 — 실제 200. 초대 취소가 이 모양이었다. */
  @Delete('delete-default/:id')
  @ApiNoContentResponse()
  deleteAdvertisedNoContent(): void {}

  /** DELETE + `@HttpCode(204)` + 204 광고 — 위반 아님. */
  @Delete('delete-no-content/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteNoContent(): void {}

  /** `@ApiResponse({ status: 200 })` — 인자에서 읽는다. GET 이라 맞는다. */
  @Get('api-response')
  @ApiResponse({ status: 200 })
  getApiResponseOk(): void {}

  /** `@ApiResponse({ status: HttpStatus.OK })` + POST — 실제 201. */
  @Post('api-response')
  @ApiResponse({ status: HttpStatus.OK })
  postApiResponseOk(): void {}

  /** 저장소 래퍼 — 이름이 아니라 내부 호출(`ApiOkResponse`)로 200 이 된다. POST 라 위반. */
  @Post('wrapped')
  @ApiOkWrappedResponse(FixtureResultDto)
  postWrappedOk(): void {}

  /** 손으로 쓴 표였다면 빠졌을 2xx(206) — 런타임 표가 안다. GET 이라 200 이 광고에 없어 위반. */
  @Get('partial')
  @ApiPartialContentResponse()
  getPartialContent(): void {}

  /** 200 · 201 을 함께 광고 — 실제 201 이 들어 있다. */
  @Post('mixed')
  @ApiOkResponse()
  @ApiCreatedResponse()
  postMixed(): void {}

  /** `@All` 은 POST 가 아니다 — 기본값 200. */
  @All('all')
  @ApiOkResponse()
  allOk(): void {}

  /** `@Res()` 도 면제하지 않는다 — Nest 가 핸들러 호출 전에 기본값을 싣는다(spec «근거 캐너리»). */
  @Post('res')
  @ApiOkResponse()
  postResHandler(@Res() res: Response): void {
    res.end();
  }

  /** OpenAPI 에서 빠진 자리 — 광고가 문서에 없으니 대조하지 않는다. */
  @Post('excluded')
  @ApiExcludeEndpoint()
  @ApiOkResponse()
  excludedAdvertisedOk(): void {}

  /** 성공 응답을 광고하지 않는 자리 — 대조할 것이 없다(`checked` 에 안 든다). */
  @Post('no-success')
  @ApiForbiddenResponse()
  postNoSuccessAdvertised(): void {}

  /** `ApiDefaultResponse` — 알지만 고정된 상태가 없다. 대조하지 않고 `unresolved` 도 아니다. */
  @Post('default')
  @ApiDefaultResponse()
  postDefaultResponseOnly(): void {}

  /** 값을 못 읽는 `@HttpCode` — 위반도 통과도 아니고 `unresolved`. */
  @Post('computed')
  @HttpCode(COMPUTED_STATUS)
  @ApiOkResponse()
  postComputedHttpCode(): void {}

  /** status 없는 `@ApiResponse` — `unresolved`. */
  @Get('api-response-no-status')
  @ApiResponse({ description: '상태 없음' })
  getApiResponseWithoutStatus(): void {}

  /** 표에 없는 응답 데코레이터 — `unresolved`. 광고가 비었다고 조용히 건너뛰지 않는다. */
  @Post('made-up')
  @ApiMadeUpSuccessResponse()
  postMadeUpResponse(): void {}

  /** 주석 · 문자열 속 모양은 코드가 아니다: `@Post('decoy') @ApiOkResponse()` */
  @Get('decoy')
  @ApiOkResponse()
  decoyHolder(): string {
    return "@Post('decoy-in-string') @ApiNoContentResponse()";
  }
}
