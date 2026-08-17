# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법 (참고)

이번 라운드의 실질 변경은 `spec/5-system/14-external-interaction-api.md` §R17 에 "프리필 왕복" 불릿
신설(마스킹된 `formConfig.defaultValue` 가 재입력되는 왕복 오염을 프런트 마커 감지 가드로 닫는 결정) +
"닫는 조건" 갱신뿐이며, 대응 코드는 `sanitize-error-message.ts`(마커 상수 재배치+JSDoc), `dynamic-form-ui.tsx`
(`isMaskedValue`/프리필 skip/안내 hint), 회귀 테스트, 유저가이드(`run-results.mdx`/`.en.mdx`), i18n 사전이다.
직전 라운드(`11_38_00`)의 cross_spec WARNING 1건(`12-background.md` §8.2 미갱신)·나머지 리뷰어들의
`nodeName`→`nodeLabel` 지적은 이번 top commit(`8d853b56a`) 이전 커밋(`89c3f3c53`)에서 이미
`12-background.md`·`15-chat-channel.md`·`3-error-handling.md` 세 곳에 반영된 상태를 diff-base 기준으로
재확인했다(`git diff origin/main...HEAD` 전 파일 대조).

교차 검증한 대상: `spec/1-data-model.md`(§2.14 `input_data`/`output_data` egress 마스킹 서술) ·
`spec/5-system/6-websocket-protocol.md`(§4.1 값-패턴 마스킹 캐비엇·`input`/`inputData` 레벨 표) ·
`spec/5-system/13-replay-rerun.md`(§10.2 Re-run 프리필 왕복 — 자매 사례) ·
`spec/5-system/12-webhook.md`(§5.3 ingestion 마스킹) · `spec/4-nodes/6-presentation/4-form.md`
(Form 노드 `defaultValue` 필드 정의) · `spec/7-channel-web-chat/1-widget-app.md`(§2 Form 표면) 및
대응 코드 `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx`.

## 발견사항

없음 — 이번 diff 가 신설한 §R17 "프리필 왕복" 불릿·마커 상수 위치 변경·`DynamicFormUI` 가드는 교차 검토
범위 내에서 CRITICAL/WARNING 급 모순을 만들지 않는다.

## 참고 (경미 · 등급 미부여)

- **Chat Channel 위젯의 자체 Form 컴포넌트는 애초에 `defaultValue` 를 프리필하지 않는다** —
  `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx` 의 `FieldDef` 타입에는
  `defaultValue` 필드 자체가 없고 `values` state 는 항상 `{}` 로 시작한다(코드 확인). §R17 "프리필
  왕복" 불릿은 `DynamicFormUI`(에디터, 내부 WS 소비자)에만 첫 가드가 섰다고 적는데, EIA 의 원래
  시나리오(§2)상 `formConfig` 가 외부로 나가는 주 경로는 SSE/notification 을 소비하는 이 위젯
  쪽이다. 다만 위젯이 애초에 prefill 을 하지 않으므로 **왕복 오염 자체가 성립하지 않아** 이 라운드가
  닫으려는 결함 클래스와는 무관하고, spec 어디에도 위젯이 `defaultValue` 를 프리필한다는 상반된
  주장이 없어 모순은 아니다. (`1-widget-app.md` §2 는 "필드 렌더·검증 → `submit_form`" 만 서술하고
  prefill 여부는 언급하지 않는다.) 등급을 매길 만한 충돌은 아니지만, `formConfig.defaultValue`
  prefill 이 위젯에 없다는 사실 자체는 별도 기능 갭(마스킹과 무관)일 수 있어 참고로 남긴다.
- `spec/4-nodes/6-presentation/4-form.md`(Form 노드, `defaultValue` 필드의 정본 정의처)는 이번
  라운드의 egress 마스킹/프리필-스킵 정책을 언급하지 않는다. 그러나 이 문서는 노드 config 스키마
  정의 문서이지 소비 측 UI 동작 문서가 아니며, EIA §R17 이 "SoT" 로 자기 자신을 지목하고 있어
  실질적 모순·중복 정의는 없다.

## 요약

target(`spec/5-system/14-external-interaction-api.md` §R17)의 이번 라운드 추가분("프리필 왕복" 불릿 +
"닫는 조건" 갱신)은 `1-data-model.md`·`6-websocket-protocol.md`·`13-replay-rerun.md`·`12-webhook.md`·
`4-nodes/6-presentation/4-form.md`·`7-channel-web-chat/1-widget-app.md` 및 대응 코드(에디터
`dynamic-form-ui.tsx`, 위젯 `dynamic-form.tsx`)와 대조한 결과 새로운 데이터 모델/API 계약/요구사항
ID/상태 전이/RBAC/계층 책임 충돌을 만들지 않는다. 직전 라운드가 지적한 유일한 WARNING(`12-background.md`
§8.2 미갱신)과 병행 지적된 `nodeName`→`nodeLabel` 정정은 이번 top commit 이전 커밋에서 이미 반영되어
diff-base 기준 재확인상 해소된 상태다. 마커 상수(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)의 backend
SoT·frontend mirror 관계도 기존 `DEFAULT_FILE_*` 관용구와 일관되게 문서화되어 있다.

## 위험도

NONE
