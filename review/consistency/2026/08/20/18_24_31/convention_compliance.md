# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위

diff-base `origin/main` 대비 `spec/5-system/` 변경분 (`6-websocket-protocol.md` · `12-webhook.md` ·
`13-replay-rerun.md` · `14-external-interaction-api.md` — 2026-08-20 `Execution.inputData` 마커 가드
도입)을 `spec/conventions/**`(secret-store.md · node-output.md · i18n-userguide.md ·
frontend-layering.md · error-codes.md · swagger.md · spec-impl-evidence.md 등) 대비 대조. 코드
사실관계는 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)를
절대경로로 직접 열어 확인했다.

## 발견사항

- **[INFO]** `6-websocket-protocol.md` 에 `## Overview (제품 정의)` 섹션 부재
  - target 위치: `spec/5-system/6-websocket-protocol.md` 최상단 (frontmatter 직후 바로 `## 1. 연결`)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 + `.claude/skills/*/SKILL.md` 의 "Spec 문서 3섹션 구성
    (Overview / 본문 / Rationale) 권장"
  - 상세: 같은 target 범위의 형제 문서 `12-webhook.md`(`## Overview (제품 정의)`, L21) ·
    `13-replay-rerun.md`(L20) · `14-external-interaction-api.md`(L34) 는 모두 Overview 섹션을
    갖는데 `6-websocket-protocol.md` 만 frontmatter 뒤에 바로 `## 1. 연결` 로 시작한다. 본
    diff 는 이 파일의 §3(채널 구독)·§4(이벤트 목록) 안 마스킹 문구만 고쳤고 구조를 건드리지
    않았으므로 **이 diff 가 만든 문제는 아니다** — 기존부터 있던 구조 갭이다.
  - 제안: "권장" 사항이라 차단 사유는 아니다. 이 파일을 다음에 편집할 기회에 `## Overview
    (제품 정의)` 섹션을 §1 앞에 신설해 형제 문서와 구조를 맞추는 것을 고려할 만하다. 급하지
    않으면 규약 갱신 없이 그대로 두어도 무방(권장 사항이지 강제 사항이 아님을 명시).

- **[INFO]** 마스킹 마커 카탈로그의 SoT 가 `spec/conventions/` 밖(도메인 spec)에 위치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17("잔여②" 종결부, 2026-08-20
    갱신), 그리고 이를 인용하는 `12-webhook.md`·`13-replay-rerun.md`·`6-websocket-protocol.md`
    (본 diff) + `spec/conventions/node-output.md` L314-323("egress 값-마스킹이 이 금지를
    backstop")
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `정식 규약 → spec/conventions/<name>.md`
  - 상세: 마스킹 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`, backend
    `sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)과
    "ingestion 키-blacklist + egress 값-패턴 이중 방어" 모델은 4개 이상의 `spec/5-system/*.md`
    문서와 1개의 `spec/conventions/*.md` 문서(node-output.md)가 공유하는 cross-cutting
    invariant 인데, 정식 SoT 는 `spec/conventions/` 산하 전용 문서가 아니라
    `14-external-interaction-api.md` 의 `## Rationale` 절(§R17) 이다. `spec/conventions/`
    쪽이 도메인 spec 을 SoT 로 역참조하는 방향 자체가 CLAUDE.md 표의 기본 배치와 어긋난다.
  - 다만 이는 이번 diff 가 새로 만든 배치가 아니라 여러 라운드에 걸쳐 **의도적으로 확정된**
    구조다 — 커밋 이력(`b5e4dbb9c "EIA §R17 마스킹 카탈로그에 종결 Execution.error 등재"`)이
    보여주듯, 분산되어 있던 마스킹 결정을 오히려 **한 곳(§R17)으로 모으는** 리팩터가 이미 여러
    차례 있었다. 본 diff 도 그 패턴을 그대로 따라 4개 문서를 동시 갱신했을 뿐 새 분산을 만들지
    않았다.
  - 제안: 차단 사유 아님. 다만 이 카탈로그가 앞으로도 계속 자라면(현재도 4개 문서가 손으로
    동기화되는 상태) `spec/conventions/secret-masking.md` 같은 전용 규약 문서로 승격해 SoT 를
    옮기고 각 도메인 spec 은 링크만 남기는 안을 project-planner 턴에서 검토할 만하다. 규약
    갱신이 필요하다면 이쪽(규약 신설)이 적절하지, target 문서를 규약에 맞춰 고치는 방향은
    아니다.

