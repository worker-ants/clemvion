import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  ALLOWED_OAUTH_PROVIDERS,
  Cafe24InstallQuery,
  IntegrationOAuthService,
} from './integration-oauth.service';
import { renderCallbackHtml } from './services/oauth-callback.template';
import {
  INSTALL_TOKEN_PATTERN,
  THIRD_PARTY_PREFIX,
} from './third-party-oauth.constants';

/**
 * 3rd-party 가 호출하는 OAuth endpoints (Cafe24 "테스트 실행" install +
 * provider callbacks). 사용자가 호출하는 통합 관리 API
 * (`/api/integrations/...`) 와 분리. spec/2-navigation/4-integration.md
 * §9.2 Rationale "Cafe24 App URL 100자 한도 대응".
 *
 * install_token 형식·URL 조립 헬퍼는 `third-party-oauth.constants.ts` 의
 * 단일 진실 지점에서 정의 — 토큰 생성(서비스)·검증(본 컨트롤러)·appUrl
 * 조립(서비스) 사이의 불일치를 컴파일 타임에 차단한다.
 */
@ApiTags('Third-Party OAuth')
@Controller(THIRD_PARTY_PREFIX)
export class ThirdPartyOAuthController {
  constructor(private readonly oauthService: IntegrationOAuthService) {}

  /**
   * Cafe24 Private 앱 App URL 엔드포인트. Cafe24 Developers 의 "테스트 실행"
   * 이 path 의 install_token 으로 단일 row 조회 → HMAC 1회 검증 후 Cafe24
   * authorize URL 로 redirect.
   *
   * Rate limit: install_token 이 URL path 에 노출되어 (logs / Referer) 추가
   * 보호가 필요. spec Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안
   * 전제" 참조.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('cafe24/install/:installToken')
  @ApiOperation({
    summary: 'Cafe24 Private 앱 설치 진입점 (App URL — install_token)',
    description:
      'Cafe24 Developers "테스트 실행" 시 Cafe24가 호출하는 App URL 엔드포인트. path 의 install_token 으로 pending_install Integration 을 단일 row 조회하고 HMAC 1회 검증 후 Cafe24 authorize URL 로 302 redirect 합니다.',
  })
  @ApiParam({
    name: 'installToken',
    description: '16바이트 base64url (22자) install_token',
    example: 'AbCdEfGhIjKlMnOpQrStUv',
  })
  @ApiOkResponse({ description: '302 redirect to Cafe24 authorize URL' })
  @ApiBadRequestResponse({
    description:
      'CAFE24_INSTALL_MISSING_PARAMS — mall_id/timestamp/hmac 누락. CAFE24_INSTALL_REPLAY — timestamp 가 ±5분 윈도우 밖.',
  })
  @ApiForbiddenResponse({
    description:
      'CAFE24_INSTALL_INVALID_HMAC — HMAC 검증 실패 또는 install_token 의 row 가 다른 mall_id 와 매칭.',
  })
  @ApiNotFoundResponse({
    description:
      'CAFE24_INSTALL_INVALID_TOKEN — install_token 형식 불일치(22 base64url 아님) 또는 미존재(callback 성공/TTL 만료로 NULL).',
  })
  async cafe24Install(
    @Param('installToken') installToken: string,
    @Query('mall_id') mallId: string | undefined,
    @Query('timestamp') timestamp: string | undefined,
    @Query('hmac') hmac: string | undefined,
    @Query('shop_no') shopNo: string | undefined,
    @Query('user_id') userId: string | undefined,
    @Query('user_name') userName: string | undefined,
    @Query('user_type') userType: string | undefined,
    @Query('lang') lang: string | undefined,
    @Query('nation') nation: string | undefined,
    @Query('is_multi_shop') isMultiShop: string | undefined,
    @Query('auth_config') authConfig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!INSTALL_TOKEN_PATTERN.test(installToken)) {
      res.status(404).json({
        code: 'CAFE24_INSTALL_INVALID_TOKEN',
        message: 'install_token format invalid',
      });
      return;
    }
    if (!mallId || !timestamp || !hmac) {
      res.status(400).json({
        code: 'CAFE24_INSTALL_MISSING_PARAMS',
        message: 'mall_id, timestamp, hmac are required',
      });
      return;
    }
    const rawQuery = req.url.includes('?') ? req.url.split('?', 2)[1] : '';
    const query: Cafe24InstallQuery = {
      mall_id: mallId,
      timestamp,
      hmac,
      shop_no: shopNo,
      user_id: userId,
      user_name: userName,
      user_type: userType,
      lang,
      nation,
      is_multi_shop: isMultiShop,
      auth_config: authConfig,
      rawQuery,
    };
    try {
      const redirectUrl = await this.oauthService.handleInstall(
        installToken,
        query,
      );
      res.redirect(302, redirectUrl);
    } catch (err) {
      const e = err as {
        status?: number;
        response?: { code?: string; message?: string };
        message?: string;
      };
      const status = e.status ?? 400;
      const code = e.response?.code ?? 'CAFE24_INSTALL_FAILED';
      const message = e.response?.message ?? e.message ?? 'Install failed';
      res.status(status).json({ code, message });
    }
  }

  /**
   * Generic OAuth callback for all integration providers. Provider 마다 별도
   * controller 를 만들지 않고 :provider 파라메트릭 단일 핸들러로 유지 (현
   * google/github/cafe24 3종 모두 동일 처리 흐름).
   * spec/2-navigation/4-integration.md §10.
   *
   * ※ 사용자 소셜 로그인 콜백 (`/api/auth/oauth/:provider/callback`) 과 별개다.
   *
   * Throttle: state 검증으로 reflected abuse 는 차단되나, OAuth code 교환
   * 호출의 외부 의존성 비용을 감안해 install 보다 약한 60 req/min 적용.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':provider/callback')
  @ApiOperation({
    summary: 'OAuth 콜백 처리 (통합 연동)',
    description:
      'OAuth provider 가 리디렉션하는 콜백 엔드포인트입니다. 인증 불필요. 처리 후 결과를 담은 HTML 페이지를 반환하며 `postMessage`로 부모 창에 결과를 전달합니다. 사용자 소셜 로그인 콜백(/api/auth/oauth/:provider/callback) 과 별개입니다.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider 식별자 (google, github, cafe24)',
    example: 'google',
  })
  @ApiProduces('text/html')
  @ApiOkResponse({
    description: 'OAuth 처리 결과 HTML 페이지',
  })
  @ApiBadRequestResponse({ description: '지원하지 않는 OAuth provider' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL;
    if (!targetOrigin) {
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        '<p>OAuth callback misconfigured: FRONTEND_URL / APP_URL not set.</p>',
      );
      return;
    }

    if (!(ALLOWED_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          {
            status: 'error',
            provider,
            error: 'Unsupported OAuth provider',
          },
          targetOrigin,
        ),
      );
      return;
    }

    try {
      const result = await this.oauthService.handleCallbackWithErrorCapture(
        provider,
        { code, state, error },
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderCallbackHtml({ status: 'success', result }, targetOrigin));
    } catch (err) {
      const e = err as {
        message?: string;
        response?: { message?: string };
      };
      const message = e.response?.message ?? e.message ?? 'OAuth failed';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          { status: 'error', provider, error: message },
          targetOrigin,
        ),
      );
    }
  }
}
