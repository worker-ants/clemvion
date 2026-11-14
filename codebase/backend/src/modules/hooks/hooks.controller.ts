import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiPayloadTooLargeResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { Public } from '../../common/decorators';
import { DeferGlobalThrottle } from '../../common/guards/user-throttler.guard';
import { HooksService } from './hooks.service';
import {
  PublicWebhookThrottleGuard,
  type PublicWebhookReqExtension,
} from './public-webhook-throttle.guard';
import { HookTriggerThrottlerGuard } from './hook-trigger-throttler.guard';
import { EmbedConfigService } from './embed-config.service';
import { WebhookAcceptedDto } from './dto/responses/webhook-response.dto';
import { EmbedConfigDto } from './dto/responses/embed-config-response.dto';

/** embed-config 응답 캐시 max-age (초). CDN·브라우저 캐시 의존 설계 — 워크스페이스 설정 변경 후 최대 이 시간 내 반영(I17/I1). */
const EMBED_CONFIG_CACHE_SEC = 300;
/** 실제 응답 헤더와 Swagger 문서 문자열이 공유하는 Cache-Control 값 — 단일 진실(드리프트 방지). */
const EMBED_CONFIG_CACHE_CONTROL = `public, max-age=${EMBED_CONFIG_CACHE_SEC}`;
/** 사용자 대면 문서용 반영 지연 상한(분). 초 상수에서 파생 — 하드코딩 드리프트 방지. */
const EMBED_CONFIG_CACHE_MAX_MINUTES = Math.ceil(EMBED_CONFIG_CACHE_SEC / 60);

@ApiTags('Hooks')
@Controller('hooks')
export class HooksController {
  constructor(
    private readonly hooksService: HooksService,
    private readonly embedConfigService: EmbedConfigService,
  ) {}

