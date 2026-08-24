# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base `origin/main`)

## 범위 확인

`git diff origin/main...HEAD --stat -- spec/conventions/` (HEAD `dc7debba6`):

```
spec/conventions/chat-channel-adapter.md  | 15 ++++++++--
spec/conventions/conversation-thread.md   | 15 ++++++++--
```

target scope(`spec/conventions/`) 안에서 실제 변경된 파일은 이 둘뿐이다(전체 diff
83 files 중 `spec/conventions/` 로 좁힌 결과). `conversation-thread.md` 는 이번 회차에
§8.4(자기-반증형 소정정 갱신) + §9.7 두 행(node.failed/node.completed error shape,
`12_42_20` cross_spec CRITICAL 대응) + §9.7 아래 신규 ⚠️ 블록 세 지점이 바뀌었다.

## 대조한 plan 문서

- `plan/complete/node-output-envelope.md` — 이번 작업의 원 plan (`status: complete`).
  `spec_impact` 가 `chat-channel-adapter.md` 를 "(1) planner 턴", `conversation-thread.md`
  를 "(2) 자기-반증형 소정정" 카테고리로 명시하면서, 같은 파일의 §9.7 편집은 그 안에서도
  "성격이 다르다 — planner 턴(내가 쓴 문장이 아니고 wire 계약)" 이라고 별도로 주석을 달아
  둔다. CLAUDE.md 자기-반증형 소정정 5조건을 §8.4 문장에 대해 확인:
  (1) `#1205`/`#1208` 에서 developer 가 쓴 문장(plan 본문의 인용과 일치) · (2) "잔여는
  envelope.output 하나" 는 API 계약이 아니라 **상태 예고** · (3) e2e 285건 후 실 DB 조회로
  반증 · (4) 정정이 해당 문장에 국한 — diff 도 그 한 문장만 취소선+정정, 인접 서술
  불변 · (5) `--impl-done spec/conventions/`(`12_13_36`/`12_24_55`) 게이트 실행 기록. 5조건
  모두 충족 — target 의 편집 방식과 plan 의 자기 서술이 어긋나지 않는다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 정본 트래커. 이번 target
  diff 가 만드는 두 사실(①`envelope.output` 도 fail-closed allowlist ②`.failed`/`.completed`
  의 error 는 top-level string + `output.output.error` 2단)이 트래커의 해당 항목([x]
  처리된 §R17 항목, 신규 CRITICAL 항목 둘 다)과 문구까지 정확히 일치한다. target 이 새로
  추가한 §9.7 아래 ⚠️ 블록("코드 수정은 별건으로 정본 트래커에 등재돼 있고")이 가리키는
  항목 — `- [ ] 🔴 system_error 재시도 배너가 라이브 WS 경로에서 안 뜬다` — 이 실제로
  트래커에 살아 있고, "문서는 이미 정정돼 있다" 는 그 항목의 주장이 target 의 실제 diff
  상태와 부합한다(§9.7 두 행 + ⚠️ 블록 모두 확인).
  - 파생 후속 3건(`finalAdapted` 폴백 잠재 경로 · provider spec 3곳 `output.rendered`
    판정 미확정 · `background:run:{id}` 채널 표 누락)은 모두 target 의 `spec_impact`
    밖(providers 문서·WS §3.2)이며, 트래커에 "이번엔 안 고친 이유 + 재개 신호"로 개별
    등재돼 있어 조용히 유실된 후속이 없다.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` — §R17 이력 blockquote 가
  "2026-08-24 갱신: 그 잔여도 닫혔다" 로 이미 갱신, 구 서술은 취소선. target 이 만드는
  사실과 어긋나지 않음.
- `plan/in-progress/chat-channel-discord-gateway.md` / `-slack-socket-mode.md` /
  `-visual-ssr-png.md` (chat-channel-adapter.md 의 `pending_plans` 3건) — 각 문서의
  "사용자 결정 필요" 항목은 진입 조건(의존성 추가·SDK 채택)에 관한 것이고 output
  envelope shape 과 무관 — target 의 §1.3/§3 편집과 충돌 없음.
- `plan/in-progress/node-output-redesign/**` (28개 노드별 진단 plan) — README 가 "본 plan
  은 conventions 자체는 변경하지 않는다" 고 명시하고, target diff 도 `node-output.md` 를
  건드리지 않는다(스코프 밖 확인) — 교차 없음.

## 검토 관점별 판정

1. **미해결 결정과의 충돌** — 없음. target 이 내리는 두 결정
   (`envelope.output` allowlist 폐쇄, `.failed`/`.completed` error 2단 접근) 은 모두
   "결정 필요" 로 열린 적 없는 실측 기반 정정이며, chat-channel 관련 3개 plan 의 유일한
   미해결 결정(진입 조건 의존성)과 스코프가 겹치지 않는다.
2. **선행 plan 미해소** — 없음. target 이 전제하는 실측(e2e 285건 DB 조회, emit 4곳 전수)
   은 `plan/complete/node-output-envelope.md` 와 정본 트래커 양쪽에 동일하게 기록돼 있고,
   자기-반증형 소정정 5조건도 위에서 개별 확인했다.
3. **후속 항목 누락** — 명백한 누락은 못 찾았다. 다만 아래 INFO 참고.

## 참고 (INFO)

- `conversation-thread.md` §1.1.1(`system_error` source 설명, line 47)이 "AI Agent가
  `output.error` 와 함께 종결될 때, WS `execution.node.failed` 또는 `output.error` 가 set
  된 `execution.node.completed` 수신 시" 라고 쓰는데, 이 표현은 이번 §9.7 두 행 수정 이전의
  1단 표기(`output.error`)를 그대로 쓰고 있다 — §9.7 은 wire top-level `error` 가 string 이고
  구조화 에러는 `output.output.error` 2단이라고 이미 고쳤다. 이 줄이 wire shape 을 주장하는
  것인지("payload.output.error" 문자 그대로) 아니면 도메인 상태를 가리키는 일반 서술인지
  ("output.error 가 set 된 노드 실행" 이라는 개념적 지칭)는 문면만으로 확정하기 어렵다 —
  §9.7 앞에서 3번 반복된 "미러를 놓쳤다" 패턴(commit `40ff94307`/`feb1967a2`/`dc7debba6`)을
  감안하면 5번째 미러일 가능성이 있다. 이 판단은 정밀 소스-앵커 대조가 본업인 cross_spec
  리뷰어 영역과 겹치므로 여기서는 확정 CRITICAL 로 올리지 않고 기록만 남긴다 — 이번 회차
  cross_spec 리포트가 이미 짚었다면 중복이고, 안 짚었다면 다음 라운드에서 재확인할 후보로
  남긴다.
- `plan/complete/node-output-envelope.md` 의 `spec_impact` YAML 리스트에서
  `spec/conventions/conversation-thread.md` 항목이 (1) planner-턴 카테고리 설명 주석과
  (2) 자기-반증형 소정정 카테고리 설명 주석 **둘 다**의 대상으로 언급되지만 리스트 항목
  자체는 1회만 등재돼 있다 — 한 파일 안에 서로 다른 근거의 두 편집이 섞였다는 사실을
  정확히 설명하고 있어 Gate C(spec_impact 는 리스트) 위반은 아니다. 다만 다음에 같은 파일을
  두 근거로 나눠 편집할 일이 생기면, 파일명을 두 번 나열하고 각 항목 옆에 근거 주석을
  붙이는 편이 "이 파일의 이 부분은 어느 근거인지" 를 grep 한 줄로 더 명확히 드러낸다
  (스타일 제안, 이번 PR 을 막을 사유 아님).

## 요약

target(`spec/conventions/` 2파일 diff, HEAD `dc7debba6`까지)은 원 plan
(`plan/complete/node-output-envelope.md`)의 `spec_impact` 선언 및 자기-반증형 소정정
5조건과 정확히 맞물리고, 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에
같은 사실이 동일하게 기록돼 drift 가 없다. 미해결 "결정 필요" 항목을 우회하는 서술이
없고, 이 정정이 파생시키는 후속(프런트 배너 버그·`finalAdapted` 폴백·provider spec
판정 미확정·WS §3.2 채널 누락)은 전부 정본 트래커에 개별 항목 + 재개 신호로 등재돼
있다. 유일한 관찰은 `conversation-thread.md` §1.1.1 의 1단 `output.error` 표기가 §9.7 의
2단 정정과 나란히 두면 다섯 번째 미러일 가능성이 있다는 것인데, 이는 plan 트래킹의
결함이 아니라 스펙 본문 정밀도 문제라 INFO 로만 남긴다.

## 위험도

NONE
