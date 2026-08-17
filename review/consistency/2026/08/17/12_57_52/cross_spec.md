# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=`origin/main`)

## 조사 범위

`git diff origin/main...HEAD` 기준(`claude/eia-masking-round2-53afc8`, 커밋 다수, 최신
`df708f4f8`)의 code_areas 실질 변경:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `VALUE_MASK_MARKER` /
  `KEY_MASK_MARKER` / `DEPTH_MASK_MARKER` 를 파일 상단으로 재배치 + 프런트 미러 상호참조
  JSDoc 추가 (값 자체는 `'***'` / `'[REDACTED]'` / `'[REDACTED_DEPTH]'` 로 **불변**).
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `MASKED_MARKERS`
  (backend 상수의 프런트 미러) + `isMaskedMarker()` 신설. `initialValueFor` 가 마스킹 마커와
  정확 일치하는 `defaultValue` 는 프리필하지 않고 타입별 빈 값으로 대체, 안내 힌트
  (`editor.runResults.formMaskedDefaultHint`, ko/en) 노출.
- 회귀 테스트 다수(마커 3종 프리필 차단·비마커 보존·부분치환 캐너리·안내 노출 조건·제출
  payload 무오염·마커 집합 backend SoT 리터럴 대조).
- 유저가이드 `run-results.mdx`/`.en.mdx` Error 탭 설명에 마스킹 캐비엇 추가.
- (code_areas 밖, 별도 확인) `spec/5-system/14-external-interaction-api.md` §R17 "닫는 조건"
  갱신 + "프리필 왕복" 불릿 신설, frontmatter `code:` 에 두 파일 추가, `carve-out`→`카브아웃`
  표기 통일. `CHANGELOG.md`·`plan/in-progress/*` 트래커 갱신.

## 대조한 인접 영역 (직접 Read/grep 확인)

- `spec/1-data-model.md` §2.13/§2.14 — `Execution.input_data`(round-trip 카브아웃 유지) vs
  `NodeExecution.input_data`(마스킹 대상 전환)의 축 서술이 §R17 과 일치.
- `spec/5-system/6-websocket-protocol.md` §4.1 — "대상은 특정 필드가 아니라 payload 전체"
  캐비엇이 `formConfig.fields[].defaultValue` 도 emit-time 마스킹 대상에 포함시킴을 명시,
  §R17 의 "폼 경로는 카브아웃 불가(외부 노출 있음)" 판단과 정합.
- `spec/conventions/node-output.md` Principle 7 — "egress 값-마스킹이 이 금지를 backstop 한다
  (2026-08-17 명시)" 캐비엇이 `config` raw-echo 원칙과 마스킹이 상충하지 않음을 이미 문서화.
- `spec/4-nodes/6-presentation/4-form.md` — Form 노드 `FormField.defaultValue` 정의처이자
  `dynamic-form-ui.tsx` 를 자신의 `code:` frontmatter 에도 열거하는 문서. §1/§5.4 어디에도
  이번 라운드의 마스킹-프리필-스킵 정책을 언급하지 않는다 (아래 참고 항목).
- `spec/5-system/13-replay-rerun.md` §10.2 — 이번 diff 대상 아님. Re-run 모달의
  `Execution.inputData` 프리필은 여전히 마커 가드 미적용 상태로 열려 있다고 서술 — §R17 의
  "닫는 조건" 이 "Re-run 모달·에디터 히스토리 로드로 확장하면 이 컬럼도 닫힌다" 고 **아직
  미완**으로 적은 것과 정합(과장 없음).
- `spec/5-system/12-webhook.md` §5.3 — ingestion-time 헤더 마스킹은 §R17 의 egress-time 값
  마스킹과 레이어가 다르며, §R17 "언제 가리는가" 절이 두 층의 공존을 명시적으로 반박·재확인.
