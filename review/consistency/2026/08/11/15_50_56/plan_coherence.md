# plan_coherence 검토 (라운드 3, `15_50_56`)

대상 PR: `claude/webchat-apibase-scheme` (`wc:boot` apiBase 스킴 검증 + `4-security.md` §R7 신설 + 표기 정정)

**전제**: 직전 라운드(`15_32_46`)가 낸 WARNING("완료 조건" 표 미반영)·INFO(`#PR` 미치환)는
그 직후 커밋 `99d3e9000`("정정을 한 곳에만 했다 + 내 새 테스트가 vacuous 했다")에서 처분됐다.
본 라운드는 오케스트레이터 지시 4항목을 그 처분 결과에 대해 재검증한다.

## 발견사항

- **[해소 확인 — 문제 없음]** "완료 조건" 표에 새 절 반영
  - target 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` L14-L25 표
  - 관련 plan: 같은 파일 L325-L345 `## \`applyConfig\` 의 조용한 early return` 절
  - 상세: 표가 10행으로 늘었고 마지막 행 `§applyConfig 조용한 early return | 도달 가능성
    실측 후 — 도달 가능하면 dispatch/회귀, 불가하면 주석 고정` 이 그 절과 정확히 대응한다.
    또한 표 바로 아래에 재발 사실 자체가 명시됐다 — `> **이 표를 또 안 고쳤다** (2026-08-11).
    바로 위 문단이 "개수를 문장에 박으면 조용히 거짓이 된다" 고 경고하는데... consistency
    \`15_32_46\` plan_coherence · ai-review documentation 이 **각자 독립으로** 같은 자리를
    짚었다. 경고문이 있는 것만으로는 안 걸린다.` — 지시받은 처분(표 행 추가 + 재발 사실 명시)
    이 그대로 이행됐다. 재지적 불요.

- **[WARNING]** `spec_impact` 가 이 PR/브랜치가 실제로 건드린 spec 파일을 완전히 반영하지 않음 — Gate C 완전성 흠
  - target 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter
    (`spec_impact:\n  - spec/7-channel-web-chat/4-security.md`)
  - 관련: `git diff origin/main -- spec/7-channel-web-chat/` — `2-sdk.md` 도 변경돼 있다
    (`apiBase: string;` 행에 `// API **origin**. 런타임 검증: http(s) 스킴만 허용 — 위반 시
    그 필드만 무시(부팅은 계속). [4-security §1 \`apiBase\` 입력 검증 · §R7](./4-security.md)`
    주석 추가). 이 변경은 우연이 아니라 **의도된 후속 조치**다 — 직전 라운드
    (`15_32_46/cross_spec.md` L14-24)가 "`2-sdk.md` 의 `BootConfig` 타입이 apiBase 스킴 검증을
    참조하지 않는다" 는 INFO 를 냈고, 커밋 `99d3e9000` 커밋 메시지가 이를 명시적으로
    처분했다고 적는다: `- cross_spec INFO: 2-sdk.md 의 BootConfig.apiBase 에 런타임 검증
    상호참조 추가`. 그런데 **같은 커밋에서 plan frontmatter 의 `spec_impact` 는 그대로
    `4-security.md` 한 항목만 유지**했다(`git show 99d3e9000 -- plan/complete/webchat-boot-apibase-scheme-validation.md`
    로 확인 — frontmatter 블록에 diff 없음).
  - Gate C 계약상 문제인가: **기계적 게이트(`spec-plan-completion.test.ts`/`hasValidSpecImpact`)는
    실패하지 않는다** — 판정 기준은 "리스트가 비어있지 않고 모든 원소가 `spec/` 하위 실존
    파일인가" 뿐이며, 실제 git diff 와의 완전성(exhaustiveness) 대조는 하지 않는다
    (`.claude/docs/plan-lifecycle.md §5 Gate C`). 따라서 build 는 통과한다. 다만 Gate C 의
    **취지**("완료 시 spec↔코드 정합 결정을 암묵에 두지 않고 frontmatter 에 명시") 는
    "본 작업이 건드린 spec 파일들" 전량 선언을 의도하며, plan 본문 `## 관련` 절 자신도 이미
    `spec/7-channel-web-chat/2-sdk.md §boot / 4-security.md` 로 두 파일을 모두 언급한다 —
    즉 frontmatter 와 본문이 서로 어긋난다. 이 상태로는 향후 "이 plan 이 어떤 spec 을
    건드렸는가" 를 `spec_impact` 만 보고 역추적하는 감사(예: 특정 spec 파일의 변경 이력을
    plan 단위로 재구성)가 `2-sdk.md` 쪽에서 이 PR 을 놓친다.
  - 제안: `plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter 의
    `spec_impact` 리스트에 `spec/7-channel-web-chat/2-sdk.md` 추가(완료 plan 이므로 재이동
    없이 frontmatter 만 정정 — `complete/` 안에서의 사후 수정은 라이프사이클 위반 아님).

- **[해소 확인 — 문제 없음]** `#PR` 자리표시자 치환
  - target 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` L337
    (` \`wc:boot\` apiBase 스킴 검증(\`d8abc7003\`, \`plan/complete/webchat-boot-apibase-scheme-validation.md\`)이`)
  - 상세: 커밋 메시지(`99d3e9000`)가 `plan_coherence INFO: #PR 자리표시자 → d8abc7003` 로
    명시한 처분과 일치한다. `d8abc7003` 은 실재 커밋(`git log`/`git cat-file -t d8abc7003` →
    `commit`, 이 브랜치 이력 `d8abc7003 fix(webchat): 리뷰 CRITICAL 2건 처분...`)이라 placeholder
    가 아니라 유효한 참조다. `git diff origin/main -- plan/ spec/7-channel-web-chat/` 전체에서
    literal `#PR` 잔존 0건(grep 확인). 재지적 불요.

