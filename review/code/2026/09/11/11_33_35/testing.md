# 테스트(Testing) 리뷰 — `details[].code` 15자리 배선 + `botToken` `@MinLength(1)` + 메시지 상수화 (+ 후속 WARNING 4건 반영)

## 검증 방법

프롬프트 diff(파일 1~9)를 게이트 번호로 대조하고, `triggers.service.spec.ts`(파일 7)는 프롬프트에
diff 가 실리지 않아 `git diff origin/main` 으로 직접 확인했다. `npx jest password.util.spec.ts
trigger-dto-validation.spec.ts triggers.service.spec.ts` 를 직접 실행해 GREEN(211 passed, 1 skipped)
을 확인했다. 이 리뷰가 스스로 두 건의 뮤테이션을 저장소 파일에 가해 판별력을 재검증했다 — 두 경우
모두 **원본을 scratch 디렉터리(`cp`)로 백업 후 원복**했고, `git status --short` 로 잔여 변경이
`review/code/2026/09/11/11_33_35/`(이 세션 산출물) 뿐임을 확인했다:

1. `triggers.service.ts` 의 `authConfigId` throw 자리에서 `details.code` 를 제거 → `triggers.service.spec.ts`
   의 해당 단언이 **RED**(diff 예상 그대로 재현).
2. `triggers.service.spec.ts` 의 신규 `BLOCKED_FIELD_CASES` 배열에서 `botTokenRef` 항목을 제거 →
   신규 `[A] fixture 가 차단 5필드 전체를 덮는다` 캐너리가 **RED**(집합-커버리지 단언이 실제로
   판별력을 가짐을 확인).

이 PR 은 직전 라운드(`review/code/2026/09/11/11_05_27`)의 testing WARNING 은 없었고 INFO 4건이 있었는데,
그 결과를 반영한 후속 커밋(`0fb691248`)이 같은 diff 안에 포함돼 있다 — 아래 발견사항은 그 후속 반영
상태를 기준으로 재평가했다.

## 발견사항

- **[INFO]** PATCH 경로의 `details.code` wire-level(e2e) 증거가 여전히 없다 — POST 생성 경로만 커버.
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 파일 상단 주석(게이트 9줄,
    "커버리지는 **POST 생성 경로 전용**이고 PATCH 경로의 wire 증거는 아직 없다(후속 항목)")
  - 상세: 직전 라운드가 지적한 갭이 이번 후속 커밋에서도 의도적으로 미해결로 남았다 — 저장소를
    `grep -rln "chatChannel"`+`\.patch(` 로 전수 확인한 결과 `chatChannel` PATCH 거부 응답의
    `error.details` 를 실제 HTTP round-trip 으로 단언하는 e2e 는 없다. unit(`triggers.service.spec.ts`
    의 `[A]`/`[등가성]` it.each)은 `getResponse()` 를 직접 읽어 `GlobalExceptionFilter` 직렬화 경로를
    통과하지 않으므로, 같은 PR 이 "unit 은 이 축을 못 본다"며 POST e2e 5곳을 신설한 것과 동일한
    논리가 PATCH 에도 적용된다. 파일 헤더 주석·CHANGELOG 양쪽에 "후속 항목"으로 명시돼 있어 오독
    가능성은 낮다 — 차단 사유 아님, 재확인 성격의 INFO.
  - 제안: 최소 1개 PATCH e2e 케이스(`botToken` 또는 `botTokenRef`)에 `error.details` 를 `toEqual`
    로 고정해 두 진입점(POST/PATCH) 모두 wire 레벨 증거를 갖추게 한다.

