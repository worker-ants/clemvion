# 유지보수성(Maintainability) 리뷰

> 대상 PR: External Interaction API (PR2) — Backend + Frontend/SDK  
> 검토 파일: 11개 (i18n dict, SDK README/package.json/tsconfig, SDK src 4개, plan, consistency summary)

---

## 발견사항

### 파일 1: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`

- **[INFO]** 중첩 객체 도입으로 기존 flat 구조와 불일치
  - 위치: 추가된 `externalInteraction` 블록 전체
  - 상세: 기존 `triggers` 객체의 모든 키는 flat 문자열이다 (`columnActions`, `toggleActivate` 등). 신규 `externalInteraction` 키만 중첩 객체로 추가되어 구조 패턴이 깨진다. i18n 접근 코드(`t('triggers.externalInteraction.section')`)가 나머지 키(`t('triggers.columnActions')`)와 레벨 차이가 생겨 컴포넌트 코드 일관성이 저하된다.
  - 제안: 코드베이스 전체 i18n dict 패턴이 flat인지 nested인지 먼저 확인 후 결정. 기존 패턴이 flat이면 `externalInteractionSection`, `externalInteractionNotification` 등의 prefix 방식으로 통일하거나, 전체 dict를 nested로 리팩터링하는 별도 PR 이후 도입 권장.

- **[INFO]** 혼합 언어 문자열 — 영문 기술 용어가 한국어 설명 내에 그대로 노출
  - 위치: `notificationSecretRotate: "Secret rotation"`, `tokenStrategyPerExecution: "Per Execution (default, 단명 1h)"`, `tokenStrategyPerTrigger: "Per Trigger (영구 itk_*)"`
  - 상세: 일부 값은 순수 영문이고 일부는 한국어, 일부는 혼합이다. 제품 UI 노출 문자열이라면 일관성이 낮다. 특히 `itk_*` 같은 내부 토큰 prefix가 UI 문자열에 직접 노출되는 것은 구현 세부사항 누출에 해당한다.
  - 제안: UI에 토큰 prefix 리터럴 노출은 제거하고, 전략 설명은 사용자 친화적 표현으로 통일할 것. 영문 전용 값은 EN dict와 동일하게 유지하거나, 번역이 의도적이지 않음을 주석으로 표시.

- **[INFO]** 주석의 spec 참조가 파일 내에서 유일하게 등장
  - 위치: `// External Interaction API (Spec EIA §4) — trigger 상세에서 노출되는 신규 섹션.`
  - 상세: i18n dict 파일 내에서 spec 참조 주석을 다는 것은 이 파일이 유일하다. 일관된 컨벤션이 아닌 경우 향후 유지보수자가 어떤 키에 spec 주석을 달아야 하는지 혼란을 줄 수 있다.
  - 제안: 코드베이스 전체에서 i18n dict에 spec 주석을 달지 않는 관행이라면 이 주석도 제거. 달아야 한다면 컨벤션으로 문서화.

---

### 파일 2: `codebase/packages/sdk/README.md`

- **[INFO]** 예시 코드에서 Non-null assertion `!` 남발
  - 위치: 섹션 2 (AI Multi Turn) 코드 예시 — `result.interaction!.token!` 반복 3회
  - 상세: README 예시 코드는 독자가 그대로 복사해 사용하는 경우가 많다. `!` assertion은 런타임 오류를 숨기고, 새 사용자에게 안전하지 않은 패턴을 학습시킨다.
  - 제안: 예시 코드에서 optional chaining + early-exit 패턴으로 대체하거나, 단순화를 위해 `interaction`이 존재하는 시나리오를 전제로 변수에 미리 destructure 후 사용.

