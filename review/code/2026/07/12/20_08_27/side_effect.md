# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** SoT 배열이 두 DTO 에 spread 복사가 아닌 **직접 참조**로 공유됨 (직전 리뷰의 "무위험" 근거가 이번 diff 에서 무효화됨)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })`), `interact-ack-response.dto.ts` (`enum: EIA_EXECUTION_STATUS_VALUES`)
  - 상세: 직전 리뷰 라운드(`review/code/2026/07/12/19_49_01/side_effect.md`)는 "두 소비처 모두 `[...EXECUTION_STATUS_VALUES]` 로 spread 해 매번 새 배열을 만들므로 공유-mutable-state 위험 없음" 이라고 판정했다. 그런데 그 라운드의 RESOLUTION(I2, maintainability)이 "spread → 직접 참조로 통일" 을 적용하면서, 현재 diff 의 최종 상태는 두 DTO 모두 `enum:` 에 spread 없이 `EIA_EXECUTION_STATUS_VALUES` **배열 객체 자체**를 직접 넘긴다(파일 2/5 diff 확인). 즉 `@nestjs/swagger` 데코레이터 메타데이터에 동일 배열 인스턴스가 그대로 저장되어, 두 DTO 클래스가 런타임에 같은 mutable 배열을 참조하게 됐다 — 이전 라운드가 검증한 "무위험" 조건(매 소비처 사본 생성)은 더 이상 사실이 아니다.
  - 실질 영향: `EIA_EXECUTION_STATUS_VALUES` 는 `as const` 로 컴파일타임 readonly 일 뿐 `Object.freeze` 되어 있지 않아 런타임 mutable 이다(`execution-status.literal.ts`). 누군가 이 배열에 `.sort()`/`.push()` 등을 실수로 적용하면 두 DTO 의 OpenAPI 스키마와 wire SoT 자체가 동시에 조용히 오염된다. 현재 어떤 코드도 그런 변형을 하지 않으므로 즉시 위험은 없다. 다만 동일 모듈의 기존 관례(`interact.dto.ts::INTERACT_COMMANDS`, `workflow-assistant/tools/explore-tools.service.ts::EXECUTION_STATUS_VALUES`)도 동일하게 미동결 + 직접 참조 패턴이라, 이번 파일이 기존 컨벤션에서 벗어난 것은 아니다(확인함, `codebase/backend/src/modules/external-interaction/dto/interact.dto.ts:33` 참고).
  - 제안: 필수는 아니나 `execution-status.literal.ts` 의 `EIA_EXECUTION_STATUS_VALUES` 에 `Object.freeze(...)` 를 적용하면 "SoT 드리프트 방지" 라는 파일 목적과 정합적으로 런타임 방어까지 완결된다. 반영하지 않아도 기존 코드베이스 관례와 일치하므로 차단 사유는 아니다.

- **[INFO]** 신규 spec 파일이 DTO 계층 테스트에 TypeORM 엔티티 그래프 전체를 임포트로 끌어들임 (설계상 의도된 트레이드오프)
  - 위치: `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts` — 둘 다 `import { ExecutionStatus } from '../../../executions/entities/execution.entity'`
  - 상세: `ExecutionStatus` 는 `execution.entity.ts` 내 plain enum export 이지만, ES 모듈 특성상 이 파일을 import 하면 `@Entity('execution')` 데코레이터가 적용된 `Execution` 클래스 선언도 함께 평가된다. `Execution` 은 다시 `Workflow`/`Trigger`/`User` 엔티티를 import 하며 이들도 각각 `@Entity`/`@Column`/`@ManyToOne` 데코레이터를 갖는다 — 즉 이 파일을 import 하는 순간 TypeORM 의 전역 `MetadataArgsStorage` 에 4개 엔티티 클래스의 메타데이터가 등록되는 부작용이 발생한다(코드로 확인: `workflow.entity.ts`/`trigger.entity.ts`/`user.entity.ts` 는 모두 데코레이터 외 module-scope 부작용 없음 — DB 연결·env 읽기·네트워크 없음). 이 spec 은 `TypeOrmModule` 을 사용하지 않으므로 실제 DB 커넥션이나 리포지토리 주입은 발생하지 않고, 메타데이터 등록 자체는 멱등적이라 실질 위험은 없다.
  - 판단: 이 결합은 두 신규 assertion("wire SoT 는 엔티티 `ExecutionStatus` 상태 집합과 동일" — 엔티티↔wire drift 가드)의 **목적 자체가 엔티티 실제 enum 값을 대조하는 것**이므로 의도된 트레이드오프다. `execution-status.literal.ts` 자신의 JSDoc 이 "DTO 레이어가 엔티티에 결합되지 않도록" 명시한 원칙과 표면적으로 상충돼 보이지만, 그 원칙은 **프로덕션 DTO 코드**에 적용되는 것이고 이번 신규 커플링은 **테스트 전용**이라 원칙 위반이 아니다.
  - 제안: 조치 불필요. 다만 이 지점이 "왜 테스트만 엔티티를 import 하는지" 향후 혼동될 수 있으므로, 이미 존재하는 describe 제목("엔티티↔wire drift 가드")이 그 근거를 충분히 남기고 있어 추가 조치는 불요.

