# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

- **[INFO]** `5-admin-console.md §R2` — 비목표 경계 명확화 근거가 `_product-overview.md` Rationale 과 중복 기술
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §R2` 및 `spec/7-channel-web-chat/_product-overview.md ## Rationale "운영 콘솔(구성요소 D)와 '외형 백엔드 미저장' 비목표의 경계"`
  - 과거 결정 출처: `spec/7-channel-web-chat/_product-overview.md §2 비목표` ("위젯 외형의 백엔드 저장·서빙형 관리 콘솔")
  - 상세: 두 곳 모두 "emit-only 빌더는 비목표 번복이 아니라 경계 명확화"라는 동일 논증을 독립적으로 서술한다. 내용이 일치하고 상충은 없으나, 향후 두 문서 중 하나만 갱신될 경우 drift 발생 가능성이 있다. 5-admin-console.md §R2 는 `_product-overview.md §2` 비목표 항목 자체를 수정 근거로 인용하고 있어, 각각이 서로를 정합 근거로 삼는 순환 구조가 생긴다.
  - 제안: `5-admin-console.md §R2` 에 `_product-overview.md ## Rationale "운영 콘솔…"` 를 단일 SoT 로 지정하는 cross-ref 한 줄을 추가하거나, 반대로 `_product-overview.md` Rationale 항을 제거하고 `5-admin-console §R2` 를 SoT 로 명시한다.

- **[INFO]** `5-admin-console.md §6.1` — `wc:boot` 재전송 갱신 동작이 `2-sdk.md §3` postMessage 프로토콜 표와 불일치 가능성
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §6.1 step 5` ("외형 폼만 바뀌면 재마운트 없이 `wc:boot` 를 재전송")
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §3` postMessage 프로토콜 표 — `wc:boot` 는 `host → iframe` 방향, "전체 boot config" 를 payload 로 정의
  - 상세: `wc:boot` 를 "최초 부팅" 용이 아니라 "외형 갱신" 목적으로 재전송하는 패턴은 2-sdk.md §3 표에 명시적으로 언급되지 않는다. 콘솔이 `wc:boot` 를 반복 전송하는 경우 위젯의 기대 동작(멱등 처리 vs 재초기화)이 spec 어디에도 정의되어 있지 않다. 이것이 기각된 대안을 재도입하는 것은 아니지만, 기존 Rationale 가 커버하지 않는 신규 사용 패턴이 문서화 없이 도입된 상태다.
  - 제안: `5-admin-console.md §6.1` 의 `wc:boot` 재전송 동작(멱등 갱신 시맨틱)을 `2-sdk.md §3` 프로토콜 표에도 명시하거나, `2-sdk.md §3` Rationale 에 "재전송 시 위젯은 appearance 를 merge/replace 처리"를 추가한다.

- **[INFO]** `copy-widget.mjs` — 동봉 빌드 실패 시 widget 비활성화 정책이 spec 과 실제 구현 간 gap
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §5 fallback` ("동봉 번들 자체가 없을 때만 스니펫/미리보기 UI 를 비활성 + 경고") 및 `codebase/frontend/scripts/copy-widget.mjs`
  - 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §4.1` — 위젯 동봉(co-deploy) 원칙, `spec/7-channel-web-chat/1-widget-app.md §R7` — v1 단일 iframe 단순성 우선
  - 상세: `copy-widget.mjs` 는 빌드 중 `widgetOut`/`loaderJs` 미존재 시 `throw` 로 즉시 실패하는 반면(스크립트 종료), spec §5 fallback 은 "존재 감지는 Phase 1 과 함께 도입한다"는 이연 주석을 달면서 "증분 1 에는 감지 없이 항상 self-origin loader URL 생성"을 정의한다. 즉 spec 은 빌드-타임 실패를 정상 케이스로 다루고 있으나 구현은 빌드-타임 throw 다. 상충은 아니나 spec 문서의 "감지 없이 항상 생성" 표현이 빌드 성공을 전제하지 않는 것처럼 읽혀 오해를 낳을 수 있다. Rationale 와 충돌은 없으나 문서 표현이 구현과 어긋난다.
  - 제안: `5-admin-console.md §5` 에 "`build:widget` 이 완료돼야 self-origin fallback URL 이 유효하다 — build 미실행 시 스크립트 자체가 실패하므로 런타임 비활성은 Phase 1 완료 후 동봉 감지 기반으로 전환한다" 를 명시해 구현과 일치시킨다.

---

## 요약

`spec/7-channel-web-chat/` 의 구현 완료 후 target 문서와 기존 Rationale 를 대조한 결과, 명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. `5-admin-console.md §R2` 와 `_product-overview.md` Rationale 는 동일 논증을 양쪽에서 독립 기술하는 중복이 있으나 내용이 일치하며, `5-admin-console.md §R6` 의 co-deploy + same-origin iframe 결정은 `0-architecture.md §R8 carve-out` 을 올바르게 인용하고 있다. `wc:boot` 재전송(외형 갱신 목적) 패턴은 `2-sdk.md §3` 프로토콜 표에 명시가 없는 신규 사용 패턴이나, 기각된 대안은 아니므로 INFO 수준이다. `copy-widget.mjs` 의 빌드-타임 throw 동작이 spec §5 fallback 표현과 미묘하게 어긋나지만 Rationale 위반은 아니다. 전반적으로 Rationale 연속성은 양호하며 신규 결정(`5-admin-console §R6`, 2026-06-23)도 Rationale 섹션에 명확히 기록되어 있다.

---

## 위험도

LOW
