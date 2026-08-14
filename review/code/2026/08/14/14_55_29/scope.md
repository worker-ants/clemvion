### 발견사항

- **[INFO]** 보안 수정 커밋에 실질과 무관한 공백 줄(포맷팅) 변경이 하나 섞여 있다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:130` (클래스 JSDoc 끝 `*/` 과 `@Injectable()` 사이에 새로 삽입된 빈 줄)
  - 상세: 커밋 `7fa12301c`(세 출구를 `redactAndStrip` 헬퍼로 묶은 수정)의 diff 를 `git show`로 직접 확인한 결과, 이 커밋이 `InteractionService` 클래스 선언부 바로 위에 빈 줄 하나를 추가했다. 이 줄은 이번 라운드가 다루는 결함(REST 스냅샷의 `llmCalls` 누출)과 무관하다. 다만 자매 파일 `websocket.service.ts:344-346`(`export class WebsocketService` 바로 위)에도 동일하게 JSDoc 과 `@Injectable()` 사이에 빈 줄이 있어, 실제로는 코드베이스 관례에 더 맞춰진 결과라 부작용은 없다.
  - 제안: 조치 불필요(무해). 다만 향후 diff review 시 "실질 변경과 무관한 한 줄" 도 의도적으로 넣었는지 확인하는 습관은 유지할 것.

- **[INFO]** 이번 diff(브랜치 전체, `f9d31041d..HEAD`)의 실제 코드 변경은 이 워크트리/브랜치명이 가리키는 "종결(terminal) payload 정리" 작업(`plan/in-progress/eia-terminal-payload.md` 의 `error`/`durationMs`/`result.outputs`)과 무관하고, 그 문서가 다루는 필드는 이번 라운드에서도 전혀 진전되지 않았다
  - 위치: `plan/in-progress/eia-terminal-payload.md` (신규 파일, `## 범위` 절 — `error`/`durationMs`/`result.outputs`/dispatcher back-compat wrap 만 나열, `stripExternalOnlyFields`/`llmCalls` 언급 없음) ↔ 실제 변경 파일 `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/shared/utils/strip-external-only-fields.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`
  - 상세: `eia-terminal-payload.md` 는 `🚫 구현 차단 — --impl-prep BLOCK: YES` 로 명시적으로 착수가 막힌 상태이며, 실제로 작업된 것은 그 조사 과정에서 별도로 발견된 `waiting_for_input`/terminal `outputData` 의 `llmCalls` 원본 프롬프트 누출(보안 결함) 수정이다. 이는 이미 직전 두 라운드의 scope 리뷰(`review/code/2026/08/14/10_32_27/scope.md`, `11_02_16/scope.md`)에서 동일하게 지적·수용된 사안으로, "보안 결함은 지연시키지 않는 편이 타당하다"는 판단과 함께 CHANGELOG·RESOLUTION 문서에 반복적으로 근거가 남아 있다. 이번 라운드(`34e32e62f`, `7fa12301c`)도 그 연장선(REST 스냅샷·terminal 출구 대칭화)일 뿐 새로운 범위 이탈은 아니다.
  - 제안: 별도 조치 불필요 — 기존 라운드의 처분과 동일하게 "타당한 범위 밖 긴급 보안 수정이 문서화됨"으로 처리한다. 참고로만 재기록.

- **[INFO]** 이번 라운드에서 새로 리뷰 대상이 된 두 커밋(`34e32e62f`, `7fa12301c`)의 코드 diff 자체는 좁게 스코프됐다 — 확인했으나 문제 없음
  - 상세: `git diff f9d31041d..HEAD --stat --name-only`로 `review/**` 를 제외한 전체 변경 파일을 확인한 결과 `CHANGELOG.md`, `interaction.service.(spec.)ts`, `websocket.service.(spec.)ts`, `strip-external-only-fields.(spec.)ts`(신규), `plan/in-progress/*.md` 세 개뿐이다. 설정 파일(`package.json`, tsconfig, lint 설정 등)·무관한 모듈·프런트엔드 변경은 전혀 없다. `interaction.service.spec.ts`/`strip-external-only-fields.spec.ts`/`websocket.service.spec.ts` 는 각각 단일 hunk 로 기존 테스트 수정·삭제 없이 순수 추가만 있었다(hunk 헤더로 확인). `sanitize-error-message.ts` 에서 새로 import 한 `MAX_REDACT_DEPTH` 는 이미 export 돼 있던 기존 상수를 재사용한 것으로, 그 파일 자체엔 diff 가 없다. `review/**` 하위 90여개 파일은 이 저장소 컨벤션(`review/code/<date>/<time>/`, `review/consistency/<date>/<time>/`)이 지정한 리뷰 산출물 정본 저장 위치로, diff 에 포함되는 것 자체가 정상 워크플로다.
  - 제안: 없음.

### 요약

브랜치 전체 diff(`f9d31041d..HEAD`, 100 files) 중 실제 애플리케이션 코드 변경은 `interaction.service.ts`/`websocket.service.ts`와 새로 승격된 공유 유틸 `strip-external-only-fields.ts`(+대응 spec) 뿐이며, 전부 "외부로 나가는 `llmCalls` 원본 프롬프트 누출"이라는 하나의 보안 결함을 fanout·REST·terminal 세 출구에 걸쳐 닫는 데 정확히 스코프돼 있다 — 무관한 리팩토링·기능 확장·불필요한 임포트·설정 변경은 없다. 발견된 유일한 잡음은 `interaction.service.ts` 에 삽입된 실질과 무관한 빈 줄 하나(INFO, 자매 파일 관례와 일치해 무해)뿐이다. `plan/in-progress/eia-terminal-payload.md`(브랜치명이 가리키는 원래 작업)와의 표면적 불일치는 직전 두 라운드에서 이미 검토·수용된 "타당한 범위 밖 긴급 보안 수정"이며 이번 라운드도 그 연장선이라 새로운 이탈이 아니다. `review/**` 대량 파일은 리뷰 산출물 정본 저장 규약에 따른 정상 포함이다.

### 위험도
LOW