- **[INFO]** API 레퍼런스의 경로 표기 불완전
  - 위치: `## API` 섹션 — `cancel`, `refreshToken`, `getStatus`의 경로가 `POST /:id/cancel` 형태로 base path 생략
  - 상세: `triggerWebhook`은 전체 경로(`POST /api/hooks/:endpointPath`)를 표기하는 반면, 나머지는 상대 경로(`:id/cancel`)만 표기한다. 경로 표기 일관성이 없어 사용자가 실제 endpoint를 파악하기 어렵다.
  - 제안: 모든 메서드에 동일한 수준의 경로 표기 (`POST /api/external/executions/:id/cancel` 등) 적용.

---

### 파일 3: `codebase/packages/sdk/package.json`

- **[WARNING]** `ts-jest` 버전과 `jest` 버전 호환성 불일치 가능성
  - 위치: `devDependencies` — `"jest": "^30.0.0"`, `"ts-jest": "^29.2.5"`
  - 상세: `ts-jest` major 버전(29)이 `jest` major 버전(30)보다 낮다. `ts-jest`는 일반적으로 동일 jest major를 타겟으로 릴리스되는데, 29.x가 jest 30을 지원하는지 확인이 필요하다. 빌드 시 silent 오류나 테스트 실패로 이어질 수 있다.
  - 제안: `ts-jest@^30.0.0`으로 맞추거나, `jest@^29.x`로 내려 정합성을 보장. CI 단계에서 버전 확인 필요.

- **[INFO]** `prepare` 스크립트의 shell 조건식이 크로스 플랫폼 미지원
  - 위치: `"prepare": "[ -d dist ] || tsc"`
  - 상세: `[ -d dist ]`는 Unix/macOS 전용이다. Windows 환경(개발자 또는 CI)에서는 동작하지 않는다.
  - 제안: `"prepare": "tsc --noEmitOnError false || true"` 또는 `node -e "..."` 방식으로 크로스 플랫폼 스크립트 사용. 또는 단순히 `"prepare": "tsc"`로 통일.

- **[INFO]** `lint` 스크립트의 glob 패턴이 일부 환경에서 미동작
  - 위치: `"lint": "eslint src/**/*.ts"`
  - 상세: `src/**/*.ts` glob은 shell에서 확장되는데, zsh/bash 설정에 따라 동작이 다를 수 있다. eslint CLI에 그대로 전달되지 않을 수 있다.
  - 제안: `"lint": "eslint 'src/**/*.ts'"` (따옴표 포함) 또는 eslint 설정의 `include` 활용.

---

### 파일 4: `codebase/packages/sdk/src/client.spec.ts`

- **[INFO]** 테스트마다 `ClemvionClient` 인스턴스 + `fetchImpl` mock을 중복 생성
  - 위치: 각 `it` 블록 내 `const fetchImpl = jest.fn()...`, `const client = new ClemvionClient(...)` 반복
  - 상세: 동일한 `new ClemvionClient({ baseUrl: 'https://api.clemvion.ai', fetchImpl: ... })` 패턴이 7회 이상 반복된다. 변경사항(예: baseUrl 변경)이 생기면 모든 테스트를 개별적으로 수정해야 한다.
  - 제안: `beforeEach`에서 공통 설정을 추출하거나, 팩토리 헬퍼(`makeClient(fetchImpl)`)를 작성해 중복 제거.

- **[INFO]** `fetchImpl.mock.calls[0][0]`, `fetchImpl.mock.calls[0][1]` 로의 직접 인덱싱
  - 위치: 다수의 `expect` 구문
  - 상세: `mock.calls[0][0]`처럼 숫자 인덱스로 mock 호출 인수를 접근하면 가독성이 낮고, 호출 순서가 바뀌거나 새 호출이 끼어들면 조용히 잘못된 값을 검사하게 된다.
  - 제안: `expect(fetchImpl).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'POST' }))` 패턴 사용 또는 `const [calledUrl, calledInit] = fetchImpl.mock.calls[0]`로 destructure해 의미 있는 변수명 부여.

