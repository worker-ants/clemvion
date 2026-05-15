파일 읽기가 완료되었습니다. 이제 아키텍처 분석을 수행하겠습니다.

---

## Architecture Code Review

### 발견사항

---

#### 1. SRP 위반 — 거대 Page 컴포넌트

- **[WARNING]** `schedules/page.tsx` (1,104 lines) 안에 `VisualCronEditor`, `CalendarView`, `NextRunsPreview`, `RawSchedule` 인터페이스, 6개의 mutation, 양방향 cron 변환 로직이 모두 동거
  - 위치: `src/app/(main)/schedules/page.tsx`
  - 상세: 데이터 페칭, form 상태, cron 파싱/변환 로직, 캘린더 렌더, 페이지네이션이 단일 컴포넌트에 혼재. 수정 범위가 광범위해 인접 기능 회귀 위험이 높다.
  - 제안: `ScheduleFormDialog`, `CalendarView`, `cron-editor` 등을 별도 컴포넌트 파일로 분리. `authentication/page.tsx`(536줄), `integrations/[id]/page.tsx`(906줄), `workspace/settings/page.tsx`(940줄)도 동일한 패턴.

---

#### 2. `getWebhookUrl` + `TYPE_BADGE_STYLES` 중복 정의

- **[WARNING]** 동일한 상수·함수가 `triggers/page.tsx`와 `trigger-detail-drawer.tsx`에 각각 정의
  - 위치: `src/app/(main)/triggers/page.tsx:47-54`, `src/components/triggers/trigger-detail-drawer.tsx:39-43` (TYPE_BADGE_STYLES), `triggers/page.tsx:199-203`, `trigger-detail-drawer.tsx:226-230` (getWebhookUrl)
  - 상세: 두 파일이 서로 다른 경로에 있음에도 동일 로직을 복제. 포트 번호(`:3011`) 변경이나 badge 색상 변경 시 양쪽을 동기화해야 한다.
  - 제안: `src/lib/utils/trigger-utils.ts` 또는 `trigger-detail-drawer.tsx`로 단방향 의존으로 정리.

---

#### 3. 환경 구성값이 프레젠테이션 레이어에 노출

- **[WARNING]** 웹훅 URL의 포트 번호(`:3011`)가 UI 컴포넌트 두 곳에 하드코딩
  - 위치: `triggers/page.tsx:201`, `trigger-detail-drawer.tsx:228`
  - 상세: `window.location.origin.replace(/:\d+$/, ":3011")`은 로컬 개발 환경 가정이다. 프레젠테이션 계층이 배포 환경 변수에 직접 의존하는 아키텍처 위반.
  - 제안: `NEXT_PUBLIC_WEBHOOK_BASE_URL` 환경 변수로 추출하거나 API 응답에서 수신.

---

#### 4. `formatRel` — `timeAgo`의 로컬 재구현

- **[WARNING]** `integrations/[id]/page.tsx`의 `formatRel` 함수가 `@/lib/utils/date`의 `timeAgo()`와 동일한 기능을 재구현
  - 위치: `src/app/(main)/integrations/[id]/page.tsx:214-223`
  - 상세: 분/시간/일 단위 상대 시간 포맷팅이 이미 `timeAgo()`에 있다. `formatRel`은 번역 키를 직접 삽입하는 방식을 쓰는데, 이는 날짜 유틸리티의 i18n 추상화를 우회한다.
  - 제안: `timeAgo(integration.lastUsedAt)` 직접 사용.

---

#### 5. 타입 시스템 우회 — `ConversationItem`의 `"rag"` 타입

- **[WARNING]** `"rag"` 타입이 `ConversationItem` 유니온에 없음에도 `as string` 캐스팅으로 런타임 분기
  - 위치: `src/components/editor/run-results/conversation-inspector.tsx:277`, `:511`, `:554`
  - 상세: `type: "rag" as ConversationItem["type"]`과 `(item.type as string) === "rag"` 패턴은 TypeScript의 타입 보호를 무력화한다. `SummaryView`가 합성한 "rag" 항목이 전파되면 컴파일 타임에 잡을 수 없는 버그 경로가 생긴다.
  - 제안: `ConversationItem` 유니온에 `{ type: "rag"; content: string; turnIndex: number }` 추가.

---

#### 6. 인터페이스가 컴포넌트 함수 내부에 정의

