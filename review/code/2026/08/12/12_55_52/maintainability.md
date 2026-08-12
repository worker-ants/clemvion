# 유지보수성(Maintainability) 리뷰 결과

델타 = `origin/main...HEAD` 누적 diff(62개 파일, 커밋 9개). 이 중 앞선 4라운드
(`11_06_12`→`12_05_39`→`12_24_14`→`12_40_58`)가 이미 상세 검토해 전부 **NONE**(강제 수정
사유 없음)으로 수렴한 부분(실질 소스 12개 파일 + `package.json`/`README.md` 타입 전용 lint
처분, `idempotency.interceptor.{ts,spec.ts}`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
그리고 `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14,12_40_58}/*` 리뷰 산출물 커밋)은
재확인만 했다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 는 직전 라운드 이후
바이트 단위로 무변경임을 `git diff b0b57366f..cec79b004 -- plan/...md` 로 직접 확인했다(출력 없음).

이번 라운드에서 **진짜 새로 생긴** 부분은 커밋 `cec79b004` 하나뿐이다: 소스 3곳(`:42-45`,
`:122-131`, `:157-159`)의 §R8 관련 주석 정정, 신규 헬퍼 `makeInterceptor()` 도입(생성자
인라인 7곳 → 1곳), 테스트 제목의 마크다운 `**...**` 제거, 손상 캐시 테스트의 저장값 단언
추가. 이 다섯 가지는 모두 직전 라운드(`12_40_58`) 자신의 WARNING 1건 + INFO 3건을 그대로
반영한 결과이며, 코드를 직접 열어 대조한 결과 실제로 정확히 그렇게 반영됐다.

## 발견사항

