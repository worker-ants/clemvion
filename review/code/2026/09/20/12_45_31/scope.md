# 변경 범위(Scope) 리뷰

## 검증 방법

- `git diff origin/main...HEAD --stat` 로 실제 변경 파일 33개를 프롬프트 파일 목록과 대조 — 일치(드리프트 없음).
- `git log origin/main..HEAD --oneline` 으로 5개 커밋(91a46398a → a8ddcfb32 → 3a0f47a9c → b40b5b98f → 173113c01) 확인 — 코드 커밋 2개(초안 + 1라운드 조치를 다시 뒤집은 2라운드 조치), 산출물 커밋 3개(plan/review).
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 실제 cumulative diff 를 원본에서 재추출 — 프롬프트 인용과 일치. 순 결과는 이전 라운드(round 2) testing/requirement 리뷰가 지적한 `originalNext > patchedAt + 90_000` 트레일링 단언이 **더 이상 존재하지 않음**을 직접 확인(3개 단언: 하한·상한·`getUTCSeconds()===0`만 남음) — `b40b5b98f` 가 그 잔여 창을 제거했다는 RESOLUTION 서술과 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `schedule-cron-flake` 문자열이 더 이상 없음을 `grep` 으로 확인 — 2라운드 RESOLUTION W2("트래커의 시기상조 「해소」 인용을 되돌렸다")가 실제로 반영됐다.
- `plan/in-progress/schedule-cron-flake.md` 의 "## 체크리스트"를 직접 열어 확인 — `/ai-review` 수렴·`--impl-done`·`plan/complete/` 이동 3항목은 여전히 `[ ]`(미완료)로, "해소" 를 과잉 주장하지 않는다.
- 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` — 이 세션 자신의 출력 디렉터리만 untracked).

## 발견사항

없음.

### 근거 요약

1. **핵심 코드 변경**: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 실질 수정은 「D. PATCH cron → nextRunAt 재계산」 단일 `it()` 블록에 국한된다 — JSDoc 추가, 생성 cron 리터럴 교체(`0 10 * * *` → `0 0 1 1 *`), `originalNext` 선언·`not.toBe` 비교 제거, `patchedAt` 캡처 + 3개 시각창 단언 추가. 같은 파일의 다른 케이스(A·B·C·E~J)와 서비스 코드(`schedules.service.ts`)는 diff 에 등장하지 않으며, plan 의 "비대상" 절이 이를 명시적으로 선언하고 실제로 지켰다.
2. **회전-수정 이력의 정합성**: 1라운드 조치(`a8ddcfb32`)가 새로 넣었던 `originalNext` 기반 대체 단언이 2라운드 리뷰(testing/requirement)에서 "같은 클래스의 결함을 형태만 바꿔 재도입했다"는 지적을 받았고, 2라운드 조치(`b40b5b98f`)가 그 단언 자체를 통째로 제거했다 — 이는 스코프 확장이 아니라 같은 스코프(이 `it()` 블록의 비교 로직) 안에서의 반복 수렴이다. 최종 diff(origin/main 대비)에는 중간 단계의 문제적 코드가 남아있지 않다.
3. **plan/tracker 갱신**: `plan/in-progress/schedule-cron-flake.md` 신규 작성, `spec-draft-nullable-notation-followups.md` 체크박스 전환 + 새 백로그 항목 2건(`NAV-WF-02`/`NAV-WF-06` spec 표 불일치, cron 재계산 happy-path 단위 테스트 부재)은 이 작업 중 발견됐지만 **구현하지 않고 planner/developer 백로그로 등재만** 했다 — 프로젝트 컨벤션이 요구하는 "발견 시 조치 아니면 등재" 원칙에 부합하며 기능 확장(over-engineering)이 아니다.
4. **review/consistency 산출물 26건 추가**(`review/code/2026/09/20/{11_54_10,12_17_18}/*`, `review/consistency/2026/09/20/11_21_16/*`): 모두 `CLAUDE.md` 저장 위치 표가 지정한 경로(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`, `review/consistency/<...>/`)에 정확히 위치하며, `/ai-review`·`--impl-prep` 의무 절차의 표준 산출물이다. 실행 코드 변경 없이 리뷰 라운드를 기록하는 문서이므로 "무관한 파일 수정"이 아니다 — 1·2라운드 자체 scope 리뷰도 각각 동일 결론(NONE)을 냈고, 이번 라운드(3라운드, 누적 diff 기준)에서 재검증해도 달라지지 않는다.
5. **포맷팅/주석/임포트/설정**: 신규 임포트 없음, 설정 파일 변경 없음. 추가된 주석(JSDoc·인라인)은 모두 새 단언의 근거(대리 지표가 왜 무너지는지, 옛 값 비교를 왜 완전히 뺐는지)를 설명하는 목적에 정확히 부합하며, 무관한 재포맷팅이나 기존 주석의 임의 삭제는 관찰되지 않는다.

## 요약

이번 diff(origin/main 대비 33개 파일)는 e2e 테스트 「D. PATCH cron」 단일 케이스의 시각-비교 로직 교체(2회의 리뷰 라운드를 거쳐 최종적으로 옛 값 비교를 완전히 제거하고 "새 cron 이 만드는 값인가"만으로 판정)와, 그에 부수하는 plan·tracker·review 워크플로 산출물 갱신으로 정확히 국한된다. 서비스 로직·다른 테스트 케이스·설정·의존성 변경은 없으며, 작업 중 발견된 부수 이슈 2건(spec 표 불일치, 단위 테스트 갭)도 구현이 아닌 백로그 등재로만 처리해 스코프를 지켰다. 이전 라운드의 코드 조치가 재차 수정된 이력이 있으나 이는 같은 스코프 안에서의 수렴 과정이며, 최종 상태에는 문제적 코드가 남아 있지 않음을 직접 확인했다. 스코프 관점에서 지적할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