- **[INFO]** `RawSchedule`·`mapSchedule`이 `SchedulesPage` 함수 안에, `RawTrigger`가 `TriggersPage` 함수 안에 정의
  - 위치: `schedules/page.tsx:481-507`, `triggers/page.tsx:87-96`
  - 상세: 함수 내부 인터페이스는 매 렌더마다 재평가되고, 모듈 수준의 재사용·테스트가 불가능하다.
  - 제안: 컴포넌트 상단(모듈 스코프)으로 이동.

---

#### 7. `trigger-detail-drawer.tsx` — i18n 미적용

- **[WARNING]** 컴포넌트 전체가 하드코딩된 영어 문자열 사용 (일부 한국어 혼용)
  - 위치: `src/components/triggers/trigger-detail-drawer.tsx` 전반 (line 79, 89, 143, 164, 168, 179, 239, 243, 256 등)
  - 상세: 다른 페이지·컴포넌트는 모두 `useT()` 훅으로 i18n을 처리하는데, 이 파일만 예외다. 한국어(`지식베이스에서...`)와 영어가 동일 컴포넌트 안에 혼재하는 것도 `conversation-inspector.tsx`에서 확인된다.
  - 제안: `useT()` 도입 후 번역 키 등록.

---

#### 8. `date.ts` — `"use client"` 클라이언트 전용 유틸리티

- **[INFO]** `src/lib/utils/date.ts`가 `"use client"` + Zustand 스토어 직접 참조
  - 위치: `src/lib/utils/date.ts:1`, `:17-19`
  - 상세: `currentLocale()`이 `useLocaleStore.getState()`를 호출하므로 서버 컴포넌트나 Node.js 환경에서 임포트할 수 없다. 테스트에서는 `locale` 매개변수로 우회하는데, 이는 "스토어 없이는 동작하지 않는다"는 제약이 API 시그니처에 새어나온 구조적 신호다.
  - 제안: 스토어 읽기를 훅(`useDateFormatter`)으로 격리하고 순수 함수 버전을 별도로 유지. 또는 `locale`을 필수 매개변수로 변경하고 상위에서 주입.

---

#### 9. `window.confirm` — React 모델 외부의 상태 변이 트리거

- **[INFO]** OAuth scope 변경 확인 다이얼로그에 브라우저 내장 `window.confirm` 사용
  - 위치: `src/app/(main)/integrations/[id]/page.tsx:853`
  - 상세: `window.confirm`은 React의 렌더링 사이클 밖에서 동기적으로 실행되며, 스타일 커스터마이징, 테스트, 접근성이 모두 불가하다. 다른 곳(workspace/settings)에서는 `Dialog` 컴포넌트를 사용하고 있어 불일치.
  - 제안: `Dialog` 컴포넌트로 교체 (workspace/settings 패턴 적용).

---

#### 10. `ConversationInspector` — `isLive` 분기로 두 개의 렌더 모드 공존

- **[INFO]** `isLive` prop 값에 따라 완전히 다른 두 개의 UI 경로가 단일 컴포넌트에 혼재
  - 위치: `src/components/editor/run-results/conversation-inspector.tsx:458-518`
  - 상세: 라이브 대화와 이력 재생은 데이터 소스와 인터랙션 모델이 근본적으로 다르다. 하나의 컴포넌트에 두 책임이 함께 있으면 변경 시 상호 간섭 가능성이 있다.
  - 제안: 즉각 리팩토링보다 주석으로 경계를 명확히 표시하고, 향후 `LiveConversationInspector` / `HistoryConversationInspector` 분리 준비.

---

### 요약

전반적인 레이어 구조(페이지 → 컴포넌트 → 유틸/API)는 잘 정의되어 있고, `formatDate`/`timeAgo` 도입·`expression-constants.ts` 설계·`RoleGate` RBAC 패턴도 일관성 있게 적용되어 있다. 주요 아키텍처 위험은 세 가지에 집중된다: (1) 대형 페이지 컴포넌트가 SRP를 위반하며 유지보수 비용을 높이고 있고, (2) `getWebhookUrl`·`TYPE_BADGE_STYLES`·`formatRel` 같은 중복 코드가 독립적으로 진화할 위험이 있으며, (3) `ConversationItem`의 "rag" 타입 우회가 타입 안정성에 구멍을 만들고 있다. `trigger-detail-drawer.tsx`의 i18n 미적용과 포트 하드코딩은 프레젠테이션 계층의 책임 경계가 흐려진 지점이다.

---

### 위험도

**MEDIUM**