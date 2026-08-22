# Rationale 연속성 검토 — `plan/in-progress/mirror-guard-single-copy.md`

## 조사 방법

target 문서와 함께 번들된 `spec/**` 의 `## Rationale` 발췌(8개 spec 문서, 74개는 예산 초과로 생략)를
전수 대조했다. 아울러 target 이 "트래커 원안(공유 패키지)" 이라 지칭하는 대상의 실제 기록처를
추적하기 위해 저장소 내 관련 plan 문서(`plan/in-progress/masked-marker-shared-package.md`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)와 `codebase/packages/`,
`codebase/backend/Dockerfile`, `codebase/{backend,frontend}/package.json` 를 직접 확인했다.

## 발견사항

### [WARNING] "정본 트래커 항목 `[x]`" 가 가리키는 파일이 target 안에 명시되지 않아 dangling backlog 위험

- **target 위치**: `## 작업` 체크리스트, "- [ ] 정본 트래커 항목 `[x]` + 대체 근거 (구현 커밋과 같은 턴)" (target 발췌 라인 94)
- **과거 결정 출처**: `spec/` 가 아니라 `plan/in-progress/masked-marker-shared-package.md` (worktree
  `masked-marker-contract-7d2e14`, **status: in-progress**, `/ai-review` 미체크 — 아직 열려 있음)의
  `## 후속 (이 PR 밖)` 절, 첫 항목: *"미러 가드 탐지 로직을 공유 test-utility 로 재추출"*. 이 항목
  바로 옆에 그 문서 스스로 **"review/** 는 SoT 아니므로 여기 등재한다"** 고 적어 두어, 이 backlog
  항목의 **정본 기록처가 이 plan 문서 자신**임을 명시하고 있다.
- **상세**: target 의 `## Rationale` 은 "트래커 원안(공유 패키지)을 등록 표면 실측으로 뒤집었다" 고
  명시적으로 선언해 §3(결정 번복 시 새 Rationale 동반) 요건 자체는 충족한다 — 번복은 투명하고
  근거가 있다. 문제는 **작업 체크리스트의 표현**이다. 같은 PR 시리즈에서 "정본 트래커" 라는 관용구는
  `masked-marker-shared-package.md` 자신이 **다른 항목**(`:373`/`:757`)을 처분할 때
  `spec-sync-external-interaction-api-gaps.md` 를 명시적으로 지목하며 쓴 표현이다. 그런데 실측
  결과 `spec-sync-external-interaction-api-gaps.md` 에는 "미러 가드 탐지 로직을 공유
  test-utility 로 재추출" 문구가 전혀 없다(grep 0건) — 이 항목의 진짜 정본은
  `masked-marker-shared-package.md` 의 `## 후속` 불릿이다. target 문서가 파일 경로를 명시하지
  않은 채 "정본 트래커" 라고만 적으면, 구현자가 관용구를 따라 `spec-sync-external-interaction-api-gaps.md`
  를 열어 항목을 찾지 못하고 그대로 건너뛸 위험이 있다. 그 경우 `masked-marker-shared-package.md`
  (아직 다른 브랜치 `claude/masked-marker-contract-7d2e14` 에서 in-progress) 는 이미 다른 PR 이
  정반대 방향(패키지 대신 CI 잡)으로 처분한 항목을 계속 미해결 backlog 로 보유하게 되어, 나중에
  그 plan 을 읽는 사람이 "아직 패키지 추출이 필요하다" 고 오판할 수 있다 — plan 라이프사이클의
  체크리스트 동기화 원칙(동일 항목이 여러 문서에 등재된 경우 처분 시 전수 갱신) 위반이자 dangling
  reference 다.
- **제안**: target 의 해당 체크리스트 항목을 "정본 트래커(`plan/in-progress/masked-marker-shared-package.md`
  `## 후속 (이 PR 밖)` 첫 항목) `[x]` + 대체 근거" 로 파일 경로를 명시한다. 아울러 그 plan 이 아직
  다른 worktree 에서 in-progress 이므로, 착수 직전 병렬 세션 충돌(같은 항목을 두 세션이 동시에
  다른 방향으로 처분) 여부도 재확인할 것.

