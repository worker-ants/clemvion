# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 동일 이름의 `EXECUTION_STATUS_VALUES` 상수가 서로 다른 모듈에 두 개 존재(값 순서 상이)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts:13` (신규) vs `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:42` (기존, pre-existing)
  - 상세: 신규 파일이 export 하는 `EXECUTION_STATUS_VALUES`(순서: `pending, running, waiting_for_input, completed, failed, cancelled`)와 `explore-tools.service.ts` 의 기존 동명 상수(순서: `pending, running, completed, failed, cancelled, waiting_for_input`)는 별개 모듈 export 라 import 경로가 달라 런타임 충돌·전역 오염은 없다. 다만 동일 리포지토리 안에 이름이 같고 값 순서가 다른 두 "SoT" 상수가 존재해, 향후 유지보수 시 잘못된 파일을 import 하거나 두 상수를 혼동해 동기화 누락이 발생할 여지가 있다. 이번 PR 이 신규로 만든 이름 충돌이며, 부작용이라기보다는 유지보수성 관점의 관찰이다.
  - 제안: 필수는 아니나, 신규 상수명에 `EIA_` 혹은 `RESPONSE_` 접두를 붙여 구분하거나 주석에 "workflow-assistant 의 동명 상수와 별개" 를 명시하면 향후 혼동을 예방할 수 있다.

- **[INFO]** 신규 export 배열이 `Object.freeze` 없이 런타임 mutable
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts:13-19`
  - 상세: `EXECUTION_STATUS_VALUES` 는 `as const` 로 컴파일 타임 readonly 튜플이지만 런타임에는 일반 배열이라 이론상 `push`/`splice` 등으로 변형 가능하다. 현재 두 소비처(`execution-status-response.dto.ts`, `interact-ack-response.dto.ts`) 모두 `[...EXECUTION_STATUS_VALUES]` 로 스프레드해 매번 새 배열을 만들어 `@ApiProperty` 에 넘기므로, 실제 aliasing/공유-mutable-state 위험은 없다. 동일 패턴(`as const` + 미동결)이 `query-workflow.dto.ts::OWNERSHIP_VALUES`, 기존 `explore-tools.service.ts::EXECUTION_STATUS_VALUES` 에도 이미 쓰이고 있어 코드베이스 기존 관례와 일치한다. 실질적 위험 없음, 참고 사항으로만 기록.

## 점검 관점별 확인 결과

1. **의도치 않은 상태 변경**: 없음. 순수 타입/상수 선언 리팩터로 함수 로직·상태 변경 없음.
2. **전역 변수**: `EXECUTION_STATUS_VALUES`(신규 모듈-scope export const)와 `ExecutionStatusLiteral`(타입, 런타임 흔적 없음) 도입. 모듈 스코프 export 이며 전역(globalThis) 오염 아님. 위 INFO 항목(동명 상수) 외 특이사항 없음.
3. **파일시스템 부작용**: 없음. 신규 파일 1개(`execution-status.literal.ts`) 추가 + 기존 2개 DTO 파일 편집 + plan 문서 편집, 모두 diff 로 명시된 범위 내. 런타임 파일 I/O 코드 아님.
4. **시그니처 변경**: `ExecutionStatusDto.status`, `InteractAckDto.currentStatus` 필드 타입이 인라인 리터럴 유니온 → `ExecutionStatusLiteral` 로 치환됐으나, `ExecutionStatusLiteral = (typeof EXECUTION_STATUS_VALUES)[number]` 가 정확히 동일한 6값 유니온으로 evaluate 되어 구조적으로 100% 동일 타입이다(유니온은 순서 무관 구조적 동치). 함수 시그니처 변경 아니고 필드 타입 alias 치환이라 호출자(컨트롤러·서비스·클라이언트 SDK 타입) 영향 없음.
5. **인터페이스 변경(공개 API)**: `@ApiProperty({ enum: [...EXECUTION_STATUS_VALUES] })` 로 생성되는 배열 순서가 기존 인라인 배열과 동일(`pending, running, waiting_for_input, completed, failed, cancelled`)함을 diff 로 확인. OpenAPI 스키마 `enum` 배열 값·순서 무변경 → wire 계약 무변경. plan 문서에도 "DTO 스키마 회귀 15건 green" 으로 명시돼 있어 일치.
6. **환경 변수**: 해당 없음. 관련 코드 없음.
7. **네트워크 호출**: 해당 없음.
8. **이벤트/콜백**: 해당 없음. 로직 변경이 아닌 타입/상수 선언 재구성.

## 요약

이번 변경은 `ExecutionStatusDto.status`/`InteractAckDto.currentStatus`가 각자 선언하던 동일한 6값 리터럴 유니온과 swagger `enum` 배열을 신규 파일 `execution-status.literal.ts`의 `EXECUTION_STATUS_VALUES`/`ExecutionStatusLiteral`로 통합하는 순수 리팩터다. 파생 타입이 원래 유니온과 구조적으로 완전히 동일하고, OpenAPI `enum` 배열도 스프레드로 순서·값이 보존되어 함수 시그니처·공개 API·런타임 동작에 실질적 영향이 없다. 유일하게 참고할 점은 동일 리포지토리 내 다른 모듈(`workflow-assistant/tools/explore-tools.service.ts`)에 이름은 같지만 값 순서가 다른 `EXECUTION_STATUS_VALUES` 상수가 이미 존재해 향후 혼동 가능성이 있다는 것과, 신규 배열이 `Object.freeze` 없이 mutable 하다는 것인데 둘 다 현재 사용 패턴상 실질 위험은 없고 코드베이스 기존 관례(`as const`, 미동결)와 일치한다. plan 문서(`eia-context-schema-followups.md`) 변경은 체크박스 갱신 및 완료 근거 기록으로 부작용 없음.

## 위험도

NONE
