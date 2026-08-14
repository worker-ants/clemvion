### 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 체크리스트가 "(1)~(7) 전부" 완료라 선언하지만, 실측하면 item (7) 의 하위 조치 6개 중 3개가 실행되지 않았다 — 이 세션이 반복 지적해 온 "완료 선언이 사실보다 앞선다" 패턴의 살아있는 재발 사례
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:158-174`(item (7) 하위 6개 조치 목록), `plan/in-progress/spec-draft-eia-62-waiting-payload.md:281-284`(체크리스트 "spec 반영 — **7항목** `(1)`~`(7)` 전부 (커밋 `4b13ca5ae`)")
  - 상세: item (7) 은 6개 구체 조치를 나열한다 — ① WS §4.4 Rationale 제목·본문 확장, ② §R17 정정, ③ **EIA §6.2 에 §6.5 와 동형의 strip 명시 문장 + §R17 역참조 추가**, ④ **같은 턴에 "2026-08-14 depth-1→깊이무관 strip" 수정 이력 addendum 추가**, ⑤ **코드 JSDoc 의 SoT 목록에 EIA §6.2 추가**, ⑥ §R17 재서술 시 기존 열린 항목(`nodeOutput` 키 allowlist 잔여) 보존.
    - ①·②·⑥은 실제로 반영됐다: `spec/5-system/6-websocket-protocol.md:1056-1066`(Rationale 제목이 "위치·이벤트·표면 무관" 으로 확장되고 본문이 "WS fanout + EIA REST `getStatus()` 양쪽" 을 명시), `spec/5-system/14-external-interaction-api.md:1378-1391`(§R17 이 "세 출구 전부에 값 마스킹+필드 삭제 병행"으로 정정되고 `nodeOutput` 키 allowlist 잔여 문장도 그대로 보존됨).
    - **③은 미반영**: `spec/5-system/14-external-interaction-api.md` §6.2 절 전체(645~720행)에서 `llmCalls`/`strip`/`R17` 어느 것도 등장하지 않는다(`grep -n "llmCalls\|strip\|R17"` 결과 0건). 형제 §6.5 는 786행에 "단, debug 전용 `llmCalls` 필드... fanout seam 에서 제거되어 외부 수신자에는 전달되지 않는다" 라는 명시 캐빗을 갖는데, **정작 이번 보안 수정의 실제 누출 표면이던 §6.2(`waiting_for_input`)에는 그 짝이 없다.**
    - **④는 미반영**: `spec/5-system/6-websocket-protocol.md` 전체에서 `81f2c60d6`/`5df89cda6`/"2026-08-14" 커밋 참조를 가진 addendum 문장이 없다(grep 0건). Rationale §"llmCalls 외부 수신자 strip" 절(1056~1066행)에 "depth-1 구현이 실제 누출 중이었다"는 이력이 전혀 기록돼 있지 않다.
    - **⑤는 미반영**: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:8-9` 의 JSDoc `SoT:` 목록은 `spec/5-system/6-websocket-protocol.md §4.4 llmCalls[] strip 결정 (+ EIA §6.5, chat-channel CCH-MP-01)` 뿐이고 `EIA §6.2` 를 언급하지 않는다.
    - `git show --stat 4b13ca5ae`(체크리스트가 "완료"의 근거로 지목한 커밋)로 확인하면 이 커밋은 `spec/1-data-model.md` · `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` 3개 spec 파일만 건드렸고, 그 이후 어떤 커밋도 `strip-external-only-fields.ts` 를 수정하지 않았다(`git log --oneline -- codebase/backend/src/shared/utils/strip-external-only-fields.ts` 최신은 `d0b6c4136` 로 4b13ca5ae 이전). 즉 ⑤는 시점상으로도 애초에 이 커밋에 포함될 수 없었다.
    - 결과적으로 §6.2(실제로 raw `llmCalls` 가 샜던 바로 그 절)만 유일하게 "여기서도 strip 된다" 는 명시 캐빗이 빠진 채로 남아 있다 — 코드는 올바르게 방어하지만(테스트로 확인됨), spec 독자가 §6.2 만 읽으면 그 방어를 알 길이 없다. `--impl-done 15_36_59 BLOCK: NO` 판정이 이 갭을 놓친 것으로 보인다(스팟 체크 성격상 하위 6개 조치 각각을 대조하지 않았을 가능성).
  - 제안: `spec/5-system/14-external-interaction-api.md` §6.2 에 §6.5(786행)와 동형의 "단, debug 전용 `llmCalls` 필드는 strip 된다" 문장 + `#R17` 역참조를 추가하고, WS §4.4 Rationale 절(`6-websocket-protocol.md:1056` 부근)에 2026-08-14 수정 이력 addendum 한 줄을, `strip-external-only-fields.ts:9` 의 SoT 목록에 `EIA §6.2` 를 추가한 뒤 체크리스트의 "(1)~(7) 전부" 를 실제 상태로 재확인할 것. 코드 방어 자체는 정상이라 긴급하지 않지만, 같은 결함 클래스(완료 선언 vs 실제 실행)가 이 브랜치에서 이미 4회 이상 재발했다는 점에서 방치하면 다음 라운드에서 또 반복될 가능성이 높다.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 신규 SoT 파일 `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 가 여전히 없다 — 이미 알려진 이월 항목이지만 다시 확인됨
  - 위치: `spec/5-system/14-external-interaction-api.md:6-13`(`code:` 배열), `spec/5-system/6-websocket-protocol.md:5-11`(`code:` 배열)
  - 상세: 이 파일이 이제 두 spec 이 공유해서 인용하는 `llmCalls` strip 결정의 실제 구현 SoT 인데, 두 frontmatter 어디에도 정확한 경로가 없다(`external-interaction-api.md` 는 `external-interaction/**` glob 이 있지만 `shared/utils/` 는 그 밖이다). 직전 라운드(`14_30_35` architecture/testing W4)에서 "glob 커버리지로 CI 위반은 아니고, planner 턴(§R17 갱신)과 함께 처리" 로 유예됐는데, 그 planner 턴(`4b13ca5ae`)에서도 반영되지 않았다.
  - 제안: 위 WARNING 항목과 함께 처리하는 편이 효율적 — 다음 spec 편집 시 두 `code:` 배열에 이 파일 경로를 추가할 것. CI 를 막지 않으므로 급하지 않음.

- **[INFO]** 검토 범위 내 실제 애플리케이션 코드(`strip-external-only-fields.ts`/`.spec.ts`, `interaction.service.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`) 자체의 JSDoc·인라인 주석은 매우 높은 정확도를 유지하고 있다 — 확인했으나 문제 없음
  - 상세: 함수명 변경 이력(`redactAndStrip`→`stripAndRedact`), 경계 연산자 차이(`>` vs `>=`)와 그 안전 근거, 판별력 실측 표(어느 depth 가 실제로 strip 을 검증하는지), `__proto__` 방어의 정확한 메커니즘, 비용 실측치(+20.2 µs/emit) 등이 전부 현재 구현과 1:1 로 일치함을 직접 대조 확인했다. CHANGELOG.md 의 함수명 인용(`stripAndRedact`)도 현재 코드와 일치한다.
  - 제안: 없음(positive finding).

### 요약

이번 diff 의 실제 애플리케이션 코드(`strip-external-only-fields.ts`, `interaction.service.ts`, `websocket.service.ts` 및 각 spec)는 JSDoc·인라인 주석이 현재 구현과 정확히 일치하고, 여러 라운드에 걸친 리뷰로 이미 매우 정제된 상태다. 다만 이 코드 수정을 뒷받침하는 plan 문서(`spec-draft-eia-62-waiting-payload.md`)의 체크리스트가 item (7)을 "(1)~(7) 전부 완료" 로 선언한 것과 달리, 실제로는 §6.2 의 strip 명시 문장·수정 이력 addendum·코드 JSDoc SoT 목록 갱신 등 3개 하위 조치가 반영되지 않았다. 코드 자체의 보안 방어는 테스트로 실증돼 있어 기능적 위험은 없지만, 정작 이번 보안 결함이 실제로 샌 §6.2 절에는 그 방어가 문서화돼 있지 않다는 점에서 완료 선언과 실제 상태의 괴리가 이 세션에서 반복돼 온 결함 클래스의 또 다른 사례다.

### 위험도
LOW
