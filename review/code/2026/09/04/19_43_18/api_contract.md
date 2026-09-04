# API 계약(API Contract) 리뷰

## 범위 확정

이번 changeset 의 실제 diff hunk 는 세 파일이며, 그중 API 계약과 직접 관련된 변경은 다음
둘뿐이다 (`CHANGELOG.md`·`spec-draft-nullable-notation-followups.md` 의 나머지 대량 텍스트는
기존 내용이 컨텍스트로 재표시된 것이지 이번 diff 의 일부가 아니다 — `@@ -1,5 +1,33 @@` 헌크가
그것을 확정한다):

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold` 타입을 `number` → `string` 으로, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })` 로 정정.
2. `CHANGELOG.md` — 위 변경을 설명하는 신규 섹션 추가 (docs).
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신
   (코드 아님, API 계약에 직접 영향 없음).

## 발견사항

- **[INFO]** `threshold` 타입 정정은 wire 불변·문서만 사실화 — 실측으로 뒷받침됨
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20-37`
  - 상세: `AlertRuleDto.threshold` 가 실제로는 `numeric(12,4)` 컬럼을 TypeORM 이 정밀도 보존을
    위해 문자열로 반환하는 값인데 종전 Swagger 선언은 `number` 였다. 컨트롤러
    (`alerts.controller.ts`) 는 `AlertRuleDto` 를 반환 타입으로 annotate 하지 않고 엔티티를
    그대로 반환하므로(`grep` 확인: `AlertRuleDto` 는 `@ApiOkWrappedArrayResponse` 데코레이터
    인자로만 쓰이고 실제 반환 타입 자리에는 없음) `tsc` 가 이 불일치를 잡을 수 없었던 것도
    맞다. 유일한 내부 소비자 `codebase/frontend/src/lib/api/alerts.ts` 는 이미 읽기 타입을
    `threshold: string` 으로 손수 선언해 두었음을 확인했다(`grep` 결과: 11번째 줄
    `threshold: string;`, 21번째 줄 쓰기 DTO 는 `threshold: number;`). 즉 wire 바이트·내부
    소비자 동작 모두 변화 없음 — 순수 문서 정합화다.
  - 제안: 없음 (조치 불요, 근거가 코드로 검증됨).

- **[WARNING]** OpenAPI 코드젠 클라이언트 영향 고지가 같은 CHANGELOG 안의 자매 항목과 형식이
  다르다
  - 위치: `CHANGELOG.md:3-29` (신규 섹션 전체)
  - 상세: 같은 커밋(같은 CHANGELOG 파일) 안의 인접 항목들 — `ExecutionStatusDto` required
    변경(`CHANGELOG.md` 내 "5곳의 `required` 가 `false` → `true`" 섹션), `invitedBy`,
    `ipWhitelist` — 은 전부 "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 …" 형태의
    명시적 캐비엇을 붙인다. `AlertRuleDto.threshold` 항목만 이 패턴이 빠져 있다. 이 변경은
    `required` 플래그가 아니라 **원시 타입 자체**(`number` → `string`)를 바꾸므로, 오히려
    codegen 소비자에게 더 직접적인 영향(수치 연산·`toFixed()` 등이 컴파일 에러 또는 런타임
    타입 불일치로 드러남)을 준다. wire 바이트가 그대로라 런타임 파손은 없지만, "OpenAPI 스키마
    타입이 바뀌어 codegen 재생성 시 클라이언트 타입이 좁아지지 않고 **달라진다**" 는 사실은
    이 CHANGELOG 가 다른 항목에서 일관되게 지키는 고지 관행에서 벗어난다.
  - 제안: 다른 항목과 동일하게 "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서
    `threshold` 필드 타입이 `number` → `string` 으로 바뀐다. 실제 wire 는 종전부터 문자열이었
    으므로 이미 정상 동작하던 클라이언트는 영향이 없고, 잘못된 `number` 선언을 신뢰해 수치
    연산을 하던 코드가 있었다면 그 코드는 이미 런타임에서 깨지고 있었다." 정도의 한 문단을
    추가해 CHANGELOG 내부 일관성을 맞춘다.

- **[INFO]** `CreateAlertRuleDto.threshold` (요청측) 는 이번 diff 대상이 아니며 비대칭이 의도됨
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 밖 —
    `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts` (읽지 않음, CHANGELOG 서술 인용)
  - 상세: CHANGELOG 서술에 따르면 쓰기 DTO(`CreateAlertRuleDto.threshold`) 는 여전히 `number`
    를 받고 서비스가 `String(...)` 으로 저장한다 — 읽기/쓰기 타입 비대칭이 의도적이라고 명시돼
    있다. 요청 검증 관점에서 문제는 없으나(사용자가 숫자를 입력하는 UX 가 자연스럽다),
    응답 DTO 만 놓고 보면 "같은 리소스의 같은 필드가 요청·응답에서 타입이 다르다" 는 점은
    API 문서를 처음 보는 제3자 소비자에게는 직관적이지 않을 수 있다. 다만 이는 이번 diff 가
    새로 만든 상태가 아니라 기존부터 있던 설계이므로 이번 리뷰의 지적 대상은 아니다(참고용
    INFO).
  - 제안: 없음 — 이번 변경 범위 밖.

## 요약

이번 changeset 의 실질 API 계약 변경은 `AlertRuleDto.threshold` 의 Swagger/TS 타입을
`number` 에서 실제 wire 형태인 `string` 으로 정정한 것 하나이며, wire 바이트·내부 유일
소비자(`lib/api/alerts.ts`)의 동작 모두 코드 확인 결과 변화가 없는 순수 문서 정합화다. 요청
검증·에러 응답·URL 설계·페이지네이션·인증/인가에는 이번 diff 가 관여하지 않는다. 유일한
지적 사항은 CHANGELOG 서술 형식의 사소한 비일관성(codegen 클라이언트 영향 고지 누락)으로,
기능적 위험이 아니라 문서 완성도 문제다.

## 위험도

LOW
