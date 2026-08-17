# Rationale 연속성 검토 — EIA 마스킹 라운드2 (2026-08-17)

## 검토 대상

- `git diff origin/main...HEAD -- code_areas` (실질 diff: `sanitize-error-message.ts` 상수 재배치+주석,
  `dynamic-form-ui.tsx` 의 `isMaskedMarker`/`MASKED_MARKERS` 신설 + `initialValueFor` 가드,
  회귀 테스트 8건, i18n 문자열 2개, docs(mdx) 2곳)
- 이 diff 와 짝을 이루는 spec 변경(`origin/main...HEAD -- spec/`): `spec/5-system/14-external-interaction-api.md`
  §R17 "프리필 왕복" 문단 신설(+18/-3), `spec/4-nodes/1-logic/12-background.md`·`spec/5-system/15-chat-channel.md`
  소폭 정정(별도 선행 라운드 소산으로 확인, 본 diff 와 직접 결합 아님)
- 비교 기준 Rationale: EIA §R17(`getStatus`/마스킹 카탈로그, 특히 "프리필 왕복"·"보장의 경계 — 정확 일치만
  잡는다"·"카브아웃은 라운드트립 되는 것만" 하위 문단), WS §4.4/§Rationale(`llmCalls` strip-only 선례),
  frontend `dynamic-form-ui.tsx` 기존 `DEFAULT_FILE_*` 미러 관용구

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 찾지 못했다.

- **[INFO] Rationale 과 코드가 같은 커밋에서 동반 갱신됨 — 모범 사례로 확인**
  - target 위치: `codebase/frontend/.../dynamic-form-ui.tsx` (`isMaskedMarker`), `spec/5-system/14-external-interaction-api.md` §R17 "프리필 왕복" 문단
  - 과거 결정 출처: EIA §R17 "잔여 ②"(`Execution.inputData` 카브아웃)의 "닫는 조건 — 프런트가 마스킹 마커를 감지해 재입력을 강제하는 가드가 선행되어야 한다"
  - 상세: `git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md` 로 실측한 결과, 이번 코드 diff 를 만든 커밋(`8d853b56a`)이 §R17 에 "프리필 왕복" 문단을 **같은 커밋에서 함께** 추가했다. 결정 번복이 아니라 §R17 이 이미 예고해둔 "가드의 첫 조각"을 그대로 구현한 것이며, 새 Rationale 없이 과거 결정을 뒤집는 사례(관점 3)에 해당하지 않는다.
  - 제안: 없음(현행 유지 권장). 다만 "Re-run 모달·에디터 히스토리 로드에 같은 가드를 확장" 항목은 §R17 이 이미 "트래커에 등재됨"으로 명시했으므로, 후속 라운드에서 실제 확장 시 이 문서만 갱신하면 된다.

- **[INFO] "정확 일치만 잡는다" 경계와 마커 명칭이 기존 Rationale·명명 관용구를 정확히 계승**
  - target 위치: `dynamic-form-ui.tsx` `MASKED_MARKERS`/`isMaskedMarker`
  - 과거 결정 출처: EIA §R17 "보장의 경계 — 정확 일치만 잡는다(의도)", `sanitize-error-message.ts` 내부(비export) `isMaskedMarker`/`MASKED_MARKERS`, 같은 파일의 기존 `DEFAULT_FILE_*` backend-mirror 관용구
  - 상세: 부분 치환(`scheme://***@host`) 을 의도적으로 감지 대상에서 제외하는 경계, 마커 3종의 정확한 값(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`), 함수/집합 이름까지 backend 원본과 정확히 일치한다. `git show`로 backend `sanitize-error-message.ts:128-135`를 직접 대조해 확인했다 — 지어낸 이력이 아니다.
  - 제안: 없음.

- **[INFO] 리뷰 이력 인용의 사실성 확인**
  - target 위치: commit `6e8c35b45` 커밋 메시지, 테스트 주석의 `12_06_12` 인용
  - 과거 결정 출처: `review/code/2026/08/17/12_06_12/` (실재 확인됨)
  - 상세: 코드 리뷰 세션 `12_06_12`의 WARNING(제출 이벤트가 `fireEvent.submit`이라 버튼 배선 우회·힌트 양의 단언만 존재)을 실제로 지적받아 캐너리 테스트·`click` 통일·부재 단언으로 처분한 이력이 디스크상에 실재한다. 허구의 "과거 결정"을 인용하는 패턴(과거 세션에서 반복 지적된 오탐 유형)은 아니다.
  - 제안: 없음.

## 확인한 잠재 리스크 (결론: 문제 없음)

- **channel-web-chat(외부 위젯) 폼도 같은 왕복 오염에 노출되는가** — `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx` 를 직접 열람. `defaultValue`/`value` 를 전혀 사용하지 않고 `values` state 를 빈 객체로 초기화하는 uncontrolled 입력이라 애초에 프리필 자체가 없다. 따라서 이번 diff 의 스코프(에디터 내부 `DynamicFormUI` 한정)가 실제 위험 표면을 놓친 것이 아니다.
- **`formConfig`가 실제로 emit 시점에 값-패턴 마스킹을 받는가** (프런트 가드가 실질적 효과를 갖는 전제) — EIA §R17 "execution.node.\* / 비-종결 execution.\* emit 의 자유 텍스트 값" 불릿이 `emitExecutionEvent`/`emitNodeEvent` 초크포인트에서 **필드명 불문 payload 전체**를 마스킹한다고 규정하며, `execution.waiting_for_input`(`formConfig` 포함)은 `emitExecutionEvent` 경로다. 전제가 성립하므로 프런트 가드는 실제로 발생 가능한 마커를 잡는다.

## 요약

이번 라운드는 diff 범위가 좁고(마커 상수 재배치+주석, 프런트 프리필 가드, 회귀 테스트, i18n/문서 2줄) 관련 spec 변경(EIA §R17 "프리필 왕복" 문단)이 **같은 커밋에서 동반**되었다. §R17 이 이전 라운드(2026-08-16/17 결정들)에서 이미 "닫는 조건"으로 예고해둔 정확히 그 첫 조각을 구현했고, 마커 이름·경계 판단(exact-match only)·명명 관용구(`DEFAULT_FILE_*` 선례)까지 backend SoT 및 기존 Rationale 서술과 정합한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
