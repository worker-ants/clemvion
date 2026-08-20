STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드)은
이미 8라운드의 code-review(`14_08_45` ~ `17_38_33`) + 다회의 consistency-check(`12_08_46` ~
`17_39_11`)를 거쳐 각 라운드의 WARNING 이 RESOLUTION.md 로 반영된 상태다. 프롬프트가 diff 를
생략한 핵심 소스 파일(`executions.service.ts`/`.spec.ts`, `background-runs.service.spec.ts`,
`rerun-modal.tsx`, `masked-markers.ts`/`.test.ts`, `spec/5-system/14-external-interaction-api.md`
§R17 등)을 `Read`/`Grep` 으로 직접 열어 최종 상태를 실측했고, 과거 라운드가 지적했던 항목이
실제로 코드에 반영돼 있는지(예: `touchedMaskedKeys`→`touchedKeys` 개명, `executions.service.spec.ts`
describe 헤딩 정정, `background-runs.service.spec.ts` 의 `inputData` 캐너리 추가, §R17 "두 사례가
정확히 그 두 갈래다" 문장 정정)를 대조 확인했다.

## 발견사항

- **[INFO]** `spec/5-system/13-replay-rerun.md` §10.2 캐비엇의 세 조건 서술 순서가 실제 판정 로직의
  평가 순서와 미묘하게 다르다 — 기능 결함은 아님
  - 위치: `spec/5-system/13-replay-rerun.md:360-363` vs `codebase/frontend/src/components/executions/rerun-modal.tsx:392-399` (`blockedByMaskedInput`)
  - 상세: spec 은 "사용자가 그 필드를 채우고 · 값에 마커가 남아 있지 않고 · 구조 필드라면 JSON
    파싱에 성공할 때까지" 로 세 조건을 **AND**(모두 충족돼야 해제)로 서술하고, 코드는
    `maskedKeys.some(k => !touched || hasMarker || (structured && typeof===string))` 로 **OR**(하나라도
    해당하면 계속 차단)로 구현한다. 논리적으로 이 둘은 정확히 드모르간 쌍대라 **동치**이므로
    버그가 아니다. 다만 spec 은 "무엇이 충족돼야 풀리는가"(해제 조건의 AND)를 말하고 코드
    주석(JSDoc 표, `rerun-modal.tsx:373-387`)은 "무엇이 없으면 뚫리는가"(차단 조건의 OR)를 표로
    설명해 프레이밍이 반대다. 실제 동작은 두 문서 모두와 일치하므로 CRITICAL/WARNING 이 아니다.
  - 제안: 조치 불요. (선택) spec 캐비엇에 "구현은 반대 방향(어느 조건이 빠지면 계속 막는가)의
    OR 술어로 짜여 있다"는 한 줄을 덧붙이면 다음에 spec 과 코드를 나란히 읽는 사람의 매칭 비용이
    준다.

## 기능 완전성 · 엣지 케이스 · 비즈니스 로직 (검증 결과)

- **세 소비처 가드 완결성**: 폼 프리필(`dynamic-form-ui.tsx`) · Re-run 모달(`rerun-modal.tsx`,
  스칼라+object/array leaf 양쪽) · 에디터 히스토리 로드(`editor-toolbar.tsx`, `hasMaskedMarkerLeaf`)
  세 곳 모두 마커 감지 시 프리필 스킵 또는 제출/실행 차단을 구현하고, 각각 대응하는 단위 테스트가
  존재한다(`masked-markers.test.ts`, `rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`).
- **깊이 상한 일치**: 프런트 `MAX_MARKER_SCAN_DEPTH = 10`(`masked-markers.ts:96`)이 backend
  `MAX_REDACT_DEPTH = 10`(`sanitize-error-message.ts:112`)과 일치하고, 두 함수 모두 "값 검사가
  깊이 검사보다 먼저"라는 순서를 지켜 상한 지점(depth 10)에 놓인 치환 마커를 놓치지 않는다 —
  객체·배열 두 분기 모두 같은 보폭(`depth+1`)으로 세는 것을 테스트가 개별 고정한다.
  backend 쪽도 depth 계산 기준(0-기준, `depth>=10` 컷)이 프런트와 동일함을 소스 대조로 확인했다.
  프런트 값이 backend 보다 작으면 fail-open 이 되는데(가드가 놓침) 지금은 같다.
  프런트 값이 backend 보다 크면 무해(과잉 재귀만)하므로 이 방향의 위험은 없다.
  결론: **엣지 케이스(경계 깊이 10/11) 처리 정확**.
  프런트 값이 backend 보다 작을 위험(향후 한쪽만 바뀌는 drift)은 이미 두 파일 JSDoc 이
  상호 참조로 명시하고 트래커에도 "마커 미러 계약 테스트" 항목으로 등재돼 있다(별건).
- **차단 판정 세 조건 (터치 · 값 재검증 · 구조 파싱)**: `rerun-modal.tsx:392-399` 의
  `blockedByMaskedInput` 이 세 조건 모두를 요구하며, 각 조건이 단독으로 빠졌을 때 뚫리는 회귀
  경로가 전용 캐너리로 고정돼 있다(`값-단독`→boolean coerce 회귀, `터치-단독`→되돌린 마커 회귀,
  `앞의 둘만`→무효 JSON 폴백 회귀). 세 캐너리 모두 코드에서 실측 확인.
- **응답 마스킹 관문 (backend)**: `ExecutionsService.toResponseExecution`/`toExecutionDto`,
  `BackgroundRunsService.getBackgroundRun` 의 `inputData` 마스킹이 모두 적용됐고, `error`/`outputData`
  자매 필드와 같은 관문·같은 `copy-on-change` 규율을 공유한다. `MASKED_INPUT_DATA_REASON` 앵커는
  코드베이스 전수 grep 0건으로 완전히 제거됨을 확인. webhook ingestion `[REDACTED]` 마커 보존
  계약도 `inputData` 표면까지 확장된 캐너리(`executions.service.spec.ts` ⑥,
  `background-runs.service.spec.ts` 해당 테스트)로 고정돼 있다.
- **spec 본문 정합**: `spec/1-data-model.md` §2.13/§2.14, `spec/5-system/13-replay-rerun.md` §10.2,
  `spec/5-system/14-external-interaction-api.md` §R17(표·"레벨이 가른다" 축 폐기·"판단 기준 2축
  재정의"), `spec/5-system/6-websocket-protocol.md`, `spec/5-system/12-webhook.md` §5.3,
  `spec/4-nodes/1-logic/12-background.md`, `spec/3-workflow-editor/3-execution.md` §2.2 7개 문서
  모두 "두 레벨 모두 마스킹 + 마커 가드로 카브아웃 해소"라는 동일 결론으로 수렴돼 있고, 이전
  consistency-check(`12_29_59`)가 지적했던 §R17 내부 자기모순("두 사례가 정확히 그 두 갈래다")도
  현재는 "두 사례는 이제 같은 갈래" 로 정정돼 있다(`14-external-interaction-api.md:1599`).
- **TODO/FIXME/HACK/XXX**: changeset 34개 파일 전수 grep 0건 — 미완성 작업 표지 없음.
- **plan 정합**: `eia-inputdata-marker-guard.md` frontmatter `spec_impact` 가 이전 라운드에
  지적된 4→7 파일 확장을 반영해 실제 spec diff 범위(7파일)와 현재 일치한다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 backend 응답 관문(3개 표면:
`ExecutionsService`/`BackgroundRunsService`) + frontend 소비처 3곳(폼 프리필·Re-run 모달·에디터
히스토리 로드) + spec 7개 문서 + i18n(ko/en parity) + 유저 가이드 MDX 4개에 걸쳐 구현했다.
직접 소스를 열어 대조한 결과, 마커 판별 유틸(`masked-markers.ts`)의 깊이 상한·검사 순서가
backend `MAX_REDACT_DEPTH`/`deepRedactCore` 와 정확히 일치하고, Re-run 모달의 3조건 AND 차단
로직이 3라운드에 걸쳐 발견된 회귀 경로(값 단독·터치 단독·무효 JSON) 전부를 캐너리로 막고 있으며,
backend 세 관문(`toResponseExecution`/`toExecutionDto`/`background-runs`)의 `inputData` 마스킹과
webhook ingestion 마커 보존 계약이 모두 테스트로 고정돼 있다. spec 7개 문서도 서로 모순 없이
"두 레벨 모두 마스킹 + 마커 가드가 카브아웃을 대체"로 수렴돼 있어 spec fidelity 위반을 찾지
못했다. 유일한 발견사항은 spec 캐비엇과 코드 JSDoc 이 같은 판정을 반대 방향(AND vs OR, 논리적
동치)으로 서술해 나란히 읽을 때 매칭 비용이 든다는 INFO 수준 사안뿐이며, 기능·엣지 케이스·
에러 시나리오·반환값 어느 축에서도 CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
