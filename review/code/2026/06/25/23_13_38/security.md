### 발견사항

- **[WARNING]** `toTemplate`에서 `output.rendered` 또는 `output.content`를 그대로 반환 — HTML 삽입 위험
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toTemplate` 함수 (라인 793~798)
  - 상세: `rendered` 값이 `outputFormat: "html"`일 때 위젯 렌더러가 이를 innerHTML 등으로 직접 삽입한다면 XSS 가능. `content` 키 fallback 경로(AI `render_template` payload)는 AI 에이전트가 생성한 임의 문자열이 그대로 흘러올 수 있다. 현재 `presentation.ts` 자체는 이 값을 그냥 반환만 하므로 실제 XSS 발생 여부는 소비 컴포넌트(`PresentationBlock` 등)가 해당 문자열을 어떻게 삽입하느냐에 달려 있다. 그러나 `isSafeUrl`처럼 HTML 새니타이징 레이어가 이 레이어에 없다는 점이 위험 신호다.
  - 제안: `outputFormat === "html"`인 경우 소비 컴포넌트에서 `DOMPurify.sanitize()` 또는 동등한 새니타이저를 반드시 거치도록 강제하거나, `toTemplate` 반환 시 새니타이징을 이 레이어에서 수행하는 방향을 고려. 최소한 해당 소비 지점을 확인해야 한다.

- **[WARNING]** `asEnvelope`의 타입 강제 캐스팅 — 임의 AI 페이로드를 `config`·`output` 양쪽으로 동시 노출
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `asEnvelope` 함수 (라인 670~680)
  - 상세: `o.payload`를 `config`와 `output` 두 역할에 동시에 할당한다. 즉, `payload` 안에 있는 모든 키가 `config` 조회 경로와 `output` 조회 경로 양쪽에 동시 노출된다. AI 에이전트가 생성한 payload에 `buttons`, `itemButtons`, `columns`, `rows`, `data` 등 민감도 있는 키를 임의로 넣을 경우, 코드는 이를 모두 수용한다. 특히 `buttons` 배열에 임의 `url`이 들어올 수 있는데, 이는 `asButtons` → `isSafeUrl` 체인이 막아주므로 URL 인젝션은 현재 보호된다. 그러나 `rows` 경로를 통해 임의 오브젝트가 `TableData.rows`로 흘러드는 것은 제한이 없다.
  - 제안: `asEnvelope`를 `PresentationPayload` 경로와 envelope 경로로 명확히 분기하고, 각 converter(`toCarousel`, `toTable` 등)에서 실제로 필요한 키만 추출하도록 narrowing을 강화한다.

- **[INFO]** `isSafeUrl` — `data:` URL에 대한 URL-encoded 우회 미검증
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `isSafeUrl` 함수 (라인 629~641)
  - 상세: `trimStart().toLowerCase()`로 대소문자·앞공백을 처리하지만 `%64ata:` 같은 퍼센트 인코딩 형태는 걸러지지 않는다. 실제 위젯 렌더러가 이 URL을 `decodeURIComponent` 없이 사용한다면 문제가 없지만, 일부 렌더러(예: `<img src>`)는 브라우저가 자동 디코딩하므로 우회 가능성이 존재한다.
  - 제안: URL 검증 전 `decodeURIComponent` 또는 `new URL(u)` 파싱을 시도하여 정규화 후 검증하거나, 허용 목록(`https:`, `http:`, 상대경로) 방식으로 전환한다.

- **[INFO]** 테스트 픽스처 내 실제 toolCallId 값 포함
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — `aiCarousel` 픽스처 (toolCallId: "192999458")
  - 상세: 주석에 "실 SSE wire 캡처 축약"이라고 명시되어 있다. 실제 production wire 캡처에서 toolCallId, renderedAt 타임스탬프 등이 그대로 소스에 포함된다. toolCallId 자체가 비밀 정보는 아니지만, 테스트에 production 데이터를 직접 사용하는 관행은 추후 더 민감한 정보(인증 토큰, 개인 식별 데이터)가 픽스처에 포함될 리스크로 이어진다.
  - 제안: 테스트 픽스처는 완전한 가상 데이터를 사용하거나, 실 wire 데이터를 사용한다면 별도 `.fixture` 파일로 분리하고 `.gitignore` 처리를 고려한다.

- **[INFO]** `asButtons`의 `style` 필드 — 임의 문자열 통과
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `asButtons` 함수
  - 상세: `style: typeof b.style === "string" ? (b.style as PresentationButton["style"]) : undefined`에서 타입 캐스팅만 하고 실제 허용 값(`"primary"`, `"secondary"`, `"outline"`, `"danger"`) 외의 임의 문자열이 그대로 반환된다. 렌더러가 이 값을 CSS 클래스 등으로 직접 사용하면 클래스 인젝션이 가능할 수 있다.
  - 제안: `BUTTON_STYLES = new Set(["primary","secondary","outline","danger"])` 같은 허용 목록을 두고 검증 후 반환하거나, 허용 목록 밖의 값은 `undefined`로 처리한다.

---

### 요약

이번 변경의 핵심 보안 로직인 `isSafeUrl`은 `javascript:`, `data:`, `vbscript:`, `blob:`, `file:` 스킴을 명시적으로 차단하고 있으며 테스트도 잘 갖춰져 있다. 버튼 URL 필터링과 이미지 src 필터링 체인은 기존 XSS 보호를 유지한다. 그러나 `toTemplate`이 반환하는 `rendered` 문자열(특히 AI `render_template` payload의 `content` 경로)에 대한 HTML 새니타이징이 이 레이어에 없고, 이 값이 소비 컴포넌트에서 어떻게 처리되는지가 이번 diff에서 확인되지 않는다는 점이 가장 중요한 위험 신호다. `asEnvelope`가 AI 페이로드를 `config`·`output` 양쪽에 동시 노출하는 설계와 `asButtons`의 `style` 허용 목록 미적용도 향후 확장 시 위험 증폭 요소가 될 수 있다. 하드코딩된 시크릿, SQL 인젝션, 커맨드 인젝션, 인증/인가 문제는 이 변경 범위에 해당하지 않는다.

### 위험도

MEDIUM
