# Rationale 연속성 검토 — node-output-envelope

대상: `spec/5-system/6-websocket-protocol.md` / `spec/5-system/14-external-interaction-api.md` §R17 /
`spec/conventions/conversation-thread.md` (diff `origin/main...HEAD`)

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 nested blockquote 삽입으로 인접 문장의 지시대상이 흐려짐
  - target 위치: `CHANGELOG.md` "Unreleased" 항목, `> **정정 (같은 날 닫혔다 — 단 waiting 표면 한정)**:` 단락 내부에 `> > **정정 (2026-08-24)**: …` 중첩 인용이 삽입된 자리
  - 과거 결정 출처: 같은 단락의 2026-08-23 문구("유예 사유였던 *envelope shape 이 달라 별건 변경이 필요하다*가 실측으로 반증됐다")
  - 상세: 새로 삽입된 2026-08-24 중첩 블록(`envelope.output`/이종 payload 반증)이 원래 2026-08-23 단락("waiting 표면"의 envelope-shape 반증)의 중간에 끼어들면서, 삽입 블록 직후에 이어지는 "유예 사유였던 …" 문장이 마치 2026-08-24 블록을 가리키는 것처럼 읽힌다. 실제로는 그 문장이 가리키는 "envelope shape 이 달라 별건 변경이 필요하다"는 2026-08-23 waiting 표면 반증 근거이고, 2026-08-24 블록의 반증 근거는 "이종 payload({})" 였다(둘은 다른 문장). 내용 자체는 두 곳(spec 본문·plan)에서 정확히 기록돼 있어 사실관계 오류는 아니고, 순수 가독성 문제다.
  - 제안: `CHANGELOG.md`에서 2026-08-24 nested 블록을 해당 단락 맨 끝(기존 "대신 목록이 9키에서 13키로…" 문단 앞)으로 옮기거나, "유예 사유였던 …" 문장 앞에 "(2026-08-23 결정에 대해)" 같은 명시적 앵커를 붙이면 해소된다. 필수 수정 아님 — 다음 편집 시 정리 권장.

## 그 외 확인한 항목 (문제 없음 — 참고용)

- **결정 번복 + 새 Rationale 동반**: `spec/5-system/14-external-interaction-api.md` §R17 표의 `execution.node.completed`/`.failed`의 `envelope.output` 행이 "deny-list 유지(잔여)" → "fail-closed allowlist"로 뒤집혔다. 직전 유예 근거("이종 payload, 목록을 걸면 `{}`가 된다")는 취소선으로 보존하고, "재정정(2026-08-24)" 블록에 (a) 무엇이 틀렸는지("그 객체가 outputData가 된다는 전제"가 틀림) (b) 실측 근거(e2e 285건 후 실 DB 조회, top-level 키 분포 표) (c) 잔존 위험(`finalAdapted ?? nodeOutputCache` 폴백 경로, 캐너리로 고정) (d) 외부 수신자 영향 고지(제3자 webhook 구독자는 확인 범위 밖)까지 전부 명시했다. `spec/conventions/conversation-thread.md`·`CHANGELOG.md`·`plan/complete/node-output-envelope.md`·`plan/complete/sse-nodeoutput-allowlist.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`·`plan/in-progress/spec-draft-eia-62-waiting-payload.md` 6곳 모두 같은 취소선+정정 패턴으로 동기화돼 있고, 낡은 "잔여"/"이종 payload" 서술이 남아있는 곳은 `spec/` 전체 grep(`envelope.output`, `이종 payload`)으로 확인한 결과 없다. `codebase/backend/.../websocket.service.spec.ts`의 이전 `[잔여]` 캐너리("아직 allowlist 를 지나지 않는다")도 실제로 뒤집혀 `[캐너리]` 통과 단언으로 교체됐고, 잔존 위험(폴백 경로)은 별도 `[잔여 고정]` 캐너리로 새로 고정됐다 — 결정 번복 시 캐너리를 갱신하지 않고 방치하는 패턴(과거 반복 지적된 결함 유형)이 재발하지 않았다.
- **합의 원칙 위반 여부**: `getStatus` terminal `result`/`error`가 "작성자가 정의한 워크플로 출력이라 allowlist 를 걸면 안 된다"는 기존 원칙(§R17)은 이번 diff가 건드리지 않았고, 이번에 allowlist가 걸린 `envelope.output`은 `NodeHandlerOutput` 래퍼 레벨(`config`/`output`/`meta`/`port`/`status`)에만 적용되며 그 안의 도메인 값(`output.output`)은 그대로 유지된다 — "작성자 정의 출력은 안 자른다" 원칙과 층이 달라 충돌하지 않는다. WS §Rationale의 `llmCalls` strip-only 결정, EIA R17의 "적용 범위는 총칭이 아니라 열거다" 원칙도 이번 변경이 그대로 준수(표에 행을 하나씩 늘리는 방식)했다.
- **자기-반증형 소정정 거버넌스**: `plan/complete/node-output-envelope.md`의 `spec_impact` 프런트매터가 두 파일(`14-external-interaction-api.md`, `6-websocket-protocol.md`)은 "API 계약 문서라 CLAUDE.md 예외 조건 2에 해당하지 않는다"며 planner 턴으로 명시 분리하고, `conversation-thread.md` 한 곳만 자기-반증형 소정정 조건(1~5)을 조건별로 근거를 달아 적용했다 — CLAUDE.md의 narrow exception 남용(무엇이든 "실측했으니 고쳤다"로 확대하는 것)을 막는 의도와 정합적이다.
- **암묵적 가정 충돌**: 없음. "내부 WS(에디터)는 대상이 아니다"라는 §4.4/§R17의 기존 invariant는 이번 diff에서도 그대로 유지되고(신규 캐너리가 "내부 WS 는 원문 유지"를 직접 단언), fail-open 정책(Redis 미가용 시 저하 허용, `data-flow/15-external-interaction.md` Rationale)과는 별개 축(egress 필터링)이라 충돌하지 않는다.

## 요약

이번 target(`node-output-envelope`)은 지난 결정(`#1208`이 남긴 "envelope.output은 이종 payload라 같은 allowlist를 못 건다"는 유예)을 번복하지만, 실측(e2e 285건 후 실 DB 조회) 근거·잔존 위험 고지·캐너리 갱신·6개 관련 문서(spec 2곳 + convention 1곳 + CHANGELOG + plan 3곳)의 취소선 기반 동기 수정을 모두 갖춘, Rationale 연속성 관점에서 모범적인 사례다. 과거에 반복 지적됐던 실패 형태(결정 번복 후 캐너리 미갱신, "잔여" 문구 방치, 근거 없는 번복)가 전혀 재발하지 않았다. 발견된 유일한 문제는 `CHANGELOG.md`의 중첩 인용 삽입으로 인한 지시대상 가독성 저하(INFO)뿐이며, Rationale 내용 자체의 정합성 문제는 아니다.

## 위험도

LOW
