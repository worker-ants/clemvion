# 문서화(Documentation) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `useWebChatInstances` / `useWorkflowOptions` / `useCreateWebChat` 공개 훅에 JSDoc 수준 차이
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useWorkflowOptions` 함수 (줄 35)
  - 상세: `useWebChatInstances` 와 `useCreateWebChat` 는 JSDoc 블록 주석이 있으나, `useWorkflowOptions` 는 단일 줄 주석(`/** 워크플로우 선택 드롭다운용 목록. */`)으로만 기술됨. 세 함수 모두 공개 API 이므로 동일한 수준의 주석이 바람직함. 현재 수준은 매우 간결하지만 사용처·반환값 설명이 없음.
  - 제안: `useWorkflowOptions` 에도 "limit: 100, staleTime 없음" 등 동작 특성을 한 줄 이상 기술하거나, 반대로 세 함수를 동일한 단일줄 수준으로 통일.

### 발견사항 2
- **[INFO]** `WebChatDetail` 내부 컴포넌트에 JSDoc 없음
  - 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail` 함수 (줄 69)
  - 상세: `WebChatDetail` 는 같은 파일 내부 전용이라 공개 API 가 아니나, 외형 빌더·스니펫·미리보기를 모두 조합하는 조합 컴포넌트로서 역할이 명확히 드러나지 않음. 특히 `key={selected.id}` 로 리마운트되어 `useAppearanceDraft` lazy-init 을 활용하는 구조가 숨어 있어 이 의도를 인라인 주석으로 남기면 유지 보수에 도움이 됨.
  - 제안: `key` prop 을 통한 상태 초기화 의도를 짧은 주석으로 명시. 예: `{/* key 변경으로 WebChatDetail 리마운트 → useAppearanceDraft lazy-init 재실행 */}`

### 발견사항 3
- **[INFO]** `snippet.ts` 내부 헬퍼 함수(`cleanString`, `cleanSuggestions`, `pruneObject`)에 주석 부재
  - 위치: `/codebase/frontend/src/lib/web-chat/snippet.ts` — 줄 24–37
  - 상세: `cleanString` / `cleanSuggestions` / `pruneObject` 세 private 헬퍼는 export 되지 않으나, 스니펫 정제 로직의 핵심 단계를 담당함. 빈 객체일 때 `undefined` 를 반환하는 `pruneObject` 동작은 호출부에서 분기에 영향을 미치므로 1-2줄 인라인 주석이 있으면 가독성이 향상됨.
  - 제안: 각 함수 위에 동작 요약 1줄 주석 추가. 현재는 `buildBootConfig` JSDoc 에 "빈 문자열·빈 배열 제거" 만 언급됨.

### 발견사항 4
- **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경 변수가 새로 도입됐으나 `.env.example` 혹은 README 에 문서화 여부 불확인
  - 위치: `/codebase/frontend/src/lib/web-chat/widget-base.ts` (테스트 파일 `widget-base.test.ts` 줄 19에서 `NEXT_PUBLIC_WIDGET_CDN_BASE` 키 참조)
  - 상세: 이번 PR 에서 신규 도입된 `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경 변수는 CDN 분리 배포 시 위젯 base URL 을 재정의하는 설정이다. 이 변수의 존재와 기본값(미설정 = self-origin) 이 `.env.example` 이나 프론트엔드 배포 가이드에 반영됐는지 확인이 필요하다. 테스트 파일에만 변수명이 노출되어 있어 신규 배포자가 누락할 수 있다.
  - 제안: `.env.example` (또는 프로젝트에서 사용하는 환경 변수 목록 파일)에 `NEXT_PUBLIC_WIDGET_CDN_BASE=` 항목을 추가하고, "미설정 시 self-origin `/_widget` prefix 경로를 사용" 설명을 달아야 한다.

### 발견사항 5
- **[INFO]** `LivePreview` 컴포넌트의 JSDoc 이 증분 2 계획을 설명하나 증분 2 구현 후 갱신 의무를 명시하지 않음
  - 위치: `/codebase/frontend/src/components/web-chat/live-preview.tsx` — 줄 6–12
  - 상세: 현재 JSDoc 은 "증분 2(Phase 3): 동봉된 same-origin 위젯을 iframe 으로 띄운다"는 미래 계획을 설명한다. 이는 의도적 placeholder 로서 좋은 관행이나, 증분 2 구현 시 이 주석을 갱신해야 한다는 TODO 표시가 없어 오래된 주석으로 남을 위험이 있다.
  - 제안: `// TODO(증분2): iframe 구현 후 이 JSDoc 을 실제 동작으로 갱신` 형태의 TODO 를 주석 끝에 추가.

