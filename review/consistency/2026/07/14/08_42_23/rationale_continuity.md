# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 조사 방법 메모

payload 의 "관련 Rationale 발췌" 절은 크기 캡으로 `spec/2-navigation/4-integration.md` 까지만
덤프되고 `... (truncated due to size limit) ...` 로 끊겨, 정작 본 diff 와 가장 밀접한
`spec/5-system/4-execution-engine.md`(target 자신) · `spec/5-system/14-external-interaction-api.md`
(EIA) · `spec/5-system/15-chat-channel.md` 의 `## Rationale`/본문 결정 근거는 발췌에 포함되지
않았다. 이 세 문서와 `plan/in-progress/eia-command-waiting-surface-guard.md`, `CHANGELOG.md`,
관련 git log(commit 메시지)를 워크트리에서 직접 대조해 검토했다.

## 발견사항

이번 diff(F-1: EIA `nodeId` 실제 대기 노드 대조 / F-2: chat-channel `surfaceMismatch` 안내)에서
**과거 Rationale 위반·무근거 번복·기각 대안 재도입은 발견되지 않았다.** 다음 근거로 판단했다.

1. **F-1 은 기존 계약의 미이행 갭을 메우는 변경이지, 신규 결정의 무단 도입이 아니다.**
   - `origin/main` 시점 `spec/5-system/4-execution-engine.md` §7.5.1 은 이미 "publish 직전
     `nodeId → nodeExecutionId` DB lookup... 매칭 0건=다른 상태거나 nodeId 미일치" 라고
     기술했고, `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행도
     이미 "다른 nodeId" 를 409 사유로 명시했다. 그러나 실제 `origin/main` 코드
     (`resolveWaitingNodeExecutionId`)는 `execution_id + status` 로만 조회해 `nodeId` 를
     전혀 대조하지 않았고(`git show origin/main:...execution-engine.service.ts` 확인),
     `assertNodeId` 도 존재 검사만 수행했다(diff 의 e2e 주석 "I-16: nodeId body 는 assertNodeId
     유무 검사만 수행" 이 이를 증언). 즉 spec-code drift 가 이 PR 이전부터 있었고, 본 diff 는
     그 drift 를 닫는 버그 수정이다. EIA §5.1 에 신설된 "`STATE_MISMATCH` 강제 정합 (2026-07)"
     노트가 이 사실(계약은 항상 409, 종전 202 는 결함)을 명시적으로 기록한다.
   - `plan/in-progress/eia-command-waiting-surface-guard.md` F-1 항목이 "결정(사용자,
     2026-07-14): Approach B — 외부 caller 만 검사 + `in_process_trusted` 면제" 를 명시적으로
     기록했고, `CHANGELOG.md` Unreleased 항목도 동일 결정·이유·커버리지를 상세 기술한다.
     `git log`(`8c4e76a5d`, `3bbe3cc90`, `4272113ff`) 로 봤을 때 초기 구현이 ai-review 에서
     "CRITICAL: spec §7.5.1 이 'WS 도 nodeId 지정' 이라 overclaim" 을 지적받아 즉시 진입점별
     커버리지 표로 정정한 이력도 확인된다 — 즉 본 diff 가 검토 시점에 보여주는 spec 상태는
     이미 한 차례 self-correction 을 거친 결과이며 남은 overclaim 은 없다.

2. **`in_process_trusted` scope 면제는 신규 trust 완화가 아니라 기존 invariant(EIA-AU-08)의
   재사용이다.** EIA §3.3.1 EIA-AU-08 은 이미 `scope: 'in_process_trusted'` 가 토큰 검증
   자체를 완전히 우회하는 강한 신뢰 경계임을 정의해 두었다. 이번 diff 가 그 동일 scope 에
   nodeId 일치 검사(우회의 강도가 훨씬 약한 체크)까지 면제한 것은 이미 합의된 신뢰 경계
   패턴의 연장이지, 새로운 ad hoc 예외가 아니다. `4272113ff` 커밋은 면제 사유 프레이밍을
   "nodeId 미상이라 면제"(부정확)에서 "scope 단위 정책 면제"(정확 — nodeId 를 아는
   `handleFormStep` 도 동일 면제)로 스스로 정정했고, 이 정정이 spec(§7.5.1 커버리지 표)·
   plan·코드 주석 4곳에 일관되게 반영돼 있다.

3. **F-2(surfaceMismatch 안내)는 CCH-ERR-04("silently swallow 금지") 원칙을 준수하는
   방향**이며, 기존 `sessionExpired` resolver 패턴을 그대로 재사용한다. MarkdownV2 특수문자를
   피한 default 문구 채택은 "다른 안내는 telegram escape 를 baked-in" 하는 기존 관례와의
   차이를 spec 본문(§4.1.1)이 명시적으로 인지하고 사유(control-plane 직접 발송 경로라 렌더러
   escape 미적용)를 남겨, 원칙과의 거리감이 문서화돼 있다.

### INFO — Rationale 정합 보완 제안

- **[INFO] F-1 설계 결정의 `## Rationale` 절 미등재**
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 (본문 표 + 커버리지 표)
  - 과거 결정 출처: 없음(신규 관찰) — 본 프로젝트 관례(`CLAUDE.md` "결정의 배경·근거 → 해당
    spec 문서 끝의 `## Rationale`")와의 배치 정합성 관찰
  - 상세: `resolveWaitingNodeExecutionId` 를 "단일 WHERE(execution_id+node_id+status)" 에서
    "먼저 execution_id+status 로 조회 후 별도로 nodeId 비교(+scope 별 면제)" 로 재설계한
    이유·Approach A(검토됐을 가능성이 있는 "전원 강제" 안) 대비 Approach B 채택 근거는
    plan 파일·CHANGELOG·코드 JSDoc 에는 상세히 있으나, `spec/5-system/4-execution-engine.md`
    자체의 `## Rationale` 절에는 신규 항목이 없다("대기 표면 ↔ 명령 매트릭스" 항목은 표면
    검증만 다루고 nodeId 검사는 다루지 않는다). 같은 패턴(EIA §5.1 "STATE_MISMATCH 강제 정합"
    노트)도 본문 배치라 전례는 있으나, nodeId 검사처럼 향후 F-6(WS/`/continue` 확장) 때 다시
    참조될 결정은 `## Rationale` 로 승격해두면 탐색성이 좋아진다.
  - 제안: 후속 F-6 착수 시(또는 본 plan 완료 이동 시) `spec/5-system/4-execution-engine.md
    ## Rationale` 에 "nodeId 일치 검사 — scope 단위 면제 (Approach B, §7.5.1, 2026-07-14)"
    항목을 신설해 plan/CHANGELOG 의 결정 근거를 spec SoT 쪽으로도 미러링할 것을 권장(강제
    아님 — 현재 상태로 정보 유실은 없음).

- **[INFO] Rationale 발췌 payload 의 커버리지 공백**
  - target 위치: 본 checker 의 입력 payload `_prompts/rationale_continuity.md`
  - 상세: "관련 Rationale 발췌" 절이 크기 캡으로 `spec/2-navigation/4-integration.md` 에서
    끊겨, 정작 diff 가 참조하는 `4-execution-engine.md`·`14-external-interaction-api.md`·
    `15-chat-channel.md` 의 Rationale/결정 근거가 발췌에서 누락됐다. 이번엔 워크트리 직접
    조회로 보완했으나, orchestrator 의 발췌 선정 로직이 "target 문서 및 diff 가 참조하는
    spec" 을 우선순위로 두도록 개선하면 재현성이 좋아진다.
  - 제안: orchestrator 의 Rationale 발췌 수집 순서를 알파벳/디렉토리 순이 아니라
    "target 문서 자신 → diff 파일이 언급하는 spec 참조(§X.Y 링크) → 나머지" 우선순위로
    조정 검토.

## 요약

target(`spec/5-system/4-execution-engine.md`)과 함께 변경된 EIA·chat-channel spec·코드는
과거 Rationale 을 위반하거나 기각된 대안을 무단 재도입하지 않는다. F-1(nodeId 일치 검사)은
EIA-IN-13·EIA §5.1·`InteractDto.nodeId` 계약이 이미 약속했으나 구현이 이행하지 않던
pre-existing spec-code drift 를 closing 하는 버그 수정이며, `in_process_trusted` scope 면제는
기존 EIA-AU-08 신뢰 경계 invariant 의 일관된 연장이다. 초기 구현의 CRITICAL spec overclaim
("WS 도 nodeId 지정")은 이미 같은 브랜치 내 ai-review 라운드에서 발견·정정됐고, 그 정정이
spec·plan·코드 주석 전반에 일관되게 반영돼 있다. F-2(surfaceMismatch 안내)도 CCH-ERR-04
원칙과 `sessionExpired` resolver 선례를 따르며, 관례와의 편차(MarkdownV2 특수문자 배제)는
본문에 명시적으로 근거가 남아 있다. 발견된 사항은 문서 배치 개선을 제안하는 INFO 2건뿐이다.

## 위험도

LOW
