# 아키텍처(Architecture) Review

## 발견사항

### [INFO] 레이어 책임 분리 — 명확하고 적절함
- 위치: 전체 구조
- 상세: `lib/web-chat/` (순수 도메인 로직 — snippet 생성, widget-base URL 해석), `components/web-chat/` (UI + 데이터 훅), `app/(main)/web-chat/page.tsx` (라우트 조합 레이어)로 3계층이 명확히 분리되어 있다. 각 레이어가 하위 레이어만 import 하며 역방향 의존이 없다.
- 제안: 현행 유지.

---

### [INFO] SOLID — 단일 책임 원칙 준수
- 위치: `use-web-chat.ts`, `use-appearance-draft.ts`, `snippet-input.ts`, `snippet.ts`, `widget-base.ts`
- 상세: 각 모듈의 책임이 명확하게 분리되어 있다. `use-web-chat.ts`는 API 통신 및 인스턴스 도메인 모델, `use-appearance-draft.ts`는 로컬 draft 상태 관리, `snippet-input.ts`는 draft→boot 변환 매핑, `snippet.ts`는 순수 boot config 빌드 및 HTML 스니펫 생성, `widget-base.ts`는 위젯 서빙 위치 해석으로 각각 단일 책임을 가진다.
- 제안: 현행 유지.

---

### [WARNING] `use-web-chat.ts` — 단일 파일에 서로 다른 도메인 관심사 3개 혼재
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` 전체
- 상세: `useWebChatInstances` (인스턴스 조회+필터), `useWorkflowOptions` (워크플로우 드롭다운용 목록), `useCreateWebChat` (생성 뮤테이션)이 한 파일에 있다. `useWorkflowOptions`는 웹채팅 도메인보다는 "워크플로우 선택" 공통 훅에 가까운 성격이며, 현재 구조는 파일 경계가 "web-chat 전용 훅" 인지 "여러 도메인에서 재사용되는 훅" 인지 모호하다. 인스턴스가 늘어날수록 파일이 비대해지는 방향으로 갈 위험이 있다.
- 제안: 즉각 분리 필요성은 낮지만, `useWorkflowOptions`를 `components/workflows/use-workflow-options.ts` 혹은 공유 훅으로 이동할 것을 고려한다. 중단기적 결합도 관리를 위한 INFO 수준 추적 권장.

---

### [WARNING] `useCreateWebChat` — 클라이언트 사이드 UUID 생성으로 인한 책임 경계 문제
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 `endpointPath: crypto.randomUUID()`
- 상세: 공개 webhook의 `endpointPath`(외부에 노출되는 공개 경로 식별자)를 클라이언트에서 생성한다. 이는 데이터 레이어 책임(고유성 보장, 충돌 방지, 검증)을 클라이언트 레이어가 수행하는 역전된 책임 배치다. 서버가 이를 검증하지 않으면 클라이언트가 임의 경로를 주입할 수 있고, 서버가 검증한다면 클라이언트 생성 자체가 불필요하다. 커밋 메시지에 "spec 2-trigger-list §2.5" 근거가 언급되어 있으나 아키텍처 원칙 상 공개 식별자의 생성 권한은 서버에 있어야 한다.
- 제안: 서버가 `endpointPath`를 자동 생성하도록 변경하거나, 적어도 서버 측 UUID 검증 로직이 있음을 spec에서 명확히 확인 후 이 패턴이 의도된 것인지 주석으로 표명할 것.

---

### [WARNING] `page.tsx` — `createButton` JSX를 변수로 추출해 두 곳에서 재사용
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` 라인 84–91, 416
- 상세: `createButton` JSX 표현식을 변수로 추출해 헤더와 `EmptyState` 두 곳에서 재사용한다. 이 패턴은 렌더 함수마다 새 React 엘리먼트를 생성해 React의 재조정 최적화를 방해할 수 있으며, 상태 공유 없이 동일 컴포넌트 인스턴스인 것처럼 사용하는 것은 잠재적 혼동 요인이다. React 공식 권장은 중복 렌더링이 필요한 경우 컴포넌트로 추출하는 것이다.
- 제안: `CreateButton` 컴포넌트로 추출하거나, 각 위치에서 직접 JSX를 작성한다.

---

