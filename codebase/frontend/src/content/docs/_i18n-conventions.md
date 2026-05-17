# Docs i18n conventions

> 이 파일은 내비게이션에 포함되지 않아요 (파일명이 `_`로 시작). 콘텐츠 작성자를 위한 내부 규약 문서예요.

## 파일 구조

```
src/content/docs/
├── <section>/
│   ├── <slug>.mdx         # 한국어 canonical (필수)
│   └── <slug>.en.mdx      # 영어 번역 (선택, 본문만)
```

- canonical 파일(`<slug>.mdx`)이 페이지의 **단일 소스**예요. 프론트매터는 여기에만 적어요.
- 영어 번역이 준비되면 같은 디렉터리에 `<slug>.en.mdx`를 추가해요. 프론트매터 없이 **본문만** 작성해요.
- 번역 sibling이 없으면 EN 로케일 사용자에게는 KO 본문 + 안내 배너가 표시돼요.

## 프론트매터 필드

```yaml
---
title: "한국어 제목"            # 필수
title_en: "English title"       # 선택, 영어 로케일용
section: "01-getting-started"   # 필수, 디렉터리 키
order: 1                        # 필수, 섹션 내 정렬 기준
summary: "한국어 한 줄 요약"    # 필수
summary_en: "English summary"   # 선택
spec: ["spec/..."]              # 선택, 관련 스펙 문서
code: ["codebase/backend/..."]           # 선택, 관련 소스 경로
draft: true                     # 선택, production 노출 차단
---
```

## 내부 링크 규약

MDX 본문에서 다른 docs 페이지를 가리킬 때는 **로케일 프리픽스 없이** 작성해요.

```md
자세한 내용은 [UI 투어](/docs/01-getting-started/ui-tour)를 확인해요.
```

`mdx-components.tsx`의 `DocsLink` 래퍼가 현재 사용자 로케일(`ko`·`en`)을 자동으로 주입해 최종 `/docs/<locale>/...` 경로로 바꿔요. 이미 로케일이 포함된 `href`(`/docs/en/...` 등)는 그대로 유지돼요.

## 섹션 레이블 번역

새 섹션 디렉터리를 추가했다면 `codebase/frontend/src/lib/docs/locale.ts`의 `SECTION_LABELS_BY_LOCALE` 테이블에 **한국어·영어 레이블**을 함께 등록해요. 등록하지 않으면 `humanize()` 폴백 로직이 동작해 품질이 떨어져요.

## 새 로케일 추가 절차 (향후)

1. `codebase/frontend/src/lib/i18n/types.ts`의 `LOCALES` 배열과 `Locale` 타입에 코드 추가
2. `codebase/frontend/src/lib/i18n/dict/` 에 새 사전 파일 추가
3. `codebase/frontend/src/lib/docs/registry.ts`의 `LOCALE_SUFFIX` 맵에 `<code>` → `.<code>` 항목 추가
4. 모든 MDX에 `<slug>.<code>.mdx` sibling을 준비 (없으면 KO 폴백 + 배너)
5. `locale.ts` 섹션 레이블에 해당 로케일 엔트리 추가
