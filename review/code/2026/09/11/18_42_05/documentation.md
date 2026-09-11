# 문서화(Documentation) 리뷰 — `impl-chat-channel-binder-t2` (2라운드, `18_42_05`)

## 검증 방법

전체 diff(`git diff origin/main`)는 T1(`ba634a4b0`)·T2 이동(`a2e5b7e16`)·plan 후속 등재(`7e9aaa736`)·
이번 라운드 리뷰 수정(`92f4b0607`)까지 누적된 변경을 포함한다. 앞의 세 커밋은 직전 라운드
(`review/code/2026/09/11/18_04_36/documentation.md`)가 이미 문서화 관점에서 상세히 검토했고
(WARNING 2건 — JSDoc의 `plan/complete/` 선반영, spec 3곳 귀속 stale — 둘 다 이미 트래커/체크리스트에
등재됨), 이번 라운드는 그 위에 **새로 얹힌 `92f4b0607` 델타**(리뷰 W1·W2 대응 — 콜백 URL 함수를
named-args 로 전환 + `trigger-callback-url.spec.ts`/`chat-channel-binder.service.spec.ts` 신설)가
**새로운 문서화 결함을 만들었는지**에 집중해서 `git show 92f4b0607`로 실제 코드·JSDoc 변경분을
직접 대조했다.

## 발견사항

- **[WARNING]** `buildTriggerCallbackUrl`의 `@param` JSDoc 태그가 이번 델타의 시그니처 변경(위치
  인자 → 구조분해 객체 인자)을 반영하지 못해 실제로 존재하지 않는 최상위 파라미터를 가리킨다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:45-46` (`@param baseUrl` ·
    `@param endpointPath`), 실제 시그니처는 같은 파일 `:48-54`
    (`export function buildTriggerCallbackUrl({ baseUrl, endpointPath }: { baseUrl: string | undefined; endpointPath: string }): string`).
  - 상세: `92f4b0607`은 인자 스왑 뮤턴트 방지를 위해 시그니처를 `(baseUrl, endpointPath)` 위치 인자에서
    단일 구조분해 객체 인자로 바꿨다(`git show 92f4b0607` 확인). 함수 본문 위 산문 JSDoc("인자를
    이름으로 받는 이유")은 새로 추가돼 정확하지만, 그 바로 아래 `@param baseUrl` / `@param endpointPath`
    태그는 마치 함수가 여전히 두 개의 최상위 위치 인자를 받는 것처럼 서술한다. 지금 함수의 실제 최상위
    파라미터는 객체 1개뿐이라, TSDoc/TypeDoc 관례로는 `@param options.baseUrl` /
    `@param options.endpointPath`(또는 `@param options`) 형태여야 한다. 이 저장소에는 jsdoc lint 룰이
    설정돼 있지 않아(`eslint.config` 확인, jsdoc 플러그인 매치 없음) 빌드/린트를 깨지는 않지만, 이
    파일 자체가 "형태로 순서 문제를 없앤다"는 설계 근거를 문서화하는 자리인 만큼 파라미터 문서도
    같은 정밀도를 유지해야 한다.
  - 제안: `@param baseUrl`/`@param endpointPath`를 `@param params.baseUrl`/`@param params.endpointPath`
    (구조분해 매개변수 이름에 맞춰)로 정정하거나, 단일 객체 파라미터 하나만 `@param params` 로 남기고
    각 필드 설명은 산문으로 옮긴다.

- **[WARNING]** plan 문서의 "결정" 섹션에 남아 있는 코드 스케치가 이번 델타로 실제 구현과 어긋나게
  됐는데도 정정되지 않았다.
  - 위치: `plan/in-progress/impl-chat-channel-binder-t2.md:79`
    (`` buildTriggerCallbackUrl(baseUrl: string | undefined, endpointPath: string): string ``)
    및 `:84`(`` `buildTriggerCallbackUrl(this.configService.get('app.url'), path)` ``).
  - 상세: 이 두 줄은 T2 최초 설계 시점(`a2e5b7e16`)에 위치 인자 시그니처로 작성됐고, 그 시점에는
    실제 코드와 일치했다. 이번 델타(`92f4b0607`)가 실제 시그니처를 named-args 객체로 바꿨지만
    (`trigger-callback-url.ts` diff로 확인), 같은 커밋이 plan 파일의 체크리스트 영역(`:183-198`
    부근)은 갱신했으면서 더 위쪽의 이 설계 스케치 두 줄은 건드리지 않았다 — `git show 92f4b0607 --
    plan/in-progress/impl-chat-channel-binder-t2.md`로 확인. 결과적으로 지금 이 plan 파일을 위에서
    아래로 읽으면 "결정"이라고 적힌 자리의 시그니처와 실제 배포된 시그니처가 다르다. 이 저장소는 같은
    문서 안에서 스스로 반증된 서술에 인라인 정정 각주를 붙이는 관례가 뚜렷한데(같은 파일의 "이 칸을
    나도 한 번 틀렸다" 절 등), 이 자리에는 그 관례가 적용되지 않았다.
  - 제안: RESOLUTION.md의 W1 설명(또는 `92f4b0607` 커밋 본문)을 가리키는 짧은 인라인 각주를
    `:79`/`:84` 옆에 추가해, 이 스케치가 "설계 당시" 형태이고 최종 시그니처는 named-args로 바뀌었음을
    표시한다.

- **[INFO]** (이월, 새 결함 아님) `chat-channel-binder.service.ts:18`의 `plan/complete/impl-chat-channel-binder-t2.md`
  참조는 이번 델타(`92f4b0607`)로도 여전히 미해소다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18`.
  - 상세: 직전 라운드(`18_04_36`)의 documentation/SUMMARY WARNING #4가 이미 정확히 지적했고,
    `RESOLUTION.md`가 "마무리 단계에서 해소 — push 전에 실측 확인한다"로 명시적으로 유예했으며,
    plan 체크리스트에도 `- [ ] 이동 후 ... 실재 확인` 항목이 별도로 걸려 있다(`impl-chat-channel-binder-t2.md:196-198`).
    이번 델타는 이 항목을 건드리지 않았고(`git show 92f4b0607`에 해당 라인 없음), plan은 여전히
    `plan/in-progress/`에 있다(직접 확인) — 즉 현재 시점에 이 JSDoc 참조는 계속 깨진 상태이지만,
    이것은 새로 발견한 결함이 아니라 이미 등재·계획된 마무리 단계 항목의 연장선이다.
  - 제안: 조치 불요(이번 라운드 범위 밖). `plan/complete/` 이동이 실제로 일어나는 마무리 커밋에서
    함께 확인.

