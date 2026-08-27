# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 검토 범위와 방법

diff-base `origin/main` 대비 `spec/5-system/` 스코프에서 실제 변경된 파일은
**`spec/5-system/4-execution-engine.md` 1개**(4 hunks, 5 insertions / 3 deletions)뿐이다
(worktree 에서 `git diff origin/main...HEAD -- spec/5-system/` 로 직접 재확인).
4개 편집 모두 "`maskSensitiveFields` boundary" 서술을 "allow-list" 로 정정하고, `config` 에는
storage-time 마스킹이 없다(마스킹은 egress 에서만)는 블록을 신설하는 **정정/전파** 편집이라
`plan/complete/masking-expression-egress-split.md` 의 `spec_impact` 6개 파일(전체 diff 기준)에도
새 요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로가 **신설되지 않는다**. 따라서 6개 관점 중
"새 이름이 기존 이름과 문자 그대로 충돌"하는 사례는 없다.

다만 이 정정이 **R-5 의 원칙 이름 자체를 개명**(`boundary masking parity` → `egress masking parity`,
`spec/2-navigation/14-execution-history.md:469`)했는데, 그 개명이 R-5 를 인용하는 spec/5-system/
내부 사이트들에 전파되지 않아 **같은 원칙을 가리키는 두 이름이 공존**하게 된 잔여를 발견했다.
이는 "신규 식별자가 기존 이름과 충돌"의 정확한 역방향(구식별자가 개명 후에도 잔존해 신·구 이름이
같은 것을 가리키며 혼재)이지만, 이 게이트가 막으려는 위험(구현 후 문서들이 같은 대상을 서로 다른
이름으로 불러 혼선을 유발하는 것)과 결이 같아 보고한다. `review/consistency/.../rationale_continuity.md`
는 `4-execution-engine.md` 자체의 취소선 정정 4곳만 확인했고 아래 잔여 3곳은 다루지 않았다.

## 발견사항

- **[CRITICAL]** R-5 의 원칙명이 `boundary masking parity` → `egress masking parity` 로 개명됐는데, spec/5-system/ 두 파일이 옛 이름을 여전히 인용한다

  - target 신규 식별자: `egress masking parity` — 이번 diff 가 R-5 본문에서 새로 쓴 이름
    (`spec/2-navigation/14-execution-history.md:469`, "즉 안전성은 **롤 게이팅이 아니라 서버
    egress masking parity** 에 의존한다").
  - 기존 사용처(개명 반영 안 됨):
    - `spec/5-system/14-external-interaction-api.md:1530` — `"[실행 내역 R-5]...의 *"안전성은
      롤 게이팅이 아니라 서버 boundary masking parity 에 의존"* 원칙과... 같은 방향이다."`
    - `spec/5-system/6-websocket-protocol.md:196` — `"...[EIA §R17]...의 boundary masking parity
      원칙과 같은 근거다."`
    - (참고, spec/5-system/ 밖) `spec/2-navigation/14-execution-history.md:467` 자기 자신의
      바로 위 문단("R-5 의 대상 범위", 2026-08-16 추가) — `"R-5 의 *"boundary masking parity"*
      원칙은..."` — R-5 본문을 **인용부호로 직접 인용**하는데, 그 R-5 본문(줄 469, 같은 diff hunk
      안에서 편집됨)은 더 이상 그 문자열을 담고 있지 않다.
  - 상세: 이번 diff 의 hunk 는 정확히 `spec/2-navigation/14-execution-history.md` 줄 466 부터
    시작해 줄 467(옛 이름을 인용하는 문장, **변경 안 됨**)을 컨텍스트로 포함하면서 줄 469
    (R-5 본문, `boundary` → `egress` 로 **변경됨**)를 고쳤다 — 즉 개명 대상과 그 개명을 그대로
    인용하는 문장이 **같은 hunk 안에 나란히** 있었는데 후자가 갱신되지 않았다. 이 결과 지금
    `spec/2-navigation/14-execution-history.md` 는 한 문서 안에서 R-5 를 "`boundary masking
    parity`"(줄 467, 인용부호 포함)라고도 부르고 "`egress masking parity`"(줄 469, R-5 본문
    자신)라고도 부른다. 같은 드리프트가 `spec/5-system/14-external-interaction-api.md`(EIA
    §R17, `Execution.error`/`nodeExecutions[].error` 마스킹 근거로 R-5 를 원용하는 절)와
    `spec/5-system/6-websocket-protocol.md`(§4.1 값-패턴 마스킹 절, 동일 근거 원용)에도
    그대로 남아 있다 — 두 파일 다 이번 diff 의 손이 닿지 않았다(`git diff origin/main...HEAD
    -- spec/5-system/14-external-interaction-api.md spec/5-system/6-websocket-protocol.md`
    출력 없음, 실측 확인).
    다음 독자가 EIA §R17 이나 WS §4.1 에서 `"boundary masking parity"` 를 따라가 R-5 로 가면
    그 정확한 문구를 찾지 못하고, 반대로 R-5 를 먼저 읽고 `"egress masking parity"` 를 이 두
    문서에서 grep 하면 안 걸린다 — SoT 를 인용부호로 직접 인용하는 관행(이 저장소가 반복적으로
    쓰는 패턴)이 이 3곳에서 깨져 있어 인용 검증(quotation integrity)이 실패한다. 근본 메커니즘
    설명(egress 시점에 값-패턴 마스킹)은 세 문서 다 여전히 정확하므로 기능적 결함은 아니지만,
    "같은 원칙에 서로 다른 이름표"가 spec/5-system/ 두 곳에 남아 차기 검토·감사가 R-5 를 SoT 로
    grep 할 때 정합성 확인에 실패하게 만든다.
  - 제안: `spec/5-system/14-external-interaction-api.md:1530` 과
    `spec/5-system/6-websocket-protocol.md:196` 의 `boundary masking parity` 를 `egress masking
    parity` 로 정정(또는 최소한 "R-5 는 이후 이 원칙을 `egress masking parity` 로 개명했다" 각주
    추가)하고, 같은 김에 `spec/2-navigation/14-execution-history.md:467` 의 인용부호 안 문구도
    현재 R-5 본문과 일치시킨다. `masking-expression-egress-split` plan 의 `spec_impact` 에는
    이 세 사이트가 빠져 있었으므로(6개 목록에 `14-external-interaction-api.md`·
    `6-websocket-protocol.md` 없음), 후속 정정을 별도 항목으로 등재할 것을 권한다.

## 요약

이번 target 편집(`spec/5-system/4-execution-engine.md` 4곳)은 이미 확정된 2026-08-24 정정
(엔진 boundary 마스킹 제거 → egress-only)을 뒤늦게 미러링하는 것으로, 새 요구사항 ID·엔티티·
endpoint·이벤트·ENV·파일 경로를 신설하지 않아 문자 그대로의 "신규 식별자 충돌"은 없다. 그러나
같은 정정 물결의 진원지인 R-5(`spec/2-navigation/14-execution-history.md`)가 자신의 안전 원칙명을
`boundary masking parity` 에서 `egress masking parity` 로 바꾸면서 그 개명이 R-5 를 직접 인용하는
spec/5-system/ 두 파일(EIA §R17, WS 프로토콜 §4.1)과 R-5 자신의 인접 문단에 전파되지 않아, 같은
보안 원칙을 가리키는 두 이름이 저장소에 공존한다. 기능적 결함은 아니나 인용 검증이 깨져 있어
정정해 둘 것을 권한다.

## 위험도

MEDIUM
