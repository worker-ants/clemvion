# Cross-Spec 일관성 검토 — `eia-inputdata-marker-guard`

검토 대상: `spec/5-system/**` 변경분(`14-external-interaction-api.md` · `13-replay-rerun.md` ·
`12-webhook.md` · `6-websocket-protocol.md`) + 파급 문서(`spec/1-data-model.md` ·
`spec/3-workflow-editor/3-execution.md` · `spec/4-nodes/1-logic/12-background.md`) + 대응 코드
(`masked-markers.ts` 신설, `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`,
`executions.service.ts`, `background-runs.service.ts`, DTO 2건).

> prompt_file 의 번들에는 `origin/main...HEAD` diff 와 `4-execution-engine.md` 등 다수 파일이
> "컨텍스트 예산 초과로 생략"돼 있어, 위 워킹트리에서 `git diff origin/main...HEAD` 를 직접
> 재실행해 실제 변경분을 확인한 뒤 아래를 작성했다.

## 발견사항

- **[INFO]** `Execution.inputData`/`NodeExecution.inputData` 마스킹 메커니즘이 표면별로 두 갈래다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 마스킹 카탈로그
    ("마커 집합은 backend `sanitize-error-message.ts` 가 SoT")
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"
    (`codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` 재사용, 매칭 키
    `apiKey`/`token`/`password`/... 블랙리스트, 출력 `"****<last4>"`/`"****"`) ·
    `spec/3-workflow-editor/_product-overview.md` ED-AI-37
  - 상세: 같은 필드명(`inputData`/`outputData`/`error`)에 대해 EIA §R17 은 **값-패턴**
    마스킹(`sanitize-error-message.ts`, 마커 `***`/`[REDACTED]`/`[REDACTED_DEPTH]`,
    프런트 미러는 이 마커의 **정확 일치**만 감지)을 규정하는 반면, AI Assistant 도구
    응답 경로는 **키-블랙리스트** 마스킹(`mask-sensitive-fields.util.ts`, 마커
    `"****"`/`"****<last4>"`)을 쓴다. 이 둘은 이번 diff 이전부터 병존해 온 서로 다른
    유틸이며 이번 변경이 만든 문제는 아니다. 현재는 AI Assistant 가 Re-run 을 트리거하지
    않도록 RR-PL-07("Re-run 비트리거")이 명시적으로 막고 있어(§4.1.2), AI Assistant 표면의
    마커가 이번에 신설한 프런트 마커 가드(`isMaskedMarker`/`hasMaskedMarkerLeaf`)를
    우회해 재제출되는 실질적 라운드트립 경로는 없다. 다만 두 spec 문서 어디에도 "같은
    필드명에 두 개의 독립된 마스킹 스킴이 존재한다"는 상호 참조가 없어, 향후 AI
    Assistant 에 쓰기 권한(G2, §Rationale 에 명시된 향후 확장)이 생기면 이 갭이
    재입력-강제 가드의 사각지대가 될 수 있다.
  - 제안: 급하지 않음(당장 회귀 없음). AI Assistant §Rationale 또는 EIA §R17 카탈로그에
    "AI Assistant 도구 응답은 별도 `mask-sensitive-fields.util.ts` 스킴을 쓰며, G2(쓰기
    권한) 도입 시 이 갭을 재평가한다"는 한 줄 상호 참조를 추가하면 향후 drift 를 막을 수
    있다.

