# 변경 범위(Scope) 검토 — webchat-boot-single-flight (01_44_21)

## 페이로드 청결 확인

```
git diff --name-only $(git merge-base origin/main HEAD)..HEAD   → 53개 파일
git diff --name-only origin/main..HEAD                          → 53개 파일
diff 결과: IDENTICAL
git merge-base origin/main HEAD == origin/main == 29aa918a653a0efb5f792dc7e105c0887f03ef25
```

두 명령의 파일 목록이 완전히 동일하고 merge-base 가 `origin/main` 자체와 같다 — 브랜치가 origin/main 에서
분기한 뒤 origin/main 이 전진하지 않았고, 리뷰 대상 커밋 그래프에 드리프트·의도치 않은 base 오염이 없다.

## 페이로드 대표성 — 중요 한계 (WARNING)

`scope.md` prompt(`_prompts/scope.md`, 739줄)에 실제로 포함된 파일은 **3개뿐**이다:

1. `review/consistency/2026/07/17/19_46_54/plan_coherence.md` (신규 — consistency-checker 산출물)
2. `review/consistency/2026/07/17/19_46_54/rationale_continuity.md` (신규 — consistency-checker 산출물)
3. `spec/7-channel-web-chat/2-sdk.md` (frontmatter `code:` evidence 4줄 추가)

그러나 `origin/main..HEAD` 전체 diff 는 53개 파일이며, 호출자가 "초점"으로 지목한 재설계 커밋
`cffee0d28`(boot 축→sessionEstablished, `codebase/channel-web-chat/src/widget/use-widget.ts` +
`use-widget-eager-start.test.ts`)와 그 주변 코드 변경(`widget-state.ts`, `widget-state.test.ts`,
`CHANGELOG.md`, 신규 plan 파일 2건)은 **payload 에 전혀 포함되지 않았다**. 즉 이 scope 리뷰의 실제
대상(재설계가 의도 밖으로 번졌는지)을 payload 만으로는 판정할 수 없다 — payload 는 review 산출물 2건과
spec frontmatter 소변경만 보여주고, 검증을 요구받은 핵심 코드 diff 는 빠져 있다.

이는 developer 측 scope 위반이 아니라 **prompt 구성 단계의 truncation/선별 문제**로 보인다(과거
`ai-review Workflow router empty`, `Consistency/ai-review Workflow FS-write flakiness` 메모리와 같은
계열의 payload 신뢰성 이슈). 호출자의 명시 지시에 따라 아래는 `git show`/`git diff`로 저장소를 직접
읽어 보완한 결과다 — **payload 미신뢰, 디스크/git 실측 우선** 원칙을 적용했다.

## 재설계(cffee0d28) 직접 검증 — boot 인자 제거 범위

`git show --stat cffee0d28`: `use-widget.ts`(107줄 변경) + `use-widget-eager-start.test.ts`(107줄, 대부분
신규 회귀 테스트 1건 추가) **2개 파일만** 건드렸다. `widget-state.ts`·`host-bridge.ts`·다른 컴포넌트는
touch 없음 — blast radius 가 "no-op 재전송 고착 fix"라는 진술과 일치하는 좁은 범위다.

`cannotApplyConfig`/`isAttemptStale`/`beginBootAttempt`/`bootGenRef` 4개 심볼을 grep 으로 전수 대조:

| 심볼 | 변경 여부 | 확인 |
| --- | --- | --- |
| `bootGenRef` (line 182) | **무변경** | 선언·초기화 그대로. 증가 지점은 `beginBootAttempt` 단 한 곳 |
| `beginBootAttempt` (line 283-284) | **무변경** | `() => ({ world: worldGenRef.current, boot: ++bootGenRef.current })` 로직 동일, 인접 JSDoc 만 갱신 |
| `cannotApplyConfig` (line 296-297) | **무변경** | `(attempt) => unmountedRef.current \|\| bootGenRef.current !== attempt.boot` 그대로 |
| `isAttemptStale` (line 301-304) | **무변경** | `cannotApplyConfig(attempt) \|\| worldGenRef.current !== attempt.world` 그대로 |

`applyConfig` 내부 호출부(line 955-998)를 직접 대조:
- checkpoint 1 (seed 호출 **전**, line 959): `if (cannotApplyConfig(attempt)) return;` — **무변경**, 유지.
- seed 호출(line 987): `seedWaitingFromStatus(clientRef.current, saved)` — 이전엔 3번째 인자로 `attempt`
  (boot 토큰)를 넘겼으나 이제 생략. **이것이 "boot 인자 제거"의 실체다.**
