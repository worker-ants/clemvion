# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** trailing-slash 정규화 로직(`replace(/\/$/, "")`)이 3개 파일에 독립 구현되어 있음 — DRY 위반
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:37-39`(`normalizeApiBase`, 이번 diff 신규), `codebase/channel-web-chat/src/widget/use-widget.ts`(`fetchEmbedConfig` 내부 `const base = apiBase.replace(/\/$/, "")`), `codebase/channel-web-chat/src/lib/eia-client.ts:21`(`joinUrl`)
  - 상세: 이번 diff 가 추가한 `normalizeApiBase` 는 정확히 동일한 표현식 `apiBase.replace(/\/$/, "")` 를 재구현한다. 그 JSDoc 자체가 "기존 코드도 `apiBase.replace(/\/$/, "")` 로 정규화한다"고 명시적으로 인지하면서도 공용 유틸로 추출하지 않고 세 번째 독립 구현을 추가했다. 세 곳이 서로 다른 파일에서 각자 유지되므로, 정규화 규칙이 바뀌면(예: 다중 trailing slash·대소문자·공백 처리 등) 한 곳만 고치고 나머지를 놓치는 drift 위험이 있다. 실제로 `session-store.ts` 의 `normalizeApiBase` 는 "경로는 보존"(origin 만이 아니라 path 도 비교)이라는 미묘한 의미를 갖는데, 이 차이가 다른 두 곳과 공유되지 않아 향후 누군가 세 곳 중 하나만 보고 동일 동작이라 오인할 수 있다.
  - 제안: 공용 모듈(예: `lib/url-utils.ts`)에 `normalizeApiBase`/`stripTrailingSlash` 를 두고 세 호출부(`session-store.ts`, `use-widget.ts`, `eia-client.ts`)가 이를 import 해 공유하도록 리팩터링.

- **[WARNING]** 테스트 fixture 리터럴 중복 — 공용 헬퍼 부재로 15곳 이상을 손으로 반복 수정
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (파일 전반에 인라인 반복 — diff 상 게이트 252, 295, 734, 1633, 1713, 2068, 2210, 2245 등 다수 `it` 블록)
  - 상세: 이 파일은 `JSON.stringify({ executionId, token, expiresAt, ..., endpoints })` 형태의 세션 fixture 리터럴을 파일 내 19곳에서 인라인으로 반복한다(`grep -c` 확인). 이번 diff 는 그중 15곳에 `apiBase: SESSION_API_BASE` 필드 하나를 추가하기 위해 각 위치를 개별적으로 수정해야 했다 — 공용 빌더 함수가 있었다면 한 줄만 고치면 됐을 변경이다. 같은 저장소의 `session-store.test.ts`(`function session(overrides)`)와 `use-token-refresh.test.ts`(`function session(over)`)는 이미 이 패턴을 헬퍼로 추출해 두었는데, `use-widget-eager-start.test.ts` 만 인라인 리터럴을 고수해 향후 필드 추가/이름 변경 시 같은 반복 편집(과 누락 위험)이 재발할 것이다. 이번 diff 자체가 그 비용을 실증한 사례다.
  - 제안: 다른 두 테스트 파일과 동일하게 `sessionFixtureJson(overrides)` 류 헬퍼를 도입해 인라인 `JSON.stringify({...})` 리터럴을 대체.

- **[INFO]** `loadSession` 의 `expectedApiBase` 를 optional 이 아닌 필수 인자로 설계 — 긍정적 API 설계
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:70-73`(`loadSession` 시그니처)
  - 상세: JSDoc 이 "optional 이면 호출부가 조용히 검사를 건너뛸 수 있고, 그게 바로 이 함수가 막으려는 결함"이라고 설계 의도를 명시했다. 신규 필수 파라미터를 기존 optional 파라미터(`storage`) **앞**에 삽입하면서도 "optional 은 항상 마지막" 컨벤션을 유지했다. 결함이 아니라 유지보수 관점에서 안전한 설계로 기록.

- **[INFO]** 위협 모델과 "왜 안 되는지"를 코드 근접 주석으로 남긴 문서화 품질
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts`(`PersistedSession.apiBase` JSDoc, `normalizeApiBase` JSDoc), `codebase/channel-web-chat/src/widget/use-widget.ts`(diff 내 `apiBase: cfg.apiBase` 주석, `loadSession` 호출부 주석)
  - 상세: 재전송 시 옛 origin 토큰 유출이라는 구체적 위협과, "미기록 세션도 폐기"라는 fail-safe 선택의 비용/편익을 각 지점에 남겨 향후 유지보수자가 이 필드를 optional 로 되돌리거나 검사를 완화하려는 시도를 사전에 막는다. 가독성·의도 명확성 측면에서 모범 사례.

- **[INFO]** 나머지 관점(함수 길이·중첩 깊이·매직 넘버·네이밍·순환 복잡도) 은 이번 diff 범위 내에서 특이사항 없음
  - `loadSession`/`normalizeApiBase`/`session()` 헬퍼 모두 단일 책임, 얕은 중첩(if 1단), 명확한 네이밍(`expectedApiBase`, `SESSION_API_BASE`, `normalizeApiBase`)을 유지한다. 기존 코드베이스의 세대(worldGen/bootGen) 관리 패턴·주석 컨벤션과도 일관됨.

## 요약

이번 변경은 세션 발급 origin 바인딩이라는 보안 성격의 기능을 명확한 네이밍·풍부한 근거 주석·안전 지향 API 설계(필수 인자화)로 잘 구현했다. 다만 (1) trailing-slash 정규화 로직이 3개 파일에 중복 구현되어 향후 규칙 변경 시 drift 위험이 있고, (2) `use-widget-eager-start.test.ts` 의 인라인 fixture 리터럴 중복이 이번 diff 에서 15곳 반복 수정을 요구했다는 점에서 공용 헬퍼 부재의 비용이 실제로 드러났다. 두 사항 모두 기능 결함은 아니며 리팩터링으로 개선 가능한 유지보수성 부채다.

## 위험도

LOW
