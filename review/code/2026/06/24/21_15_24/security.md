### 발견사항

- **[INFO]** 테스트 파일 — 하드코딩된 인스턴스 ID/이름
  - 위치: `codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts` — `"t-1"`, `"t-fail"`, `"새 이름"`, `"X"` 등
  - 상세: 테스트 픽스처에 사용된 값은 실제 시크릿이 아닌 더미 데이터이며, 테스트 범위 내에서만 노출된다. 프로덕션 토큰·API 키 등 민감 값은 없다.
  - 제안: 현재 패턴 적절. 별도 조치 불필요.

- **[INFO]** `useUpdateWebChatMeta` — 입력 검증이 클라이언트 측에서만 수행
  - 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L588–591
  - 상세: `name`과 `isActive`의 `undefined` 여부 확인은 클라이언트에서 이루어지며, 빈 문자열(`""`)이나 공백만 있는 이름도 `undefined`가 아니면 PATCH 바디에 포함되어 서버로 전송된다. 다이얼로그 레벨에서는 `trimmed.length === 0` 검사가 있으나 훅 자체에는 입력 새니타이징이 없다.
  - 제안: 서버 측에서 `name` 필드 길이·허용 문자 유효성을 검증해야 한다. 프론트엔드 훅이 단독으로 재사용될 경우 빈 문자열이 전달될 수 있으므로, 훅 내부에서도 `name`이 존재할 경우 trim 후 빈 문자열이면 에러를 throw하거나 바디에서 제외하는 방어 코드를 추가할 수 있다.

- **[INFO]** `useUpdateWebChatAppearance` — `appearance` 객체의 내용 검증 부재
  - 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L548–555
  - 상세: `appearance` 객체(`primaryColor`, `position` 등)는 타입 수준(`WebChatAppearanceConfig`)에서만 제약되며, 런타임 새니타이징 없이 그대로 PATCH 바디에 포함된다. `primaryColor`에 스크립트 문자열이 포함될 경우 서버에 저장된 값이 설치 스크립트에 삽입되어 사이트에서 렌더될 때 XSS 벡터가 될 수 있다. 다만 이 위험은 백엔드 저장 레이어와 프론트엔드 렌더링 방식(innerHTML vs textContent/React 이스케이핑)에 달려 있다.
  - 제안: 설치 스크립트가 생성될 때 `primaryColor`와 같은 값을 JSON 직렬화하거나 HTML 이스케이핑하는지 확인한다. 백엔드에서 색상 값 형식(`#RRGGBB`)을 정규식으로 검증하는 것을 권장한다.

- **[INFO]** 문서(MDX) — 설치 스크립트 예시에 `<api-domain>` 등 플레이스홀더 노출
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx` 설치 스크립트 예시 코드
  - 상세: 예시 코드에 포함된 주소(`https://<widget-host>/...`, `https://<api-domain>`)는 의도적인 플레이스홀더로, 실제 시크릿이 아니다. 기존 Callout에서도 "위젯 경로는 비밀 값이 아님"을 명시하고 있다.
  - 제안: 현재 패턴 적절. 별도 조치 불필요.

- **[INFO]** `useCreateWebChat` — `crypto.randomUUID()`로 생성한 `endpointPath` 클라이언트 결정
  - 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` L509 (기존 코드, 이번 diff 범위 외)
  - 상세: `endpointPath`(공개 webhook path)를 클라이언트가 UUID 생성하는 패턴이다. `crypto.randomUUID()`는 브라우저 CSPRNG를 사용하므로 예측 불가 수준은 충분하다. 다만 클라이언트가 임의 경로를 지정 가능하다는 점에서 서버 측에서 중복 검사 및 형식 유효성 검사가 반드시 수행되어야 한다.
  - 제안: 서버 측 UUID 형식 및 중복 검사가 있는지 확인 권장.

- **[INFO]** `onError` 미처리 — PATCH 실패 시 에러 정보 미노출
  - 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` `useUpdateWebChatMeta`·`useUpdateWebChatAppearance`
  - 상세: `onError` 콜백이 없어 mutation 실패 시 에러 객체가 React Query 내부에서만 관리된다. JSDoc에 의도적 설계임을 명시했다. `web-chat-rename-dialog.tsx`의 `catch {}` 블록은 에러를 외부로 재노출하지 않고 `toast.error`로만 처리한다.
  - 제안: 현재 패턴 적절. 단, 추후 에러 로깅 시스템 연동 시 서버 에러 스택트레이스 등 민감 정보가 클라이언트 로그에 남지 않도록 주의.

### 요약

이번 변경은 프론트엔드 React 훅(JSDoc 보강)·다이얼로그 컴포넌트 리팩터링(함수명 변경)·단위 테스트 추가·사용자 가이드 문서 갱신으로 구성된다. 하드코딩된 시크릿이나 명백한 인젝션 취약점은 발견되지 않았다. 주요 관찰 사항은 `appearance` 필드 값(특히 `primaryColor`)이 설치 스크립트에 삽입될 경우의 XSS 위험으로, 이는 백엔드 저장 레이어와 스크립트 생성 방식에 의존하며 이 diff 범위 밖에서 관리되어야 한다. 인증/인가 처리는 훅 레이어에서 직접 다루지 않고 서버 및 상위 레이어에 위임하는 구조로, 해당 범위 내에서는 문제없다. 전반적으로 보안 위험도는 낮다.

### 위험도

LOW
