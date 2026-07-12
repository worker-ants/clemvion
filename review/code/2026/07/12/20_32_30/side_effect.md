# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** SoT 배열이 두 DTO 에서 spread 없이 **동일 인스턴스**를 직접 공유 (직전 라운드 완화 근거 소멸)
  - 위치: `execution-status-response.dto.ts:113` (`@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })`), `interact-ack-response.dto.ts:20-21` (`@ApiPropertyOptional({ enum: EIA_EXECUTION_STATUS_VALUES, ... })`)
  - 상세: 직전 라운드(`review/code/2026/07/12/19_49_01/side_effect.md`)는 "두 소비처 모두 `[...EXECUTION_STATUS_VALUES]` 로 스프레드해 매번 새 배열을 만들므로 aliasing 위험 없음"을 근거로 위험도 `NONE` 을 매겼다. 그런데 같은 라운드 maintainability WARNING(I2, RESOLUTION.md)에 따라 두 DTO 모두 spread 를 제거하고 `EIA_EXECUTION_STATUS_VALUES` 를 **직접 참조**하도록 바뀌면서, 그 완화 근거가 없어졌다 — 이제 두 DTO 의 `@ApiProperty`/`@ApiPropertyOptional` 데코레이터는 모듈 스코프 상수 배열 **한 개의 동일 인스턴스**를 참조한다. `@nestjs/swagger` 소스(`dist/utils/enum.utils.js::getEnumValues` → `Array.isArray(enumType)` 분기에서 배열을 그대로 `return`, 이후 `paramSchema.enum = enumValues`)를 직접 확인한 결과 현재 버전은 이 배열을 복사하지 않고 참조 그대로 두 스키마 프로퍼티에 대입하며, 저장소 전체(schema-object-factory.js 포함)에 이 배열에 대한 in-place mutation(`push`/`sort`/`splice`)은 없어 **현재로서는 실질 위험이 없다**. 다만 (a) `EIA_EXECUTION_STATUS_VALUES` 는 `as const` 로 컴파일타임 readonly 일 뿐 런타임에는 `Object.freeze` 되지 않은 평범한 mutable 배열이고, (b) 두 개의 독립된 DTO(서로 다른 엔드포인트의 응답 계약)가 이제 같은 배열 객체를 공유해, 향후 nest-swagger 내부 구현이 바뀌거나 다른 소비 코드(`IsIn` 등)가 이 배열을 in-place 로 변형하면 한쪽 DTO 의 편집이 다른 DTO 의 OpenAPI enum 에도 조용히 전파될 수 있는 구조가 됐다. 같은 모듈의 기존 `INTERACT_COMMANDS`(`interact.dto.ts`)도 동일하게 미동결 배열을 직접 참조하는 관례라 이번 변경이 신규 패턴을 만든 것은 아니지만, "직전 부작용 리뷰가 명시적으로 의존했던 안전장치(스프레드 복사)가 후속 커밋에서 제거됐는데 그 사실이 부작용 관점에서 재확인되지 않았다"는 점은 기록해 둘 가치가 있다.
  - 제안: 조치 불요(현재 라이브러리 동작 기준 위험 없음, 기존 `INTERACT_COMMANDS` 관례와 일치). 다만 두 응답 DTO 가 공유하는 리터럴 SoT 를 여러 곳에서 직접 참조하는 패턴이 앞으로도 반복될 것이므로, `execution-status.literal.ts` 상단에 "런타임 immutable 보장 없음(freeze 안 함) — 소비처에서 mutate 금지" 한 줄을 남기면 향후 실수를 예방할 수 있다 (선택, 비차단).

- **[INFO]** `status`/`currentStatus` 필드 타입 치환은 기존 소비처에 구조적으로 투명함 — 실측 확인
  - 위치: `execution-status-response.dto.ts::ExecutionStatusDto.status`, `interact-ack-response.dto.ts::InteractAckDto.currentStatus` (인라인 유니온 → `ExecutionStatusLiteral` 타입 alias)
  - 상세: diff 대상 외 소비 코드(`interaction.service.ts:379` `status: execution.status as ExecutionStatusDto['status']`, 동일 파일 `currentStatus: refreshed?.status ?? 'running'`)를 직접 열어 확인한 결과, 두 소비처 모두 인덱스 접근 타입(`DTO['field']`)이나 구조적 대입을 쓰지 인라인 유니온을 별도로 복제해 선언한 곳이 없다. `ExecutionStatusLiteral = (typeof EIA_EXECUTION_STATUS_VALUES)[number]` 가 이전 인라인 유니온과 값 집합·구조가 완전히 동일하므로 이 필드-타입 치환은 함수 시그니처 변경이 아니라 순수 별칭 치환이며, 호출자(서비스·컨트롤러) 쪽 타입 영향이 없다.
  - 제안: 없음 (검증 목적 기록).

