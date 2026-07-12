> **복구본**: disk-write gap — journal.jsonl 반환값 복구.

This is consistent with the rest — a status update reflecting the completed i18n activation, no conflicts.

Based on this thorough investigation (including cross-checking two prior consistency-check runs at 14:34 and 15:33 that already independently verified this exact spec change, the actual git diff of all changed spec files vs `origin/main`, and the code-side fix in the latest commit `efaf6f474` which *restores* compliance with the spec's Rationale rather than violating it), I can now produce the final report.

### 발견사항

- **[INFO]** `locale` reserved→active 전환은 명시적 번복 + 신규 Rationale 패턴을 정확히 따름 (양호 사례, 재확인)
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §4·`Rationale R6`, `spec/7-channel-web-chat/1-widget-app.md` §4·`Rationale R10`, `spec/7-channel-web-chat/5-admin-console.md` §4·§6.1, `spec/7-channel-web-chat/_product-overview.md` §2, `spec/conventions/i18n-userguide.md` §적용 범위
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md` 구 R6("`locale` 은 reserved — 삭제 대신 정직화"), `plan/complete/webchat-i18n-scope.md`(옵션 (c) "코드 변경 없음" 스코프상 defer), `spec/conventions/i18n-userguide.md` 구 Rationale("왜 channel-web-chat 위젯은 dict-indirection 스코프 밖인가" — "지역화 이득은 0")
  - 상세: `git diff origin/main`로 확인한 5개 spec 파일(0-overview, 1-widget-app, 2-sdk, 4-security, 5-admin-console, _product-overview, conventions/i18n-userguide) 전부가 이 reserved→active 전환을 "결정 번복이 아니라 예약된 경로의 실행"으로 명시 프레이밍하고, 과거 이력(`webchat-i18n-scope.md` 옵션 (c), 구 R6, 구 i18n-userguide Rationale)을 정확히 인용하며, "이득 0" 전제가 EN 지원 착수로 소멸했음을 새 Rationale에 명문화했다("이제 위젯 chrome 도 ko/en parity 가 필요하다... '이득 0' 전제는 폐기됐다"). 물리적 분리 근거(별도 정적 export 번들이라 메인 dict import 불가)는 그대로 유지해 위젯 로컬 catalog로 귀결시켰다 — 기존 `conventions/conversation-thread.md §9` 선례("결정의 번복이 아니라 적용 범위 분리")를 명시적으로 계승한다고 밝힌 부분도 실제 해당 문서 내용과 일치.
  - 제안: 없음 — 이번 세션 이전(15:33) 독립 검토에서도 동일하게 LOW 위험으로 확인된 사안이며 이후 spec 변경 없음.

- **[INFO]** 최신 코드 수정(`efaf6f474`)은 Rationale 이 명문화한 "boot 1회 고정" invariant 를 위반에서 준수로 복원
  - target 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx`(spec 밖이나 Rationale 이행 확인 목적으로 대조)
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md` §3("단 `locale` 은 boot 시 1회 해석되므로... 재전송만으로는 UI 언어가 바뀌지 않는다"), `spec/7-channel-web-chat/1-widget-app.md` §4("boot 시 1회 해석해 위젯 전역에 고정... locale 변경은 재전송이 아니라 iframe 재마운트로 반영"), `spec/7-channel-web-chat/5-admin-console.md` §6.1
  - 상세: 직전 `/ai-review`가 `useMemo([config?.locale])` 가 `wc:boot` 재전송에 반응해 재마운트 없이 UI 언어를 바꾸는 CRITICAL 결함(spec 3곳이 명문화한 invariant 위반)을 발견했고, 해당 커밋이 `useState` + render-중 1회 확정(adjusting-state) 패턴으로 수정해 invariant 를 코드-스펙 정합 상태로 되돌렸다. spec 문서 자체는 변경되지 않았다.
  - 제안: 없음 — 이미 해소됨. 향후 유사 "1회 고정" 계약이 있는 필드에 대해 `useMemo`/`useEffect` 의존성 배열을 도입할 때 이 사례를 회귀 방지 참고 사례로 남길 것을 권고(선택).

### 요약
`spec/7-channel-web-chat/`(0~5, _product-overview)와 `spec/conventions/i18n-userguide.md`의 `origin/main` 대비 변경분을 전수 diff로 확인한 결과, 이번 변경(위젯 chrome EN i18n 활성화)은 과거 `## Rationale`에 기록된 "locale reserved" 결정을 뒤집지만 (1) 번복임을 명시하고, (2) `webchat-i18n-scope.md`·구 R6·구 i18n-userguide Rationale의 실제 문구를 정확히 인용하며, (3) "이득 0" 전제 소멸을 새 Rationale에 명문화하고, (4) 물리적 분리 invariant(위젯은 별도 정적 번들)는 그대로 유지해 위젯 로컬 catalog로 흡수하는 등 이 checker의 4개 관점(기각 대안 재도입/원칙 위반/무근거 번복/암묵적 가정 충돌)을 모두 통과한다. 이는 동일 스코프에 대한 직전 두 차례 독립 검토(14:34, 15:33)의 결론과도 일치하며, 그 이후 spec 파일 변경은 없었다. 최신 커밋(`efaf6f474`)은 spec 미변경 상태에서 코드측 "boot 1회 고정" invariant 위반을 수정해 오히려 정합성을 강화했다. CRITICAL/WARNING 급 Rationale 연속성 문제는 발견되지 않았다.

### 위험도
LOW
