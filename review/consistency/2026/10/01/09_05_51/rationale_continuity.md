# Rationale 연속성 검토 (impl-done, scope=.claude/docs, 전환 단계 1 라운드 2)

검토 대상은 개발 브랜치(`claude/nerv-cutover-1-69b98d`)와 짝 planner 브랜치(`claude/nerv-cutover-1-docs-c46df0`)를 합친 상태다. `.claude/docs` 의 델타는 개발 브랜치에서 0개 파일이고 짝 브랜치에서 `plan-lifecycle.md` · `worktree-policy.md` 두 개다. 기각된 대안을 다시 채택한 곳과 invariant 를 직접 깨는 곳은 찾지 못했다. 아래는 근거 문장이 낡았거나 예외의 경계가 약한 곳이다.

확인에 쓴 자료는 다음과 같다. 프롬프트의 Rationale 발췌와 `.claude/docs` 전문, HEAD 워킹트리의 `spec/conventions/spec-impl-evidence.md`(R-1~R-11), 미러본 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`(R-12), 짝 브랜치 diff, 메모리의 전환 결정 D1~D12 기록이다.

## 발견사항

- **[WARNING]** 옛 트리 편집 우회 예외가 "좁은 예외" 규약을 따르지 않고, "그 줄만" 이 구현보다 넓게 약속한다
  - target 위치: 짝 브랜치 `.claude/docs/plan-lifecycle.md` §3 "인입 참조" 항목 아래 인용 블록, `.claude/docs/worktree-policy.md` §5.1 "우회" 항목
  - 과거 결정 출처: `plan-lifecycle.md` §3 "흡수 시 삭제 (좁은 예외)" 의 "왜 좁게 쓰는가"(조건을 열거하고 경계 이유를 적는다), `worktree-policy.md` §5 · §3 의 `BYPASS_*` 는 "단발성 · 의식적 우회", `plan-lifecycle.md` §3 push gate 의 `BYPASS_PLAN_GUARD` 도 "드문 경우의 의식적 단발 우회"
  - 상세: 새 예외는 "plan 링크 · `pending_plans` 정리 · `status` 승격은 `BYPASS_NERV_OWNED_PATHS=1` 로 그 줄만" 이라고 쓴다. 문제가 셋이다.
    1. 우회 수단이 세션 환경 변수라 훅 프로세스가 상속한 값 하나로 `spec/` 전체가 열린다. 훅은 `file_path` 단위 허용 목록을 볼 수 없으므로 "그 줄만" 은 규범이지 장치가 아니다. 우회 중에 고친 옛 트리는 `guard_nerv_owned_paths.py` docstring 이 인정하듯 어느 층도 잡지 않는다(옛 트리 셸 편집과 같은 사각지대). `worktree-policy.md` §5.1 이 쓴 "세션 환경 변수, 단발" 은 두 말이 서로 어긋난다.
    2. 허용 경우가 "plan 이동 때문에 깨지는 것" 으로만 적혀 있다. 그런데 developer SKILL §4(DOCUMENTATION 단계)는 일부만 구현할 때 `status: partial` 과 `pending_plans:` 를 **새로 등록**하라고 여전히 요구한다(spec-impl-evidence R-5 의 "빈 약속 방지" invariant). 이 등록은 옛 트리 frontmatter 편집이라 훅에 막히는데, 예외 목록의 "정리 · 승격" 과 같은 말인지 문서가 말하지 않는다. 라운드 1 W1 은 plan 이동 교착만 닫았다.
    3. 예외가 "단계 3 에서 사라진다" 고만 적고, 옛 트리 편집을 막는 동안 R-5 의 역방향 강제(`spec-status-lifecycle` (b))가 누구 손으로 유지되는지는 적지 않았다.
  - 제안: 예외에 "조건 넷" 식으로 허용 경우를 열거한다(plan 링크 정정, `pending_plans` 에서 완료 plan 제거, `status` 승격, partial 신규 등록 중 무엇이 포함인지). "우회 중에는 옛 트리 전체가 열리고 어느 층도 다른 편집을 잡지 않는다" 를 한 문장으로 적어 "그 줄만" 을 약속에서 규범으로 낮춘다. 가능하면 developer SKILL §4 에서 partial 등록 의무가 NERV 전환 중 어디로 가는지(Task 증적 또는 우회 허용) 한 줄 적는다.

- **[WARNING]** 근거 문장 "실측상 스펙 정정이 우회 설계보다 쌌다(3줄)" 가 측정 조건이 바뀐 흐름에 그대로 옮겨졌다
  - target 위치: 짝 브랜치 `consistency-checker/SKILL.md` "근본 원인이 스펙이면 (`developer` 턴의 스펙 drift 등) 스펙 초안으로 넘긴다" 문단
  - 과거 결정 출처: 같은 SKILL 의 기존 문단 "근본 원인이 호출자 권한 밖이면 planner 로 즉시 인계한다" 와 그 각주(2026-07-25 `review/code/2026/07/25/22_58_00` 에서 요약 에이전트가 Critical 하향을 스스로 발명한 사건, "막다른 길처럼 보이면 우회가 생긴다. 금지와 경로를 함께 둔다")
  - 상세: 원문의 "3줄" 은 planner 턴이 `spec/` 을 즉시 고치던 흐름에서 잰 값이다. 새 흐름은 NERV 초안 저장, 사람 승인, `pull.py --task` 재수신을 거친다. 같은 PR 이 추가한 developer SKILL "승인 대기 중의 게이트" 도 승인 전에는 같은 drift 가 다음 `--impl-done` 에 다시 나오고 push 는 승인 뒤로 미뤄진다고 쓴다. 그 문단은 "승인본이 있는 문서의 동작은 아직 재지 않았다" 고 스스로 밝힌다. 그러니 "쌌다" 는 문장은 새 경로에서 측정된 적이 없다. 과거 Rationale 의 실측 문장을 다른 조건의 경로에 붙이면 다음 사람이 그 수치를 새 경로의 비용으로 읽는다. 금지와 경로를 함께 둔다는 원칙 자체는 지켜졌다(W6 처분이 경로를 만들었다).
  - 제안: 문장을 "옛 흐름(planner 턴)에서 실측" 으로 한정하거나 삭제한다. 새 흐름의 비용은 승인 대기가 들어간다는 사실만 적고 수치는 새 실측 뒤에 채운다.

- **[INFO]** 미러 제외의 Rationale(R-12)이 미승인 초안에만 있고 코드에서 찾아갈 길이 없다
  - target 위치: `spec-links.ts` `NERV_MIRROR` 주석, `spec-area-index.test.ts` 머리 주석, `spec-link-integrity.test.ts` 머리 주석, `PROJECT.md` §NERV 스펙 미러
  - 과거 결정 출처: `spec-impl-evidence.md` R-9("SoT 를 본 문서 §4.2 로 택한 이유"), §4.2 표의 예외 칸(생성형 카탈로그, `spec/conventions/`만 면제)
  - 상세: 두 가드에서 미러를 빼는 근거는 미러본 `CLE-ENG-SPECEVIDENCE` R-12 에 있다. 그 문서는 `read_as: "approved_fallback"` 이라 R-12 는 아직 승인되지 않았다. 코드와 PROJECT.md 는 여전히 "SoT: spec/conventions/spec-impl-evidence.md §4.2" 를 가리키는데 동결된 그 파일에는 미러 면제가 없다. 코드와 PROJECT.md 어디에도 `R-12` 나 `CLE-ENG-SPECEVIDENCE` 를 적은 곳이 없다(`git grep` 0건). R-12 가 말한 수치는 미러에서 재현된다(같은 문서 앵커 842, 다른 문서 앵커 530, 카탈로그 키 링크 125). 짝 브랜치의 developer SKILL 규칙대로라면 승인 전 drift 는 push 를 승인 뒤로 미루는 대상이다.
  - 제안: `NERV_MIRROR` 주석에 "근거: NERV `CLE-ENG-SPECEVIDENCE` R-12" 한 줄을 더하고, R-12 승인 여부를 push 전에 확인한다.

- **[INFO]** 단계 1~4e 사이에 NERV 쪽에서 새로 쓰는 Rationale 은 로컬 연속성 검토의 코퍼스에 들어오지 않는다
  - target 위치: `consistency_orchestrator.py` `is_nerv_mirror` 와 `collect_context` 의 코퍼스 필터, 짝 브랜치 `consistency-checker/SKILL.md` "NERV 미러와 대조 코퍼스" 각주
  - 과거 결정 출처: spec-impl-evidence R-9 가 가리키는 "가드가 결정 연속성을 지킨다" 전제, `test_consistency_bundle_priority.py` 가 고정한 "checker 의 `BLOCK: NO` 는 대상을 실제로 읽었다는 뜻" 이라는 원칙
  - 상세: 코퍼스에서 미러를 빼는 판단 자체는 예산 중복과 순서 단언 RED 실측(CHANGELOG)으로 뒷받침된다. 다만 그 결과 R-12 같은 전환 이후 결정은 이 checker 가 볼 수 없고, 옛 트리 Rationale 은 동결된다. 각주는 미러를 scope 로 줄 때만 "참고용" 이라고 적고, 옛 트리 scope 로 돌릴 때 대조가 낡았을 수 있다는 점은 적지 않았다. 서버의 `nerv_spec_check`(rationale-continuity 포함)가 같은 일을 하므로 그물은 있다.
  - 제안: 각주에 "단계 4e 전까지 전환 이후 Rationale 의 연속성은 `nerv_spec_check` 가 맡는다" 한 문장을 더한다.

- **[INFO]** "자기-반증형 소정정" 제거는 결정 D8 안 A 라는 사유가 있지만 옛 Rationale 의 핵심 우려가 남는 곳이 있다
  - target 위치: 짝 브랜치 `CLAUDE.md` §Skill 체계(옛 절 삭제와 각주), `developer/SKILL.md` 경로 표 `spec/` 행
  - 과거 결정 출처: 삭제된 `CLAUDE.md` "왜 예외인가"(2026-08-23 사용자 결정, `#1202`: 틀린 예고를 남기면 다음 사람이 있지도 않은 작업을 쫓는다. 반증한 developer 에게서 정정 권한을 뺏지 않는다)
  - 상세: 번복 사유는 각주에 적혀 있다("반증한 사람이 곧 초안을 쓸 수 있다"). 남은 참조도 없다(`CHANGELOG.md` 의 과거 항목과 동결된 `spec/conventions/conversation-thread.md` 의 역사 서술뿐이다). 다만 옛 우려는 한 곳에서 풀리지 않는다. 틀린 예고가 옛 트리에 있으면 그 정정은 NERV 에만 들어가고 옛 트리는 동결이며, 그 옛 트리가 4e 까지 checker 코퍼스다. 정정 승인이 늦는 동안 같은 문장이 틀린 채 대조 기준으로 남는다. 한편 "D8 안 A" 의 "안 A" 가 무엇과 갈렸는지, D 번호가 어디에 정의됐는지는 저장소 문서에 없다. D 번호는 외부 아티팩트와 NERV Task 본문에 있다.
  - 제안: 각주에 D 번호가 정의된 Task 키(`CLE-T-…`)를 붙인다. 승인 전 틀린 예고는 NERV `spec_change` 로 남긴다는 한 줄을 더하면 옛 우려가 닫힌다.

