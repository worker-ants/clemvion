# 정식 규약 준수 검토 — spec-draft-node-cancellation-chat-channel-correction

- target: `plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`
- 검토 모드: spec draft 검토 (--spec)
- 대조 규약: `spec/conventions/**` (특히 `spec/conventions/node-cancellation.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/chat-channel-adapter.md`)

> 프롬프트에 첨부된 "정식 규약 모음" 은 컨텍스트 예산 초과로 258개 파일(사실상 이번 검토에 가장
> 관련 깊은 `node-cancellation.md`·`spec-impl-evidence.md`·`chat-channel-adapter.md` 포함)이
> 생략돼 있었다. "여기 없다는 사실을 근거로 삼지 말라" 는 지시에 따라 해당 파일들을 `Read`/`grep`
> 으로 직접 열어 대조했다.

## 발견사항

- **[WARNING] §6 표 범례(legend)에 없는 "N/A" 값을 새로 도입**
  - target 위치: `## 변경 1` → `### 1-b. spec/conventions/node-cancellation.md §6 (137행)` (target 파일 47~55행)
  - 위반 규약: `spec/conventions/node-cancellation.md` §6 본문, 표 바로 위 범례 줄(123행) —
    `> 2026-06-03 코드 대조로 갱신. ✓ = 구현됨, 🚧 = 부분 구현(...), — = 미구현(Planned, ...)`
  - 상세: target 의 diff 는 chat-channel 행의 "상태" 컬럼 값을 `—` 에서 `N/A` 로 바꾸도록 제안한다.
    그러나 이 표의 "상태" 컬럼은 문서 자신이 123행에서 `✓`/`🚧`/`—` 세 값만으로 닫힌 enum 을
    정의해 두고 있고(레포 전체 검색 결과 이 범례는 `node-cancellation.md` 국지적 정의이며 다른
    파일이 재사용하는 공유 규약은 아니다), `N/A` 는 그 세 값 어디에도 없다. diff 는 범례 줄
    자체를 함께 갱신하지 않으므로, 반영되면 "정식 규약" 문서 스스로가 자기 표의 값 集合 정의와
    실제 표 내용이 어긋나는 상태가 된다. 자동 가드(`spec-frontmatter.test.ts` 등)는 frontmatter
    만 검사하고 이 표 셀은 파싱하지 않아 build 를 깨뜨리지는 않지만, "정식 규약" 문서 내부의
    표기 일관성이 훼손된다.
  - 제안: (a) 범례 줄에 `N/A = 범주 오류로 대상 자체가 아님` 항목을 함께 추가하거나, (b) 기존
    `—`(미구현/Planned) 의미 범위를 벗어나지 않는 다른 표기(예: 빈 칸 또는 각주)로 대체. 취소선
    + "철회" 서술 방식 자체(1-b 의 핵심 설계)는 `spec/5-system/13-replay-rerun.md:469`,
    `spec/conventions/cross-node-warning-rules.md:138,140`, `spec/conventions/conversation-thread.md:322-325`
    에 이미 확립된 patturn(취소선 + **굵은 결론** — em dash 상세)과 정확히 일치해 문제 없다 —
    지적 대상은 오직 "N/A" 심볼이 범례 밖이라는 점.