- **[정보 확인 — 문제 없음]** 완료 plan 의 라운드 회고가 실제 이력과 부합
  - target 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md`
    `## 리뷰 라운드 1 이 잡은 것 (2026-08-11, 15_16_20)` 절
  - 상세: `review/code/2026/08/11/15_16_20/testing.md`(CRITICAL — `mergeBootConfig` 를
    직접 호출하는 단위 6건은 있으나 `bridge.onBoot` 호출부가 그 함수를 부른다는 사실을
    지키는 테스트가 없어, 호출부를 옛 인라인 spread 로 되돌려도 위젯 스위트 204/204 가
    그대로 초록이었다는 실측)와 `review/code/2026/08/11/15_16_20/scope.md`(CRITICAL —
    `owner: developer` 인 plan 이 `project-planner` 위임 없이 `spec/7-channel-web-chat/4-security.md`
    를 직접 고쳤다는 role-경계 위반, `developer/SKILL.md`·`PROJECT.md`·`CLAUDE.md` 인용)
    양쪽 다 완료 plan 의 회고("testing CRITICAL — 내가 아는 형태를 그대로 냈다" /
    "역할 경계 — 이 PR 은 planner 턴을 포함한다") 서술과 사실관계·인용까지 정확히 일치한다.
    `maintainability WARNING`(`safeApiBaseFromQuery` deprecated 별칭의 "기존 호출부 호환"
    근거가 실측 소비처 1곳뿐이었다는 자기 반박)도 이 저장소가 직전 PR(`#1146`)의 `SpecMdFile`
    별칭 지적과 "같은 클래스" 로 스스로 지목한 서술과 부합한다. 재지적 불요.
  - 참고(부수, 별도 조치 불요): `## 역할 경계` 절 말미가 "그래서 절차는 planner 쪽을 따른다:
    `spec_impact` 선언(Gate C) + planner 의 의무 게이트인 `consistency-check` 통과" 라고
    적는데, 이 저장소의 `--spec` 모드 consistency-check(쓰기 **직전** 의무, CLAUDE.md)가
    이 spec 변경에 대해 사전 실행된 흔적은 `review/consistency/**` 에서 찾지 못했다 — 존재하는
    것은 전부 `--impl-done`(사후) 라운드다(`14_11_28`·`14_39_42`·`15_32_46`·본 라운드 메타
    확인). 다만 위 spec_impact WARNING 과 별개로, "사후 impl-done 라운드가 사실상 동등한
    검증을 반복 수행 중" 이라는 점에서 실질적 공백은 아니며 새 항목으로 올리지 않는다(이미
    같은 사안이 `15_16_20/scope.md` CRITICAL 로 제기·처분됐다).

## 요약

직전 라운드(`15_32_46`)가 낸 두 지적(완료 조건 표 미반영 WARNING·`#PR` 미치환 INFO)은
후속 커밋 `99d3e9000`에서 지시대로 정확히 처분됐다 — 표에 새 행이 추가됐고 그 자리에
"경고문이 있어도 재발했다"는 사실이 명시됐으며, `#PR` 은 실제 커밋 해시로 치환됐다. 완료
plan 의 라운드 1 회고는 `review/code/2026/08/11/15_16_20/{testing,scope}.md` 실제 내용과
정확히 일치한다. 새로 발견된 것은 **`spec_impact` 완전성 흠(WARNING)** 하나다 — 이 PR/브랜치는
`4-security.md` 뿐 아니라 `2-sdk.md` 도 건드렸고(그것도 직전 라운드의 cross_spec INFO 를
처분하며 **의도적으로** 추가한 변경), 완료 plan 본문 `## 관련` 절은 두 파일을 모두 언급하는데
frontmatter `spec_impact` 는 `4-security.md` 하나만 선언한다. 기계적 Gate C 게이트는 이 형태의
불완전 선언을 잡지 못하므로(리스트 비어있지 않고 경로 실존이면 통과) build 는 깨지지 않지만,
"본 작업이 건드린 spec 파일 전량 선언" 이라는 Gate C 의 취지와는 어긋나며 향후 spec 단위
plan 역추적 감사에서 이 PR 이 `2-sdk.md` 변경 이력에서 누락될 수 있다. CRITICAL 은 없다.

## 위험도

LOW

STATUS: OK
