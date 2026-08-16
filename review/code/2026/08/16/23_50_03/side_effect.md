# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[CRITICAL]** `GET /executions/:id` 응답의 `inputData`가 새로 마스킹되면서, 그 값을 "표시"가 아니라 **새 실행의 입력으로 재사용하는 기존 프런트엔드 소비자**(Re-run 모달·에디터 "Run with input → 히스토리에서 불러오기")가 마스킹된 `***` 를 실제 재실행 요청 바디에 그대로 담아 보낸다 — 이번 diff 의 범위 밖(변경 파일 목록에 `codebase/frontend/**` 가 전혀 없음)에서 발생하는, 이 diff 가 유발하는 진짜 기능적 회귀다.
  - 위치(백엔드, 마스킹을 새로 건 자리): `codebase/backend/src/modules/executions/executions.service.ts:994-995`(`toExecutionDto` 목록 경로), `:1058-1059`(`toResponseExecution` — `findById`/`getChain`/`stop` 공용, `GET /executions/:id` 가 바로 이 경로), `:684`·`:688`(`findById` 의 `nodeExecutions[]` map, `maskIfPresent(ne.inputData, redactStoredDataForResponse)`). (grep -n 으로 현재 파일에서 직접 확인한 실제 줄 번호 — 이 파일의 diff 는 프롬프트 크기 제한으로 생략돼 게이트가 없음)
  - 위치(프런트, 마스킹된 값을 재실행 입력으로 재사용하는 자리 — 이번 diff 밖, `Read` 로 직접 확인):
    - `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx:471` — `execution.inputData`(=`GET /executions/:id` 응답, 이제 마스킹됨)를 그대로 `ReRunModal`의 `original.inputData` 로 전달.
    - `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx:466-471` — 에디터 쪽 진입점도 동일하게 `detail?.inputData` 를 전달.
    - `codebase/frontend/src/components/executions/rerun-modal.tsx:177-180` — `originalParameters = extractParameters(original.inputData)` 를 폼 초기값(`paramValues`)으로 사용. `useOriginalInput` 초기값은 `useState(false)`(`:181`) — 즉 모달을 열고 아무것도 건드리지 않은 **기본 상태**가 "원본 그대로" 가 아니라 "편집 모드"다.
    - `codebase/frontend/src/components/executions/rerun-modal.tsx:279-286`(`handleSubmit`) — `useOriginalInput` 이 `false`(기본값)이면 `inputOverride: paramValues` 를 그대로 전송한다. 즉 사용자가 폼을 안 건드리고 "Re-run" 을 누르면 **마스킹된 값이 새 실행의 실제 입력으로 제출**된다.
    - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:127-134`(`handleLoadFromHistory`) — "히스토리에서 불러오기" 로 과거 실행 상세(`executionsApi.getById`, 같은 마스킹 경로)의 `inputData` 를 JSON textarea 에 그대로 적재해 "이 데이터로 실행"에 쓴다. 마찬가지로 텍스트를 고치지 않으면 `***` 가 그대로 제출된다.
  - 대조: 백엔드 `useOriginalInput=true` 경로(`executions.service.ts:470-473`)는 DB 에서 재조회한 **원문** `original.inputData`(엔티티, 마스킹 관문 밖)를 쓰므로 안전하다. 위험은 정확히 프런트 **기본 상태**(체크박스 미체크)로 좁혀진다.
  - 상세: `error` 컬럼은 재실행 입력으로 재사용되지 않으므로 `#1177`/`#1179` 때는 이 계열의 위험이 없었다. 이번 diff 가 마스킹 대상을 `inputData`/`outputData` 로 **넓힌 것 자체가** 이 위험을 새로 만든다 — 두 컬럼은 그 정의상(Manual Trigger parameters·HTTP 노드 결과 등) 다른 실행에 그대로 재사용될 목적으로 API 가 노출해 온 필드다. 워크플로가 Manual Trigger 파라미터로 API 키·비밀번호류 값을 정당하게 받는 경우(이 저장소가 자동화 도구라는 성격상 드물지 않다), 이 값이 `SECRET_LEAK_PATTERNS`(값-패턴, 키 이름과 무관 — `Bearer …`·`password=…`·URI 자격증명 등)에 걸리면 `***` 로 치환된다. 사용자가 Re-run 모달을 열고 별다른 변경 없이(또는 마스킹된 걸 알아채지 못하고) 제출하면, 새 실행은 실제 값이 아니라 리터럴 문자열 `"***"` 를 다운스트림(예: HTTP 노드가 실제 제3자 API 로 보내는 인증 헤더/폼필드)으로 보낸다 — 조용한 기능 회귀이며 자동화 실패 또는 잘못된 값의 외부 전송으로 이어질 수 있다.
  - 검증: 이 회귀를 잡을 테스트가 없다. `rerun-modal.test.tsx:236`(`"기본(default) 입력 편집 모드에서 inputOverride 를 함께 전송한다"`)은 `original.inputData`를 테스트 fixture(`{ parameters: { name: "Alice", count: 3 } }`, `renderModal` 함수 내 하드코딩, `:85`)로 직접 주입해 실제 백엔드 마스킹 경로를 전혀 거치지 않는다. 이 PR 이 표방하는 "표면을 전수 열거해 자매 하나를 빠뜨리지 않는다" 는 방법론이, 정작 "읽어서 다시 실행에 먹이는" 이라는 소비 형태는 스코프에 넣지 않았다.
  - 제안: (a) `useOriginalInput` 의 프런트 기본값을 `true` 로 바꾸거나(백엔드 기본값과 대칭), (b) `inputOverride` 로 제출하기 전에 폼 값에 마스크 마커(`***`/`[REDACTED]`)가 남아 있으면 제출을 막고 경고하거나, (c) 애초에 이 프리필 용도로는 마스킹되지 않은 별도 API(원본 소유자 전용, 재실행 목적임을 인가 레이어가 알 수 있는 경로)를 쓰도록 분리한다. 최소한 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 에 이 잔여 갭을 등재해 이연 여부를 명시적으로 결정해야 한다.

