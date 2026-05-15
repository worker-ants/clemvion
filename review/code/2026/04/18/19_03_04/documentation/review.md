### 발견사항

- **[WARNING]** `STATUS_LABEL` 상수가 `getStatusLabel()` 함수로 교체 — 외부 소비자 파괴적 변경(breaking change) 미문서화
  - 위치: `execution-status.ts`
  - 상세: 기존에 `STATUS_LABEL.completed` 식으로 직접 참조하던 코드가 있을 경우 런타임 오류 발생. 변경 이유(i18n 대응)나 마이그레이션 경로가 어디에도 기록되지 않음.
  - 제안: 파일 상단 주석 또는 CHANGELOG에 "STATUS_LABEL → getStatusLabel(status, locale)" 마이그레이션 노트 추가.

- **[WARNING]** `date.ts`의 `formatDate`에서 `"date"` 포맷 분기가 조용히 사라짐
  - 위치: `date.ts` (이전 코드의 `if (format === "date")` 블록)
  - 상세: `"date"` 값을 전달하던 호출자는 이제 묵시적으로 기본 분기로 빠짐. 동작 차이가 없더라도 의도적인 제거인지 실수인지 코드만으로는 판단 불가.
  - 제안: 의도적 제거라면 JSDoc 또는 인라인 주석으로 "date/default가 동일 포맷을 사용" 명시.

- **[WARNING]** `formatDuration`이 두 모듈(`date.ts`, `execution-status.ts`)에 각각 구현되어 동작이 다름
  - 위치: `date.ts:18-24`, `execution-status.ts:40-48`
  - 상세: `date.ts` 버전은 `< 1000ms → ms`, `< 60s → seconds`, 나머지 → minutes+seconds. `execution-status.ts` 버전은 소수점 유지(`2.5s`)가 다르게 처리됨. 중복 구현 의도 불명확.
  - 제안: 두 구현의 사용 목적 차이를 각 파일 JSDoc/주석으로 구분하거나, 단일 구현으로 통합 후 분기.

- **[WARNING]** `"use client"` + Zustand store `.getState()` 직접 호출 패턴 — 문서화 없음
  - 위치: `date.ts:8-10`, `execution-status.ts:29-31`의 `currentLocale()` 함수
  - 상세: React 컴포넌트 외부(일반 유틸 함수)에서 `useLocaleStore.getState()`를 호출. 컴포넌트 리렌더에 반응하지 않으므로 SSR 컨텍스트나 호출 시점에 따라 stale locale 반환 가능. 이 설계 선택이 문서화되지 않아 유지보수자 혼란 야기 가능.
  - 제안: `currentLocale()` 위에 "snapshot read — caller must be re-invoked to pick up locale changes" 수준의 주석 추가.

- **[INFO]** MDX 프론트매터에 `title_en` / `summary_en` 필드 추가 — 기여자 가이드 미존재
  - 위치: 파일 18~39 (전체 `.mdx` 파일)
  - 상세: 새 필드의 존재, 작성 규칙, 누락 시 폴백 동작이 어디에도 설명되지 않음. 신규 문서 추가 시 혼란 야기 가능.
  - 제안: `frontend/src/content/docs/` 하위 `CONTRIBUTING.md` 또는 기존 README에 "문서 번역 가이드" 섹션 추가.

- **[INFO]** `LocaleSync` 컴포넌트 — 역할 설명 없음
  - 위치: `providers.tsx:54`
  - 제안: `<LocaleSync />` 옆에 한 줄 주석("syncs user profile locale to locale store on mount") 추가.

- **[INFO]** `registry.ts`의 re-export 주석이 실제 모듈 경계를 잘 설명함 — 긍정적
  - 위치: `registry.ts` 추가된 주석 블록
  - 상세: "no node:fs/node:path imports, safe for client bundles" 설명이 명확하고 유용.

- **[INFO]** `doc-body-notice.tsx`, `doc-header.tsx`, `locale.ts` — JSDoc/파일 수준 주석 양호
  - 각 컴포넌트의 목적과 제약이 명확히 기술되어 있음.

---

### 요약

전체적으로 i18n 도입이 체계적으로 이루어졌으나, **`STATUS_LABEL` → `getStatusLabel()` 교체**와 **`formatDuration` 이중 구현**처럼 외부 API를 조용히 바꾼 부분에 마이그레이션 문서가 전무하다. `"use client"` 유틸 함수에서 Zustand `.getState()`를 직접 읽는 패턴은 stale locale 리스크가 있음에도 주석이 없어 다음 기여자가 판단하기 어렵다. MDX 프론트매터에 새 필드가 추가됐지만 기여 가이드가 없어 문서 작성 규칙이 비공식적으로 남아 있다. 코드 자체의 완성도는 높지만, **파괴적 변경과 설계 제약을 명시하는 최소한의 주석/문서**가 보완되어야 한다.

### 위험도

**MEDIUM**