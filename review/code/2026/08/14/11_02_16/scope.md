### 발견사항

- **[INFO]** 브랜치/최상위 plan 제목("종결 payload 정리")과 실제로 랜딩된 코드 diff(`llmCalls` 외부 fanout 누출 보안 수정)가 표면적으로 불일치하지만, 이미 문서화되고 이전 라운드에서 승인된 상태 — 신규 이탈 아님
  - 위치: `plan/in-progress/eia-terminal-payload.md:12-16`(워크트리/브랜치 무관 안내) 및 `:61-114`(`--impl-prep BLOCK: YES` 로 이 plan 자체는 착수되지 못했음을 자인)
  - 상세: 브랜치명(`claude/eia-terminal-payload`)과 이 plan 문서의 제목은 "종결 이벤트 payload 일괄 정리(`error` 객체화·`durationMs`·`result.outputs`)"를 가리키지만, 실제 이번 diff 가 건드린 애플리케이션 코드는 `codebase/backend/src/modules/websocket/websocket.service.ts`/`.spec.ts` 뿐이고 이는 그 정리 작업과 무관한 별건(`waiting_for_input` 의 `turnDebug.llmCalls` 중첩 누출 보안 수정)이다. 다만 이 divergence 는 이번 라운드가 처음 만든 상태가 아니다 — 정본 plan(`eia-terminal-payload.md`)이 스스로 `--impl-prep`(`07_44_12`)에서 spec CRITICAL 로 차단됐음을 명시하고(§"🚫 구현 차단"), 그로 인해 조사 중 발견된 별도의 심각한 보안 결함을 우선 처리하기로 pivot 한 경위가 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 및 커밋 이력(`3363f6643` → `81f2c60d6` → `a9574f823` → `5df89cda6`)에 그대로 남아 있다. 동일 divergence 는 이전 코드 리뷰 라운드(`review/code/2026/08/14/10_32_27/scope.md`)에서도 이미 INFO 로 확인되어 "타당한 범위 밖 긴급 수정이 문서화됨"으로 결론났고, 이번 라운드에서 상태가 달라지지 않았다.
  - 제안: 조치 불요. 다만 `eia-terminal-payload.md` 의 원래 작업(종결 payload 정리)이 재개될 때, 이번 보안 수정이 그 작업과 무관하게 우선 처리됐다는 사실을 plan 체크리스트에 다시 한 번 짧게 남겨 두면 향후 "왜 이 브랜치에 이 코드가 있는가"를 되짚는 비용을 줄일 수 있다(이미 plan_coherence 체커가 유사 권고를 냄).

- **[INFO]** 두 번째 보안 커밋(`5df89cda6`, `__proto__` 오염 방지 + 지연 할당 + 깊이 상한)은 신규 기능이 아니라 같은 세션의 직전 코드 리뷰(`10_32_27`) 자신의 발견사항(W1/W3/W4/W9)에 대한 처방 — 범위 이탈 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:342-421`(`stripDeep` 함수 및 그 JSDoc, `Object.defineProperty` 대입·`MAX_SANITIZE_DEPTH` 재사용·지연 할당 `out: … | null = null` 패턴), `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 신규 `__proto__` 테스트(직접 diff 확인, `hostile` fixture)
  - 상세: `review/code/2026/08/14/10_32_27/RESOLUTION.md` 가 "조치 완료"로 기록한 W1(프로토타입 오염)·W3(할당 없음 주장이 구현보다 넓었던 문제)·W4(깊이 상한 부재)·W9(CHANGELOG 누락)가 정확히 이번 diff 로 반영돼 있음을 `git diff origin/main...HEAD` 로 직접 대조했다. `CLAUDE.md` §"구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"가 이 패턴(같은 기능에 대한 리뷰 발견사항의 즉시 fix)을 명시적으로 승인하므로, 이는 요청 이상의 추가 수정이나 over-engineering 이 아니라 예정된 워크플로다.
  - 제안: 조치 불요(확인용 기록).

