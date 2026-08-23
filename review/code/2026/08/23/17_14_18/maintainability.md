# 유지보수성(Maintainability) 리뷰

## 조사 방법

`git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 diff 범위를 재확인했다(5개
`codebase/**` 파일, `+217/-12`). 나머지 프롬프트 상 파일(`CHANGELOG.md`, `plan/**`,
`review/code/2026/08/23/16_46_56/**`)은 코드가 아닌 문서/이전 리뷰 산출물이라 이번
유지보수성 관점에서는 참고만 하고 실질 판단 대상에서 제외했다. 이전 라운드(`16_46_56`)의
WARNING #3(새 헬퍼 JSDoc 이 클래스 JSDoc 과 클래스 선언 사이에 낌)이 이번 diff 에서 실제로
해소됐는지 `Read` 로 `explore-tools.service.ts` 현재 상태를 직접 열어 확인했다.

## 발견사항

- **[INFO]** 같은 PR 안에서 `token` 계열 8종에 대한 회귀 테스트 커버리지가 두 소비처
  사이에 비대칭이다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:97`-`102`
    (`it.each([['csrf_token'],['auth_token'],['session_token'],['id_token'],['csrfToken']])`)
  - 상세: 같은 `DEFAULT_SENSITIVE_KEYS` 확장분(8개: `csrfToken`/`csrf_token`/`authToken`/
    `auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token`)을 지키는 캐너리가
    `mask-sensitive-fields.util.spec.ts` 쪽은 8종 전부(camelCase+snake_case 각 4쌍)를
    `it.each` 로 덮는 반면, `handler-output.adapter.spec.ts` 쪽은 5종만 덮고
    `authToken`·`sessionToken`·`idToken` (camelCase 3종)이 빠져 있다. 이 표면은 주석 자체가
    "이 목록의 유일한 방어선"이라고 명시할 만큼 중요하다고 강조하는데, 정작 그 표면의 회귀
    가드는 절반만 유틸 스펙과 대칭이라 다음에 목록을 넓히는 사람이 "여기는 이미 다 덮여
    있다"고 오인하기 쉽다.
  - 제안: `it.each` 목록을 유틸 스펙과 동일한 8개 키 세트로 맞춘다(리스트를 상수로 뽑아 두
    파일이 같은 배열을 참조하게 하면 향후 드리프트도 구조적으로 막을 수 있다).

- **[INFO]** 내부 컴포즈 함수 이름 `both` 는 여전히 "무엇의 양쪽인지"를 이름만으로 드러내지
  않는다 (이전 라운드 `16_46_56` maintainability INFO #2 와 동일 지점, 의도적으로 미조치됨)
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:92`
    (`const both = (v: unknown) => deepRedactSecrets(maskSensitiveFields(v));`)
  - 상세: `RESOLUTION.md`(`16_46_56` INFO #4)가 "바로 위 30줄 JSDoc 이 표로 설명하므로 이름을
    늘리면 중복"이라는 근거로 의도적으로 남겨 뒀고 그 판단 자체는 합리적이다. 다만 이 함수가
    JSDoc 과 물리적으로 분리되어 인용되는 경우(IDE go-to-definition, diff 리뷰 조각 등)에는
    여전히 `both` 하나만 보고 "키+값 이중 마스킹 합성"이라는 의미를 즉시 읽어내기 어렵다는
    지적은 유효하다. 재확인 차원의 참고이며 새로운 결함은 아니다.
  - 제안: 조치 불요(기존 결정 유지). 다음에 이 헬퍼를 손댈 일이 생기면 `redactLayered` 류
    이름으로 바꾸는 정도의 경량 개선을 고려할 수 있다.

## 확인했지만 문제 없음 (참고)

- 이전 라운드 WARNING #3(새 free function `redactAssistantFields` + 그 JSDoc 이 기존 클래스
  JSDoc 과 클래스 선언 사이에 끼어든 배치 문제)은 실제로 해소됨을 현재 소스로 직접
  확인했다 — `explore-tools.service.ts:53`-`98` 에 헬퍼+JSDoc 이 이제 클래스 JSDoc(`:100`-`113`)
  **위**에 놓이고, 클래스 JSDoc 과 `@Injectable()`/`class` 선언(`:115`-`116`) 사이에는 다시
  빈 줄 하나만 남아 인접성이 회복됐다.
- `redactAssistantFields` 자체는 짧고(구조적 타입 파라미터 + 3줄 반환) 중첩·매직넘버·복잡도
  문제가 없으며, `toNodeExecutionEnvelope`/`toExecutionEnvelope` 두 호출부의 중복 3줄씩
  (`inputData`/`outputData`/`error` 각각 `maskSensitiveFields` 호출)을 헬퍼 하나로 통합해
  오히려 기존 중복을 줄였다(`explore-tools.service.ts:511`, `:529` 의
  `...redactAssistantFields(...)` 스프레드).
- `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS` 신규 8개 항목은 기존 배열과
  같은 패턴(소문자 정규화, `Set` 완전 일치)을 그대로 따르고, 왜/어떻게 넓혔는지·blast radius
  실측 결과까지 인라인 주석으로 남겨 다음 확장자를 위한 안내가 충분하다. 다만 이 18줄
  주석 블록이 배열 리터럴 **중간**(`refresh_token` 과 `csrfToken` 사이)에 끼어 있어, 목록만
  빠르게 훑어보려는 독자에게는 스캔 흐름이 한 번 끊긴다 — 사소한 가독성 트레이드오프이고
  이 저장소의 문서화 관례상 감수할 만한 수준이라 별도 항목으로 올리지는 않는다.
- 신규 테스트(`mask-sensitive-fields.util.spec.ts` `it.each` 8건 + 대조군,
  `explore-tools.service.spec.ts` 캐너리 2건)는 기존 파일의 네이밍·구조·`describe`/`it` 스타일과
  일관되고, 새로 추가된 두 캐너리 테스트의 mock 설정 5줄 보일러플레이트도 같은 파일 내 기존
  테스트들과 동일한 패턴이라 새로운 중복으로 보지 않았다.
- 함수 길이·중첩 깊이·순환 복잡도 모두 이번 diff 범위(5개 코드 파일) 안에서 문제될 만한
  증가가 없다. 새 로직은 전부 얕은 depth 의 순차 호출/스프레드로 끝난다.

## 요약

이번 diff 는 코드 5개 파일(+217/-12)로 범위가 작고, 이전 리뷰 라운드(`16_46_56`)가 지적한
유일한 실질적 구조 결함(헬퍼 JSDoc 이 클래스 JSDoc 사이에 끼는 배치)이 이번 소스에서 실제로
해소된 것을 직접 확인했다. 신규 헬퍼 `redactAssistantFields` 는 기존 3중 반복 호출을 통합해
오히려 중복을 줄였고, 주석·JSDoc 이 "왜 두 겹인가/왜 포맷이 바뀌는가/왜 순서가 중요한가"를
상세히 남겨 이 저장소 기준으로 모범적인 수준이다. 남은 지적은 두 캐너리 테스트 파일 사이의
`token` 계열 8종 커버리지 비대칭(INFO)과 기존에 이미 논의·유지 결정된 `both` 네이밍(INFO)
정도로, 둘 다 병합을 막을 수준은 아니다.

## 위험도

LOW
