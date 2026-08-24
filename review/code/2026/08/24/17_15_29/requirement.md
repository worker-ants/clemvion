# 요구사항(Requirement) 리뷰 — planner 턴 doc 묶음 (`plan/in-progress/spec-draft-planner-doc-batch.md` B1~B7)

## 검증 방법

프롬프트 번들이 조립 문서라 게이트 숫자를 소스 라인으로 그대로 신뢰하되, 핵심 claim은 저장소를
직접 `Read`/`grep`으로 재검증했다: `node-output.md`/`egress-masking.md`/`6-websocket-protocol.md`/
`14-external-interaction-api.md`/provider 3파일의 실제 diff, `websocket.service.ts`의
`toFanoutEnvelope`/`allowlistFanoutNodeOutput` 실 구현, `node-output-allowlist.ts`의
`NODE_OUTPUT_ALLOWED_KEYS`·라벨 주석, `node-output-allowlist.spec.ts`의 8키 literal test,
chat-channel 렌더러(`discord-message.renderer.ts`)의 `extractRendered`/`extractVisualPayload`,
위젯 `eia-events.ts`의 `parseWaitingForInput`. 그리고 `plan/in-progress/spec-draft-planner-doc-batch.md`
(3회차 `17_04_25` RESOLUTION이 주장한 4개 WARNING 수정)와 그 자매 문서
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`("정본 트래커")를 `git log`로
커밋 이력까지 대조했다.

## 발견사항

- **[WARNING]** `spec-sync-external-interaction-api-gaps.md`("정본 트래커")의 B3 항목이
  `16_41_05` 라운드에서 CRITICAL로 반증되고 `dd8a17207`에서 재작성된 **폐기된 근거를 그대로
  "해소" 문구로 들고 있다** — 3회차(`17_04_25`)가 자매 문서(plan 파일)에서 고친 바로 그
  자기모순이 이 트래커에는 반영되지 않았다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322`
    (`> **해소 (2026-08-24)**: 각주에 **동일 이름·다른 계층** 표를 넣었다 — ...`)
  - 상세: `git log`로 확인하면 이 파일을 마지막으로 건드린 커밋은 `4af06d951`(1차 반영)이고,
    이후 `74186fd51`/`dd8a17207`/`3bae8bc33` 어느 것도 이 파일을 건드리지 않았다
    (`git log --follow -- plan/in-progress/spec-sync-external-interaction-api-gaps.md`).
    그런데 `16_41_05` rationale_continuity가 정확히 이 "동일 이름·다른 계층" 논거를
    CRITICAL로 잡았다(`node-output.md` Principle 1.1.4·WS 자신의 C3 Rationale과 정면
    충돌 — `nodeOutput.nodeType`은 코드 실측상 진짜 중복 판별자다) — 그리고 `dd8a17207`가
    실제 spec 각주(`spec/5-system/6-websocket-protocol.md:509-541`)를 "C3는 지켜지고
    있고 allowlist는 예방적 허용, 새 코드가 쓰면 여전히 C3 위반"으로 재작성했다.
    plan 파일(`spec-draft-planner-doc-batch.md:165-168`)은 이 정정을 취소선 +
    정정 주석으로 정확히 반영했지만(`17_04_25` RESOLUTION WARNING 1 fix 확인,
    직접 Read로 검증 완료), **"정본 트래커"라고 스스로 부르는 자매 문서는 같은 회차의
    같은 문구를 여전히 미수정 상태로 들고 있다.** 이 트래커만 읽는 다음 planner
    세션은 B3가 "동일 이름·다른 계층" 논리로 닫혔다고 오독할 수 있다 — 실제 spec은
    그 논리를 명시적으로 폐기했다.
  - 제안: line 322을 `spec-draft-planner-doc-batch.md:165-168`과 같은 관례로 정정 —
    "동일 이름·다른 계층" 문구에 취소선을 긋고 "`16_41_05` CRITICAL로 반증, 실제 각주는
    `dd8a17207`가 재작성('C3는 지켜지고 있고 allowlist는 예방적 허용')" 정정 주석 추가.