- **[INFO]** 인라인 하드코딩 URL `'https://api.clemvion.ai'`가 7회 이상 반복
  - 위치: 전체 spec 파일
  - 상세: 매직 문자열에 해당. baseUrl 변경 시 여러 곳을 수정해야 한다.
  - 제안: 상단에 `const BASE_URL = 'https://api.clemvion.ai'` 상수 정의 후 재사용.

---

### 파일 5: `codebase/packages/sdk/src/client.ts`

- **[WARNING]** `subscribeToExecution` 함수의 책임 과다 (함수 길이 및 복잡도)
  - 위치: `client.ts` lines 1101~1166 (`subscribeToExecution` 메서드)
  - 상세: 약 65줄에 달하며 (1) HTTP 요청 전송, (2) ReadableStream 읽기 루프, (3) SSE 프레임 버퍼링, (4) 이벤트 파싱 호출, (5) 핸들러 호출, (6) 에러 처리를 한 함수 안에서 처리한다. 순환 복잡도가 높고, 스트림 읽기 루프를 테스트에서 격리하기 어렵다. `client.spec.ts`에서 `subscribeToExecution`에 대한 테스트가 없는 이유이기도 하다.
  - 제안: 스트림 읽기 + 프레임 파싱 루프를 별도 `readSseStream(reader, decoder, onFrame)` 내부 함수로 추출. HTTP 연결 수립 부분도 `connectSse(url, signal)` 로 분리하면 단위 테스트 가능 단위가 된다.

- **[WARNING]** `triggerWebhook`과 `parseJsonOrThrow`의 `{ data? }` 언래핑 로직 중복
  - 위치: `triggerWebhook` lines 1019~1021, `parseJsonOrThrow` lines 1187~1188
  - 상세: 두 곳 모두 `parsed.data ?? (parsed as unknown as T)` 패턴을 사용한다. 래퍼 처리 로직이 두 곳에 분산되어 있어 추후 응답 형태가 바뀌면 한 곳만 수정할 위험이 있다.
  - 제안: `unwrapData<T>(parsed: { data?: T }): T` 헬퍼를 추출해 단일 지점으로 통일.

- **[INFO]** `subscribeToExecution`의 토큰을 query string에 노출
  - 위치: lines 1112~1114 — `?token=${encodeURIComponent(token)}&lastEventId=...`
  - 상세: 유지보수성 관점에서 토큰이 query string으로 전달되면 서버 로그, 프록시 로그, 브라우저 히스토리에 그대로 기록될 수 있다는 점이 코드 주석이나 JSDoc에 명시되지 않았다. 향후 `Authorization` 헤더 방식으로 변경 시 하나의 지점만 수정하면 되도록 URL 구성 로직을 별도 메서드로 분리하면 좋다.
  - 제안: `buildStreamUrl(executionId, token, lastEventId?)` 프라이빗 메서드로 추출하고, 보안 트레이드오프를 JSDoc에 명시.

- **[INFO]** `// eslint-disable-next-line no-constant-condition`으로 lint 억제
  - 위치: line 1133
  - 상세: `while (true)` 루프를 lint 억제로 해결하는 것보다 명시적 종료 조건으로 개선이 가능하다. 현재 `done` 플래그로 break하므로 `while (!done)` 패턴이 더 직관적이고 lint 억제가 필요 없다.
  - 제안: `let done = false; while (!done) { const chunk = await reader.read(); done = chunk.done; ... }` 패턴으로 변경.

- **[INFO]** `parseSseFrame` 내 `data += line.slice(5).trim()` — multi-line data 처리 이슈
  - 위치: line 1203 — `else if (line.startsWith('data:')) data += line.slice(5).trim();`
  - 상세: SSE spec(RFC 8895)에서 `data:` 라인이 여러 개이면 `\n`으로 연결해야 한다. 현재는 단순 concatenation(`+=`)이어서 `data: first\ndata: second`가 `firstsecond`로 합쳐진다. 기능 버그이기도 하지만, 이 파서가 single-line JSON만 처리한다는 가정이 코드 어딘에도 문서화되어 있지 않아 유지보수 시 혼란을 줄 수 있다.
  - 제안: `data += (data ? '\n' : '') + line.slice(5).trim()` 또는 RFC 준수 파싱으로 수정하고, 단일 라인 JSON 가정 시 주석으로 명시.

