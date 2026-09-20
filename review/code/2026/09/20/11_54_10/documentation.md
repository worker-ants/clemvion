# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 「실측」 인용이 실제 근거가 없는 문서를 가리킨다 — 잘못된 소스 인용이 두 자리에 중복
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:286` (JSDoc `* 읽혔다(실측: \`plan/complete/ssrf-catch-instanceof.md\` 의 e2e 첫 실행)`), `plan/in-progress/schedule-cron-flake.md:21-22` (`**실측** (\`plan/complete/ssrf-catch-instanceof.md\` 의 TEST 결과에 기록): 호스트 09:58 KST 에 돌린 e2e 에서 이 한 건만 실패했고(\`expect(received).not.toBe("2026-09-20T01:00:00.000Z")\`), 10:02 KST 재실행은 366 전부 통과했다.`)
  - 상세: 두 곳 모두 "이 정확한 실패 메시지·09:58/10:02 KST 타임스탬프가 `plan/complete/ssrf-catch-instanceof.md` 에 기록돼 있다"고 인용하지만, 실제로 그 파일(`git log --oneline -- plan/complete/ssrf-catch-instanceof.md` 단일 커밋, 이후 무변경)을 열어 보면 체크리스트 마지막 항목("트래커 해소 + 후속 넷 등재(... `schedule-trigger` e2e 시각 충돌 flake)")에서 후속 항목으로 *등재했다*는 한 줄만 있을 뿐, 인용된 정확한 오류 문자열·타임스탬프·로그 경로는 그 문서 어디에도 없다. 그 상세 실측은 실제로는 `plan/in-progress/spec-draft-nullable-notation-followups.md:4951-4952`("실측(`_test_logs/e2e-20260920-095855.log`: 기대 ≠ `2026-09-20T01:00:00.000Z`, 호스트 09:58 KST). 재실행(10:02 KST)은 366 통과.")와 `review/code/2026/09/20/09_35_16/RESOLUTION.md:27`에 있다. 즉 코드 주석과 새 plan 문서 둘 다 **존재하지만 내용이 뒷받침하지 않는 문서**를 실측의 근거로 지목하고 있다.
  - 이 저장소의 자체 규약(`spec/conventions/review-citations.md` Rationale "왜 소급 정리를 하지 않나")이 정확히 이 실패 형태를 경고한다: "잘못 채운 경로는 bare 인용보다 나쁘다 — 존재하는 **다른** 세션을 가리켜, 읽는 사람이 엉뚱한 근거를 읽게 된다." 이번 케이스가 그 형태다 — `codebase/**` 테스트 주석(§3 "적용" 대상)에 영구적으로 남는 JSDoc 이 향후 이 cron 겹침 로직을 다시 만질 개발자를 잘못된 문서로 보낸다.
  - 제안: 두 인용 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`(해당 라인 또는 트래커 항목)로 정정하거나, 로그 파일 경로(`_test_logs/e2e-20260920-095855.log`, 존재 여부는 로그 로테이션에 따라 달라질 수 있으므로 대신 `review/code/2026/09/20/09_35_16/RESOLUTION.md`를 병기)로 바꾼다. `plan/complete/ssrf-catch-instanceof.md`는 "이 문제가 그 작업 중 실측으로 *발견*됐다"는 문맥(schedule-cron-flake.md 13행)까지는 정확하므로, 그 서술은 그대로 두고 "TEST 결과에 기록" 부분만 정정하면 된다.

- **[INFO]** 모듈 최상단 JSDoc 이 「D. PATCH cron」 케이스의 과거 flake·수정 이력을 언급하지 않는다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:16-30` (파일 상단 `/** e2e: spec/2-navigation/3-schedule.md ... */`)
  - 상세: 파일 전체를 요약하는 최상단 JSDoc 은 "PATCH cron → next_run 재계산"이라는 검증 항목만 나열하고, 그 케이스가 하루 1분 창에서 거짓 실패했었다는 사실이나 비교 방식이 «달라졌는가»에서 «새 cron 이 만드는 값인가»로 바뀌었다는 점은 언급하지 않는다. 필수는 아니다 — 바로 아래(283-290행)의 케이스별 JSDoc 이 이미 그 맥락을 충분히 담고 있다.
  - 제안: 조치 불필요. 굳이 개선한다면 최상단 목록의 해당 항목 옆에 "(cron 겹침 회피 필요, 283행 참고)" 정도의 짧은 포인터를 붙일 수 있으나 우선순위는 낮다.

## 확인했으나 문제 없음

- 새 JSDoc(283-290행)·인라인 주석(298행 `// 매년 1월 1일 — 분 단위 cron 과 겹칠 수 없다`, 312행 `// \`*/1 * * * *\` 의 다음 실행은 늘 다음 분 경계 — 요청 시각부터 60초 안이다(경계·시계 오차로 5초 여유)`)은 그 자체로 명확하고, 바로 아래 코드(`0 0 1 1 *`, `patchedAt - 5_000` / `patchedAt + 65_000` 범위)와 정확히 일치한다 — 오래된 주석(stale comment) 문제 없음.
- `plan/in-progress/schedule-cron-flake.md`는 frontmatter(`spec_impact: none`)·"무엇이 문제인가"·"무엇이 잘못된 비교인가"·"할 것"·"비대상"·"테스트" 섹션이 실제 diff 내용과 정확히 대응한다. "비대상" 절의 "같은 파일의 다른 cron 케이스 — 겹침이 성립하지 않는다(E 는 연 1회, C·G·H 는 값을 비교하지 않는다)"는 실제 테스트 파일의 C(`*/30 * * * *`)·G(`0 6 * * *`)·H(`0 7 * * *`) 케이스가 `not.toBe` 류 비교를 쓰지 않는다는 사실과 일치한다.
- README·API 문서·CHANGELOG·환경변수 문서·예제 코드: 이번 변경은 e2e 테스트 파일의 비교식·cron 리터럴만 바꾸는 테스트 전용 수정이라 해당 없음(서비스 코드·API 계약·설정 변경 없음, plan 자체도 이를 명시).
- `review/consistency/2026/09/20/11_21_16/**` (SUMMARY·checker 5종·meta.json·_retry_state.json)는 harness 가 자동 생성한 시점 기록 산출물이며 `review-citations.md` §3 표가 이를 "인용 규약 대상 아님"으로 명시한다 — 문서화 관점에서 별도 조치 불요.

## 요약

핵심 코드 변경(`schedule-trigger.e2e-spec.ts`)의 JSDoc·인라인 주석 자체는 명확하고 코드와 정확히 일치하지만, 그 주석과 신규 plan 문서(`schedule-cron-flake.md`) 양쪽이 공유하는 "실측 기록 위치" 인용이 실제로는 그 상세를 담지 않은 `plan/complete/ssrf-catch-instanceof.md`를 가리키고 있다 — 진짜 근거는 `plan/in-progress/spec-draft-nullable-notation-followups.md`(및 `RESOLUTION.md`)에 있다. 이는 이 저장소 자신의 `review-citations.md` 가 "bare 인용보다 나쁘다"고 명시적으로 경고하는 실패 형태이며, `codebase/**`에 영구히 남는 테스트 주석에 박혀 있어 다음에 이 로직을 만질 사람을 잘못된 문서로 보낸다. 그 외에는 README/API 문서/CHANGELOG/설정 문서 어느 것도 이번 변경으로 갱신이 필요하지 않고, 나머지 신규 주석·plan 서술은 코드와 정합적이다.

## 위험도

LOW
