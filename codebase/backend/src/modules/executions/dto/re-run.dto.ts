import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * `POST /executions/:id/re-run` 요청 본문
 * (spec/5-system/13-replay-rerun.md §8.1).
 */
export class ReRunRequestDto {
  @ApiPropertyOptional({
    description:
      '원본 입력을 그대로 사용할지 (true) 또는 inputOverride 사용 (false). 기본 true',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useOriginalInput?: boolean;

  @ApiPropertyOptional({
    description:
      'useOriginalInput=false 일 때 사용할 입력(Manual Trigger 스키마 호환). ' +
      '마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. ' +
      'SoT: EIA §R17.',
    // 열린 map 은 `type: 'object' + additionalProperties: true` 로 적는다 — 저장소 다수
    // 패턴(40 파일)이고 형제 `execute-workflow.dto.ts` 도 그렇다. 축약형 `type: Object` 도
    // `type: object` 로는 해석되지만 **`additionalProperties` 가 붙지 않아**, 선언된
    // 프로퍼티가 없는 닫힌 모델처럼 보인다 — 생성기가 빈 인터페이스를 만든다
    // (실측: 두 형태를 `createDocument` 까지 돌려 비교).
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  inputOverride?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'dry-run 모드로 실행할지. true 면 HTTP Request/Send Email/Database Query/Cafe24 같은 외부 부수효과 노드는 실제 호출 대신 mock 출력(_dryRun: true)을 반환. 기본 false (spec/5-system/13-replay-rerun.md §7·§8.1)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