### [INFO] 기존 8개 `@workflow/*` 공유 패키지 선례와의 구분 근거를 Rationale 에 한 줄로 명문화하면 좋음

- **target 위치**: `## 왜 공유 패키지가 아닌가 — 등록 표면 비교 (실측)` 절 및 `## Rationale` 의
  "기각한 대안" 중 "공유 devDep 패키지" 항목 (target 발췌 라인 52-72, 118)
- **과거 결정 출처**: `plan/in-progress/masked-marker-shared-package.md` `## 선례가 정확히 같은
  형태다` 절 — `@workflow/ai-end-reason` 을 "backend 가 만들고 frontend 가 판정하는 값 도메인" 의
  선례로 들며 공유 패키지 추출을 옳은 해법으로 정당화한 문단. 실측 결과 저장소의 `codebase/packages/*`
  8개 패키지(`ai-end-reason`·`masked-markers`·`expression-engine`·`node-summary`·
  `chat-channel-validation`·`graph-warning-rules`·`sdk`·`web-chat-sdk`) 는 전부 backend/frontend
  `dependencies`(프로덕션 의존)로 등록돼 있고, devDependencies 전용 `@workflow/*` 패키지 선례는
  현재 하나도 없다(실측: `grep devDependencies` 0건).
- **상세**: target 의 구분(테스트 전용 devDep 패키지는 그럼에도 Dockerfile COPY 목록에 걸린다 —
  실제로 `codebase/backend/Dockerfile` 의 `pnpm install --frozen-lockfile` 단계는 모든 workspace
  package.json 을 개별 COPY 하므로 dep 종류와 무관하게 새 패키지는 최소 1줄씩 늘어난다)은 실측과
  부합하며 타당하다. 다만 target 문서 자체에는 "왜 이번 케이스만 기존 8개 선례와 다른가"를 한
  문장으로 짚는 명시적 교차 참조가 없어, 나중에 이 결정을 다시 읽는 사람이 "이 시리즈는 늘 공유
  패키지로 풀었는데 왜 이번만 아닌가" 하고 재문의할 가능성이 있다(방어적 명문화 제안 수준으로,
  차단 사유는 아님).
- **제안**: `## Rationale` 에 "기존 `@workflow/*` 8종은 모두 production dependency 이고, 본 후보만
  devDep-only 테스트 유틸이라는 점이 등록 표면 비대칭(Dockerfile 개입 여부)의 근원" 한 줄을
  추가하면 향후 재질의를 예방한다.

## 요약

번들된 `spec/**` 의 `## Rationale` 8개 문서 전수 대조 결과, target 이 명시적으로 기각된 spec 대안을
재도입하거나 spec 에 못박힌 설계 원칙·invariant 를 위반하는 지점은 발견되지 않았다. 이 target 은
`spec/` 이 아니라 형제 plan 문서(`masked-marker-shared-package.md`)가 남긴 "이 PR 밖" backlog
항목을 다루는데, 그 번복 자체는 투명하고("트래커 원안을 등록 표면 실측으로 뒤집었다") 자체
`## Rationale` 에 기각한 대안·실측 근거를 갖추고 있어 "무근거 번복" 에 해당하지 않는다. 다만
그 원 항목의 실제 정본 기록처(같은 형제 plan 문서 자신, 아직 별도 worktree 에서 in-progress)를
target 의 체크리스트가 파일 경로 없이 "정본 트래커" 로만 지칭해, 관용구 혼동으로 실제 backlog
항목이 갱신되지 않고 dangling 상태로 남을 실무 위험이 하나 있다(WARNING). 기존 8개 공유 패키지
선례와의 구분 근거는 실측상 타당하나 문서 내 명문화가 약하다(INFO). 두 발견 모두 target 의 핵심
설계 결정(전용 CI 잡)을 뒤집을 사안은 아니다.

## 위험도

LOW