## 준수 확인 (참고 — 위반 아님)

다음은 명시적으로 대조해 **정식 규약과 일치함을 확인**한 항목이다 (발견사항이 아니라 검토
과정의 근거 기록):

- **i18n 규약 (`spec/conventions/i18n-userguide.md`)**: 신규 키 `history.rerun.maskedInputBlocked`
  가 `13-replay-rerun.md` 표에 ko/en 쌍으로 동시 등재되고(Principle 2 parity), 실제
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/history.ts` 양쪽에 반영되어 있으며(코드 확인),
  한국어 문구는 해요체(Principle 6)를 따른다.
- **`config` echo 원칙 (`spec/conventions/node-output.md` Principle 7)**: 본 diff 가 되살린
  "config raw-echo 와도 충돌하지 않는다" 문구가 Principle 7 의 2026-08-17 backstop 조항과
  정확히 합치한다.
- **마스킹 마커 상수 (`sanitize-error-message.ts`)**: spec 이 서술하는 `***`/`[REDACTED]`/
  `[REDACTED_DEPTH]` 3종과 frontend 미러 `masked-markers.ts::MASKED_MARKERS` 가 정확히 일치.
  "정확 일치만 감지" 서술도 `isMaskedMarker`(`typeof v === "string" && MASKED_MARKERS.has(v)`)
  구현과 합치.
- **Frontend 레이어링 (`spec/conventions/frontend-layering.md`)**: 신규 파일
  `codebase/frontend/src/lib/utils/masked-markers.ts` 는 `src/lib/**` 소재 + 무-import 유틸이라
  `components → lib` 허용 방향만 발생시킨다. JSDoc 자체가 "모달·툴바가 무관한 폼 UI 컴포넌트를
  import 해야 하는 의존 방향이 생겨 `lib/utils/` 로 승격했다" 고 명시 — §3 "해소법"(레이어
  역전 시 대상을 아래로 이동)을 정확히 따른 사례.
- **`spec-impl-evidence.md` frontmatter 규약**: `14-external-interaction-api.md`/
  `13-replay-rerun.md` 의 `code:` 리스트에 새로 추가된 3개 파일
  (`masked-markers.ts`/`rerun-modal.tsx`/`editor-toolbar.tsx`) 은 모두 HEAD 워킹트리에 실존.
  `status: partial` 문서(EIA·WS)의 `pending_plans` 참조 파일도 실존 확인.
- **글로서리·금지어 (`i18n-userguide.md` Principle 6)**: diff 추가분에 "엣지"/"아웃풋"/"작업
  흐름" 등 금지어·합쇼체 없음 (전수 grep 확인).
- **API 문서 규약 (`spec/conventions/swagger.md`)**: 본 diff 는 신규 엔드포인트·DTO 를
  도입하지 않아 데코레이터/DTO 명명 규약이 적용될 신규 표면이 없음.

## 요약

`spec/5-system/` 의 2026-08-20 마커 가드 diff(웹훅·EIA·Re-run·WebSocket 4개 문서 동시 갱신)는
`spec/conventions/**` 의 명명·i18n·레이어링·frontmatter-evidence·node-output echo 규약과 대조해
직접 위반이 없다. 마스킹 마커 상수·경계("정확 일치만 감지")·소비처별 가드 서술이 실제 backend
상수(`sanitize-error-message.ts`)·frontend 미러(`masked-markers.ts`)·구현 파일과 정합하고, 신규
i18n 키는 parity·문체 규약을 지키며, 신규 유틸 파일은 frontend-layering 규약이 권장하는 정확한
해소 패턴(레이어 역전 시 하위로 이동)을 따랐다. 남은 두 관찰(WS 문서의 Overview 섹션 부재,
마스킹 카탈로그 SoT 가 `spec/conventions/` 밖에 위치)은 모두 이 diff 이전부터 있던 구조적 선택이며
"권장" 수준이거나 이미 의도적으로 정착된 패턴이라 INFO 로만 등재한다.

## 위험도

NONE
