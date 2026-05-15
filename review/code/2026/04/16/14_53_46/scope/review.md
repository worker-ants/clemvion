## 발견사항

- **[WARNING]** `next.config.ts`에서 유용한 주석 제거
  - 위치: `transpilePackages` 위의 주석 2줄
  - 상세: `// Local symlinked package — transpile required for bundler resolution.` 및 `// Build uses --webpack flag because Turbopack cannot follow symlinked local packages.` 가 이번 작업과 무관하게 삭제되었어요. 이 주석은 빌드 설정 이유를 설명하는 중요한 컨텍스트예요.
  - 제안: User Guide 기능과 무관한 주석 삭제는 되돌려야 해요.

- **[WARNING]** `shared.tsx`에 모듈 수준 가변 카운터 도입
  - 위치: `let checkboxIdCounter = 0` 및 `nextCheckboxId()` 함수
  - 상세: SSR(서버사이드 렌더링) 환경에서 모듈 인스턴스가 공유될 경우 카운터가 누적되어 서버/클라이언트 간 hydration mismatch가 발생할 수 있어요. 테스트 격리도 보장되지 않아 테스트 순서에 따라 ID가 달라져요. `React.useId()`나 `crypto.randomUUID()`처럼 컴포넌트 수명 주기에 바인딩된 방법이 더 안전해요.
  - 제안: `useId()` hook으로 교체하거나, `label`이 ReactNode인 경우에도 안정적인 ID를 생성하도록 컴포넌트 내부로 이동해야 해요.

- **[INFO]** `ai-configs.tsx`에 일부 필드에만 help popover 추가
  - 위치: `TextClassifierConfig` 2개 필드, `InformationExtractorConfig` 2개 필드
  - 상세: 스펙의 "복잡한 필드부터 순차 적용" 규칙에 따른 의도적인 선택적 적용으로 보여요. 범위 이탈은 아니에요.

---

## 요약

전체 변경 사항은 PRD/스펙에 정의된 User Guide 기능(사이드바 메뉴 추가, MDX 기반 문서 시스템, Empty State, FieldHelp popover)을 구현하는 데 집중되어 있으며 범위 이탈 요소는 거의 없어요. 다만 `next.config.ts`의 설명 주석이 이번 기능과 무관하게 삭제된 점, 그리고 `shared.tsx`의 모듈 수준 가변 카운터가 SSR 환경에서 잠재적 버그를 유발할 수 있다는 점이 주요 주의사항이에요.

## 위험도

**LOW**