### [INFO] `use-appearance-draft.ts` — 렌더 중 setState 패턴(React "storing from previous renders")
- 위치: `/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 `if (loadedId !== instanceId) { ... }`
- 상세: React 공식 문서에서 권장하는 "이전 렌더 결과 저장" 패턴을 의도적으로 사용하고 있으며 주석도 명시되어 있다. 이 패턴은 effect 내 setState의 캐스케이딩 렌더 문제를 피하는 올바른 접근이다. 다만, 상위에서 `key={selected.id}`를 `WebChatDetail`에 이미 전달하고 있어 (`page.tsx` 라인 440) 인스턴스 전환 시 `WebChatDetail`이 리마운트되므로 `useAppearanceDraft` 내 인스턴스 추적 로직이 실제로 트리거될 가능성이 낮다. 불필요한 방어 로직이 남아있을 수 있다.
- 제안: `key={selected.id}` 리마운트 전략을 신뢰한다면 `loadedId` 추적 로직을 제거해 코드 단순화 고려. 현재는 방어적으로 유지해도 무방하나 두 메커니즘이 동시에 존재하는 것은 가독성을 낮춘다.

---

### [INFO] `InstallSnippetBox` — 환경 의존성(getWebhookBaseUrl, getWidgetLoaderUrl)을 컴포넌트 내부에서 직접 호출
- 위치: `/codebase/frontend/src/components/web-chat/install-snippet-box.tsx` 라인 `getWebhookBaseUrl()`, `getWidgetLoaderUrl()`
- 상세: 컴포넌트가 환경 유틸리티 함수를 직접 호출한다. DI(의존성 역전)를 엄격히 적용하면 이 값들을 props로 받거나 context를 통해 주입받아야 테스트가 용이하다. 현재 테스트는 `apiGetMock`으로 API를 모킹하지만 `getWebhookBaseUrl`/`getWidgetLoaderUrl` 동작은 테스트에서 제어되지 않는다.
- 제안: 현 규모에서는 허용 가능하나, 테스트 커버리지를 높이려면 환경 함수를 props 혹은 context로 주입 가능하게 리팩터링 고려.

---

### [INFO] `TriggerListItem` 타입 정의가 `use-web-chat.ts` 내부에만 존재 — 도메인 모델 경계 모호
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` `interface TriggerListItem`
- 상세: `TriggerListItem`은 기존 trigger 도메인의 API 응답 타입인데, `components/web-chat/` 안에서 비공개 `interface`로 재정의되어 있다. trigger 도메인이 이미 별도 API 타입을 정의하고 있다면 중복 정의가 되며, 없다면 trigger 관련 타입이 web-chat 모듈 내에 숨겨진 것이다.
- 제안: 기존 trigger API 타입이 있는 경우 재사용하고, 없다면 `lib/api/types/trigger.ts` 같은 공유 타입 파일로 이동을 검토한다.

---

### [INFO] `sidebar.tsx` — navItems 배열에 webChat 항목 추가, 기존 데이터 주도 패턴 일관성 유지
- 위치: `/codebase/frontend/src/components/layout/sidebar.tsx` 라인 640
- 상세: 사이드바 메뉴가 데이터 배열(`navItems`)으로 관리되어 개방-폐쇄 원칙을 잘 따르고 있다. 새 메뉴 추가가 단 한 줄 데이터 추가로 완결되었다. 구조적으로 올바르다.
- 제안: 현행 유지.

---

### [INFO] `snippet.ts` — `buildBootConfig`의 반환 타입이 `Record<string, unknown>`으로 불투명
- 위치: `/codebase/frontend/src/lib/web-chat/snippet.ts` 라인 `buildBootConfig` 함수 시그니처
- 상세: `buildBootConfig`가 정제된 설정 객체를 반환하지만 타입이 `Record<string, unknown>`으로 선언되어 있다. 이는 호출자가 반환값의 구조를 알 수 없어 타입 안전성이 떨어진다. 실제로 JSON 직렬화 후 스니펫에 삽입되어 외부로 나가는 값이므로 타입 정확성이 중요하다.
- 제안: 정제된 boot config를 위한 별도 출력 타입(`WebChatBootConfig`)을 정의하고 반환 타입으로 사용하는 것이 API 명확성을 높인다.

---

## 요약

전체 아키텍처는 레이어 분리(lib 도메인 / components 훅+UI / page 라우트)와 모듈 경계가 명확하게 설계되어 있으며, 특히 `lib/web-chat/`의 순수 함수 모듈(snippet, widget-base)은 단일 책임과 테스트 가능성 면에서 우수하다. 사이드바 navItems의 데이터 주도 패턴과 `draftToBootInput`의 명확한 매핑 레이어 분리도 긍정적이다. 주요 개선 포인트는 두 가지다: (1) `endpointPath`를 클라이언트에서 생성하는 것은 비즈니스 규칙 경계 위반이며 서버 책임으로 재배치해야 하고, (2) `createButton` JSX 변수 재사용과 `use-web-chat.ts` 내 이질적 훅 3종 혼재는 향후 증분 확장 시 유지보수 부채가 될 수 있다. `use-appearance-draft.ts`의 이중 방어 로직(key 리마운트 + loadedId 추적 동시 사용)도 단순화 여지가 있다.

## 위험도

LOW