- **[INFO]** 미러를 "구현된 스펙의 스냅샷" 으로 부르는 문구가 첫 미러의 내용과 맞지 않는다
  - target 위치: `spec/README.md`, 짝 브랜치 `CLAUDE.md` §정보 저장 위치 각주 ("그래서 미러는 구현된 스펙의 스냅샷이고"), `pull.py` `render_readme`
  - 과거 결정 출처: 결정 D2(승인본이 없으면 초안), D3(구현 때 클레임한 스펙을 받는다, 부분 스냅샷)
  - 상세: 첫 미러는 `--all` 로 169편 전체를 받았다. 미러본 frontmatter 에는 "부분 구현" 49편과 "미구현" 1편이 있고, 1편은 승인본 없이 초안으로 들어왔다. 의도는 "구현 시점에 받은 버전" 일 텐데 문구는 "구현이 끝난 스펙" 으로 읽힌다. checker 나 사람이 미러를 구현 완료의 증거로 읽을 수 있다.
  - 제안: "구현 시점에 받은 스펙 버전의 스냅샷" 으로 고치고, 상태는 frontmatter `read_as` 와 본문 머리 줄의 구현 상태로 본다고 덧붙인다.

## 점검했으나 충돌이 없었던 것

- 새 훅 등록 형태(`test ! -f … || python3 …`)는 "새 훅을 등록할 때 main checkout 에 파일이 없으면 모든 편집이 막힌다" 는 기존 교훈과 짝 브랜치 `worktree-policy.md` §5.1 의 서술과 일치한다.
- 결정 D1(영역 폴더 배치), D3(구현 때 pull), D4(카탈로그는 codebase 데이터)는 `pull.py` 구현과 맞다. 훅이 `review/` · `plan/` 을 아직 막지 않는 것도 D11 의 "단계 2 중단, 단계 3 제거" 와 맞다.
- `stray-tool-tags.test.ts` 가 미러를 일부러 계속 보는 것은 그 파일의 기존 Rationale("오염은 파일의 성격을 가리지 않는다. 인덱스 파일도 포함한다")과 같은 방향이다.
- `/spec-coverage` 오케스트레이터는 `INCLUDE` 목록이 옛 영역 폴더로 고정돼 있어 미러가 섞이지 않는다.
- consistency 오케스트레이터의 `_require_target` 은 절대 경로 파일을 받으므로, 짝 SKILL 이 말한 "scratchpad 의 절대 경로" `--spec` 입력이 구현과 맞다. `_target/` 스냅샷 보존("draft 는 산출물") 도 유지된다.
- 링크 무결성과 영역 index 두 가드에서 미러를 뺀 판단은 R-9 의 family 분류와 충돌하지 않는다. R-7(카탈로그 최상위 인덱스는 정식 spec)은 옛 트리 규칙이고 미러의 카탈로그 제외(D4)와 다른 층이다.

