# Rationale 연속성 검토 — spec/5-system/ (EIA `Execution.inputData` marker guard, 2026-08-20)

## 조사 방법

- target 은 `spec/5-system/`(impl-done, diff-base `origin/main`, HEAD 워크트리
  `eia-inputdata-marker-guard`). 이번 브랜치의 실질 결정은 **`Execution.inputData` egress 마스킹
  카브아웃 폐지**(4개 커밋: `7da315c10` docs(spec) → `37da9b593` feat(security) →
  `b0d841923`/`29d00021d` fix(review) 2라운드)다.
- `git diff origin/main..HEAD` 로 spec 변경분(`14-external-interaction-api.md` §R17 잔여②,
  `6-websocket-protocol.md` §4.1, `13-replay-rerun.md` §10.2, `12-webhook.md` §5.3,
  `1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`)를
  전수 대조했다.
- 직전 라운드(`review/consistency/2026/08/20/14_44_42/rationale_continuity.md`, 위험도 NONE)가
  같은 target 을 검토한 바 있어, 그 이후 커밋(`b0d841923`·`29d00021d`, 둘 다 코드 리뷰 fix)이
  spec 을 추가로 건드렸는지 확인하고 그 변경분만 재검증했다(`spec/5-system/13-replay-rerun.md`
  ±3줄, `14-external-interaction-api.md` ±3/±2줄).
- Rationale 이 인용하는 과거 세션 ID(`23_49_05`·`23_50_03`·`01_17_49`·`12_08_46`·`12_41_29`·
  `14_08_45`·`14_44_08`·`14_44_42`)의 실존을 `ls` 로 개별 확인했다 — 전부 존재(코드 리뷰 세션과
  consistency 세션이 섞여 있으나 정확히 구분해 인용돼 있음). 지어낸 이력 없음.

## 발견사항

- **[WARNING]** CHANGELOG.md 의 "차단 판정" 서술이 같은 PR 안에서 이미 폐기된 중간 결정에
  머물러 있다 (target 인 `spec/5-system/` 자체는 정확하나, 같은 결정을 서술하는 인접 산출물이
  최종본과 어긋난다).
  - target 위치: 엄밀히는 `spec/5-system/` 밖 — `CHANGELOG.md` L19, `## Unreleased —
    \`Execution.inputData\` 카브아웃을 닫았다` 절. (대조 기준은 in-scope 인
    `spec/5-system/14-external-interaction-api.md` §R17 잔여② "닫는 조건" 표, Re-run 모달 행 —
    "사용자가 그 키를 채우고 값에 마커가 없을 때까지 제출 차단(**두 조건의 합**)".)
  - 과거 결정 출처(=현재 CHANGELOG 가 서술 중인 결정): 커밋 `b0d841923`(리뷰 `14_08_45` C1 fix)
    시점에 CHANGELOG 가 작성됐고, 그때 채택된 판정 로직은 "값이 비었는가" 가 아니라 **"사용자가
    그 키를 건드렸는가"** 단일조건이었다.
  - 상세: 바로 다음 커밋 `29d00021d`(리뷰 `14_44_08` W2 fix)가 이 단일조건을 스스로 번복한다 —
    커밋 메시지 원문: *"직전 라운드에서 '값이 비었는가' → '사용자가 건드렸는가' 로 바꿨는데, 한
    번 건드리면 영구 등록돼 값을 다시 마커로 되돌려도 제출이 풀린다... 그래서 **둘 다**
    요구한다."* 즉 CHANGELOG 가 여전히 서술하는 "터치 단일조건"은 같은 PR 안에서 **뚫리는 것이
    실증돼 폐기된 규칙**이다. 최종 AND-조건은 `spec/5-system/14-external-interaction-api.md`
    §R17 잔여②와 `plan/in-progress/eia-inputdata-marker-guard.md` L125 에는 정확히 반영됐지만,
    `CHANGELOG.md` 는 `29d00021d` 에서 갱신되지 않아 stale 한 채로 남았다. CHANGELOG 만 읽는
    독자는 이미 CRITICAL 로 지적돼 뚫린 적 있는 판정 로직을 최종본으로 오인할 수 있다.
  - 제안: `CHANGELOG.md` L19 문단(또는 그 아래 "차단 판정은..." 문장)을 "차단 판정은 **터치
    여부와 현재 값의 마커 부재를 함께** 본다 — 단일 축은 각각 타입 캐스팅/마커 되돌리기로
    뚫린다" 로 갱신해 spec §R17 잔여②·plan L125 서술과 맞출 것.

