import { BadRequestException } from '@nestjs/common';
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { ErrorCode } from '../../nodes/core/error-codes';

/** 거부할 참조 하나 — `details[]` 원소의 `field` · `message`. */
export interface InvalidReference {
  field: string;
  message: string;
}

/**
 * 요청 본문의 참조 id 가 요청자의 워크스페이스(워크플로 범위 필드는 같은 워크플로) 행을 가리키지 않을 때 던진다.
 *
 * 400 `VALIDATION_ERROR` + `details: [{ field, message, code: 'INVALID_FIELD' }]` — 배열이다. 파이프(`CustomValidationPipe`)가 내는
 * `VALIDATION_ERROR` 와 같은 모양이고, 캔버스 저장 · 엣지 생성처럼 한 요청에 여러 필드가 틀릴 수 있다. 없는 id 와 남의 id 를
 * 구분하지 않는다(존재 여부를 알려 주지 않는다). 규칙은 spec `1-data-model.md` §1.1.
 *
 * 종전엔 서비스가 그 id 를 컬럼에 그대로 저장했다 — 트리거의 `workflowId` 로 다른 워크스페이스의 워크플로가 이쪽 트리거로 실행됐고
 * (실행 엔진은 워크플로를 id 로만 읽는다), 캔버스 저장은 다른 워크플로의 노드 행을 옮겼다.
 */
export function throwInvalidReferences(items: InvalidReference[]): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: items.map((item) => item.message).join('; '),
    details: items.map((item) => ({
      field: item.field,
      message: item.message,
      code: ErrorCode.INVALID_FIELD,
    })),
  });
}

/**
 * `where` 를 만족하는 행이 없으면 `field` 로 거부한다(`throwInvalidReferences`). `where` 에 소속 조건(`workspaceId` 또는
 * `workflowId`)을 반드시 싣는다 — id 만 넣으면 이 검사가 존재 확인으로 줄어든다.
 */
export async function assertReferenceInScope<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  field: string,
  message: string,
): Promise<void> {
  if (await repo.exists({ where })) return;
  throwInvalidReferences([{ field, message }]);
}