## 요약

Rationale 연속성 관점에서 CRITICAL 은 없다. 이번 전환은 사용자 확정 결정(D1~D12)을 따르고, 번복한 옛 결정(자기-반증형 소정정, spec 단일 진실)에는 사유 각주가 붙어 있으며, 새로 만든 예외와 제외(`inNervMirror`, `is_nerv_mirror`, `BYPASS_NERV_OWNED_PATHS`)도 각각 이유와 해제 시점(단계 4e, 단계 5)을 적었다. 남은 문제는 두 가지다. 하나는 옛 트리 편집 우회가 기존 "좁은 예외" 규약처럼 허용 경우를 열거하지 않고 "그 줄만" 을 장치 없이 약속하며 developer SKILL 의 partial 등록 의무와 연결이 불분명하다는 점이다. 다른 하나는 planner 턴 흐름에서 잰 "3줄" 실측이 승인 대기가 들어간 새 흐름의 근거로 옮겨졌다는 점이다. 나머지 INFO 는 R-12 가 미승인이고 코드에서 가리킬 길이 없다는 것, 단계 4e 전 코퍼스가 NERV 쪽 새 Rationale 을 보지 못한다는 것, 미러 설명 문구가 첫 미러 내용과 어긋난다는 것이다. 모두 문서 문구와 한 줄 포인터로 닫힌다.

## 위험도

LOW

STATUS=success ISSUES=6 PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/rationale_continuity.md