- **[WARNING]** 같은 트래커의 B1 항목도 `16_41_05` convention_compliance에서 반증된
  "코드 주석과 같은 문구" 주장을 그대로 들고 있다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:121`
    (`> **해소 (2026-08-24, \`planner-doc-batch\`)**: ... 라벨은 \`NODE_OUTPUT_ALLOWED_KEYS\`
    주석과 **같은 문구**를 썼다(세 번째 표현 금지). ...`)
  - 상세: 실측(`node-output-allowlist.ts:47-48,73,78`)으로 확인하면 코드 JSDoc/인라인 주석은
    접미어 없는 축약형(`wire 전용 (위젯)`/`(chat-channel)`)이고, spec의 긴 라벨
    (`wire 전용 (위젯 파서)`/`(chat-channel 렌더러)`)과 문자 그대로 같지 않다 — 실제로는
    `EIA §R17`의 기존 표기와 일치한다. 이 사실은 `16_41_05` convention_compliance
    WARNING으로 지적됐고, `node-output.md` 본문(현재 line 63-66)은 "EIA §R17과 같은 문구
    (코드 JSDoc은 축약형이라 문자 그대로 같지는 않다)"로 이미 정확히 정정돼 있다. 그런데
    트래커의 "해소" 요약문은 이 정정 이전 버전("코드 주석과 같은 문구")을 그대로 두고 있다.
  - 제안: line 121의 "라벨은 `NODE_OUTPUT_ALLOWED_KEYS` 주석과 같은 문구를 썼다"를
    "라벨은 EIA §R17과 같은 문구를 썼다(코드 JSDoc은 접미어 없는 축약형이라 문자 그대로
    같지는 않음, `16_41_05` convention W3)"로 정정.

- **[INFO]** 위 두 건 모두 실제 `spec/**` 라이브 문서(spec 자신)는 이미 정확히 수정돼 있고,
  코드·타 spec과의 대조도 전부 일치함을 직접 확인했다 — 문제는 오직 "정본 트래커"라는
  기록용 문서 한 곳의 stale 서술이다. 기능적 결함이나 라이브 invariant 위반은 아니다.
  발생 원인도 명확하다: 3회차에 걸친 `/consistency-check --spec`의 `target_path`가 매번
  `plan/in-progress/(spec-draft-)planner-doc-batch.md` 한 파일로만 고정돼(`meta.json` 확인)
  자매 트래커 문서는 어느 라운드에서도 검토 스코프에 들지 않았다 — 게이트가 대상으로
  삼지 않은 문서에는 같은 결함이 재발해도 잡히지 않는다는, 이 세션이 이미 여러 차례
  기록한 "checker payload 사각지대" 패턴의 새 변형이다.

## 검증 완료 (문제 없음 — 발견사항 아님)

아래는 직접 코드/spec 대조로 정확함을 확인한 핵심 claim들이다:

- `websocket.service.ts:toFanoutEnvelope`의 실제 4단계 호출 순서 `maskWireEnvelope →
  stripExternalOnlyFields → allowlistFanoutNodeOutput → attachRoutingContext`는
  `egress-masking.md` §2 신설 서술과 정확히 일치.
- `allowlistFanoutNodeOutput`가 좁히는 세 자리(`nodeOutput`/`buttonConfig.nodeOutput`/
  `output`)는 `egress-masking.md` 신설 각주와 일치.
- `NODE_OUTPUT_ALLOWED_KEYS`의 wire-only 8키(`formConfig`·`conversationConfig`·
  `buttonConfig`·`interactionType`·`payload`·`title`·`rendered`·`nodeType`)는
  `node-output.md` Principle 0 신설 각주의 "현재 8키" 표와 정확히 일치하고,
  `node-output-allowlist.spec.ts`에 리터럴 테스트로 고정돼 있음을 확인.
