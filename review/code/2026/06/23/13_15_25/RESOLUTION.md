# RESOLUTION — 웹채팅 콘솔 증분 2 코드 리뷰 (위젯 co-deploy + 라이브 미리보기)

대상 SUMMARY: `review/code/2026/06/23/13_15_25/SUMMARY.md` (Critical 0, WARNING 13, INFO 다수).

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W-1 | postBoot targetOrigin `"*"` 폴백 | !widgetOrigin 시 전송 건너뜀(early return), targetOrigin=widgetOrigin |
| W-2 | onMessage origin 검증 widgetOrigin 빈 시 skip | `widgetOrigin || location.origin` 으로 폴백 검증 |
| W-3 | iframe sandbox allow-scripts+allow-same-origin | same-origin 1st-party 위젯이라 필요 — 트레이드오프 주석 |
| W-4 | getWidgetOrigin 테스트 전무 | widget-base.test 4 케이스(CDN·self-origin·SSR 빈·SSR override) |
| W-5 | 외형 변경 boot 재전송 미검증 | live-preview.test rerender 재전송 케이스(재마운트 없음 확인) |
| W-6·7 | README 에 env·build:widget 누락 | README Deployment 에 NEXT_PUBLIC_WIDGET_CDN_BASE + build:widget 절 추가 |
| W-8 | plan Phase 3 체크박스 | `[x]` 갱신 |
| W-9 [SPEC-DRIFT] | §6.1 step5 "재마운트" vs 구현 "boot 재전송" | spec §6.1 step5 를 구현(외형=재전송, instance/locale=재마운트) 반영 |
| W-10 | postBoot eslint-disable | useCallback([widgetOrigin, bootConfig]) — eslint-disable 제거, status 리셋은 렌더-중 처리 |
| W-11 | getWidgetOrigin 복잡도 | `new URL(getWidgetBase()).origin` 단순화 |
| W-12 | copy-widget non-atomic | 빌드타임 전용·서빙 중 미실행 주석 |
| W-13/INFO | copy-widget env spread·main 가드 | env passthrough 사유 주석(pnpm 빌드 PATH 필요, 로그 비노출) |
| INFO-1 | 미사용 waitFor import | 제거 |

## TEST 결과

- **lint**: 통과 (`_test_logs/lint-20260623-133112.log`) — 리뷰 fix 과정에서 발견한 react-hooks 위반
  (ref-during-render·set-state-in-effect) 도 렌더-중 reset 패턴으로 해소.
- **unit**: 통과 (`_test_logs/unit-20260623-133445.log`) — web-chat 타깃 5 files / 36 tests passed.
  - **관찰(내 변경 무관)**: `schedules-page.test.tsx` RBAC roundtrip 가 전체 220-file 실행에서 간헐 실패
    ("multiple Add Schedule buttons" = DOM cleanup flake). 격리 실행·web-chat 과 pairwise 실행 모두 통과,
    재실행 시 통과 → **pre-existing random flake**(schedules 테스트 자체 cleanup 취약), web-chat 변경과 무관.
- **build**: 패키지 빌드 통과 (frontend `next build` ✓, `/web-chat` 라우트). co-deploy 스크립트(`build:widget`)
  실측 검증(artifacts 복사 확인). **docker 이미지 빌드는 환경 차단**(`DeadlineExceeded`).
- **e2e**: 환경 차단 (`make e2e-test` docker 이미지 빌드 `DeadlineExceeded`). frontend-only·라이브 미리보기는
  풀스택(백엔드+워크플로우) 의존이라 docker 가용 시에만 e2e 가능.

## 보류·후속 항목

- **user guide (plan Phase 4)**: `/web-chat` 운영 콘솔 user guide(`web-chat.mdx`/`web-chat.en.mdx`) 는
  `user-guide-writer` 로 별도 턴 작성 — 콘솔 전체(미리보기 포함) 완성 후. plan Phase 4 등록.
- **schedules-page flake (pre-existing)**: 본 PR 무관. 별도 grooming 으로 `afterEach(cleanup)` 보강 권장.
- **wc:resize 동적 리사이즈**: 미리보기 iframe 고정 높이(320px) — 후속 증분.
