# 부작용(Side Effect) 리뷰

## 확인한 내용

리뷰 대상 diff 는 크게 세 부류다.

1. **엔티티 필드 타입 정합화** (파일 1·3·4·5·6·7·9·10·11) — `nullable: true` 인 DB 컬럼에 대응하는 TS 필드 타입을 `T | null` 로 넓히고, 일부 `@Column` 에 `type: 'varchar'`/`type: 'int'` 를 명시 추가.
2. **소비자 측 시그니처 정합화** (파일 13 `redact-stored-error.ts`) — 엔티티 타입 확장에 맞춰 `maskIfPresent`/`redactNodeExecutionRowForResponse` 의 파라미터·반환·제네릭 제약을 `| null` 허용으로 넓힘. 런타임 로직(`value == null ? value : mask(value) ?? value`)은 문자 그대로 동일.
3. **테스트 fixture 캐스트 제거** (파일 2·8·12) — `null as unknown as Date`/`Record<string, unknown>` 캐스트를 걷어냄. 엔티티 타입이 넓혀졌으므로 캐스트 없이도 타입이 맞는다.
4. **plan 문서·이전 리뷰 라운드 산출물** (파일 14, 15~46) — 작업 기록·리뷰 아티팩트. `review/code/**`·`review/consistency/**` 신규 파일 생성은 이 프로젝트 컨벤션(코드 리뷰 산출물 저장 위치)에 정확히 부합하는 **의도된** 파일시스템 쓰기다.

부작용 관점에서 직접 검증한 것:

