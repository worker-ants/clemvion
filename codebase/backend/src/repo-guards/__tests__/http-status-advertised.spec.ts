import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as path from 'node:path';
import {
  Controller,
  HttpCode,
  HttpStatus,
  type INestApplication,
  Post,
  Res,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  type ResponseStatusMap,
  scanHttpStatusAdvertised,
  swaggerResponseStatuses,
  wrapperResponseStatuses,
} from './http-status-advertised-guard';

/**
 * 컨트롤러가 **OpenAPI 로 광고한 성공 코드**와 **실제로 내는 성공 코드**가 맞는지 조인다.
 *
 * ## 왜 이 가드인가 — 트래커가 본 두 자리는 열다섯 중 둘이었다
 *
 * e2e 가 `POST /api/workspaces/:id/transfer-ownership` 의 성공을 201 로 관측했다. 핸들러는
 * `@ApiOkWrappedResponse`(200)를 광고하는데 `@HttpCode` 가 없어 Nest 기본값(POST → 201)이 나간 것이다.
 * 컨트롤러 전수(2026-09-26, `src/modules` 핸들러 223개)를 세니 같은 불일치가 **15곳**이었다 — POST 액션
 * 14곳(200 광고 · 201 실제)과 초대 취소 DELETE 1곳(204 광고 · 200 실제).
 *
 * 같은 결함은 한 번 고쳐진 적이 있다 — `users-avatar-swagger-sync.spec.ts` 가 `uploadAvatar` 의 `@HttpCode(200)` 을
 * **그 자리만** 고정했다. 자리마다 고정하면 다음 자리는 아무것도 막지 않는다.
 *
 * 컴파일도 단위 테스트도 이 결함을 못 본다. 광고는 데코레이터, 실제 코드는 Nest 기본값이라 둘을 한 번에
 * 보는 곳이 없고, e2e 는 `[200, 201]` 로 둘 다 받아 불일치를 가리고 있었다(25곳). 그래서 **선언을 센다**.
 *
 * ## 판정
 *
 * | 칸 | 무엇 |
 * |---|---|
 * | 실제 | `@HttpCode(n)` 이 있으면 n, 없으면 Nest 기본값(POST 201 · 그 외 200) |
 * | 광고 | 성공(2xx) 응답 데코레이터들의 상태 집합 |
 * | 위반 | 광고가 하나 이상 있는데 실제를 담지 않음 |
 *
 * 광고가 **없는** 핸들러는 대조하지 않는다 — «광고가 있어야 한다» 는 별 문제다(2026-09-26 실측 15곳, 트래커 등재).
 * `@ApiExcludeEndpoint()` 핸들러도 문서에 실리지 않으므로 대조하지 않는다.
 *
 * ## `@Res()` 를 면제하지 않는다 — 한 번 틀렸다
 *
 * 처음엔 SSE 핸들러(`workflow-assistant` `sendMessage`)를 «`@Res()` 로 응답을 직접 쓰니 상태도 스스로 정한다» 고 보고
 * 제외했다. Nest 소스를 읽으니 **핸들러를 부르기 전에 기본 상태를 무조건 싣는다** — 그 SSE 는 201 로 나가고
 * 있었다. 이 판단이 가드의 모집단을 정하므로 문장이 아니라 아래 «근거 캐너리» 로 고정한다. Nest 가 이
 * 동작을 바꾸면 캐너리가 RED 를 내고, 그때 `@Res()` 면제를 다시 생각하면 된다.
 *
 * ## 이름 → 코드 표를 손으로 쓰지 않는다
 *
 * `@nestjs/swagger` 는 `Api*Response` 를 50개 가까이 내보내고 그중 2xx 가 일곱이다(203 · 205 · 206 포함). 표를
 * 손으로 쓰면 지금 쓰는 이름만 담기고, 새 이름을 쓰는 날 그 핸들러의 광고가 빈 집합이 되어 **대조 자체가
 * 조용히 빠진다**. 그래서 팩토리를 실제로 적용해 메타데이터에서 읽고(`swaggerResponseStatuses`), 저장소 래퍼는
 * 이름 접두사가 아니라 **내부 호출**로 옮긴다(`wrapperResponseStatuses`). 표에 없는 `Api*Response` 이름은
 * `unresolved` 로 실패한다.
 *
 * ## 베이스라인은 0이다
 *
 * 실측 15곳을 전부 고쳐 0으로 만들었다 — POST 14곳은 `@HttpCode(HttpStatus.OK)`, 초대 취소는 **광고를** 200 으로
 * (런타임을 204 로 바꿀지는 planner 트래커 항목의 결정이라 선점하지 않았다). 동결 목록이 없으니 위반이 생기는
 * 순간 실패한다.
 */
