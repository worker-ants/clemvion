# RESOLUTION — cafe24 mall-dup-ux follow-up B

연결된 리뷰: `review/code/2026/05/16/18_12_12/SUMMARY.md`

## 요약

| 단계 | Critical | Warning | INFO | 비고 |
|------|---------:|--------:|-----:|------|
| ai-review | 0 | 4 | 20 | 본 PR 의 5개 작업 (W9·W11·INFO 10/12/13) 에 대한 리뷰 |
| 본 RESOLUTION | 0 | 0 | 일부 처리 | Warning 4건 + INFO 5건 처리, 나머지 15건 deferred |

## Warning 처리

- **W1 — `saved` definite assignment** ✅ — `let saved!: Integration;` 으로 명시. TypeScript 정적 분석이 첫 try/catch 의 re-throw 보장을 추적할 수 없으므로 `!` 단언으로 미초기화 경고 제거.
- **W2 — stale conflict 배너** ✅ — `useCafe24MallIdPrecheck` effect 진입부에서 `setConflict(null)` 즉시 호출. mallId 변경 시 직전 결과가 350ms debounce 동안 잔존하던 UX 문제 해소.
- **W3 — 12줄 인라인 주석** ✅ — `create()` 의 트랜잭션·audit 의도 주석을 1단락 + spec Rationale 링크로 압축. 프로젝트 규약 (설계 근거는 spec, 코드 주석은 요약 + 링크).
- **W4 — 빈 문자열 mall_id 회귀 테스트** ✅ — `useCafe24MallIdPrecheck` 단위 테스트에 "빈 mall_id 는 fetch skip" 케이스 추가. 패턴 변경 시 빈 문자열 회귀 자동 감지.

## 처리한 INFO

- **I3 — `CAFE24_MALL_ID_PATTERN` 단일 진실** ✅ — hook 에서 export, `page.tsx` `validate()` 가 import. 인라인 정규식 제거.
- **I8 — DEBOUNCE_ADVANCE_MS 적용** ✅ — hook 테스트 파일에도 동일 상수 도입 + 5회 매직 넘버 제거.
- **I14 — hook JSDoc** ✅ — `@param mallId`, `@param enabled` 추가.
- **I15 — error-codes spec ref** ✅ — `INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL` 주석에 spec/2-navigation/4-integration.md §9.4 Rationale 경로 명시.
- **I16 — PRECHECK_DEBOUNCE_MS 역참조** ✅ — "변경 시 테스트 상수도 함께 조정" 주석 추가.

## Deferred (별도 PR / 장기)

| # | 항목 | 사유 |
|---|---|---|
| I1 | audit 실패 메트릭/알럿 계측 | 모니터링 인프라 합의 필요 |
| I2 | postMessage `event.source` 검증 | OAuth 흐름 전반 보안 강화 작업 |
| I4 | TestStep queryKey credentials 미포함 | 별도 캐시 정책 검토 |
| I5 | findAll `getManyAndCount()` 전환 | 별도 성능 PR |
| I6 | AuditLogsService "never throws" 계약 강화 | 별도 안전성 PR |
| I7 | 프로덕션 상수 ↔ 테스트 상수 양방향 동기화 | I8 에서 일부 처리, 완전 동기화는 별도 |
| I10 | NewIntegrationPage 컴포넌트 책임 분리 | 더 큰 리팩토링 |
| I11 | `integration-error-codes.ts` 독립 단위 테스트 | 매핑 2건 이상 시 도입 |
| I12 | audit mock spyOn 방식 | 테스트 스타일 합의 |
| I13 | clearAllMocks / resetAllMocks 정책 명시 | 팀 규약 |
| I17 | validate() i18n 키 단위 테스트 | 통합 테스트가 간접 커버, 별도 보강 |
| I18 | 다른 mutating 메서드에 best-effort audit 적용 | 별도 일관성 PR |
| I19 | integration-error-codes 위치 (api vs integrations) | 현상 유지 |
| I20 | cafe24Extra 조립 함수 추출 | 통합 흐름 리팩토링과 함께 |

## 검증

| 단계 | 결과 |
|-----|------|
| backend lint | 0 errors |
| backend unit test | 3734 / 3734 passed |
| backend build | success |
| frontend lint | clean |
| frontend unit test | 1432 / 1432 passed (+1 from W4) |
| frontend build | success |
| e2e | 79 / 79 passed |
