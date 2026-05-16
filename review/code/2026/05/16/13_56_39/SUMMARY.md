# Code Review 통합 보고서

- 세션: `review/code/2026/05/16/13_56_39`
- 대상: `integration-attention-filter-053b74` worktree — "Attention 가상 필터" 기능 도입 (commits `5cc314cc`·`12631769`·`9f08fdc2`)
- 리뷰어: 13개 (전원 success)
- 총 발견 건수(중복 제거): 30건 (WARNING 14, INFO 16)

## 전체 위험도

**MEDIUM** — 기능 구현 품질은 전반적으로 양호하나, 배너 카운트/단일 행 점프 판정이 현재 페이지 rows 기준으로만 동작해 페이지네이션 환경에서 서버 집계와 불일치할 수 있다. e2e 테스트 커버리지 보강이 필요하다. 보안·동시성·의존성 관점에서 즉각 위험은 없다.

## Critical 발견사항
없음

## 경고 (WARNING) — 처리 상태

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| W1 | Requirement | 배너 카운트·단일 행 점프 판정이 현재 페이지 rows 기준 | spec §2.4 에 "집계 범위 — 현재 페이지 한정" 명문화 |
| W2 | Testing | e2e 에 `?status=attention` 실 DB 검증 부재 | `integration-attention-filter.e2e-spec.ts` 신설 (5 케이스) |
| W3 | Testing | `mostUrgentId` 다중 행 우선순위 검증 누락 | `status-badge.test.tsx` 2 케이스 추가 |
| W4 | Testing | `AttentionBanner` 독립 단위 테스트 없음 | RESOLUTION 에 follow-up — 통합 테스트가 동작 커버 |
| W5 | Testing | `connected + 30d` hides-banner 케이스 누락 | `integrations-page.test.tsx` 케이스 추가 |
| W6 | Architecture | 7일 임계값 양쪽 하드코딩 | backend `EXPIRING_SOON_INTERVAL`, frontend `EXPIRING_SOON_DAYS` 상수 |
| W7 | Architecture | `AttentionBanner` 모듈 분리 | RESOLUTION 에 follow-up — 단일 사용처 |
| W8 | Maintainability | Tailwind 톤 색상 중복 | `ATTENTION_BANNER_TONE` 객체로 추출 |
| W9 | Maintainability | 테스트 날짜 헬퍼 중복 | RESOLUTION 에 follow-up — 세 번째 사용처 시점에 추출 |
| W10 | Side Effect / Scope | 옛 i18n 키 잔존 참조 | `grep -rn` 검증, 외부 참조 0건 |
| W11 | Side Effect | DB 타임존 UTC 가정 | timestamptz 기반이라 안전, e2e 통과로 검증 |
| W12 | Documentation | plan 체크리스트 미갱신 | 갱신 완료 + ai-review 결과 요약 추가 |
| W13 | Documentation | `AttentionBanner` JSDoc 없음 | `AttentionBannerProps` 인터페이스 + JSDoc 추가 |
| W14 | Database | 복합 인덱스 미확인 | RESOLUTION 에 follow-up — 마이그레이션은 자동 가드 대상 |

## 참고 (INFO) — 16건

대부분 RESOLUTION 의 "추후 처리" 표에 정리. 즉시 반영: I7 (rank 매직 넘버 → `ATTENTION_RANK` 상수), I8 (push 강제 단언), I9 (빈 배열 케이스), I10 (7d 경계 케이스).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 즉각 취약점 없음 |
| performance | NONE | memoization·페이지네이션·DB `NOW()` 문제없음 |
| architecture | LOW | 7일 임계값 양쪽 하드코딩 (해소) |
| requirement | MEDIUM | 배너 카운트 페이지 범위 의미 (spec 명문화로 해소) |
| scope | LOW | 범위 내 변경 |
| side_effect | LOW | DB 타임존 / 옛 i18n 키 — 둘 다 검증 |
| maintainability | LOW | 매직 넘버·톤 중복 (해소) |
| testing | MEDIUM | e2e 부재 (신규 spec 으로 해소) |
| documentation | LOW | plan/JSDoc 보강 |
| dependency | NONE | 신규 외부 패키지 없음 |
| database | LOW | OR절 인덱스 — follow-up 추적 |
| concurrency | NONE | 경쟁 조건 없음 |
| api_contract | LOW | Breaking change 없음 |

## 처리 결과

- WARNING 14건 중 11건 자동 fix (W1·W2·W3·W5·W6·W8·W10·W11·W12·W13 + INFO I7/I8/I9/I10)
- W4·W7·W9·W14 는 follow-up — 사유는 `RESOLUTION.md` 의 "추후 처리" 표 참고
- TEST WORKFLOW 재수행 통과 — lint 0 errors · backend 3682/3682 · frontend 1409/1409 · e2e 13 suites / 71 tests
- RESOLUTION.md: `review/code/2026/05/16/13_56_39/RESOLUTION.md`

BLOCK: NO
