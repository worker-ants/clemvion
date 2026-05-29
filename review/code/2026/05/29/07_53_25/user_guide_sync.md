# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 분석 대상

변경 파일 총 22개 (모두 `codebase/backend/` 또는 `plan/`) — 전부 백엔드 구현·테스트·plan.
프론트엔드 파일 0건.

---

## 발견사항

### 1. [WARNING] `formMode` 값 확장 — dict 신규 라벨 미등록

- **변경 파일**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- **매트릭스 항목**: "신규 UI 문자열 (TSX)" 및 "신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값" 행. 원문 인용: `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` **양쪽** 등록 필수 — 한쪽만 추가 금지 (parity 가드 fail)
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` — `formModeNativeModal`, `formModeAuto` 키 미등록
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/triggers.ts` — 동일 키 미등록
- **상세**: 백엔드 `formMode` enum 이 기존 `'multi_step'` 단일 값에서 `'multi_step' | 'native_modal' | 'auto'` 3-값으로 확장됐다. 프론트엔드 `trigger-detail-drawer.tsx` 는 이 값을 `chatChannel?.uiMapping?.formMode ?? "multi_step"` 로 화면에 직접 표시하고 있다(`/Volumes/project/private/clemvion/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 1336행). 현재 dict 에는 `formModeMultiStep` 키만 존재하며 `formModeNativeModal` · `formModeAuto` 는 없다. 사용자가 `auto` 또는 `native_modal` 로 설정한 트리거를 열면 라벨 없이 raw enum 문자열이 노출된다.
- **제안**: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 와 `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` 에 `formModeNativeModal`, `formModeAuto` 키를 **동시** 추가. `trigger-detail-drawer.tsx` 의 표시 로직도 `formMode` 값에 따른 라벨 조회로 갱신 필요.

---

### 2. [WARNING] `formMode` 타입 stale — 프론트엔드 타입·기본값 미갱신

- **변경 파일**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- **매트릭스 항목**: "통합 신규/제공자 변경" 행. 원문 인용: `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 37행: `formMode?: "multi_step"` → `formMode?: 'multi_step' | 'native_modal' | 'auto'` 미갱신
  - `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/triggers/page.tsx` 293행: `formMode: "multi_step"` 하드코딩 — 새 default `"auto"` 로 갱신 필요
- **상세**: 백엔드 default 가 `"auto"` 로 변경됐으나 프론트엔드 트리거 생성·수정 폼은 여전히 `"multi_step"` 을 기본으로 전송한다. 새 트리거를 만들면 백엔드 의도(`"auto"`)와 다른 값이 저장되어 Slack/Discord provider 에서 native modal 이 발동하지 않는다.
- **제안**: `trigger-detail-drawer.tsx` 의 `ChatChannelConfigView.uiMapping.formMode` 타입과 hardcode 기본값 두 곳을 `'multi_step' | 'native_modal' | 'auto'` 로 확장, `page.tsx` 의 `formMode: "multi_step"` 을 `"auto"` 로 갱신.

---

### 3. [WARNING] Slack·Discord 제공자 form 동작 변경 — 통합 가이드 MDX 미갱신

- **변경 파일**: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`, `slack-message.renderer.ts`, `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`, `discord-message.renderer.ts`
- **매트릭스 항목**: "통합 신규/제공자 변경" 행. 원문 인용: `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` + `slack.en.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` + `discord.en.mdx`
- **상세**: Slack·Discord provider 에 Form 노드의 인터랙션 방식이 다단계 입력(`form_prompt`)에서 native modal (`양식 작성하기` 버튼 → `views.open` / Discord interaction type 9)로 기본 전환됐다. 이는 사용자 가시 동작 변경이다 — Slack·Discord 봇과 대화 시 Form 노드가 이전과 다른 UI 를 표시한다. 현재 `slack.mdx` · `discord.mdx` 는 form 관련 안내를 전혀 포함하고 있지 않으며 갱신이 없었다.
- **제안**: 각 provider 가이드에 Form 노드 동작 절 추가 — native modal 기본 동작, `formMode` 설정 옵션 (`auto` / `multi_step` / `native_modal`), Discord 의 select/file 필드 제한(5개 이하, TEXT_INPUT 계열만) 안내. KO/EN sibling 동시 갱신.

---

### 4. [INFO] `language-hint-defaults.ts` 의 신규 `formOpenLabel` 키 — backend-labels 영향 미미

- **변경 파일**: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
- **매트릭스 항목**: "신규 backend zod `ui.label`/`hint`" 행 (회색 지대).
- **상세**: `formOpenLabel` 은 `ChatChannelConfig.languageHints` 의 override 키로 사용자가 직접 JSON 에 입력하는 필드다 (`languageHints: { formOpenLabel: '작성하기' }`). `LABEL_KO` / `HINT_KO` 매핑 대상인 노드 zod schema `ui.label`·`ui.hint` 과는 다른 경로이므로 `backend-labels.ts` 에 추가 항목이 필요하지 않다. 단, 이 override 키가 나중에 트리거 설정 UI 에서 노출될 경우 dict 등록이 필요해진다 — 현재는 미노출 상태이므로 INFO 로 분류.

---

## 요약

PROJECT.md `§변경 유형 → 갱신 위치 매핑` 매트릭스에서 이번 변경 set 에 매칭되는 trigger 는 3개 (신규 UI 문자열/dict 키, 통합 제공자 변경, backend ui.label 신규값)이다. 매칭된 trigger 3개 중 2개에서 동반 갱신 누락이 확인됐다: (1) `formMode` 신규 enum 값 2개의 dict ko/en 미등록, (2) Slack·Discord 통합 가이드 MDX 미갱신. 추가로 프론트엔드 타입·기본값 hardcode stale 이 트리거 생성 동작에 실질적 영향을 미친다. 누락 건수: WARNING 3건, INFO 1건.

## 위험도

MEDIUM
