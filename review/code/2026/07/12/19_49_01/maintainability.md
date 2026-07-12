# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `enum` 배열 전달 시 spread 문법이 동일 모듈의 기존 컨벤션과 다름
  - 위치: `execution-status-response.dto.ts` L63 (`enum: [...EXECUTION_STATUS_VALUES]`), `interact-ack-response.dto.ts` L(변경분) (`enum: [...EXECUTION_STATUS_VALUES]`)
  - 상세: 같은 모듈 내 기존 패턴인 `interact.dto.ts`의 `INTERACT_COMMANDS`(동일하게 `as const` 배열 + 파생 리터럴 타입)는 `@ApiProperty({ enum: INTERACT_COMMANDS, ... })`처럼 **spread 없이 직접 참조**한다. `@nestjs/swagger`의 `enum` 옵션 타입(`EnumAllowedTypes = any[] | Record<string, any> | (() => ...)`)은 `readonly` 튜플을 그대로 받아도 타입체크를 통과하므로(직접 실험으로 확인), `[...EXECUTION_STATUS_VALUES]` spread는 타입상 필수가 아니라 불필요한 사본 생성이다. 기능 차이는 없지만 "같은 목적의 공유 리터럴 SoT를 소비하는 두 곳"이 서로 다른 스타일을 쓰게 되어, 향후 이 패턴을 참고하는 개발자가 어느 쪽이 관례인지 혼동할 수 있다.
  - 제안: `enum: EXECUTION_STATUS_VALUES`로 통일하거나(가능하다면), 굳이 spread가 필요한 이유가 있다면(예: 특정 nestjs 버전에서 readonly 튜플 관련 타입 이슈) 주석으로 근거를 남길 것.

- **[INFO]** `ExecutionStatusLiteral` 네이밍 배경이 타입 옆에 명시돼 있지 않음
  - 위치: `execution-status.literal.ts` L1-21 (전체 doc 주석)
  - 상세: 엔티티 레이어에는 이미 `Execution.status: ExecutionStatus`(`execution.entity.ts`)라는 동명에 가까운 enum이 존재한다. 새 타입을 `ExecutionStatus`가 아니라 `ExecutionStatusLiteral`로 명명한 것은 이 이름 충돌(및 개념적 혼동)을 피하기 위한 합리적 선택으로 보이나, 현재 doc 주석은 "엔티티 enum에서 파생하지 않는 이유"만 설명할 뿐 "왜 `Literal` 접미사를 붙였는지"는 명시하지 않는다. 사소하지만, 다음에 이 타입을 보는 사람이 접미사 의도를 오해하지 않도록 한 줄 보강하면 좋다.
  - 제안: 주석에 "엔티티의 `ExecutionStatus` enum과 이름이 충돌하지 않도록 `Literal` 접미사를 사용" 정도의 한 문장 추가 (선택적, 필수 아님).

## 요약

이번 변경은 이전 리뷰(`ai-review 14_52_32` maintainability WARNING)에서 지적된 "동일한 6값 상태 리터럴 유니온 + swagger `enum` 배열이 `ExecutionStatusDto.status`와 `InteractAckDto.currentStatus` 두 곳에 각자 선언되어 있던" 중복을 정확히 해소한다. 신규 파일 `execution-status.literal.ts`는 `EXECUTION_STATUS_VALUES`(as const) + 파생 타입 `ExecutionStatusLiteral`이라는, 같은 모듈 내 기존 `INTERACT_COMMANDS`/`InteractCommand` 패턴과 동일한 관용구를 재사용해 일관성이 높고, doc 주석도 "왜 엔티티 enum에서 파생하지 않는지"(레이어 결합 회피 + enum 순서 불일치)를 근거와 함께 명확히 설명해 향후 유지보수자가 재도입 유혹에 빠지지 않도록 잘 방어하고 있다. 두 소비 DTO의 diff는 순수 치환(하드코딩 배열/유니온 → 공유 상수/타입 참조)이라 가독성·복잡도·중첩 측면에서 리스크가 없으며, 관련 plan 문서(`eia-context-schema-followups.md`)도 완료 근거를 상세히 기록해 추적성이 좋다. 유일한 흠은 `enum` 프로퍼티에 값을 넘길 때 spread(`[...EXECUTION_STATUS_VALUES]`)를 쓴 것이 같은 모듈의 기존 관례(직접 참조)와 미묘하게 어긋난다는 점과, 신규 타입명이 엔티티 enum과의 충돌 회피 의도를 명시적으로 남기지 않았다는 점인데, 둘 다 기능·안전성에 영향 없는 INFO 수준 다듬기 사항이다.

## 위험도

LOW
