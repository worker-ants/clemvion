# 부작용(Side Effect) 리뷰 — docs-guard-trigger (2026-09-24 21:35:51)

## 검토 범위 메모

리뷰 대상 33개 파일 중 함수/전역변수/시그니처/환경변수/네트워크 축이 실제로 적용되는 파일은 없다.
핵심 기능 변경은 `.github/workflows/spec-link-checks.yml`(CI workflow YAML) 과 신규 하네스 테스트
`.claude/tests/test_spec_link_checks_scope.py` 뿐이고, 나머지는 문서(`PROJECT.md`, `CHANGELOG.md`,
`.claude/tests/README.md`), plan(`plan/in-progress/docs-guard-trigger.md`), 그리고 이 작업 자체의
이전 라운드 리뷰/컨시스턴시 체크 산출물(`review/code/2026/09/24/21_16_58/**`,
`review/consistency/2026/09/24/21_04_26/**`, `review/consistency/2026/09/24/20_34_01/meta.json`)
이다. 저장소 파일은 어떤 것도 뮤테이션하지 않았다 — `git status --short` 로 확인, 이 리뷰 세션 자신의
출력 디렉터리(`review/code/2026/09/24/21_35_51/`)만 untracked로 남아 있다.

새 테스트 `.claude/tests/test_spec_link_checks_scope.py` 는 `WORKFLOW.read_text()` 로 워크플로
YAML을 읽기만 하고, import 하는 `test_harness_checks_paths_coverage.parse_pathspecs_block` 도
순수 문자열 파서(부작용 없음)임을 직접 코드를 열어 확인했다. 해당 모듈의 모듈 레벨 코드도 상수
선언(`Path` 조합)뿐이라 import 시점에 즉시 트리거되는 파일시스템 스캔 등은 없다.

## 발견사항

