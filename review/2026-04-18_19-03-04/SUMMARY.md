# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — i18n 도입 자체는 체계적으로 구현되었으나, 유틸리티 파일의 `"use client"` 오염, `formatDuration` 이중 구현, 런타임 잠금 파일 커밋 등 구조적 위험이 복합적으로 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 빌드/보안 | `.claude/scheduled_tasks.lock` 파일이 변경 목록에 포함됨. 세션 ID(`40eef2d7...`) 및 PID(`87042`)가 노출되며, 이미 만료된 스테일 락이 스케줄 작업을 차단할 수 있음 | `.claude/scheduled_tasks.lock` | `.gitignore`에 `.claude/scheduled_tasks.lock` 추가 후 저장소에서 제거 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `"use client"` 지시어 추가로 기존 isomorphic 유틸이 클라이언트 전용으로 강제됨. 서버 컴포넌트에서 import 시 빌드 오류 발생. 근본 원인은 `useLocaleStore.getState()` 의존성 | `date.ts:1`, `execution-status.ts:1` | `currentLocale()` 헬퍼를 별도 client-only 모듈로 분리하거나, 유틸 함수를 `locale` 파라미터 필수화로 순수 함수로 유지 |
| 2 | 아키텍처 | `formatDuration`이 `date.ts`와 `execution-status.ts` 두 곳에 독립 구현되어 동작이 다름. `date.ts`는 `Math.floor`(정수 초), `execution-status.ts`는 `Number(toFixed(1))`(소수점). 같은 입력(`1500ms`)에서 각각 `"1s"`와 `"1.5s"` 반환 | `date.ts:formatDuration`, `execution-status.ts:formatDuration` | 하나의 구현으로 통합 (전용 `@/lib/i18n/duration.ts` 모듈 권장), 또는 사용 목적 차이를 명확히 문서화 |
| 3 | 성능 | `useT()`가 매 렌더마다 새 함수 참조를 반환할 경우 `useMemo`/`useCallback` 의존성 배열의 `t`가 항상 변경된 것으로 판단되어 메모이제이션이 완전히 무력화됨 | `preview.tsx:70,85`, `node-settings-panel.tsx:188`, `editor-toolbar.tsx:130,143` | `useT()` 내부에서 `useCallback((key, params) => translate(locale, key, params), [locale])` 패턴으로 안정된 참조 반환 보장 |
| 4 | 호환성 | `STATUS_LABEL` 상수 export가 `getStatusLabel()` 함수로 교체됨. 기존 소비자가 `STATUS_LABEL.completed` 방식으로 참조하던 경우 런타임 오류 발생 | `execution-status.ts` | `grep -r "STATUS_LABEL"` 전수 확인 후 미갱신 파일 교체 (side_effect 리뷰어 확인: 현재 직접 사용처 없음) |
| 5 | 동작 변경 | `formatDuration(1000)` 결과가 `"1.0s"` → `"1s"`로 변경되고, `59999ms` 경계값 테스트가 삭제됨. `59999ms`는 이제 `"1m 0s"`로 출력되어 기존 동작 변경 | `execution-status.ts:formatDuration`, `execution-status.test.ts:54` | 변경 의도 명시 후 경계값 테스트 복원 (`1000ms`, `1500ms`, `2000ms`, `59999ms`) |
| 6 | 테스트 | 신규 컴포넌트 및 순수 함수에 대한 테스트 누락: `TabButton`, `DocBodyNotice`, `DocHeader`, `locale.ts`의 `localizedTitle`/`localizedSummary`/`localizedSectionLabel`, `ManualTriggerConfig`, `ChipInput` | 상기 파일들 | 최소 `locale.ts` 순수 함수 3종과 `DocBodyNotice` locale 조건부 렌더링 단위 테스트 추가 |
| 7 | 테스트 | `date.test.ts`에서 스토어 locale 기본값(`ko`)을 암묵적으로 가정. `beforeEach`에서 명시적 설정 없어 다른 테스트가 store 변경 시 flaky 테스트 발생 가능 | `date.test.ts:89` | `beforeEach(() => useLocaleStore.setState({ locale: "ko" }))` 명시적 추가 |
| 8 | 문서화 | `formatDate`의 `"date"` 포맷 분기가 조용히 제거됨. 의도적 제거인지 실수인지 코드만으로 판단 불가 | `date.ts` | 의도적 제거라면 JSDoc에 `"date"/"default"` 동일 동작 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `currentLocale()`의 `getState()` 직접 접근은 비반응적(non-reactive) 스냅샷 읽기. React 렌더 사이클 외부 호출 시 locale 변경이 자동 반영되지 않음 | `date.ts:13-15`, `execution-status.ts:32-34` | 설계 의도로 허용 가능. 단, "snapshot read — re-invoke to pick up locale changes" 주석 추가 권장 |
| 2 | 문서화 | MDX frontmatter `title_en`/`summary_en` 신규 필드에 대한 기여자 가이드 없음. 신규 문서 작성 시 규칙 불명확 | `src/content/docs/**/*.mdx` (18~39) | `content/docs/CONTRIBUTING.md` 또는 기존 README에 "문서 번역 가이드" 추가 |
| 3 | 문서화 | MDX frontmatter 구조의 확장성 한계. 3번째 언어 추가 시 `DocFrontmatter` 인터페이스와 전체 MDX 파일 수정 필요 | `registry.ts:DocFrontmatter` | 현재 2개 로케일이 전체 요구사항이면 YAGNI 관점에서 현행 유지. 향후 `translations?: Partial<Record<Locale, {...}>>` 구조 검토 |
| 4 | 문서화 | `LocaleSync` 컴포넌트 역할 설명 없음 | `providers.tsx:54` | `{/* syncs user profile locale to locale store on mount */}` 주석 추가 |
| 5 | 테스트 | version-history 테스트 4개 파일이 `beforeEach`에서 locale store를 설정하나 `afterEach`에서 복원하지 않아 테스트 간 오염 가능성 존재 | version-history `__tests__/*.test.tsx` | `afterEach(() => useLocaleStore.setState({ locale: "ko" }))` 명시적 추가 |
| 6 | 테스트 | 영어 다중 파라미터 interpolation 테스트 누락 (`translate("en", "time.minutesSeconds", { minutes: 3, seconds: 10 })`) | `i18n.test.ts` | 영어 locale 다중 파라미터 보간 테스트 추가 |
| 7 | 유지보수 | `operation-card.tsx`에서 변수 새도잉 해소를 위해 `t → m`으로 변경되었으나 `m`이 "meta"의 축약임을 직관적으로 파악하기 어려움 | `operation-card.tsx:47,103` | `m` 대신 `opType` 또는 `entry` 같이 용도를 나타내는 이름 사용 |
| 8 | 유지보수 | `TAB_LABEL_KEYS` 상수가 `TabButton` 내부에서만 사용되나 모듈 스코프에 정의됨 | `node-settings-panel.tsx` | `TabButton` 함수 내부에 인라인하여 응집도 향상 |
| 9 | UX | MDX 본문이 여전히 한국어로만 제공되어 영어 사용자 경험 갭 존재. `DocBodyNotice` 배너로 안내하는 점진적 접근은 적절함 | `src/content/docs/**/*.mdx` | 본문 번역 작업 일정을 이슈 트래커에 등록하여 관리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | MEDIUM | `.claude/scheduled_tasks.lock` 커밋 포함 (CRITICAL), `"use client"` 서버 차단, `formatDuration` 중복 |
| security | LOW | `scheduled_tasks.lock` 런타임 식별자 노출, XSS 위험 없음 확인 |
| performance | MEDIUM | `useT()` 참조 불안정 시 `useMemo` 무력화 (HIGH), `"use client"` 아키텍처 위반 |
| architecture | MEDIUM | `formatDuration` 이중 구현 동작 불일치, 유틸리티 레이어 경계 침범 |
| maintainability | MEDIUM | `"use client"` 서버 재사용성 차단, `formatDuration` 중복, API 동작 변경 미문서화 |
| testing | MEDIUM | 신규 컴포넌트 테스트 누락, 스토어 상태 암묵적 의존, 경계값 테스트 삭제 |
| documentation | MEDIUM | breaking change 미문서화, `formatDuration` 이중 구현, `"use client"` 패턴 주석 부재 |
| dependency | MEDIUM | `"use client"` 전파, `formatDuration` 중복, 순환 의존성 위험 |
| concurrency | LOW | `useMemo` deps `t` 참조 불안정 가능성, `getState()` 비반응적 읽기 |
| requirement | MEDIUM | `STATUS_LABEL` breaking change, `"use client"` Server Component 호환성, `currentLocale()` 반응성 부재 |
| side_effect | MEDIUM | `"use client"` Server Component 호환성, `formatDuration` 60초 경계값 동작 변경 |

