import type { ExecutionContext } from '@nestjs/common';

/**
 * HTTP 요청 컨텍스트인지 판정한다.
 *
 * `app.module.ts` 의 전역 `APP_GUARD` · `APP_PIPE` · `APP_INTERCEPTOR` 는 NestJS 12 부터 WebSocket
 * 게이트웨이 핸들러에도 붙는다(전역 필터만 제외된다). HTTP 요청 객체를 가정하는 전역 enhancer 는 이
 * 술어로 HTTP 가 아니면 건너뛴다 — enhancer 마다 `getType()` 비교를 따로 쓰면 어느 것이 WS 를 걸렀는지
 * 한눈에 보이지 않는다. 새 전역 enhancer 는 `src/repo-guards/__tests__/global-enhancer-ws-safety.spec.ts`
 * 가 WS 처리 방식을 분류하도록 강제한다.
 *
 * 파이프는 `ExecutionContext` 를 받지 못하므로 이 술어를 쓰지 못한다. `CustomValidationPipe` 는
 * `ArgumentMetadata.type === 'custom'` 으로 같은 구멍을 막는다.
 */
export function isHttpContext(context: ExecutionContext): boolean {
  return context.getType() === 'http';
}