## 긍정적으로 확인된 사항

- `trigger-callback-url.ts` JSDoc에 새로 추가된 "인자를 이름으로 받는 이유" 단락은 리뷰어의 지적을
  재현해서 절반만 맞다고 가린 과정(`tsc`가 두 호출부 모두 잡지만 그 방어가 우연히 타입이 다른 데
  기댄다는 것)까지 근거와 함께 정확하게 서술한다 — `92f4b0607` 커밋 본문과 완전히 일치.
- 같은 델타가 `trigger-callback-url.ts:29`의 부정확했던 수치("9개 모듈")를 실제 모듈 수("14블록")로
  정정한 것도 확인했다 — 별도 관심사를 끌어들이지 않고 시그니처 변경과 같은 문단·같은 화제 안에서
  이뤄진 정정이다.
- 신규 `chat-channel-binder.service.spec.ts`(W2 대응)와 `trigger-callback-url.spec.ts`(W1의 진짜 갭
  대응)는 둘 다 파일 헤더 docstring에 "왜 이 파일이 생겼는지"·"왜 특정 범위를 다시 덮지 않는지"를
  근거(리뷰 경로·뮤테이션 실측)와 함께 남겼고, 인용한 리뷰 경로(`review/code/2026/09/11/18_04_36`)는
  실제로 존재해 검증 가능하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`에 새로 추가된 백로그 항목들은 developer/
  planner 소유를 정확히 구분해 표기하고, 각 항목이 이번 라운드에서 실제로 관측·이관된 내용과 대응한다
  — 근거 없는 신규 주장을 끌어들이지 않았다.
- README/CHANGELOG/환경변수 문서: 이번 델타는 순수 내부 리팩터의 테스트 보강 + 시그니처 형태 변경뿐이라
  갱신 필요 없음(직전 라운드 판단과 일치, 새 결론 아님).

## 요약

이번 라운드(`92f4b0607`)는 직전 리뷰가 지적한 두 테스트 갭(콜백 URL 인자 순서 방어, teardown adapter
경로 미검증)을 정확히 겨냥해 닫았고, 그 과정에서 추가된 산문 JSDoc·수치 정정은 정확하다. 다만 시그니처를
위치 인자에서 named-args 객체로 바꾼 같은 커밋이 (1) 함수 바로 위 `@param` 태그를 새 구조분해 형태에
맞춰 갱신하지 않았고, (2) plan 문서의 "결정" 섹션에 남아 있던 옛 시그니처 코드 스케치를 정정하지 않아,
같은 문서 내부에서 시그니처가 두 버전으로 갈리는 소규모 불일치를 새로 만들었다. 둘 다 기능에 영향을
주지 않는 문서 정합성 문제이며 수정 비용이 매우 낮다. 그 외 이미 알려진 `plan/complete/` 조기 참조
문제는 이번 델타가 손대지 않았고 마무리 단계 체크리스트로 이미 관리되고 있어 새 결함으로 세지 않았다.

## 위험도

LOW
