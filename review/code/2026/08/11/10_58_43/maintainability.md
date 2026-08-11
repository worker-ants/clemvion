# 유지보수성(Maintainability) 코드 리뷰 — `10_58_43`

이번 라운드는 직전(`10_41_08`) RESOLUTION 이 반영한 maintainability WARNING 3건(W3 provenance 복원·W4 `@internal` 배치·W5 "줄였다" 프레이밍 정정)이 실제 소스에 그대로 있는지, 그리고 이번 delta 로 새로 늘어난 주석(seam export 2건의 JSDoc)이 값을 하는지를 최우선으로 확인했다. 프롬프트의 diff 는 크기 제한으로 요약돼 있어 대상 파일(`codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts`, `use-token-refresh.ts`, `eia-client.ts`, `session-store.ts`)을 직접 `Read`/`Grep` 으로 열어 대조했다.

## 확인 결과 요약

**(a) provenance 복원 — 앵커에 실제로 있음, 확인됨.**
`use-widget.ts` 의 `seedWaitingFromStatus` JSDoc `@returns` 블록(639~643번째 줄)에 "security·side_effect·requirement·testing **4명** 독립 수렴" 문구가 복원돼 있고, 바로 다음 문장 "이 문단이 그 근거의 단일 소재지다 — 호출부 주석들은 여기를 가리킨다" 로 단일 소재지 선언도 있다. 두 호출부(`start()` 872-873번째 줄, `applyConfig` 복원 경로 1240번째 줄)는 실제로 이 앵커를 가리키는 포인터만 남기고 본문을 복제하지 않는다 — `applyConfig` 쪽은 "`start()` 와 같은 이유"로 한 단계 더 간접 참조하지만 체인을 따라가면 같은 앵커에 도달해, 포인터 패턴이 요구하는 "앵커가 실제로 그 내용을 담는다" 조건을 만족한다.

**(b) 새로 늘어난 주석 2건 — 값을 함, 저장소 선례와 일치.**
`shouldAbortAfterSeed`(113-144번째 줄)와 `sseErrorDetail`(197-218번째 줄) 모두 `@internal — unit-test seam only` 가 별도 블록이 아니라 함수 JSDoc 안에 병합돼 있다. 이는 이미 `eia-client.ts` 의 `unwrapEnvelope`(25-38번째 줄, `@internal — unit-test seam only. Do not use in application code.`)가 세운 선례와 정확히 같은 형태이고, 저장소 전체에서 `@internal` 태그 3곳(`safe-html.ts` 포함) 모두 이 형태로 일관된다. 두 JSDoc 은 장식이 아니라 (i) 왜 export 됐는지(unit-test seam), (ii) 어떤 뮤턴트가 이 함수 없이는 생존했는지(실측 라운드 인용), (iii) 뮤테이션이 못 잡는 축이 무엇인지를 각각 설명해 다음 편집자가 "왜 이 작은 함수가 module-level export 인가"를 재추적하지 않게 한다.

## 발견사항

