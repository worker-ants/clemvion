# 변경 범위(Scope) 리뷰

대상: `refactor-reaper-dry` — 18개 파일 (`plan/in-progress/refactor-reaper-dry.md` frontmatter `spec_impact: none`, `owner: developer`). 선언된 스코프(plan 본문 "채택" 섹션): (1) `Webchat`→`WebChat` naming 정렬(4 식별자 + 파생 spec/테스트), (2) `processInBatches` 공용 유틸 추출(W4, chunk-loop 중복 제거), (3) `emitCancellationEvent` private 헬퍼 추출(W3, emit try/catch 보일러플레이트 제거). "기각" 섹션에 4-into-1 config 헬퍼·추상 base class 는 명시적으로 defer.

## 발견사항

- **[WARNING]** `interaction-token.service.ts` 의 타입 단언(assertion) 제거가 선언된 스코프(naming/W4/W3) 밖
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` `verifyPerExecution` 내부, diff hunk `@@ -203,7 +204,7 @@` (`payload = verify(...) as {...}` → `payload = verify(...)`)
  - 상세: 같은 파일의 다른 모든 변경(`import processInBatches`, `findIdleWebchatExecutionIds`→`findIdleWebChatExecutionIds` naming, `reconcileTerminalRevocations` 의 chunk-loop→`processInBatches` 치환)은 plan 이 명시한 W4/naming 스코프와 정확히 일치한다. 그러나 `verifyPerExecution` 의 `verify(...) as { sub?: unknown; aud?: unknown; jti?: unknown }` 캐스트 제거는 naming 도 W3/W4 도 아니며 plan 본문 어디에도 언급이 없다. 변수 `payload` 는 이미 동일 타입으로 선언돼 있어(`let payload: { sub?: unknown; aud?: unknown; jti?: unknown };`) 실질적으로 no-op 에 가깝고 동작 변경 가능성은 낮아 보이지만(빌드 PASS 가 plan 체크리스트에 기재됨), "behavior-preserving 순수 구조 정리" 로 스코프를 명시적으로 좁힌 PR 에 스코프 밖 diff 1줄이 섞여 있다.
  - 제안: 이 캐스트 제거가 의도된 것이라면 plan 본문에 별도 항목으로 기재하거나, 의도치 않은 것이라면 되돌려 diff 를 선언된 3항목으로만 한정한다.

- **[WARNING]** `spec/` 5개 파일 수정이 plan frontmatter `spec_impact: none` 과 불일치, 또한 developer 스킬의 `spec/` read-only 경계와 접촉
  - 위치: `spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/15-external-interaction.md` — 전부 `WebchatIdleReaperService`→`WebChatIdleReaperService` 문자열 치환만(의미·요구사항 변경 없음)
  - 상세: 내용 자체는 코드 리네이밍을 미러링하는 순수 식별자 동기화라 스코프 이탈로 보기는 어렵고, plan 워크플로 항목에도 "`/consistency-check --impl-done` (spec-linked: engine §4·EIA §14/§3.4 — naming sync 검증)" 로 사실상 예견되어 있다. 다만 (a) plan frontmatter 가 `spec_impact: - none` 으로 선언한 것과 실제로 5개 spec 파일이 수정된 사실이 불일치하고, (b) `CLAUDE.md` 의 skill 표는 "개발자(developer) 쓰기 권한: `codebase/**`, `plan/**`, `review/**/RESOLUTION.md`. `spec/` read-only" 로 명시하며 plan frontmatter `owner: developer` 다. 순수 식별자 치환이라는 성격상 실질 리스크는 낮지만, 스코프·권한 경계 관점에서는 명시적 예외 처리(예: frontmatter 에 "spec 은 naming-only 미러, 의미 변경 없음" 주석)가 없는 한 규약과 어긋난다.
  - 제안: `spec_impact` frontmatter 를 실제 변경(5개 spec 파일)과 일치시키거나, spec 동기화가 developer 범위 밖이면 project-planner 위임 경로를 거쳤는지 확인.

- **[INFO]** `processInBatches` 의 `concurrency` 0/음수 floor-at-1 방어 로직은 기존 두 호출부에는 없던 신규 안전장치
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts` (`const chunkSize = Math.max(1, Math.floor(concurrency));`), 대응 테스트 `process-in-batches.spec.ts` 마지막 케이스
  - 상세: 원래 두 호출부(`webchat-idle-reaper.service.reap` 의 `REAP_CONCURRENCY=10`, `interaction-token.service.reconcileTerminalRevocations` 의 `RECONCILE_CONCURRENCY=20`)는 고정 양수 상수라 0/음수 입력 경로가 존재하지 않았다. 공용 유틸로 추출하며 일반적 오용(0/음수 concurrency → 무한루프)에 대한 방어를 추가한 것은 "기능 확장"이라기보다 유틸 추출 시 정당화되는 방어적 일반화이며, JSDoc 에도 명시돼 있어 은닉된 동작 변경은 아니다. 차단 사유는 아니나 두 실호출부 관점에서는 순수 리팩터 범위를 살짝 넘는 안전 마진임을 기록.
  - 제안: 없음(현행 유지 권장) — 참고용 기록.

## 요약

전체 18개 파일 중 15개는 plan 이 명시한 3항목(naming 정렬·`processInBatches` 추출·`emitCancellationEvent` 추출) 및 그 파생 테스트/문서 미러링에 정확히 대응하며, 새로 추가된 로직(헬퍼 두 개)도 payload·로그 문자열·에러 유무 분기를 원본과 1:1로 보존해 "behavior-preserving" 주장과 부합한다. 스코프 이탈로 볼 만한 지점은 두 곳으로 좁다 — (1) `interaction-token.service.ts` 안에 plan 이 언급하지 않은 타입 단언 제거 1줄이 섞여 있고, (2) `spec_impact: none` 선언과 실제 5개 spec 파일 수정(naming-only 미러) 사이에 frontmatter 불일치 및 developer/spec 경계 접촉이 있다. 둘 다 내용상 저위험(순수 정리·순수 문자열 동기화)이라 즉시 차단 사유는 아니지만, "이번 PR 은 딱 3항목만" 이라는 plan 의 명시적 스코프 선언과 대조하면 완전한 준수는 아니다.

## 위험도

LOW
