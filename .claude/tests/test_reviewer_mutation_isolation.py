"""리뷰어 프롬프트가 **뮤테이션 격리 규약**을 항상 싣는다.

## 왜 이 파일이 있는가 — 프롬프트 문구는 조용히 사라진다

병렬 fan-out 중 한 리뷰어가 저장소 파일을 뮤테이션하면 다른 리뷰어들의 판정이 오염된다.
`plan/in-progress/harness-review-gate-followups.md` 에 **네 번** 기록됐다:

    2026-08-11 `13_04_55`  scope 가 소스에 뮤턴트를 심었다 → side_effect 는 CRITICAL 로
                           에스컬레이션, testing 은 3회 관측 후 `git restore` 로 **남의
                           워킹트리를 되돌렸다**, requirement 도 같은 유령을 봤다.
    2026-08-27 `14_10_42`  requirement 가 잔여물을 "다른 병렬 세션의 산물" 로 **오귀속**.
                           실제로는 같은 라운드의 testing 이었다.
    2026-08-27 `18_16_05`  testing 이 백업 `cp` 목적지를 잘못 짚어 **untracked 파일을
                           덮어쓰고 지웠다**. git 으로 복구 불가.
    2026-08-28 `15_47_21`  security·scope 가 과도 상태와 `.bak` 을 관측. 또 testing 이었다.

그때 실측된 갭이 이것이다 — **`_prompts/*.md` 에 `scratch`·`git restore`·`병렬` 언급이 각
0건**이었다. 즉 2026-08-11 에 적어 둔 처방이 프롬프트 생성 경로에 **한 번도 반영된 적이
없었다.** 처방을 코드에 넣는 것만으로는 같은 일이 또 생긴다 — 누가 리팩터하며 그 문자열을
떼어내도 아무도 모르기 때문이다. 그래서 조립 결과를 여기서 고정한다.

## 무엇을 고정하는가

1. **전 역할**에 붙는다. 한 역할만 붙으면 다음 라운드의 다른 리뷰어가 무방비다 — 실제
   사고들이 매번 다른 역할(scope·testing·requirement)에서 났다.
2. 처방의 **네 축**이 문구에 남아 있다: 저장소 밖 scratch · `git restore`/`stash` 금지 ·
   병렬 동시 실행 고지 · `.bak` 금지. 넷 중 하나만 빠져도 그 사고 하나를 못 막는다.
3. router 에는 **붙지 않는다**. router 는 reviewer 를 고르기만 하고 코드를 건드리지 않는다.
   붙이면 무관한 지시로 프롬프트만 키운다.

Fresh-interpreter 규약은 형제 파일들과 같다(`test_review_prepare_single_session` 헤더
참조) — 오케스트레이터를 in-process 로 import 하면 `_lib` 이름이 충돌한다.
"""

from __future__ import annotations

import unittest

import _harness

REPO_ROOT = _harness.REPO_ROOT
ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

_PREAMBLE = _harness.orchestrator_preamble(ORCH, imports="json")


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


# 처방의 네 축. **의미가 아니라 문구**를 고정한다 — 리뷰어는 이 텍스트를 읽고 행동하므로,
# 축이 문구에서 빠지면 그 사고를 막지 못한다.
#
# 각 항목은 `(설명, 이 축이 없으면 못 막는 사고)` 다. 실패 메시지가 "무엇을 잃었는지" 를
# 바로 말하도록 사고 번호를 함께 싣는다.
_REQUIRED_CLAUSES = [
    ("scratch", "저장소 밖 사본 — `18_16_05` 파일 파괴를 막는 축"),
    ("git restore", "`git restore` 금지 — `13_04_55` 에서 남의 작업을 지운 명령"),
    ("git stash", "`git stash` 금지 — 같은 클래스의 파괴적 원복"),
    ("병렬", "동시 실행 고지 — 왜 저장소를 건드리면 안 되는지의 이유"),
    (".bak", "저장소 안 `.bak` 금지 — `02_02_18`·`15_47_21` 에서 관측된 형태"),
]


class MutationContractReachesEveryReviewerTest(unittest.TestCase):
    def test_every_role_prompt_carries_the_contract(self):
        """등록된 **모든** reviewer 역할의 프롬프트에 계약이 실린다."""
        result = run_in_orchestrator(
            """
            roles = list(orch.REVIEWER_INSTRUCTIONS.keys())
            missing = [
                r for r in roles
                if orch.MUTATION_ISOLATION_CONTRACT
                not in orch.build_agent_prompt_body(r, [], 10000, 200000)
            ]
            emit({"roles": roles, "missing": missing})
            """
        )
        # vacuity 방지 — 역할 목록이 비면 위 comprehension 이 공집합을 내고 조용히 통과한다.
        self.assertGreaterEqual(
            len(result["roles"]), 10,
            "reviewer 역할이 10개 미만이다 — 등록부가 비었거나 로드에 실패했다. "
            "이 상태로는 아래 단언이 아무것도 검증하지 않는다.",
        )
        self.assertEqual(
            result["missing"], [],
            "이 역할들의 프롬프트에 뮤테이션 격리 계약이 빠졌다. 한 역할만 빠져도 "
            "그 리뷰어가 다음 라운드에서 저장소를 뮤테이션해 나머지를 오염시킨다.",
        )

    def test_contract_keeps_all_four_prescription_axes(self):
        """처방의 네 축이 문구에 남아 있다 — 하나라도 빠지면 그 사고를 못 막는다."""
        body = run_in_orchestrator(
            """
            emit(orch.build_agent_prompt_body("testing", [], 10000, 200000))
            """
        )
        for clause, why in _REQUIRED_CLAUSES:
            with self.subTest(clause=clause):
                self.assertIn(
                    clause, body,
                    f"리뷰어 프롬프트에서 {clause!r} 가 사라졌다 — {why}.",
                )

    def test_router_prompt_does_not_carry_the_contract(self):
        """router 는 코드를 건드리지 않으므로 계약이 붙지 않는다 (스코프 고정)."""
        carried = run_in_orchestrator(
            """
            roles = list(orch.REVIEWER_INSTRUCTIONS.keys())
            body = orch.build_router_prompt_body(roles, [], {}, [], 10000, 200000)
            emit(orch.MUTATION_ISOLATION_CONTRACT in body)
            """
        )
        self.assertFalse(
            carried,
            "router 프롬프트에 뮤테이션 계약이 붙었다. router 는 reviewer 를 고르기만 하고 "
            "코드를 뮤테이션하지 않는다 — 무관한 지시로 프롬프트만 커진다.",
        )


if __name__ == "__main__":
    unittest.main()
