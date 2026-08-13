# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** CHANGELOG.md 가 이번 fix 의 신규 엔트리 외에, 이미 존재하던 **다른 두 개의 무관 기능** 엔트리(`node-cancellation` 계열의 "IE multi-turn resume turn 경계 cancel 가드" · "AI multi-turn resume turn 경계 cancel 가드 + park 짝 전이 lost-update 차단")에도 "소급 정정 (2026-08-14)" 인용구를 끼워 넣는다.
  - 위치: `CHANGELOG.md` (`git diff origin/main...HEAD -- CHANGELOG.md` 상 두 번째·세 번째 hunk, `## Unreleased — AI multi-turn resume turn 경계 cancel 가드 …` 절 앞뒤)
  - 상세: 이번 PR 의 단일 결함(TypeORM `UPDATE/DELETE … RETURNING` 이 `[rows, rowCount]` 튜플인데 행 배열로 오인)이 `updateExecutionStatus` 의 `persisted` 반환값을 통해 이미 병합된 두 개의 이전 기능(cancel 가드)의 "검증됨" 서술을 무효화한다는 것이 근거이며, 대응하는 `plan/in-progress/ie-resume-turn-boundary-cancel.md`·`plan/in-progress/retry-turn-terminal-guard.md` 에도 동일한 배너가 이미 존재해 정합성이 맞는다. 즉 **의도치 않은 변경이 아니라 같은 근본 원인의 정직한 후속 정정**이다 — scope violation 으로 보지 않지만, PR 리뷰어가 "핵심 diff 외에 과거 changelog 서술까지 건드린다"는 점을 인지하도록 기록해 둔다.
  - 제안: 조치 불요. 리뷰 시 이 두 블록이 코드 동작을 바꾸지 않는 문서 정정임을 확인하면 충분.

- **[INFO]** `refactor(test-utils)` 커밋(`__testing__` → `common/__test-utils__/source-scan.*` 로 이동)이 이 PR **직전 라운드 자신이 만든 파일**을 대상으로 하는 후속 정리다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts`, `source-scan.spec.ts` (신규 경로)
  - 상세: 커밋 메시지가 명시하듯 `01_44_03` maintainability WARNING 2(저장소에 이미 `__test-utils__`(2곳)·`__tests__`·`__test__` 가 있는데 네 번째 변종 `__testing__` 을 새로 만들었다는 지적)에 대한 즉시 조치이며, `git diff origin/main...HEAD -- codebase/backend/tsconfig.build.json` 은 순변경 0(추가했다 되돌림)이라 최종 산출물에 무관한 잔여가 없다. 두 "자매 지점 전수" 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)의 카운팅 로직을 공유 유틸로 뽑은 것도 이번 PR 이 도입한 두 가드 자신의 중복을 없애는 것이라 범위 밖 리팩토링이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `review/**`, `review/consistency/**` 하위 신규 파일 117개(6개 코드 리뷰 라운드 + 6개 consistency 라운드 산출물)가 diff 대부분(136개 파일 중 117개)을 차지한다.
  - 위치: `review/code/2026/08/13/{20_36_35,22_45_24,23_07_11,23_27_48,23_46_00}/**`, `review/code/2026/08/14/00_00_44/**`, `review/consistency/2026/08/13/{20_36_36,22_45_25,23_07_12,23_27_49,23_46_01}/**`, `review/consistency/2026/08/14/00_00_45/**`
  - 상세: `review/**` 는 `_prompts/` 만 gitignore 대상이고 `review/code/**`·`review/consistency/**` 는 CLAUDE.md 가 명시한 SoT 저장 위치라 커밋되는 것이 관례다. 이 PR 이 자체적으로 겪은 6라운드 fix↔review 루프의 산출물이라 diff-scope 상 "무관한 파일"은 아니다.
  - 제안: 조치 불요 — scope 위반 아님, 정보 제공 목적.

- 핵심 코드 diff(`codebase/**`, 13개 파일, 909 insertions/45 deletions)는 전부 단일 근본 원인(`UPDATE`/`DELETE … RETURNING` 튜플 shape 오인)의 수정·회귀 가드·e2e 로 수렴한다: 신규 헬퍼(`update-returning-rows.ts`)+그 가드 테스트, 8개 소비 지점(`auth-oauth` 1·`execution-engine` 2·`knowledge-base` 5) 교체, `assert-row-array.ts`/`.spec.ts` 의 역할 분담 문서화(SELECT 전용 명시)와 카운트 갱신(3→1), 신규 `auth-oauth-callback.e2e-spec.ts`. `git diff --stat origin/main...HEAD -- codebase/backend/tsconfig.build.json` 확인 결과 설정 파일 순변경 없음. import 는 전부 실제 호출부에서 소비된다(`updateReturningRows` 사용처 8곳 실측).
- plan 문서 5개(`exec-intake-followups.md`·`ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md`·`spec-update-node-cancellation-shutdown-classification.md`·`update-returning-tuple-shape.md`)는 이번 결함이 소급으로 무효화한 과거 완료 선언에 대한 정정 배너 및 planner 위임 등재로, 실제 `spec/` 변경은 0건이다(developer 권한 범위 내).

## 요약

핵심 코드 변경 13개 파일은 TypeORM UPDATE/DELETE RETURNING 튜플 shape 오인이라는 단일 결함 수정에 정확히 수렴하며 드라이브바이 리팩토링·무관 기능 추가·불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다. CHANGELOG 의 과거 두 항목 소급 정정과 `__test-utils__` 통합 리팩토링은 언뜻 범위 밖으로 보일 수 있으나 둘 다 같은 근본 원인의 직접적 파급(전자) 또는 이 PR 자신이 만든 코드에 대한 같은 세션 리뷰 피드백 조치(후자)로, 문서화된 근거가 확인된다. `review/**` 117개 신규 파일은 프로젝트 컨벤션상 커밋 대상인 리뷰 루프 산출물이라 무관 변경이 아니다. 전체적으로 스코프 이탈 신호는 없다.

## 위험도

LOW
