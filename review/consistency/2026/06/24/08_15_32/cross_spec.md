# Cross-Spec 일관성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-24

---

## 발견사항

### 발견사항 1

- **[WARNING]** `GET /api/triggers` 쿼리 파라미터 `interactionEnabled` — trigger-list spec 미등록
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §2` 콘솔 동작 표 ("인스턴스 목록" 행)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md §3 API` 테이블 (`GET /api/triggers` 쿼리: `type, status, search, page, limit, sort, order`)
  - 상세: `5-admin-console.md` 는 웹채팅 인스턴스 목록 조회에 `GET /api/triggers?type=webhook&interactionEnabled=true` 를 사용하고, 구현 코드(`query-trigger.dto.ts`·`triggers.service.ts`)도 `interactionEnabled` boolean 필터를 추가했다. 그러나 `spec/2-navigation/2-trigger-list.md §3` 의 `GET /api/triggers` 행은 허용 쿼리 파라미터를 `type, status, search, page, limit, sort, order` 로 열거하며 `interactionEnabled` 를 포함하지 않는다. Trigger API 의 SoT 역할을 하는 trigger-list spec 이 신규 쿼리 파라미터를 누락한 채 방치되면 API 계약 drift 가 발생한다.
  - 제안: `spec/2-navigation/2-trigger-list.md §3` 의 `GET /api/triggers` 행에 `interactionEnabled` (boolean, optional) 파라미터를 추가한다. 설명은 "웹채팅 콘솔 목록 필터 — `config.interaction.enabled` 일치 트리거만 반환" 정도로 간결하게 기술하면 충분하다. 쿼리 파라미터 목록 일관성을 위해 `spec/5-system/14-external-interaction-api.md` 가 Trigger API 를 언급하는 부분도 필요 시 동반 확인한다.

---

### 발견사항 2

- **[INFO]** `WebChatAppearanceDto` 저장 형태(flat)와 `BootConfig` 런타임 형태(nested) 간 변환 매핑이 spec 에 미문서화
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §4` (외형/콘텐츠 빌더 서버 저장), `spec/5-system/14-external-interaction-api.md §4 등록 페이로드 (appearance 블록)`
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §4 BootConfig 스키마`
  - 상세: `2-sdk.md §4 BootConfig` 는 `welcome: { text?: string; suggestions?: string[] }`, `launcher: { suggestions?: string[] }` 의 nested 구조를 정의한다. 반면 `WebChatAppearanceDto`(구현 및 EIA spec §4 appearance 블록)는 `welcomeText: string`(flat), `suggestions: string`(줄바꿈 구분 단일 문자열)로 저장한다. 프론트엔드 `snippet-input.ts:draftToBootInput`이 `welcomeText → welcome.text`, `suggestions.split('\n') → welcome.suggestions / launcher.suggestions` 변환을 수행하므로 런타임 동작은 정합적이다. 그러나 이 저장-런타임 간 형태 차이와 변환 규칙이 spec 본문 어디에도 명시되지 않아, 향후 외부 API 호출자나 다른 컴포넌트가 `config.interaction.appearance` 를 직접 읽을 때 혼란이 생길 수 있다. 직접 모순이 아닌 정보 공백이므로 INFO 등급.
  - 제안: `spec/7-channel-web-chat/5-admin-console.md §4` 또는 `spec/5-system/14-external-interaction-api.md §4 appearance` callout 에 "저장 형태는 `welcomeText`(string)·`suggestions`(줄바꿈 구분 문자열)이며, SDK BootConfig 의 `welcome.text`/`welcome.suggestions`(배열)·`launcher.suggestions`(배열)는 클라이언트(`draftToBootInput`)가 변환해 주입한다"는 1~2줄 주석을 추가한다.

---

### 발견사항 3

- **[INFO]** `BootConfig.appearance.zIndex` 필드가 `WebChatAppearanceDto` 에서 누락
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §4` (BootConfig 필드를 폼으로 편집한다 — 열거 중 `appearance{primaryColor,position}`)
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §4 BootConfig`(`appearance?: { primaryColor?, position?, zIndex? }`)
  - 상세: `2-sdk.md §4 BootConfig` 는 `appearance.zIndex` 를 선택 필드로 선언한다. 그러나 `WebChatAppearanceDto` 에는 `zIndex` 필드가 없고, `5-admin-console.md §4` 의 폼 편집 필드 열거에도 `zIndex` 가 없다. 이는 설계상 의도(콘솔 UI 는 zIndex 를 편집하지 않고 스니펫에서 직접 지정)일 가능성이 있으나 spec 이 명시하지 않아 모호하다. 두 영역 간 직접 기능 모순이 아닌 범위 불일치다.
  - 제안: `5-admin-console.md §4` 필드 열거에 `appearance{primaryColor,position}` 라고 명시하고 괄호 안에 "zIndex 는 콘솔 저장 대상 외 — 스니펫 직접 편집 전용" 또는 동등한 설명을 추가해 의도를 명확히 한다.

---

### 발견사항 4

- **[INFO]** `WebChatAppearanceDto.suggestions` 가 `welcome.suggestions`와 `launcher.suggestions` 둘 다를 동일 문자열로 처리 — spec 미명시
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §4` (외형/콘텐츠 빌더, `welcome{text,suggestions}` · `launcher{suggestions}` 편집)
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §4 BootConfig`(`welcome.suggestions`, `launcher.suggestions` 가 각각 독립 배열)
  - 상세: `2-sdk.md §4 BootConfig` 는 `welcome.suggestions` 와 `launcher.suggestions` 를 별도 배열로 정의한다. 그러나 `WebChatAppearanceDto` 는 단일 `suggestions: string` 필드만 보유하고, `draftToBootInput` 이 동일 값을 `welcome.suggestions` 와 `launcher.suggestions` 양쪽에 동일하게 주입한다. 즉 두 suggestions 를 별개로 관리할 수 없는 구현상 결정이 spec 에는 반영되지 않았다. SDK 계약상 두 필드가 독립적으로 보이지만 실제 콘솔은 하나로 통일한다는 점이 혼란 야기 가능.
  - 제안: `5-admin-console.md §4` 에 "콘솔은 추천질문을 `welcome.suggestions`·`launcher.suggestions` 공용 단일 필드로 관리한다(동일 목록이 양쪽에 주입됨)" 를 1줄 추가하거나, `2-sdk.md §4` 에 "콘솔 빌더는 이 두 필드를 동일값으로 간주한다"는 참조 주석을 추가한다.

---

## 요약

`spec/7-channel-web-chat/` 신규 구현과 기존 spec 간 직접 기능 모순(CRITICAL)은 발견되지 않았다. 주요 발견은 다음과 같다. (1) `GET /api/triggers` 에 추가된 `interactionEnabled` 쿼리 파라미터가 `spec/2-navigation/2-trigger-list.md §3` 에 미등록되어 API 계약 drift 가 발생하는 WARNING 1건이 있다. (2) 나머지 3건은 INFO — `WebChatAppearanceDto` 저장 형태(flat: `welcomeText`, `suggestions`)와 SDK `BootConfig` 런타임 형태(nested: `welcome.text`, `welcome.suggestions[]`)의 변환 규칙이 spec 에 미문서화된 것, `zIndex` 필드의 콘솔 저장 범위 제외 근거 미명시, `welcome.suggestions`·`launcher.suggestions` 공용 처리 미명시가 해당한다. 데이터 모델·RBAC·상태 전이·API method·요구사항 ID 층면에서는 충돌이 없으며, 기존 EIA·Trigger·Webhook·데이터 모델 spec 과의 정합성은 유지된다.

## 위험도

LOW