- **[INFO]** 신규 파일·리뷰 산출물 다수 추가는 예상된 FS 부작용
  - 위치: `execution-status.literal.ts`/`.spec.ts`, `interact-ack-response.dto.spec.ts` (신규 프로덕션·테스트 파일) 및 `review/code/2026/07/12/{19_49_01,20_08_27}/**` (직전 리뷰 라운드 산출물 커밋)
  - 상세: 신규 프로덕션/테스트 파일은 diff 범위와 정확히 일치하며 예상 밖 파일 생성이 아니다. `review/code/**` 하위 다수 신규 md/json 은 애플리케이션 실행 중 발생하는 파일시스템 부작용이 아니라 AI 리뷰 워크플로 산출물이며, 프로젝트 컨벤션(`review/` 산출물은 gitignore 대상이 아니고 커밋 대상)과 일치한다. `_retry_state.json`/`meta.json` 에 로컬 워크트리 절대경로가 그대로 기록되지만 이는 기존 워크플로가 항상 남기는 표준 필드이며 비밀정보 노출은 아니다.
  - 제안: 없음.

## 점검 관점별 확인 결과

1. **의도치 않은 상태 변경**: 없음. 순수 타입/상수 리팩터, 런타임 로직·분기 무변경.
2. **전역 변수**: `EIA_EXECUTION_STATUS_VALUES`(모듈 스코프 export const)·`ExecutionStatusLiteral`(타입, 런타임 흔적 없음) 신규 도입. `globalThis` 오염 아니며 명명도 동명 상수(`explore-tools.service.ts::EXECUTION_STATUS_VALUES`)와 `EIA_` 접두로 구분됨. 위 첫 번째 INFO(공유 mutable 참조) 외 특이사항 없음.
3. **파일시스템 부작용**: 없음(diff 범위 내 예상된 신규/편집 파일만 존재). 세 번째 INFO 참고.
4. **시그니처 변경**: `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 필드 타입이 인라인 유니온 → 별칭 타입으로 치환됐으나 구조적으로 동일 — 실제 소비 코드 대조로 투명성 확인(두 번째 INFO).
5. **인터페이스 변경(공개 API)**: OpenAPI `enum` 배열 값·순서 무변경(테스트로 pin, `execution-status-response.dto.spec.ts`/`interact-ack-response.dto.spec.ts` 신규 assertion 확인) — wire 계약 무변경.
6. **환경 변수**: 해당 없음.
7. **네트워크 호출**: 해당 없음.
8. **이벤트/콜백**: 해당 없음.

## 요약

이번 변경은 `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 가 각자 선언하던 6값 리터럴 유니온을 `execution-status.literal.ts` 의 단일 SoT 로 통합하는 behavior-preserving 리팩터로, 함수 시그니처·OpenAPI wire 계약·전역 상태·파일시스템·환경변수·네트워크·이벤트 어느 축에서도 실질적 회귀는 없다. 다만 직전 라운드(WARNING/INFO 반영 과정에서 `enum: [...SPREAD]` → `enum: DIRECT_REF` 로 바뀐 I2 수정) 이후, 두 독립된 응답 DTO 가 비-freeze mutable 배열 인스턴스 하나를 직접 공유하게 됐다는 점은 부작용 관점에서 새로 짚어둘 가치가 있다 — `@nestjs/swagger` 소스 확인 결과 현재는 이 배열을 in-place 로 변형하는 코드 경로가 없어 실질 위험은 없고, 같은 모듈의 `INTERACT_COMMANDS` 도 동일한 패턴이라 컨벤션 일탈도 아니다. 그 외 필드 타입 alias 치환은 실제 소비 코드(`interaction.service.ts`) 대조로 투명함을 확인했고, 신규 파일·리뷰 산출물 추가도 diff 범위·프로젝트 컨벤션과 일치하는 예상된 부작용이다.

## 위험도

LOW