- checkpoint 2 (seed 호출 **후**, openStream **전**, line 998): `if (isAttemptStale(attempt)) return;` —
  **무변경**, 유지. 커밋 메시지의 "checkpoint 2 isAttemptStale 는 소유권 정합용 유지" 주장을 코드로
  독립 재확인했다.

`seedWaitingFromStatus` 자체(line 499-589)의 시그니처가 `attempt?: { boot: number }` →
`opts?: { allowWhileStreaming?: boolean }` 로 바뀌고, 내부 WAITING 게이트가
`if (attempt && cannotApplyConfig(attempt)) return "stale";` → `if (!opts?.allowWhileStreaming &&
sessionEstablished()) return "stale";` 로 교체됐다(신규 `sessionEstablished = () =>
streamRef.current !== null`, line 323). 이 교체는 **`seedWaitingFromStatus` 자신의 내부 게이트에서
`cannotApplyConfig` 호출을 제거**한 것이지, `cannotApplyConfig`/`isAttemptStale` 함수 자체나
`applyConfig` 의 config-적용-경합 checkpoint 를 건드린 게 아니다 — 위 표·checkpoint 대조로 확인.

호출부 3곳의 boot 인자 제거 범위:
1. `start()`(line 619-628 부근): `const bootAtStart = bootGenRef.current;` 로컬 캡처를 삭제하고
   `seedWaitingFromStatus(client, session)` 로 인자 없이 호출. `start()` 는 애초에 `beginBootAttempt()` 를
   호출한 적이 없어(세대를 올리지 않음, 읽기전용 스냅샷만 썼음) `bootGenRef` 증가 로직과는 무관 —
   제거해도 `applyConfig` 쪽 카운팅에 영향 없음.
2. `applyConfig()`: 위에서 확인한 대로 seed 호출에서만 `attempt` 생략, checkpoint 1·2 는 유지.
3. `handleEiaEvent` 의 `replay_unavailable` 폴백(line 429-434): 기존엔 `attempt` 인자를 아예 넘기지
   않아(`attempt` undefined → 옛 게이트 `if (attempt && ...)` 는 자동으로 false, 즉 이 경로는 원래도
   boot 게이트를 안 탔다) 이제 `{ allowWhileStreaming: true }` 를 명시 전달 — 새 기본 게이트
   (`sessionEstablished()`)가 이 자기-스트림-재동기화 경로를 오탐 차단하지 않도록 하는 **필수 대응**이지
   신규 기능 추가가 아니다(기존 동작 보존을 위한 opt-in).

`sendCommand`(line 673 정의)는 이번 diff 의 어떤 hunk 도 그 함수 본문을 건드리지 않았다 — hunk 경계
(`619,13→628,6` 종료 지점과 `979,15→984,17` 시작 지점 사이, `sendCommand` 전체가 그 안에 위치)를 직접
대조해 확인. `beginBootAttempt` 인접 JSDoc 이 "`start()`/`sendCommand`/`seedWaitingFromStatus` 는
`bootGenRef` 축을 쓰지 않는다"고 갱신됐지만 이는 주석 설명일 뿐, `sendCommand` 의 로직 변경이 아니다.

**결론**: "boot 인자 제거가 seed 관련 지점(`seedWaitingFromStatus` 시그니처 + 그 3개 호출부)에만
국한되고 `bootGenRef`/`cannotApplyConfig`/`isAttemptStale`(config 적용 경합용, `applyConfig` checkpoint
1·2)는 건드리지 않았다"는 호출자 가설을 코드 레벨에서 **확인**했다. 반증 없음.

## 페이로드 3개 파일 자체의 범위 검토

- **`plan_coherence.md`/`rationale_continuity.md`**: consistency-checker(`/consistency-check --impl-done`)
  가 `review/consistency/**` 에 산출한 표준 리뷰 산출물이다(해당 skill 의 지정 쓰기 경로와 일치). git
  로그 확인 결과 이 두 파일은 커밋 `7386acb72`(2026-07-17 20:10:09)에서 최초 도입됐고 이후 재변경 없다
  — 이번 라운드가 새로 건드린 게 아니라 기존에 이미 커밋된 산출물이 diff 범위(`origin/main..HEAD`)
  안에 들어와 있을 뿐이다. 내용도 자기 목적(spec-plan 정합·rationale 연속성 검증)에 충실하고 코드 변경
  범위와 무관한 서술은 없다.