- **[INFO] 구분자(separator) 스타일이 같은 문서군 안에서 비일관**
  - target 위치: `## 변경 1` → `### 1-c. spec/4-nodes/1-logic/10-parallel.md (244행)` (target 파일 57~64행)
  - 위반 규약: 엄밀한 조항은 없음 — `spec/conventions/node-cancellation.md` §1(24행)·§6 본문 및
    `spec/4-nodes/1-logic/10-parallel.md` 원문 244행이 실제로 지켜온 표기 관행과의 정합성 문제.
  - 상세: 원문(`10-parallel.md:244`)은 "DB / AI / Email / chat-channel" 처럼 슬래시(`/`)로
    노드 카테고리를 나열해 왔고, `node-cancellation.md` §1 도 같은 슬래시 나열("HTTP / DB / AI /
    Email / 이커머스 통합 Cafe24·MakeShop")을 쓴다(단 "Cafe24·MakeShop" 두 platform 만 예외적으로
    가운뎃점으로 묶어 "이커머스 통합" 하위 쌍임을 표시). target 의 1-c 제안 문구는 "HTTP · DB ·
    AI · Cafe24 · MakeShop" 로 전부 가운뎃점으로 바꿔, 원래 "이커머스 통합" 하위 쌍 전용이던
    구분자를 최상위 나열 구분자로 승격시킨다. 두 파일이 같은 개념(노드 카테고리 나열)을 다른
    구분자로 표기하게 되어 근소한 표기 불일치가 생긴다.
  - 제안: `10-parallel.md` 도 `node-cancellation.md` §1 과 동일하게 "HTTP / DB / AI / 이커머스
    통합 Cafe24·MakeShop (Email 은 ...)" 형태로 슬래시를 유지하는 안을 고려. 다만 이 저장소에
    구분자 사용을 강제하는 명문 규약은 없으므로 INFO 로 남긴다.

- **[INFO] `변경 2` 구간만 소스 라인 번호 인용이 빠져 있음 (내부 서식 비일관)**
  - target 위치: `## 변경 2 — §6 commerce 2행이 이미 병합된 구현과 어긋난다 (Warning)` (target 파일 66~89행)
  - 위반 규약: 명문 규약 없음 — target 문서 자신이 `변경 1` 에서 세운 서술 관행(1-a/1-b/1-c 각각
    "§1 (24행)" · "§6 (137행)" · "(244행)" 로 정확한 소스 라인 인용)과의 내부 일관성 문제.
  - 상세: `변경 2` 는 같은 `node-cancellation.md` §6 표의 MakeShop/Cafe24 두 행(실측: 138·139행)을
    바꾸지만, 어느 행도 정확한 라인 번호를 인용하지 않는다(원 diff 도 "…" 로 일부 생략돼 있어
    line-anchor 검증이 더 어렵다 — `feedback_review_prompt_line_anchors` 계열 교훈과 같은 종류의
    리스크). 실제로 대조한 결과 diff 의 `-` 라인은 현재 138·139행과 내용상 일치하므로 오류는
    아니지만, 문서 스스로 정한 인용 관행이 절반만 적용됐다.
  - 제안: `변경 2` 도 "§6 (138~139행)" 형태로 라인 번호를 명시하면 리뷰어/집행자가 소스 위치를
    바로 대조할 수 있어 앞선 절과 일관된다.

- **[INFO] chat-channel 신규 §6 행에 SoT 문서로의 markdown 링크 누락 (약한 전례)**
  - target 위치: `## 변경 1` → `### 1-b.` diff (target 파일 52~55행)
  - 위반 규약: 명문 규약 없음 — `spec/conventions/node-cancellation.md` §2.1 표(44행, AI 행)의
    "SoT: [ai-agent §12.16](../4-nodes/3-ai/1-ai-agent.md)" 관행과의 부분 정합.
  - 상세: 1-b 의 새 비고 텍스트는 `CCH-AD-05` 를 근거로 인용하지만 `spec/5-system/15-chat-channel.md`
    로의 markdown 링크를 달지 않는다. §2.1 표의 AI 행은 외부 SoT 를 인용할 때 명시적으로 링크를
    단 전례가 있으나, §6 표의 다른 행 대부분(예: 44·136행)은 파일명만 backtick 으로 인용하고
    링크는 달지 않아 전례가 혼재돼 있다. 즉 규약 위반이라기보다 선택적 스타일 개선 여지.
  - 제안: 여유가 있다면 `CCH-AD-05` 뒤에 `../../5-system/15-chat-channel.md#32-실행-이벤트-구독-전파`
    류의 앵커 링크를 추가해 §2.1 AI 행과 통일. 필수는 아님.

