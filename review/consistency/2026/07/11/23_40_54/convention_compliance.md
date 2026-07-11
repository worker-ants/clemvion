# 정식 규약 준수 검토 — spec/7-channel-web-chat/1-widget-app.md

검토 모드: --impl-done, diff-base=origin/main, code_areas=codebase/channel-web-chat (presentation truncation totalCount 투영)

## 발견사항

- **[WARNING]** 위젯(`channel-web-chat`) UI 문자열의 i18n-userguide.md 적용 스코프 공백 + 로케일 무관 신규 하드코딩
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 표 "presentation(...) inline" 행, `## Rationale` R8 (배너 문구 `총 N개 중 일부만 표시돼요.` 인용)
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 1("프론트엔드 컴포넌트(TSX/TS) 안의 사용자 가시 문자열은 dict 키 경유, TSX 하드코딩 금지") / Principle 6(글로서리·문체)
  - 상세: 이번 diff 는 `codebase/channel-web-chat/src/widget/components/presentations.tsx` 에 신규 하드코딩 한국어 문자열 두 개(`` `총 ${totalCount}개 중 일부만 표시돼요.` ``, `"일부 행만 표시돼요."`)를 TSX literal 로 직접 추가했고, target spec 은 이 문구를 R8 본문에 그대로 인용해 정식화한다. 그런데 i18n-userguide.md 의 Principle 1(dict 키 경유 의무)과 그 자동 가드(`hardcoded-korean-ratchet.test.ts` 등)는 frontmatter `code:` 전부가 `codebase/frontend/**` 로 스코프돼 있고, 본문 어디에도 `channel-web-chat` 이 언급되지 않는다 — 즉 이 규약이 위젯에도 적용되는지 자체가 규약 문서상 불명확하다. 동시에 위젯은 자체 SDK 계약([`2-sdk.md §4 BootConfig`](../../../../../spec/7-channel-web-chat/2-sdk.md))에서 `locale?: 'ko' | 'en'` 를 공개 API 로 선언하지만, 코드 전수 검색 결과 `locale` 값은 `use-widget.ts`/`host-bridge.ts` 를 통과할 뿐 위젯 UI 문자열 선택에는 전혀 관여하지 않는다(`codebase/channel-web-chat/src/widget/**` 어디에도 `locale` 분기 로직 없음). 이번 diff 는 이미 존재하던 하드코딩 패턴(변경 전에도 "일부 행만 표시됩니다." 가 하드코딩돼 있었음)에 신규 문자열을 더 얹은 것이라 이 diff 가 최초로 위반을 만든 것은 아니나, "locale 로 ko/en 전환 가능" 공개 계약과 "실제로는 로케일 무관 하드코딩 한국어" 구현 사이 gap 을 한 켜 더 쌓았고, 그 gap 이 이번에 target spec 본문(R8)에까지 정식으로 박제됐다.
  - 제안: 다음 중 하나로 gap 을 명시적으로 해소 — (a) `i18n-userguide.md` 에 `conversation-thread.md §9.4` 의 "스코프 예외 — 임베드형 채널 위젯" 각주와 동형으로 "본 규약은 `codebase/frontend` 한정이며 `channel-web-chat` 은 [사유]로 제외" 를 명문화, (b) `spec/7-channel-web-chat/_product-overview.md §2 비목표` 에 "위젯 UI 문자열 다국어화(EN) 는 v1 비목표 — `locale` 은 [실제 용도]만 제어" 로 명문화, 또는 (c) 위젯도 dict indirection 을 채택해 `locale` 계약을 실제로 충족. 이번 diff 자체의 되돌림은 불필요(기존 로컬 패턴을 그대로 따랐을 뿐) — 근본 원인은 규약/스펙 쪽의 스코프 선언 누락.

- **[INFO]** `status: implemented` 유지 상태에서 신규 "carousel 잘림 배너 미구현" 캐비어트 추가
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` frontmatter (`status: implemented`, `pending_plans` 없음) vs `## Rationale` R8 신규 문장 "*(현재 table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적한다.)*"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 상태 라이프사이클(`implemented` = "모든 약속 구현 완료", `partial` = `pending_plans:` 의무)
  - 상세: 이번 diff(스펙 커밋 `4e1f665fc`)가 R8 에 "carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적한다" 는 문장을 새로 추가했으나 frontmatter 는 `status: implemented` 를 유지하고 `pending_plans:` 도 없다. 다만 같은 문서 §2 헤더 행에 이미 "아바타·뒤로 버튼은 차기 phase" 같은 동형 캐비어트가 기존 `implemented` 상태에서도 통용되는 로컬 선례가 있어, 이는 이 문서의 기존 스타일과 일관되며 자동 가드(`spec-code-paths.test.ts` 등은 `code:` glob 비어있지 않음만 검증, 문장 단위 검증 없음)에도 걸리지 않는다. 따라서 hard 위반이라기보다 "약속의 최소 단위" 에 대한 규약 해석 여지로 본다.
  - 제안: 조치 불요(현행 로컬 관례와 일관). 다만 규약 자체에 "부가 기능(minor sub-feature) 캐비어트는 `implemented` 유지 허용" 기준이 명문화되면 향후 유사 판단의 재현성이 높아진다.

## 요약

target 문서(`spec/7-channel-web-chat/1-widget-app.md`)와 diff 코드(`codebase/channel-web-chat/src/lib/presentation.ts` 등) 사이의 상호 참조([공통 §10.4](../../../../../spec/4-nodes/6-presentation/0-common.md), `conversation-thread.md §2.1`, AI Agent §7.10)는 모두 실존·정확했고, 문서 구조(Overview/본문/Rationale), frontmatter 스키마(`spec-impl-evidence.md`), 신규 필드(`TableData.totalCount`) 명명은 기존 로컬 패턴과 일관돼 정식 규약 위반이라 할 CRITICAL 항목은 없었다. 다만 신규로 추가된 위젯 UI 문자열이 `i18n-userguide.md` 의 dict-경유 의무를 실질적으로 우회하면서도 그 규약이 애초에 `channel-web-chat` 을 스코프에 넣었는지 자체가 불명확하다는 구조적 공백을 이번 diff 가 드러냈다(WARNING). 문체 전환("표시됩니다"→"표시돼요")은 오히려 글로서리 해요체 규약에 부합하는 개선이다.

## 위험도
LOW
