# 요구사항(Requirement) Review

## 검증 방법

정적 리뷰에 더해, 리뷰 대상 파일이 실제로 테스트로 커버되는지 재현 실행으로 확인했다:

- `python3 -m pytest .claude/tests/` → 1015 passed, 1108 subtests passed
- `pnpm vitest run src/lib/docs/__tests__/` (frontend) → 2827 passed (19 files)

전량 GREEN. 아래 발견사항은 "테스트가 없는 곳" 또는 "테스트된 로직과 실제 배선이 갈라지는 곳"에 집중된다.

## 발견사항

- **[WARNING]** `_collect_code_diff` 가 이번 PR 의 핵심 목적(git 서브프로세스 호출을 `_shared/git_probe` 로 통합해 `UnicodeDecodeError` 크래시를 제거)에서 빠졌다 — 자매 함수 미적용.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:398-416` (`_collect_code_diff`)
  - 상세: 같은 파일의 `_branch_changed_rels`/`_edited_rels` 는 `_git_probe.branch_diff_files`/`worktree_changed_files` 를 통해 `_run_git_raw`(`core.quotePath=false` + `errors="surrogateescape"`)를 거친다. `git_probe.py` 의 `_run_git_raw` docstring(158-167번 라인)과 `plan/in-progress/harness-review-gate-followups.md` 항목 6 은 정확히 이 이유를 기록한다 — `text=True` 단독은 strict UTF-8 디코드라 왕복 불가 바이트에서 `UnicodeDecodeError`(=`ValueError`)를 던지는데, 방어용 `except` 가 `OSError` 계열만 잡으면 그대로 뚫고 나가 프로세스가 **크래시**한다는 것. 그런데 `_collect_code_diff` 는 이 primitive 를 쓰지 않고 별도로 `subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=root)` 를 직접 호출하며(`consistency_orchestrator.py:404`), `-c core.quotePath=false` 도 넘기지 않고, `except (OSError, subprocess.TimeoutExpired)`(407번 라인)도 `UnicodeDecodeError` 를 잡지 못한다. `--impl-done` 은 `code_areas`(백엔드/프론트엔드/packages/channel-web-chat 전역) 의 diff **본문**(파일명뿐 아니라 변경된 코드 내용 전체)을 대상으로 하므로, 파일명만 다루는 `branch_diff_files` 보다 왕복 불가 바이트가 나타날 표면이 훨씬 넓다(바이너리 자산·비-UTF8 픽스처 등). `main()` 의 바깥쪽 `try/except Exception`(1089-1094번 라인)이 이 예외를 잡아 에러 메시지로 종료시키므로 침묵 실패는 아니지만, `CLAUDE.md`/`developer` SKILL 이 강제하는 구현 완료 후 필수 게이트(`--impl-done`)가 해당 diff 에서 완전히 사용 불가가 된다.
  - 제안: `_collect_code_diff` 를 `_git_probe._run_git_raw`(또는 동등한 `-c core.quotePath=false` + `errors="surrogateescape"` 래퍼)로 옮겨 같은 보호를 적용한다.

- **[WARNING]** Gate C 의 "순수 판정 함수"(`isGateCEnforced`/`hasValidSpecImpact`)가 유닛테스트만 되고 실제 게이트 배선에는 쓰이지 않아, 둘 사이에 실제 동작 차이가 생긴다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:43-57`(`hasValidSpecImpact` 정의), `:124-133`(중복 인라인 `enforced` 필터), `:161-170`(중복 인라인 "each spec_impact spec path exists" 체크)
  - 상세: `hasValidSpecImpact(impact, specExists)` 는 배열의 **모든** 원소가 `typeof === "string" && specExists(p)` 를 만족해야 true 다. 그런데 실제 Gate C 검증(`describe("Gate C — plan-completion spec-consistency")` 블록)은 이 함수를 호출하지 않고 같은 로직을 두 개의 `it` 로 나눠 인라인 재구현한다. 그 결과 `spec_impact: [""]` (빈 문자열 원소가 섞인 리스트) 는 실제 게이트를 **통과**한다 — `path.join(root, "")` 가 `root` 자기 자신으로 정규화돼 `fs.existsSync(...)` 가 true 이므로 `dangling` 필터(163-165번 라인)에 걸리지 않기 때문이다. 반면 `hasValidSpecImpact("", exists)` 를 직접 부르면(=유닛테스트가 검증하는 계약) false 다. `spec/conventions/spec-impl-evidence.md` R-8/§4.2 표(131번 라인)는 "리스트 항목은 실존 spec 파일이어야 한다(dangling 금지)"를 명시하는데, 이 특정 형태(빈 문자열 항목)는 조용히 새어나간다. 주석("Pure enforcement predicates — unit-tested below so the gate is provably live")이 시사하는 바와 달리, 이 함수들의 유닛테스트는 실제 게이트의 살아있음을 보장하지 않는다 — 배선이 분리돼 있어서다.
  - 제안: 인라인 필터를 `hasValidSpecImpact`/`isGateCEnforced` 호출로 교체하거나(중복 제거 + 계약 통일), 최소한 `dangling` 필터에 `!p || typeof p !== "string"` 을 추가해 빈 문자열/비-문자열 원소를 명시적으로 걸러낸다.