- `spec/7-channel-web-chat/1-widget-app.md` + `codebase/channel-web-chat/src/widget/components/
  dynamic-form.tsx` — 위젯 자체 Form 컴포넌트의 `FieldDef` 타입엔 애초에 `defaultValue` 필드가
  없고 `values` state 가 항상 `{}` 로 시작 (직접 코드 확인). 즉 위젯 경로엔 프리필 자체가
  없어 이번 라운드가 닫으려는 "프리필 왕복" 결함 클래스가 성립하지 않는다 — spec 어디에도
  위젯이 prefill 한다는 상반 서술이 없어 모순은 아니다.
- `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` / `spec-sync-external-interaction-
  api-gaps.md` — §R17 이 인용하는 "트래커에 등재됐다" 주장을 직접 확인. 두 파일 모두 실재하고
  본 diff 의 체인(무수정 프로브 `Bearer sk-live-ABC`→`***` 실측 등)과 일치 — 근거 없는
  Rationale 주장 아님.

## 발견사항

없음 (CRITICAL/WARNING 없음). 이번 라운드가 신설한 §R17 "프리필 왕복" 불릿, 마커 상수
재배치·프런트 미러, `DynamicFormUI` 프리필 가드는 대조한 인접 spec 영역(데이터 모델·WS
프로토콜·node-output 컨벤션·Re-run·webhook·chat-channel·data-flow) 어디와도 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 만들지 않는다. `MASKED_MARKERS` 값
(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)은 backend SoT(`sanitize-error-message.ts`)와
frontend 미러(`dynamic-form-ui.tsx`)가 코드 레벨에서 정확히 일치함을 직접 확인했다.

## 참고 (경미 · 등급 미부여 — 직전 라운드 `12_34_24` cross_spec 재확인)

- **`spec/4-nodes/6-presentation/4-form.md` 의 침묵**: 이 문서는 `defaultValue` 필드의 정본
  정의처이고 `dynamic-form-ui.tsx` 를 자신의 `code:` 로도 열거하지만, 이번 마스킹/프리필-스킵
  정책을 본문 어디에도 반영하지 않는다. 다만 이 문서는 노드 config **스키마 정의** 문서이지
  소비 측 UI 런타임 동작 문서가 아니고, EIA §R17 이 스스로를 SoT 로 명시하므로 실질적
  모순·중복 정의는 아니다. Form 노드 spec 의 "관련 문서" 목록에 EIA 로의 역참조가 없다는 점은
  발견 가능성(discoverability) 개선 여지이며, 이미 별도 트래커
  (`spec-sync-external-interaction-api-gaps.md` "프리필 가드 후속 3건" INFO-6, 유저가이드
  `02-nodes/presentation.mdx` 캐비엇)로 2라운드 연속 비차단 등재돼 있다 — 새로 등재할 필요
  없음.
- **위젯 자체 Form 컴포넌트의 별개 prefill 부재**는 이번 결함 클래스와 무관한 별도 기능
  영역이며, spec 과 상충하지 않는다.

## 요약

이번 라운드(최신 커밋 `df708f4f8` 포함)의 code_areas 변경은 `spec/5-system/
14-external-interaction-api.md` §R17 이 이미 상세히 문서화한 "폼 `defaultValue` 프리필
왕복 오염" 결함을 프런트 마커 가드로 닫는 작업이며, 데이터 모델(`1-data-model.md`)·WS
프로토콜(`6-websocket-protocol.md`)·node-output 컨벤션·Re-run·webhook·chat-channel(spec +
코드) 등 인접 영역과 대조한 결과 새로운 충돌을 만들지 않는다. 직전 동일 세션의 독립
cross_spec 라운드(`12_34_24`, 위험도 NONE)가 도달한 결론을 본 라운드가 이후 커밋
(`df708f4f8`: 오탈자 정정·트래커/CHANGELOG 갱신·vacuous 테스트 보강, 코드 áreas 실질 변경
없음)까지 포함해 독립적으로 재확인했으며 결론이 일치한다.

## 위험도

NONE
