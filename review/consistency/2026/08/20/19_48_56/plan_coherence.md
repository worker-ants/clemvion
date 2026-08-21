STATUS=success plan_coherence 검토 완료 — WARNING 1건, INFO 1건, CRITICAL 없음
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — `spec-draft-inputoverride-marker-reject.md`

## 검토 방법

`plan/in-progress/**` 전수(번들 포함 63개 절단 파일 중 관련 가능성 있는 항목은
`grep`/`Read` 로 직접 열어 확인) + target 문서 및 실제 spec 현재 상태
(`spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/3-error-handling.md`
§1.7, `spec/5-system/13-replay-rerun.md` §8.1/§10.2)를 대조했다. target 이 스스로
인용하는 정본 트래커 [`spec-sync-external-interaction-api-gaps.md`](../../../../plan/in-progress/spec-sync-external-interaction-api-gaps.md)
의 W5/W6 항목과 target 의 텍스트를 라인 단위로 대조했다.

## 발견사항

- **[WARNING]** target 이 트래커 W5("`Execution.inputData` 응답 의미 반전의 외부 소비자
  확인")를 자기 서술로만 닫고, 정작 그 항목이 등재된 `plan/` 체크박스는 갱신하지 않는다
  - target 위치: `plan/in-progress/spec-draft-inputoverride-marker-reject.md`
    "왜 지금인가" 절 — *"트래커 W5(`inputData` 응답 의미 반전의 외부 소비자 확인)도 **이
    답변으로 닫는다** — 닫을 때 출처를 같은 문장에 적는다."*
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 348행
    `- [ ] **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인**` — 현재도
    미체크(`[ ]`) 상태로 남아 있음(실측: `grep -n "외부 소비자 확인" -A6` 로 직접 확인,
    번들 스냅샷이 아니라 워크트리 현재 파일).
  - 상세: target 은 "저장소 밖에서 `GET /api/executions*` 의 `inputData` 를 직접 소비하는
    것은 없다 — 프런트가 유일 소비자" 라는 사용자 답변을 근거로 W5 를 "닫는다" 고
    서술하지만, 이 문장은 target 문서 자신의 Rationale 로만 남고 W5 가 실제로 등재된
    트래커 문서의 체크박스·산문은 그대로 열려 있다. 이 저장소가 이미 여러 차례 겪은 형태
    ("미룬 항목은 그 턴에 `plan/` 에 적어라" · "체크박스를 옮길 때 그 옆 산문을 같이
    읽어라")의 **반대 방향** 버전이다 — 여기서는 "닫았다" 고 쓴 산문이 실제 체크박스
    갱신을 동반하지 않았다. 이 상태로 두면 (a) 다음 세션·다음 spec-coverage 감사가 W5 를
    여전히 "결정 대기" 로 읽어 같은 확인을 중복 수행하거나, (b) target 문서가
    `plan/complete/` 로 이관된 뒤에는 이 "닫는다" 는 서술의 근거(사용자 답변 출처)가
    W5 원 위치에서 추적 불가능해진다.
  - 제안: target 을 이 스코프의 spec 편집과 같은 턴에, `spec-sync-external-interaction-api-gaps.md`
    348행 W5 체크박스를 `[x]` 로 갱신하고 "2026-08-20, 사용자 직접 확인(저장소 밖 소비자
    없음) — 근거는 `spec-draft-inputoverride-marker-reject.md` 참조" 한 줄을 붙인다.
    (W6 자체는 서버측 체크 구현이 아직 없으므로 미체크 유지가 맞다 — W5 만 해당.)

- **[INFO]** 트래커 W6 항목에 이 spec draft 로의 역참조가 없어, "무엇이 끝났고 무엇이
  남았는지"가 트래커만 봐서는 드러나지 않는다
  - target 위치: 문서 전체(스코프: spec 4곳 변경, 서버측 구현은 별도 developer 턴)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 328~346행
    W6 — *"착수 시 두 가지를 함께 한다: (1) 서버측 체크, (2) planner 턴으로 §R17 에 범위
    문장 추가... 어느 쪽이든 spec 표면이라 `developer` 권한 밖이고, 그래서 이번 PR 에서
    닫지 않는다."*
  - 상세: target 문서는 W6 의 (2)(spec 명문화)를 정확히 수행하는 planner 턴이고 범위 설정도
    W6 의 지시와 일치한다(충돌 없음). 다만 W6 의 산문은 여전히 "세 라운드에 걸쳐 유예했다"
    는 옛 문맥만 담고 있어, 이 draft 가 착지한 뒤에도 트래커만 읽는 사람은 (1) 서버측
    구현이 아직 안 됐다는 것과 (2) spec 명문화는 이 draft 로 이미 진행 중/완료라는 것을
    구분할 수 없다.
  - 제안: target 을 `plan/complete/` 로 옮기는 시점(또는 이번 턴)에 W6 항목에 한 줄
    역참조("(2)는 `spec-draft-inputoverride-marker-reject.md`(→ complete 이관 시 경로 갱신)
    로 집행 — 남은 것은 (1) 서버측 체크")를 추가할 것을 권한다. 차단 사유는 아니다.

## 미해결 결정 충돌 여부 (검토 관점 1)

트래커 W6 은 "거부 여부 자체" 를 사용자 결정으로 남겨 뒀고(*"defense-in-depth 로 얕은
서버측 체크... 검토"*), target 문서 상단은 *"사용자 결정(2026-08-20): 거부 구현 + spec
명문화"* 를 명시적으로 인용한다. 결정 주체가 다르지 않고, target 이 그 결정을 일방적으로
지어낸 흔적도 없다(같은 트래커 항목의 문맥·문구와 정합). `coerce_failed` 재사용 기각도
그 대안을 제안한 라운드(`17_38_33`)를 정확히 인용하며 기각 근거를 self-consistent 하게
제시한다 — 다른 plan 이 이 자리에 대해 다른 결정을 강제하고 있지 않다. **충돌 없음.**

## 선행 plan 미해소 여부 (검토 관점 2)

target 이 전제하는 선행 조건(§R17 `Execution.inputData` 마스킹 카브아웃 폐쇄·프런트 마커
가드 3소비처 완성·`toResponseExecution` 표면 정본화)은 모두 같은 트래커 문서에서 이미
`[x]` 로 닫혀 있고, 최근 커밋 이력(`45ba37792`·`c9cc2a923`·`89c3f3c53`)과도 부합한다.
`14-external-interaction-api.md` §R17 실측 결과도 target 의 서술("UI 정상 흐름 한정
캐비엇이 본문에 없다")과 정확히 일치했다. **미해소 선행조건 없음.**

## 후속 항목 누락 여부 (검토 관점 3)

위 WARNING/INFO 두 건 외에, target 의 spec 변경 4곳(§R17·§1.7·§8.1·§10.2)이 다른
in-progress plan 의 후속 항목을 무효화하는 사례는 찾지 못했다. 같은 §R17 절을 동시에
편집 중인 다른 worktree(`spec-draft-eia-62-waiting-payload.md`, worktree
`eia-r8-cache-scope-4ae434`)가 있으나, 그쪽은 이미 자체적으로 "§R17 재서술 시 열린 항목을
지우지 말 것"(`15_06_43` plan_coherence W9)을 자각하고 있고 대상 서술(`llmCalls` strip
정정)도 target 의 대상(잔여② 서버측 행 추가)과 절 내에서 겹치지 않는다. 이 종류의
worktree 동시편집 병합 충돌은 검토 범위 밖으로 명시돼 있어 등급을 매기지 않았다.

## 요약

target 문서는 트래커 `spec-sync-external-interaction-api-gaps.md` W6 이 명시한 절차
("서버측 체크 + planner 턴 §R17 명문화")를 정확히 따르고 있고, 인용한 사실관계(§R17 현재
문구·§1.7 scope 열거·§8.1 details 부재)는 실측으로 검증된다. 미해결 결정을 우회하거나
선행 조건이 빠진 곳은 없다. 다만 target 이 같은 근거로 "닫는다" 고 서술한 트래커 W5
항목의 체크박스가 실제로는 갱신되지 않아 산문과 트래커가 어긋나는 상태이며, 이는 이
저장소가 반복적으로 겪어 온 "체크박스와 산문 동기화" 계열의 결함과 같은 방향이다. 차단
사유는 아니지만 같은 턴에 정정하는 것이 안전하다.

## 위험도

LOW
