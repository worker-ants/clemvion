# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 인라인 Tailwind 조건부 클래스 문자열이 길고 중복됨
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L359–363
- 상세: `className` 에 들어가는 조건부 HSL 스타일 문자열이 한 줄에 두 개의 긴 문자열로 분기되어 있어 한눈에 파악하기 어렵다. 코드베이스 내 다른 곳에서는 `cn()` (clsx/tailwind-merge) 유틸리티를 사용해 조건부 클래스를 선언적으로 분리하는 패턴이 일반적이다.
- 제안: `cn(...)` 유틸리티로 기본 클래스와 상태별 클래스를 분리하거나, 변수로 추출해 가독성을 높인다.

```tsx
// 현재
className={`flex flex-wrap items-center gap-3 ... ${inProgress ? "border-[hsl(...)]..." : "border-[hsl(...)]..."}`}

// 개선 예시
const stateClasses = inProgress
  ? "border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
  : "border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]";
// cn("flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm", stateClasses)
```

---

### [INFO] `inProgress` 파생 불리언으로 분기가 4회 반복됨
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L365–398
- 상세: JSX 안에서 `inProgress ? ... : ...` 3항 연산자가 아이콘, 제목, 설명, CTA 가시성 총 4곳에서 반복된다. 컴포넌트가 작아 현재 수준에서 문제가 되지는 않지만, 상태가 늘어나면 (`in_progress` | `idle` 외 상태 추가 시) 각 분기를 모두 수정해야 하는 산탄총 수술(shotgun surgery) 위험이 있다.
- 제안: 상태별 설정 객체(`stateConfig`)를 한 곳에서 정의하고 JSX에서는 참조만 하도록 리팩터링하면 상태 추가 시 수정 지점이 1곳으로 줄어든다.

```tsx
const stateConfig = {
  idle:        { Icon: AlertTriangle, titleKey: "...", descKey: "...", colorClass: "..." },
  in_progress: { Icon: Loader2,       titleKey: "...", descKey: "...", colorClass: "...", spin: true },
} satisfies Record<"idle" | "in_progress", ...>;
const cfg = stateConfig[reembedStatus];
```

---

### [INFO] Props 인터페이스 이름이 너무 일반적(`Props`)
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L334
- 상세: `interface Props`는 컴포넌트 파일 내 지역 선언이라 동일 파일에서는 충돌이 없지만, 코드베이스 검색이나 IDE 자동완성 시 구체성이 낮다. 기존 다른 컴포넌트들이 `interface XxxProps` 패턴을 따르는지 확인이 필요하다.
- 제안: `interface UnsearchableBannerProps`로 명시적 이름을 부여해 일관성을 높인다.

---

### [INFO] `page.tsx` 배너 게이트에서 `kb &&` 이중 체크
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` L44
- 상세: `{kb && kb.embeddingDimension == null && (...)}` 패턴에서 `kb`를 두 번 참조한다. 코드베이스가 TypeScript strict 모드라면 `{kb?.embeddingDimension == null && kb && (...)}` 또는 optional chaining 을 활용할 수 있다. 단 `== null`은 `null | undefined` 양쪽을 잡으므로 의미상 의도적인 선택이며, RESOLUTION.md #7에서 no-op 처리되었다. 단순히 `kb &&` 중복을 줄이는 방향(`kb != null && kb.embeddingDimension == null`)은 가독성 향상이다.
- 제안: `kb != null && kb.embeddingDimension == null` 또는 `kb?.embeddingDimension === null`(undefined 제외 의도 시) 으로 단순화 고려. 기능 영향 없음.

---

### [INFO] i18n 딕셔너리 키 네이밍 혼용: `reembed*` vs `reembedding*`
- 위치: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts` L638–644
- 상세: `reembeddingRequired`, `reembeddingInProgress`(동명사 형태)와 신규 추가된 `reembedNow`(동사 원형 형태)가 혼용된다. 또한 `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc`는 prefix 패턴이 일관적이어서 양호하나, 기존 `reembedStarted`, `reembedFailed`, `reembedTooltip`과 prefix가 같은 `reembedNow`는 그 계열에 자연스럽게 편입된다. 신규 키 3개는 기존 패턴과 충분히 정합적이라 큰 문제는 아니지만, 미래 키 추가 시 `reembed*` vs `reembedding*` 선택 기준을 명시하면 좋다.
- 제안: 딕셔너리 파일 상단에 네이밍 컨벤션 주석(또는 관련 spec 주석)을 짧게 추가하거나 현상 유지 + 이후 신규 키는 동사 원형(`reembed*`) 계열로 통일한다.

---

## 요약

변경 범위는 `UnsearchableBanner` 단일 presentational 컴포넌트 + 배선 3줄 + i18n 키 3종으로 매우 작다. 컴포넌트는 단일 책임(상태 표시)을 잘 준수하고, JSDoc이 충실하며, RoleGate 분리 패턴도 코드베이스 관행에 맞다. 유지보수성 관점에서 주요 위험은 없다. `inProgress` 분기가 4곳에 산재해 있어 상태 확장 시 shotgun surgery 위험이 잠재하며, 인라인 조건부 클래스 문자열이 다소 길지만 현 수준(2-state)에서는 허용 범위 내다. i18n 키 네이밍 혼용은 미래 키 추가 시 일관성 유지를 위한 경미한 주의 사항이다.

## 위험도

NONE

---

STATUS: SUCCESS