## 준수 확인(참고 — 문제 없음)

아래는 위반이 아니라, 검토 과정에서 실측으로 확인한 준수 사항이다(리포트의 완전성을 위해 기록):

- **취소선(tombstone) 표기 패턴** 자체는 이 저장소에 이미 확립된 관행이다 —
  `spec/5-system/13-replay-rerun.md:469`(표 셀 내 취소선 + 굵은 결론 + em dash 상세, 정확히 같은
  형태), `spec/conventions/cross-node-warning-rules.md:138,140`, `spec/conventions/conversation-thread.md:322-325`.
  target 1-b 는 이 패턴을 정확히 재현한다("N/A" 심볼 문제만 별도 지적).
- **인용 정확성**: `CCH-AD-05` 원문(`spec/5-system/15-chat-channel.md:58`), `config.chatChannel`
  §2.8(`spec/1-data-model.md:230,233`), `abortSignal` 미참조(레포 전체 `abortSignal` grep 결과
  `chat-channel-adapter.md`/`15-chat-channel.md` 모두 0건) 등 target 이 인용한 근거 문구는 모두
  실제 spec/코드와 정확히 일치했다.
- **frontmatter 스키마**: target 문서 자신의 frontmatter(`title`/`worktree`/`started`/`owner`/
  `priority`/`spec_impact`)는 plan 문서용 스키마(plan-lifecycle §4, spec-impl-evidence Gate C)를
  올바르게 따른다 — `spec_impact` 가 리스트 형태(`feedback_spec_impact_gate_c_list` 교훈과 일치),
  `worktree` 필드가 sentinel 이 아닌 실제 워크트리명으로 채워져 있다.
- **frontmatter `code:` 확장 보류 결정**: target 은 commerce client/handler 를
  `node-cancellation.md` frontmatter `code:` 에 추가하지 않기로 명시(§범위 밖 3번째 항목).
  실측 결과 기존 frontmatter `code:` 도 §6 의 모든 ✓ 항목(AI 3개 핸들러 등)을 등재하지 않는
  선택적 관행이었으므로, `spec-impl-evidence.md` §3(`code:` ≥1 매치 의무, 전량 등재 의무 아님)과
  어긋나지 않는다.
- **문서 구조**: Overview → 착수 사유 → 변경 1/2 → 범위 밖 → Rationale 순서로, CLAUDE.md 가
  권장하는 Overview/본문/Rationale 3단 구성을 따른다.
- **§1(24행) diff**: "chat-channel" 을 슬래시 목록에서 제거해도 남은 목록의 구분자 문법이
  깨지지 않는다(이중 슬래시·trailing separator 없음) — 실제로 시뮬레이션해 확인.

## 요약

target 은 명명·구조·근거 인용 면에서 이 저장소의 기존 관행(취소선 tombstone 패턴, plan
frontmatter 스키마, `code:` 부분 등재 관행, Overview/본문/Rationale 구성)을 대체로 정확히
따르고 있으며, 인용한 SoT 근거(`CCH-AD-05`, `config.chatChannel` §2.8, `abortSignal` 미참조)도
전부 실측과 일치했다. 다만 target 이 제안하는 diff 를 그대로 반영하면 `spec/conventions/node-cancellation.md`
§6 표의 "상태" 컬럼이 스스로 정의한 3-값 범례(✓/🚧/—)를 벗어나는 4번째 값("N/A")을 범례
갱신 없이 도입하게 되어, 정식 규약 문서 내부의 표 서식 일관성이 깨진다(WARNING 1건). 이 외
구분자 스타일·라인 인용·링크 유무는 명문 규약이 없는 경미한 내부 일관성 이슈(INFO 3건)로,
집행 전 반영을 권장하나 차단 사유는 아니다.

## 위험도

LOW
