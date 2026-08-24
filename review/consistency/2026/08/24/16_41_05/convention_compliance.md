# 정식 규약 준수 검토 — `plan/in-progress/planner-doc-batch.md`

## 검토 모드
spec draft 검토 (`--spec`), 2회차(쓴 뒤)

## 검증 방법
target 이 `spec_impact` 로 지목한 9개 spec 파일이 실제로 커밋(`4af06d951`)에 반영돼 있음을
`git show 4af06d951 --stat`로 확인하고, 각 파일의 diff 를 `git show 4af06d951 -- <path>`로
직접 읽었다. B1(라벨 재사용 주장)·B5(placeholder 표기 주장)는 target 이 "정본"으로 지목한
소스(코드 주석·인접 표)를 `Read`/`grep`으로 직접 열어 문구를 대조했다.

---

### 발견사항

- **[WARNING] B1 각주의 "코드 주석과 같은 문구" 주장이 실제로는 어긋난다 — 세 번째 표현을 막으려던 각주가 두 번째 변형을 재확산**
  - target 위치: `spec/conventions/node-output.md` Principle 0 신설 각주(표 아래 "갈래 라벨은
    그 상수의 주석과 **같은 문구를 쓴다** — 표현이 갈리면 그 자체로 세 번째 사본이 된다" 문장) ·
    `plan/in-progress/planner-doc-batch.md` B1 체크리스트("라벨은 기존 taxonomy 재사용
    ... 세 번째 표현 금지")
  - 위반 규약: 문서 자신이 그 각주 안에서 선언한 라벨 재사용 원칙(자기모순) — 이 원칙 자체가
    이 PR 이 다루는 시리즈가 반복 겪은 "미러가 갈린다" 결함을 막기 위한 것
  - 상세: target 과 신설 각주는 라벨 `wire 전용 (위젯 파서)` / `wire 전용 (chat-channel 렌더러)`
    가 "정본 열거"로 지목한 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 의
    주석과 **동일 문구**라고 명시적으로 주장한다. 그러나 그 파일을 직접 읽으면 JSDoc 표
    (line 47-48)와 배열 인라인 주석(line 73·78) 모두 `wire 전용 (위젯)` / `wire 전용
    (chat-channel)` — "파서"/"렌더러" 접미어가 **없다**.
    `grep -n "wire 전용 (위젯 파서)" codebase/backend/src/shared/utils/node-output-allowlist.ts`
    → 0건(실측). 접미어가 붙은 표기는 오히려 `spec/5-system/14-external-interaction-api.md:1827-1828`
    (§R17, `#1209` 가 이미 넣어 둔 표)에서만 정확히 일치한다 — 즉 node-output.md 새 각주는
    **코드가 아니라 EIA §R17 을 베꼈다.** 결과적으로 지금 "정본"(코드) vs "정본이라 인용된
    스펙 두 곳"(EIA §R17·node-output.md) 사이에 표기가 갈리는 상태가 굳어졌다 — 이 각주 자체가
    막으려던 "세 번째 사본" 패턴과 형태만 다를 뿐(코드↔스펙 간극) 동일한 결함이다. 직전 라운드
    (`13_30_49`) naming_collision 리뷰어의 INFO #8 이 이 라벨을 "코드에 이미 정착된 taxonomy"
    라고 인용한 근거(`node-output-allowlist.ts:38-40`)도 재확인 결과 부정확하다 — 그 줄들은
    산문("위젯 파서가 top-level 로 읽는다")이지 라벨 자체가 아니다.
  - 제안: (a) node-output.md·EIA §R17 라벨과 코드 JSDoc 표/인라인 주석 중 하나로 표기를
    통일하거나, (b) 최소한 "그 상수의 주석과 같은 문구를 쓴다"는 문장을 "EIA §R17 과 동일
    문구(코드 JSDoc 표는 접미어 없는 축약형)"로 정정해 검증 가능한 주장으로 바꾼다. 값 배열
    자체(`formConfig` 등)는 정확히 일치하므로 기능적 위험은 없다 — 문서 신뢰성 문제다.

- **[WARNING] WS §3.2 신설 행의 placeholder 가 같은 문서 §3.3 기존 행과 어긋난다 — plan 이 명시한 기준과도 다르게 반영됨**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §3.2 "채널 패턴" 표 신설 행
    (`background:run:{runId}`) · `plan/in-progress/planner-doc-batch.md` B5 체크리스트
    ("브래킷은 **그 문서 컨벤션 `{id}`**")
  - 위반 규약: 같은 문서 §3.3 인가 표의 기존 `background:run:{id}` 행(미변경) — 동일 채널을
    가리키는 두 표 사이의 표기 일관성
  - 상세: plan 은 B5 작업 기준을 "브래킷은 그 문서 컨벤션 `{id}`"라고 명시했는데, 실제 diff 는
    `background:run:{runId}` 를 썼다(§3.2, 신설). 같은 파일 §3.3 은 손대지 않아
    `background:run:{id}` 그대로다 — 결과적으로 **같은 문서, 같은 채널**을 가리키는 두 행이
    서로 다른 placeholder(`{runId}` vs `{id}`)를 쓴다. §3.2 신설 행은 표 스타일상 sibling 행들
    (`{executionId}`·`{workflowId}`·`{documentId}`·`{userId}`, 전부 `{xxxId}` 패턴)과는 더
    잘 맞지만, 바로 아래 §3.3 의 동일 채널 행과는 불일치한다. `12-background.md`
    (`<backgroundRunId>`/`<id>`)·`redis-keys.md`(`<id>`)까지 넣으면 같은 채널에 대해 문서마다
    최소 3가지 표기가 공존한다(이 PR 이전부터 있던 것도 포함).
  - 제안: §3.2 신설 행을 §3.3 과 동일하게 `{id}`로 맞추거나, 이 기회에 §3.3 도 `{runId}`(또는
    `12-background.md` 와 맞춰 `{backgroundRunId}`)로 통일하고 그 사실을 각주로 남긴다. 최소한
    plan 의 "그 문서 컨벤션 `{id}`" 서술과 실제 반영 결과를 일치시킨다.

- **[INFO] `node-output.md` 는 CLAUDE.md 가 권장하는 Overview/본문/Rationale 3섹션 구조가 없다 (pre-existing, 이번 PR 책임 아님)**
  - target 위치: `spec/conventions/node-output.md` 전체(헤딩이 `# Output 변수 일관성 규칙` →
    바로 `## Principle 0` ~ `## Principle 참조 매트릭스` 로 이어지고 `## Overview`/`## Rationale`
    없음)
  - 위반 규약: `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 이번 PR 이 건드린 다른 5개 문서(`egress-masking.md`·`chat-channel-adapter.md`·
    `conversation-thread.md`·`6-websocket-protocol.md`)는 전부 `## Rationale`(또는 상당 섹션)을
    갖추고 있어 대조된다. node-output.md 는 이 구조 없이 이번에도 각주만 누적됐다 — 이 PR 이
    만들거나 심화시킨 결함은 아니고, "권장" 수준이라 CRITICAL/WARNING 은 아니다.
  - 제안: 이번 PR 범위 밖. 다음에 이 문서를 크게 손댈 때 Overview/Rationale 섹션 신설을
    별도 plan 항목으로 검토 권장.

---

### 요약

target(`plan/in-progress/planner-doc-batch.md`)이 기술하고 실제로 반영한 9개 spec 파일 편집은
링크 무결성(모든 신설 상대링크가 실제 파일·앵커에 도달)·`spec_impact` frontmatter·B2 의 4단계
순서 서술(실 코드 `toFanoutEnvelope` 호출 순서와 일치 확인)·B4 의 `spec-impl-evidence.md` §2.1
인용(정확) 등 핵심 규약은 잘 지킨다. 다만 이 PR 이 스스로 "미러 갈림을 막는다"는 목적으로 쓴
B1 각주가 정작 자신이 지목한 SoT(코드 JSDoc)와 문구가 어긋나(대신 EIA §R17 과만 일치) 같은
결함 패턴을 다른 층위에서 재생산했고, B5 신설 행도 plan 이 스스로 못박은 기준(`{id}`)과 실제
반영(`{runId}`)이 다르며 같은 문서 안의 인접 표와도 어긋난다. 둘 다 기능적 위험은 없는 순수
문서 표기 문제이지만, 이 PR 의 존재 이유(문서 부채·드리프트 정리)에 정면으로 걸리는 지점이라
WARNING 으로 남긴다.

### 위험도

LOW
