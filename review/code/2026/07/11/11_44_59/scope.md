# 변경 범위(Scope) 리뷰 — eia-client-context-types-33e771

Diff: `1682777fe..HEAD` (2 commits)
- `964e887af` feat(web-chat,sdk): EIA getStatus context 를 클라이언트에서도 닫힌 union 으로 정밀화
- `428134b64` test(docs): spec-link-integrity 가드를 codebase 소스로 확장 + 깨진 링크 14곳 정정

Plan: `plan/in-progress/eia-context-schema-followups.md` (owner: developer) — 4항목 중 항목 2("EIA client 타입의 `context` 정밀화, 2곳: `eia-types.ts` / `packages/sdk/client.ts`")와, 항목 4의 "함께 검토" 서브노트("backend/channel-web-chat 소스의 spec 상대링크를 스캔하는 가드를 추가할지")가 이번 diff 의 두 커밋에 정확히 대응.

## 발견사항

- **[WARNING]** `spec/conventions/spec-impl-evidence.md` §4.2 편집 — developer 역할의 `spec/` write 경계 우회
  - 위치: `spec/conventions/spec-impl-evidence.md` 가드 표 1행 (커밋 `428134b64`)
  - 상세: `CLAUDE.md` Skill 체계 표는 developer 쓰기 권한을 `codebase/**`, `plan/**`, `review/**/RESOLUTION.md` 로 명시하고 `spec/` 은 **read-only** 로 못박는다. 같은 문서에 "구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임" 도 명문 규칙이다. 본 plan 의 frontmatter `owner: developer` 이므로 이 worktree/세션은 developer 역할로 수행 중인데, 커밋이 그 규칙을 우회해 spec 파일을 직접 1줄 편집했다. 커밋 메시지 자체가 "(1) 가드 확장이라는 구현 결정에 종속된 서술 정합화이지 신규 기획이 아니고, (2) subagent write 가 worktree 격리로 막혀 위임 불가하며, (3) impl-done consistency check 가 사후 정합을 검증하므로 main 이 직접 반영" 이라고 self-justify 하지만, 이 예외 조항은 `CLAUDE.md` 본문 어디에도 명시적으로 승인돼 있지 않다. Memory 에 있는 유사 전례("SPEC-DRIFT reflux 로 main 이 spec flip")는 *developer 가 멈춘 뒤 main(오케스트레이터)이* 처리하는 패턴이지, developer 세션이 같은 커밋 안에서 직접 처리하는 패턴은 아니다.
  - 검증: 내용 자체는 정확하다 — 실제 `findBrokenSpecLinksInSources` 구현(roots=`codebase/{backend,channel-web-chat,packages}`, skip=`node_modules/dist/build/.next`, `spec/**.md` 타깃 링크만 스캔)과 표의 새 서술이 1:1로 일치. 오기재나 과장은 없음.
  - 제안: 머지 전 `project-planner` 또는 사용자의 사후 확인(승인)을 명시적으로 남기거나, 최소한 이 1줄에 대한 `consistency-check --impl-done` 통과 기록을 남길 것. "가드-종속 1줄 서술 동기화"류를 정식 예외로 CLAUDE.md 에 명문화할지는 planner 트랙 결정 권고.

- **[INFO]** plan 체크박스 미갱신
  - 위치: `plan/in-progress/eia-context-schema-followups.md`
  - 상세: 4항목 중 2항목(항목 2 전체, 항목 4 의 가드확장 서브노트)이 구현 완료됐는데, 리뷰 대상 diff(`1682777fe..HEAD`) 안에 plan 파일 변경이 전혀 없다(`git diff -- plan/` 결과 empty). "plan 체크박스 = 실제 상태" 컨벤션과 어긋남(memory 반복 교훈).
  - 제안: 완료 항목 체크(`- [x]`) 갱신을 후속 커밋 또는 PR 마무리 커밋에 포함.

- 그 외 항목은 전부 클린 — 아래 "요약" 참조.

## 상세 검증 결과 (Q1~Q5 + 문서 pass)

**(1) 전체 in-scope 여부** — 예. 커밋을 plan 항목과 대조하면:
- `964e887af` = plan 항목 2 그대로(`eia-types.ts` + `packages/sdk/client.ts`). 부수적으로 함께 바뀐 `use-widget.ts`(불필요해진 `as WaitingForInputEvent` 캐스트 제거), `eia-events.test.ts`/`client.spec.ts`(TDD 동반 테스트), `packages/sdk/index.ts`(신규 export)는 타입 정밀화의 **직접 귀결**이지 별도 스코프가 아니다.
- `428134b64` = plan 항목 4 의 "함께 검토" 서브노트가 미리 지목한 확장. 가드를 켜면 기존에 숨어있던 링크가 즉시 build-blocking red 가 되므로, 14곳(10 DEAD + 4 ANCHOR)을 함께 고치는 것은 "가드를 껐다 켰다 반복" 이 아니라 이 커밋을 merge 가능한 상태로 만드는 데 **불가피**한 작업이다. 사용자가 "A+B 전체" 를 명시 승인했다는 전제와도 부합(A=client context 정밀화, B=guard 확장+정정).
- 손댄 파일(`chat-channel/types.ts`, `chat-channel-config.dto.ts`)이 EIA context 타입 자체와 무관해 보이지만, 이는 "가드 확장"이라는 두 번째 선언된 스코프에 정확히 속하는 것이지 무관한 영역 침범이 아니다.

**(2) `spec-impl-evidence.md` §4.2 편집 acceptability** — 위 WARNING 참조. 내용은 정확하지만 절차상 developer 역할 경계를 self-justify 로 우회한 점은 명시적 확인이 필요하다.

