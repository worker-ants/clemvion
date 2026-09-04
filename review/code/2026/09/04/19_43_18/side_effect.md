# 부작용(Side Effect) 리뷰

## 리뷰 범위

- `CHANGELOG.md` — 신규 항목 1건 추가(`AlertRuleDto.threshold` 오기 정정 서술). diff 상 실제 변경은 파일 앞부분 33줄 추가뿐이고, 그 아래 이어지는 기존 항목들은 문맥 표시일 뿐 이번 diff 의 변경분이 아니다.
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `AlertRuleDto.threshold` 필드를 `number` → `string`, `@ApiProperty({ example: 10 })` → `@ApiProperty({ type: String, example: '10.0000' })` 로 변경 + JSDoc 보강.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 진행 중 plan 문서의 서술 갱신(체크리스트 항목 반증 기록 추가). 코드 변경 없음.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 의 공개 OpenAPI 계약(타입) 변경 — 코드젠 클라이언트 영향 캐비엇 부재
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:36`(`@ApiProperty({ type: String, example: '10.0000' })`), `:37`(`threshold: string;`)
  - 상세: `@ApiProperty` 데코레이터가 만드는 OpenAPI 스키마는 이 API 의 **공개 인터페이스**다. `number` → `string` 전환은 실제 wire 바이트를 바꾸지 않지만(런타임 응답은 원래도 문자열이었음, 엔티티 확인: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:35` 도 `threshold: string`), OpenAPI 스키마에서 타입을 생성하는 외부 클라이언트에게는 생성 타입이 `number`→`string` 로 바뀌는 **인터페이스 변경**이다. 같은 CHANGELOG 파일의 다른 다수 항목(`ipWhitelist`, `invitedBy`, `ExecutionStatusDto` 등)은 "OpenAPI 로 타입을 생성하는 클라이언트에서 이 필드가 …" 식으로 코드젠 영향을 명시적으로 캐비엇하는 관례가 있는데, 이번 신규 항목(`CHANGELOG.md` 3~29행)만 "wire 는 바뀌지 않는다. 문서만 사실을 따라간다" 로 적고 코드젠 영향은 언급하지 않는다.
  - 저장소 내부 런타임 영향은 확인상 없음 — `AlertRuleDto` 는 `alerts.controller.ts` 에서 `@ApiOkWrappedArrayResponse(AlertRuleDto, …)` 데코레이터 인자로만 쓰이고, `list()` 핸들러는 반환 타입 애노테이션 없이 엔티티 배열을 그대로 반환한다(실측: `alerts.controller.ts:48`, `alerts.service.ts:14-18`). 즉 `AlertRuleDto` 클래스는 어디서도 인스턴스화·타입 강제되지 않아 이번 필드 타입 변경이 컴파일·런타임 어느 쪽에도 저장소 내부 side effect 를 만들지 않음을 확인했다.
  - 제안: 정보 제공 목적. 이미 틀린 문서(`number`)를 신뢰해 산출물을 만든 외부 클라이언트가 있었다면 그 클라이언트는 애초에 런타임에서 이미 깨져 있었을 것이므로(실제 wire 는 항상 문자열이었음) 이번 변경이 "새로운" breaking side effect 를 만드는 것은 아니다. 다만 같은 문서의 다른 항목들과 일관되게 "OpenAPI 코드젠 영향" 한 줄을 추가하면 문서 관례상 더 일관적이다. 코드 수정은 불필요.

## 요약

이번 diff 는 사실상 문서 정정(CHANGELOG 신규 항목 + plan 문서 서술 갱신)과 단일 DTO 필드의 타입 애노테이션 정정(`number`→`string`, 실제 wire·엔티티와 일치시킴)으로 구성된다. 함수 시그니처 변경, 전역 상태·환경 변수·파일시스템·네트워크 호출, 이벤트/콜백 관련 변경은 전혀 없다. `AlertRuleDto` 클래스가 컨트롤러 반환 타입으로 강제되지 않고 순수 Swagger 데코레이터 용도로만 소비된다는 사실을 직접 확인했으므로, DTO 타입 변경의 저장소 내부 side effect 는 없다. 유일하게 언급할 만한 것은 OpenAPI 스키마(공개 계약)가 바뀌어 외부 코드젠 클라이언트의 생성 타입이 달라질 수 있다는 점인데, 이는 실제 wire 데이터와 일치시키는 정정이라 위험은 낮다.

## 위험도

LOW
