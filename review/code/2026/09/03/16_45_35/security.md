# 보안(Security) 코드 리뷰

## 대상 개요

`plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 2 — TypeORM 엔티티 9개 파일의
`nullable: true` 컬럼/relation 30건에 대해 TS 타입을 `T` → `T | null` 로 넓히고, `design:type` 오추론
버그(batch 1 에서 발견된 `DataTypeNotSupportedError: Data type "Object"`) 방지를 위해 일부 `@Column`
에 `type: 'varchar' | 'int'` 를 명시적으로 추가한 순수 타입-정합 리팩터. 부수적으로
`shared/utils/redact-stored-error.ts` 의 `maskIfPresent`/`redactNodeExecutionRowForResponse` 시그니처가
같은 이유로 `| null` 을 받아들이도록 넓혀졌고, plan 문서 갱신이 동반된다. 새 엔드포인트·새 쿼리·새
입력 처리 로직은 없다.

## 발견사항

- **[INFO]** 타입 확장은 런타임 동작을 바꾸지 않음 — 확인된 사실
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` 전체, `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` 전체, 그 외 7개 엔티티 파일 전체 (Review 유형, 게이트 숫자는 각 파일 "전체 파일 컨텍스트" 블록 참조)
  - 상세: 변경된 컬럼들은 DB 상에서 이미 `nullable: true` 였고(마이그레이션 SoT), 이번 diff 는 TS 타입 애노테이션(`string` → `string | null` 등)과 `@Column` 의 `type:` 힌트만 추가한다. `TypeOrmModule` 은 `synchronize: false` 로 구성되어 있어(`codebase/backend/src/app.module.ts`) 이 `type:` 메타데이터 추가가 프로덕션 스키마에 대한 자동 `ALTER` 를 유발하지 않는다 — Flyway 가 단일 스키마 SoT 이며 이 변경은 TypeORM 런타임 직렬화 계층(‘Object’ 오추론 버그 회피)에만 영향을 준다. 인젝션·인가·시크릿 노출 관점에서 새로 열리는 표면이 없다.
  - 제안: 해당 없음 — 확인 목적의 기록.

- **[INFO]** `redact-stored-error.ts` 마스킹 로직은 동작 불변 — null-safety 계약이 "런타임 방어"에서 "정적으로 도달하는 실경로"로 승격됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` — `maskIfPresent` (게이트 156~161), `redactNodeExecutionRowForResponse` 제네릭 제약 (게이트 176~190)
  - 상세: `maskIfPresent` 의 `return value == null ? value : (mask(value) ?? value);` (게이트 160) 는 변경 전부터 loose-equality(`== null`)로 `null`/`undefined` 를 동일하게 처리하고 있었다. 이번 diff 는 파라미터·반환 타입에 `| null` 을 추가해 이미 존재하던 런타임 동작을 타입 시스템에 정직하게 반영한 것뿐이다. 이 함수는 `error`/`inputData`/`outputData` 같은 자격증명·민감정보가 흐를 수 있는 egress 마스킹 경로(§R17)를 감싸는 보안 관련 유틸이므로 특히 눈여겨봤으나, 마스킹 대상 값에 대한 `null`/`undefined` 처리 로직 자체는 변경되지 않았고 `deepRedactSecrets` 호출 경로도 그대로다 — 레드액션 우회(bypass) 경로가 새로 생기지 않는다.
  - 제안: 해당 없음 — 확인 목적의 기록. (기존 문서 취소선 처리·전제 정정은 규약대로 적절히 수행됨 — `자기-반증형 소정정` 5조건을 이 파일 자체에 대해서는 적용하지 않고 developer 산문 코멘트로만 정정했으며, 이는 `spec/` 문서가 아니라 소스 내 JSDoc 이므로 해당 규약의 적용 대상도 아니다.)

- **[INFO]** nullable 확장이 하류(downstream) 호출부의 null-역참조 가능성을 넓힌다 — 이 diff 범위 밖이라 확인 불가
  - 위치: 예 — `codebase/backend/src/modules/users/entities/user.entity.ts:33`(`avatarUrl`), `:158`(`oauthProvider`), `:166`(`oauthProviderId`); `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:68`(`endpointPath`); `codebase/backend/src/modules/notifications/entities/notification.entity.ts:46`(`resourceType`), `:49`(`resourceId`)
  - 상세: 이 필드들은 DB 상 원래도 nullable 이었으므로 런타임에서 `null` 이 나올 가능성 자체는 이번 diff 이전에도 있었다(타입만 거짓말하고 있었을 뿐). 따라서 이 변경이 *새로운* null 경로를 만드는 것은 아니다. 다만 `strictNullChecks` 하에서 타입이 넓어지면 `tsc` 가 이 필드들을 참조하는 하류 코드에서 컴파일 오류를 낼 수 있고(plan 문서에 따르면 이번 배치는 빌드 그린을 확인했다는 서술이 명시적으로 없음 — 배치 1 에서만 "타입 오류가 0건 늘었다" 언급, 배치 2 본문에는 동일 확인 문구가 없다), 만약 `!`(non-null assertion) 이나 `as` 캐스트로 우회한 자리가 있다면 `oauthProviderId`/`endpointPath`(webhook 인증 경로 관련 필드) 처럼 인가·라우팅에 관여하는 필드에서 null 값이 인가 검사를 조용히 우회할 잠재 가능성이 있다. 이 프롬프트에 제공된 diff 에는 그런 하류 호출부가 포함되어 있지 않아 실제 위반 여부를 이 리뷰만으로는 확인할 수 없다.
  - 제안: `--impl-done` 또는 별도 리뷰에서 `oauthProviderId`/`endpointPath`/`authConfigId` 등 인증·라우팅 관련 nullable 필드의 호출부가 `tsc` strict 모드로 실제 통과했는지, 그리고 `!`/`as` 캐스트로 null 체크를 생략한 자리가 없는지 확인 권장 (보안이라기보다 타입-정합/신뢰성 검증에 가까우나, 위 필드들이 인가·라우팅에 관여하므로 명시).

## 요약

이번 변경은 9개 TypeORM 엔티티의 nullable 컬럼/relation TS 타입을 실제 DB 스키마(이미 `nullable: true`)와 일치시키는 순수 타입-정합 리팩터이며, `redact-stored-error.ts` 의 시그니처 확장도 기존 런타임 동작(loose `== null` 처리)을 타입으로 정직하게 반영한 것에 불과하다. `synchronize: false` 확인 결과 `@Column type:` 메타데이터 추가가 프로덕션 스키마에 영향을 주지 않으며, 새로운 인젝션·인증 우회·시크릿 노출 표면은 발견되지 않았다. 유일한 잔여 관심사는 이번 diff 범위 밖의 하류 호출부에서 nullable 확장에 따른 null-역참조/캐스트 우회 가능성이나, 이는 이 diff 자체의 결함이 아니라 별도 확인이 필요한 후속 확인 항목이다.

## 위험도
NONE