- **`2-sdk.md`**: frontmatter `code:` 블록에 `host-bridge.ts`/`use-widget.ts` 증거 링크 + 근거 주석 2줄
  추가뿐, spec 본문(정책·계약 서술)은 무변경. `id`/`status`/기존 `code:` 항목 무손상. §3(재전송) 계약의
  SoT 코드 위치를 명시하는 목적에 정확히 부합하는 4줄 추가로, over-reach 없음.

## 그 외 53개 파일 전수 스캔 (범위 카테고리 확인)

`git diff --name-status origin/main..HEAD` 로 전체를 분류:
- 코드 5개: `CHANGELOG.md`, `widget-state.ts`/`.test.ts`, `use-widget.ts`/`use-widget-eager-start.test.ts`
- plan 신규 3개: `webchat-boot-single-flight.md`(본 작업 plan), `webchat-command-failure-is-not-termination.md`,
  `webchat-usewidget-extraction.md`
- review 산출물 44개: `review/code/2026/07/17/{18_39_11,23_58_23}/**`, `review/code/2026/07/18/00_51_53/**`,
  `review/consistency/2026/07/17/19_46_54/**` — 전부 각 skill 의 지정 쓰기 경로(`review/code/**`,
  `review/consistency/**`) 안.
- spec 1개: `2-sdk.md`(위 서술).

설정 파일(`package.json`/`tsconfig`/`eslint*`/CI yml 등) 변경 **0건** — 항목 8(설정 변경) 위반 없음.
`use-widget.ts` 전체 diff 에서 import 라인 변경 **0건**(`grep '^[+-]import'` 공백) — 항목 7(임포트 변경)
위반 없음.

신규 plan 2건은 오히려 scope 규율의 **긍정 신호**다:
- `webchat-command-failure-is-not-termination.md`(`owner: project-planner`, "미착수 — 결정이 먼저
  필요"): "비-410 명령 실패 = 대화 종료인가" 라는, 이번 재설계와 인접하지만 별개인 제품 결정을
  developer 가 코드로 즉흥 처리하지 않고 CLAUDE.md 의 skill 경계(project-planner 트랙 위임)에 따라
  분리했다. 실제로 파일 자체가 "그 사건(A-6 되돌림)이 이 plan 의 존재 이유 — gap 을 코드에서 즉흥적으로
  메우면 방향을 반대로 잡아도 아무도 못 막는다"고 명시.
- `webchat-usewidget-extraction.md`(`owner: developer`, "미착수. 리팩토링 백로그. 기능 변경 없음"):
  `use-widget.ts` 훅 비대화(merge-base 877줄 → 현재 ~1070줄)에 대한 리팩토링 욕구를 **이번 PR 안에서
  실행하지 않고** 별도 백로그로 명시 이연했다. "불필요한 리팩토링"(항목 2) 유혹을 실제로 피한 사례로
  읽힌다.

`CHANGELOG.md` cumulative diff 는 이번 재설계와 정확히 대응하는 Unreleased 항목 1건 재작성뿐이며
(항목 3 "지연 도착한 getStatus seed 가 화면을 되감지 않는다" = sessionEstablished 서술과 1:1 대응),
무관한 항목 추가 없음. `widget-state.test.ts` diff 는 A-6 되돌림을 고정하는 회귀 테스트 1건(순수 추가)
뿐 — 이는 이미 두 consistency 리뷰(payload 파일 1·2)가 rationale 축에서 상세 검증했으므로 본 리뷰는
범위 축에서만 확인(무관한 diff 혼입 없음, import·포맷팅 변경 없음).

## 발견사항

- **[WARNING]** scope 리뷰 payload 가 실제 diff 의 53개 파일 중 3개만 포함, 검증 요구된 핵심 코드
  (`cffee0d28`)는 payload 밖
  - 위치: `_prompts/scope.md` 전체(739줄) — 리뷰 대상 파일 섹션이 3건뿐
  - 상세: payload 만으로는 이번 라운드 scope 리뷰의 실제 목적(재설계가 no-op 재전송 고착 fix 범위를
    벗어났는지)을 판정할 수 없다. developer 의 scope 위반이 아니라 prompt 구성/truncation 단계의
    문제로 판단되며, 과거에도 유사 payload 대표성 이슈가 이 프로젝트에서 반복 관측됐다. 이번엔 호출자가
    직접 "boot 인자 제거·bootGenRef·cannotApplyConfig" 를 지목해줘 git 실측으로 보완했지만, 이런 명시
    힌트가 없는 일반 scope 라운드였다면 이 gap 이 조용히 통과됐을 위험이 있다.
  - 제안: scope reviewer(및 다른 리뷰어) payload 생성 로직이 "전체 diff 파일 수 vs payload 포함 파일
    수"를 자체 점검해 큰 괴리 시 prompt 안에 명시 경고를 남기도록 개선 검토. 즉각 조치는 불필요(이번
    라운드는 호출자 보완 지시로 커버됨).

