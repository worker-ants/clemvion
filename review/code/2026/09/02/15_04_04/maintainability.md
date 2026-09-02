# 유지보수성(Maintainability) 코드 리뷰

## 개요

이 diff 는 (1) frontend 타입체크 ratchet 신설을 위해 backend 전용이던 판정 로직을
`scripts/_typecheck_ratchet.py` 공유 코어로 추출하고 두 엔트리포인트(`check-backend-`/
`check-frontend-typecheck-ratchet.py`)를 `RatchetConfig` 값 주입으로 재구성한 작업과,
(2) 그 앞선 라운드(`review/code/2026/09/02/11_27_26/`)의 코드 리뷰에서 나온 Critical 2건·
Warning 2건에 대한 후속 수정(`RESOLUTION.md`)을 함께 담고 있다. 즉 이번에 보는 코드는 이미
한 차례 리뷰·수정을 거친 "2R" 상태다.

## 발견사항

- **[INFO]** `RatchetConfig` 7필드 리터럴이 기존 `fake_config()` 헬퍼를 우회해 한 곳 더 중복돼 있다 (직전 라운드 재확인, 미해결)
  - 위치: `.claude/tests/test_typecheck_ratchet.py:279-286` (`RunTscFailClosedTest.test_tsc_is_invoked_with_the_configured_tsconfig`)
  - 상세: 같은 파일에 `fake_config(baseline)` 헬퍼(`.claude/tests/test_typecheck_ratchet.py:108-117`)가 이미 있는데, `tsconfig` 필드 하나만 다른 설정이 필요한 이 테스트는 헬퍼를 쓰지 않고 `CORE.RatchetConfig(label=..., package_dir=..., tsconfig=..., baseline=..., script=..., blind_spot=...)` 6개 인자를 다시 나열한다. `RatchetConfig` 는 `@dataclass(frozen=True)`(`scripts/_typecheck_ratchet.py:57-77`)이므로 `dataclasses.replace(fake_config(tmp), tsconfig="tsconfig.typecheck.json")` 로 줄이면, 향후 필드가 늘 때(예: 옵션 추가) 갱신 지점이 하나로 줄어든다. 직전 라운드 maintainability 리뷰가 이미 INFO 로 지적했고 `RESOLUTION.md` 의 "미조치" 목록(#5·#6·#8 부류, "리뷰어도 우선순위 낮음으로 표시")에 포함돼 의도적으로 남아 있다 — 새로운 결함은 아니고 회귀 확인 차원의 재확인.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 `dataclasses.replace` 로 축소 고려.

- **[INFO]** 두 엔트리포인트가 각각 `sys.path.insert(0, ...)` 로 같은 `scripts/` 디렉터리를 삽입 — 같은 프로세스에서 둘 다 로드되면 중복 삽입 (직전 라운드 재확인, 미해결)
  - 위치: `scripts/check-backend-typecheck-ratchet.py:48`, `scripts/check-frontend-typecheck-ratchet.py:51`
  - 상세: `.claude/tests/test_typecheck_ratchet.py` 의 `ENTRYPOINTS`/`CONFIGS` 순회(`.claude/tests/test_typecheck_ratchet.py:69-77`)가 두 엔트리포인트를 한 프로세스에서 모두 `load_module()` 로 로드하므로, 동일한 절대경로가 `sys.path` 앞쪽에 두 번 삽입된다. 기능 영향은 현재 없고(저장소 전역 기존 관례 — `.claude/tests/_harness.py` 등도 같은 패턴), 새 결함이 아니라 직전 라운드 architecture/side_effect 리뷰가 이미 관찰로 남긴 항목의 재확인.
  - 제안: 조치 불요. 스크립트 수가 더 늘면 `if path not in sys.path` 가드 검토.

## 직전 라운드 대비 확인된 개선 (참고용 — 이번 diff 에서 새로 검증)

이번 라운드가 커버하는 diff 는 직전 코드 리뷰(`11_27_26`)의 Critical 2건·Warning 2건을
모두 반영한 상태다. 유지보수성 관점에서 특히 아래 두 건은 "이 PR 이 스스로 경고하는
실패 클래스가 재발하지 않도록" 재발 방지 테스트까지 갖춰 닫혔다 — 직접 소스로 확인:

- **W1(TEST_FILE_RULES 비대칭)** — `TEST_FILE_RULES["frontend"]` 가 `\.(?:test|spec)\.tsx?$` 로 `.spec.ts(x)` 갈래를 포함하도록 고쳐졌고(`.claude/tests/test_typecheck_ratchet.py:82-87`), tsconfig exclude 글롭 전수와 대조하는 `FrontendExcludeCoverageTest`(`.claude/tests/test_typecheck_ratchet.py:421-463`, 표본-실제 tsconfig 동기 여부까지 검증하는 전제 테스트 포함)가 추가돼 "규칙 사본이 갈리는" 재발을 구조적으로 막는다.
- **W2(모듈 이중 로드)** — 공유 코어를 엔트리포인트가 쓰는 실제 이름(`"_typecheck_ratchet"`)으로 로드하도록 통일했고(`.claude/tests/test_typecheck_ratchet.py:63-67`), `EntrypointWiringTest`(`.claude/tests/test_typecheck_ratchet.py:386-418`)가 `isinstance(cfg, CORE.RatchetConfig)` 와 실제 `CONFIG`+`main` 배선의 end-to-end 통과를 고정해, "판정 로직은 한 곳" 이라는 이 파일 자신의 불변식이 테스트 하네스 층위에서도 지켜지는지 검증한다.

두 건 모두 이전 리뷰가 지적한 결함을 고치는 데서 그치지 않고 회귀를 막는 테스트를 남겨,
이 저장소가 반복해서 강조하는 "사본이 갈리는 실패 클래스" 방지 관례를 스스로 지켰다.

## 요약

핵심 변경(공유 ratchet 코어 추출 + frontend 게이트 신설)은 함수 분리(`run_tsc`/`count_by_file`/
`load_baseline`/`write_baseline`/`verdict`/`main`)·네이밍·문서화가 일관되고 함수 길이·중첩
깊이 모두 양호하며, 직전 리뷰 라운드에서 지적된 Critical/Warning 은 전부 근본 수정 + 회귀
테스트로 닫혔다(직접 소스 대조로 확인). 남은 것은 이전에도 INFO 로 남았고 의도적으로
미해결 상태인 사소한 중복 2건(`RatchetConfig` 리터럴 중복, `sys.path` 중복 삽입)뿐이며 둘
다 fail-loud 하거나 현재 관측 가능한 부작용이 없어 즉각 조치가 필요하지 않다. 새로 도입된
유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