- **[WARNING]** 같은 구조의 위험이 WS 대기(waiting) 노드의 "버튼 재개" 경로에도 존재할 수 있다 — 확신도는 위 CRITICAL 보다 낮다(버튼 값이 자격증명 패턴에 걸릴 가능성이 상대적으로 낮음).
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`(`maskWireEnvelope`, private 메서드 — node 이벤트 전체를 값-패턴 마스킹) → `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1167`(`parseButtonConfig(buttonConfig)`) → `codebase/frontend/src/lib/stores/execution-store.ts:826`(`resumeFromButtons`) 로 이어지는 경로. `buttonConfig` 는 이제 `maskWireEnvelope` 를 지난 WS `node.*` 페이로드에서 파생되므로, 워크플로 설계자가 버튼 값(또는 라벨)에 자격증명 패턴과 우연히 일치하는 문자열(예: 토큰이 섞인 커스텀 payload)을 넣으면 마스킹된 값이 재개 응답으로 백엔드에 되먹임될 수 있다.
  - 상세: 이번 diff 는 `emitNodeEvent` 의 wire 마스킹을 신설하며 "node 이벤트는 현재 llmCalls 를 포함하지 않으나 미래 누출 경로를 차단"한다는 방어심층화 근거만 남겼고, 대기-재개(waiting/resume) 상호작용에서 페이로드 값이 그대로 왕복(round-trip)되는 소비 형태는 논의되지 않았다.
  - 제안: 위 CRITICAL 항목과 같은 근본 원인(마스킹된 API/WS 응답을 "표시" 가 아니라 "재입력" 으로 재사용하는 기존 소비자 존재 여부)을 기준으로 대기-재개 경로 전체를 한 번 훑어 확인할 가치가 있다. 확실치 않으므로 CRITICAL 이 아니라 WARNING 으로 남긴다.

- **[INFO]** (참고, 이미 문서화됨) `emitExecutionEvent`/`emitNodeEvent` 의 wire·fanout envelope 바이트가 이번 diff 로 실제로 바뀐다 — `websocket.service.ts` 의 `maskWireEnvelope`/`toFanoutEnvelope` 신설이 두 emit 경로가 공유하는 `executionEventSubject.next` 발행 직전 초크포인트를 바꾼다(이벤트 발생 자체·구독자 수·라우팅 로직은 불변, **페이로드 내용**만 변경). `CHANGELOG.md`(파일 1, `:31-34`)가 "⚠️ wire 변화" 로 이미 명시했고 캐너리 테스트(`websocket.service.spec.ts` 신규 describe, 파일 8)로 고정돼 있어 조용한 변경은 아니다. 다만 그 문서가 "표시" 관점의 캐비엇만 다루고 위 CRITICAL 이 지목한 "재입력으로 재사용" 관점은 다루지 않는다.

## 확인했으나 문제 없음 (side-effect 관점)

- `DEEP_REDACT_CACHE`(모듈 레벨 `WeakMap`, `sanitize-error-message.ts`)는 `deepRedactSecrets` depth-0 전용이고 `deepRedactSecretsPreserving`(신규)은 이 캐시를 전혀 읽지도 쓰지도 않는다 — "캐시를 공유하지 않는다" 테스트(파일 12, `sanitize-error-message.spec.ts` 신규)가 두 모드를 같은 객체에 교차 호출해 오염 부재를 확인한다. 리팩터 전/후 캐시 히트 조건(`depth===0 && typeof===object`)도 동일해 회귀 없음.
- `redactStoredErrorForResponse`/`redactStoredDataForResponse`/`deepRedactSecrets`/`deepRedactSecretsPreserving` 전부 입력을 변이하지 않고 copy-on-change 로 새 객체(또는 무변화 시 같은 참조)를 반환한다 — TypeORM 엔티티 원본을 직접 건드리지 않으므로 "마스킹된 값이 실수로 DB 에 저장(dirty-check 오염)" 류의 부작용은 없다. `toResponseExecution`/`toExecutionDto`/`maskIfPresent` 모두 spread 로 새 응답 객체를 조립한다.
- 신규 함수 시그니처(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`, `maskWireEnvelope`, `toFanoutEnvelope`, `maskIfPresent`)는 전부 새 export/private 메서드이고 기존 함수 시그니처를 변경하지 않는다. `ResponseExecution`/`ResponseNodeExecution` 타입은 필드가 넓어졌을 뿐(`inputData`/`outputData` 를 `| null` 로) 기존 필드를 제거하거나 타입을 좁히지 않아, 이 타입을 소비하는 diff 밖 백엔드 코드에 대한 컴파일 파괴 위험은 낮다(RESOLUTION.md 가 `nest build` 로 교차 확인했다고 기록).
- 환경 변수 읽기/쓰기, 신규 전역 변수(모듈 레벨 `const`/`Set`/`WeakMap` 는 모두 불변 설정값이거나 기존 캐시 패턴의 연장), 신규 네트워크 호출은 발견되지 않았다.

