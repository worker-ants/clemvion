import { ConflictException } from '@nestjs/common';
import {
  isPostgresUniqueViolation,
  pgErrorConstraint,
} from '../../common/db/pg-error';
import {
  ALREADY_CONNECTED_BY_SERVICE,
  STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
} from './integrations.constants';

/*
 * `oauth/begin` 의 공용 정책. 설치 대기 행 쓰기(`PendingInstallWriter`)와 `IntegrationOAuthService` 가 함께 쓰는 판정만 둔다.
 */

/**
 * begin 이 새로 만드는 설치 대기 행의 공개 범위. 요청에 없으면 개인이다. 멤버십을 잠글지 정하는 판정
 * ({@link lockForPendingWrite}), 행을 넣는 INSERT, 서비스 `begin` 의 생성 인가가 이 함수 하나로 같은 값을 쓴다. 한쪽의
 * 기본값이 따로 바뀌면 멤버십 잠금 없이 개인 행이 생긴다.
 */
export function resolveBeginScope(request: {
  scope?: 'personal' | 'organization';
}): 'personal' | 'organization' {
  return request.scope ?? 'personal';
}

/** 상점 식별자 UNIQUE(V072) 위반인가. 같은 상점의 행을 다른 요청이 먼저 썼다. */
export function isStoreIdentifierConflict(err: unknown): boolean {
  return (
    isPostgresUniqueViolation(err) &&
    pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT
  );
}

/**
 * 상점 식별자 UNIQUE 위반의 응답. `ALREADY_CONNECTED_BY_SERVICE` 의 409 라 통합 생성의 `throwIfUniqueViolation` 과 코드 ·
 * 문구가 같다. Cafe24 Private begin 의 재시도와 MakeShop 설치 엔드포인트가 쓴다.
 */
export function toAlreadyConnectedConflict(
  service: keyof typeof ALREADY_CONNECTED_BY_SERVICE,
): ConflictException {
  const mapped = ALREADY_CONNECTED_BY_SERVICE[service];
  return new ConflictException({ code: mapped.code, message: mapped.message });
}
