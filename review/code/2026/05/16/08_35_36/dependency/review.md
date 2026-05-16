# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 이번 변경에서 외부 패키지·라이브러리 추가 없음
  - 위치: 전체 diff (파일 1~11)
  - 상세: 변경 대상은 모두 MDX 문서 파일(`frontend/src/content/docs/**`), plan 추적 문서(`plan/in-progress/`), consistency 리뷰 산출물(`review/consistency/`)이다. `package.json`, `package-lock.json`, `node_modules` 에 대한 변경이 전혀 없다.
  - 제안: 해당 없음

- **[INFO]** MDX 컴포넌트(`<FieldTable>`, `<Example>`, `<Callout>`) 사용은 기존 의존성 범위 내
  - 위치: `ai.mdx`, `ai.en.mdx`, `integrations.mdx`, `integrations.en.mdx`, `variables-and-context.mdx`, `variables-and-context.en.mdx`
  - 상세: 신규 추가된 `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`, `$thread` 관련 섹션은 이미 프로젝트에 등록된 MDX 컴포넌트(`<FieldTable>`, `<Example>`, `<Callout>`)만 사용한다. 신규 컴포넌트 임포트 없음.
  - 제안: 해당 없음

- **[INFO]** frontmatter의 `spec` / `code` 경로 참조 추가에 대한 실존 검증 필요성 확인
  - 위치: `ai.mdx` line +89 (`spec/conventions/conversation-thread.md` 추가), `integrations.mdx` line +229~230 (`spec/4-nodes/4-integration/4-cafe24.md`, `backend/src/nodes/integration/cafe24/cafe24.schema.ts` 추가)
  - 상세: plan 문서(`plan/in-progress/user-guide-sync-2026-05-16.md`)에서 `registry.ts` 단위 테스트가 `.mdx` frontmatter의 `spec`/`code` 경로 실존을 검증한다고 명시되어 있다. 이 테스트가 실제로 통과되었다면 경로 오류는 없으나, 리뷰 diff 내에서 테스트 결과 자체는 확인할 수 없다.
  - 제안: CI 빌드에서 해당 단위 테스트(`registry.ts`)가 통과했는지 확인. 통과 시 문제 없음.

- **[INFO]** 내부 모듈 참조 구조: 문서가 backend 구현체에 단방향 의존
  - 위치: `integrations.mdx` frontmatter `code` 필드 — `backend/src/nodes/integration/cafe24/cafe24.schema.ts`
  - 상세: 사용자 가이드 MDX가 backend 스키마 파일을 `code` frontmatter로 참조하는 패턴은 이미 기존 파일에서도 사용 중인 단방향 참조다. backend가 문서를 참조하는 역방향 의존은 없으며, 이는 의도된 SDD 접근 방식이다.
  - 제안: 해당 없음

## 요약

이번 변경(`user-guide-sync-4af69c`)은 사용자 가이드 MDX 파일, plan 추적 문서, consistency 리뷰 산출물만을 다룬다. 새 외부 패키지·라이브러리가 추가되지 않았고, 버전 고정, 라이선스, 취약점, 번들 크기, 호환성 어느 관점에서도 문제가 없다. MDX 컴포넌트는 기존 등록된 것만 사용하며, frontmatter의 신규 spec/code 경로는 plan에 기술된 단위 테스트(`registry.ts`)로 실존이 검증되어야 한다. 내부 모듈 의존 관계는 문서 → backend 단방향으로 정상적이다. 의존성 관점에서 조치가 필요한 항목은 없다.

## 위험도

NONE
