# RESOLUTION — review/code/2026/06/28/14_44_44

대상 SUMMARY: Critical 0 / Warning 2 (W3 는 본 diff 로 이미 해소).
본 PR 의 변경 범위: **테스트 전용** — flaky 3건 안정화 + viewer RBAC false-negative 교정.
프로덕션 코드(`codebase/**` 비-test) 변경 없음.

## WARNING 처리 내역

### W1 — `needsAttention` autoRefresh 가드 미구현 (status-badge.tsx L149–157)
- **판정: 보류 (본 PR 범위 밖, 기존 코드 결함)**
- 근거:
  1. 본 PR 은 `status-badge.tsx`(프로덕션 코드)를 **변경하지 않는다**. 변경 파일은
     `status-badge.test.tsx`(fake timer 추가)와 `schedules-page.test.tsx` 뿐이다.
  2. 결함은 기존 코드에 `TODO(autoRefresh 가드)` 로 명시되어 있으며, 그 주석 자체가
     "frontend 반영 + backend `EXPIRING_SOON_INTERVAL` 쿼리 변경이 같은 PR 에서
     동기되어야 한다" 며 후속 PR (`plan/in-progress/integration-token-ui-autorefresh.md`)
     로의 **의도적 deferral** 을 적시한다.
  3. spec §2.4·§11.4 준수를 위한 프로덕션 동작 변경 + backend 동기는 flaky 테스트
     수정 PR 의 범위를 벗어나며, 단독 반영 시 사이드바 카운트·attention 목록과의
     불일치를 유발한다.
- **조치: 미반영.** 기존 in-progress plan 으로 추적 중이므로 별도 신규 추적 불필요.

### W2 — `subLabel` 포맷 spec §4.1 불일치 ("next" 누락) (status-badge.tsx L90–92)
- **판정: 보류 (본 PR 범위 밖, 기존 코드/spec 정합 결정 필요)**
- 근거:
  1. 마찬가지로 본 PR 은 `status-badge.tsx` 를 변경하지 않는 기존 결함이다.
  2. 해소 방향이 두 갈래(코드를 spec 에 맞춤 vs spec 을 코드에 맞춤)이며, 어느 쪽이든
     프로덕션 사용자 노출 문자열 또는 spec 본문 변경이라 **project-planner 결정**
     사항이다. developer 단독·flaky-수정 PR 에서 처리 부적절.
- **조치: 미반영.** project-planner 위임 권고로 기록.

### W3 — viewer RBAC `queryByTitle` false-negative
- **판정: 본 diff 로 해소됨.** `queryByRole("button", { name: /^edit|delete$/i })` 로 교정.
  Editor 테스트가 동일 role+name 으로 버튼을 찾으므로 단언이 더 이상 vacuous 하지 않다.

## INFO
모두 비차단. 일부(I5 `addBtns[0]` 의도 표현, I16 JSDoc)는 본 PR 의
`openAddDialog` 주석 보강으로 근거가 명시됨. 나머지 정리성/커버리지 항목은
후속 개선 대상으로 기록만 한다.

## 결론
미해소 2건은 모두 **본 PR 이 건드리지 않은 기존 `status-badge.tsx` 결함**으로,
범위·소유권(spec/backend, project-planner) 사유로 의도적으로 본 PR 에 미포함.
테스트 전용 변경분에 대한 리뷰 위험도는 LOW, 신규 Critical/Warning 0.
