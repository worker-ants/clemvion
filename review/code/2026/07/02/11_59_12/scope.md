# 변경 범위(Scope) 리뷰

대상 커밋: `ab25beaf5` — "refactor(engine): M-7 RESUME-STATE 클러스터 — §7.4 재개상태 zod 스키마 + 단언 전환"
대상 파일 7개: `ai-turn-orchestrator.service.ts`, `execution-engine.service.spec.ts`, `execution-engine.service.ts`, `handler-output.adapter.ts`, `retry-turn.service.ts`, `utils/resume-state.schema.ts`(신규), `utils/resume-state.schema.spec.ts`(신규)

## 사전 확인한 선언된 범위

`plan/in-progress/refactor/03-maintainability.md` M-7 항목(라인 221-247)에 따르면:
- M-7 은 엔진 전반 inline 타입 단언(~124건/~15파일)을 클러스터 단위로 나눠 진행 중.
- 첫 클러스터(PR #782, 커밋 `27225ae39`)는 `to-record.ts`(`isRecord`/`toRecord`) + `execution-engine.service.ts` cachedMeta 1건.
- **RESUME-STATE 클러스터는 계획서에 명시된 "후속 클러스터" 항목 중 하나**(§7.4 zod schema 필요 분류) — 이번 커밋이 정확히 그 항목을 다룬다.
- 즉 이번 diff 는 계획서가 사전 정의한 범위 내의 정당한 후속 작업이며, 범위 이탈이 아니다.

## 발견사항

- **[INFO]** plan 문서(`plan/in-progress/refactor/03-maintainability.md`)가 이번 커밋에 포함되지 않음
  - 위치: `plan/in-progress/refactor/03-maintainability.md` M-7 항목(라인 221-247)
  - 상세: 첫 클러스터(#782)는 M-7 항목 본문에 "첫 클러스터(본 PR)"로 명시적으로 기록됐으나, 이번 RESUME-STATE 클러스터 완료를 반영하는 plan 갱신(체크박스/후속 클러스터 목록 갱신)이 diff 에 없음. 코드 변경 자체의 범위 문제는 아니지만, `.claude/docs/plan-lifecycle.md` 관례상 진행 상태를 실제 상태와 동기화해야 한다.
  - 제안: 별도 커밋(같은 PR 또는 후속)으로 plan 문서에 RESUME-STATE 클러스터 완료 여부 및 남은 클러스터(LOAD-BEARING/STORE-PRESERVE/`ai-turn-orchestrator.service.ts`(18)/`ai-turn-executor.ts`(29)/기타) 를 갱신.

- **[INFO]** `handler-output.adapter.ts` 의 인라인 가드 → `isRecord` 헬퍼 치환
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:96-99`
  - 상세: 4줄 인라인 `typeof/Array.isArray` 가드를 기존 `to-record.ts` 의 `isRecord()` 로 교체. `isRecord` 는 이전 M-7 첫 클러스터(#782)에서 이미 도입된 공유 헬퍼이며 새로 만든 것이 아니다. 커밋 메시지에도 "가드된 _resumeState 단언 → isRecord 헬퍼 재사용" 으로 명시돼 있어 의도된 범위 내 정리다. 순수 리팩토링이지만 이번 M-7 클러스터의 핵심 목표(구조 단언 명명 타입 전환)와 직접 연결되므로 무관한 리팩토링이 아니다.
  - 제안: 조치 불필요.

## 파일별 점검 결과

1. `ai-turn-orchestrator.service.ts` — `ResumeState` 타입 import 1개 추가 + 기존 `as Record<string, unknown>` 단언 2곳을 `as ResumeState`/`as ResumeState | undefined` 로 교체. 로직·분기·주석 실질 변경 없음(멀티라인 캐스트가 한 줄로 축약된 것은 타입명이 짧아진 자연스러운 결과이며 임의 포맷팅이 아님).
2. `execution-engine.service.spec.ts` — 기존 테스트 2곳에 drift-guard assertion(스키마 safeParse + credential 필드 부재 검증) 추가. 새 import 는 신설 스키마 모듈에서만 가져옴. 기존 테스트 구조·다른 테스트 케이스는 손대지 않음.
3. `execution-engine.service.ts` — `ResumeCheckpoint` 타입 import 1개 + 단언 1곳 교체. 그 외 변경 없음.
4. `handler-output.adapter.ts` — 위 INFO 참고. `isRecord` import 1개 + 가드 로직을 헬퍼 호출로 대체(동작 동일, behavior-preserving 명시).
5. `retry-turn.service.ts` — `RetryState` 타입 import 1개 + 단언 2곳 교체. 로직 변경 없음.
6. `utils/resume-state.schema.ts` (신규) — 이번 클러스터의 핵심 신규 산출물. `ResumeState`/`ResumeCheckpoint`/`RetryState` 3종 zod 스키마 + `CREDENTIAL_CONTEXT_FIELDS` 상수. 런타임 경계에서 parse 하지 않음을 문서화(§7.5 graceful-reset semantics 보존 목적)해 스키마 도입이 기존 동작을 바꾸지 않음을 명확히 함 — 기능 확장이 아니라 타입 SoT 문서화·drift 방지 인프라.
7. `utils/resume-state.schema.spec.ts` (신규) — 신설 스키마의 unit 테스트. 정상/credential 유입 거부/schema drift 가드/IE 고유 필드/TTL 구분 등 스키마가 커버해야 할 불변식만 검증 — 스키마 자체 범위를 넘는 임의 케이스 없음.

## 요약

이번 diff 는 `plan/in-progress/refactor/03-maintainability.md` M-7 항목이 사전에 "후속 클러스터"로 명시한 RESUME-STATE 작업(§7.4 zod 스키마 신설 + 관련 6곳 단언 전환)에 정확히 대응하며, 커밋 메시지가 기술한 변경 파일·내용과 실제 diff 가 1:1로 일치한다. 프로덕션 코드 변경은 전부 "명명되지 않은 구조 단언(`as Record<string, unknown>` 류) → 명명된 zod-infer 타입" 치환이며 로직·분기·이벤트 emit·에러 처리 등 실질 동작은 전혀 건드리지 않았다(behavior-preserving 명시). 신규 스키마 파일은 런타임 파싱을 하지 않도록 설계돼 §7.5 graceful-reset semantics 를 보존한다는 점을 스스로 문서화했고, 테스트 변경도 스키마 drift 가드용 assertion 추가에 국한된다. 무관한 파일 수정, 불필요한 리팩토링, 기능 확장, 포맷팅/주석/임포트 잡음, 설정 변경 등 범위 이탈 신호는 발견되지 않았다. 유일한 지적 사항은 plan 문서의 진행 상태 갱신이 이번 커밋에 동반되지 않았다는 프로세스성 INFO 이며, 이는 코드 변경 범위 자체의 문제는 아니다.

## 위험도

NONE
