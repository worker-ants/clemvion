# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `--strict-peer-dependencies` 추가가 9개 소비 잡(5개 워크플로) 전 필터 스코프에서 안전함을 실측으로 확인
  - 위치: `.github/actions/pnpm-workspace/action.yml` (install 스텝, 프롬프트 gate 82 / 현재 라인 85) — 소비처는 `.github/workflows/{backend-checks,frontend-checks,web-chat-checks,packages-checks,spec-link-checks}.yml`
  - 상세: 요청받은 "8개 워크플로 전수 확인"을 실제로 수행했다. 저장소에서 이 액션을 부르는 `--filter` 값은 실제로 5개 워크플로·9개 잡 엔트리에 걸쳐 10가지다 — `frontend...`(frontend-checks `test-and-build`, spec-link-checks `spec-link-integrity`) · `backend...`(backend-checks `lint`/`unit`/`typecheck-ratchet`) · `@workflow/web-chat...`·`channel-web-chat...`·`@workflow/sdk...`(web-chat-checks 3잡) · `@workflow/{ai-end-reason,expression-engine,graph-warning-rules,node-summary,chat-channel-validation}...`(packages-checks matrix 5종). 리뷰 대상 워크트리는 건드리지 않고 `rsync` 로 별도 scratch 디렉터리에 저장소를 복제한 뒤(`git` 명령 미사용), 위 10개 스코프 각각 + 전체 workspace 에 대해 `pnpm install --frozen-lockfile --strict-peer-dependencies --filter "<scope>"` 를 직접 실행했다. **11회 실행 전부 exit 0, `unmet peer` 로그 0건**이었다(최초 `--offline` 시도만 `ERR_PNPM_NO_OFFLINE_TARBALL` 로 실패했는데 이는 로컬 store 캐시 미스일 뿐 peer 관련 실패가 아니었고, 네트워크 허용 재시도로 전부 통과했다). 즉 이번 diff 는 현재 어느 소비 잡도 새로 깨뜨리지 않는다 — plan 문서의 "규칙 없이 exit 0, unmet peer 0건" 주장이 전체 workspace 뿐 아니라 **개별 필터 스코프 전수에서도** 성립함을 별도로 재확인했다.
  - 제안: 없음(확인 완료). 참고로 `codebase/frontend/Dockerfile:38`·`codebase/backend/Dockerfile:41` 의 이미지 빌드용 `pnpm install --frozen-lockfile` 은 이번 diff 범위 밖이라 `--strict-peer-dependencies` 를 받지 않는다 — plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md:28`)가 "CI/로컬 게이트" 라고 적은 것과 실제 도입 범위(CI 전용) 사이에 약간의 괴리가 있으나, CI 자동 신호 확보라는 목적은 이미 충족되므로 결함은 아니다.

- **[WARNING → 이미 정정됨, 확인 필요]** `pnpm-workspace.yaml` 신규 주석이 게이트 실제 시행 위치를 잘못 지목 (프롬프트 스냅샷 기준)
  - 위치: `pnpm-workspace.yaml:127` (프롬프트에 제시된 diff 기준)
  - 상세: 프롬프트로 제시된 diff 버전에서는 "peer dependency 게이트" 주석이 `--strict-peer-dependencies` 의 시행 위치를 `.github/workflows/deps-security-checks.yml` 로 지목하고 있었다. 그런데 `deps-security-checks.yml` 을 직접 열어 확인한 결과 그 워크플로의 3개 잡(`config-guard`/`audit`/`override-floors`) 은 `pip install`·`pnpm audit`·`check-*.py` 실행만 하고 **`pnpm install` 자체를 전혀 실행하지 않으며**, `.github/actions/pnpm-workspace` 액션도 소비하지 않는다(`pnpm-workspace\|actions/pnpm-workspace\|strict-peer\|pnpm install` grep 0건). 실제 시행 지점은 리뷰 대상 파일 2(`.github/actions/pnpm-workspace/action.yml`)의 install 한 줄이고, 그 잡들이 위 INFO 항목에 정리한 5개 워크플로다. 이 저장소가 반복적으로 겪어 온 "게이트가 문서가 가리키는 곳과 다른 곳에서 돈다" 류 결함과 같은 클래스이며, 미래 유지보수자가 이 주석을 따라 `deps-security-checks.yml` 을 고치면서 실제 시행 지점은 그대로 두는 실수를 유발할 수 있다.
  - **중요 — 리뷰 도중 확인한 현재 상태**: 이 워크트리는 다른 세션과 공유 중이며, 리뷰를 진행하는 동안 위 결함이 **커밋되지 않은 워킹트리 변경으로 이미 정정되어 있었다.** `git diff HEAD -- pnpm-workspace.yaml`(git 상태 조회만 수행, 워킹트리 변경 없음)로 확인한 결과 현재 `pnpm-workspace.yaml:126-129` 는 "소재지는 **`.github/actions/pnpm-workspace/action.yml` 의 install 한 줄**이다(8개 워크플로가 그 action 을 거친다)" 로 정확히 정정되어 있다. 함께 `.github/actions/pnpm-workspace/action.yml`(description·"이제 두 플래그 모두에 대한 서술" 주석 추가)과 `.claude/tests/test_pnpm_workspace_action.py`(테스트명을 `test_pnpm_receives_both_gate_flags_and_the_filter` 로 변경 + `ARGC=5` 파생 근거 주석 추가)도 프롬프트 스냅샷 이후 추가로 손이 간 상태다(`.claude/tests/README.md`, `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 도 함께 미커밋 변경 중).
  - 제안: 위 정정판이 최종 커밋에 그대로 실리는지만 확인. 정정판을 되돌리거나 이 리뷰가 스냅샷 기준 문제를 다시 "고치는" 중복 조치는 불필요.

## 요약

요청받은 핵심 검증 — `.github/actions/pnpm-workspace` 의 install 한 줄에 `--strict-peer-dependencies` 를 추가하는 것이 필터 스코프가 다른 9개 소비 잡 중 어느 하나라도 새로 깨뜨리는지 — 은 실제로 10개 필터 스코프 + 전체 workspace 를 리뷰 워크트리와 격리된 사본에서 직접 실행해 전수 확인했고, 전부 exit 0·unmet peer 0건으로 안전함을 실측했다. 리뷰 도중 프롬프트 스냅샷에 남아 있던 문서 부정확(피어 게이트 시행 위치를 `deps-security-checks.yml` 로 잘못 지목)을 발견했으나, 이는 공유 워크트리에서 동시 진행 중인 다른 작업으로 이미 정정되어 있어(미커밋) 잔여 조치는 "정정판이 커밋에 포함되는지 확인" 정도로 축소된다. 그 외 전역 상태·시그니처·인터페이스·환경변수·네트워크·이벤트 콜백 관점에서 의도치 않은 부작용은 발견되지 않았다.

## 위험도
LOW
