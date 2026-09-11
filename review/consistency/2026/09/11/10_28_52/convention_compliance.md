# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위와 방법

Target: `spec/5-system/`(전체, 특히 프롬프트에 전문이 실린 `2-api-convention.md` · `1-auth.md` ·
`3-error-handling.md`). 예산 초과로 본문이 생략된 15개 파일(`4-execution-engine.md` 등)은
`plan/in-progress/impl-details-code-wiring.md`(이번 developer 턴의 실제 작업 스코프: `details[].code`
배선 · `botToken` `@MinLength(1)` · 메시지 리터럴 상수화 · `swagger.md:315` 인용 정정)와 무관해
Read 로 직접 열지 않았다. 대신 다음을 대조했다:

- `spec/conventions/swagger.md`(전문, 641줄) · `spec/conventions/error-codes.md`(전문) ·
  `spec/conventions/secret-store.md`(전문) · `spec/conventions/audit-actions.md`(전문)
- 실 코드 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (plan 이 인용하는
  자리를 실측으로 확인하기 위해서만 — 판정 대상은 여전히 spec 문서다)
- 같은 날 앞선 5개 consistency-check 라운드(`09_03_56`, `09_29_33` 등)의 SUMMARY — 오늘 이미
  `2-api-convention.md §5.3`(`#1316`) · `15-chat-channel.md`(`#1315`/`#1314`) 편집에 대해
  convention_compliance WARNING 3건이 나왔고, landed 본문에서 전부 해소를 재확인했다(아래 §1).

## 발견사항

### §1. 앞선 라운드 WARNING 3건 — landed 본문 재검증 (참고, 신규 아님)

`09_29_33` 라운드가 낸 WARNING 3건이 `94e19be8d`(`#1316`)로 머지된 실제 본문에 반영됐는지
직접 grep 으로 재확인했다:

- **WARNING #1**(감사 로그 `details` SoT 오인용 `audit-actions.md`) — **해소 확인**.
  `2-api-convention.md §5.3` 의 "감사 로그 `AuditLog.details`" 행은 현재
  `1-auth.md §4.1` + `data-flow/1-audit.md §1.1` 를 인용한다. `audit-actions.md` 인용 없음.
- **WARNING #2**(`swagger.md §1-7` 삽입이 `chat-channel-config.dto.ts:365` 의 `swagger.md:315`
  줄-번호 인용을 stale 화) — **예측이 실제로 발생했고, 지금 이 턴이 그 후속(item B)이다.**
  실측: `swagger.md` 의 "JSDoc 은 공개 OpenAPI 로 나간다" 규칙은 현재 **333줄**에 있는데
  (`§1-7` 이 18줄을 앞에 끼워 넣어 밀림), 코드 주석은 여전히 `swagger.md:315`(현재 그 줄은
  "## 3) 주석/설명 톤" 절 헤더 근방)를 가리킨다. `plan/in-progress/impl-details-code-wiring.md`
  의 item B(체크리스트 미완료)가 정확히 이 drift 를 절 참조로 바꾸는 작업이므로 **이 턴의
  범위 안에서 해소될 예정** — 새로 발견한 결함이 아니라 이미 추적 중인 항목의 확인이다.
- **WARNING #3**(`CV-*` 라벨이 `CCH-CV-0N`/`ED-CV-0N` 계열과 토큰 공유) — **해소 확인**.
  landed `spec/5-system/2-api-convention.md`·`15-chat-channel.md`·`spec/conventions/swagger.md`·
  `chat-channel-adapter.md` 어디에도 bare `CV-1`~`CV-4` 문자열이 없다 — 계획 문서 내부
  트래킹 라벨이 spec 본문에 삽입되지 않았다.

### §2. `2-api-convention.md §5.3` 신설 규칙("field 있으면 code 필수")의 conventions 정합성

- **INVALID_FIELD** 기본값은 `error-codes.md` §1(의미 기반 명명·`UPPER_SNAKE_CASE`)과
  일치하고, §5.3 스스로 "`CustomValidationPipe` 가 이미 쓰는 generic 코드"라 신규 등재
  불필요함을 명시 — `error-codes.md` §3(historical-artifact 레지스트리)에 새 예외를 만들
  필요가 없다.
- top-level `code` 교체 vs `details[].code` 택일표가 `error-codes.md §4.2`
  (`toTriggerParameterErrorDetails`)를 정확히 교차 인용하고 있어 두 문서의 파이프라인
  구분(§4.1 vs §4.2)과 어긋나지 않는다.
