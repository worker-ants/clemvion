---
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-12
owner: developer
spec_impact:
  - spec/7-channel-web-chat/_product-overview.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/conventions/i18n-userguide.md
---

# 위젯 chrome i18n — ai-review/impl-done 잔여(defer) 항목 8건 정리

> 트리거: PR #929(위젯 chrome EN 다국어화) 머지 후, 사용자가 accept-with-rationale defer 로 남겨둔 비차단 cosmetic 8건 "전부 처리" 결정.
> 브랜치: `claude/webchat-i18n-followups` (base origin/main = 19fca6715).

## 처리 항목

- [x] **#1** `Locale`/`TranslationKey` → **`WidgetLocale`/`WidgetTranslationKey`** 개명 (naming WARNING, frontend 동명 grep 혼동 해소). `\b` 단어경계 sed 로 `resolveLocale`·`LocaleContext`·데모 `label="Locale"` 온전. typecheck PASS.
- [x] **#2** `i18n-userguide §적용 범위`: dev-only 데모 host(`src/app/demo/**`)는 **P6 스코프 밖** 명문화 (convention INFO — consistency 반복 오탐 차단).
- [x] **#3** `2-sdk §1` 설치 스니펫 `locale` 에 `'ko' | 'en'` 주석 (documentation INFO — 운영자 EN 지정 가능성 노출).
- [x] **#4** `_product-overview §2`: 위젯 chrome EN 다국어화를 "비목표" 블록 예외문구 → **"목표 (v1)" 목록으로 이동** (requirement INFO — 문서 구조).
- [x] **#5** `WIDGET_STRINGS` 에 `Object.freeze` (side_effect INFO — 런타임 불변 방어, `as const` 보완).
- [x] **#6** EN 확인 다이얼로그 `confirm.yesAria` 중첩 보간 통합 테스트 (testing INFO).
- [x] **#7** `makeTranslate` 폴백 체인(키 자체 반환) 테스트 (testing INFO).
- [x] **#8** `withNavigatorLanguage(lang, fn)` 테스트 헬퍼 추출 + auto-detect 테스트 리팩터 (testing INFO).

## 검증
- [x] spec-link-integrity 13/13 · web-chat typecheck·lint(0 err)·unit(339) PASS
- [~] TEST WORKFLOW (lint·unit·build·e2e) 재수행 중
- [ ] `/ai-review` + `/consistency-check --impl-done`

## 비고
전부 비차단 cosmetic/coverage. 기능·계약 변경 없음(타입 개명은 채널 내부 전용, 외부 소비자 없음). PR #929 의 accept-with-rationale defer 를 해소.
