# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** SoT 스펙(`spec/conventions/node-cancellation.md` §4)의 cascade 예시 코드·서술이 이번 라운드에서 자기 자신이 반증한 내용을 여전히 담고 있음 — 다음 구현자가 그대로 베끼면 같은 리스너 누수가 재발한다.
  - 위치: `spec/conventions/node-cancellation.md:101` (및 §4 코드 블록, 약 84-98행) — 이 파일은 이번 diff 에 포함되지 않아 게이트 번호가 없으므로 직접 `Read`/`grep` 으로 확인한 실제 줄번호를 기재함.
  - 상세: §4 는 "상하 모두 abort 시 fetch 가 즉시 throw — cleanup 의무는 fetch API 가 보장." 이라고 단언하고, 그 위 예시 코드는 리스너 해제를 `controller.signal` 의 `'abort'` 이벤트에 건다. 그런데 바로 이번 세션의 `review/code/2026/07/25/21_02_33/RESOLUTION.md` W1 이 정확히 이 패턴을 반증했다 — "성공한 요청은 controller 를 abort 하지 않아 그 이벤트가 안 터진다", "cleanup 의무는 fetch API 가 보장"하지 않고 리스너가 살아남는다. 수정된 `cafe24-api.client.ts`/`makeshop-api.client.ts` 는 이제 `finally` 블록에서 해제하는 **다른 패턴**으로 §4 예시와 갈라졌는데, §4 문서 자체는 여전히 옛(버그 있는) 패턴을 정답처럼 보여준다. `grep` 으로 확인한 바 `http-request.handler.ts` 는 지금도 §4 의 원문 그대로(§4 예시와 100% 동일한 `controller.signal` 기반 cleanup)를 쓰고 있어, 같은 리스너 누수가 실제로 살아있는 채로 남아 있다(plan 에 "선재 결함" 으로 인지·후속 예정).
  - 이미 위임된 범위와의 관계: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 가 이번 라운드에서 드러난 §6 표 drift·§2.2 오인용은 planner 에게 위임했지만, **§4 예시 코드/서술의 이 결함은 그 위임 문서에 없다** — 아직 아무도 spec 갱신 대상으로 등재하지 않았다.
  - 제안: `spec-update-node-cancellation-shutdown-classification.md` (또는 별도 항목)에 "§4 cascade 예시를 `finally` 기반 cleanup 으로 교체 + '`cleanup 의무는 fetch API 가 보장`' 서술 정정" 을 추가 위임 목록으로 얹을 것. developer 는 `spec/` 쓰기 권한이 없으므로 코드 자체를 고치기보다 이 위임 문서에 항목을 추가하는 것이 이번 PR 범위에서 할 수 있는 조치.

- **[INFO]** `spec/conventions/node-cancellation.md` §6 구현 현황 표(MakeShop/Cafe24 두 행)가 구현 완료 후에도 "미구현 (Planned)" 로 남아 stale 하지만, 이미 `RESOLUTION.md` W2 와 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임" 섹션으로 **적절히 추적·위임**되어 있음. 새 조치 불필요 — 이 프로젝트가 반복 지적받았던 "라벨/본문 불일치" 클래스를 이번엔 developer 가 스스로 잡아 위임한 좋은 사례로 확인.

- **[INFO]** `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 의 JSDoc, 그리고 `executeWithRetry` 내부의 cascade·catch 인라인 주석은 품질이 높음 — "무엇을" 이 아니라 "왜"(§4/§5.1 인용, timeout 과 cancellation 을 구분해야 하는 이유, `database-query.handler.ts` 와의 패턴 대응)를 설명하고, 실제 코드와 1:1 로 일치함을 직접 대조 확인(`err.name === 'AbortError'` 재throw 위치, `finally` 의 리스너 해제 등). 테스트 파일의 `describe` 블록 상단 주석도 §4/§2.2/§5.1 경계를 정확히 짚고 있다.

- **[INFO]** `CHANGELOG.md` 는 이 저장소에서 버그 수정·기능 추가 모두에 대해 상세한 서술형 항목을 남기는 확립된 관행인데(파일 상단에 유사 사례 다수), 이번 PR — 특히 "취소가 네트워크 장애로 오분류되어 정상 integration 을 강등시킬 수 있었다"는 실질적 정합성 버그 수정(C2) — 은 `CHANGELOG.md` 항목이 없다. 사용자 대면 변경은 아니지만 이 저장소의 관행에 비춰 짧은 "Unreleased" 항목 추가를 고려할 만함(우선순위는 낮음 — P3 plan 항목이자 내부 배선 성격이 강함).

- **[INFO]** README 갱신은 불요 — 이번 변경은 사용자 대면 설정·기능이 아니라 노드 핸들러 내부 signal 배선이라 README 스코프 밖.

## 요약

이번 커밋은 문서화 관점에서 전반적으로 우수하다 — JSDoc·인라인 주석·plan 진행 기록(`node-cancellation-residual-signal-propagation.md`)·RESOLUTION.md 모두 정확하고 spec 절 번호를 정밀 인용하며, 리뷰가 잡은 3개 결함(§4 잘못된 cleanup 이벤트, cancellation 오분류, §2.2 오인용)을 코드·주석·plan 세 곳에서 일관되게 정정했다. 유일한 실질적 갭은 SoT 인 `spec/conventions/node-cancellation.md` §4 자체가 이번 세션이 발견한 리스너 누수 버그를 여전히 정답 패턴으로 서술하고 있고, 이 특정 결함이 기존 위임 문서 목록에 빠져 있다는 점이다 — 나머지(§6 표 drift, §2.2 오인용)는 이미 잘 위임되어 있어 대조적이다. CHANGELOG 미기재는 관행상 아쉽지만 낮은 우선순위다.

## 위험도

MEDIUM — spec 의 §4 예시가 실제로 알려진 버그 패턴을 계속 정답처럼 보여주고 있어, 잔여 plan 항목(chat-channel 노드 signal 전파 등 미착수 항목)의 다음 구현자가 그대로 베끼면 동일한 리스너 누수가 재생산될 실질적 경로가 있다. Critical 은 없음.
