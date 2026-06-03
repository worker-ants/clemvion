# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `normalizeApiBase` 함수의 정규표현식 체이닝 가독성
  - 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts` L353–358
  - 상세: 두 개의 `.replace()` 체이닝(`/\/+$/` → `/\/api$/i`)은 간결하며 각 주석이 의도를 명확히 서술하고 있다. 함수 단위 JSDoc도 충분하다. 다만 `trim()` 이후 후행 슬래시를 제거한 뒤 `/api`를 제거하는 순서가 중요한데, 함수 본문만으로는 순서 의존성이 코드에서 즉각 보이지 않는다. 주석이 보완하지만, `replace(/\/api\/?$/i, "")` 한 번으로 후행 슬래시 포함 `/api` 변형을 동시에 처리하면 단계를 줄여 순서 의존성 자체를 제거할 수 있다.
  - 제안: 단일 정규표현식 `replace(/\/api\/?$/i, "").replace(/\/$/, "")` 또는 `replace(/(\/api)?\/?$/i, "")` 패턴을 검토할 것. 단, 현재 구현도 명확한 주석 덕분에 허용 가능한 수준이다.

- **[INFO]** `demo-host.tsx` 인라인 힌트 문자열의 매직 리터럴
  - 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx` L509–515 (추가된 `<p style={S.hint}>` 블록)
  - 상세: `http://localhost:3013`, `/api/external/*`, `WEB_CHAT_WIDGET_ORIGINS`, `interactionAllowedOrigins` 등 구체적인 호스트/환경 변수명이 JSX 리터럴로 직접 삽입됐다. 데모 전용 dev-only 컴포넌트이므로 runtime 파급은 없지만, 포트 번호가 `.env`의 `PORT` 값과 동기화되지 않는다. `NEXT_PUBLIC_BASE_PATH`처럼 빌드 타임 환경변수로 치환되지 않기 때문에, 포트가 바뀌면 이 힌트 텍스트만 수동으로 갱신해야 하는 드리프트 위험이 있다.
  - 제안: 데모 전용 파일이므로 현 상태를 유지해도 무방하나, 포트 참조를 `process.env.PORT ?? "3013"` 형태의 상수로 추출해 상단에 정의하면 드리프트를 방지할 수 있다.

- **[INFO]** `use-widget.ts` `onError` 인라인 화살표 함수의 메시지 문자열 중복 가능성
  - 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L1128–1133
  - 상세: `console.warn` 메시지 안에 `/api/external/*`와 `WEB_CHAT_WIDGET_ORIGINS`라는 구체적 문자열이 포함되어 있다. `normalizeApiBase` 주석, `README.md` 힌트, demo-host JSX 힌트와 동일한 맥락을 반복 서술한다. 단일 진실 원칙상 이 문자열들이 세 곳에 흩어져 있으면 향후 환경 변수명·경로가 바뀔 때 누락 위험이 있다.
  - 제안: 에러 메시지를 `use-widget.ts` 상단 상수로 분리하거나(`const SSE_CORS_WARN = "..."`) 짧은 링크 형식으로 단순화하면 변경 지점이 줄어든다. 현재 규모에서는 수용 가능.

- **[INFO]** `buildBootConfig` 함수 내 `appearance` 조건 분기 패턴 일관성
  - 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts` L451–453
  - 상세: `appearance`는 `position`이 항상 존재해 `cfg.appearance = appearance`가 무조건 실행되는 반면, 나머지 선택 필드(`headerTitle`, `welcome`, `launcher`, `disclaimer`)는 빈 값이면 생략된다. 이 비대칭은 기존 코드에서 유래한 것이지만, 리뷰 범위인 변경(normalizeApiBase 적용) 이후에도 패턴이 유지되고 있어 `appearance`가 항상 설정된다는 계약이 코드에서 명시적으로 드러나지 않는다.
  - 제안: 짧은 주석(`// appearance.position 은 항상 존재 — 객체 자체를 항상 주입`)을 추가해 의도적 비대칭임을 명시하면 충분.

- **[INFO]** `demo-config.test.ts` 테스트 입력 리터럴 `"http://x/api"` 가독성
  - 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.test.ts` L274, L293
  - 상세: `"http://x/api"` 는 최소 유효 URL로 의도적으로 짧게 작성된 것이나, `normalizeApiBase` 테스트의 `"https://h/api/v1"` 패턴과 스타일이 다르다. 일관성을 위해 `"http://x.test/api"` 같은 의미 있는 도메인을 쓰거나, 기존 `normalizeApiBase` 테스트처럼 단문자를 유지하되 통일하면 가독성이 개선된다. 기능상 문제는 없다.
  - 제안: 스타일 통일 — `"http://h/api"` 혹은 `"http://x.test/api"` 중 하나로 일관되게.

## 요약

이번 변경은 `apiBase` 정규화 로직(`normalizeApiBase`)을 순수 함수로 분리하고 기존 하드코딩된 `/api` suffix 기본값을 수정하며, SSE CORS 오류를 가시화하는 `onError` 핸들러를 추가하는 내용이다. 함수 분리·단위테스트 추가·JSDoc 작성 등 유지보수성 측면의 기본 원칙을 잘 따르고 있다. 다만 포트 번호(`3013`)와 환경 변수명(`WEB_CHAT_WIDGET_ORIGINS`)이 README·demo-host JSX·use-widget 경고 메시지 세 곳에 분산되어 단일 진실 원칙상 드리프트 위험이 잠재적으로 존재한다. 전반적으로 코드 복잡도가 낮고 함수 길이도 적절하며, 지적 사항 모두 낮은 중요도의 개선 의견 수준이다.

## 위험도

LOW
