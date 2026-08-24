# 정식 규약 준수 검토 — `plan/in-progress/planner-doc-batch.md`

## 검토 모드
spec draft 검토 (`--spec`)

## 검증 방법
target 이 스스로 "fresh `origin/main` 재판정 완료 — 2026-08-24, `99b9bd908` 기준" 이라고 명시했으므로,
그 재판정의 근거가 되는 실제 `99b9bd908` 시점의 `spec/conventions/**` 본문을 worktree HEAD(=`99b9bd908`,
확인됨)에서 직접 읽어 target 의 각 항목(B1~B7) 서술과 대조했다.

---

### 발견사항

- **[CRITICAL] B1 항목이 이미 존재하는 정본 각주를 "0건" 이라 오판 — 실행 시 금지된 중복 미러 재생성**
  - target 위치: `plan/in-progress/planner-doc-batch.md` §"항목" 표 B1 행, §"작업" 체크리스트
    `- [ ] B1 Principle 0 — wire-only 키 각주 (현재 8키...)`
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 자신이 명시한 반-중복(단일 정본) 원칙 —
    "사본을 줄이는 것이 그 재발을 막는 **유일한 방법**이다" (2026-08-24 신설, `12_55_09` convention W2)
  - 상세: target 이 재판정 기준으로 못박은 커밋 `99b9bd908` 자체의 diff 를 확인하면(`git show 99b9bd908 --
    spec/conventions/node-output.md`), 바로 그 커밋에서 Principle 0 에 다음 각주가 **이미 추가돼 있다**:
    > "wire envelope 은 이 래퍼를 통째로 싣는다 — 도메인 값은 한 겹 아래다 (2026-08-24 신설, `12_55_09`
    > convention W2). WS/EIA fanout envelope 의 `output`(`execution.node.*`)과 `nodeOutput`(`waiting_for_input`)은
    > **`NodeHandlerOutput` 래퍼 전체**이고 ... 이 문단이 그 구분의 **정본**이다"

    즉 B1 이 "만들어야 한다"고 적은 그 각주가 target 자신의 재판정 기준 커밋에 **이미 존재**한다.
    "언급 0건" 판정은 이 커밋을 대상으로 성립하지 않는다(현재 worktree HEAD 도 `99b9bd908` 이며 위
    각주가 실재함을 직접 확인했다 — `grep -n "12_55_09" spec/conventions/node-output.md` → line 31).

    더 결정적으로, **target 문서 자신의 B6 행이 같은 사실을 이미 인정하고 있다**:
    > B6 | 래퍼/도메인 구분 사본 4곳을 정본 링크로 대체 | **정본 1건 존재**, chat-channel-adapter.md 는
    > 링크 0건

    B6 은 "정본 1건 존재"라고 정확히 적었는데, B1 은 같은 정본을 "언급 0건"이라 적어 **문서 내부에서
    서로 모순**된다. 두 항목이 가리키는 것은 동일한 node-output.md Principle 0 각주다.

    이 상태에서 B1 을 체크리스트대로 집행하면(각주를 "신설"하면) node-output.md 안에 **동일 내용의
    각주가 중복**된다 — 이는 이 각주가 신설된 이유 자체(egress-masking.md 도 같은 취지로 인용하는
    "PR #1190·#1191 에서 지운 문제가 문서 레이어에서 되살아난다"는 반복 방지 원칙)를 정면으로
    위반하는 결과다.
  - 제안: B1 을 "신설" 항목에서 제거하거나, "이미 존재함 확인 — 취소선 처리" 로 항목 성격을 바꾼다.
    남은 실질 작업이 있다면(예: "8키" 구체 나열이 각주 안에 없다는 부분) 그 **차이만** 좁혀 서술하고,
    B6 과의 모순을 해소하도록 두 행을 함께 정정한다. planner 턴에서 `spec/` 을 고치기 전에 이 재판정
    자체를 다시 검증할 것 — "실측했다"고 적은 근거가 재현되지 않는 경우다.

