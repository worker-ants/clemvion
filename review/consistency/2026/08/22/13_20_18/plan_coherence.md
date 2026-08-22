### 발견사항

- **[WARNING]** "정본 트래커 항목 `[x]`" 작업 항목이 갱신 대상 파일을 명시하지 않는다
  - target 위치: `plan/in-progress/mirror-guard-single-copy.md` §작업 — `- [ ] 정본 트래커 항목 [x] + 대체 근거 (구현 커밋과 같은 턴)`
  - 관련 plan: `plan/in-progress/masked-marker-shared-package.md:165` §후속(이 PR 밖) — *"미러 가드 탐지 로직을 공유 test-utility 로 재추출"* (target 서문이 인용한 문구와 정확히 일치, 저장소 전체에서 이 표현이 등장하는 유일한 두 곳이 target 자신과 이 라인이다)
  - 상세: target 은 이 항목을 닫는다고 서문에서 밝히지만, "작업" 체크리스트의 실행 항목은 어느 파일의 어느 라인을 갱신해야 하는지 적지 않았다. 같은 소스 plan(`masked-marker-shared-package.md`) 안에는 성격이 다른 항목(`:373`·`:757`, `spec-sync-external-interaction-api-gaps.md` 소재)이 이미 "정본 트래커" 로 불리고 있어, 실행자가 그쪽을 갱신 대상으로 착각할 여지가 있다. 게다가 `masked-marker-shared-package.md` 는 별도의 살아있는 worktree(`masked-marker-contract-7d2e14`)에 있고 본문 체크리스트는 `/ai-review` 1건만 남아 거의 완료 상태다(핵심 산출물 — `codebase/packages/masked-markers/`, 양쪽 마커 미러 가드 파일 — 은 이미 본 worktree 기준선에 존재해 그 PR 은 실질적으로 머지된 것으로 보인다). target 의 PR 이 착지할 시점에는 그 plan 이 `plan/complete/` 로 이동해 있을 수 있어, "정본 트래커 항목" 을 찾다가 `plan/in-progress/` 에서 못 찾는 상황이 생길 수 있다.
  - 제안: target 의 해당 작업 항목을 `plan/in-progress/masked-marker-shared-package.md:165`(또는 그 시점에 `plan/complete/` 로 이동했다면 그 경로) 로 구체화하고, 이 plan 이 자신의 §"다른 plan 과의 관계" 절에서 `:373`·`:757` 을 명시 인용한 선례를 그대로 따라 파일·앵커를 적는다.

- **[INFO]** `frontend-checks.yml` 의 pathspec 확장 근거가 target 변경으로 부분 무효화될 수 있음(plan 밖 코드 주석이라 참고용)
  - target 위치: target §설계 — `.github/workflows/repo-guards.yml` 신설, pathspec `codebase/**`
  - 관련 plan: 직접적인 plan 파일은 아니지만, `plan/in-progress/masked-marker-shared-package.md` 의 §"등록 표면" 서술과 짝을 이루는 실제 코드 주석 — `.github/workflows/frontend-checks.yml:44-49` — 이 "마커 SoT 미러 가드가 이 잡에 산다 … 대신 여기서 트리거를 넓힌다(`11_53_49` architecture W1)" 라고 `codebase/channel-web-chat/**`·`codebase/packages/**` 를 `frontend-checks` pathspec 에 포함한 이유를 명시하고 있다.
  - 상세: 그 확장은 오직 "미러 가드가 frontend 워크스페이스에서 돌아 서 backend 외 스택 변경도 잡아야 한다" 는 이유로 들어갔다. target 이 신설하는 `repo-guards.yml` 이 `codebase/**` 전체를 훑는 전용 잡으로 미러 가드를 이관하면, 그 확장 근거는 (적어도 이 가드에 대해서는) 소멸한다 — 다만 target 의 §"남기는 것과 지우는 것" 은 frontend 사본(spec)을 삭제하지 않고 그대로 두므로, 결과적으로 미러 가드가 `frontend-checks.yml`(frontend/channel-web-chat/packages 경로)과 신규 `repo-guards.yml`(전체 경로) 양쪽에서 중복 실행된다. 해롭지는 않지만 target 문서 어디에도 이 중복이나 기존 주석의 사실 정확성 재검토가 언급되지 않는다.
  - 제안: target 작업에 "frontend-checks.yml 주석·pathspec 이 여전히 유효한지(다른 이유로도 channel-web-chat/packages 트리거가 필요한지) 확인 — 아니면 주석을 갱신하거나 중복 실행을 명시적으로 수용" 항목을 추가할지 검토. plan 정합성 관점에서는 차단 사유가 아니라 참고 메모.

### 요약
target(`mirror-guard-single-copy.md`)이 닫으려는 "미러 가드 탐지 로직을 공유 test-utility 로 재추출" 항목은 `plan/in-progress/masked-marker-shared-package.md:165` 의 후속 목록에 실재하며, target 의 CI-잡 중심 설계(등록 표면 실측 표 포함)는 그 plan 이 이미 확립한 사실(원 마커 SoT 이관, backend/frontend 사본 각 162/165줄, `frontend-checks`/`backend-checks` 의 경로 게이팅 비대칭)과 모두 정합했다 — 코드베이스 실측으로도 전제가 그대로 확인된다. 유일한 실제 갭은 트래커 항목을 닫는 작업 지시가 구체 파일·라인을 적지 않아, 병렬로 진행 중인 원 plan 이 완료(→ `plan/complete/` 이동) 되는 시점과 맞물려 실행자가 갱신 대상을 놓칠 여지가 있다는 것(WARNING 1건). 그 외 CRITICAL 급 미해결 결정 충돌이나 선행 plan 미해소는 발견되지 않았다.

### 위험도
LOW