- **[INFO]** `[C]` 테스트(`CreateTriggerDto` 의 `botToken: ''` 거부)가 `.toContain` 을 써서 "정확히
  이 위반 하나만 발생했다"를 단언하지 않는다 — 파일 내 다른 등가성 테스트들이 `toHaveLength(1)` 로
  개수를 명시하는 관례와 대비된다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` `[C] CreateTriggerDto
    는 botToken 빈 문자열을 거부한다` (게이트 964-988줄)
  - 상세: `cardBody('telegram')` 이 다른 모든 필드를 유효하게 채우므로 현재는 `details` 배열에
    `chatChannel.botToken` 항목 하나만 있을 것이 사실상 보장되지만, 테스트 자체는 그 사실에 의존하지
    않고 "포함"만 확인한다. 같은 파일의 `[등가성]`/`[A]` 테스트는 이미 `toHaveLength(1)` 을 추가해
    "정확히 이 필드만 거부됐다"를 명시적으로 고정한 반면(직전 라운드 testing INFO #3 반영 흔적),
    `[C]` 는 그 보강이 적용되지 않았다 — 같은 파일 안에서 판별력 수준이 갈린다.
  - 제안: `expect(thrown.details).toHaveLength(1)` 을 추가해 다른 등가성 테스트와 엄격도를 맞춘다.
    실질 위험은 낮음(LOW) — `cardBody` 가 확장되지 않는 한 깨질 가능성이 낮다.

## 확인한 강점 (직전 라운드 대비 실측 개선)

- **fixture 중복 WARNING(직전 라운드 maintainability #1) 해소, 그것도 "중복 제거"보다 한 단계 더
  나아갔다.** `triggers.service.spec.ts` 의 `[A]`/`[등가성]` 두 `it.each` 가 이제 `BLOCKED_FIELD_CASES`
  하나를 공유한다. 그런데 이 PR 은 여기서 멈추지 않고, "손으로 적은 배열이 `CHAT_CHANNEL_BLOCKED_FIELDS`
  와 실제로 같은 집합을 덮는가"를 별도 캐너리(`[A] fixture 가 차단 5필드 전체를 덮는다`)로 고정했다.
  이 리뷰가 직접 그 배열에서 원소 하나(`botTokenRef`)를 지워 확인한 결과 그 캐너리가 즉시 RED 가
  됐다 — "중복을 지웠다"는 서술이 아니라 "6번째 필드가 생겨도 조용히 안 빠진다"는 실제 보장이다.
- **`toMatchObject` 재귀 부분일치 함정을 실제로 판별력 있게 보강했다.** 직전 라운드가 지적한
  4자리 생존(`type`·`chatChannel`·`provider`·`authConfigId`) 중 `authConfigId` 자리를 이 리뷰가
  직접 재현(`code` 제거 → RED)해 CHANGELOG/plan 의 "15/15 개별 RED" 주장이 빈말이 아님을 확인했다.
- **등가성 테스트 쌍(D)이 리터럴 복사가 아니라 상수 참조로 두 층을 묶는다** — `trigger-dto-validation.spec.ts`
  의 `[등가성]`(파이프 층, `toHaveLength(1)` 포함)과 `triggers.service.spec.ts` 의 `[등가성]`(서비스 층)이
  둘 다 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 를 직접 참조해서 비교한다 — 상수를 고치면 두 테스트 중
  하나가 자동으로 반응한다.
- **`password.util.spec.ts` 의 `it.each` fixture 가 두 분기를 실제로 가른다** — `'P@ss1'`(3종·8자
  미만 → 길이 분기), `'alllowercase'`(8자 이상·1종 → 종류 분기)를 `validatePasswordStrength` 소스를
  직접 읽어 재계산한 결과 그대로 갈린다: 길이 검사가 먼저이므로 `'P@ss1'` 은 길이 분기에서 즉시
  throw, `'alllowercase'` 는 길이를 통과하고 타입-카운트(1종)에서 throw. 판별 fixture 선정이 정확하다.
- **테스트 격리** — `triggers.service.spec.ts` 의 `setup()` 이 매 테스트 `Test.createTestingModule().compile()`
  로 새 모듈을 만들고, `trigger-dto-validation.spec.ts` 의 `pipe`/`meta`/`cardBody` 는 상태 없는
  값이라 테스트 간 의존성이 없다. 실행 순서를 바꿔도(`--testSequencer` 무관) 결과가 달라지지 않는다.
  ts-jest 가 `isolatedModules` 미설정(기본 풀 타입체크)이라 `BLOCKED_FIELD_CASES` 의 튜플 타입 등
  테스트 코드 자체의 타입 오류도 `jest` 실행 시점에 걸린다 — "타입 가드 테스트가 실제로 실행되는가"
  갭이 이 파일들에는 해당하지 않는다.
- **회귀 없음** — 기존 `toMatchObject` 기반 단언(부분일치)은 `code` 추가로 깨지지 않고, 기존
  `toEqual` 기반 정확-일치 단언(e2e 5곳)은 이번 diff 에서 전부 `code` 를 반영해 갱신됐다 — 갱신
  누락 0건.
- **자기 서술 정확성** — `chat-channel-rejection-messages.const.ts` 헤더 주석이 직전 라운드가 지적한
  존재하지 않는 `*.spec.ts` 파일 인용을, 실제 두 테스트 위치(`trigger-dto-validation.spec.ts`
  `[등가성]` / `triggers.service.spec.ts` `[등가성]`)로 정확히 정정했다 — 다음 사람이 등가성 테스트를
  찾다 헤매지 않는다.

## 요약

이번 diff(원 배선 커밋 `0710021f0` + 후속 반영 커밋 `0fb691248`)는 15개 에러 페이로드 자리에
`code` 를 배선하면서 개별 뮤테이션(빼고-RED)으로 판별력을 검증했고, 이 리뷰가 독립적으로 재현한
두 뮤테이션(`authConfigId` 자리, 신설 fixture-완전성 캐너리)이 모두 주장한 대로 RED 를 냈다. 직전
라운드 testing INFO 3건(fixture 중복·등가성 length 미단언·공백 전용 미문서화) 중 fixture 중복은
"공유 배열"을 넘어 "집합 커버리지 캐너리"로, 등가성 length 미단언은 `[등가성]` 테스트에
`toHaveLength(1)` 추가로 실측 해소됐다 — 다만 같은 파일의 자매 테스트인 `[C]`(생성 경로 빈 문자열
거부)에는 그 강화가 적용되지 않아 판별력 수준이 파일 내에서 일관되지 않다(신규 INFO). PATCH 경로의
`details.code` wire-level e2e 증거 부재는 이번에도 의도적으로 미해결로 남았고 문서화도 유지된다 —
둘 다 차단 사유가 아니다.

## 위험도

LOW