- "이 규칙을 강제하는 가드는 없다"를 §5.3 스스로 명시하고 `swagger.md §3 Rationale`의
  "37% 미준수는 규칙이 아니었다는 뜻"을 선례로 인용한 것은, 이 저장소가 이미 학습한
  "강제 없는 규칙은 소리 없이 표류한다"는 원칙을 신설 규칙에 선제 적용한 것 — 위반이
  아니라 conventions 의 취지를 앞당겨 따른 사례다.
- `15-chat-channel.md §5.4.1.2`(신설)는 `botTokenRef`/`inboundSigningRef`/`chatChannel`/
  `provider` 4개 필드 거부에 대해 "현재는 `details[].code` 를 싣지 않는다 — 배선은 뒤따르는
  developer PR"이라고 정확히 §5.3 규약과 현재 코드 상태의 간극을 명시한다. 실측(위 §2에서
  직접 읽은 `chat-channel-config.dto.ts`)과도 맞는다 — `botTokenRef`/`inboundSigningRef`
  거부는 `@IsEmpty()` 메시지만 있고 `code` 필드가 없다.

### §3. `secret-store.md`·`swagger.md` 대비 plan 항목 A/C/D 의 전제 사실 확인

- **C (`botToken` `@MinLength(1)`)**: 실측 확인 — `chat-channel-config.dto.ts:186-187` 은
  `@IsString()` `@MaxLength(256)` 뿐이고 `@MinLength` 가 없다. `swagger.md §1-1` 예시 패턴
  (`@MinLength`+`@MaxLength` 동반)과 어긋나는 선언 상태이므로, 추가하는 방향이 오히려
  convention 정합화다 — 이 항목에 규약 위반 소지 없음.
- **D (5개 필드 메시지 상수화)**: `botTokenRef`·`inboundSigningRef` 는 `ChatChannelConfigDto`
  (생성용, `@IsEmpty()` 로 내부 필드 외부 입력 차단)에, `botToken`·`inboundSigningPlaintext`
  는 생성/PATCH 양쪽에 실재한다 — plan 이 지목한 5개 필드 집합이 실제 DTO 선언과 일치한다.
  `secret-store.md §1.1` "비대상 필드도 응답 바디에는 나가지 않는다"의 대상 목록
  (`botTokenRef`·`inboundSigningRef` 포함)과도 필드명이 일치해 새 명명을 만들지 않는다.
- 위 두 항목 모두 **신규 명명·신규 패턴을 도입하지 않고 기존 선언의 누락을 메우는 성격**이라
  conventions 위반 가능성이 낮다.

### 결론 — CRITICAL/WARNING 신규 발견 없음

`spec/5-system/2-api-convention.md`·`1-auth.md`·`3-error-handling.md`(전문 대조) 및 이들이
가리키는 `swagger.md`·`error-codes.md`·`secret-store.md`·`audit-actions.md`(전문 대조) 사이에
새로운 명명·출력 포맷·문서 구조·API 문서 규약 위반을 찾지 못했다. 오늘 앞선 라운드가 낸
WARNING 3건은 2건 해소 확인, 1건(줄-번호 인용 stale)은 **이번 developer 턴이 이미 계획서
item B 로 잡아 둔 항목**이라 재차 새 항목으로 등재하지 않는다 — 구현 시 해당 인용을
`swagger.md:333`(현재 값) 같은 또 다른 매직넘버가 아니라 **절 참조**(`§3 주석/설명 톤`)로
바꾸는 것이 plan 문구와 일치하는지만 구현 후 확인하면 된다(정적 줄-번호는 재발 원인이므로).

## 요약

`spec/5-system/`(특히 이번 턴이 건드리는 `2-api-convention.md §5.3`·`15-chat-channel.md
§5.4.1/§5.4.1.2`)와 이들이 참조하는 `spec/conventions/**`(swagger·error-codes·secret-store·
audit-actions) 사이에 새로운 CRITICAL/WARNING 위반을 발견하지 못했다. 오늘 앞서 진행된
`--spec` 라운드(`09_03_56`→`09_29_33`)가 지적한 3건의 WARNING 중 2건은 landed 본문에서
해소가 실측 확인됐고, 나머지 1건(코드 주석의 `swagger.md:315` 줄-번호 인용이 `§1-7` 삽입으로
stale 화)은 정확히 이번 developer 턴의 계획서 item B 가 잡아 둔 후속 작업이라 새로 등재하지
않았다. Plan 의 구현 항목(A: `details[].code` 배선, C: `botToken` `@MinLength(1)`, D: 5개
필드 거부 메시지 상수화)은 모두 신규 명명·패턴을 도입하지 않고 기존 conventions 선언의
누락(강제 없는 신설 규칙, 선언보다 좁은 실제 검증, 두 층의 등가 메시지 중복)을 메우는
성격이라 conventions 위반 소지가 낮다.

## 위험도

NONE
