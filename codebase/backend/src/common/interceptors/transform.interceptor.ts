import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isHttpContext } from '../utils/http-context';

export interface WrappedResponse<T> {
  data: T;
}

/**
 * HTTP 응답 본문을 `{ data }` 로 감싼다.
 *
 * HTTP 가 아니면 건너뛴다. 전역 인터셉터는 WebSocket 게이트웨이 핸들러에도 붙는데(근거는
 * `isHttpContext`), 그 반환값은 `{ event, data }` ack 라서 `'data' in data` 분기로 우연히 통과했을 뿐이다.
 * `data` 키가 없는 값이나 `void` 를 돌려주는 핸들러가 생기면 ack 가 `{ data }` 로 감싸져 wire 모양이
 * 조용히 바뀐다.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  WrappedResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    if (!isHttpContext(context)) {
      // 값을 감싸지 않고 그대로 흘려보낸다. 반환 타입은 `NestInterceptor<T, WrappedResponse<T>>` 계약이
      // HTTP 응답 기준으로 정한 것이라 이 분기에서는 맞지 않는다. 받는 쪽은 Nest 의 WS 응답 처리기이고
      // 그것은 값 모양을 가정하지 않으므로 캐스트로 계약만 맞춘다.
      return next.handle() as Observable<WrappedResponse<T>>;
    }
    return next.handle().pipe(
      map((data): WrappedResponse<T> => {
        if (data && typeof data === 'object' && 'data' in data) {
          return data as WrappedResponse<T>;
        }
        return { data };
      }),
    );
  }
}
