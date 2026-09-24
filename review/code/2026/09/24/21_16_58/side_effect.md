# 부작용(Side Effect) 리뷰

## 검토 범위 메모

리뷰 대상 11개 파일 중 실제 "코드"에 해당하는 것은 `.github/workflows/spec-link-checks.yml`(CI workflow YAML) 과 `PROJECT.md`(문서) 뿐이다. 나머지 8개(`plan/in-progress/docs-guard-trigger.md`, `review/consistency/2026/09/24/21_04_26/**`)는 이번 작업 자체의 산출물(plan·consistency-check 리포트)이다. 함수/전역변수/시그니처 개념이 적용되지 않는 영역이라, 점검 관점을 "CI 워크플로의 트리거·실행 범위·외부 계약" 및 "커밋되는 산출물의 재현성" 쪽으로 치환해 분석했다. 저장소 파일은 어떤 것도 수정하지 않았다(`git status --short` 로 확인 — 이 리뷰 세션 자신의 출력 디렉터리만 untracked).

## 발견사항

- **[INFO]** required-check 앵커로 쓰이는 job id 의 "실질 계약"이 이름 변경 없이 조용히 넓어짐
  - 위치: `.github/workflows/spec-link-checks.yml` — job 정의 `spec-link-integrity`(주석은 85~89행, job 은 90행), 실행 커맨드는 115행(`run: pnpm --filter frontend test src/lib/docs/__tests__/`)
  - 상세: 이 job 은 `test_workflow_yaml_structure.py:262` 가 `("spec-link-checks.yml", "spec-link-integrity")` 튜플로 **job id 만** 고정하고 있어(step 이름은 고정 대상이 아님 — 직접 확인), 이번 변경으로 harness 가드가 깨지지는 않는다. 다만 이 job 의 "외부 인터페이스"(향후 branch protection/ruleset 이 required check 로 등록할 때 참조하는 이름)는 그대로인데, 실제로 도는 내용은 `spec-link-integrity.test.ts` 단일 가드에서 `src/lib/docs/__tests__/` 디렉터리 전체(약 28개 가드: plan-frontmatter·spec-frontmatter·guide-identifier-existence 등)로 넓어졌다. 지금은 required status check 가 하나도 등록돼 있지 않다는 것을 plan 자신이 실측했으므로(§C) 당장 깨지는 소비자는 없지만, 이름이 좁은 의미(link integrity)를 계속 암시한 채로 실질 책임 범위만 커지는 형태라 향후 required check 로 등록되는 시점에 "이 체크가 왜 이 이유로 빨간불이 됐는지" 를 이름만으로 추론하는 사람에게는 오도 가능성이 있다. (동일 사안을 consistency naming_collision checker 도 INFO #7 로 이미 지적했다 — 중복 확인.)
  - 제안: 조치 불요(설계 의도, 주석에 근거 명시됨). 다만 향후 이 job 이 required check 로 실제 등록되면, 등록 시점에 이름 대신 "설명(description)" 필드나 PR 템플릿에 "이 체크는 link-integrity 외 plan/spec frontmatter 가드도 포함한다" 를 노출하는 것을 고려.

- **[WARNING]** 커밋되는 consistency-check 산출물이 세션 한정 임시 scratch 경로를 영구 기록으로 남김
  - 위치: `review/consistency/2026/09/24/21_04_26/meta.json:4`(`target_path`) 및 같은 파일 3행(`mode`)
  - 상세: 두 필드 모두 `/private/tmp/claude-501/-Volumes-project-private-clemvion/9bc8ff42-8873-4ae7-986a-b884a1fefbf6/scratchpad/prep-scope-2` 라는 이 세션 전용 scratch 디렉터리의 절대경로를 담고 있다. 이 환경의 Scratchpad 규약 자체가 "session-specific" 이라고 명시하듯, 이 경로는 세션 종료 후(그리고 다른 사용자/머신에서는 애초부터) 존재하지 않는다. 저장소의 다른 모든 `meta.json` 선례를 대조하면 이 필드는 항상 저장소 상대경로의 의미 있는 대상을 가리켰다 — 예: `review/consistency/2026/07/03/21_22_28/meta.json`(`"target_path": "spec/5-system/"`, 동일 `--impl-prep` 모드), `review/consistency/2026/06/06/13_43_53/meta.json`(`"target_path": "spec/5-system/4-execution-engine.md"`). plan 체크리스트가 스스로 밝히듯("그 파일 하나만 담은 scope 로 다시 준비") context 예산을 피하려 임시 scratch 번들을 만든 것 자체는 합리적 우회지만, 그 결과로 생긴 `target_path`/`mode` 값을 그대로 영구 리포지토리 이력(`review/` 는 gitignore 대상이 아님)에 박아 넣으면 향후 이 리뷰를 다시 열람하는 사람이나 자동화 도구가 "무엇을 검토했는지" 를 그 필드만으로 복원할 수 없다 — 가리키는 대상이 이미 `spec/conventions/spec-impl-evidence.md` 임을 plan 본문에서만 알 수 있고, 산출물 자신은 사라진 임시 경로만 증거로 남긴다.
  - 제안: `target_path`/`mode` 를 실제 검토 대상의 의미 있는 저장소 경로(`spec/conventions/spec-impl-evidence.md`)로 정정하거나, 최소한 scratch 경로 옆에 실제 대상 경로를 병기한다. 이번 PR 병합 전에 고치는 것이 좋다 — 병합 후에는 `review/complete` 성격의 영구 기록이 된다.

- **[INFO]** 실행 범위 확장이 CI 실패 표면을 넓힘 — 의도된 트레이드오프, 측정됨
  - 위치: `.github/workflows/spec-link-checks.yml:115`, pathspec 추가는 69~71행
  - 상세: (a) `plan/**` 이 pathspec 에 추가되어 이전엔 스킵됐던 plan-only PR/commit(plan 체크박스 갱신, `complete/` 이동 등)도 이 job 을 트리거하게 된다. (b) 실행 커맨드가 단일 테스트 파일에서 디렉터리 전체로 넓어져, 이 job 이 이제 spec-link-integrity 와 무관한 다른 docs 가드(예: `guide-identifier-existence.test.ts`)의 실패에도 빨간불을 낸다. 둘 다 이 plan 이 명시적으로 의도한 변경이고, 로컬 실측(23파일 3567개, 수 초)까지 마쳤다고 체크리스트에 기록돼 있어 새로운 미측정 리스크는 아니다. 다만 "이 workflow 는 lightweight 대체 트리거" 라는 자기 서술과, 이제 무관한 가드의 flaky/실패가 이 job 을 오염시킬 수 있다는 사실 사이에 약간의 긴장이 생긴다는 점만 기록해 둔다 — 차단 사유는 아니다.
  - 제안: 조치 불요(트레이드오프 인지·측정됨).

## 요약

핵심 코드 변경(`spec-link-checks.yml` pathspec/실행범위 확장, `PROJECT.md` 동기화)은 전역 상태·환경변수·네트워크 호출·함수 시그니처 등 전통적 부작용 범주에 해당하는 위험을 만들지 않는다 — CI 워크플로 YAML 과 문서 갱신이라 그런 축이 애초에 존재하지 않는다. 발견된 두 항목은 성격이 다르다: job 이름·실행범위 불일치는 이미 설계 의도로 문서화돼 있고 harness 가드도 깨지지 않아 위험이 낮다(INFO). 반면 `review/consistency/2026/09/24/21_04_26/meta.json` 에 세션 전용 scratch 절대경로가 영구 기록으로 박힌 것은 이번 변경 세트가 실제로 만들어낸, 선례와 어긋나는 부작용이며 병합 전에 고칠 가치가 있다(WARNING). CI 자체의 트리거·실행범위 확장은 의도되고 실측된 트레이드오프로 판단된다.

## 위험도
LOW
