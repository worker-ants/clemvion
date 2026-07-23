# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `e2e.yml` 에 `workflow_dispatch:` 트리거 추가는 요청(I3: `paths-ignore` 에 `.github/**` 누락 수정) 자체보다 한 걸음 넓은 변경
  - 위치: `.github/workflows/e2e.yml` 34행 (`+  workflow_dispatch:`)
  - 상세: I3 의 원 요청은 "`paths-ignore` 에 `.github/**` 누락"만이다. `workflow_dispatch` 추가는 그 자체로는 별개 기능(수동 트리거 채널)이다. 다만 diff 내 인라인 주석(8~15행)과 `plan/in-progress/harness-guard-followups.md` 245~247행에 "이 fix 를 하면 e2e.yml 자신을 고친 PR 이 e2e 를 못 돌리게 되는데 마침 이 워크플로엔 수동 트리거가 없었다"는 인과관계가 명시돼 있어, 이번 fix 가 스스로 만드는 회귀(향후 e2e.yml 변경이 검증 안 됨)를 막기 위한 직접적 부수 조치로 정당화된다. 이는 project convention(부수 결정도 diff/plan 에 명시)에 부합하며 임의의 기능 확장으로 보기 어렵다.
  - 제안: 별도 조치 불필요. 현재처럼 plan 에 "부수 결정"으로 명시된 상태를 유지하면 충분.

## 그 외 확인한 사항 (문제 없음)

- 실제 diff(`git diff origin/main --stat`)는 정확히 4개 파일만 변경(`test_dependabot_npm_coverage.py` 신규, `e2e.yml`, `harness-checks.yml`, `harness-guard-followups.md`) — 프롬프트에 제시된 파일 목록과 완전히 일치하며 스코프 밖 파일 변경 없음.
- `test_dependabot_npm_coverage.py` 는 plan §F 잔여 defer 항목 **W5**("커버리지 매트릭스 무결성 가드 부재")를 정확히 구현한 신규 테스트이며, 기존 실 결함(undici HIGH·dompurify moderate, 별건 PR 로 이미 fix됨) 재발을 막는 회귀 가드 목적에 집중돼 있다. 관련 없는 로직 추가 없음.
- `import _harness  # noqa: F401` 패턴은 저장소 내 다른 12개 이상의 테스트 파일에서 동일하게 사용되는 기존 관례이며, 이 PR 이 새로 도입한 스타일이 아니다(`grep` 확인).
- `harness-checks.yml` 의 `dependabot.yml`/`pnpm-workspace.yaml` paths 추가는 신규 테스트 파일이 그 두 파일을 직접 파싱하므로, "가드를 깨뜨리는 파일 변경이 가드 자신을 트리거하지 못하는" 이 저장소가 반복 겪어온 실패 클래스를 막기 위한 직접적으로 필요한 동반 변경이다(무관한 확장 아님).
- `plan/in-progress/harness-guard-followups.md` 변경은 §F 잔여 defer 섹션의 I3·W5 두 항목만 `[ ]` → `[x]` 로 갱신하고 완료 내용을 기록한 것으로, diff 범위가 정확히 그 절에 한정된다(체크리스트 하단 F 항목은 이미 이전 커밋에서 `[x]` 상태였고 이번 diff 가 건드리지 않음). "체크박스는 실제 완료 후에만, 그 커밋에 포함" 이라는 프로젝트 관례에 부합.
- 포맷팅/주석/임포트 관점에서 실질 변경과 무관한 개행·공백·주석 정리·불필요 임포트 정리는 발견되지 않음. 추가된 주석은 모두 "왜 이 경로가 필요한가"를 설명하는 프로젝트 표준 WHY-comment 패턴(기존 워크플로 파일에도 다수 존재)과 일치.
- 설정 변경(`e2e.yml`, `harness-checks.yml`)은 모두 이번 작업이 의도한 대상 그 자체(CI 트리거 drift 수정)이며 의도치 않은 부수 설정 변경은 없음.

## 요약

diff 는 plan `harness-guard-followups.md` §F 잔여 defer 의 I3(e2e.yml paths-ignore 누락)·W5(dependabot 커버리지 가드 부재) 두 항목에 정확히 대응하며, 실제 변경 파일도 4개로 프롬프트·plan 서술과 완전히 일치한다(무관 파일 없음). e2e.yml 의 `workflow_dispatch` 추가는 원 요청보다 한 걸음 넓지만, 그 fix 자체가 유발하는 자기-회귀(향후 e2e.yml 변경이 검증되지 않음)를 막기 위한 필연적 부수 조치이며 diff·plan 양쪽에 그 인과관계가 명시돼 있어 scope creep 이라기보다 정당화된 최소 확장으로 판단된다. 그 외 리팩토링·기능확장·무관 수정·포맷팅 뒤섞임·불필요 주석/임포트 변경은 발견되지 않았다.

## 위험도

LOW