- **[INFO]** `ClemvionApiError`의 선언 위치
  - 위치: `client.ts` 맨 끝 (lines 1226~1235)
  - 상세: `ClemvionApiError`는 `ClemvionClient` 내부뿐 아니라 외부 사용자도 `instanceof` 체크로 사용하는 public 타입이다. 파일 맨 끝에 선언되어 있어 파일을 처음 읽는 사람이 이 클래스의 위치를 파악하기 어렵다. 관례상 공개 에러 타입은 파일 상단 또는 별도 파일에 배치한다.
  - 제안: `ClemvionApiError`를 파일 상단 인터페이스 선언 블록 근처로 이동하거나, `errors.ts`로 분리.

---

### 파일 6: `codebase/packages/sdk/src/index.ts`

- **[INFO]** `SseEvent` 타입이 `client.ts`에 선언되어 있으나 `index.ts`에서 re-export 미포함
  - 위치: `index.ts` exports 목록
  - 상세: `SseEvent`와 `SseEventHandler` 중 `SseEventHandler`는 export되지만 `SseEvent`는 export되지 않는다. 사용자가 `onEvent: (e: SseEvent) => void` 타입을 명시적으로 쓰려면 내부 경로를 직접 import해야 한다.
  - 제안: `SseEvent` 타입도 `export type`에 추가.

---

### 파일 7: `codebase/packages/sdk/src/signature.spec.ts`

- **[INFO]** 테스트 상수 `TS = 1_700_000_000`이 매직 넘버에 해당
  - 위치: line 1341
  - 상세: 값 자체는 의미 있는 Unix timestamp이지만 코드에서 의미가 불명확하다.
  - 제안: `const FIXED_TIMESTAMP_SEC = 1_700_000_000; // 2023-11-14 UTC, 테스트용 고정 시각` 형태로 명칭과 주석 추가.

- **[INFO]** `nowSec: TS + 1000`이 왜 window 초과인지 불명확
  - 위치: "timestamp window 초과" 테스트 케이스
  - 상세: 기본 tolerance가 `5 * 60 = 300초`인데 `+1000`은 1000초 차이로 초과됨을 확인하는 것이다. 이 숫자가 tolerance보다 크다는 것이 주석 없이는 즉시 파악되지 않는다.
  - 제안: `nowSec: TS + 600` (tolerance 300의 2배)처럼 관계를 명확히 하는 값 사용 또는 주석 추가.

---

### 파일 8: `codebase/packages/sdk/src/signature.ts`

- **[INFO]** `verifyNotificationSignature` 함수 길이 (46줄) 및 복잡도
  - 위치: 전체 함수 body
  - 상세: early-return 패턴을 잘 활용하고 있어 읽기 어렵진 않으나, 파싱(header split) + 검증(timestamp window) + 서명 비교 세 책임이 한 함수에 있다. 순환 복잡도 약 8~9 수준.
  - 제안: `parseSignatureHeader(header)` 파싱 단계를 별도 순수 함수로 추출하면 테스트 커버리지 개선과 가독성 향상을 동시에 달성할 수 있다.

- **[INFO]** `5 * 60` 매직 넘버
  - 위치: line 1559 — `const tolerance = opts.toleranceSec ?? 5 * 60;`
  - 상세: `5 * 60`은 의도가 명확한 편이지만, 상수로 추출하면 더 유지보수하기 좋다.
  - 제안: 파일 상단에 `const DEFAULT_TOLERANCE_SEC = 5 * 60; // ±5분 window` 상수 선언.

---

### 파일 9: `codebase/packages/sdk/tsconfig.json`

