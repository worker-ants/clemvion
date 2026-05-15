분석에 필요한 파일들을 충분히 확인했습니다.

---

## Dependency Code Review — $today 제거 + formatDate 통일

### 발견사항

- **[INFO]** `dayjs` 의존성 사용 여부 불명확
  - 위치: `frontend/package.json` L40 — `"dayjs": "^1.11.20"`
  - 상세: 변경된 `date.ts`는 `dayjs` 를 전혀 사용하지 않고 네이티브 `Intl` / `Date` API만 사용한다. `$today` 제거 이전에 `@workflow/expression-engine` 내부에서 `dayjs`로 오늘 날짜를 계산했다면, 패키지 전체에서 더 이상 사용되지 않을 가능성이 있다.
  - 제안: `grep -r "from 'dayjs'\|require('dayjs')" frontend/src packages/` 로 실사용 여부를 확인하고, 미사용 시 `dayjs`를 devDependencies에서 제거 — 약 **12 kB** (gzip) 번들 절감.

- **[INFO]** `"use client"` 지시문이 `date.ts` 전체에 전파됨
  - 위치: `frontend/src/lib/utils/date.ts` L1 — `"use client";`
  - 상세: `useLocaleStore.getState()` 호출이 훅이 아닌 스냅샷 읽기이므로 런타임에는 문제없지만, `"use client"` 지시문이 이 모듈을 import하는 모든 Server Component를 강제로 Client Component로 만든다. `formatDate`·`timeAgo`는 순수 변환 함수이므로 서버에서도 호출 가능한데 이 경계가 차단된다.
  - 제안: 즉시 수정이 필요한 수준은 아니지만, 향후 서버 렌더링이 필요한 맥락이 생기면 `"use client"`를 제거하고 locale을 인자로만 받도록 시그니처를 유지하는 방향을 고려할 것. 현 코드의 `locale?: Locale` 파라미터 설계는 이미 그 방향과 호환된다.

- **[INFO]** `cron-parser` v5 API 전환 확인
  - 위치: `frontend/package.json` L40 — `"cron-parser": "^5.5.0"`, `schedules/page.tsx` L26 — `import { CronExpressionParser } from "cron-parser"`
  - 상세: `cron-parser` v5는 v4 대비 기본 export 제거 및 named export 전환이라는 파괴적 변경이 있다. 현 코드는 `CronExpressionParser` named export를 올바르게 사용하고 있어 문제없다.
  - 제안: 리포지토리의 다른 파일에서 구형 `import cronParser from 'cron-parser'` 패턴이 남아있는지 한 번 확인 권장.

- **[INFO]** `@workflow/expression-engine` 내부 패키지 — 변경 정합성 미확인
  - 위치: `frontend/package.json` L33 — `"@workflow/expression-engine": "file:../packages/expression-engine"`
  - 상세: `expression-constants.ts`에서 `$today`가 제거되고 `$now`가 추가됐다. 그러나 `packages/expression-engine/src/evaluator.ts`의 실제 컨텍스트 주입 코드를 읽기 권한 제한으로 확인하지 못했다. 프론트엔드 상수와 evaluator의 컨텍스트 키가 불일치하면 런타임 오류 없이 `undefined`를 반환하는 조용한 버그가 된다.
  - 제안: `evaluator.ts`에서 `$today` 키워드가 완전히 제거됐는지, `$now`가 실제 UTC ISO 8601 타임스탬프로 주입되는지 확인 필요.

- **[INFO]** 새 외부 npm 패키지 없음 — 의존성 증가 없음
  - 상세: 이번 변경은 외부 패키지를 추가하지 않고 순수 내부 리팩토링으로 구성됐다. `formatDate` 유틸은 기존 `Date` 네이티브 API와 내부 i18n 모듈만 사용하여 번들 크기에 영향을 주지 않는다.

---

### 요약

이번 변경은 새로운 외부 npm 의존성을 일절 추가하지 않았으며, 기존 의존성(`cron-parser` v5, `cronstrue`, `lucide-react`, `sonner` 등)도 기존 버전 범위를 그대로 유지한다. 의존성 관점에서 실질적 위험은 낮다. 단, `dayjs`가 `$today` 제거 후 불필요해졌는지 여부와, `@workflow/expression-engine` 내부 evaluator에서 `$today` 컨텍스트 키가 완전히 제거됐는지 두 가지 확인이 남아있다. `"use client"` 지시문의 모듈 경계 전파는 현재 사용 패턴에서는 문제가 없으나, 서버 렌더링 확장 시 주의가 필요하다.

### 위험도

**LOW**