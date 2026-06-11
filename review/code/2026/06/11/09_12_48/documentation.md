# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `UnsearchableBanner` 컴포넌트 JSDoc 품질 우수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-banner-refactor-76a800/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 전체
- 상세: `UnsearchableBanner` 함수 export에 JSDoc 블록이 붙어 있으며, 동작 원리(auto-dismiss 메커니즘), 권한 제어(RoleGate), 409 응답 대응 CTA 숨김 등 비자명한 동작이 전부 기술되어 있다. `UnsearchableBannerProps` 인터페이스의 각 prop에도 인라인 JSDoc이 달려 있다. `STATE_CONFIG` 상수에도 목적(산탄총 수술 방지)과 확장 지점이 명확히 주석으로 설명되어 있다.
- 제안: 없음. 현재 수준 유지.

### [INFO] `ReembedStatus` 타입 별칭의 도메인 근거 주석 적절
- 위치: `unsearchable-banner.tsx` 라인(diff 기준 `/** 도메인 타입에서 파생 … */` 블록)
- 상세: 왜 로컬 리터럴 유니온 대신 `KnowledgeBaseData["reembedStatus"]`에서 파생하는지를 타입 주석으로 설명하고 있어, 나중에 편집자가 타입을 바꾸려 할 때 의도를 오해하지 않을 수 있다.
- 제안: 없음.

### [INFO] 페이지 컴포넌트의 새 인라인 주석 — 데이터 출처 불일치 설명 적절
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 616–618 (diff 기준 3줄 추가)
- 상세: 배너와 아래 진행 박스가 서로 다른 데이터 소스(KB REST 응답 vs `embeddingStats` 폴링)를 사용하는 이유, 그리고 재임베딩 직후 일시적 불일치 가능성을 구체적으로 명시하고 있다. 개발자가 "버그 아닌가?" 오진하는 것을 예방하는 중요한 설명이다.
- 제안: 없음. 오히려 이런 종류의 주석이 더 권장된다.

### [INFO] 테스트 케이스 이름이 의도를 명확히 서술함
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` 라인 1077–1088
- 상세: `it.each(["admin", "owner"] as const)` 로 확장하면서 테스트 이름 패턴 `%s (≥ editor) also sees the CTA — role hierarchy regression guard` 가 각 역할에 대해 명확한 설명으로 확장된다. 테스트가 곧 문서(테스트명 = 요구사항 명세) 역할을 한다.
- 제안: 없음.

### [WARNING] `STATE_CONFIG`의 `container` 문자열 필드에 대한 설명 부재
- 위치: `unsearchable-banner.tsx` `STATE_CONFIG` 내 `idle.container` 및 `in_progress.container` 값
- 상세: `container` 키가 Tailwind CSS 클래스 문자열임은 문맥상 추론 가능하지만, 필드 목적(적용 대상 요소: `<div role="alert">` 의 외곽 래퍼)이 인터페이스 정의에 주석으로 명시되어 있지 않다. `STATE_CONFIG`의 Record 타입 내부 인터페이스에 `/** Tailwind 클래스: <div role="alert"> 래퍼에 적용되는 색상/테두리 */` 수준의 짧은 설명이 있으면 후편집자가 바로 파악할 수 있다.
- 제안: `STATE_CONFIG` 타입 정의의 `container: string` 앞에 단행 JSDoc 추가.

```typescript
{
  /** role="alert" 래퍼에 병합되는 Tailwind 색상·테두리 클래스 */
  container: string;
  ...
}
```

### [INFO] spec 참조 주석이 구현과 정합
- 위치: `page.tsx` 라인 616(배너 주석), `unsearchable-banner.tsx` JSDoc 내 `spec 2-navigation/5-knowledge-base §2.4.1·R-3` 참조
- 상세: 두 파일 모두 동일한 spec 섹션을 참조하고 있어 단일 진실 원칙이 주석 레벨에서도 유지된다.
- 제안: 없음.

### [INFO] CHANGELOG/README 업데이트 불필요
- 상세: 이번 변경은 기존 `UnsearchableBanner` 컴포넌트의 내부 리팩터링(상태 분기를 `STATE_CONFIG` 테이블로 추출) 및 테스트 확장이다. 외부 API·props 시그니처·환경변수·설정 옵션이 변경되지 않았으므로 README나 CHANGELOG 업데이트는 필요하지 않다.

---

## 요약

세 파일 전반에 걸쳐 문서화 수준은 높다. `unsearchable-banner.tsx`는 컴포넌트 JSDoc, prop 인라인 주석, 상수 주석이 모두 갖춰져 있고, `page.tsx`의 데이터 출처 불일치 설명 주석은 미묘한 설계 결정을 코드 곁에 명시한 좋은 사례다. 테스트 파일의 케이스 이름도 요구사항을 서술하는 문서로 기능한다. 단 하나의 개선 여지는 `STATE_CONFIG` 내부 `container` 필드 목적이 주석 없이 암묵적으로 넘어간다는 점이며, 단행 JSDoc 추가로 해결된다.

## 위험도

LOW
