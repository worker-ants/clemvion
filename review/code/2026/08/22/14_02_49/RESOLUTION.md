# RESOLUTION — 14_02_49

대상 SUMMARY: `review/code/2026/08/22/14_02_49/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **2**, INFO 11)

**처분: WARNING 2건 전부 수정.** 둘 다 **이 PR 이 고치려는 실패 클래스와 같은 성격**이었다.

---

## WARNING 1 — 소비처를 **하나만 보고** pathspec 을 지웠다 (requirement·side_effect) — **수정**

`frontend-checks` 에서 `codebase/channel-web-chat/**` 를 지우면서 근거를 *"미러 가드가 이 잡에
살았다"* 하나로만 잡았다. 같은 vitest 스위트의 **다른 소비처를 전수로 세지 않았다.**

리뷰어가 완화 근거(*"실제 게이트는 로컬 `run-test.sh`"*)를 달아 줬지만 **그대로 받지 않고
실측했고, 완화 근거가 틀렸다**:

```
typescript-toolchain-guard.ts:173   path.join(ROOT, dir, "package.json") 을 읽는다
typescript-toolchain.test.ts:56     expect(dirs).toContain("codebase/channel-web-chat")
```

즉 `channel-web-chat/package.json` 의 toolchain 이 어긋나도 CI 가 못 잡는 상태였다 —
`web-chat-checks` 는 `channel-web-chat...` 만 설치해 이 가드를 돌리지 않는다. **내가 실제
갭을 만들었다.**

pathspec 을 되돌리고 **근거만 갈아 끼웠다**(미러 가드 → typescript-toolchain). 왜 한때 다른
근거로 있었는지, 그리고 소비처를 하나만 보고 지울 뻔한 사실도 주석에 남겼다.

> 이것이 이 PR 이 고치려는 것과 같은 형태다 — *"방어의 정의를 한 칸 좁게 잡는다."*
> 고치는 쪽에서 같은 실수를 했다.

## WARNING 2 — 핵심 불변식이 **1회성 수동 실측**에만 있었다 (testing) — **수정**

*"`codebase/**` 가 모든 스택을 덮는다"* 는 이 워크플로의 **존재 이유**인데, 근거가 plan 의
수동 프로브 서술뿐이었다. 기존 `test_no_pathspec_is_a_dead_filter` 는 pathspec 이
`codebase/frontend/**` 하나로 좁혀져도 tracked 파일과는 매치하므로 **여전히 GREEN** 이다.

`test_repo_guards_pathspec_covers_every_stack` 를 추가했다 — backend·frontend·packages·
channel-web-chat 각각에서 최소 1개 tracked 파일을 덮는지 묻는다. **스택 자체가 비면 vacuous**
하므로 그것부터 막았다(`in_stack` 비었는지 먼저 단언).

**뮤테이션 실증**: pathspec 을 `codebase/frontend/**` 로 좁히니 **backend·packages·
channel-web-chat 세 스택이 각각 RED**(frontend 만 통과). 도입 시점에 손으로 확인한 그
불변식을 이제 기계가 묻는다.

## 미조치 INFO (11건)

전부 리뷰어 스스로 "조치 불요" 또는 후속. 대표 — `checkout@v7` 태그 고정(저장소 관례) ·
크로스스택 가드가 frontend 트리에 사는 것(형제 가드와 일관) · 미러 가드 중복 실행(문서화된
트레이드오프) · 워크플로/잡 명명 · 종결 메모의 상호 파일 인용.

### INFO 6 은 함께 처리했다

`masked-marker-shared-package.md` 종결 메모가 실제 설계가 담긴 `mirror-guard-single-copy.md`
를 파일명으로 인용하지 않았다 — *"처분 대상은 파일:라인으로 인용"* 이라는 같은 문서의 관행에
어긋난다. 경로를 넣었다.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet + 하네스 —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (52s) |
| unit | backend jest **430 suites**(사본 삭제분만큼 감소) · frontend **287 files** |
| build | PASS (124s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (207s) — backend supertest **276** · playwright **51** |
| 하네스 | **OK** (레지스트리 5곳 등재 + 신규 커버리지 테스트) |
