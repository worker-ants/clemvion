# 변경 범위(Scope) 리뷰 — webchat-boot-single-flight (23_58_23)

## 사전 재검증 — diff 오염 여부

지시대로 페이로드를 신뢰하지 않고 직접 재검증했다.

```
git merge-base origin/main HEAD  → 29aa918a653a0efb5f792dc7e105c0887f03ef25
git rev-parse origin/main        → 29aa918a653a0efb5f792dc7e105c0887f03ef25   (동일 — merge-base = origin/main)
git diff --name-only $(git merge-base origin/main HEAD)..HEAD   → 28 파일
git diff --name-only origin/main..HEAD                          → 28 파일 (목록 완전 동일, diff 없음)
```

두 목록을 `diff` 로 직접 대조해 바이트 단위로 일치함을 확인했다 — **이번 세션은 오염 없음**(앞선 라운드들의
2-dot 오염 문제가 고정 merge-base 로 해소됐음을 재확인). 28파일 = `CHANGELOG.md` · `widget-state.ts` ·
`widget-state.test.ts` · `use-widget.ts` · `use-widget-eager-start.test.ts` · `spec/7-channel-web-chat/2-sdk.md` ·
신규 plan 2개(`webchat-boot-single-flight.md`, `webchat-command-failure-is-not-termination.md`) · `18_39_11`
코드리뷰 산출물 12개 · `19_46_54` 일관성검토 산출물 8개. 전부 이번 기능(§3(재전송) 구현 + 그 리뷰 사이클)의
직접 산출물이고, 무관 파일은 없다.

브랜치 전체(`origin/main` 대비 18커밋)가 diff 대상이라는 점도 확인했다 — `git log --oneline
$(git merge-base origin/main HEAD)..HEAD` 로 `4503d4955`(plan 착수)부터 `3f55ee000`(검증 근거 최신화)까지
전 커및을 실측했다. 즉 이 payload 는 "18_39_11 이후 델타"만이 아니라 **기능 전체의 누적 diff**다. 아래
평가는 이 전제 위에서, orchestrator 가 지목한 초점(§3 재전송 계약 구현 + 18_39_11 CRITICAL 3건 fix +
문서 정합)에 특히 집중하되 전체 파일을 스코프 관점에서 훑었다.

## 발견사항

