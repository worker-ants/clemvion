# 요구사항(Requirement) 리뷰 — webchat carousel truncation banner

## 발견사항

- **[INFO]** `totalCount` 유효성 검사가 스펙 문구 "유한한 비음수 **정수**만 채택" 보다 느슨함 (정수 검증 누락)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toCarousel()` (신규, L688-692) 및 대칭 코드인 기존 `toTable()` (L958-962)
  - 상세: `spec/7-channel-web-chat/1-widget-app.md` §R8 (본 diff 로 신규 추가된 문장) 은 "`totalCount` 는 유한한 비음수 **정수**만 채택한다(신뢰 못 할 total 로 "총 NaN개…" 가 새지 않도록)" 라고 명시한다. 그러나 실제 가드는 `typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0` 로, `Number.isInteger` 검증이 없다. 예컨대 `itemsTotalCount: 12.5` 가 오면 스펙상 "정수 아님→undefined" 여야 하지만 코드는 그대로 통과시켜 배너에 "총 12.5개 중 일부만 표시돼요." 가 노출될 수 있다. 실제로는 백엔드가 항상 정수 element count 를 보내므로 (`itemsTotalCount` = 잘리기 전 element 개수, §10.4) 실용적 발생 가능성은 낮고, `toCarousel` 은 기존 `toTable` 과 의도적으로 대칭 구현된 것이므로 이 diff 가 새로 만든 결함이 아니라 기존 패턴을 그대로 복제한 것이다. NaN/Infinity/음수/문자열 케이스는 테스트로 정확히 커버됐고(정수 아닌 유한수 케이스는 테스트에 없음), 코드 의도와 스펙 문구 사이의 사소한 어긋남으로 판단해 severity 는 INFO 로 낮춘다.
  - 제안: (a) 코드에 `Number.isInteger(rawTotal)` 조건 추가(정수 아니면 undefined) 하거나, (b) 스펙 §R8 문구에서 "정수" 대신 "유한한 비음수 수"로 완화. 어느 쪽이든 `toTable`/`toCarousel` 양쪽에 동일하게 적용해 대칭을 유지할 것. 코드 수정 시 `project-planner` 개입 불요(구현 세부), 스펙 문구 수정 시엔 `project-planner` 경유.

## 요구사항 충족 검증 요약

- **기능 완전성**: `plan/in-progress/webchat-widget-presentation-followups.md` 의 두 미구현 항목("총 개수 노출", "카루셀 잘림 배너 미구현")이 이번 diff 로 완전히 구현됨 — `CarouselData.truncated`/`totalCount` 필드 추가, `toCarousel` 이 `output.itemsTruncated`/`itemsTotalCount` 를 투영, `CarouselView` 가 배너를 렌더. `table` 과 완전히 대칭(문구·필드명·검증 규칙 동일 패턴).
- **엣지 케이스**: `presentation.test.ts` 신규 테스트가 NaN/음수(-1)/Infinity/이형(문자열 "5") 을 모두 `totalCount=undefined` 로 강제하는 것을 검증. `presentations.test.tsx` 는 총 개수 있음/없음/비잘림(배너 없음) 3가지 렌더 시나리오를 커버. `items.length===0` 인 경우는 `CarouselView` 가 조기에 `null` 반환(기존 동작 유지, 신규 회귀 없음).
- **TODO/FIXME**: 변경 파일 전체에서 TODO/FIXME/HACK/XXX 미발견.
- **의도와 구현 간 괴리**: 없음. 주석("잘리기 전 총 아이템 개수 — truncationMeta 가 이미 흡수한 output.itemsTotalCount(§10.4)... toTable 과 대칭")과 실제 구현이 정확히 일치.
- **에러 시나리오**: 백엔드가 `itemsTruncated`/`itemsTotalCount` 를 안 보내는 경우(`undefined`) → `truncated=false`/`totalCount=undefined` 로 안전 폴백. 신뢰 못 할 total(NaN/Infinity/음수/이형) → `undefined` 로 강등되어 "총 NaN개…" 같은 유출 없음(테스트로 커버).
- **데이터 유효성**: `typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0` 가드 — 위 INFO 항목의 "정수" 세부만 스펙 문구보다 느슨.
- **비즈니스 로직**: `truncated=true` + 총 개수 있음 → `carousel.truncatedWithCount`("총 {{count}}개 중 일부만 표시돼요."), 총 개수 없음 → `carousel.truncated`("일부만 표시돼요.") 폴백. `truncated=false` → 배너 미노출. 모두 spec §R8/§4 문구와 정확히 일치.
- **반환값**: `toCarousel` 은 모든 경로에서 `CarouselData` 전체 필드(`truncated`, `totalCount` 포함)를 반환. 누락 경로 없음.
- **spec fidelity (line-level)**:
  - `spec/4-nodes/6-presentation/0-common.md` §10.4(L100, L312) 의 필드명 `output.itemsTotalCount`/`itemsTruncated` — 코드의 `output.itemsTotalCount`/`output.itemsTruncated` 와 정확히 일치.
  - `spec/4-nodes/3-ai/1-ai-agent.md` §7.10(L966-971) 의 `PresentationPayload.truncation.{itemsTruncated, itemsTotalCount, rowsTruncated, rowsTotalCount}` — 코드의 `TRUNCATION_KEYS` 상수와 4개 키 완전히 일치.
  - `spec/7-channel-web-chat/1-widget-app.md` §2/§4/R8 이 이번 diff 로 함께 갱신되어 "table·carousel 대칭 잘림 배너" 계약을 명문화 — 코드 구현이 그 문구(문안 포함: "총 N개 중 일부만 표시돼요."/"일부만 표시돼요.")와 정확히 일치. i18n catalog 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`)도 §4 표의 신규 서술과 일치.
  - `plan/in-progress/webchat-widget-presentation-followups.md` 체크박스가 실제 구현 완료 후 `[x]` 로 갱신됨(선체크 아님) — 규약 준수.
  - catalog.test.ts 의 ko/en parity 가드는 `Object.keys` 기반 제네릭 비교라 신규 키 추가만으로 자동 커버됨(별도 테스트 수정 불요) — 검증 결과 `pnpm vitest run` 3개 대상 파일 86 tests 전부 pass, `tsc --noEmit` 클린.

