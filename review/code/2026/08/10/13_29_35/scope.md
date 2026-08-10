# 변경 범위(Scope) Review

## 재판정 대상

직전 라운드(`13_21_24`) scope WARNING(MEDIUM) — "워크스트림 A(`openStream` 게이트 구조화 리팩터) /
워크스트림 B(`3-auth-session.md` status 정합성 정정)가 한 PR 에 혼재. 신설 plan
(`webchat-reload-rest-error-branches.md`) 자신이 '그 PR 범위 밖' 이라 적어 놓고 같은 PR 에서
그 정정을 수행해 **문서가 자기모순**." 그 RESOLUTION 은 "판정: 유효 — 다만 틀린 것은 행위가 아니라
서술이다" 로 **행위(두 워크스트림을 한 PR 에 묶은 것) 자체는 3가지 완화 요인으로 이미 정당하다고
받아들이고**, 조치는 plan 의 provenance 문단 재작성(자기모순 서술 제거 + 실제 이유 명문화)이었다.
이번 delta 가 그 조치를 실제로 이행했는지, 이행 내용이 스스로 내세운 근거와 사실관계가 맞는지
독립적으로 재검증했다.

## 검증 절차

- `git diff origin/main --stat` 로 브랜치 전체 changeset 39개 파일 재확인 (코드 2 + plan 2 + spec 1 +
  review/consistency 산출물 34).
- `git diff origin/main -- codebase/channel-web-chat/src/widget/use-widget.ts` 직접 열람 —
  워크스트림 A 코드 diff 에 워크스트림 B(REST 오류 분기·spec status) 관련 코드가 섞여 있지 않은지 확인.
- `plan/in-progress/webchat-reload-rest-error-branches.md`·`webchat-usewidget-extraction.md`·
  `spec/7-channel-web-chat/3-auth-session.md` 를 `grep`/`Read` 로 직접 대조.
- `review/consistency/2026/08/10/12_56_30/convention_compliance.md`·`plan_coherence.md`,
  `review/consistency/2026/08/10/13_12_16/plan_coherence.md` 를 열어 plan 문서가 인용하는 CRITICAL/
  WARNING 근거가 실재하는지 확인.

## 발견사항

- **[INFO]** 자기모순 서술은 완전히 제거됐고, 남은 유일한 "범위 밖" 언급은 정정 이력을 서술하는
  메타 문장뿐이다 — 재확인 결과 살아있는 모순 없음.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md:17`
    (`> **왜 그 PR 안에서 고쳤나 — 최초 서술이 "그 PR 범위 밖" 이라고 적었다가 정정했다.**`)
  - 상세: `grep -n "범위 밖"` 을 신설 plan·워크스트림 A plan·spec 파일 3곳에 전수 실행한 결과 매치는
    이 한 줄뿐이며, 그 줄 자체가 "적었다가 정정했다" 는 과거형 서술이라 현재 시점 주장이 아니다.
    직전 라운드가 지적한 "서술 vs 행위 불일치"는 해소됐다.
  - 제안: 없음.

- **[INFO]** provenance 문단의 근거 (a)(b)(c) 세 가지를 각각 독립 실측 대조한 결과 전부 사실과 일치한다.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md:19-23`
  - 상세:
    - (a) "CRITICAL 대상 파일이 그 PR 이 편집 중인 바로 그 파일" — `git diff origin/main -- spec/7-channel-web-chat/3-auth-session.md` 로 확인. 워크스트림 B 는 frontmatter(`status`/`pending_plans`, 게이트 3·13-14)와 §3.1 배너·§R4(게이트 65-69, 103-108)를, 워크스트림 A 는 §R17 "이 가드는 표면 되감기만 막는다..." 문단(게이트 165-175, "호출부의 짝 가드" → "스트림 열기 자체가 막는다"로 정정)을 각각 편집 — **같은 파일의 다른 섹션을 두 워크스트림이 동시에 필요로 하는 것이 사실**로 확인됨.
    - (b) "`--spec` 게이트는 Critical 을 차단한다" — `review/consistency/2026/08/10/12_56_30/convention_compliance.md:19-24`에 정확히 이 파일 frontmatter `status: implemented` 를 겨냥한 CRITICAL 이 실재(`spec-impl-evidence.md §3` 위반, 2026-07-05 이후 1개월 이상 미해소). CLAUDE.md 규약상 `--spec` 게이트가 Critical 을 차단하므로, 이 파일을 건드리는 PR 은 이 CRITICAL 을 안고 갈 수 없다는 주장이 근거 있다.
    - (c) "실제 코드 변경은 frontmatter 한 줄 + Rationale 캐비엇, 세 분기 구현은 신설 plan 으로 이연" — `git diff` 로 재확인: 워크스트림 B 쪽 diff 는 status 값·`pending_plans:` 키·배너 문장 확장·R4 상단 고지 박스뿐이고, `seedWaitingFromStatus` 의 `catch` 분기(REST `404`/`401` 처리)는 이번 diff 에 코드 변경이 없다(`use-widget.ts` diff 전체가 워크스트림 A 전용). 신설 plan 자신도 "위 3개 항목의 구현은 하지 않았다"(`webchat-reload-rest-error-branches.md:87`)를 명시.
  - 제안: 없음 — 세 근거 모두 검증 가능한 주장이었고 전부 참으로 확인됐으므로 추가 조치 불필요.