- **[INFO]** `§106→§3(재전송)` 41건 치환 — **순수 표기 정정임을 커밋 단위로 직접 검증**
  - 위치: `CHANGELOG.md`(4) · `codebase/channel-web-chat/src/widget/use-widget.ts`(6) ·
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(16) ·
    `plan/in-progress/webchat-boot-single-flight.md`(14) · `spec/7-channel-web-chat/2-sdk.md`(1) —
    `git grep -o '§3(재전송)'` 로 정확히 41건 실측(`review/**` 산하 과거 리뷰 스냅샷 제외).
  - 상세: 이 표기 변경은 2단계로 이뤄졌다 — ①`§106→§110`(39건, 커밋 `d48a48aae`), ②`§110→§3(재전송)`
    (41건, 커밋 `7386acb72`). 두 커밋을 각각 `git show`로 직접 열어 라벨을 포함한 모든 hunk 를
    대조했다. `7386acb72`의 5개 파일(CHANGELOG·use-widget.ts·spec/2-sdk.md 등) 전 hunk 는 **라벨
    토큰 외 단 한 글자도 다르지 않다**(예: `이겨 §110 을 어긴다` → `이겨 §3(재전송) 을 어긴다`). `d48a48aae`
    에서도 라벨을 포함한 hunk 는 전부 순수 치환이었고, 같은 커밋에 섞인 **비-라벨 변경**(예:
    `sessionEstablished()` JSDoc 에 `pendingResetRef` 상호참조 신설, `finalizeEnded` 표 행의
    근거 문장 재작성)은 라벨 hunk 와 분리된 별개 hunk 로 존재해 혼입되지 않았다 — 이 두 변경은
    각각 RESOLUTION.md 의 WARNING 목록("`sessionEstablished()` 불변식 상호참조 없음")에 정확히
    대응하는 정당한 fix 이지 라벨 정정에 편승한 은닉 변경이 아니다.
  - 근거 계보: 이 표기 자체는 `18_39_11 documentation` WARNING("§106 자기참조가 diff 자신의
    frontmatter 삽입으로 드리프트")과 `19_46_54 consistency-check`의 두 체커 충돌(`naming_collision`:
    "행번호 §N 은 저장소 기존 관행" vs `convention_compliance`: "§N=heading 규약과 충돌, `2-sdk.md`
    최대 섹션은 §5") 을 개발자가 직접 판정해("둘 다 부분적으로 맞다") 내린 결론이다 — 즉 이번 라운드가
    임의로 만든 변경이 아니라 **두 개의 독립된 리뷰 메커니즘이 각각 지적한 결함의 필연적 귀결**이다.
  - 제안: 없음 — 검증 결과 순수 표기 정정 맞음. 범위 내.

- **[INFO]** `sendCommand` 비-410 경로의 `teardownSession()` 되돌림(A-6) — 완전 원복 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `sendCommand` catch 블록 (~L669-687),
    `codebase/channel-web-chat/src/lib/widget-state.ts` `RESTORED`/`BOOTED` case (L125-146).
  - 상세: `grep -n teardownSession use-widget.ts` 로 실측한 결과 `sendCommand` catch 블록 안에는
    `teardownSession()` 호출이 없다(정상 종료 경로인 `finalizeEnded` 내부에만 존재, L381). 리듀서도
    `RESTORED`/`BOOTED` 에 `ended` 가드가 없고 `WAITING` 에만 남아 있다 — RESOLUTION.md 가 주장한
    "A-6 전체 순변경 0" 과 코드가 정확히 일치한다. 18_39_11 CRITICAL(requirement) 의 fix 범위와
    정확히 일치하며, 그 이상도 이하도 아니다.
  - 제안: 없음. 범위 내.

- **[INFO]** `use-widget-eager-start.test.ts` 신규/수정 테스트 전량이 문서화된 결함에 1:1 대응
  - 위치: 파일 전체 diff(+786/-5, 828줄 직접 정독).
  - 상세: 신규 `it` 블록 11개(StrictMode 이중 마운트 · resolve 역전 · 대체 시도 종료확정 억제 ·
    flicker 미발생 · startedRef→streamRef 6번째 거울상 · world축 언마운트 회귀 · 비-410 500 보존
    2건 · 지연 getStatus 되감기 방지(C2) · 대체 시도의 진짜 종료 확정(C2 반대축) ·
    unmountedRef 블라인드스팟②)를 각각 plan/RESOLUTION 의 서술과 대조했고, 전부 이름·주석·
    단언이 해당 절과 정확히 대응했다. 기존 테스트 수정 2건(`phase toBe("blocked")` →
    `not.toBe("blocked")`, `hookPosts` 단언 확장)도 plan "A-3" 절이 설계 의미 변화로 명시적으로
    정당화하며, 새 회귀가 아니라 supersede 설계 자체의 필연적 결과다. 무관한 테스트 추가·삭제·
    스킵 없음.
  - 제안: 없음. 범위 내.

- **[INFO]** `plan/in-progress/webchat-command-failure-is-not-termination.md` 신설 — 적절한 트랙 분리
  - 위치: 신규 파일, `owner: project-planner`, `worktree: (unstarted)`.
  - 상세: `sendCommand` 의 `ERROR → phase:"ended"` 자체가 `1-widget-app.md` §2 Form 의 "실패 시
    재제출" 약속과 어긋난다는 잔여 gap을, developer 가 코드로 즉흥 처리하지 않고 별도 planner
    트랙 plan 으로 분리했다(spec 변경을 수반하는 제품 결정이므로 CLAUDE.md 상 developer 는
    `spec/` read-only). `19_46_54 plan_coherence` WARNING("이 plan 하단 산문으로만 두면
    complete/ 이동 시 함께 묻힌다")에 대한 직접 대응이며, frontmatter(owner/worktree/started)도
    규약(plan-frontmatter 가드)을 준수한다. developer 가 자기 판단으로 정책을 결정(A/B/C 중 선택)
    하지 않고 옵션만 제시한 것도 권한 경계 준수.
  - 제안: 없음. 범위 내.

- **[INFO]** `use-widget.ts:1034` — 잔존 trailing-whitespace 전용 빈 줄 (실질 변경에 섞인 포맷팅 잔재)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1034` (언마운트 cleanup, `unmountedRef.current
    = true;` 바로 위).
  - 상세: `git diff --check $(git merge-base origin/main HEAD)..HEAD -- use-widget.ts` →
    `use-widget.ts:1034: trailing whitespace`(실측, exit 2). `Read` 로 직접 확인: JSDoc 마지막 줄
    ("...의미가 깨진다.") 바로 다음 줄이 공백만 있는 빈 줄이고, 그 다음이 `unmountedRef.current =
    true;` 다. 경위: 18_39_11 scope 리뷰가 "`eslint-disable-next-line` 주석이 삭제되고 공백 줄로
    바뀐 채 `unmountedRef.current = true;` 가 끼워 넣어졌다"고 지적했고, plan 진행기록("7번째
    거울상") 이 "주석을 복원했다"고 적어 실제로 `// eslint-disable-next-line react-hooks/exhaustive-deps`
    는 `worldGenRef.current++;` 바로 위에 복원돼 있다(확인). 그런데 그 복원 과정에서 **원래
    주석이 있던 자리에 남았던 공백-전용 줄 자체는 지워지지 않고 잔존**했다 — 즉 지적된 결함(주석
    소실)은 고쳐졌지만 그 결함이 남긴 부산물(빈 줄)은 청소되지 않았다.
  - 영향: 무해 — `npx eslint src/widget/use-widget.ts` 직접 실행 결과 warning/error 0건(이 저장소
    eslint 설정에 `no-trailing-spaces` 류 규칙이 없어 lint 는 통과). 기능·가독성에 실질 영향 없는
    최하위 수준의 포맷팅 노이즈.
  - 제안: 그 빈 줄 삭제(한 줄). 급하지 않으나, 다음에 이 함수 근방을 편집할 사람이 있다면 곁들여
    정리할 것을 권한다.

- **[INFO]** (참고, 이번 라운드 신규 이슈 아님) 18_39_11 scope 리뷰의 "flicker fix 를 plan '실행
  계획' 체크리스트에 소급 반영" 권고가 이번 diff 에도 미반영 상태로 남아 있음
  - 위치: `plan/in-progress/webchat-boot-single-flight.md` "## 실행 계획" 절(A-0~A-6·B-1·spec
    `code:` 확인만 체크박스로 존재) vs "## 진행 기록 — flicker fix..." 산문 절.
  - 상세: 18_39_11 scope 리뷰(`review/code/2026/07/17/18_39_11/scope.md`)가 "필수는 아니나" 라는
    전제로 권고했던 두 항목 중 (1)CHANGELOG 보강은 이후 커밋에서 반영됐으나(현재 CHANGELOG 항목
    2가 정확히 flicker fix 를 서술), (2)"실행 계획 체크리스트에 flicker fix 를 정식 항목으로
    소급 반영"은 이번 diff 에도 여전히 반영되지 않았다. 이 항목은 원 리뷰 자체가 "권고"(필수
    아님)로 명시했고 위험도도 MEDIUM 판정 중 하나였을 뿐이며, 오늘 라운드의 초점(18_39_11
    CRITICAL 3건 + 문서 정합)에 새로 속하는 변경도 아니다 — 새로 발견된 스코프 이탈이 아니라
    이전 라운드의 미해결 권고사항 carry-over 이므로 등급을 올리지 않는다.
  - 제안: 우선순위 낮음. 후속 라운드에서 정리해도 무방.

- **[INFO]** 이전 리뷰 라운드 산출물(`review/code/18_39_11/{RESOLUTION,SUMMARY}.md`)이 이번 diff
  범위 내 최신 커밋(`7386acb72`)에 의해 재수정됨 — 정당성 확인
  - 위치: `review/code/2026/07/17/18_39_11/RESOLUTION.md`, `SUMMARY.md`.
  - 상세: 두 파일은 18_39_11 자체 라운드가 만들었는데, 이후 `fa06a4c2e`·`2057dae4e`·`7386acb72`
    3개 커밋이 각각 검증 근거 갱신·e2e 근거 추가·`§110→§3(재전송)` 라벨 정정을 위해 재차 수정했다.
    이는 "리뷰어의 원본 발견"(concurrency.md·documentation.md 등, **이번 diff 에서 전혀 건드리지
    않음** — 실측 확인)과 "개발자의 처분 기록"(RESOLUTION.md, `developer` 스킬의 명시적 쓰기
    권한 대상)을 구분하는 이 저장소의 기존 패턴과 일치한다 — 리뷰어 원본 산출물은 시점 스냅샷으로
    보존되고, 개발자가 쓰는 처분 로그만 사실 갱신에 따라 계속 편집된다. `SUMMARY.md`(스킬 표상
    code-review-agents 소유)가 developer 커밋으로 수정된 점은 다소 이례적이나, 내용상 검증 사실
    정정(`§110`→`§3(재전송)` 라벨 갱신)뿐이고 판정(CRITICAL 3건·WARNING 목록)은 불변이다.
    같은 커밋이 과거 문서 ~20개에 퍼진 동일 클래스의 `</content>` Write-도구 잔재는 **의도적으로
    손대지 않고 별도 트랙으로 미뤘다**(커밋 메시지에 명시) — 오히려 스코프 절제의 긍정적 신호.
  - 제안: 없음(범위 내). 참고로 기록.

## 요약

`git diff --name-only`(3-dot) 와 (2-dot) 두 목록은 완전히 동일했고(28파일), `merge-base`=`origin/main`
이라 이번 세션은 페이로드 오염이 없다. 지시된 초점인 `§106→§3(재전송)` 41건 치환은 실제 커밋
(`d48a48aae`, `7386acb72`)을 직접 열어 hunk 단위로 대조한 결과 **라벨 토큰 외에는 단 한 글자도
바뀌지 않은 순수 표기 정정**이며, 두 개의 독립 리뷰 메커니즘(18_39_11 documentation WARNING +
19_46_54 consistency-check 의 checker 충돌)이 지적한 결함의 직접적·필연적 귀결이지 임의 확장이
아니다. 18_39_11 이 낸 CRITICAL 3건(A-6 되돌림·지연 getStatus 되감기·JSDoc 유실)의 fix 도 코드
실측 결과 정확히 서술된 범위만 건드렸다(`teardownSession()` 은 catch 블록에서 완전히 사라졌고,
정상 종료 경로에만 남아 있다). 신규 테스트 11건은 전부 특정 문서화된 결함에 1:1 대응하며 무관한
테스트 변경은 없었다. 신설된 `webchat-command-failure-is-not-termination.md` 는 spec 결정이 필요한
gap 을 developer 트랙에서 코드로 즉흥 처리하지 않고 project-planner 트랙으로 올바르게 분리한
사례다. 유일하게 실질적으로 지적할 점은 `use-widget.ts:1034` 에 남은 trailing-whitespace 전용
빈 줄(과거 편집의 부산물이 정리되지 않고 잔존) 하나뿐이며, lint 는 실측상 영향받지 않는다.
전반적으로 이 diff 는 "§3(재전송) 계약 구현 + 그 fix 가 유발한 회귀의 되돌림 + 문서 정합"이라는
의도된 범위를 벗어난 기능 확장·무관한 리팩토링·임포트/설정 변경을 만들지 않았다.

## 위험도

LOW
