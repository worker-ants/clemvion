# RESOLUTION — 활동 탭 "연결 안 됨" 배너 (§4.6)

ai-review(`15_03_11`, LOW·C0·W3) + consistency `--impl-done`(`15_03_26`, BLOCK:NO·W2) 의 WARNING 을 조치.

## 조치 항목

| 출처 # | 발견 | 조치 | 파일 |
|---|---|---|---|
| consistency W2 (rationale) | 균일 amber 톤이 status→tone escalation 원칙(error=red)과 어긋남 | 배너 톤을 status-aware 로 — `error`=red, `expired`/`pending_install`=warning(amber). 헤더 StatusBadge 신호와 일치 | `activity-disconnected-banner.tsx` |
| consistency W1 (cross_spec) | 배너가 Inline Alert 패턴(§3.4) 미인용·미등록 | §4.6 bullet 에 [§3.4 Inline Alert] 인용 + 톤 escalation 명시; `0-overview.md §3.4` "현재 사용처" 에 활동 배너 등재 | `spec/2-navigation/4-integration.md`, `spec/0-overview.md` |
| ai-review W2 (documentation) | CHANGELOG 미갱신 | `## Unreleased — 통합 상세 활동 탭 "연결 안 됨" 안내 배너` 추가 | `CHANGELOG.md` |
| ai-review W3 (user_guide_sync) | `integration-management.mdx`/`.en.mdx` Activity 탭 설명 stale | ko/en Activity FieldTable row 에 배너·[상태 확인] 버튼 안내 문장 추가 | `integration-management.{mdx,en.mdx}` |
| ai-review INFO#7 (maintainability) | 배너 `role="status"` 누락(scope-tab 형제와 불일치) | `role="status"` 추가 | `activity-disconnected-banner.tsx` |
| ai-review INFO#1 (requirement) | spec §4.6 "[개요 탭] 이동 버튼" 문구 모호 | "'상태 확인' 버튼(클릭 시 개요 탭 이동)" 으로 명확화 | `spec/2-navigation/4-integration.md` |
| consistency INFO#2 (rationale) | pending_install 포함 근거 교차참조 부재 | §4.6 에 "attention 필터와 다른 축(활동 데이터 부재 사유 설명)" 근거 1줄 추가 | `spec/2-navigation/4-integration.md` |
| ai-review INFO#12 / consistency INFO | expires-soon/error 경계·톤 테스트 부재 | 테스트 보강 — error→red, expired→amber, role=status 단언 추가(6→8 cases) | `__tests__/activity-disconnected-banner.test.tsx` |

## TEST 결과

- lint: 통과
- unit: 통과 (backend 400 suites, frontend 271 files — banner test 8 cases incl. tone/role)
- build: 통과
- e2e: 통과 (backend Jest 249). 본 변경은 frontend-only(백엔드·API 무변경)이며 RTL 단위 테스트로 컴포넌트 로직 전수 커버; backend e2e 는 회귀 없음 확인용.

## 보류·후속 항목

- **ai-review W1 (testing) — ActivityTab wiring 스모크 테스트: 보류(근거 defer).**
  `ActivityTab` 은 `page.tsx` 내부 비-export 로컬 함수라 직접 렌더 테스트 불가(page.tsx 의 non-Page export 는 next build 회귀 #636). wiring 은 2-prop passthrough(`status={integration.status}`, `onNavigate={setTab}`) + 배너를 빈상태·목록 두 분기 위에 얹는 조건부 렌더로 trivial 하고 code-read 로 검증됨. 배너 컴포넌트 자체(모든 status 분기·톤·`onGoToOverview` 콜백)는 RTL 8 cases 로 전수 테스트됨. 이 한 건을 위해 ActivityTab 을 별 파일로 추출하는 것은 본 기능 범위 대비 과함. 향후 ActivityTab 이 필터/정렬 등으로 커지면 추출 시 함께 커버.
- (선택, 별건) dead `statusDisconnected` i18n 키 정리 — 이번 diff 이전부터 미사용, 네임스페이스 달라 실질 충돌 없음.

## 재검토(fresh) 결과 — `review/code/2026/07/10/15_23_40`, `review/consistency/2026/07/10/15_23_40`

조치 커밋(`9acd1d4ca`) 반영 후 fresh `/ai-review` + `/consistency-check --impl-done` 재실행:

- **ai-review: Critical 0 / Warning 0** — 직전 라운드 WARNING 3건 전량 조치 확인, 잔여는 INFO(defer 재확인). (reviewer 4개 disk-write 갭 → journal.jsonl 회수로 `[CRIT]=0 [WARN]=0` 확인.)
- **impl-done: BLOCK: NO** — 톤 escalation·Inline Alert 등재 WARNING 해소. 잔여 WARNING 1건은 **pre-existing 문서 stale**(`INTEGRATION_NOT_CONNECTED` vs `INTEGRATION_INCOMPLETE` — 코드·신규 §4.6 정확, §6/0-common 낡음) → 본 PR 신규 텍스트는 정확하므로 회귀 아님, planner 후속 `task_6f46d7eb` 로 이관(§6/0-common 정정).
- INFO(신규): `onNavigate` prop 명 중복(→ `onTabChange` 통일 검토), Inline Alert ARIA role 관행, hint "다시 연결하세요" pending_install 문구 — 전부 non-blocking, 후속 선택.