- **[INFO]** 저장된 캐시 값을 파싱해 단언하는 패턴이 스펙 파일 안에서 소규모 반복되기 시작함
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:276-283`
    (`손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`), `:307-310`
    (`` `status`/`statusCode` 가 없는 응답에서도... ``) — 둘 다
    `JSON.parse(redis.set.mock.calls[0][1] as string) as {...}` 형태로 인라인 캐스트한 뒤
    필드를 단언한다(직접 `Read` 로 실측, 앞 라운드에서는 지적되지 않았던 신규 코드).
  - 상세: 이번 라운드에 추가된 저장값 단언(`bodyHash`/`statusCode`/`responseJson`)은 이전
    라운드 WARNING/INFO 를 정확히 메운 좋은 개선이지만, 그 결과로 "`redis.set` 의 두 번째
    인자를 파싱해 캐스팅" 하는 3줄짜리 관용구가 파일에 2번 나타나게 됐다. 두 곳의 캐스트
    타입이 서로 다른 부분집합(`{bodyHash, responseJson, statusCode}` vs `{statusCode}`)이라
    지금 당장 하나로 합치면 오히려 불필요하게 넓은 타입을 강제하게 된다 — 2회 반복은 강제
    추출 사유로 보기엔 이르다.
  - 제안: 조치 불요. 이 파일이 같은 스타일(`makeInterceptor` 도입 이력처럼)로 반복이 3회
    이상으로 늘어나는 시점에 `readStoredEntry(redis)` 류 헬퍼로 추출을 재고려.

- **[NONE]** `makeInterceptor()` 헬퍼 추출 — 직전 라운드 INFO 를 정확히 해소
  - 위치: `idempotency.interceptor.spec.ts:80-87`(정의), `:178, 205, 219, 244, 260, 293, 323`(사용 7곳)
  - 상세: `12_40_58` 라운드가 "생성자 인라인 7곳, 다른 인자는 `redis` 하나뿐" 이라고 지적한
    내용을 정확히 반영했다 — 실제로 7곳 모두 `new IdempotencyInterceptor(undefined, redis as
    never, undefined)` 동일 형태였고 이제 `makeInterceptor(redis)` 1곳으로 줄었다. 위쪽
    `W-4 provider 경로` describe 블록(4건)은 `redisConn` 주입 우선순위 자체가 검증 대상이라
    생성자를 그대로 노출해 뒀는데, 그 이유가 헬퍼 바로 위 docstring 에 명시돼 있어(`:81-83`)
    "왜 이쪽은 안 묶었는가" 에 대한 답이 코드에 남아 있다.

- **[NONE]** 테스트 제목의 마크다운 강조 문법(`**...**`) 제거 — 직전 라운드 INFO 를 정확히 해소
  - 위치: `idempotency.interceptor.spec.ts:229` (`409 도 캐시되지 않는다 — R8 위반 상태를
    고정하는 캐너리`)
  - 상세: `**R8 위반 상태를 고정하는 캐너리**` → 별표 제거. 파일 내 나머지 10개 `it(...)`
    제목과 스타일이 통일됐다.

- **[NONE]** 소스 주석 3곳 정정(`:42-45`, `:122-131`, `:157-159`) — 산문 정확도 개선, 코드
  구조·복잡도 변화 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  - 상세: `IdempotencyEntry.responseJson` 필드 docstring, `cacheTapped()` 메서드 docstring,
    error 분기 인라인 주석 세 곳이 전부 "R8 상 실제 캐시 대상"과 "현재 구현이 그보다 좁게
    적재한다"는 사실을 명확히 분리해 서술한다. `cacheTapped()` docstring 이 13줄로 길어졌지만
    private 메서드 하나에 대한 선재 결함 설명이라는 목적이 뚜렷하고, 다른 두 자리가 이 곳을
    참조(`` `cacheTapped()` docstring 의 선재 결함 설명 참조 ``)해 같은 설명을 중복 서술하지
    않는다 — 정보를 한 곳에 모으고 나머지는 포인터로 처리한 것은 좋은 선택이다. 함수 본문
    코드 자체(제어 흐름·조건문·매직넘버)는 이번 커밋에서 1바이트도 바뀌지 않았다.

- **[NONE]** 이전 4라운드가 이미 검토·수렴한 12개 소스 파일(README, package.json 포함) —
  재확인 결과 그 사이 추가 변경 없음
  - 위치: `workspace-reflection-canary.ts`, `chat-channel.dispatcher.ts`,
    `execution-engine.service.ts`, `executions.service.ts`, `triggers/dto/chat-channel-config.dto.ts`,
    `triggers.service.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`,
    `migrate-node-output-refs.ts`/`.spec.ts`, `README.md`, `package.json`
  - 상세: 전부 `no-unsafe-*` lint warning 처분을 위한 타입 주석/제네릭/단언 추가뿐이며(로직
    변경 없음, side_effect 리뷰가 emit md5 동일로 실증 승계), 콜백 시그니처 반복 6곳
    (`migrate-node-output-refs.ts`)·`HttpResponseLike` 네이밍·`Array.isArray` 주석 반복 등
    앞선 라운드의 상세 판정(전부 조치 불요)이 그대로 유효하다.

- **[NONE]** `plan/in-progress/backend-lint-gate-broken-on-main.md` — 직전 라운드 이후 무변경
  - 상세: `git diff b0b57366f..cec79b004 -- plan/...md` 출력이 비어 있음을 직접 확인. 산문
    문서이며 코드 유지보수성 기준 적용 대상도 아니다.

- **[NONE]** `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14,12_40_58}/*` 리뷰 산출물 커밋 — 코드 아님
  - 상세: RESOLUTION/SUMMARY/reviewer md/meta.json/`_retry_state.json` 전부 산문·구조화
    데이터 문서로, 함수 길이·중첩·매직넘버 등 코드 유지보수성 기준이 적용되지 않는다.
    저장소 표준 워크플로(구현 완료 후 `/ai-review` 산출물 커밋)에 부합.

## 요약

이번 라운드의 실질 신규 변경(`cec79b004`)은 직전 라운드가 스스로 남긴 WARNING 1건 + INFO
3건을 정확히 반영한 정리 커밋이다 — `makeInterceptor()` 헬퍼로 생성자 인라인 반복 7곳을
1곳으로 줄였고, 마크다운 강조 문법을 제거해 테스트 제목 스타일을 통일했으며, 손상 캐시
테스트에 저장값 단언을 추가하고, 소스 주석 3곳을 spec §R8 원문과 정합하도록 정정했다(코드
동작·구조는 무변경). 유일하게 새로 관찰되는 것은 그 저장값 단언 추가로 인해 "캐시 저장
JSON 을 파싱해 캐스팅" 하는 3줄짜리 패턴이 스펙 파일에 2회 나타난다는 점인데, 서로 다른
필드 부분집합을 단언하는 2회 반복은 지금 강제로 묶을 사유가 아니다. 나머지 12개 소스
파일·README·package.json·plan 문서·이전 4라운드 리뷰 산출물은 전부 이전 라운드 판정(NONE)이
변경 없이 그대로 유효하다. CRITICAL/WARNING 급 유지보수성 결함은 없다 — 4라운드 연속 코드
동작 변경 0, 이번 라운드도 그 축에서 수렴 상태를 유지한다.

## 위험도

NONE