## 점검 관점별 확인 결과

1. **의도치 않은 상태 변경**: 프로덕션 런타임 로직 변경 없음(순수 상수/타입 통합). 유일한 상태-공유 관련 관찰은 위 INFO 1(직접 참조 공유)이며, 실행 중 실제 변형 코드는 없음.
2. **전역 변수**: `EIA_EXECUTION_STATUS_VALUES`(모듈 스코프 export const, `globalThis` 오염 아님) + `ExecutionStatusLiteral`(런타임 흔적 없는 타입) 신규 도입. `workflow-assistant/tools/explore-tools.service.ts::EXECUTION_STATUS_VALUES`(다른 순서)와 이름이 유사하나 `EIA_` 접두로 이미 구분돼 있어 grep 혼동 위험은 RESOLUTION 에서 이미 해소됨(직전 라운드 INFO 반영 확인).
3. **파일시스템 부작용**: 런타임 코드 경로에 파일 I/O 없음. diff 자체는 신규 파일 1개(`execution-status.literal.ts`) + 기존 DTO 2개 편집 + spec 2개(1개 신규, 1개 편집) + plan 문서 1개 편집 + 리뷰 산출물(7~17번 파일, `review/code/2026/07/12/19_49_01/**`)로 구성. 리뷰 산출물은 CLAUDE.md 관례상 `review/` 가 git-tracked 이므로 커밋되는 것이 정상이며 프로덕션 부작용이 아니다.
4. **시그니처 변경**: `ExecutionStatusDto.status`, `InteractAckDto.currentStatus` 필드 타입이 인라인 6값 유니온 → `ExecutionStatusLiteral`(=`(typeof EIA_EXECUTION_STATUS_VALUES)[number]`) 로 치환. 두 타입은 구조적으로 완전히 동일한 유니온이라(유니온은 순서 무관 구조적 동치) 호출자(컨트롤러·서비스·SDK 타입 소비처)에 영향 없음. 함수/메서드 시그니처 변경은 없음 — DTO 필드 타입 alias 치환뿐.
5. **인터페이스 변경(공개 API)**: OpenAPI `enum` 배열의 값·순서가 기존과 100% 동일함을 diff 로 직접 대조 확인(`pending, running, waiting_for_input, completed, failed, cancelled`). wire 계약 무변경 — 위 INFO 1 은 이 값 자체의 변경이 아니라 "미래에 실수로 변형될 경우의 잠재 위험"에 대한 관찰이다.
6. **환경 변수**: 해당 없음.
7. **네트워크 호출**: 해당 없음. 신규 spec 은 `nestjs/testing` in-memory 모듈만 구성하고 `app.close()` 로 정리, 외부 서비스 호출 없음.
8. **이벤트/콜백**: 해당 없음.

## 요약

이번 diff 는 `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 가 각자 선언하던 6값 리터럴 유니온+swagger `enum` 배열을 신규 파일 `execution-status.literal.ts` 의 단일 SoT 로 통합하는 순수 리팩터이며, 값·순서·타입 구조 모두 diff 로 직접 대조해 기존과 동일함을 확인했다 — 함수 시그니처·공개 API·환경변수·네트워크·이벤트 흐름에 실질 영향 없음. 유일하게 짚을 만한 점은 (a) 직전 리뷰 라운드의 RESOLUTION(I2, maintainability)이 "spread → 직접 참조" 로 스타일을 통일하면서, 그 직전 라운드가 "무위험" 근거로 들었던 spread-복사 전제가 현재 diff 최종 상태에서는 성립하지 않게 됐다는 것(다만 동일 모듈 기존 관례와는 일치하고 실제 변형 코드가 없어 즉시 위험은 아님), (b) 신규 엔티티↔wire drift 가드 테스트 2건이 DTO 스펙 파일에 TypeORM 엔티티 임포트(및 그로 인한 전역 `MetadataArgsStorage` 등록 부작용)를 끌어들이지만 이는 그 assertion 의 목적상 의도된 테스트 전용 트레이드오프다. 둘 다 INFO 수준이며 차단 사유가 아니다. 리뷰 산출물 파일(7~17번)은 문서 기록일 뿐 부작용 없음.

## 위험도

NONE
