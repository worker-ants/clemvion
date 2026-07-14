# 요구사항(Requirement) 리뷰 — F-1 review-fix + spec/CHANGELOG/plan doc-sync

대상 커밋: `3bbe3cc90`(ai-review F-1 CRITICAL/W1-W3 fix) + `54bc2ebde`(review 산출물·doc-sync) +
`e0d4ddf51`(F-3 결정 메모). 실제 코드/spec 변경분(payload 파일 1-4, 26-28)만 검증 대상으로 삼고
review/consistency 산출물(파일 5-25)은 근거 컨텍스트로만 사용했다.

## 검증 방법

이전 라운드(`review/code/2026/07/14/01_09_10/`)가 지적한 CRITICAL 1건(spec §7.5.1 overclaim) +
WARNING 3건(W1 JSDoc, W2 CHANGELOG, W3 test)이 실제로 해소됐는지 코드 실물을 직접 대조했다.

- `interaction.service.ts` class JSDoc(83~90행)의 dispatch 표가 실제 `interact()` 본문 호출부
  (`continueExecution(ctx.executionId, dto.data, expectedNodeId)` 등 4곳)와 3-인자로 정확히
  일치함을 확인.
- `hooks.service.spec.ts` 신규 assertion(819~822행)이 실제 `forwardToInteractionService`
  (`hooks.service.ts:751~767`)의 dto 리터럴에 `nodeId` 키 자체가 없음(placeholder 완전 제거)과
  대응됨을 확인 — `expect.objectContaining` 만으로는 잡지 못했을 회귀(placeholder 잔존)를 이제
  명시적으로 막는다.
- spec §7.5.1 신규 "진입점별 커버리지 표"(`WS 미적용` / `/continue 미적용`)를 `grep` 으로 실제
  `websocket.gateway.ts` 4개 handler(538/604/671/735행)와 `executions.controller.ts:175`
  호출부와 대조 — 전부 2-인자 호출(`expectedNodeId` 미전달)로, 표가 주장하는 "미적용" 과 실제
  구현이 정확히 일치. 직전 라운드의 CRITICAL(spec 이 "WS 도 지정" 이라 overclaim)이 실제로
  해소됐음을 코드 레벨에서 재확인.
- `resolveWaitingNodeExecutionId`(execution-engine.service.ts:5281~5349)의 nodeId 불일치
  분기(5342~5348행)가 JSDoc·spec·CHANGELOG 서술과 line-level 로 일치.
- `InteractDto.nodeId` Swagger 설명("waiting_for_input 상태인 NodeExecution 의 graph node id 와
  일치해야 한다")과 EIA §5.1 `STATE_MISMATCH` "다른 nodeId" 문구가 `git log -S` 로 원본 스펙 PR
  (`9ed6e6305`, 최초 EIA spec 도입)부터 이미 존재했음을 확인 — CHANGELOG/F-3 메모의 "이는 이미
  약속된 계약의 구현(버그 수정)" 주장이 사후 정당화가 아니라 사실에 근거함을 검증.
- chat-channel `form_submission`(`handleFormStep`, hooks.service.ts:534~543)이 실제
  `pendingFormModal.nodeId` 를 알면서도 `scope: 'in_process_trusted'` 때문에
  `expectedNodeId=undefined` 로 귀결(검사 미적용)됨을 코드로 확인 — plan 의 "스코프 밖(정책상
  의도)" 서술과 정확히 일치.

## 발견사항

- **[INFO]** F-3 결정 메모의 "표면 불일치" 발생일 표기가 실제 커밋 일자와 하루 어긋남
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md` F-3 절 "표면 불일치 (대기 표면
    매트릭스, **2026-07-10** 메인 PR)"; `spec/5-system/14-external-interaction-api.md §5.1`
    신규 메모 "(표면=**2026-07-10**, nodeId=2026-07-14)"
  - 상세: 대기 표면 매트릭스 가드를 실제로 구현한 커밋(`946b59cf6 fix(execution-engine): EIA/WS
    continuation 명령 ↔ 대기 노드 표면 매트릭스 가드 (§7.5.1) (#909)`)의 author date 는
    `2026-07-11 11:47:07 +0900` 이다. plan 자체는 `started: 2026-07-10` 이고 결함 최초 발견도
    2026-07-10 이 맞지만, "구현이 이 조합을 거부하지 않고 202 로 수용하던 결함을 (표면=날짜)
    강제했다" 는 이 특정 메모는 구현/배포 시점을 가리키는 문맥이라 하루 오차가 있다. 이 프로젝트가
    breaking-behavior 배포 시점을 근거로 "별도 외부 공지 불필요" 를 결정한 F-3 문서라는 점에서
    (배포 시점 정확도가 근거의 일부이므로) 완전히 무해하지는 않으나, 판단 자체("계약은 처음부터
    409 를 명시했다")를 뒤집을 정도의 실질적 영향은 없다.
  - 제안: 다음 plan/spec 갱신 시 "2026-07-10" → "2026-07-11"(PR #909 병합일)로 정정. 급하지 않음.

- **[INFO]** (positive confirmation) 이전 라운드 CRITICAL·W1~W3 가 실제 코드/스펙과 완전히
  정합함을 확인 — 별도 조치 불필요
  - 상세: 위 "검증 방법" 절의 5개 대조 결과 모두 문서(JSDoc/spec/CHANGELOG/plan)와 실제 구현이
    line-level 로 일치했다. 특히 spec §7.5.1 커버리지 표가 WS/`/continue` 를 "미적용" 으로
    정확히 강등한 것은 이전 CRITICAL(spec 이 미구현 불변식을 "보장됨" 으로 서술)을 근본적으로
    해소한다 — SoT 원칙 복구.

## 요약

이 델타는 이전 리뷰 라운드가 지적한 spec-impl SoT 위반 CRITICAL 1건과 문서/테스트 갭 WARNING
3건(JSDoc dispatch 표 누락, CHANGELOG breaking-behavior 미기록, chat-channel placeholder 제거
회귀 가드 부재)을 모두 정확하게 해소했다. 코드 실물(`interaction.service.ts`,
`execution-engine.service.ts`, `websocket.gateway.ts`, `executions.controller.ts`,
`hooks.service.ts`)과 spec(§7.5.1 진입점별 커버리지 표, EIA §5.1 STATE_MISMATCH 강제 정합
메모)·CHANGELOG·plan 문서를 대조한 결과 새로운 기능 결함이나 spec-구현 불일치는 발견되지 않았다.
F-3(202→409 breaking behavior 외부 공지 불필요 결정)도 EIA-IN-13/§5.1 이 원래 spec PR 부터
"다른 nodeId" 를 명시해왔다는 사실로 뒷받침되어 근거가 타당하다. 유일한 흠은 F-3 결정 메모의
발생일 표기가 실제 구현 커밋 일자와 하루 어긋나는 사소한 부정확성으로, 결정의 실질(계약은
처음부터 409 를 약속했다)에는 영향을 주지 않는다. WS·REST `/continue` 의 nodeId 미검사는 이
델타가 새로 만든 회귀가 아니라 명시적으로 스코프 밖(F-6)으로 문서화된 기존 상태이며, spec 표가
이를 "미적용" 으로 정확히 반영하므로 문제 삼지 않는다.

## 위험도

LOW
