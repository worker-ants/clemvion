### 발견사항

---

**[WARNING] `STATUS_LABEL` 제거로 인한 Breaking API 변경**
- 위치: `execution-status.ts`
- 상세: `STATUS_LABEL` (상수 export)가 `getStatusLabel` (함수)로 교체되었습니다. 테스트 파일은 갱신되었으나, 이 상수를 직접 import하는 다른 컴포넌트(execution 목록, 뱃지 등)가 있다면 런타임 오류가 발생합니다.
- 제안: `grep -r "STATUS_LABEL"` 로 전체 사용처를 확인하고, 미갱신 파일이 있으면 `getStatusLabel` 호출로 교체하세요.

---

**[WARNING] 유틸 파일에 `"use client"` 선언 추가**
- 위치: `date.ts:1`, `execution-status.ts:1`
- 상세: 두 파일 모두 환경 독립적(isomorphic) 유틸이었으나 `"use client"` 지시어가 추가되었습니다. Next.js에서 Server Component가 이 모듈을 import하면 번들링 오류가 발생합니다. `useLocaleStore.getState()`는 클라이언트 전용 Zustand store이므로 이 의존성이 근본 원인입니다.
- 제안: `currentLocale()` 헬퍼를 별도 클라이언트 모듈로 분리하거나, 서버 컨텍스트에서는 항상 `locale` 파라미터를 명시적으로 전달하도록 강제하세요.

---

**[WARNING] `currentLocale()`의 반응성 부재**
- 위치: `date.ts:13-15`, `execution-status.ts:32-34`
- 상세: `useLocaleStore.getState().locale`은 Zustand store의 스냅샷 조회(imperative)이므로, 사용자가 언어를 변경해도 이 함수를 통해 렌더링된 값은 자동으로 갱신되지 않습니다. `locale` 파라미터를 생략한 호출 경로(예: 컴포넌트 외부 유틸 호출)에서 stale locale이 유지될 수 있습니다.
- 제안: 컴포넌트 내에서는 반드시 `useT` / `useLocale`로 `locale`을 구독한 뒤 명시적으로 전달하도록 문서화하거나, 파라미터를 required로 변경하세요.

---

**[WARNING] `execution-status.ts` - `formatDuration` 소수점 동작 변경**
- 위치: `execution-status.ts` (formatDuration 함수)
- 상세: 기존 코드는 1–59초 구간을 `"1.0s"`, `"2.5s"` (toFixed(1)) 형태로 표시했습니다. 신규 코드는 `Number(seconds.toFixed(1))`을 translation에 전달하므로 `1.0` → `"1"` (JS 숫자 stringify)이 되어 `"1s"`로 표시됩니다. 단, `2.5`는 `"2.5"`로 유지됩니다. 기존 테스트 `formatDuration(59999) → "60.0s"`는 삭제되었고 경계값 검증이 약해졌습니다.
- 제안: 59,999ms 경계값 테스트를 복원하고, 소수점 정책(항상 정수 vs 1자리)을 명확히 결정해 translation string에 반영하세요.

---

**[INFO] `scheduled_tasks.lock` 파일이 리뷰 대상에 포함**
- 위치: `.claude/scheduled_tasks.lock`
- 상세: 이 파일은 런타임 ephemeral 아티팩트로 `.gitignore`에 추가되어야 합니다. 현재 PID/sessionId가 포함되어 있어 불필요한 변경 노이즈를 생성합니다.
- 제안: `.claude/scheduled_tasks.lock`을 `.gitignore`에 추가하세요.

---

**[INFO] `preview.tsx` - `useMemo` 의존성 배열에 `t` 추가**
- 위치: `preview.tsx` (두 개의 `useMemo`)
- 상세: `t` 함수(useT 반환값)가 올바르게 deps에 추가되었습니다. 그러나 `useT`가 locale 변경 시 새 참조를 반환하는지(안정성) 확인이 필요합니다. `t`가 매 렌더마다 새 함수 참조를 반환한다면 memoization이 무효화됩니다.
- 제안: `useT` 내부에서 `useCallback` 또는 안정된 참조를 반환하는지 확인하세요.

---

**[INFO] 문서 MDX 본문은 여전히 한국어**
- 위치: `src/content/docs/**/*.mdx` (파일 18–39)
- 상세: 모든 MDX에 `title_en` / `summary_en`이 추가되었고, 영어 UI에서는 헤더에 영문이 표시됩니다. `DocBodyNotice` 배너로 본문이 한국어임을 안내하는 것은 적절한 점진적 접근입니다. 다만 영어 사용자 경험에 gap이 남습니다.
- 제안: 이슈를 트래킹하여 본문 번역 일정을 관리하세요.

---

### 요약

이번 변경은 에디터, 사이드바, 버전 히스토리, Transform 노드 설정 전반에 걸쳐 i18n(`useT` 훅)을 일관성 있게 적용한 대규모 작업입니다. 구조 설계(TranslationKey 타입 안전성, `as const satisfies` 패턴, locale-store 기반 자동 감지)는 견고하나, `STATUS_LABEL` → `getStatusLabel` 교체로 인한 잠재적 breaking change와 `"use client"` 지시어가 추가된 유틸 파일이 Server Component에서 사용될 경우 빌드 오류를 유발할 수 있는 점이 요구사항 완전성 측면에서 가장 중요한 위험입니다.

### 위험도

**MEDIUM**