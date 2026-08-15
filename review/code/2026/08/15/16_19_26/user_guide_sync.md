STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# User Guide Sync Review — `finalizeStalledExhausted` 트랜잭션 원자화 (16_19_26)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용.

## 변경 파일 (전체 diff, `origin/main...HEAD`)

```
CHANGELOG.md
codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts
codebase/backend/src/modules/execution-engine/execution-engine.service.ts
plan/in-progress/eia-stalled-atomicity.md
plan/in-progress/spec-sync-external-interaction-api-gaps.md
review/code/2026/08/15/16_04_38/*.md, *.json  (직전 라운드 리뷰 산출물)
review/consistency/2026/08/15/15_54_20/*.md, *.json
spec/5-system/4-execution-engine.md  (§7.1 문단 1줄 갱신)
```

`codebase/frontend/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/channel-web-chat/**` — 전부 변경 set 밖.

## 트리거 매칭 검토

20개 행 전수 대조:

- **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 변경 없음 (execution-engine.service.ts 는 `src/modules/execution-engine/`, 노드 카테고리 디렉토리 아님). 미매칭.
- **신규 UI 문자열 (TSX) / 위젯 chrome 문자열** — frontend/channel-web-chat 변경 0건. 미매칭.
- **통합/제공자 변경 · 신규 섹션 디렉토리 · 백엔드 API(controller/DTO) · 신규 BullMQ 큐** — 해당 파일 변경 없음. 미매칭.
- **신규 warningCode / errorCode** — `WORKER_HEARTBEAT_TIMEOUT` 문자열 리터럴이 코드 안에 있으나, `git log -S`(전체 히스토리) 로 확인한 결과 이 값은 PR3(`75d9e7de7`, 2026-07-04)부터 이미 존재 — 이번 diff 가 신규 발행한 코드가 아니다. `codebase/backend/src/nodes/core/error-codes.ts` 자체도 diff 에 없음(`ErrorCode` enum 무변경). 미매칭.
- **신규 cross-cutting enum / backend zod ui.label 값 / handler output field** — 해당 없음. 미매칭.
- **인증·권한·세션 흐름 변경** — `codebase/backend/src/modules/auth/**` 변경 0건. 미매칭.
- **AuthConfig type enum 변경 · 표현식 언어 변경** — 해당 모듈/패키지 변경 없음. 미매칭.
- **실행·디버깅 흐름 변경** (semantic, `05-run-and-debug/` 타겟) — 가장 근접한 후보라 신중히 판단. `execution-engine.service.ts` 의 `finalizeStalledExhausted` 를 손댔지만, 변경 자체가 명시적으로 "수신자 영향 없음 — 이벤트 payload·상태 전이·no-op 조건 모두 그대로" 라고 못박는다(CHANGELOG.md 신규 항목, JSDoc 신규 문단 둘 다 동일 문구). 실제 효과는 *두 UPDATE 를 같은 트랜잭션으로 묶는 것* 뿐 — 정상 경로에서 방출되는 이벤트/상태값/노드 상태 표시는 이전과 동일하다. 유일한 행동 차이는 "워커 크래시로 stalled 재배달을 소진한 후 두 번째 UPDATE 가 또 실패하는" 극히 드문 이중 실패 케이스에서, 이전엔 자식 NodeExecution 이 영구 `RUNNING` 으로 잔류(유령 상태)했는데 이제는 정상적으로 `FAILED`(`WORKER_HEARTBEAT_TIMEOUT`)로 일관 마감된다는 점이다. 이는 `05-run-and-debug/` 가이드가 문서화하고 있었을 리 없는 버그 상태(유령 RUNNING)를 없애는 수정이지, 가이드가 서술하는 정상 상태값 집합(RUNNING/FAILED 등)이나 사용자 관찰 가능한 흐름을 바꾸는 것이 아니다. **미매칭으로 판단**.
- **환경 변수·런타임 변경** — 해당 없음.
- **spec 신규/대규모 변경** — `spec/5-system/4-execution-engine.md` 1줄 갱신 있으나, 이는 doc-sync-matrix 가 다루는 "유저 가이드(MDX)" 범주가 아니라 기술 스펙 본문이며, 같은 PR 안에서 이미 갱신 완료(fast-follow 아님). 이 행의 target 은 frontmatter 정합(`code:`/`status:`/`pending_plans:`) 검증이지 본 리뷰어 영역(frontend docs/i18n)과 무관.
- **user-guide GUI 흐름 절 신규/변경** — `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음. 미매칭.
- **spec 자체 결함 발견** — 해당 없음.

## i18n parity / backend-labels / locale.ts 가드 대상 여부

TSX 신규 문자열 없음, backend warningRules/`error-codes.ts` 의 `ErrorCode` enum 변경 없음, `content/docs/<NN>-<name>/` 신규 디렉토리 없음 — CRITICAL 소스 3종 전부 해당 없음.

## 결론

이번 diff 는 `finalizeStalledExhausted` 의 Execution/NodeExecution 2-테이블 쓰기를 `dataSource.transaction` 으로 원자화한 순수 백엔드 내부 정합성 수정이며, 코드 자체가 "수신자 영향 없음"을 명시하고 CHANGELOG·spec·plan 갱신이 같은 턴에 이미 완료돼 있다. frontend/i18n/nodes/docs MDX/auth/expression-engine 어느 경로도 건드리지 않아 doc-sync-matrix 20개 행 중 매칭되는 항목이 없다.

## 요약

매트릭스 20개 행 전수 대조 결과 매칭 0건, 누락 0건. 변경 set 이 `codebase/backend/src/modules/execution-engine/**` + plan/CHANGELOG/spec 기술문서(같은 턴 갱신 완료) + 직전 리뷰 라운드 산출물에 한정되어 유저 가이드(frontend docs MDX)·i18n dict·backend-labels 어느 것도 트리거되지 않는다. "해당 없음".

## 위험도
NONE