- **시그니처 확장의 실제 영향** — `redactNodeExecutionRowForResponse` 를 프로덕션에서 부르는 곳은 `executions.service.ts:709` 단 한 곳(`grep` 로 확인). 제네릭 제약이 `Record<string, unknown>` → `Record<string, unknown> | null` 로 넓어진 것은 **공변적으로 안전한 확장**(더 넓은 타입을 받아들임)이라 기존 호출부가 깨지지 않는다. `redactStoredFieldsForResponse` 를 부르는 3곳(`background-runs.service.ts:302`, `executions.service.ts:1010,1077`)도 시그니처가 이미 `| null` 을 받던 자리라 영향 없음.
- **엔티티 필드가 nullable 로 넓어지며 생길 수 있는 하류 NPE** — `.avatarUrl.`/`.oauthProvider.`/`.endpointPath.`/`.resourceType.`/`.description.`/`.lastTriggeredAt.` 등 non-null 가정 체이닝 호출을 전수 grep 했다. 걸린 자리들을 개별 확인한 결과:
  - `kb-tool-provider.ts:145` `kb.description.trim()` — 같은 줄의 `kb.description?.trim()` truthy 체크로 이미 narrowing 되어 있어 안전.
  - `integration-oauth.service.ts:500` `service.oauthProvider.toUpperCase()` — `service` 는 `User` 가 아니라 별개의 OAuth 연동 서비스 타입이라 이번 diff 의 `User.oauthProvider` 와 무관.
  - `alerts-evaluator.service.ts:194` `rule.lastTriggeredAt.getTime()` — `rule` 은 `AlertRule` 이지 `Trigger` 가 아니며(동명이지만 별개 필드), 바로 위 `if (!rule.lastTriggeredAt) return false;` 로 이미 가드됨.
  - 이번 diff 가 실제로 넓힌 `Trigger.lastTriggeredAt` 은 `hooks.service.ts:227,687` 두 곳에서 **대입만** 되고 non-null 가정 하에 읽히는 자리가 없음(`grep` 전수 확인).
  - 결론: 이번 diff 로 새로 노출되는 null-역참조 경로를 못 찾았다. (다른 리뷰어의 INFO#2 도 같은 결론.)
- **`@Column({ type: ... })` 추가가 TypeORM 런타임에 미치는 영향** — `type:` 메타데이터는 쿼리 빌더 파라미터 바인딩·(잠재적) `synchronize` DDL 생성에 쓰인다. `synchronize: false` 가 전 TypeORM 모듈 등록(`app.module.ts:112` 등)에서 확인되고, `migrations/` 에 신규 `.sql` 이 diff 에 없어 **자동 DDL 부작용은 없음**. 다만 이 변경 자체가 "타입 애노테이션만 바꾼 것"이 아니라 **TypeORM 이 소비하는 메타데이터를 실제로 바꾸는 것**이라는 점은 명확히 인지할 필요가 있다 — plan 문서(파일 14)가 배치 1 에서 `type:` 누락이 `design:type` 리플렉션을 `Object` 로 오인시켜 `DataTypeNotSupportedError` 로 **실제 부팅 실패**를 냈던 사례를 기록하고 있고, 이번 배치는 그 재발을 막기 위해 넓히는 필드마다 `type:` 동반 여부를 점검했다고 밝힌다. 즉 "부작용을 낼 수 있는 변경"을 사전에 인지하고 실측(DB `information_schema` 대조, e2e 부팅 확인)으로 닫은 것으로 보인다.
- **전역 상태·환경 변수·네트워크 호출·이벤트/콜백** — 해당 변경 범위(엔티티 타입 선언, 마스킹 유틸 시그니처, 테스트 fixture)에 전역 변수 도입/수정, `process.env` 읽기/쓰기, 외부 HTTP 호출, 이벤트 emit/콜백 등록 변경은 없음.
- **plan/리뷰 산출물 파일 쓰기** — `review/code/2026/09/03/{16_45_35,17_09_06}/*`, `review/consistency/2026/09/03/17_09_09/*` 신규 파일들은 이전 리뷰 라운드의 산출물이며 이번 커밋 범위에 정상 포함된 것(gitignore 대상 아님, 프로젝트 컨벤션상 `review/**` 는 커밋 대상). 코드 부작용은 아니며 `meta.json` 등에 비밀값·절대경로 노출도 없음(확인함).

## 발견사항

없음. CRITICAL/WARNING 급 부작용을 찾지 못했다.

- **[INFO]** `@Column` 에 명시 `type:` 을 추가하는 것은 TypeORM 이 실제로 소비하는 메타데이터 변경이라 "타입 선언만 바꾼 것"보다 위험 표면이 넓다
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:62`(`durationMs`), `codebase/backend/src/modules/notifications/entities/notification.entity.ts:40-45`(`resourceType`), `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:62-67`(`endpointPath`), `codebase/backend/src/modules/users/entities/user.entity.ts:32`·`152-158`·`160-166`(`avatarUrl`/`oauthProvider`/`oauthProviderId`), `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:66`(`durationMs`)
  - 상세: `synchronize: false` + 신규 마이그레이션 없음으로 이번 diff 는 안전하지만, 이 패턴(엔티티 타입을 `| null` 로 넓히면서 `type:` 을 같이 명시)은 배치 1 에서 실제 부팅 실패를 낸 전례가 있는 변경 클래스다. 향후 배치 3(아직 남은 6개 파일)에서 동일 패턴을 반복할 때 `type:` 을 빠뜨리면 같은 클래스의 부작용(부팅 실패)이 재발할 수 있다 — 이미 plan 문서에 회귀 가드(`findUntypedNullableColumns`)로 닫혀 있는 것으로 보이나, 부작용 관점에서 "왜 이 필드들만 `type:` 을 추가로 받았는지"를 명시적으로 인지해 둘 가치가 있어 INFO 로 남긴다.
  - 제안: 조치 불요(가드가 이미 존재). 배치 3 진행 시 같은 가드가 계속 적용되는지만 확인.

## 요약

이번 diff 는 9개 TypeORM 엔티티의 필드 타입을 기존에 이미 `nullable: true` 였던 DB 컬럼 실제 상태에 맞춰 `T | null` 로 넓히고, 그 여파로 `redact-stored-error.ts` 의 마스킹 유틸 시그니처를 같은 방향으로 넓힌 변경이다. 시그니처 확장은 모두 공변적으로 안전한 방향(더 넓게 받는 방향)이고 실제 프로덕션 호출부를 전수 확인했을 때 깨지는 자리가 없었다. 새로 nullable 이 된 필드에 대한 non-null 가정 체이닝 호출도 전수 grep 해 확인했으나 이번 diff 가 새로 노출하는 null-역참조 경로는 찾지 못했다(걸린 후보 3곳은 모두 무관한 타입이거나 이미 가드돼 있었다). `@Column({ type: ... })` 메타데이터 추가는 TypeORM 런타임이 실제로 소비하는 값이라 위험 표면이 없지 않지만, `synchronize: false`·신규 마이그레이션 부재·DB 실측 대조로 이번 범위에서는 안전하게 닫혀 있다. `review/**` 하위 신규 파일들은 프로젝트 컨벤션에 따른 의도된 산출물 저장이다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 표면에는 변경이 없다.

## 위험도

LOW
