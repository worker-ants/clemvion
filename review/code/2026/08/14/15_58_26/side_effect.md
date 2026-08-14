### 발견사항

- **[INFO]** 모듈 전용(private) 배열 상수가 공개(export) 전역 배열로 승격됐다 — 런타임 불변 보장 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:70` (`export const EXTERNAL_STRIPPED_FIELDS = ['llmCalls'] as const;`)
  - 상세: 종전 `websocket.service.ts` 안의 `EXTERNAL_STRIPPED_FIELDS` 는 파일 스코프 `const` 로 export 되지 않았다. 이번 diff 로 공유 유틸(`shared/utils/strip-external-only-fields.ts`)로 승격되며 `export` 가 붙어, 이제 다른 모듈이 이 배열에 대한 참조를 얻을 수 있는 표면이 생겼다. `as const` 는 TS 컴파일 타임에만 `readonly` 를 강제하고 런타임 `Object.freeze` 는 없어서, 타입 단언(`as string[]`)을 거친 `.push()`/`.length = 0` 등으로 이 **싱글턴 배열**이 변형되면 `websocket.service.ts`(SSE·webhook·chat-channel fanout) 와 `interaction.service.ts`(REST `getStatus`) 세 출구 전부가 프로세스 수명 동안 동시에 영향을 받는다. 다만 이 저장소의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 등 인접 상수들도 같은 패턴(freeze 없는 `ReadonlyArray`/`as const`)을 쓰고 있어 이례적인 편차는 아니다.
  - 제안: 실질 위험은 낮지만, export 표면이 넓어진 시점에 `Object.freeze(EXTERNAL_STRIPPED_FIELDS)` 를 붙여 두면 "타입 단언으로 우회한 변형"이라는 사고 클래스를 코드베이스 관례상 처음으로 완전히 닫을 수 있다. 강제 아님 — 기존 관례에 맞춰 그대로 둬도 무방.

- **[INFO]** `stripExternalOnlyFields` 시그니처 변경(1-인자 → 2-인자) — 감사 결과 stale 호출자 없음, 확인 완료
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:80` (`export function stripExternalOnlyFields<T>(value: T, maxDepth: number): T`) — 호출부 `codebase/backend/src/modules/websocket/websocket.service.ts:450`·`524`, `codebase/backend/src/modules/external-interaction/interaction.service.ts:106`
  - 상세: 종전 `stripExternalOnlyFields(envelope)` 는 `websocket.service.ts` 내부 비공개 함수였다(외부 호출자 없음). 이번 diff 로 공유 모듈의 공개 함수가 되며 시그니처가 `(value, maxDepth)` 2-인자 필수로 바뀌었다. `grep -rn "stripExternalOnlyFields(" codebase/backend/src` 로 프로덕션·테스트 코드 전수를 확인한 결과, 남은 1-인자 호출부는 없다 — 세 프로덕션 호출부(`websocket.service.ts` 2곳, `interaction.service.ts` 1곳)와 두 spec 파일 전부 `maxDepth` 를 명시 전달한다. `maxDepth` 가 옵셔널이 아니라 필수 인자라 향후 호출자가 깜빡해도 TS 컴파일이 막는다(런타임 fallback 값이 없어 "조용히 상한 없이 실행"되는 회귀 경로가 구조적으로 차단됨).
  - 제안: 조치 불필요 — 확인만.

- **[INFO]** `getStatus` REST 응답의 필드 구성이 의도적으로 변경됨(외부 API 응답 shape 변경) — CHANGELOG·spec 에 명시적으로 문서화됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:379`(`nodeOutput`), `:441`·`:445`(`result`/`error`)
  - 상세: `GET /api/external/executions/:id` 응답의 `nodeOutput`/`result`/`error` 에서 `deepRedactSecrets` 단독(값 마스킹) → `stripAndRedact`(필드 제거 + 값 마스킹)로 바뀌어, 이전에는 마스킹된 값과 함께 나가던 `llmCalls` **필드 자체**가 이제 응답에서 완전히 사라진다. 이는 이 PR 의 목적(보안 결함 수정)이므로 의도된 변경이지만, "부작용" 관점에서는 외부에 노출되는 공개 REST 응답의 필드 구성이 달라지는 **인터페이스 변경**이다. CHANGELOG.md(`## Unreleased — (보안) llmCalls raw 프롬프트가...`)와 `spec/5-system/14-external-interaction-api.md`(§6.2, R17 절)에 이미 동기화돼 문서화됐고, 이미 전송된 과거 데이터에 대한 운영 판단이 필요하다는 점도 CHANGELOG 에 별도 명시돼 있다.
  - 제안: 조치 불필요 — 문서화 이미 완료. 참고로만 기록.

