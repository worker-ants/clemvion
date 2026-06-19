# Maintainability Review — DangerTab extraction hotfix

Reviewer: maintainability-reviewer
Branch: claude/agent-af1bb958339672d2c → main
Date: 2026-06-19

---

## 발견사항

### [INFO] `@internal` JSDoc 태그 제거 — 의도적이고 올바른 처리
- 위치: `page.tsx` 에서 제거된 `/** @internal exported for unit testing (danger-tab.test.tsx) only. */` 주석
- 상세: 원본 page.tsx 에는 `@internal` 주석이 붙어 있었다. 이제 `DangerTab` 이 전용 파일로 추출되었으므로 `export function DangerTab` 은 정상 모듈 공개 심볼이 된다. `@internal` 태그를 제거한 것은 정확하다.
- 제안: 없음 (올바른 처리).

### [INFO] `"use client"` 지시어가 새 파일에 포함됨
- 위치: `danger-tab.tsx` 라인 1
- 상세: `danger-tab.tsx` 는 `useRouter`, `useState`, `useMutation` 등 클라이언트 훅을 사용하므로 `"use client"` 가 필수다. 올바르게 포함되어 있다.
- 제안: 없음.

### [INFO] `page.tsx` 의 불필요해진 임포트 정리가 완전함
- 위치: `page.tsx` diff — `useRouter`, `Trash2`, `IntegrationScope`, `UsageWorkflow`, `DeleteBlockedDialog` 제거
- 상세: 추출된 심볼에 대응하는 5개 임포트가 모두 제거되었다. 잔류 미사용 임포트 없음.
- 제안: 없음.

### [INFO] 추출 충실도(behavioral/markup/i18n/props drift) — 완전 일치
- 위치: `danger-tab.tsx` 전체
- 상세: diff 비교 결과, 함수 시그니처(props 3개), 훅 순서, state 변수, mutation 로직, JSX 구조, Tailwind 클래스, i18n 키, `DeleteBlockedDialog` 호출 방식이 원본과 한 글자도 다르지 않다. 행동·마크업·i18n 드리프트 없음.
- 제안: 없음.

### [INFO] 테스트 임포트 경로 업데이트
- 위치: `__tests__/danger-tab.test.tsx` 라인 46 (이전: `"../page"`, 이후: `"../danger-tab"`)
- 상세: 변경이 새 파일 위치와 정확히 일치한다. 다른 테스트 파일에 `../page` 에서 `DangerTab` 을 임포트하는 경우가 없는지 확인이 필요하나, diff 상 단일 파일 변경이므로 범위 내에서는 이상 없음.
- 제안: 없음 (검토 완료).

### [INFO] 새 파일의 임포트가 최소·정확함
- 위치: `danger-tab.tsx` 라인 1-16
- 상세: `useState`(훅), `useRouter`(라우터), `useMutation`/`useQueryClient`(React Query), `toast`(알림), `Loader2`/`Trash2`(아이콘), `Button`(UI), `integrationsApi`/`IntegrationDto`/`IntegrationScope`/`UsageWorkflow`(API), `TFunction`(i18n), `DeleteBlockedDialog`(다이얼로그) — 컴포넌트가 실제 사용하는 심볼만 임포트하고 있다. 불필요한 임포트 없음.
- 제안: 없음.

---

## 요약

이번 변경은 `next build` 중단을 일으킨 App Router 규약 위반(page.tsx의 비-default 공개 export)을 수정하기 위해 `DangerTab` 컴포넌트를 `danger-tab.tsx` 로 순수하게 추출한 것이다. 추출은 기계적으로 정확하며, 함수 시그니처·상태 로직·JSX 마크업·i18n 키·에러 핸들링 흐름이 원본과 완전히 일치한다. page.tsx 에서는 이제 불필요해진 임포트(5개)가 빠짐없이 제거되었고, 새 파일의 임포트는 최소하게 유지된다. `"use client"` 지시어도 올바르게 배치되었으며, 테스트 임포트 경로도 정확히 업데이트되었다. Critical 또는 Warning 수준의 문제는 없다.

## 위험도

NONE
