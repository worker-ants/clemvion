STATUS=success ISSUES=0

### 발견사항

- **[INFO]** `overrides.nanoid` 가 특정 경로(`postcss>nanoid`)가 아니라 **무-scope**로 걸려 있어, 워크스페이스 전체의 `nanoid` 해석을 강제로 통일시키는 광역 부작용을 가진다.
  - 위치: `pnpm-workspace.yaml:62` (`  nanoid: ^3.3.17`), 동일 항목이 `pnpm-lock.yaml` 의 `overrides:` 블록과 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES`(`"nanoid": "^3.3.17"`, gate 54)에도 미러됨.
  - 상세: 기존 `next>postcss` override 는 특정 경로에 scope 됐는데(`pnpm-workspace.yaml:55` 문맥), 이번 `nanoid` 항목은 scope 없이 패키지명만 적혀 있어 `postcss>nanoid` 경로 외에 향후 어떤 패키지가 `nanoid` 를 직접 의존으로 추가하더라도 조용히 `^3.3.17` 로 강제 재해석된다. 지금은 lockfile 실측상 `nanoid` 소비자가 `postcss` 전이 경로 하나뿐이라(직접 의존 0건, `grep` 확인) 실질적 회귀는 없고, plan 문서(`plan/in-progress/ci-required-check-skip-jobs.md` §부수)가 "두 postcss 경로 모두 덮어야 한다"는 근거로 이 선택을 명시적으로 정당화한다. 부작용 관점에서는 "왜 scope 안 했는지"가 문서화돼 있고 실제 영향 범위가 실측으로 확인됐다는 점에서 낮은 위험.
  - 제안: 조치 불요. 다만 후속으로 워크스페이스에 `nanoid` 직접 의존이 추가되면 이 override 가 그 버전도 함께 재작성한다는 점을 인지하고 있을 것.

- **[INFO]** `pnpm-lock.yaml` 재생성으로 `@img/sharp-libvips-linux-*`·`@css-inline/*` 의 `libc: [glibc|musl]` 필드 57줄이 이번 변경(단 2개 패키지 버전 변경)과 무관하게 함께 사라짐 — lockfile 전체 재작성의 부수 노이즈.
  - 위치: `pnpm-lock.yaml` (예: gate 1211/1217/1223/1229 부근, `libc:` 라인 삭제)
  - 상세: 원인이 실측으로 특정돼 있고(`pnpm@10.23.0` 이 축약 packument 를 써서 `libc` 필드를 채우지 않음) `plan/in-progress/deps-guard-hardening.md` §후속에 P3 로 이미 등재돼 있다. 코드 동작에는 영향 없음(`--frozen-lockfile` 검증은 `libc` 를 참여시키지 않음) — 진행 중인 저장소 차원의 진동이며 이 PR 이 새로 만든 결함은 아니다.
  - 제안: 조치 불요, 이미 별도 후속 항목으로 추적됨.

- **[정보/확인]** 직전 리뷰 라운드(11_40_34)의 side_effect/concurrency WARNING — "`changes` 잡이 실패/취소되면 `needs: changes` 하위 잡이 `skipped` 로 떨어져 required-check 모호함이 재발" (W3) — 는 이번 diff 에서 `if: ${{ !cancelled() }}` 잡-레벨 조건(`deps-security-checks.yml` gate 78/103/130, `frontend-checks.yml` gate 58)으로 닫혀 있음을 확인했다. GitHub Actions 의 `needs`-실패 시 자동 skip 규칙은 `if:` 표현식에 `cancelled()`(또는 `always()`/`success()`/`failure()`) 등 상태 함수가 포함되면 무시되므로, `changes` 잡이 `failure` 로 끝나도(취소가 아닌 한) 하위 잡은 계속 실행되고 `needs.changes.outputs.relevant` 빈 문자열은 `!= 'false'` 로 fail-safe 하게 검사를 돌린다. `test_workflow_yaml_structure.py::_JOB_CONDITIONS` 등재로 문자열 변형도 고정돼 있다 — 새로운 부작용 없음.
  - 위치: `.github/workflows/deps-security-checks.yml`, `.github/workflows/frontend-checks.yml`, `.claude/tests/test_workflow_yaml_structure.py:196-199`(gate)

- **[정보/확인]** 동일 라운드의 W4(`push` 트리거 광역화 — main 으로의 모든 push 가 무조건 전체 잡 실행) 도 `scripts/ci-paths-changed.sh` 의 `push` 분기(`PUSH_BEFORE_SHA`/`PUSH_AFTER_SHA` 실제 diff 비교, `pull_request`·`push` 전용 env 를 각 워크플로가 `changes` 잡에 전달)로 닫혀 있음을 스크립트 원본(`scripts/ci-paths-changed.sh:61-70`)과 `test_ci_paths_changed.py::PushEventTest` 로 재확인했다 — 새로운 부작용 없음.

### 요약

핵심 변경은 GitHub Actions 워크플로 트리거(`on.pull_request.paths`/`on.push.paths` 제거) 와 스텝 단위 조건부 게이팅으로, "잡은 항상 success 로 보고하되 무관한 PR 에서는 실제 스텝만 건너뛴다"는 의도된 동작 변화 자체가 이 PR 의 목적이며 광범위하게 문서화돼 있다. 직전 라운드에서 지적된 barrier(`changes` 잡) 실패 시 하위 잡 skip 전파와 push 트리거 광역화라는 두 실질적 부작용은 `if: !cancelled()` + 조건 반전(`!= 'false'`)과 push 전용 SHA 비교로 정확히 닫혔음을 GitHub Actions 상태-함수 시맨틱스 기준으로 검증했다. 남은 것은 `nanoid` override 의 무-scope 적용(실측상 영향 범위 1곳뿐, 문서화됨)과 lockfile `libc:` 필드 churn(별도 후속 P3 로 추적 중) 두 가지뿐이며 둘 다 저강도이고 이미 disclosure 돼 있어 신규 미검토 부작용은 발견되지 않았다. 함수/API 시그니처 변경, 전역 변수 오남용, 예상 밖 파일시스템 쓰기, 의도치 않은 네트워크 호출은 발견되지 않았다.

### 위험도
LOW