---

## 발견 없는 에이전트

- **database** — 데이터베이스 관련 변경 없음 (NONE)
- **api_contract** — API 계약 변경 없음, 전적으로 프론트엔드 i18n 작업 (NONE)

---

## 권장 조치사항

1. **[즉시]** `.claude/scheduled_tasks.lock`을 `.gitignore`에 추가하고 저장소에서 제거
2. **[필수]** `date.ts`와 `execution-status.ts`에서 `"use client"` 지시어 및 `useLocaleStore` 직접 의존성 제거 — `currentLocale()` 헬퍼를 별도 client-only 모듈로 분리하거나 `locale` 파라미터를 필수화하여 순수 함수로 복원
3. **[필수]** `formatDuration` 이중 구현 통합 — 단일 구현으로 통합하고 소수점 정책 명확화 (정수 vs 1자리)
4. **[필수]** `useT()` 반환 함수의 참조 안정성 확인 — `useCallback`으로 안정화되어 있지 않다면 `preview.tsx`의 `useMemo` 메모이제이션이 무력화되므로 수정 필요
5. **[권장]** `execution-status.ts` `formatDuration` 동작 변경 의도 명시 및 경계값 테스트 복원 (`59999ms`, `1000ms`, `1500ms`)
6. **[권장]** 신규 컴포넌트 테스트 추가 — `locale.ts` 순수 함수 3종(`localizedTitle`, `localizedSummary`, `localizedSectionLabel`), `DocBodyNotice` locale 조건부 렌더링
7. **[권장]** `date.test.ts` `beforeEach`에 `useLocaleStore.setState({ locale: "ko" })` 명시적 추가, version-history 테스트 `afterEach` locale 복원 추가
8. **[권장]** `STATUS_LABEL` → `getStatusLabel()` 마이그레이션 노트 추가 (JSDoc 또는 CHANGELOG)
9. **[선택]** MDX 문서 번역 기여 가이드 작성 및 `LocaleSync` 컴포넌트 주석 추가