- **[INFO]** `GET /api/executions/:id` 등 내부 REST 응답의 `inputData` 콘텐츠 계약이
  스키마 변경 없이 반전됨(원문 → 마스킹) — 이미 자체 추적됨, 위반 아님
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 잔여 ② 해소 서술,
    `spec/1-data-model.md` `Execution.input_data` 행
  - 충돌 대상: `spec/5-system/2-api-convention.md` §1 "버전 | URL 경로에 포함하지 않음
    (Accept 헤더 또는 단일 버전 운영)"
  - 상세: `Execution.inputData` 의 JSON 스키마(타입)는 그대로인데 **콘텐츠 의미**가
    "항상 원문" → "자격증명 패턴이면 마스킹"으로 바뀌었다. `2-api-convention.md` 가
    명문화한 "단일 버전 운영" 정책상 이 자체가 규약 위반은 아니지만(버전 분기 없이
    현지 수정하는 것이 이 프로젝트의 정상 운영 방식), 저장소 밖에서 이 엔드포인트를
    직접 호출하는 소비자(QA/운영 자동화·감사 export 등)에게는 스키마로 감지 불가능한
    breaking 변경이다. 이 항목은 이미
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 W5("외부 소비자
    확인" 미해결)로 등재돼 있고 security 리뷰에서도 "기밀성 침해 아님"으로 INFO
    처리됐다 — 새로운 결함이 아니라 기존 추적 항목의 재확인이다.
  - 제안: 추가 조치 불요(이미 tracker 에 있음). 릴리스 노트 공지 여부만 후속 확인.

- **[INFO]** frontend 신규 유틸(`masked-markers.ts`)의 `components/` → `lib/` 승격이
  `spec/conventions/frontend-layering.md` §3 권고와 정확히 일치
  - target 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` 신설,
    `dynamic-form-ui.tsx`/`rerun-modal.tsx`/`editor-toolbar.tsx` 의 import 갱신
  - 충돌 대상: 없음(정합) — `spec/conventions/frontend-layering.md` §3 "필요한 타입·유틸을
    `src/lib/` 로 이동" 권고와 동일 패턴(`conversation-utils.ts` 선례)을 그대로 따랐다.
    구 위치(`dynamic-form-ui.tsx`)에 남은 재-export 나 stale import 도 없음(grep 확인).
  - 상세/제안: 해당 없음 — 참고용으로 기록.

## 검토 결과 요약 (충돌 없음 확인 항목)

아래는 잠재 충돌 후보로 점검했으나 실제 모순을 찾지 못한 항목이다.

- `spec/1-data-model.md`(Execution/NodeExecution `input_data` 행) · `spec/4-nodes/1-logic/12-background.md`
  (`nodeExecutions.data.inputData`) · `spec/5-system/12-webhook.md` §5.3 · `spec/5-system/13-replay-rerun.md`
  RR-PL-02/§10.2 · `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 — "카브아웃 폐지" 결론을
  인용하는 **6개 문서 전부**가 이번 diff 로 함께 갱신됐고, 옛 서술("egress 마스킹 대상이 아니다"/
  "레벨이 가른다"/`MASKED_INPUT_DATA_REASON`)의 잔존 인용은 `grep` 으로 전수 확인해 남아있지
  않다.
- `spec/2-navigation/14-execution-history.md` §3.7/§R-5 — Re-run 버튼·설계는 Re-run spec 을
  SoT 로 위임하고 있어 이번 정책 반전과 충돌하지 않는다(§R-5 는 별개 정책인 Config-echo 마스킹만
  다룬다).
  - `spec/5-system/5-expression-language.md`(`$trigger` 는 webhook transport 필드 한정,
    헤더는 ingestion 마스킹) · `spec/4-nodes/7-trigger/1-manual-trigger.md` — `inputData`
    egress 마스킹과 별개 계층(ingestion 헤더 redaction)이라 겹치지 않는다.
- `spec/7-channel-web-chat/**` · `spec/data-flow/15-external-interaction.md` — `inputData`
  마스킹 정책에 대한 서술이 없어 갱신 누락 대상이 아니다.
- `spec/5-system/13-replay-rerun.md` RR-PL-06(권한) — 마커 가드는 프런트 UX 레벨 방어이고
  서버측 권한 게이트(원본 실행 시작자 + Editor+)는 변경되지 않았다. 토글 ON 경로가 서버 원문을
  직접 읽는다는 서술도 코드(`useOriginalInput` 분기)와 일치한다.
- 요구사항 ID(`RR-PL-*`, `EIA-*`, `ED-AI-*`) 재사용·충돌 없음 — 이번 diff 는 기존 ID 의 본문만
  갱신했고 신규 ID 를 발급하지 않았다.
- i18n 키(`history.rerun.maskedInputBlocked`, `editor.runWithInputMasked`)는 en/ko 양쪽
  dict 에 함께 추가돼 있고, 각각의 소비 spec 문서(§10.4 i18n 표)에도 반영됐다.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결론을 spec 6개 파일 +
코드 다수 지점에 동시에 반영한 성숙한 PR로, 옛 서술(카브아웃·`MASKED_INPUT_DATA_REASON`·"레벨이
가른다" 축)의 잔존 인용은 grep 전수 확인 결과 남아 있지 않아 spec 내부 drift 는 발견되지 않았다.
발견한 것은 전부 **이미 알려진 사실의 부수 관찰**이다 — (1) AI Assistant 표면이 EIA 와 별개의
마스킹 스킴을 쓰는 pre-existing 이중 구조(현재는 RR-PL-07 이 라운드트립을 원천 차단해 실질
위험 없음), (2) 내부 REST 응답의 콘텐츠 계약 반전이 스키마로는 드러나지 않는다는, 팀이 이미
tracker(W5)에 등재하고 security 리뷰가 INFO 로 처리한 항목의 재확인. 두 항목 모두 즉시 조치가
필요한 모순이 아니라 문서 상호 참조 보강 수준의 관찰이다.

## 위험도

LOW