- **[INFO]** (직전 라운드 `14_44_42` 에서 이미 지적, 이번에도 미해소·미악화 — 반복 게재) R-5
  인용 계보가 2홉을 거치며 원 출처의 스코프 caveat 이 가려진다.
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 값-패턴 마스킹 캐비엇 —
    "`execution:<id>` 구독 인가가... [EIA §R17]의 boundary masking parity 원칙과 같은 근거다."
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` R-5. EIA §R17 자신도 "R-5 의
    직접 대상은 Config 탭이라 `Execution.error` 를 이미 규정하고 있지는 않다 — 원칙을 **원용**한
    것" 이라 명시해 뒀다.
  - 상세: WS §4.1 은 이를 "EIA §R17 의" 원칙으로 재인용해, 인용의 인용이 되며 원 출처(R-5)의
    스코프 caveat 이 두 홉 뒤에서 사라진다. 결론 자체는 매 단계 타당하게 재적용되고 있어 오류는
    아니다.
  - 제안: 급하지 않음. 다음에 이 인용부를 만질 일이 있으면 "boundary masking parity
    원칙(원 출처 [실행 내역 R-5](../2-navigation/14-execution-history.md#r-5))" 처럼 한 홉 더
    명시.

- **[INFO]** `RR-PL-02`(원본 미리보기+편집 기본값) 절과 §10.2 마커 예외 캐비엇 사이 상호 링크
  부재.
  - target 위치: `spec/5-system/13-replay-rerun.md` §RR-PL-02 vs 같은 파일 §10.2 "재실행 확인
    모달" 마스킹 마커 캐비엇(2026-08-20 전환).
  - 과거 결정 출처: RR-PL-02 자신의 "원본 미리보기+편집 기본" 정책(§6 Policy IDs, 별도
    Rationale 항목 없음).
  - 상세: §10.2 새 캐비엇("마스킹 마커인 필드는 프리필하지 않고 재입력을 강제한다")은
    RR-PL-02 의 일반 기본값(원본 프리필)에 대한 스코프 좁은 예외다. 전면 번복이 아니므로 새
    Rationale 항목이 불필요하다는 판단(직전 라운드 확인)에 동의하지만, RR-PL-02 절 자체에는 이
    예외에 대한 언급이 없어 그 절만 읽는 독자는 예외 존재를 모른다.
  - 제안: RR-PL-02 말미에 "단, 값이 마스킹 마커인 경우 §10.2 참조" 1행 cross-link 추가 검토.

## 확인했지만 문제 없음으로 판정한 항목 (재확인)

- **`Execution.inputData` 카브아웃 재도입(폐지)은 실제 이력에 근거한 정당한 번복이다.** §R17
  "잔여②" 블록이 (a) 왜 한동안 카브아웃했는지(재제출 오염) (b) 왜 지금 닫는지(마커 가드 3곳
  완비, 소비처·시점 표) (c) 판단 기준 자체가 "외부 노출" 단일 축에서 "외부 노출 ∨ 예외 유지비 >
  가드 비용" 2축으로 바뀐 이유(6개 spec 파일이 예외를 SoT 로 인용해 유지비 역전)를 전부
  명시한다. 6개 미러 문서(`1-data-model.md`·`3-workflow-editor/3-execution.md`·
  `4-nodes/1-logic/12-background.md`·`12-webhook.md`·`13-replay-rerun.md`·
  `6-websocket-protocol.md`)가 모두 같은 날짜(2026-08-20)·같은 근거로 갱신돼 있고, 폐기된 옛
  축("레벨이 가른다")을 재긍정하는 잔존 문구는 없다(grep 대조 완료).
  - 인용된 세션 ID(`23_49_05`/`23_50_03`/`01_17_49`/`12_08_46`/`12_41_29`/`14_08_45`/
    `14_44_08`)를 개별 `ls` 로 실존 확인 — 지어낸 이력 아님(`feedback_rationale_
    rejected_alternatives_need_history` 기준 충족).
- **webhook Rationale "whack-a-mole" 반박이 §R17 "언제 가리는가" 절에 명시적으로 남아 있다** —
  ingestion 층(known header key)과 egress 층(자유 텍스트 값-패턴)이 "쌓인다" 는 관계로 설명되고,
  공유 관문(`toResponseExecution`/`emitExecutionEvent`/`emitNodeEvent`/`toTerminalErrorPayload`)
  수렴으로 whack-a-mole 우려에 답한다.
- **`llmCalls` strip-only 결정(WS Rationale, 2026-06 확정)은 번복되지 않았다** — §4.1 캐비엇이
  "예외는 `llmCalls` 하나" 라고 명시적으로 유지.
- **`MASKED_INPUT_DATA_REASON` 앵커는 spec·코드 양쪽에서 전수 삭제되어 dangling 참조가 없다.**
- 마지막 두 fix 커밋(`b0d841923`·`29d00021d`)은 spec 을 소폭(각 2~3줄) 갱신해 코드 판정 로직
  변화를 그때그때 반영했다 — `spec/5-system/13-replay-rerun.md`·`14-external-interaction-api.md`
  현재 텍스트는 최종 AND-조건과 일치("값이 비어 있는 동안"·"사용자가 건드렸는가" 단독 표현의
  잔존 없음, grep 확인).

## 요약

`spec/5-system/` 자체의 Rationale 연속성은 모범적이다 — §R17 "잔여②" 가 스스로 명시했던 닫는
조건(프런트 마커 가드 3곳)이 실제로 충족된 뒤에만 카브아웃을 닫았고, 과거 카브아웃의 근거(재제출
오염)를 지우지 않은 채 왜 더 이상 유효하지 않은지(가드가 오염 경로를 차단)를 표와 2축 재정의로
명시했으며, 6개 미러 문서가 전부 같은 날짜·같은 근거로 동기화됐다. 인용된 과거 세션 이력도 전부
실존이 확인됐다. 다만 같은 PR 안에서 리뷰 2라운드에 걸쳐 판정 로직이 "값 비었는가" →
"터치했는가" → "터치 AND 마커부재" 로 두 번 좁혀지는 동안, `CHANGELOG.md`(target 범위 밖이지만
동일 결정을 서술)는 중간 단계에서 갱신이 멈춰 최종본과 어긋나는 서술을 남겼다 — WARNING 하나.
나머지는 이전 라운드에서 이미 확인된 저강도 INFO 의 반복 또는 신규 저강도 INFO(cross-link 보완
제안)다.

## 위험도

LOW
