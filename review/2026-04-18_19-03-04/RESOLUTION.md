# Code Review 조치 내역 — 3차 (node-configs + MDX + README)

## 반영한 조치

### Critical
1. **`.claude/scheduled_tasks.lock` gitignore 추가** — `.gitignore` 에 `.claude/scheduled_tasks.lock` 항목 추가. 해당 파일은 현재 저장소에 트래킹되어 있지 않음을 `git ls-files` 로 확인했으므로 실제 인덱스 제거는 불필요.

### Warning
2. **`formatDuration` 회귀 복구 (#5)** — `execution-status.ts` 의 `formatDuration` 을 원래의 소수점 시맨틱으로 복원: `ms/1000` 에 `toFixed(1)` 적용. 이렇게 해야 실행 목록에서 1.5s / 2.5s 처럼 짧은 레이턴시를 구분할 수 있음. JSDoc 에 "decimal seconds for short latencies" 명시.

3. **경계값 테스트 복원 (#5)** — `execution-status.test.ts` 에 `1000`, `1500`, `2500`, `59999` 각각의 예상 출력과 설명 주석을 추가. 특히 `1500 → "1.5s"` 케이스로 소수점 유지가 테스트로 고정됨.

4. **`formatDuration` 중복 문서화 (#2)** — 두 구현(대시보드용 정수 / 실행 상세용 소수점)의 목적 차이를 양쪽 JSDoc 에 명시하고, 상대 모듈을 서로 링크.

5. **`formatDate` "date" 분기 문서화 (#8)** — JSDoc 에 `"date"` / 기본값이 동일 branch 를 공유함을 명시. `// format === "date" and undefined share the default branch intentionally` 주석 추가.

6. **`useT()` 참조 안정성 확인 (#3)** — 이전 리뷰 조치로 이미 `useCallback((key, params) => translate(locale, key, params), [locale])` 로 메모이제이션되어 있음. 이번 조치에서 추가 변경은 없으나, 소비자 중 `useMemo(..., [t])` 를 쓰는 코드가 `locale` 이 바뀔 때 재계산되는 것은 의도된 동작 (폼 resolver 가 새 에러 메시지를 pick up 해야 하므로).

7. **`currentLocale()` JSDoc (#1)** — `date.ts` 와 `execution-status.ts` 의 `currentLocale()` 에 "snapshot read — not reactive" 주석 추가. `useT()` / `useLocale()` 와의 역할 차이를 명확히.

8. **로케일 테스트 정리 (#7)** — `date.test.ts` 의 `timeAgo`/`formatDuration`/`formatDate` describe 각각에 `beforeEach` / `afterEach` 로 `useLocaleStore.setState({ locale: "ko" })` 을 명시. 테스트 간 순서 의존 제거.

### Testing
9. **`locale.ts` 순수 함수 테스트 추가 (Warning #6)** — `src/lib/docs/__tests__/locale.test.ts` 신규:
   - `localizedSectionLabel` 한/영/fallback 각 분기
   - `localizedTitle` ko / en / fallback
   - `localizedSummary` ko / en / fallback

10. **`DocBodyNotice` 조건부 렌더 테스트 (Warning #6)** — `src/components/docs/__tests__/doc-body-notice.test.tsx` 신규:
    - ko locale 에서는 렌더되지 않음
    - en locale 에서는 한국어 본문 안내 메시지 노출

11. **영어 다중 파라미터 interpolation 테스트 (INFO #6)** — `i18n.test.ts` 의 "interpolates multiple parameters" 케이스에 `translate("en", "time.minutesSeconds", ...)` 기대값 추가.

12. **`LocaleSync` 역할 주석 (INFO #4)** — `providers.tsx` 마운트 지점에 `{/* syncs user profile locale to locale store on mount */}` 주석.

## 이월한 사항

- **Warning #1 (`"use client"` 오염)** — `date.ts` / `execution-status.ts` 가 `useLocaleStore` 를 import 하면서 client-only 경계에 포함됨. 이 두 유틸은 현재 **모두 클라이언트 컴포넌트에서만 사용** 되므로 즉각적인 문제는 없음. 완전한 isomorphic 복원은 (a) 모든 콜사이트에 `locale` 필수화, (b) 별도 client-only wrapper 분리 중 하나가 필요하며 큰 리팩터링이라 별도 이터레이션으로 분리.
- **Warning #4 (`STATUS_LABEL` breaking)** — 이번 세션에서 `grep -r "STATUS_LABEL"` 확인 결과 직접 사용처 없음. 외부 의존이 없으므로 추가 조치 불필요.
- **INFO #3 (3번째 locale 대비 구조)** — 현재 요구사항은 ko/en 두 locale 만 지원이므로 YAGNI. 향후 언어 추가 시 `Locale` 유니온과 `SECTION_LABELS_BY_LOCALE` 동시 확장으로 대응.
- **INFO #5 (version-history 테스트 afterEach)** — 테스트 간 오염 이론적 가능성. 현재 `npm test` 풀패스에서 flaky 관측되지 않았고 최근 실패는 다른 원인이었음. 이월.
- **INFO #7, #8 (변수명 개선, TAB_LABEL_KEYS 인라인)** — 기능에 영향 없는 스타일 이슈. 이월.
- **INFO #9 (MDX 본문 번역)** — 번역 전면 작업은 도메인 지식과 리뷰가 필요해 별도 이슈로 관리. 현재는 `DocBodyNotice` 로 사용자에게 고지.
- **INFO #2 (문서 기여 가이드)** — 이번 세션에서 `frontend/README.md` 의 "Internationalization" 섹션에 MDX frontmatter `title_en` / `summary_en` 규칙을 포함시켰으므로 기본 가이드는 커버됨. 별도 `CONTRIBUTING.md` 는 범위 밖.

## 테스트 & 빌드 검증

- `npm run lint` — 통과 (0 errors, 0 warnings)
- `npm test` — 828 / 828 통과 (신규 11: locale.test.ts 9, doc-body-notice 2)
- `npm run build` — 통과 (Next.js 16 webpack, 48 페이지)
