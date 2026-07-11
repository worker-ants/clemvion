# Plan 정합성 Check — spec/5-system/14-external-interaction-api.md (impl-done)

## 발견사항

없음.

### 확인 근거

- 본 diff(및 target spec 1-line 변경)는 `plan/in-progress/refactor-reaper-dry.md` 가 정확히 스코핑한
  작업(behavior-preserving DRY 리팩터: naming `Webchat`→`WebChat`, `common/utils/process-in-batches.ts`
  bounded-concurrency 헬퍼 추출(W4), engine `emitCancellationEvent` 헬퍼 통합(W3))과 1:1 대응한다. 이
  plan 은 이번 diff 를 낸 작업 그 자체이며, 체크리스트의 "채택" 3항목(naming/W4/W3) 이 diff 의 변경분과
  정확히 일치하고, 스코프를 벗어난 파일 변경이 없다(`git diff origin/main...HEAD --stat` 로 확인한 17개
  파일 = plan 이 나열한 범위와 일치).
- `refactor-reaper-dry.md` frontmatter `spec_impact` 는 target 을 포함한 5개 spec 파일을 명시했고, 5개
  전부 "구현 클래스/메서드명 언급의 대소문자 정합(코드 rename 미러)일 뿐, 의미·요구사항·상태전이 변경 0"
  이라고 스코프를 한정한다 — 실제 diff(`spec/5-system/14-external-interaction-api.md` EIA-RL-07 행,
  `spec/7-channel-web-chat/{1-widget-app,3-auth-session}.md`, `spec/data-flow/{0-overview,15-external-interaction}.md`)
  는 모두 `Webchat`→`WebChat` 식별자 표기만 바뀌고 규범적 내용(wire 계약 `WEBCHAT_IDLE_TIMEOUT`·큐명·env·
  판정 로직)은 무변경 — plan 의 선언과 정합.
- plan 은 `/consistency-check --impl-done` 을 다음 미체크 단계로 명시했다 — 본 검토가 바로 그 단계이므로
  "plan 이 지시하는 다음 절차"와 실제 실행이 어긋나지 않는다.
- `cancelledBy` 닫힌 3값 union(`'user'|'system'|'timeout'`)은 `emitCancellationEvent` 헬퍼 시그니처에도
  그대로 유지되어 target spec §6.5/§7.4 부근의 "닫힌 union 을 확장하지 않는다" 결정과 충돌하지 않는다(신규
  값 추가 없음).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 완료([x]) 항목 한 곳이 이번 rename 이전
  식별자(`WebchatIdleReaperService`/`markWebchatIdleTimeout`)를 여전히 인용하고 있어 표기가 stale 해졌지만,
  (a) 이미 완료 처리된 이력 기술이고 (b) target spec 본문·다른 4개 spec_impact 파일은 모두 최신 표기로
  갱신되어 있어 SoT 자체엔 영향이 없다. 순수 텍스트 표기 지연이라 INFO 수준으로도 별도 조치가 필요할 만큼
  급하지 않다고 판단해 발견사항에서 제외했다(원하면 refactor-reaper-dry.md 완료 처리 시 함께 정정 가능).
- 그 외 `plan/in-progress/**` 를 전수 grep 했을 때 `processInBatches`/`emitCancellationEvent`/
  `WebChatIdleReaperService` 계열 식별자를 참조하는 **미해결([ ])** 항목은 없었고, target spec 이 "결정
  필요" 로 열어둔 항목(예: `cancelledBy` union 확장 여부, EIA-RL-07 판정 로직)과 충돌하는 새 결정도 없다.

## 요약
검토 대상 diff 는 `plan/in-progress/refactor-reaper-dry.md` 가 스코핑한 behavior-preserving 리팩터(naming
정렬 + 2개 DRY 헬퍼 추출) 그 자체이며, target spec 1-line 변경 및 나머지 4개 spec_impact 파일 변경 모두 그
plan 이 선언한 "구현 식별자 표기 정합만, 규범적 내용 무변경" 스코프와 정확히 일치한다. 다른 in-progress
plan 의 미해결 결정과 충돌하거나 선행 조건을 우회하는 지점은 발견되지 않았다. 유일한 잔여는 이미-완료된
형제 plan(`spec-sync-external-interaction-api-gaps.md`)의 과거 완료 항목이 rename 이전 식별자를 인용하는
표기 지연으로, target 문서의 정합성이나 미해결 결정에는 영향이 없다.

## 위험도
NONE