describe('성공 응답 코드 ↔ OpenAPI 광고 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  // `src/modules` 만 본다 — `*.controller.ts` 가 전부 거기 있고, 대조군 fixture 는 `repo-guards/` 아래다.
  const SCAN_ROOT = path.join(SRC_ROOT, 'modules');
  const WRAPPER_FILE = path.join(
    SRC_ROOT,
    'common',
    'swagger',
    'api-wrapped.ts',
  );
  const files = collectTsFiles(SCAN_ROOT);

  const swaggerStatuses = swaggerResponseStatuses();
  const wrappers = wrapperResponseStatuses(WRAPPER_FILE, swaggerStatuses);
  const statuses: ResponseStatusMap = new Map<string, number | null>([
    ...swaggerStatuses,
    ...wrappers.statuses,
  ]);

  describe('응답 데코레이터 표', () => {
    it('@nestjs/swagger 표가 비지 않고 대표 이름을 맞게 읽는다', () => {
      // 메타데이터 키(`swagger/apiResponse`)가 바뀌면 표가 통째로 빈다 — 그러면 모든 광고가 빈 집합이 되어
      // 본 판정이 아무것도 대조하지 않고 통과한다.
      expect(swaggerStatuses.size).toBeGreaterThan(40);
      expect(
        [
          'ApiOkResponse',
          'ApiCreatedResponse',
          'ApiAcceptedResponse',
          'ApiNoContentResponse',
          'ApiPartialContentResponse',
          'ApiForbiddenResponse',
          'ApiDefaultResponse',
        ].map((n) => [n, swaggerStatuses.get(n)]),
      ).toEqual([
        ['ApiOkResponse', 200],
        ['ApiCreatedResponse', 201],
        ['ApiAcceptedResponse', 202],
        ['ApiNoContentResponse', 204],
        ['ApiPartialContentResponse', 206],
        ['ApiForbiddenResponse', 403],
        ['ApiDefaultResponse', null],
      ]);
    });

    it('저장소 래퍼는 전부 상태 하나로 모이고, 이름과 같은 가족을 부른다', () => {
      expect(wrappers.problems).toEqual([]);
      // 이름 접두사는 판정에 쓰지 않지만, 어긋나면 사람이 읽는 코드가 거짓말을 한다 — 여기서 함께 본다.
      const PREFIX: ReadonlyArray<readonly [RegExp, number]> = [
        [/^ApiOk/, 200],
        [/^ApiCreated/, 201],
        [/^ApiAccepted/, 202],
      ];
      const mismatched = [...wrappers.statuses].filter(
        ([name, code]) => PREFIX.find(([re]) => re.test(name))?.[1] !== code,
      );
      expect(mismatched).toEqual([]);
      // 실측(2026-09-26) 여섯 — 파일을 못 읽거나 파서가 어긋나 0개가 되는 공허함을 막는다.
      expect(wrappers.statuses.size).toBeGreaterThanOrEqual(6);
    });
  });

  it('스캔 대상이 비어 있지 않다 (vacuous 방지)', () => {
    expect(
      files.filter((f) => f.endsWith('.controller.ts')).length,
    ).toBeGreaterThan(30);
    // 실측(2026-09-26) 208 — 223 중 광고 없음 15(`@ApiExcludeEndpoint` 2 포함)를 뺀 값.
    expect(
      scanHttpStatusAdvertised(files, SRC_ROOT, statuses).checked,
    ).toBeGreaterThan(150);
  });

  it('광고한 성공 코드가 실제 성공 코드를 담는다', () => {
    const violations = scanHttpStatusAdvertised(
      files,
      SRC_ROOT,
      statuses,
    ).violations.map(
      (v) =>
        `${v.file} ${v.method}() ${v.verb} — 실제 ${v.actual} · 광고 ${v.advertised.join('/')}`,
    );
    expect(violations).toEqual([]);
  });

  it('라우트는 성공 응답을 하나 이상 광고한다 (리다이렉트 라우트는 3xx)', () => {
    // 2026-09-26 실측 15곳을 채웠다 — 11곳은 응답 DTO · 광고, 넷은 OpenAPI 밖(`@ApiExcludeEndpoint`)이거나 이미 302 광고.
    const unadvertised = scanHttpStatusAdvertised(
      files,
      SRC_ROOT,
      statuses,
    ).unadvertised.map((u) => `${u.file} ${u.method}() ${u.verb}`);
    expect(unadvertised).toEqual([]);
  });

  it('판정할 수 없는 자리가 없다', () => {
    const unresolved = scanHttpStatusAdvertised(
      files,
      SRC_ROOT,
      statuses,
    ).unresolved.map((u) => `${u.file} ${u.method}() — ${u.what}`);
    expect(unresolved).toEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    const FIXTURE_DIR = path.join(
      __dirname,
      'fixtures',
      'http-status-advertised',
    );
    const scan = scanHttpStatusAdvertised(
      collectTsFiles(FIXTURE_DIR),
      FIXTURE_DIR,
      statuses,
    );
    const violationKeys = scan.violations.map(
      (v) => `${v.method}:${v.actual}∉${v.advertised.join('/')}`,
    );

    it('여섯 자리의 위반을 잡는다 — 기본값 · 204 광고 · @ApiResponse · 래퍼 · 206 · @Res()', () => {
      expect(violationKeys.sort()).toEqual([
        'deleteAdvertisedNoContent:200∉204',
        'getPartialContent:200∉206',
        'postApiResponseOk:201∉200',
        'postDefaultAdvertisedOk:201∉200',
        'postResHandler:201∉200',
        'postWrappedOk:201∉200',
      ]);
    });

    it('맞는 자리 · 대조하지 않는 자리는 안 잡는다', () => {
      const clean = [
        'postHttpCodeOk',
        'postNumericHttpCode',
        'postCreated',
        'deleteNoContent',
        'getApiResponseOk',
        'postMixed',
        'allOk',
        'excludedAdvertisedOk',
        'postNoSuccessAdvertised',
        'postDefaultResponseOnly',
        'postComputedHttpCode',
      ];
      expect(scan.violations.filter((v) => clean.includes(v.method))).toEqual(
        [],
      );
    });

    it('못 읽는 자리는 위반이 아니라 unresolved 로 보고한다', () => {
      expect(
        scan.unresolved.map((u) => `${u.method}:${u.what}`).sort(),
      ).toEqual([
        'getApiResponseWithoutStatus:@ApiResponse status',
        'postComputedHttpCode:@HttpCode(<식>)',
        'postMadeUpResponse:@ApiMadeUpSuccessResponse',
      ]);
    });

    it('성공 응답을 하나도 광고하지 않는 자리를 잡는다 — 리다이렉트 · 제외는 잡지 않는다', () => {
      // 에러 응답만 · `ApiDefaultResponse` 만 · 표에 없는 이름 · status 없는 `@ApiResponse` — 넷 다 2xx 도 3xx 도 없다.
      // `getRedirect`(`@ApiFoundResponse`) · `getRedirectViaApiResponse`(`@ApiResponse({ status: 302 })`)는 성공 광고가 있고,
      // `excludedAdvertisedOk` 는 OpenAPI 밖이다.
      expect(scan.unadvertised.map((u) => u.method).sort()).toStrictEqual([
        'getApiResponseWithoutStatus',
        'postDefaultResponseOnly',
        'postMadeUpResponse',
        'postNoSuccessAdvertised',
      ]);
    });

    it('리다이렉트만 광고한 라우트는 2xx 짝을 대조하지 않는다', () => {
      // `res.redirect` 가 Nest 가 미리 실은 200 을 덮어쓴다 — 기본값 200 과 대조하면 거짓 위반이다.
      expect(
        scan.violations.filter((v) => v.method.startsWith('getRedirect')),
      ).toStrictEqual([]);
    });

    it('AST 로 읽는다 — 주석 · 문자열 속 모양은 안 센다', () => {
      // `decoyHolder` 는 GET + 200 광고라 맞는 자리다. 주석 · 문자열 속 `@Post` · `@ApiNoContentResponse` 가
      // 세어졌다면 이 핸들러가 위반으로 나타나거나 `decoy-*` 가 따로 생긴다.
      expect(
        scan.violations
          .map((v) => v.method)
          .filter((m) => m.startsWith('decoy')),
      ).toEqual([]);
    });
  });

  /**
   * ## 근거 캐너리 — Nest 는 `@Res()` 핸들러에도 기본 상태를 싣는다
   *
   * 위 판정이 `@Res()` 를 면제하지 않는 근거를 실제 요청으로 고정한다. 두 칸을 함께 본다 — `@HttpCode` 가 없으면
   * POST 기본값 201 이 나가고(면제하면 안 되는 이유), 있으면 그 값이 나간다(`sendMessage` 에 붙인 처방이 듣는
   * 이유). 한 칸만 보면 «Nest 가 아무것도 안 싣는다» 와 «늘 200 이다» 를 가르지 못한다.
   */
  describe('근거 캐너리 — @Res() 핸들러의 상태', () => {
    @Controller('canary')
    class ResStatusCanaryController {
      @Post('res-default')
      resDefault(@Res() res: Response): void {
        res.setHeader('Content-Type', 'text/event-stream');
        res.flushHeaders();
        res.end();
      }

      @Post('res-http-code')
      @HttpCode(HttpStatus.OK)
      resHttpCode(@Res() res: Response): void {
        res.setHeader('Content-Type', 'text/event-stream');
        res.flushHeaders();
        res.end();
      }
    }

    let app: INestApplication;
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [ResStatusCanaryController],
      }).compile();
      app = module.createNestApplication();
      await app.init();
    });
    afterAll(async () => {
      if (app) await app.close();
    });

    it('@HttpCode 가 없으면 POST 기본값 201 로 나간다', async () => {
      const res = await request(app.getHttpServer()).post(
        '/canary/res-default',
      );
      expect(res.status).toBe(201);
    });

    it('@HttpCode(HttpStatus.OK) 면 200 으로 나간다', async () => {
      const res = await request(app.getHttpServer()).post(
        '/canary/res-http-code',
      );
      expect(res.status).toBe(200);
    });
  });
});
