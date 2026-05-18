# Maintainability Review — 알림 생성 시각 + 브라우저 타임존 표기

대상 commit: `424cde3d feat(notifications): 알림 항목에 생성 시각 + 브라우저 타임존 표기 추가`

## Findings

### W1 (Warning) — `title` 속성에 `"iso"` 포맷 사용으로 인한 중복·TZ 불일치

- 위치: `codebase/frontend/src/components/layout/sidebar.tsx`
- 상세: `<time dateTime={notif.createdAt}>` 의 `dateTime` 속성과 동일한 ISO 문자열을 `title` 에도 `formatDate("iso")` 호출로 다시 만들어 넣어 중복이고, `"iso"` 분기는 항상 UTC(Z) 를 반환해 본문(`datetime-tz`, 로컬 TZ) 과 hover 툴팁이 다른 시각 표기를 보여 사용자 혼란 유발.
- 제안: `title={notif.createdAt}` 로 단순화 (서버 원본 ISO 그대로). hover 시 절대 시각 확인 가능 + dateTime 속성과 동일 origin 유지.

### W2 (Warning) — 테스트 정규식에서 유니코드 마이너스 부호(U+2212) 리터럴 사용

- 위치: `codebase/frontend/src/lib/utils/__tests__/date.test.ts`
- 상세: `[+\-−]` 안의 `−` 가 리터럴 U+2212 로 삽입되어 있어 ASCII 비-안전이고, 의도(특정 Intl 구현이 `GMT−9` 형식으로 출력) 가 코드만 봐서는 명확치 않음.
- 제안: Unicode escape (`−`) 로 표기하고 주석에 의도 명시.

## Resolution

두 W 모두 동일 commit (`<fix-commit>`) 에서 해소.

- W1 → `title={notif.createdAt}` 로 변경 (sidebar.tsx).
- W2 → 정규식의 리터럴 `−` 를 `−` 로 escape 변환 + 주석으로 의도(ASCII-safety, `GMT−9` 대응) 명시 (date.test.ts).

## TEST 결과

리뷰 조치 후 재실행:

- lint: `npm run lint` — 통과 (clean).
- unit test: `npx vitest run src/lib/utils/__tests__/date.test.ts` — 24/24 통과.
- build: `npm run build` — 통과.
- e2e: 첫 commit 시 1회 통과 (16/16 suites, 93/93 tests). 본 리뷰 조치는 frontend 표시 레이어 / 테스트 정규식 한정 변경이라 백엔드 supertest e2e 의 검증 면(`/notifications/**` API contract, DTO, DB) 에 영향 없음 — 재실행 생략.

## 보류·후속 항목

없음.