- **[INFO]** 재설계(cffee0d28)의 boot 인자 제거는 `seedWaitingFromStatus`(정의 1곳 + 호출 3곳)에만
  국한, config-적용-경합 인프라는 무손상 — 직접 검증 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:182,283-304,499-589,619-660,955-998`
  - 상세: 위 "재설계 직접 검증" 절 참조. `bootGenRef`/`beginBootAttempt`/`cannotApplyConfig`/
    `isAttemptStale` 4개 심볼 전수 grep 대조 결과 로직 변경 0건(JSDoc 갱신만). `applyConfig` 의 두
    checkpoint(seed 전 `cannotApplyConfig`, seed 후 `isAttemptStale`)도 무변경. `sendCommand` 함수
    본문은 이번 diff 의 어떤 hunk 범위에도 속하지 않음(hunk 경계 좌표로 확인). 블라스트 반경은 2개
    파일(`use-widget.ts` + 동반 테스트)로 좁고, 진술된 의도(no-op 재전송이 `bootGenRef` 만 헛되이 올려
    `start()` 를 거짓 stale 처리하던 고착 fix)와 정확히 일치.
  - 조치 불필요 — scope 관점에서 반증 없음.

- **[INFO]** 신규 plan 2건은 "이연"(defer)이지 "확장"(expand)이 아님 — scope 규율의 긍정 신호
  - 위치: `plan/in-progress/webchat-command-failure-is-not-termination.md`,
    `plan/in-progress/webchat-usewidget-extraction.md`
  - 상세: 둘 다 frontmatter/본문에 "미착수"·"기능 변경 없음"을 명시하고 실제 코드 변경을 동반하지
    않았다. 전자는 project-planner 트랙(spec 변경 수반 결정)으로, 후자는 developer 소유 리팩토링
    백로그로 각각 올바르게 분리— CLAUDE.md 의 skill 경계·"불필요한 리팩토링 금지" 원칙을 실제로
    지킨 사례.
  - 조치 불필요.

## 요약

`git diff --name-only` 두 명령(merge-base 기준·origin/main 기준)의 파일 목록은 53개로 완전히 동일하고
merge-base 가 origin/main 자체(`29aa918a6`)와 같아 base 드리프트는 없다. 다만 이번 scope.md 라운드의
prompt payload 는 그 53개 중 3개(consistency 산출물 2건 + spec frontmatter 소변경)만 포함해, 호출자가
검증을 요구한 핵심 대상인 재설계 커밋 `cffee0d28`(boot 축→sessionEstablished)의 실제 코드 diff 는
payload 밖에 있었다 — 이는 WARNING 으로 별도 기록했다. 호출자 지시에 따라 `git show`/`git diff` 로
직접 보완 검증한 결과, "boot 인자 제거가 seed 관련 지점에만 국한되고 `bootGenRef`/`cannotApplyConfig`
(config 적용 경합용, `applyConfig` 의 checkpoint 1·2)는 건드리지 않았는지"라는 질문에 대해 **그렇다**는
결론을 코드 레벨에서 독립 확인했다 — 4개 핵심 심볼(`bootGenRef`/`beginBootAttempt`/`cannotApplyConfig`/
`isAttemptStale`) 전수 대조 결과 로직 무변경, `applyConfig` 의 두 checkpoint 무손상, `sendCommand` 함수
본문은 diff hunk 범위 밖, 블라스트 반경은 정확히 2개 파일(`use-widget.ts`+동반 테스트)로 좁다. 그 외
53개 파일 전수 분류에서도 설정 파일 변경 0건, import 변경 0건, review 산출물 44건은 전부 지정 skill
쓰기 경로 안, 신규 plan 2건은 확장이 아닌 명시적 이연(defer)으로 확인돼 scope 규율을 오히려 강화하는
방향이다. CHANGELOG 갱신도 실제 재설계 내용과 1:1 대응하는 단일 항목 재작성뿐이다. 종합하면 코드
자체의 scope 는 매우 잘 통제돼 있으나, 이번 라운드의 리뷰 프로세스(payload 구성)가 그 사실을 스스로
증명하지 못했다는 절차적 결함이 유일한 실질 지적이다.

## 위험도

LOW
