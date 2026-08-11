# Maintainability Review — `10_02_22`

## 발견사항

- **[INFO]** `shouldAbortAfterSeed` JSDoc breadcrumb — 확인됨, 이전 WARNING 정상 반영
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:130-135`
  - 상세: 직전 라운드(`18_51_07`) WARNING("defer 항목이 plan 에만 있고 트리거 시점에 발견될 코드 경로가 없다")을 반영해, `shouldAbortAfterSeed` JSDoc 의 "다섯 번째 갈래를 추가하려는 사람에게" 문단에 `plan/in-progress/webchat-auth-session-status-reconcile.md §꼬리 블록 중복` 링크와 "그 plan 제목은 'frontmatter 재판정' 이라 이 항목을 우연히 열어볼 이유가 없다 — 그래서 여기 breadcrumb 을 둔다" 라는 명시적 사유가 달려 있다. 실제로 5번째 `SeedOutcome` 갈래를 추가하려는 사람이 반드시 여는 자리(헬퍼 JSDoc 바로 그 문단)에 붙어 있어 "발견될 경로가 없다"는 원 지적이 구조적으로 해소됐다. 링크된 plan 문서를 직접 열어 `## start()/applyConfig 꼬리 블록 중복` 절이 실재함도 대조 확인했다(`plan/in-progress/webchat-auth-session-status-reconcile.md:245`). 같은 파일의 다른 breadcrumb(`SeedOutcome`·`StreamClaim` JSDoc 등)과 형식이 일관돼 "이 파일만 다른 스타일"이라는 지적도 해소됐다.
  - 제안: 없음(확인 완료).

- **[INFO]** `runApplyConfig` 헬퍼 — 호출부 2곳 통합, 가독성·네이밍 양호
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1232-1247`(정의), `:1250`(`bridge.onBoot`)·`:1286`(direct-load fallback) 호출부
  - 상세: `void applyConfig(cfg).catch(...)` 패턴이 두 호출부에 각각 따로 있었다면 재발했을 "한쪽만 catch 를 붙인다" 결함(이 파일이 반복적으로 낸 형태)을 헬퍼 하나로 막는다. JSDoc 이 헬퍼가 필요한 이유(unhandled rejection → 토큰 포함 메시지가 redaction 없이 콘솔에 그대로 찍힘)와 "처음 고칠 때 실제로 한쪽만 고쳤다"는 반복 이력을 함께 적어 두어, 같은 파일의 `shouldAbortAfterSeed`·`applyRefreshedToken` 등과 동일한 "왜 추출했는가" 서술 관례를 따른다. 이름(`runApplyConfig`)도 "실행하고 실패를 반드시 처리한다"는 의도를 동사로 드러내 목적에 부합한다. 두 호출부 모두 리터럴 `.catch` 복제 없이 헬퍼만 호출하는 것을 확인했다.
  - 제안: 없음. 다만 모듈 스코프가 아니라 effect 콜백 내부 지역 함수인데, 이는 `applyConfig`(같은 effect 안의 클로저)를 캡처해야 하므로 불가피한 배치이고 주변 `bridge`·`fallback` 등 다른 지역 상수와도 스타일이 일치한다 — 지적 대상 아님.

- **[WARNING]** SSE `onError` 의 인라인 타입 추출 삼항식이 호출부에 두기엔 밀도가 높다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:477-481`
    ```
    onError: (e) =>
      console.warn(
        "[widget] SSE stream error — ...",
        e && typeof e === "object" && "type" in e ? String((e as { type: unknown }).type) : "error",
      ),
    ```
  - 상세: `console.warn` 호출의 두 번째 인자 자리에 (1) null 배제(`e &&`) (2) `typeof` 좁히기 (3) `in` 연산자 존재 확인 (4) 인라인 타입 단언(`as { type: unknown }`) (5) `String(...)` 변환 (6) 폴백 리터럴까지 6개 단계가 한 표현식에 압축돼 있다. 같은 파일·같은 diff 묶음에서 정확히 이 성격(타입 좁히기 + 판정)의 로직은 전부 이름 있는 모듈 함수로 뽑혀 JSDoc 을 달고 있다 — `shouldAbortAfterSeed`(:137), `isTerminalAuthError`(`eia-client.ts`), `redactToken`(`eia-client.ts`). 이 표현식만 콜백 리터럴 안에 남아 있어 같은 파일 안에서도 스타일이 갈린다. 읽는 사람은 `console.warn` 의 메시지 포맷을 눈으로 좇다가 중간에 타입 가드+캐스트+삼항을 파싱해야 하는데, 이는 다른 어디에서도 재사용되지 않고(리포지토리 전체에서 `grep` 으로 유일한 등장) 사이드이펙트(로그 출력)와 값 추출(어떤 종류의 에러인가) 두 책임이 한 줄에 뒤섞여 있다. 함수 길이·중첩 문제는 아니지만 "타입 판별 로직은 이름을 준다"는 이 PR 스스로가 세운 관례에서 벗어난다.
  - 제안: `isTerminalAuthError`/`redactToken` 과 같은 자리(예: `eia-client.ts` 혹은 `use-widget.ts` 모듈 스코프)에 작은 이름 있는 헬퍼로 뽑는다. 예:
    ```ts
    /** EventSource 의 error 이벤트에서 진단용 종류만 남긴다(원본 객체는 토큰이 실린 URL을 들고 있어 넘기지 않는다). */
    function sseErrorKind(e: unknown): string {
      return e && typeof e === "object" && "type" in e ? String((e as { type: unknown }).type) : "error";
    }
    ```
    그러면 `onError: (e) => console.warn("...", sseErrorKind(e))` 로 호출부가 한눈에 읽히고, 기존 뮤테이션 테스트(`onError` 가 원본 이벤트를 다시 찍게 복원하는 뮤턴트)도 헬퍼 단위로 직접 단언할 수 있어 검증 지점이 명확해진다.

## 요약

이번 라운드에서 새로 볼 대상으로 지목된 세 가지 — `shouldAbortAfterSeed` JSDoc breadcrumb, `runApplyConfig` 헬퍼, SSE `onError` 인라인 표현식 — 을 실제 소스(`use-widget.ts`)를 열어 대조했다. breadcrumb 은 직전 WARNING("defer 항목이 발견될 경로가 없다")을 구조적으로 해소했고, 링크된 plan 문서의 해당 절도 실재함을 확인했다. `runApplyConfig` 는 이 파일이 반복해 온 "가드를 한쪽에만 적용" 결함 클래스를 정확히 겨냥한 추출로, 이름·JSDoc·호출부 사용 모두 기존 관례(같은 diff 안의 `shouldAbortAfterSeed`·`applyRefreshedToken`)와 일관된다. 다만 SSE `onError` 의 타입 추출 삼항식은 같은 diff 안에서 동일 성격의 로직(`isTerminalAuthError`·`redactToken`·`shouldAbortAfterSeed`)이 전부 이름 있는 헬퍼로 뽑힌 것과 대조적으로 콜백 리터럴 안에 남아 있어, 이 PR 자신이 세운 "타입 판정 로직은 이름을 준다"는 관례에서 벗어난 유일한 지점이다 — 기능 결함은 아니지만 가독성·일관성 관점에서 추출을 권한다.

## 위험도

LOW