## 요약

이번 diff 의 핵심 부작용은 문서화된 "wire 바이트 변화"가 아니라, **그 변화가 diff 범위 밖의 기존 소비자에 미치는 실측 가능한 파급**이다. `GET /executions/:id`(및 WS `execution.snapshot`)의 `inputData`를 "표시" 목적이 아니라 **재실행 입력으로 재사용**하는 두 기존 UI 진입점(Re-run 모달·에디터 "히스토리에서 불러오기")이, 이 PR 이 도입한 값-패턴 마스킹으로 인해 기본 상태(`useOriginalInput` 미체크)에서 마스킹된 `***` 를 실제 재실행 요청에 그대로 담아 보낼 수 있다 — 이는 표시상의 차이가 아니라 자동화가 실제로 다른 데이터를 가지고 재실행되는 기능적 회귀다. 이 PR 자체의 방법론("자매 표면을 전수 열거")은 REST/WS *읽기* 표면에는 철저히 적용됐지만, 그 읽은 값을 다시 쓰기(재실행 입력)로 되먹이는 소비자까지는 스코프가 닿지 않았다. 그 외 캐시 공유·엔티티 변이·시그니처 파괴·환경 변수·신규 네트워크 호출 등 통상적인 부작용 축에서는 문제를 찾지 못했다.

## 위험도

CRITICAL
