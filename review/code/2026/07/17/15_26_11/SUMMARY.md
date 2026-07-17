# Code Review 통합 보고서

*검토 범위: 회귀 테스트 2건의 전제 단언 추가 + 주석 정정. **프로덕션 코드 0줄 변경**(`git diff-tree` 재확인). 1개 reviewer(testing) 실행 — 상세는 하단 "라우터 결정".*

## 전체 위험도

**NONE** — Critical 0 / Warning 0. 직전 라운드(`14_56_27`) 지적 2건의 조치가 의도대로 작동하고 **기존 탐지력을 약화시키지 않음**이 격리 worktree 독립 mutation 으로 전부 실측 확인됐다. 프로덕션 코드 무변경.

**워크트리 위생**: 격리 worktree 에서 mutation 수행 후 제거. 잔재 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 발견사항 |
| --- | --- |
| 1 | **퇴화 탐지 확인**: 두 겹침 테스트에서 각각 `document.referrer` 설정만 정밀 제거 → 둘 다 `expected 'streaming' to be 'blocked'` 로 실패. 두 테스트를 **동시에** mutate 하고 전체 44건 실행 시에도 **정확히 이 2건만** 실패(나머지 42건 green) — 테스트 격리도 함께 확인. |
| 2 | **탐지력 유지 확인**: 네 잘못된 설계를 원본 커밋(`e195a448c`/`0d6128c74`/`f4785a953`)의 **정확한 코드**로 재도입 → 실패 수 **4/3/2/5** 로 직전 라운드(전제 단언 추가 **전**)와 정확히 동일. **스택트레이스까지 대조**해, 이 네 mutation 에서 신규 전제 단언은 한 번도 발동하지 않고(전제가 항상 참) 탐지는 여전히 기존 `hookPosts` 최종 단언이 담당함을 확인 — **새 단언이 기존 탐지 경로를 가리지 않는다**. |
| 3 | **주석 정확성 확인**: 정정된 주석의 세 주장(①혼합 순서 테스트는 `bootGenRef` 재도입에 통과 ②겹침 케이스 중엔 신규 거울상 테스트만 단독 탐지 ③순차 테스트가 스위트 전체에서 독립적으로 같은 결함을 잡음)이 실측 결과와 정확히 대응. |
| 4 | **잔존 사각지대**: 이번 delta 가 새로 만든 갭 없음. 유일한 잔존 갭(config 확립~리셋 소비 사이 **동기 구간 불변식** 미테스트)은 이미 `14_56_27` 에서 식별·이월된 것으로 이번 범위 밖. |
| 5 | `channel-web-chat` 전체 스위트 **376건 재실행**으로 회귀 없음 확인. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | NONE | 4개 질의 전부 격리 worktree 독립 실측. 두 테스트가 퇴화를 탐지하고, 네 잘못된 설계 탐지력이 **4/3/2/5 로 유지**됨을 스택트레이스까지 대조 확인. |
| side_effect | NONE | `bootGenRef` 3줄 surgical 재도입으로 독립 재현 → 정확히 2건 실패(testing 보고치와 일치). **스택트레이스 대조로 신규 단언이 기존 탐지 메커니즘을 가리지 않는 순수 부가(monotonic) 관계임을 실측 입증**. 8개 부작용 축 전부 해당 없음. INFO 6. |
| security | NONE | 세션 위생 3축(옛 토큰 storage 잔존·무효 토큰 스트림·세션 폐기 권한)을 코드 재추적으로 독립 재검증 — 전부 안전. 과거 `09_36_01` 이 지적한 "부팅 중 리셋 시 storage 부활" 창이 **실제로 닫혔음** 확인. 이번 델타가 오히려 **임베드 origin allowlist fail-open 회귀를 잡는 테스트 사각지대를 메웠다**고 평가. INFO 5. |
| requirement | NONE | RESOLUTION 주장을 mutation 2종으로 독립 재현(referrer 제거 → 퇴화 탐지 / `bootGenRef` 재도입 → 2건 실패). **과거(`02_31_18`) 유형의 RESOLUTION 과대 주장이 재발하지 않음** 확인. spec 3종(`1-widget-app §3.1/§3.2`·`3-auth-session §3.1`·`4-security §3-①`)이 구현과 line-level 일치, `3-auth-session` "200+종료 구현됨" 정정의 **경계 범위가 정확**함을 코드로 재확인. INFO 5. |
| documentation | NONE | INFO 5. |
| maintainability | NONE | INFO 4 — 신규 전제 단언이 **이 파일이 이미 확립한 컨벤션의 재사용**(새 관용구 신설 아님), 리드 코멘트 정정은 **순수 문서 부채 축소**. 주석 밀도 누적 추세는 이번 diff 가 만든 문제가 아닌 파일의 구조적 특성으로 기록. |
| scope | NONE | 범위 이탈 없음 — "이번 diff 가 만든 게 아닌" 기존 테스트를 함께 고친 것도 정당하다고 판정. |

## 라우터 결정

- router 미실행. **`agents_forced` 화이트리스트 7명 전원 실행**(`documentation` · `maintainability` · `requirement` · `scope` · `security` · `side_effect` · `testing`).
  - **미실행(7명)**: `api_contract` · `architecture` · `concurrency` · `database` · `dependency` · `performance` · `user_guide_sync` — `agents_forced` 밖이며, 델타가 테스트 단언 + 주석(프로덕션 `git diff-tree` 0줄)이라 해당 축의 검토 실익이 없다고 main 이 판단.
  - **한계 명시**: router 의 의미 기반 판단이 아니라 main 의 수동 선별이다. 미실행이 "그 관점에서 깨끗함"을 뜻하지 않는다.
  - **정정 기록**: 이 세션은 초기에 `testing` 1명만 실행했다 — **`agents_forced` 는 선별로 우회할 수 없는 강제 목록**인데 이를 어긴 것이었고, push 가드(`_forced_coverage_missing`)가 정확히 그 미제출을 잡아 차단했다. 나머지 6명을 같은 세션에 채워 커버리지를 충족했다.

---

**이 라운드로 `pendingResetRef` 결함 클래스 추적을 종결한다** — Critical 0 이 7라운드 연속이고, 프로덕션 동작 변경이 3라운드 연속 0줄이며, 이번 라운드는 발견사항 자체가 없다. 남은 이월(동기 구간 불변식 · `applyConfig` single-flight · cross-endpoint 번짐 · 미리보기 BLOCKED 안내)은 전부 **오늘 도달 불가**로 확인됐거나 별개 트랙이다.