- **[WARNING] B6 "사본 4곳" 중 실제 미전환 개수가 과소 산정됨 — chat-channel-adapter.md 외 2곳 추가 잔존**
  - target 위치: `plan/in-progress/planner-doc-batch.md` §"항목" 표 B6 행
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 각주의 "다른 문서는 여기를 인용한다"
    선언 — WS §4.1 · EIA §R17 · chat-channel-adapter §1.3 · conversation-thread §9.7 네 곳을 "링크"로
    지목
  - 상세: 재판정 결과는 "chat-channel-adapter.md 는 링크 0건" 이라고만 지목했지만, 실제로 확인하면
    4곳 중 **WS §4.1-a 한 곳만** node-output.md Principle 0 을 실제로 링크한다
    (`> **래퍼/도메인 값 구분의 정본은 [node-output.md Principle 0](../conventions/node-output.md)** 이다`,
    99b9bd908 diff 에서 신설).
    나머지 두 곳은 **여전히 자체 산문으로 같은 내용을 중복 서술**하고 있고, node-output.md 로의 링크가
    없다:
    - `spec/5-system/14-external-interaction-api.md` §R17 — `nodeOutput` 표면 설명 구간에
      `node-output.md` 링크가 전무 (`grep -n "node-output.md" spec/5-system/14-external-interaction-api.md`
      의 유일한 결과는 §5.4 부근의 Principle 7 링크 하나뿐, R17 구간엔 없음).
    - `spec/conventions/conversation-thread.md` §9.7 — `node.failed`/`node.completed` 행에
      "wire `output` 은 `NodeHandlerOutput` 래퍼 전체라 도메인 값이 한 겹 아래다" 를 **자체 산문으로
      재서술**하고 node-output.md Principle 0 앵커로 링크하지 않는다.

    chat-channel-adapter.md §1.3 도 동일 패턴(자체 JSDoc 산문, 링크 없음)이라 target 의 지목 자체는
    틀리지 않았지만, "정본 1건 존재"라는 재판정 문구가 **잔존 사본 개수를 실제보다 적게 잡을 위험**이
    있다 — B6 을 chat-channel-adapter.md 1곳만 고치는 작업으로 좁혀 집행하면 EIA §R17·
    conversation-thread §9.7 두 곳이 사본으로 남아, node-output.md 각주가 스스로 주장하는 "다른 문서는
    여기를 인용한다"가 부분적으로 거짓인 상태가 굳어진다.
  - 제안: B6 범위를 "사본 4곳 중 실제 미전환 3곳(EIA §R17 · conversation-thread §9.7 ·
    chat-channel-adapter §1.3)" 으로 재산정하고, 각 위치에 node-output.md Principle 0 앵커 링크를 추가한
    뒤 중복 산문을 제거(또는 요약 + 링크로 축약)한다. WS §4.1-a 는 이미 링크가 있으므로 손대지 않는다.

- **[INFO] 재판정 방법론(grep 기반 "언급 N건")의 검증 가능성을 목표 문서에 남길 것을 권장**
  - target 위치: `plan/in-progress/planner-doc-batch.md` §"항목" 표 전체
  - 위반 규약: 직접적인 조항 위반은 아니며, `.claude/docs/` 수준의 일반 관행(측정 근거 재현성)에
    해당 — spec/conventions 자체 규약은 아니므로 등급을 INFO 로 둔다.
  - 상세: B1 이 반증된 근본 원인은 재판정이 "무엇을 어떤 검색어로 어디까지" 훑었는지가 target 에
    남아있지 않아 사후 검증이 어려웠다는 점이다(반대로 B2·B4·B5 는 이번 검토에서 직접 재현되어
    정확함이 확인됐다). B1·B6 처럼 최근 커밋(같은 날 다른 세션)이 만든 변경과 맞물리는 항목은 특히
    "무엇을 grep 했는지"를 남겨야 다음 사람이 재현/반증할 수 있다.
  - 제안: 각 B 항목 재판정에 사용한 검색어·범위를 각주로 남기거나, 최소한 착수 직전 1회 더
    `git log -1 --format=%H -- <file>` 로 대상 파일이 재판정 커밋 이후 변경되지 않았는지 재확인하는
    절차를 §"작업" 체크리스트에 추가한다.

---

### 요약

target(`plan/in-progress/planner-doc-batch.md`)은 문서 구조·frontmatter(`spec_impact` 리스트,
`worktree` 필드 등) 자체는 CLAUDE.md/plan-lifecycle 관행을 잘 따르고 있고, B2·B4·B5 재판정은 현재
`spec/conventions/**` 상태와 직접 대조해 정확함을 확인했다. 그러나 B1 은 target 이 스스로 명시한
재판정 기준 커밋(`99b9bd908`)에서 이미 반증된다 — 그 커밋 자신이 node-output.md Principle 0 에
"wire-only 키" 각주를 신설했고, target 의 B6 행이 그 사실("정본 1건 존재")을 이미 인정하고 있어 B1과
B6 이 같은 문서 안에서 서로 모순된다. 이 상태로 B1 을 문자 그대로 집행하면 node-output.md 가 막
확립한 반-중복(단일 정본) 규약을 정면으로 위반하는 중복 각주를 만들게 된다. 추가로 B6 의 "사본 4곳"
잔존 개수도 실측보다 적게(1곳만) 잡혀 있어, 집행 시 EIA §R17·conversation-thread §9.7 두 곳이
사본으로 계속 남을 위험이 있다. `spec/` 쓰기 착수 전에 B1/B6 재판정을 정정하는 것을 권고한다.

### 위험도

HIGH