- `parseWaitingForInput`(위젯)이 실제로 `formConfig`/`conversationConfig`/`buttonConfig`/
  `interactionType`을 읽고, `extractRendered`(chat-channel 렌더러)가 실제로
  `rendered → payload.rendered → output.rendered` 세 후보를 훑는 것을 확인 — B7 판정
  ("`output.rendered`는 도메인 값을 가리키는 정확한 표기, 경로는 현행 유지 + 프레임 각주만
  추가")이 코드 동작과 일치.
- WS §4.4 신설 각주("노드 종류를 읽으려면 소비자별로 갈린다 — 내부는 `waitingNodeType`,
  외부는 `interactionType`")가 `EIA §R17`("`node.type`은 외부 소비 매핑이 없다")과
  일치하도록 3회차(`17_04_25`)에서 정확히 스코프를 나눠 정정된 것을 확인.
- B6 미러 3곳(`chat-channel-adapter.md:192` · `conversation-thread.md:585` ·
  `14-external-interaction-api.md:1813`)이 전부 `node-output.md` Principle 0을 정확히
  링크하고, WS §4.1-a(line 259)는 사전에 이미 링크돼 있어 "손대지 않는다" 판정과 일치함을
  확인.
- `plan/in-progress/planner-doc-batch.md` → `spec-draft-planner-doc-batch.md` 리네임이
  깨끗이 완료됐고(`git log --follow` 확인), 저장소 전체에 구 파일명에 대한 참조 잔존이
  0건임을 확인(`grep -rn "planner-doc-batch.md"`).
- `spec-sync-external-interaction-api-gaps.md`의 harness 갭 신규 항목(line 251-278)은
  실제로 `harness-consistency-summary-downgrade-rule.md`·`harness-review-gate-followups.md`
  로의 상호 참조를 담고 있어 `17_04_25` WARNING 4 fix가 정확히 반영됨을 확인.
- TODO/FIXME/HACK/XXX 마커는 이번 diff 대상 spec 파일들에 없음.

## 요약

이 PR은 순수 문서(spec) 정합화 작업이며, 3라운드에 걸친 `/consistency-check --spec`이 실제로
Critical 결함(B3 각주가 코드에 없는 구분을 지어내 기각된 판별자를 되살릴 뻔한 것)과 다수의
WARNING(브래킷 표기 불일치, `waitingNodeType` 무자격 권고, 라벨 표기 오류, 파일명 관례 이탈,
harness 트래커 고립 등재)을 실제로 잡아 고쳤다. 직접 코드·spec 대조로 재검증한 결과 최종
반영분(8키 allowlist, 4단계 masking 파이프라인, 3자리 allowlist chokepoint, provider 표
프레이밍, C3/§R17 정합)은 전부 정확하다. 다만 3회차가 plan 문서(`spec-draft-planner-doc-batch.md`)
자신의 자기모순(B3의 폐기된 근거가 취소선 없이 남아있던 것)은 정확히 고쳤음에도, 같은 문제가
**자매 "정본 트래커" 문서(`spec-sync-external-interaction-api-gaps.md`)의 B1·B3 항목에도
독립적으로 존재**하며 이번 3회 게이트 어디에서도 다뤄지지 않았다 — `target_path`가 매번 plan
파일 하나로 고정돼 트래커 문서가 검토 스코프 밖에 있었기 때문이다. 라이브 spec 본문은 안전하고
기능적 위험은 없지만, 다음 planner 세션이 "정본"이라 믿고 참조할 그 트래커에 두 곳의 stale/
반증된 해소 근거가 남아 있다는 것은 이 PR이 스스로 표방한 목표("문서 부채를 한 번에 정리")를
완전히 달성하지 못했다는 뜻이다.

## 위험도

LOW