- **[WARNING]** 같은 사실(`16_09_40` CRITICAL 의 리뷰어 수렴)에 대한 **다른 자리의 인용이 이번 라운드에 갱신되지 않아 여전히 부정확**하다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:105` (`installControllableEventSource` 의 `getUrl` 필드 JSDoc)
  - 상세: 이번 라운드가 고친 앵커(`use-widget.ts:642`)는 "security·side_effect·requirement·testing **4명** 독립 수렴"이라고 정확히 적는다(SUMMARY.md/RESOLUTION.md `16_09_40` 원문과 일치). 그런데 같은 사건(`ai-review 16_09_40`)을 인용하는 `use-widget-eager-start.test.ts:105` 는 `"security·side_effect 가 독립 수렴"`이라고만 적어, 실제로 그 CRITICAL 을 발견한 4명 중 2명(requirement·testing)이 누락돼 있다. `git blame` 상 이 줄은 `16_09_40` 라운드 자체의 fix 커밋(`4eb1be3796`)에서 생겼고, 이후 `10_41_08` 라운드가 앵커 쪽의 동일 사실만 "4명"으로 정정하면서 이 테스트 파일 사본은 그대로 남았다 — 정확히 "포인터/축약이 사실을 잃는다"는 이번 세션이 반복해 겪은 형태가 앵커 밖에서 한 곳 더 있었던 셈이다. 참고로 같은 파일 718번째 줄의 또 다른 "독립 수렴" 인용(`18_51_07`, "security·side_effect **두** 리뷰어")은 실제로 2명 사건이라 정확하다 — 혼동 대상이 아니다.
  - 제안: `use-widget-eager-start.test.ts:105` 를 "security·side_effect·requirement·testing 4명 독립 수렴"으로 정정하거나, 앵커(`use-widget.ts` 의 `@returns` 문단)를 가리키는 포인터로 축약한다. 기능에 영향은 없으므로 이번 라운드에서 코드를 직접 고치기보다 plan 항목으로 등재해 다음 편집 시 함께 처리하는 것을 권한다.

- **[INFO]** 주석 비율이 이번 delta 로 또 소폭 상승했다(719/1358줄 52.9% → 734/1373줄 53.5%, 단순 라인 카운트 기준).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 전체
  - 상세: `10_41_08` RESOLUTION 의 W5 는 "주석 밀도 정리"라는 이전 프레이밍이 실제로는 순증이었음을 인정하고 "중복 제거는 했고 총량은 안 줄었다"로 재서술했는데, 이번 delta(두 seam export 의 `@internal` 병합 JSDoc)도 같은 방향(순증)이다. 다만 이번 증가분은 새 기능/새 export 에 대한 신규 문서화이지 기존 설명의 재복제가 아니어서, 앞선 두 라운드가 지적했던 "네 곳에 전문 복제" 형태의 중복은 아니다. 이 파일의 comment ratio 자체가 3라운드 연속(`16_09_40`→`10_24_54`→`10_41_08`) maintainability 지적 대상이었고 매번 "근거 있어 유지"로 판정됐다는 이력을 고려하면 이번 소폭 증가를 새로 막을 근거는 약하지만, 추세 자체가 계속 우상향이라는 사실은 기록해 둘 가치가 있다.
  - 제안: 코드 수정 불필요. 이미 진행 중인 `plan/in-progress/webchat-usewidget-extraction.md`(God hook 분리) 완료 시점에 comment ratio 가 자연히 흩어지므로 별도 항목 신설보다 그 plan 완료 조건에 "분리 후 파일별 밀도 재측정"을 덧붙이는 정도로 충분하다.

## 요약

이번 라운드가 반영했다고 주장한 WARNING 3건(provenance 복원·`@internal` 배치·"줄였다" 프레이밍 정정) 중 (a) provenance 복원과 (b) `@internal` 배치는 실제 소스를 열어 직접 대조한 결과 모두 사실이며, 새로 추가된 두 seam export JSDoc 도 이 저장소가 이미 세운 선례(`unwrapEnvelope`)와 형태·목적이 일치해 장식이 아닌 값 있는 문서화다. 다만 같은 `16_09_40` 사건을 인용하는 두 번째 자리(`use-widget-eager-start.test.ts:105`)가 이번 정정에서 빠져 여전히 리뷰어 4명 중 2명만 인용하고 있어, 이번 세션이 반복해 겪어 온 "포인터/축약이 사실을 잃는다" 패턴이 앵커 밖에서 한 곳 더 남아 있다. 기능적 영향이 없는 문서 정확도 문제이므로 CRITICAL 로 판정하지 않았고, 코드 수정 없이 plan 등재로 처분하는 것을 권한다. 주석 비율의 완만한 우상향 추세도 기록 목적의 INFO 로만 남긴다.

## 위험도

LOW
