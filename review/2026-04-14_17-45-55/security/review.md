## 보안 코드 리뷰

### 발견사항

---

**[WARNING] `window.open` URL 검증 없음 — 오픈 리디렉트 / XSS 위험**
- 위치: `page.tsx` — `handleLinkButtonClick`, `result-detail.tsx` — `handleLinkButtonClick`
- 상세: `window.open(url, "_blank", "noopener,noreferrer")`에서 `url`이 백엔드로부터 수신한 `waitingButtonConfig`의 값으로, 클라이언트 측 검증이 전혀 없음. `javascript:` 프로토콜이나 `data:` URL이 혼입될 경우 XSS 실행 가능. `noopener,noreferrer`는 탭 재참조를 차단하지만 URL 자체의 악성 여부를 막지 못함.
- 제안:
  ```ts
  const ALLOWED_PROTOCOLS = ["https:", "http:"];
  const handleLinkButtonClick = (url: string) => {
    try {
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return;
    } catch {
      return; // 유효하지 않은 URL 무시
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };
  ```

---

**[WARNING] WebSocket으로 전송되는 사용자 입력에 대한 클라이언트 측 검증 없음**
- 위치: `use-execution-interaction-commands.ts` — `sendMessage`, `submitForm`
- 상세: 대화 메시지(`message`)와 폼 데이터(`formData`)가 길이·타입 검증 없이 WebSocket 이벤트로 직접 전송됨. 서버 측에서 검증이 이루어진다면 크리티컬하지 않으나, 클라이언트에서 기본적인 새니타이징(빈 문자열, 최대 길이)을 수행하지 않으면 서버에 불필요한 부하가 가해질 수 있음. 특히 대화형 AI 노드의 경우 프롬프트 인젝션 공격 벡터가 될 수 있음.
- 제안: 메시지 전송 전 빈 값·최대 길이 체크를 추가. 서버 쪽에서도 반드시 검증 필요.

---

**[WARNING] `buttonConfig`를 `unknown → Record<string, unknown>`으로 무검증 타입 단언**
- 위치: `page.tsx` — 약 540~580행 `ButtonBar` 렌더링 블록
- 상세: `(waitingButtonConfig as Record<string, unknown>).buttons`처럼 타입을 강제 단언한 후, 배열로 가정해 `Array<{id, label, type, url, style}>`로 다시 캐스팅함. 런타임 시 백엔드가 예상과 다른 형태의 payload를 보낼 경우 렌더링 오류 또는 `url` 필드에 악성 값이 `handleLinkButtonClick`으로 전달될 수 있음.
- 제안: zod 또는 타입 가드로 `waitingButtonConfig`를 파싱 후 사용:
  ```ts
  const buttons = Array.isArray(raw.buttons) ? raw.buttons.filter(isValidButton) : [];
  ```

---

**[INFO] `package-lock.json` — `@emnapi/core`, `@emnapi/runtime` 신규 추가 (WebAssembly 런타임)**
- 위치: `package-lock.json` — `@emnapi/core@1.9.2`, `@emnapi/runtime@1.9.2`
- 상세: WASM 스레딩 지원 패키지가 옵셔널 의존성으로 추가됨. 직접 import 되지 않는 한 attack surface 확장은 미미하나, 향후 supply chain 관점에서 불필요한 WASM 바이너리 실행 경로가 생기지 않도록 모니터링 필요.
- 제안: 실제로 사용되는지 확인. 불필요하면 `--ignore-optional` 또는 `.npmrc`에서 제외.

---

**[INFO] 실행 스토어 전역 공유 — 다중 탭 간 상태 오염 가능성**
- 위치: `page.tsx` — `resetStore` useEffect, `use-execution-interaction-commands.ts`
- 상세: Zustand 스토어가 싱글톤으로 동작하므로 같은 브라우저에서 두 탭이 다른 `executionId`를 열면 WebSocket 이벤트가 교차 적용될 수 있음. 탭 전환 시 `reset()` 호출로 어느 정도 완화되지만, 동시에 두 탭이 열린 경우 race condition 발생 가능.
- 제안: 스토어에 `activeExecutionId`를 두고, WebSocket 이벤트 핸들러에서 `executionId` 불일치 시 무시하는 guard 추가.

---

**[INFO] 에러 메시지가 UI에 직접 노출**
- 위치: `page.tsx` — `execution.error.message` 렌더링
- 상세: 백엔드 에러 메시지가 `<div>Error: {execution.error.message}</div>`로 그대로 렌더링됨. 내부 스택 트레이스나 경로 정보가 포함될 경우 정보 노출 위험.
- 제안: 에러 메시지는 사용자에게 보여줄 용도로 별도 정제된 필드를 사용하거나, 서버에서 클라이언트 노출용 메시지를 분리.

---

### 요약

이번 변경의 핵심은 WebSocket 인터랙션 커맨드를 전용 훅(`useExecutionInteractionCommands`)으로 리팩토링하고, 실행 상세 페이지에 대기 중 인터랙션 UI를 추가한 것으로, 아키텍처 측면에서는 개선됨. 보안 관점에서 가장 주의할 부분은 `handleLinkButtonClick`의 URL 검증 누락으로, 백엔드에서 수신한 URL을 검증 없이 `window.open`에 전달하는 것은 `javascript:` 프로토콜 등 악성 URL 삽입 시 XSS로 이어질 수 있음. 또한 버튼 설정 객체를 타입 단언만으로 처리하는 부분도 런타임 안전성을 위해 개선이 필요. 하드코딩된 시크릿, SQL 인젝션, 인증 우회 등의 고위험 취약점은 해당 변경에서 발견되지 않음.

### 위험도

**MEDIUM** — URL 검증 누락으로 인한 오픈 리디렉트/XSS 가능성이 존재하나, 백엔드에서 버튼 설정을 생성·저장하는 주체가 인증된 워크플로우 설계자로 제한된다면 실질 공격 가능성은 낮음. 그러나 멀티테넌트 환경이거나 외부 API 연동을 통해 버튼 URL이 주입될 수 있는 경우 HIGH로 상향 조정 필요.