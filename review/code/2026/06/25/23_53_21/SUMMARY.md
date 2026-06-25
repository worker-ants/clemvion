# Code Review 통합 보고서

> 리뷰 세션: `review/code/2026/06/25/23_53_21` (대상 `ed31b821`→fix amend `09afad6f`). 처분: `RESOLUTION.md`.

## 전체 위험도
**LOW** — command-queue 스텁 누락 버그픽스. Critical 0. WARNING 1(테스트 견고성, FIXED). 보안/범위/요구사항/side-effect/user-guide-sync NONE.

## Critical
없음.

## 경고 (WARNING) — 처분
| # | 카테고리 | 발견 | 처분 |
|---|----------|------|------|
| 1 | Testing | `indexOf("window.ClemvionChat.q")` 기반 순서 검증 취약(향후 `.q` 다중 참조 시 false-negative) | **FIXED** — `snippet.split("</script>")` 블록 분리 + `QUEUE_STUB_JS` 상수 참조로 구조적 검증 교체. |

## 참고 (INFO) — 처분
- **FIXED**: I-3(테스트 검색 토큰 모호 → QUEUE_STUB_JS 상수 참조), I-4(스텁 리터럴 6곳 복사 → `snippet.ts` `QUEUE_STUB_JS` 상수 추출·export, 테스트가 상수 참조), I-6(spec "§1.4" dangling 참조 → §1·R5 로 정정; §1.4 서브섹션 부재 확인).
- **비이슈/수용**: I-1/I-2(snippet.ts 한 줄 vs MDX 줄분리 포맷 — 마크다운 예시는 가독성용 별 포맷, QUEUE_STUB_JS JSDoc 에 동기화 의무 명시), I-8/I-9(triggerEndpointPath 공개·CSP — 기존 아키텍처 결정, 본 변경 무관).
- **DEFER(별 이슈/기존 known-gap)**: I-5(data-global 재지정 시 스텁 전역명 연동 — 별 plan), I-7(WebChatBootInput.profile 누락 — channel-web-chat-followups 기존 트래킹), I-10(MDX↔buildWebChatSnippet snapshot 동기화 테스트 — 후속), I-11(loaderUrl escapeForScript 테스트 — 서버 생성값, 저위험).
- documentation reviewer: output 미생성(재시도 필요) — user_guide_sync(NONE, KO/EN 4파일 대칭 확인) + 본 SUMMARY 가 문서 변경 커버. 문서 변경은 코드블록 내 스텁 추가뿐(링크/frontmatter 불변).

## 에이전트별
- security NONE(정적 리터럴, XSS 없음) / requirement NONE(known-gap만) / scope NONE / side_effect NONE(||가드, 시그니처 불변) / maintainability LOW(I-4 fixed) / testing LOW(W1 fixed) / user_guide_sync NONE(매트릭스 매칭 0, KO/EN 대칭).

## 권장 조치 → 처분
1. W1: FIXED(블록 분리 검증).
2. I-4: FIXED(QUEUE_STUB_JS 상수).
3. I-6: FIXED(§1.4→§1).
4. 잔여 INFO: 비차단, defer/수용(RESOLUTION).
