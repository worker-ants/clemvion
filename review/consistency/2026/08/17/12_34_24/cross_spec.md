# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=`origin/main`)

## 조사 범위

`git diff origin/main..HEAD` 기준 이번 브랜치(`claude/eia-masking-round2-53afc8`, 2 commits)의
실질 변경:

- `spec/5-system/14-external-interaction-api.md` — §R17 "닫는 조건" 갱신 + "프리필 왕복" 불릿
  신설 (마스킹된 `formConfig.defaultValue` 가 폼 재입력으로 되돌아오는 왕복 오염을, 프런트
  마커 감지 가드로 닫는 결정).
- `spec/4-nodes/1-logic/12-background.md` §8.2 — `nodeExecutions.data` 설명에 `outputData`/
  `inputData` 도 egress 마스킹 대상임을 반영 (코드 변경 없음 — 기존 구현 텍스트 정합화).
- `spec/5-system/15-chat-channel.md` R-CC-15 — `nodeName` → `nodeLabel` 오탈자 정정.
- 대응 코드: `sanitize-error-message.ts`(마커 상수 재배치 + JSDoc, 값 불변) · `dynamic-form-ui.tsx`
  (`MASKED_MARKERS`/`isMaskedMarker` 프런트 미러 + 프리필 skip + 안내 hint) · 회귀 테스트 6건 ·
  유저가이드(`run-results.mdx`/`.en.mdx`) · i18n 사전(en/ko).

## 대조한 인접 영역

- `spec/1-data-model.md`(§2.14 `input_data`/`output_data` egress 마스킹 서술)
- `spec/5-system/6-websocket-protocol.md`(§4.1 값-패턴 마스킹 캐비엇 · `input`/`inputData` 레벨 표)
- `spec/5-system/13-replay-rerun.md`(§10.2 Re-run 프리필 왕복 — 같은 결함 클래스의 자매 사례)
- `spec/5-system/12-webhook.md`(§5.3 ingestion 마스킹 — 다른 층)
- `spec/4-nodes/6-presentation/4-form.md`(Form 노드 `defaultValue` 필드 정본 정의 — `code:`
  frontmatter 에 `dynamic-form-ui.tsx` 포함)
- `spec/7-channel-web-chat/1-widget-app.md` §2 (Form 표면) + 대응 코드
  `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx`

## 발견사항

없음 (CRITICAL/WARNING 없음) — 이번 diff 가 신설한 §R17 "프리필 왕복" 불릿, 마커 상수 위치
변경, `DynamicFormUI` 가드, `12-background.md`/`15-chat-channel.md` 정정은 교차 검토 범위 내에서
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 만들지 않는다.

## 참고 (경미 · 등급 미부여)

- **Chat Channel 위젯 자체 Form 컴포넌트는 애초에 `defaultValue` 를 프리필하지 않는다.**
  `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx` 의 `FieldDef` 타입에는
  `defaultValue` 필드 자체가 없고 `values` state 는 항상 `{}` 로 시작한다 (직접 코드 확인,
  `useState<Record<string, unknown>>({})`, prefill 코드 경로 없음). §R17 "프리필 왕복" 불릿은
  "가드의 첫 조각이 `DynamicFormUI`(에디터, 내부 WS 소비자)에 섰다"고 적는데, EIA 원 시나리오
  (§2)상 `formConfig` 가 외부로 나가는 주 경로는 SSE/notification 을 소비하는 이 위젯 쪽이다.
  다만 위젯이 애초에 prefill 을 하지 않으므로 **왕복 오염 자체가 성립하지 않아** 이번 라운드가
  닫으려는 결함 클래스와 무관하고, spec 어디에도 위젯이 `defaultValue` 를 프리필한다는 상반된
  주장이 없어 모순은 아니다(`1-widget-app.md` §2 는 "필드 렌더·검증 → `submit_form`" 만 서술하고
  prefill 여부를 언급하지 않는다). 등급을 매길 충돌은 아니지만, 위젯에 `defaultValue` prefill
  자체가 없다는 사실은 마스킹과 무관한 별도 기능 갭일 수 있어 참고로 남긴다.
- `spec/4-nodes/6-presentation/4-form.md`(Form 노드, `defaultValue` 필드의 정본 정의처이자
  `dynamic-form-ui.tsx` 를 `code:` 로 명시한 문서)는 이번 라운드의 egress 마스킹/프리필-스킵
  정책을 언급하지 않는다. 그러나 이 문서는 노드 config **스키마 정의** 문서이지 소비 측 UI
  런타임 동작 문서가 아니며, EIA §R17 이 스스로를 SoT 로 지목하고 있어 실질적 모순·중복 정의는
  없다. Form 노드 spec 의 "관련 문서" 목록에 EIA(`14-external-interaction-api.md`)로의 역참조가
  없다는 점은 발견 가능성(discoverability) 관점의 저비용 개선 여지이나 스펙 간 충돌은 아니다.
- `spec/5-system/13-replay-rerun.md` §10.2 는 이번 diff 대상이 아니며, "위험은 프리필 왕복(OFF)
  경로 하나다"(Re-run 모달의 `Execution.inputData` 프리필은 아직 마커 가드 미적용)로 여전히
  열린 상태를 서술한다 — 이는 §R17 "닫는 조건"이 "Re-run 모달·에디터 히스토리 로드에 같은
  가드를 확장하면 이 컬럼도 닫을 수 있다"고 명시적으로 **아직 미완**으로 적은 것과 정합한다.
  `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 에도 이 확장 범위가 트래커 항목으로
  등재되어 있음을 확인했다(스펙 서술 ≠ 완료 주장이 아님 — stale claim 아님).

## 요약

target(`spec/5-system/14-external-interaction-api.md` §R17)의 이번 라운드 추가분("프리필 왕복"
불릿 + "닫는 조건" 갱신)과 동반 변경(`12-background.md` §8.2, `15-chat-channel.md` R-CC-15)을
`1-data-model.md`·`6-websocket-protocol.md`·`13-replay-rerun.md`·`12-webhook.md`·
`4-nodes/6-presentation/4-form.md`·`7-channel-web-chat/1-widget-app.md` 및 대응 코드(에디터
`dynamic-form-ui.tsx`, 위젯 `dynamic-form.tsx`)와 대조한 결과, 새로운 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 만들지 않는다. 마커 상수(`***`/`[REDACTED]`/
`[REDACTED_DEPTH]`)의 backend SoT·frontend mirror 관계는 기존 `DEFAULT_FILE_*` 관용구와
일관되게 문서화되어 있고, `Execution.inputData`(round-trip 카브아웃 유지) vs
`NodeExecution.inputData`(마스킹) 축은 `12-background.md`·`13-replay-rerun.md`·§R17 세 문서에
걸쳐 동일하게 서술된다. 직전 동일 세션의 impl-done 라운드(`12_06_15`)가 같은 결론(NONE)에
도달했으며, 본 라운드는 그 이후 커밋(`6e8c35b45`, 리뷰 WARNING 6건 처분 — 테스트/코드/문서
한정, spec 파일 미추가 변경)까지 포함해 독립적으로 재확인한 결과가 일치한다.

## 위험도

NONE
