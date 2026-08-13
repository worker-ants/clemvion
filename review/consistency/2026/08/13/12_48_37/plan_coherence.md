# Plan 정합성 검토 — spec/4-nodes/ (impl-done)

## 검토 대상 요약

실제 diff(`origin/main...HEAD`)는 `spec/4-nodes/` 스코프 안에서는 `spec/4-nodes/4-integration/4-cafe24.md`
1개 파일만 변경한다 — Cafe24 Private 앱 install endpoint 의 두 Redis 키(`cafe24:install:nonce:*`,
`cafe24:install:fail:*`) 의 normative 정의를 `## 9. Rationale` §9.8 에서 새 본문 절 `### 4.4 Private 앱
install endpoint 의 Redis 키 (normative)` 로 옮기고, §9.8 은 "왜 그렇게 설계했는지"만 남기도록 역할을
가른 SoT 재배치다. 동반해 `spec/2-navigation/4-integration.md`(포인터 갱신)·`spec/conventions/redis-keys.md`
(인벤토리 앵커 갱신)·`spec/5-system/15-chat-channel.md`(CCH-SE-02 요구사항 행에서 메커니즘 상세를 빼고
`data-flow/14 §2.2` 참조로 축약)·`codebase/.../public-webhook-quota.service.ts`(주석 2줄 "슬라이딩"→
"fixed-window" 정정)이 같은 diff 에 포함된다. 이 변경들은 커밋 메시지·`plan/in-progress/
backend-lint-gate-broken-on-main.md` 의 서술대로 `review/code/2026/08/13/12_37_46` 코드 리뷰가 짚은
"백로그 잔여 3건"(①webhook 주석 ②cafe24 §9.8 명세/Rationale 혼재 ③CCH-SE-02 이중 서술) 처리이며, 후속
커밋(`adc444c58`)은 그 처리 자체가 만든 새 미스매치(2-navigation 포인터 미갱신)를 같은 세션에서 즉시
고친 것이다.

## 발견사항

- **[WARNING]** `node-output-redesign/cafe24.md` 의 `4-cafe24.md:NNN` 라인 인용이 §4.4 삽입(+17줄)으로
  스테일해졌다 — 미해결 TODO 2건이 잘못된 라인을 가리킨다
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` — `### 4.4` 신설 (diff hunk `@@ -160,6
    +160,23 @@`, 17줄 순증). 이 삽입으로 그 아래 모든 절이 +17줄 밀렸다(예: `### 5.8` 이 옛 322→현재
    339, `## 6. 에러 코드` 가 353).
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md`
    - L213 (미해결 `[ ]` test TODO): "근거: spec `4-cafe24.md:254` (`"callUsage": 13` 4xx 케이스
      동봉)" — 실제로는 현재 271행.
    - L216 (미해결 `[ ]` spec TODO): "spec 본문 §6 표 (`4-cafe24.md:348`, ...)" — §6 헤딩은 현재
      353행이고 해당 표 행은 그보다 더 아래.
    - L167, L178 (완료 항목의 근거 인용, 체크됨): "spec §5.8 (`4-cafe24.md:322-334`)" — 현재 §5.8
      헤딩은 339행. 완료 항목이라 실행에 영향은 없지만 동일 스테일 패턴.
  - 상세: 이 문서 자체가 "6차 갱신 (2026-06-25 코드 재검증)"에서 "`파일:라인` 인용 거의 전부 stale
    라 정정함"이라고 스스로 기록할 만큼, 코드 라인 인용이 주기적으로 일괄 재검증되는 저장소 관행이
    있다. 이번 target 변경은 spec 파일 쪽 라인을 밀었고(코드가 아니라 spec 자체가 스테일 원인이 된
    첫 사례), 아직 다음 재검증 라운드가 반영되지 않았다 — 특히 L213·L216 은 아직 미완료(`[ ]`) 항목이라
    다음 개발자가 이 라인 번호로 실제 spec 내용을 찾으려 하면 17줄 어긋난 위치(같은 파일 안이라 헤더
    검색으로 쉽게 복구는 가능)에 착지한다.
  - 제안: `node-output-redesign/cafe24.md` 의 `4-cafe24.md:254`→`271`, `4-cafe24.md:348`→해당 표
    행(§6 헤딩 353 기준 재확인), `4-cafe24.md:322-334`→`339-351` 근방으로 정정 (developer 트랙,
    plan 갱신). 급하지 않음 — 이 plan 문서가 이미 주기적 라인 재검증 패턴을 갖고 있어 다음 착수 시
    자연히 정정될 가능성이 높다.

## 미해결 결정과의 충돌 / 선행 plan 미해소 — 없음

`plan/in-progress/backend-lint-gate-broken-on-main.md` 는 이번 diff 와 정확히 같은 세 항목(①②③)을
동일 세션(`12_37_46` 리뷰 → `2026-08-13` 완료)에서 체크박스 `[x]` + 완료 근거로 갱신했고, 서술이 실제
diff 내용과 정확히 일치한다. 이 plan 이 함께 신설한 미해결 `[ ]` 항목(§4.4 가 "§4 실행 로직" 아래
있어 관심사가 섞인다는 INFO)은 **의도적으로 defer** 된 것으로 명시돼 있다 — 새 최상위 절을 만들면
§5~§9 앵커가 전부 밀려 `2-navigation/4-integration.md` 4곳 + `redis-keys.md` 를 함께 갱신해야 하므로
별건으로 미룬다는 근거가 달려 있다. 이는 target 이 plan 의 "결정 필요" 항목을 일방적으로 우회한 것이
아니라, plan 자신이 세운 범위 경계를 target 이 그대로 지킨 경우다.

`cafe24-backlog-residual.md`(Cafe24 필드셋/API 정합성 백로그), `spec-draft-eia-r8-alignment.md`(EIA
r8) 등 다른 in-progress plan 은 `cafe24:install:*` 키·`§4.4`·`CCH-SE-02`·`MINUTE_WINDOW_SEC` 어느
것도 참조하지 않아 이번 target 과 겹치는 미해결 결정·선행조건이 없다 (grep 전수 확인).

## 요약

target 은 `review/code/2026/08/13/12_37_46` 코드 리뷰 백로그 3건을 처리한 문서 재배치이며, 처리
직후 발견된 자기 모순(2-navigation 포인터 미갱신)도 같은 세션에서 즉시 정정됐다. 이 처리를 추적하는
`plan/in-progress/backend-lint-gate-broken-on-main.md` 는 체크박스·근거가 diff 와 정확히 일치하고,
남겨둔 미해결 항목(§4.4 배치 재구성)은 명시적 defer 결정이라 우회가 아니다. 유일한 흠은 §4.4 삽입이
`spec/4-nodes/4-integration/4-cafe24.md` 의 이후 절을 +17줄 밀었는데, 그 파일을 라인 단위로 인용하는
별개 in-progress plan(`node-output-redesign/cafe24.md`)의 미해결 TODO 2건이 그 이동을 반영하지 못해
스테일해진 것 — 저장소가 이미 겪어온 "라인 인용 주기적 재검증" 패턴의 새 인스턴스이며 영향은 경미하다.

## 위험도

LOW