- **[INFO]** 코드 diff(`websocket.service.ts`/`.spec.ts`) 자체는 좁게 스코프됨을 `git diff` 로 재확인 — 무관한 리팩토링·포맷팅·임포트·설정 변경 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 전체 diff(문서화 블록 1개 hunk + `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields`/`stripDeep` 1개 hunk), `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(기존 `describe`/`it` 블록 뒤에 신규 `it()` 3건만 순수 추가 — 중첩 `turnDebug` 누출 테스트, clone-on-write identity 테스트, `__proto__` 안전성 테스트)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/modules/websocket/websocket.service.spec.ts` 를 직접 열어 확인한 결과 기존 테스트의 수정·삭제는 없고 새 `it()` 블록만 추가됐다. `websocket.service.ts` 도 두 hunk 모두 `stripExternalOnlyFields`/`stripDeep`/그 JSDoc 범위에 한정되며, 새 import·설정 파일 변경·무관한 함수(예: `sanitizeInner`, `attachRoutingContext`) 수정은 없다.
  - 제안: 없음(positive finding).

- **[INFO]** 이번 changeset 은 실제 애플리케이션 코드 3파일(`CHANGELOG.md` 포함) 대비 리뷰/plan 프로세스 산출물 29개 파일을 함께 커밋한다 — 프로젝트 저장 규약을 따른 정상적 워크플로 산출물이라 스코프 이탈은 아니지만 부피가 큼을 기록
  - 위치: `review/code/2026/08/14/10_32_27/**`(11개 파일 — RESOLUTION/SUMMARY/documentation/maintainability/meta.json/performance/requirement/scope/security/side_effect/testing/`_retry_state.json`), `review/consistency/2026/08/14/07_44_12/**`·`review/consistency/2026/08/14/10_32_29/**`(각 8개 파일), `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(신규 planner draft)
  - 상세: `git diff origin/main...HEAD --stat` 기준 총 33개 변경 파일 중 실제 애플리케이션 코드는 2개(`websocket.service.ts`/`.spec.ts`)뿐이고 나머지 31개는 `CHANGELOG.md`, 2개의 `plan/in-progress/*.md`, 그리고 28개의 `review/**` 산출물(전부 신규 파일, `insert-only`)이다. `CLAUDE.md` "정보 저장 위치" 표가 `review/code/**`·`review/consistency/**` 를 정식 산출 위치로 지정하고 있고 memory 에도 "`review/` 는 gitignored 아님"이 명시돼 있어, 이 커밋 방식 자체는 프로젝트 컨벤션을 따른 것이다 — 애플리케이션 코드 스코프를 벗어난 "의도 이상의 수정"으로 볼 사안은 아니다.
  - 제안: 조치 불요. 향후 PR 리뷰 시 리뷰어가 이 부피를 "코드 변경"으로 오인하지 않도록, 산출물 파일은 항상 `review/**`/`plan/**` 경로로만 구분돼 있음을 유지할 것(이번 diff 는 이미 그렇게 되어 있음).

### 요약

핵심 애플리케이션 코드 변경(`websocket.service.ts`/`.spec.ts`)은 `git diff origin/main...HEAD` 로 직접 대조한 결과 `llmCalls` 외부 fanout 누출 보안 수정과 그에 대한 자체 리뷰 후속 하드닝(프로토타입 오염 방지·지연 할당·깊이 상한)이라는 단일 관심사에 정확히 한정돼 있다 — 무관한 리팩토링·포맷팅·임포트·설정 변경, 기존 테스트 수정/삭제가 전혀 없다. `CHANGELOG.md` 항목도 그 수정 하나만을 정확히 서술하는 순수 추가다. 유일하게 눈에 띄는 점은 (1) 브랜치/정본 plan(`eia-terminal-payload.md`)의 표제 작업("종결 payload 정리")과 실제 랜딩된 코드가 무관하다는 것과 (2) 코드 3파일 대비 리뷰/plan 프로세스 산출물 29개 파일이 함께 커밋된 부피인데, 둘 다 프로젝트 컨벤션(긴급 보안 수정 우선 처리를 plan 에 기록·`review/**` 정식 저장 경로)을 따른 정상 상태이고 이전 리뷰 라운드에서 이미 동일하게 확인된 사항이라 이번 라운드에서 새로 escalate 할 스코프 이탈은 없다.

### 위험도

LOW