- **[INFO]** required-check 앵커 job id 의 "실질 계약"이 이름 변경 없이 넓어짐
  - 위치: `.github/workflows/spec-link-checks.yml` — job 정의 `spec-link-integrity:`(93행), 실행 스텝
    `run: pnpm --filter frontend test src/lib/docs/__tests__/`(118행)
  - 상세: `test_workflow_yaml_structure.py` 가 `("spec-link-checks.yml", "spec-link-integrity")` 를
    job id 로만 고정하므로 하네스 가드는 깨지지 않는다. 다만 이 job 이 대외적으로 보여주는 이름은
    그대로인데(`spec-link-integrity` — "링크 무결성"), 실제로 도는 내용은 `spec-link-integrity.test.ts`
    단일 가드에서 `src/lib/docs/__tests__/` 디렉터리 전체(plan-frontmatter·spec-frontmatter·
    spec-pending-plan-existence 등 다수)로 확장됐다. 지금은 등록된 required status check 가 없다고
    plan(`plan/in-progress/docs-guard-trigger.md` §C)이 실측했으므로 당장 깨지는 소비자는 없지만,
    향후 이 이름이 branch protection/ruleset 의 required check 로 등록되면 "왜 이 체크가 빨간불인가"를
    이름만으로 추론하는 사람에게 오도 가능성이 남는다. 이전 라운드 리뷰(`review/code/2026/09/24/21_16_58/side_effect.md`,
    `architecture.md`)와 consistency `naming_collision`(INFO #7)이 동일 사안을 이미 지적·기록했다 —
    새 결함이 아니라 재확인.
  - 제안: 조치 불요(설계 의도, 주석에 근거 명시됨 — `#1106`). 후속: required check 등록 시점에
    description/PR 템플릿으로 실제 범위를 노출.

- **[INFO]** "가벼운 대체 트리거" 불변식이 디렉터리 내용에 암묵적으로 결합됨
  - 위치: `.github/workflows/spec-link-checks.yml:116-118`(`docs guards (src/lib/docs/__tests__ 전체)` 스텝)
  - 상세: 파일 열거 → 디렉터리 전체 실행으로 바꾼 목적(새 docs 가드 추가 시 워크플로를 잊지 않음)은
    타당하지만, 그 결과 이 워크플로가 "무엇을 실행하는가/얼마나 무거운가"가 이제 이 YAML 파일이
    아니라 `codebase/frontend/src/lib/docs/__tests__/` 디렉터리에 어떤 파일이 존재하는지에 달려 있다.
    즉 이 워크플로 파일을 전혀 건드리지 않고 그 디렉터리에 무거운(네트워크·긴 타임아웃) 테스트를
    추가하는 것만으로 이 job 의 실행 시간·실패 표면이 조용히 바뀔 수 있다. 순수 회귀는 아니고
    plan/헤더 주석이 트레이드오프로 명시했으나("가벼운 docs 가드만 존재해야 한다"는 관례일 뿐 코드로
    강제되지 않음), 부작용 관점에서 "이 파일을 안 고쳐도 이 job 의 동작이 바뀔 수 있다"는 사실 자체는
    기록해 둘 가치가 있다.
  - 제안: 조치 불요(이번 PR 스코프 밖, 이미 architecture 리뷰에서 후속 검토로 분류됨).

- **[INFO]** 이미 병합된 이전 PR(#1389)의 영구 리뷰 기록을 이번 커밋에서 소급 수정
  - 위치: `review/consistency/2026/09/24/20_34_01/meta.json:3-4`(`mode`, `target_path`), `:12`(`scope_note` 추가)
  - 상세: 이 파일은 이번 작업(`docs-guard-trigger`)이 아니라 **한 커밋 전에 이미 머지된**
    `1a8ddca8b`(`fix(docs-guard): pending_plans 가드가 「그게 plan 인가」를 묻는다 (#1389)`)의
    `--impl-done` 산출물이다. 이번 changeset(`32b97f944` 계열)이 그 파일의 `mode`/`target_path` 를
    세션 전용 scratch 절대경로에서 저장소 상대경로(`spec/conventions/spec-impl-evidence.md`)로
    소급 수정하고, 원래 근거는 `scope_note` 로 보존했다. 내용을 지우지 않고 왜 고쳤는지까지 남긴
    처리는 적절하지만, "이번 PR 의 진단 대상이 아닌, 이미 랜딩된 다른 PR 의 영구 기록 파일을 수정한다"
    는 것 자체는 `git diff` 상 이번 PR 의 직접 관심사(스코프) 밖 파일을 건드리는 흔치 않은 패턴이라
    부작용 리뷰 관점에서 명시적으로 짚어 둔다. RESOLUTION(`review/code/2026/09/24/21_16_58/RESOLUTION.md`
    Warning 1)이 이 결정을 의도적으로 문서화했고, `spec_impact`/게이트 우회는 아니다(비-코드 리뷰 산출물).
  - 제안: 조치 불요 — 이미 disclosed·justified. 다만 이런 "지난 PR 기록의 소급 정정"이 다시 필요할
    경우, 정정 커밋 메시지/RESOLUTION 에 대상 PR 번호를 명시하는 관례를 계속 유지할 것(이번엔 잘 지켜짐).

## 부재 확인 (긍정적 관찰)

- 전역 변수·모듈 레벨 상태 변경: 없음 (YAML/Markdown/plan 문서, 순수 함수 파서 하나).
- 함수/메서드 시그니처 변경: 없음.
- 공개 API(REST/DTO 등) 변경: 없음.
- 환경 변수 신규 읽기/쓰기: 없음.
- 네트워크 호출: 없음 (워크플로는 `actions/checkout`·`pnpm --filter frontend test` 뿐이며 신규
  외부 서비스 호출 없음).
- 예상치 못한 파일시스템 부작용: 없음 — 신규/수정 파일 전부가 plan 이 명시한 스코프(워크플로,
  문서, 회귀 테스트, 리뷰 산출물) 안에 있고, 이전 라운드 WARNING(scratch 절대경로 영구 기록)은
  이미 해당 커밋(`32b97f944`)에서 정정 확인됨(`review/consistency/2026/09/24/21_04_26/meta.json`,
  `review/consistency/2026/09/24/20_34_01/meta.json` 모두 저장소 상대경로 + `scope_note`).

## 요약

핵심 변경(`spec-link-checks.yml` 의 pathspec 확장 + 단일 파일→디렉터리 실행, `PROJECT.md` 동기화,
신규 회귀 테스트)은 전역 상태·시그니처·환경변수·네트워크 등 전통적 부작용 축에 해당하는 위험을
만들지 않는다. 남는 것은 세 건의 INFO — (1) required-check 앵커 job id 의 이름-범위 불일치가
이름을 바꾸지 않은 채 더 넓어짐, (2) "가벼운 트리거" 불변식이 디렉터리 내용에 암묵적으로 결합돼
이 워크플로 파일을 안 고쳐도 동작이 바뀔 수 있음, (3) 이미 병합된 이전 PR(#1389)의 영구 리뷰
기록을 이번 커밋에서 소급 수정(투명하게 disclosed·justified) — 이며 셋 다 차단 사유가 아니다.
이전 라운드(`21_16_58`)에서 지적된 유일한 WARNING(consistency meta.json 의 scratch 경로 영구
기록)은 실제로 `32b97f944` 커밋에서 두 파일 모두 정정됐음을 직접 확인했다.

## 위험도
LOW
