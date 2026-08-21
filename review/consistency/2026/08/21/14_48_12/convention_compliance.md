# 정식 규약 준수 검토 — convention_compliance

## 검토 범위

- target: `spec/5-system/` (--impl-done, diff-base=`origin/main`)
- 실제 diff: `spec/5-system/14-external-interaction-api.md` 10줄 변경뿐 (frontmatter `code:` 1줄 추가 +
  §R17 Rationale 산문 한 문단, "마커 집합·깊이 상한 SoT 를 공유 패키지 `@workflow/masked-markers` 로
  이관" 서술)
- 참고: prompt 번들의 `spec/conventions/**` 대부분이 컨텍스트 예산 초과로 절단되어 있었다
  (`error-codes.md`·`node-cancellation.md` 제외 전부). 절단된 파일들은 워크트리에서 직접 `Read` 로
  열어 확인했다 — `spec-impl-evidence.md`, `cross-node-warning-rules.md`, `swagger.md` 등.
- 코드 확인은 target 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/masked-marker-contract-7d2e14`,
  = 본 세션 CWD) 절대경로/현재 checkout 기준으로 직접 수행했다 — `codebase/packages/masked-markers/`,
  두 shim 파일, `.github/workflows/*.yml` 실측.

## 발견사항

- **[INFO]** 신규 SoT 선언에 코드 경로 markdown 링크 누락
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (프리필 왕복 하위 항목), 라인
    1625 부근 — "마커 집합과 깊이 상한의 SoT 는 **공유 패키지 `@workflow/masked-markers`** 다"
  - 위반 규약: 강제 규약은 아님 — 동일 문서 내 지역적 관례. 같은 문서가 "SoT" 를 선언할 때
    라인 71/108/433/453/743/866/969/1301/1302 등 다수(22건 중 9건)는
    `[코드 SoT](../../codebase/...)` 형태로 실제 코드 경로에 markdown 링크를 건다.
    `spec/conventions/cross-node-warning-rules.md` L24 도 같은 패턴
    (``[`@workflow/node-summary`](../../codebase/packages/node-summary/)``)을 쓴다.
  - 상세: 신규 문장은 패키지명만 backtick 텍스트로 적고 `codebase/packages/masked-markers/` 경로에
    링크를 걸지 않았다. 강제된 명명 규약 위반은 아니다(문서 내에서도 링크 없는 SoT 선언이
    13/22 로 오히려 더 많다 — 완전히 통일된 규약이 아니라 느슨한 관례) — 다만 markdown 링크가
    있었다면 `spec-link-integrity.test.ts` (`spec/conventions/spec-impl-evidence.md` §4.2) 의
    타깃 실존 검증을 자동으로 받는다는 실익이 있다.
  - 제안: `공유 패키지 [`@workflow/masked-markers`](../../codebase/packages/masked-markers/)` 형태로
    링크화 권장. 규약 갱신은 불필요 — 기존에도 혼재된 스타일이라 이 문서 하나의 사소한 일관성
    문제일 뿐이다.

- **[INFO]** frontmatter `code:` 신규 항목이 glob 이 아닌 단일 파일
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter,
    `- codebase/packages/masked-markers/src/index.ts`
  - 위반 규약: 없음 — `spec/conventions/spec-impl-evidence.md` R-1 은 glob 을 "허용"할 뿐 의무화하지
    않는다. 단일 파일 경로도 유효하다(실존 확인함 — `find codebase/packages/masked-markers/src`
    결과 `index.ts` 가 사실상 유일한 non-test 소스라 현재는 정확히 매치한다).
  - 상세: 형제 shared-package 항목들(`spec/conventions/cross-node-warning-rules.md` 의
    `codebase/packages/graph-warning-rules/**`, `spec/5-system/5-expression-language.md` 의
    `codebase/packages/expression-engine/src/**/*.ts`)은 관례적으로 glob 을 쓴다. 지금은 결과가
    동일하지만, 향후 `src/` 에 파일이 늘면(이미 `src/__tests__/index.spec.ts` 존재) 단일 파일
    고정 항목은 신규 소스 파일을 커버하지 못해 `spec-code-paths.test.ts` 가드 자체는 여전히
    통과하지만 "이 spec 이 책임지는 구현 범위" 의 의미가 좁아진다.
  - 제안: `codebase/packages/masked-markers/src/**` 로 넓혀 형제 항목과 패턴을 맞추는 편이 향후
    유지비를 줄인다. 필수 수정은 아님.

## 교차 검증 (위반 아님 — 근거 확인용)

- 패키지 명명 `@workflow/masked-markers` 는 `codebase/packages/{ai-end-reason,chat-channel-validation,
  expression-engine,graph-warning-rules,masked-markers,node-summary,sdk}` 전원이 공유하는
  `@workflow/<kebab-case>` 스코프 규칙과 일치한다(`package.json` `name` 필드 실측). 단
  `web-chat-sdk` 디렉터리는 `name: "@workflow/web-chat"` 로 디렉터리명과 패키지명이 이미 어긋나
  있으나 — 이는 기존 상태이고 본 diff 가 만든 문제가 아니라 스코프 밖.
- `pending_plans:` (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 실존 확인 — OK.
  `status: partial` 유지가 적절(코드 evidence 확대일 뿐 완결 아님).
- Rationale 신규 문단의 역사적 근거("CI 경로 게이팅에 막혀 값을 옮겼다")를 `.github/workflows/
  backend-checks.yml`(`codebase/backend/**`+`codebase/packages/**` 트리거) /
  `frontend-checks.yml`(`codebase/frontend/**`+`codebase/packages/**` 트리거)로 실측 — 주장이
  허구가 아니라 실제 CI path-filter 구조와 일치한다. 또한 `git log --oneline` 의
  `7cc64fa35 refactor(shared): 마커 계약을 공유 패키지로 추출 — 계약 테스트가 CI 경로 게이팅에
  막혔다` 커밋이 같은 서사를 담고 있어 "기각된 대안" 이 지어낸 이력이 아님을 확인했다
  (MEMORY 교훈 "Rationale 기각된 대안은 실제 이력 필수" 대응 확인).
  두 backend/frontend shim 파일(`sanitize-error-message.ts`, `lib/utils/masked-markers.ts`)을
  직접 열어 실제로 `@workflow/masked-markers` 를 import 하는 재export shim 임을 확인 — spec
  서술과 코드가 일치한다.
- 다른 spec 영역(`2-navigation/9-user-profile.md`, `3-workflow-editor/3-execution.md`,
  `4-nodes/7-trigger/1-manual-trigger.md`, `5-system/{12-webhook,13-replay-rerun,3-error-handling}.md`)이
  이미 마스킹 마커 개념의 SoT 를 `[EIA §R17]` 로 명시 링크하는 기존 패턴을 그대로 유지한다 —
  이번 diff 가 "정식 규약 → spec/conventions/<name>.md" 원칙(CLAUDE.md 정보 저장 위치 표)을
  우회해 신규 cross-cutting 개념을 conventions 밖에 숨긴 것이 아니라, 기존에 이미 확립된 단일
  spec 파일-SoT 패턴(R9 "spec 위치 — 5-system/ 하위 신규 파일" 근거와 일치)을 그대로 연장한 것.
  새 `spec/conventions/masked-markers.md` 분리를 요구할 근거는 없다.
- 문서 3섹션 구조(Overview/본문/Rationale), `_product-overview.md`·`0-` prefix 등 CLAUDE.md
  명명 컨벤션 — 이번 diff 는 기존 Rationale 섹션 내부 산문 삽입뿐이라 구조 변경 없음. 위반 없음.
- API 응답 포맷·에러 코드·Swagger/DTO 데코레이터 — 이번 diff 범위에 포함되지 않음(§4~§8, §10.1
  Swagger 절 무변경). 검토 대상 없음.
- 금지 항목(conventions 명시 금지 패턴) — 해당 없음.

## 요약

target diff 는 `spec/5-system/14-external-interaction-api.md` 의 frontmatter `code:` 목록에 신규
공유 패키지 파일 1건을 추가하고, 기존 §R17 Rationale 안에 "마커 집합·깊이 상한 SoT 가 공유 패키지
`@workflow/masked-markers` 로 이관됐다"는 산문 한 문단을 보탠 것이 전부다. 패키지 명명(`@workflow/`
스코프)·frontmatter 스키마(`code:` glob 허용 범위 내 단일 파일)·문서 3섹션 구조·spec 위치 관례
(cross-cutting 개념을 별도 conventions 문서로 분리하지 않고 기존 SoT 스펙 파일에 유지) 모두 기존
정식 규약과 어긋나지 않는다. Rationale 의 역사적 주장(CI 경로 게이팅 우회 목적)도 실제 GitHub
Actions path-filter 설정 및 커밋 이력으로 실측 확인되어 허구가 아니다. 발견한 두 항목은 모두 이
문서 자체에도 혼재된 느슨한 스타일 관례에 관한 INFO 수준 제안이며, 정식 규약 위반이라 부를 근거는
없다.

## 위험도

NONE