## 요약

이번 diff 는 `plan/in-progress/webchat-widget-presentation-followups.md` 에 명시된 두 미구현 항목(카루셀 잘림 배너 신설 + 총 개수 노출)을 기존 `toTable`/`TableView` 패턴과 완전히 대칭되게 구현했다. `CarouselData.truncated`/`totalCount` 필드, `toCarousel` 의 finite-guard 투영 로직, `CarouselView` 의 조건부 배너 렌더, ko/en i18n 카탈로그 신규 키, 그리고 대응하는 변환/렌더 테스트(NaN/Infinity/음수/이형 등 엣지 케이스 포함)가 모두 갖춰져 있으며, 관련 spec 문서(`spec/4-nodes/6-presentation/0-common.md` §10.4, `spec/4-nodes/3-ai/1-ai-agent.md` §7.10, `spec/7-channel-web-chat/1-widget-app.md` §2/§4/R8) 와 필드명·문구·검증 규칙이 line-level 로 일치한다. 유일한 발견사항은 `totalCount` 검증에서 스펙 문구의 "정수만" 표현과 달리 `Number.isInteger` 체크가 빠져 있다는 점인데, 이는 기존 `toTable` 구현과 동일한 패턴을 그대로 대칭 이식한 것이라 이번 diff 가 새로 만든 결함이 아니며 실무상 백엔드가 항상 정수 count 를 보내 트리거 가능성이 낮아 INFO 로 분류했다. 전반적으로 기능 완전성·엣지 케이스·spec 일치도가 높다.

## 위험도

LOW
