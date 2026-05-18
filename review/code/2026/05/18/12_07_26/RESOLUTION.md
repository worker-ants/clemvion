# RESOLUTION — 알림 생성 시각 + 브라우저 타임존 표기

대상 PR: `worktree-notif-timestamp-display-a4b2c1` branch
관련 리뷰: [`maintainability.md`](./maintainability.md)

## 조치 항목

| ID | Severity | 조치 commit | 내용 |
| --- | --- | --- | --- |
| W1 | Warning | `53add6fc` | `<time title>` 의 `formatDate("iso")` 호출을 `notif.createdAt` 원본 ISO 사용으로 단순화 (`sidebar.tsx`). |
| W2 | Warning | `53add6fc` | GMT 부호 매칭 정규식의 리터럴 U+2212(`−`) 를 Unicode escape `−` 로 변환 + 주석으로 의도 명시 (`date.test.ts`). |

Critical 발견 0건. Warning 2건 모두 같은 commit 에서 해소.

## TEST 결과

| 단계 | 결과 |
| --- | --- |
| lint | `cd codebase/frontend && npm run lint` — 통과 (clean output). |
| unit test (전체) | 첫 commit 직후: 123 files / 1495 tests 통과. 리뷰 조치 후 영향 파일 재실행: `npx vitest run src/lib/utils/__tests__/date.test.ts` 24/24 통과. |
| build | `cd codebase/frontend && npm run build` — 통과 (`refactor` commit 후 재실행). |
| e2e | `make e2e-test` — 16/16 suites, 93/93 tests 통과 (1회). 리뷰 조치는 frontend 표시 레이어 + 테스트 정규식 한정 변경이라 backend API/contract/DB 면에 영향 없음 — 재실행 생략. |

## 보류·후속 항목

없음.