  @Public()
  @Get(':endpointPath/embed-config')
  // 근거: [웹채팅 보안 — CORS와 임베드 검증 「임베드 검증」](CLE-WEBCHAT-SECURITY-ORIGIN#임베드-검증).
  @ApiOperation({
    summary: '위젯 임베드 설정(공개)',
    description:
      '공개 웹챗 위젯이 부팅 시 조회하는 임베드 allowlist(캐시 가능). 워크스페이스 `interactionAllowedOrigins` 를 반환하며, 비어 있으면 제한 없음(allow-all). 위젯은 enforce=true 이고 호스트 origin 이 allowlist 에 없으면 렌더/시작을 거부한다.\n\n**fail-open 정책**: DB 조회 실패·trigger 미존재 시 `{ allowlist: [], enforce: false }` (HTTP 200) 를 반환 — 위젯을 깨지 않는 soft 검증. 인증 webhook(authConfigId NOT NULL)도 동일하게 allow-all 반환(allowlist 노출 방지).\n\n**캐싱**: 응답에 `Cache-Control: ' +
      EMBED_CONFIG_CACHE_CONTROL +
      '` 헤더가 포함된다. 워크스페이스 allowlist 변경 후 최대 ' +
      EMBED_CONFIG_CACHE_MAX_MINUTES +
      '분 지연.',
  })
  @ApiParam({
    name: 'endpointPath',
    description: '트리거 등록 시 발급된 고유 엔드포인트 경로',
    example: 'abcd1234',
  })
  @ApiOkWrappedResponse(EmbedConfigDto, {
    description:
      '임베드 allowlist. 전역 TransformInterceptor 에 의해 `{ data: ... }` 로 래핑.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache-Control 응답 헤더 — CDN/브라우저 캐시 허용(W10).',
    headers: {
      'Cache-Control': {
        description: `${EMBED_CONFIG_CACHE_CONTROL} — 워크스페이스 설정 변경 후 최대 ${EMBED_CONFIG_CACHE_MAX_MINUTES}분 반영 지연(I1).`,
        schema: { type: 'string', example: EMBED_CONFIG_CACHE_CONTROL },
      },
    },
  })
  async getEmbedConfig(
    @Param('endpointPath') endpointPath: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmbedConfigDto> {
    const result = await this.embedConfigService.resolve(endpointPath);
    // 캐시 가능 — 워크스페이스 설정 변경 주기 대비 짧게(EMBED_CONFIG_CACHE_SEC 초). trigger 존재 노출 회피 위해 동일 응답형.
    res.set('Cache-Control', EMBED_CONFIG_CACHE_CONTROL);
    return result;
  }

  @Public()
  // 전역 요청 한도는 트리거를 조회한 뒤 `HookTriggerThrottlerGuard` 가 건다. 채팅 채널 트리거는 받지
  // 않는다(REQ-CHAT-079). 두 가드의 순서가 그 판정의 전제다.
  @DeferGlobalThrottle()
  @UseGuards(PublicWebhookThrottleGuard, HookTriggerThrottlerGuard)
  @Post(':endpointPath')
  @HttpCode(HttpStatus.ACCEPTED)
  // 근거: 공개 트리거의 시작 한도 · body 크기 제한은 [웹채팅 보안 「공개 웹훅 남용 방어」](CLE-WEBCHAT-SECURITY#공개-웹훅-남용-방어),
  // 채팅 채널의 핸드셰이크 · 인터랙션 응답은 CLE-CHAT-ADAPTER 「인터랙션 기본 응답과 수신 확인」.
  @ApiOperation({
    summary: '웹훅 수신',
    description:
      '외부 서비스가 호출하는 웹훅 엔드포인트입니다. 등록된 `endpointPath`에 해당하는 트리거를 찾아 워크플로우 실행을 비동기로 시작합니다. 본 엔드포인트는 인증이 필요 없으며, 트리거 자체의 시크릿·서명 검증 정책에 따라 보호됩니다. 공개(인증 없음) 트리거에 한해 IP 단위 시작 rate-limit·body 크기 제한이 적용됩니다. 채팅 채널 트리거는 프로바이더 서명으로 인증하므로 이 제한을 받지 않습니다. 전역 요청 한도(클라이언트당 분당 100건)는 트리거를 조회한 뒤 걸고, 채팅 채널 트리거에는 걸지 않습니다. 채팅 채널의 handshake(Slack url_verification · Discord PING)와 프로바이더가 3초 안 응답을 요구하는 인터랙션(Discord 컴포넌트 클릭 · 모달 제출 · 슬래시 명령, Slack Interactivity)은 `{ data }` 래핑 없이 200 과 프로바이더가 정한 본문으로 답합니다. Slack Interactivity 의 기본 응답은 빈 본문입니다.',
  })
  @ApiTooManyRequestsResponse({
    description: '공개 webhook IP 시작 한도 초과(분당/시간당)',
    schema: {
      example: {
        error: {
          code: 'PUBLIC_WEBHOOK_RATE_LIMIT',
          message:
            'Too many conversation starts from this client. Try again later.',
        },
      },
    },
  })
  @ApiPayloadTooLargeResponse({
    description: '공개 webhook body 크기 초과(32KB)',
    schema: {
      example: {
        error: {
          code: 'PUBLIC_WEBHOOK_BODY_TOO_LARGE',
          message: 'Webhook body exceeds 32768 bytes',
        },
      },
    },
  })
  @ApiParam({
    name: 'endpointPath',
    description: '트리거 등록 시 발급된 고유 엔드포인트 경로',
    example: 'abcd1234',
  })
  // 본문 형태는 외부 발신자가 정한다(spec 12-webhook WH-EP-04 · WH-EP-05 — JSON · form-urlencoded, 객체가 아닐 수도 있다). 그래서
  // 스키마는 «임의 값»(`{}`)이고, 파라미터(`unknown`)는 전역 파이프를 타지 않는다.
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiBody({
    required: false,
    description:
      '외부 서비스가 보내는 본문 — 형태는 발신자가 정한다(JSON 또는 form-urlencoded). 전체가 실행 입력 `body` 로 실리고, Manual Trigger 파라미터는 최상위 키에서 추출한다.',
    schema: {},
  })
  @ApiAcceptedWrappedResponse(WebhookAcceptedDto, {
    description:
      '웹훅 접수 및 워크플로우 실행 시작. 전역 TransformInterceptor 에 의해 `{ data: ... }` 로 래핑되어 반환됩니다.',
  })
  @ApiUnauthorizedResponse({
    description:
      '웹훅 서명/시크릿 검증 실패. 서명 참조가 있는 채팅 채널 트리거는 같은 IP 에서 서명 검증에 분당 20회를 넘게 실패하면 한동안 서명이 맞아도 검증 없이 같은 401(`AUTH_FAILED`)로 답한다(429 가 아니다).',
  })
  @ApiNotFoundResponse({
    description: '등록된 트리거(endpointPath)를 찾을 수 없음',
  })
  async receiveWebhook(
    @Param('endpointPath') endpointPath: string,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
    @Req()
    req: {
      headers: Record<string, unknown>;
      method: string;
      rawBody?: Buffer;
      // Express `trust proxy` 를 적용한 클라이언트 IP. 채팅 채널 서명 실패 한도 키로 쓴다.
      ip?: string;
    } & PublicWebhookReqExtension,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      }
    }

    const result = await this.hooksService.handleWebhook(
      endpointPath,
      {
        body,
        headers,
        query,
        method: req.method,
      },
      req.rawBody,
      // Guard 가 이미 조회해 첨부한 trigger 재사용 — 중복 DB 왕복 제거 (W14).
      req.__publicWebhookTrigger,
      req.ip,
    );

    // 채팅 채널이 프로바이더에 직접 돌려줄 응답이다. 핸드셰이크(Slack url_verification `{ challenge }` ·
    // Discord PING `{ type: 1 }`)와 3초 안 200 을 요구하는 인터랙션 응답(Discord `{ type: 9 }` ·
    // `{ type: 4 }` · `{ type: 6 }`, Slack `{ response_action }` · `{ response_type: 'ephemeral' }` ·
    // Interactivity 빈 본문)이 여기로 온다. 프로바이더가 정한 본문을 그대로 받아야 하므로
    // TransformInterceptor 의 `{ data }` 래핑을 거치지 않게 res 로 직접 보낸다.
    const { providerResponse, ...accepted } = result;
    if (providerResponse) {
      res.status(HttpStatus.OK);
      if (providerResponse.body === undefined) {
        res.end();
      } else {
        res.json(providerResponse.body);
      }
      return;
    }

    return {
      ...accepted,
      message: 'Webhook received, workflow execution started',
    };
  }
}