### 발견사항 6
- **[INFO]** `useAppearanceDraft` 의 `KEY_PREFIX` 상수가 문서화되지 않음
  - 위치: `/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` — 줄 22
  - 상세: `KEY_PREFIX = "clemvion:web-chat:appearance:"` 는 localStorage 키 네임스페이스를 정의하나, 이 키 패턴이 어디에서도 문서화되지 않았다. 향후 localStorage 충돌·마이그레이션·초기화 기능 추가 시 키 네임스페이스 규칙을 알아야 한다.
  - 제안: 상수 위에 `/** localStorage key prefix — 인스턴스별 외형 draft 저장. 키 패턴: `clemvion:web-chat:appearance:<instanceId>` */` 주석 추가.

### 발견사항 7
- **[INFO]** `fireEvent` import 가 테스트에 포함됐으나 사용되지 않음 — 문서 상 사용 의도 불분명
  - 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx` — 줄 2
  - 상세: `fireEvent` 가 import 되었으나 테스트 본문에서 사용되지 않는다. 미사용 import 는 파일 목적 파악을 어렵게 하고, 향후 기여자가 이 import 를 보고 사용 패턴을 오해할 수 있다. 기술적으로는 lint 경고 대상이나 문서화 관점에서도 혼란을 준다.
  - 제안: 사용하지 않는 `fireEvent` import 를 제거.

### 발견사항 8
- **[INFO]** `WebChatBootInput` 의 `apiBase` 필드 주석이 "EIA API origin" 으로만 기술됨 — 충분하지 않은 설명
  - 위치: `/codebase/frontend/src/lib/web-chat/snippet.ts` — 줄 28
  - 상세: `/** EIA API origin. */` 주석에서 "EIA"는 이 코드베이스 내부 용어로 보이며 외부 기여자나 향후 입문자에게 불분명하다. 실제 기대 값 형식(예: `"https://api.example.com"`, trailing slash 불가 여부 등)을 명시하면 사용자 오해를 줄일 수 있다.
  - 제안: `/** 위젯이 API 호출에 사용할 백엔드 origin URL. 예: `https://api.example.com` (trailing slash 없음). */` 형태로 구체화.

---

## 요약

이번 변경은 웹채팅 운영 콘솔의 프론트엔드 증분 1 구현으로, 전반적인 문서화 품질은 준수하다. 주요 공개 함수(`useWebChatInstances`, `useCreateWebChat`, `buildBootConfig`, `buildWebChatSnippet`)에는 모두 JSDoc 블록이 있고, `WebChatDraft` 인터페이스와 `LivePreview` 컴포넌트에도 의도를 설명하는 주석이 달려 있다. i18n 사전 파일(en/ko) 은 자체 문서화가 충분하다. 다만 신규 도입된 환경 변수 `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 `.env.example` 에 반영됐는지 확인이 필요하며(배포자 누락 위험), 내부 헬퍼 함수 3개와 localStorage 키 상수에 짧은 주석이 누락됐고, 테스트 파일의 미사용 `fireEvent` import 가 문서화 혼란을 줄 수 있다. 발견사항 모두 INFO 수준으로 블로킹 이슈는 없다.

## 위험도

LOW