- **[INFO]** 워크스트림 A 코드(`use-widget.ts`, 테스트)에는 워크스트림 B 관련 코드/문서 변경이
  섞여 있지 않다 — 혼재는 plan/spec 문서 수준에 한정된다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 전체 diff,
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3408`
  - 상세: 직접 `git diff` 로 대조한 결과 `use-widget.ts`의 모든 hunk(`StreamClaim` 타입 도입,
    `openStream` 반환값 변경, 두 호출부 게이트 이전, `useCallback` 의존성 배열 정리)는 워크스트림
    A(`openStream` 게이트 구조화) 단일 목적에 대응한다. 테스트 파일의 유일한 diff(주석 정정)도
    워크스트림 A 관련 회귀 테스트 주석 drift 수정(`ai-review 12_39_25 testing` WARNING 조치)이다.
  - 제안: 없음 — 참고로만 기록.

- **[INFO]** 신설 plan(`webchat-reload-rest-error-branches.md`) 은 분량(90줄)이 크지만, 이는
  워크스트림 B 자체를 이번 PR 에서 구현했기 때문이 아니라 `spec-impl-evidence.md §3` 가 `partial`
  상태에 **실재하는** `pending_plans:` 대상 문서를 요구하기 때문에 발생하는 필연적 부수 산출물이다.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md` 전체
  - 상세: `spec/7-channel-web-chat/3-auth-session.md:13-14` 의 `pending_plans:` 가 이 문서를 가리키므로,
    문서가 존재하지 않으면 frontmatter 정정 자체가 규약을 어긴 채로 남는다. 문서 내용도 "미구현
    항목"·"착수 시 함께 볼 것"·"본 PR 에서 한 것" 세 절로 구성돼 향후 developer 트랙 착수를 위한
    최소 스캐폴딩이며, 실제 구현(코드)은 명시적으로 하지 않았다고 자인한다.
  - 제안: 없음.

- **[INFO]** `webchat-usewidget-extraction.md`(워크스트림 A 소유 plan)에 신설 plan 을 가리키는
  순서-주의 상호참조가 추가됐다 — 무관한 편집이 아니라 두 plan 이 같은 함수(`seedWaitingFromStatus`)
  를 건드릴 예정이라는 실제 의존 관계를 기록한 것이다.
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:162-167`
  - 상세: "그쪽은 `seedWaitingFromStatus` 의 `catch` 에 `404`·`401` 분기를 넣는 작업이고... 이
    slice 는 그 함수를 훅으로 **추출**한다" — 두 워크스트림이 미래에 동일 함수를 편집할 것이므로
    순서 충돌을 미리 문서화한 것으로, scope 관점에서 오히려 바람직한 실무 관행이다.
  - 제안: 없음.

## 재판정 결론

직전 라운드가 지적한 결함은 "행위"가 아니라 "서술의 자기모순"이었고, 이번 delta 는 그 서술을
정확히 정정했다. 정정된 서술이 내세우는 세 근거(같은 파일 동시 편집 필요·`--spec` 게이트의 Critical
차단·실제 diff 는 문서/메타데이터 한 줄 수준)를 코드 diff 와 consistency-check 산출물로 각각
독립 대조한 결과 전부 사실과 일치했다. 워크스트림 A 의 실제 코드(`use-widget.ts`, 회귀 테스트)에는
워크스트림 B 요소가 전혀 섞이지 않았고, 워크스트림 B 는 spec/plan 문서 수준(frontmatter 한 줄 +
Rationale 캐비엇 + 신설 plan 스캐폴딩)에 국한되며 구현은 명시적으로 이연됐다. **최소 조치는
충분하다** — 추가 분리(PR 재구성)나 추가 서술 정정을 요구할 근거를 찾지 못했다. 다만 두 독립
동기(유지보수성 리팩터 vs spec 정합성 정정)가 한 changeset 에 묶여 있다는 사실 자체는 남으며, 이는
결함이 아니라 이미 검증된 근거로 정당화·문서화된 트레이드오프로 기록해 둔다.

## 요약

이번 delta 는 직전 scope WARNING 이 요구한 정확한 최소 조치(자기모순 서술 제거 + 실제 이유 3가지
명문화)만 수행했고, 그 서술이 사실과 부합함을 코드·consistency 산출물 직접 대조로 재확인했다.
워크스트림 A 코드에 워크스트림 B 요소가 유입되지 않았고, 워크스트림 B 는 규약(`spec-impl-evidence.md
§3`)이 요구하는 최소 문서 작업에 그쳤다. 새로운 범위 위반·불필요한 리팩토링·무관한 수정·포맷팅
혼입은 발견되지 않았다.

## 위험도

LOW
