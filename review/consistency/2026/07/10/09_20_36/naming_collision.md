# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md

검토 범위: `git diff origin/main -- spec/5-system/4-execution-engine.md` (front-matter `pending_plans` 정리, §1.3 checkpoint 재유도 불변식 추가, `NodeHandlerOutput.port` 타입 확장, §5.3 노드 타입 표기 정규화, §10.3/§10.4 절 재배치, Rationale addendum 추가). target 문서는 `status: partial` 기존 spec 의 증분 개정이므로, 이번 diff 가 실제로 새로 도입하는 식별자만 대상으로 기존 스펙·코드 사용처와 충돌 여부를 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 확인한 항목과 근거는 다음과 같다 (모두 기존 사용처와 정합 — 충돌 아님):

- **`CREDENTIAL_CONTEXT_FIELDS`** (§1.3 신규 불변식 문단에서 처음 본문 언급) — `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:150` 에 이미 동일 이름·동일 의미(credential-strip allow-list)로 정의돼 있고, 두 개의 `.spec.ts` 파일에서 동일 의미로 소비 중. 신규 도입이 아니라 기존 상수를 문서에 처음 명명한 것 — 충돌 없음.
- **`resumeStateSchema`** — `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:110` 에 이미 존재(`ResumeState` 타입의 zod 스키마), 의미 일치. 충돌 없음.
- **`NodeHandlerOutput.port?: string | string[]`** (타입 확장) — `spec/conventions/node-output.md` §Principle 5 "`port` 활성화 모델"이 이미 `port: string[]` fan-out 형태를 정의하고 있고, `spec/4-nodes/1-logic/10-parallel.md`, `spec/4-nodes/3-ai/2-text-classifier.md` 가 동일 의미로 이미 사용 중. execution-engine.md 의 TS 인터페이스가 기존 convention 을 뒤늦게 반영한 것 — 신규 타입 도입 충돌 아님.
- **§5.3 노드 타입 표기 `if_else`/`switch`/`text_classifier`/`http_request`/`ai_agent`** (기존 하이픈 표기 `if-else`/`text-classifier`/`http-request`/`ai-agent` 를 언더스코어로 정정) — `spec/1-data-model.md:150,174` 의 canonical `NodeType` enum 표기(언더스코어)와 일치시키는 수정. 오히려 기존 표기 불일치를 해소하는 방향이라 충돌 없음(신규 식별자 아님).
- **회귀 참조 `#501`** — `spec/4-nodes/3-ai/3-information-extractor.md:378` 에서 이미 동일 의미(동일 usage-log attribution 회귀)로 참조 중, 신규 §Rationale 서브섹션(`### resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)`)도 파일 내 유일 헤딩 — 중복/충돌 없음.
- **`pending_plans` 에서 `plan/in-progress/exec-park-durable-resume.md` 제거** — 해당 plan 은 이미 `plan/complete/exec-park-durable-resume.md` 로 이동 완료된 상태(파일시스템 확인). front-matter 정리가 실제 상태와 일치 — 경로 충돌 없음.
- **§10.3/§10.4 절 재배치** (§8~§11 사이 배치 오류를 §10 "Integration Handler 계약" 하위로 정정) — 헤딩 텍스트·앵커(`#103-호출-순서` 등) 불변, 외부에서 해당 앵커를 참조하는 문서 없음(grep 확인) — 이동으로 인한 링크/식별자 충돌 없음.

## 요약

이번 target 개정은 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로를 신규로 도입하지 않는다. 언급된 식별자(`CREDENTIAL_CONTEXT_FIELDS`, `resumeStateSchema`, `port: string | string[]`, 언더스코어 노드 타입 표기, `#501`)는 모두 이미 코드베이스 또는 다른 spec 문서에 동일 의미로 존재하던 것을 이 문서가 뒤늦게 명문화·정정한 것이며, 오히려 기존 표기 불일치(하이픈 vs 언더스코어 노드 타입) 하나를 해소했다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