- **[SPEC-DRIFT]** 새 가드 `plan-link-integrity.test.ts` 가 `spec/conventions/spec-impl-evidence.md` 의 `code:` evidence 목록과 §4.2 가드 표에 반영되지 않았다.
  - 위치: `spec/conventions/spec-impl-evidence.md:4-16`(이 문서 자신의 `code:` frontmatter), `:107-131`(§4.2 가드 표) / 대응 코드: `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts`(신규 전체 파일)
  - 상세: `spec-impl-evidence.md` 자신은 §4.2 gate 를 강제하는 파일 목록을 `code:` 에 명시하고(자기 관례를 자기 자신에도 적용), 본문 표(107-131번 라인)에 `spec-pending-plan-existence`/`spec-plan-completion`/`spec-link-integrity`/`spec-area-index`/`plan-frontmatter` 5건을 전부 등재한다. `spec-link-integrity.test.ts` 행(128번 라인)은 spec→plan **단방향**만 서술("plan-coherence-checker 가 담당하는 것은 plan/** 문서 내부의 링크 위생이지 spec→plan 링크가 아니다"). 그런데 새로 추가된 `plan-link-integrity.test.ts` 는 정확히 그 반대 방향(plan→plan, plan→spec)을 검증하는 **별개의 신규 build 가드**이고(측정: 440개 plan 파일, 76건 baseline, 61 pairs), ratchet(고정 baseline set) 방식이라 `spec-link-integrity.test.ts`(clean gate)와 강제 강도도 다르다. 코드 자체는 근거가 탄탄하고(측정치·회귀 방지 이유 명시) 실행도 GREEN 이므로 코드가 틀린 게 아니라 spec 문서의 evidence 목록·표가 이 신규 가드를 아직 반영하지 못한 상태다.
  - 제안: `spec-impl-evidence.md` 의 `code:` 목록에 `plan-link-integrity.test.ts` 추가, §4.2 표에 행 추가(대상=plan→plan/plan→spec, 예외=`archive/`, 강제방식=ratchet/pairs baseline — clean gate 아님을 명시). spec 수정은 `project-planner` 몫.

- **[SPEC-DRIFT]** `spec-plan-completion.test.ts` 에 새로 추가된 "완료 plan 은 미완을 주장하지 않는다"(`claimsUnfinished`, `status:` 검증) 가 `spec-impl-evidence.md` §4.2 표의 해당 행 설명에 반영되지 않았다.
  - 위치: `spec/conventions/spec-impl-evidence.md:131`(`spec-plan-completion.test.ts` 행) / 대응 코드: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:184-216`(`describe("완료 plan 은 미완을 주장하지 않는다")`)
  - 상세: 131번 라인은 이 파일을 "`spec_impact` 선언 필수(Gate C)"로만 서술한다. 그러나 같은 파일에 R-8 과 무관한 두 번째 독립 검증(완료된 plan 이 `status: in-progress`/`backlog` 를 주장하면 안 된다 — #1108/#1117 실측 재발 방지)이 추가됐다. 파일 단위로는 `code:` 목록에 이미 등재돼 있어 "완전히 누락"은 아니지만, 표 행의 *행위 서술*이 파일이 실제로 강제하는 두 가지 규칙 중 하나만 설명해 spec 독자가 두 번째 규칙의 존재를 알 수 없다.
  - 제안: 131번 행 설명에 "+ `plan/complete/` 의 `status:` 가 미완 어휘(`in-progress`/`in_progress`/`backlog`)를 주장하면 안 됨(cutoff 없음, 전건 강제)" 을 추가하거나 별도 표 행으로 분리.

## 요약

핵심 로직(git_probe.py 의 primitive 추출, session.py 의 원자적 세션 디렉터리 생성, consistency_orchestrator.py 의 예산·우선순위·splice 로직, 신규 plan-link/Gate-C 프런트엔드 가드)은 매우 촘촘한 실측·회귀 테스트로 뒷받침되며, 재실행 결과 전량(python 1015+1108 subtests, frontend 2827)이 GREEN 이라 의도한 기능은 대부분 정확히 구현돼 있다. 다만 이번 리팩터의 핵심 동기(git 서브프로세스 호출의 인코딩 크래시 통합 제거)가 같은 파일 안의 자매 함수 `_collect_code_diff` 에는 적용되지 않아, `--impl-done` 게이트가 코드 diff 본문의 비-UTF8 바이트에 여전히 크래시로 노출된다(WARNING). Gate C 의 "순수 판정 함수"와 실제 배선이 분리돼 있어 빈 문자열 `spec_impact` 항목이 조용히 통과하는 좁은 데이터-유효성 틈도 있다(WARNING). 두 건의 신규 build 가드(plan-link-integrity, status-lying 체크)는 코드 자체는 견고하지만 `spec/conventions/spec-impl-evidence.md` 의 evidence 목록·§4.2 표가 아직 이를 반영하지 못해 spec-drift 상태다.

## 위험도

MEDIUM