**(3) ANCHOR 4곳 필요성** — 과잉 아님. `findBrokenLinks`/`findBrokenSpecLinksInSources` 는 기존 DEAD/ANCHOR 로직(`extractLinks`/`headingSlugs`)을 그대로 재사용하는 구조라, "DEAD 만 검사"로 좁히려면 오히려 별도 엔지니어링이 필요했을 것 — 기존 로직 재사용이 더 간결하고 낮은 위험도의 선택이다. 3개 서로 다른 anchor 를 실제 spec heading 과 대조 검증한 결과 모두 정확했다(아래 (5) 참조).

**(4) 무관한 스무글링 여부** — 없음.
  - `git diff -w --stat` 결과가 일반 `git diff --stat` 과 동일 → 포맷팅/공백만의 변경이 실 변경에 섞여있지 않음.
  - `git diff --check` clean.
  - `spec/` diff 는 `spec-impl-evidence.md` 1줄뿐 — plan 비고란에 "의도적으로 미조치"라 명시된 `additionalProperties: false`, `buildWaitingContext()` 헬퍼 추출은 diff 어디에도 등장하지 않음(확인됨) — 명시적으로 defer 된 항목이 실제로 안 끌려 들어왔다.
  - import 변경은 전부 신규 타입(`WaitingContext`/`ButtonsContext`/`NodeOutputContext`) 사용처와 1:1 대응, 미사용 import 없음.

**(5) JSDoc anchor 수정 정확성 — 실측 검증**
  - `chat-channel-adapter.md` §1.3 실제 heading: `### 1.3 ChatChannelInternalEvent 입력` (구 anchor `#13-chatchannelinternalevent-입력-2026-05-25-신설` 은 더 이상 존재하지 않는 heading 텍스트를 가리켰음) → 신 anchor `#13-chatchannelinternalevent-입력` 일치 확인.
  - `15-chat-channel.md` 실제 heading: `#### 3.1 어댑터 라이프사이클` (구 anchor `#31-실행-엔진과의-연결` 은 완전히 다른 주제를 가리키던 stale 링크) → 신 anchor `#31-어댑터-라이프사이클` 일치 확인.
  - `chat-channel-adapter.md` R-CCA-7 실제 heading: `### R-CCA-7. \`renderNode\` 시그니처 union 확장 — chat-channel-internal 이벤트 수용` → 신 anchor `#r-cca-7-rendernode-시그니처-union-확장--chat-channel-internal-이벤트-수용` 일치 확인(2곳 모두 동일 anchor 로 정정, 둘 다 맞음).
  - `15-chat-channel.md` §5.4.1 실제 heading: `### 5.4.1 Bot Token 변경 single-path 정책` → 신 anchor `#541-bot-token-변경-single-path-정책` 일치 확인.
  - DEAD 링크 3건(위 표에 없는 파일 경로) 을 Python `os.path.normpath` 로 직접 resolve — 전부 실존 파일로 정확히 도달함을 확인.

**문서 pass**
  - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 를 실제 실행 → **13 passed** (신규 2건 "scans a non-trivial codebase source set" / "has no broken spec links in codebase sources" 포함).
  - `codebase/channel-web-chat/src/lib/eia-events.test.ts` 실행 → **22 passed**.
  - `spec-impl-evidence.md` §4.2 표의 새 서술(스캔 대상 `codebase/{backend,channel-web-chat,packages}`, 제외 `dist`/`.next`/`build`/`node_modules`, `spec/**.md` 타깃 링크만)은 실제 `spec-links.ts` 구현(`CODEBASE_SOURCE_ROOTS`, `CODEBASE_SKIP_DIRS`, `SPEC_MD_TARGET_RE`)과 정확히 일치 — 서술과 코드 간 drift 없음.
  - 10 DEAD + 4 ANCHOR = 14 건 카운트도 diff hunk 별로 재계산해 커밋 메시지 claim("DEAD 10곳: types.ts 8·dto 1·reconciler 1", "ANCHOR 4곳")과 정확히 일치함을 확인.

## 요약

두 커밋 모두 plan 의 명시된(혹은 plan 이 이미 예견한) 두 항목에 정확히 대응하며, 부수적으로 딸려온 변경(캐스트 제거, export 추가, 테스트)은 전부 핵심 변경의 직접 귀결이다. 14곳 링크 정정은 가드를 켜는 순간 필연적으로 발생하는 build-blocking 수정이라 스코프 크리프가 아니라 두 번째 스코프 항목의 본체이며, 링크 target/anchor 는 실제 파일 시스템·spec heading·github-slugger 대조와 vitest 실행으로 다층 검증했다. 유일한 절차적 이슈는 developer 소유 세션이 `spec/conventions/spec-impl-evidence.md` 를 (내용은 정확하지만) role-경계를 self-justify 로 우회해 직접 편집한 것 — 기능적 위험은 없으나 CLAUDE.md 명문 규칙과 충돌하므로 사후 planner/사용자 확인을 권고한다. 그 외 포맷팅 노이즈, 불필요한 리팩터, 미승인 기능 확장, defer 항목의 재유입은 발견되지 않았다.

## 위험도

LOW
(스코프 이탈·과잉 리팩터·기능 확장 등 실질적 scope 위반은 없음. 유일한 지적사항은 spec/ 편집의 role-경계 절차 이슈로, 내용은 검증됐고 기능적 리스크는 없어 전체 등급을 낮게 유지하되 별도 확인은 권고.)

STATUS: SUCCESS