- **[INFO]** `"lib": ["ES2020", "DOM"]` — DOM lib 포함이 Node.js SDK에 과도
  - 위치: `compilerOptions.lib`
  - 상세: 패키지가 주로 Node.js용(crypto, `randomUUID`, `createHmac` 등 Node API 사용)이나 `DOM` lib를 포함한다. `Response`, `fetch`, `ReadableStream` 등 Web API 타입이 필요해 추가한 것으로 보이나, `DOM` 전체를 포함하면 Node.js 전용 패키지에 브라우저 전용 타입이 섞여 타입 혼란을 줄 수 있다.
  - 제안: `@types/node` + `lib: ["ES2020"]`으로 유지하고, fetch/Response 등은 `fetchImpl: typeof fetch` 같은 사용자 주입 패턴 유지. 또는 `"lib": ["ES2020", "DOM"]`이 의도적임을 tsconfig 주석(또는 README)에 명시.

---

### 파일 10: `plan/complete/external-interaction-api.md`

- **[INFO]** plan 파일이 `complete/`에 있으나 내용상 PR2가 아직 "머지 대기" 상태
  - 위치: frontmatter 및 `> PR2 (Backend + Frontend/SDK + E2E 통합) — 완료 / 머지 대기.`
  - 상세: `plan/complete/`는 완료된 작업용 디렉터리이지만 파일 내 PR2는 "머지 대기" 상태이다. lifecycle 정책상 완료 이전에 `complete/`로 이동된 것이 맞는지 확인 필요. 유지보수 관점에서 plan 파일이 실제 상태와 일치하지 않으면 추적에 혼란을 준다.
  - 제안: PR2 머지 완료 후 `complete/`로 이동하는 것이 policy에 맞다면, 현재 시점에는 `in-progress/`에 두고 PR2 머지 시 이동하는 것이 일관성 있다.

- **[INFO]** 섹션 2~5의 체크박스가 모두 `[x]`이나 일부 항목은 "⏳ 진행 예정"으로 표기
  - 위치: `### 2. Backend 구현 — ⏳ 진행 예정`, `### 3. Frontend / Public SDK — ⏳ 진행 예정` 헤더와 하위 `[x]` 체크박스
  - 상세: 섹션 헤더는 "진행 예정"이지만 하위 체크박스는 모두 완료(`[x]`) 표시다. 완료 상태 표기와 헤더 레이블이 모순되어 현재 진행 상태를 파악하기 어렵다.
  - 제안: 체크박스 완료 시 헤더도 `✅ 완료`로 업데이트하거나, 헤더를 완료 상태 반영 기준으로 자동 관리하는 컨벤션을 plan lifecycle에 정의.

---

### 파일 11: `review/consistency/2026/05/21/00_08_35-impl-prep/SUMMARY.md`

- **[INFO]** 유지보수성 관점에서 직접 검토 범위 외 (산출물 문서)
  - 상세: consistency check 산출물이므로 코드 유지보수성 분석 대상이 아니다. 내용 자체는 잘 구조화되어 있고, Critical/Warning/Info 구분 + 해소 방법 명시가 명확하다.

---

## 요약

전반적으로 SDK 코어 코드(`client.ts`, `signature.ts`)는 설계 의도가 명확하고 타입 정의가 체계적이다. 그러나 `subscribeToExecution` 메서드의 복잡도가 높고 테스트가 누락된 점, `triggerWebhook`과 `parseJsonOrThrow`에서 래퍼 언래핑 로직이 중복된 점이 주요 유지보수성 위험이다. i18n dict의 flat/nested 구조 불일치는 프론트엔드 전체에 영향을 줄 수 있는 패턴 비일관성이고, `package.json`의 `ts-jest`/`jest` 버전 불일치는 빌드 환경 불안정 요인이다. 기능 동작에는 큰 문제가 없으나 중장기 유지보수 시 리팩터링 비용이 누적될 수 있는 구조적 개선 포인트들이 다수 존재한다.

---

## 위험도

**LOW**

STATUS=success