- **[INFO]** 입력 비변형(non-mutation) 계약 확인 — `stripDeep`/`stripAndRedact`/`attachRoutingContext` 전부 원본을 건드리지 않음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84-125`(`stripDeep`), `codebase/backend/src/modules/external-interaction/interaction.service.ts:98-107`(`stripAndRedact`), `codebase/backend/src/modules/websocket/websocket.service.ts:546-560`(`attachRoutingContext`, 이번 diff 로 변경되지 않음)
  - 상세: `stripDeep` 은 배열은 `value.slice()`, 객체는 `{...obj}` 스프레드로 clone-on-write 하며 원본 `obj`/`value[i]` 를 직접 대입(mutate)하지 않는다 — `websocket.service.spec.ts` 의 "제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다" 테스트와 "입력을 변형하지 않는다" 테스트(`strip-external-only-fields.spec.ts:23-28`)가 이를 실증한다. `attachRoutingContext` 도 기존과 동일하게 non-mutating(spread 후 새 객체 반환, 무변경 시 동일 참조 반환)이라 이번 diff 로 인한 wire↔fanout 간 교차 오염 위험은 발생하지 않는다. 내부 WS 채널로 이미 broadcast 된 `wireEnvelope` 과 fanout 경로에서 파생된 `externalPayload`/`fanoutEnvelope` 이 동일 참조를 공유하는 no-op 경로(참조 identity 반환)는 이번 diff 이전부터 있던 최적화이며, 이번 변경으로 새로 생긴 mutation 위험은 없다.
  - 제안: 조치 불필요 — 확인만.

- **[INFO]** `__proto__` 오염 방지 — 스프레드(own-property 승격) + `Object.defineProperty` 이중 방어, 회귀 테스트로 고정됨
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:100-122`
  - 상세: `stripDeep` 내부에서 값을 대입할 때 bracket 대입(`out[k] = v`) 대신 `Object.defineProperty(out, k, {...})` 를 쓴다 — `JSON.parse` 로 만들어진 own `__proto__` 키를 만나도 프로토타입 체인을 갈아치우지 않는다. 이는 이 diff 이전 라운드(`5df89cda6`)에서 발견·수정된 CWE-1321(prototype pollution) 회귀를 재확인한 것으로, `strip-external-only-fields.spec.ts:72-98`·`websocket.service.spec.ts` 의 대응 테스트가 뮤테이션 검증(bracket 대입으로 되돌리면 RED)까지 거쳤다. 이번 diff 는 이 방어를 유지·재사용할 뿐 새로 약화시키지 않았다.
  - 제안: 조치 불필요 — 확인만.

- **[INFO]** 파일시스템·환경변수·네트워크 부작용 없음
  - 상세: 이번 diff 의 실질 런타임 코드 변경은 `interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`(+각 `.spec.ts`) 뿐이며, 전부 in-memory 값 변환(순수 함수형 strip/redact)이다. 새 파일 I/O, `process.env` 읽기/쓰기, 외부 HTTP 호출은 도입되지 않았다. 나머지 diff(CHANGELOG.md, `plan/**`, `spec/**`, `review/**`)는 문서·리뷰 산출물이며 애플리케이션 런타임 부작용과 무관하다.
  - 제안: 해당 없음.

### 요약
이번 diff 의 핵심은 `stripExternalOnlyFields` 를 depth-1 shallow delete 에서 depth 무관 재귀 strip 으로 바꾸고 이를 공유 유틸(`shared/utils/strip-external-only-fields.ts`)로 승격해 WS fanout(SSE·webhook·chat-channel)과 REST `getStatus` 세 출구가 동일 로직을 공유하도록 한 보안 수정이다. 시그니처 변경(1-인자→2-인자)은 전수 grep 으로 stale 호출자가 없음을 확인했고, 입력 비변형(copy-on-write)·`__proto__` 오염 방지가 대조군 테스트로 고정돼 있으며, `attachRoutingContext` 등 인접 함수의 mutate 여부도 재확인해 교차 오염 경로가 없음을 검증했다. `EXTERNAL_STRIPPED_FIELDS` 가 private→public export 로 승격되며 이론상 전역 배열 변형 표면이 넓어졌으나 실질 위험은 낮고 기존 코드베이스 관례(freeze 없는 readonly 배열)와 일치한다. REST 응답 필드 구성 변경(`llmCalls` 필드 완전 제거)은 CHANGELOG·spec 에 명시적으로 문서화된 의도된 인터페이스 변경이다. 파일시스템·환경변수·네트워크 부작용은 발견되지 않았다. CRITICAL/WARNING 급 부작용은 없다.

### 위험도
LOW
