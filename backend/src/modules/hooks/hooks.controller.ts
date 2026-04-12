import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { HooksService } from './hooks.service';

@Controller('hooks')
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Public()
  @Post(':endpointPath')
  @HttpCode(HttpStatus.ACCEPTED)
  async receiveWebhook(
    @Param('endpointPath') endpointPath: string,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
    @Req()
    req: { headers: Record<string, unknown>; method: string; rawBody?: Buffer },
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
    );

    return {
      ...result,
      message: 'Webhook received, workflow execution started',
    };
  }
}
