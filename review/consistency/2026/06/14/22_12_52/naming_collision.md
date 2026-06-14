# 신규 식별자 충돌 검토 결과

## 발견사항

충돌 또는 우려 사항 없음.

target 문서(D-1 / D-2)가 도입하는 신규 식별자 카테고리별 검토 결과:

1. **요구사항 ID 충돌**: 해당 없음. 본 draft 는 새 요구사항 ID(예: `ND-*`, `EIA-*` 형식)를 부여하지 않는다. D-1 / D-2 는 plan 내부 식별자로만 사용되며 spec 본문의 공식 요구사항 ID 네임스페이스에 진입하지 않는다.

2. **엔티티/타입명 충돌**: 해당 없음. D-2 Rationale 본문에 등장하는 `validateFormSubmission`, `FormValidationError`, `continueExecution` 은 모두 기존 spec 코퍼스에 이미 정의·사용 중인 식별자이며 본 draft 가 신규 도입하는 이름이 아니다.
   - `/Volumes/project/private/clemvion/.claude/worktrees/spec-form-hygiene-139859/spec/4-nodes/6-presentation/4-form.md` L332, `/Volumes/project/private/clemvion/.claude/worktrees/spec-form-hygiene-139859/spec/5-system/14-external-interaction-api.md` L313, L1003, `/Volumes/project/private/clemvion/.claude/worktrees/spec-form-hygiene-139859/spec/5-system/4-execution-engine.md` L1015 에서 이미 확인됨.

3. **API endpoint 충돌**: 해당 없음. 새 endpoint 를 정의하지 않는다.

4. **이벤트/메시지명 충돌**: 해당 없음. D-1 은 기존 `VALIDATION_ERROR` 코드 행에 부연 산문을 추가할 뿐이며 새 WS 이벤트·큐 이름을 도입하지 않는다. `details[]` 는 EIA REST body 의 기존 필드명 참조이다.

5. **환경변수·설정키 충돌**: 해당 없음.

6. **파일 경로 충돌**: 해당 없음. 변경 대상 파일 2건 (`spec/5-system/6-websocket-protocol.md`, `spec/4-nodes/6-presentation/4-form.md`) 모두 기존 파일이다. `## Rationale` 섹션 신설은 기존 spec 컨벤션(`N-name.md` 파일의 표준 말미 섹션 — `/Volumes/project/private/clemvion/.claude/worktrees/spec-form-hygiene-139859/spec/0-overview.md` §8 문서 컨벤션)을 준수하며 파일명·경로를 새로 만들지 않는다.

## 요약

본 draft 는 순수 문서 hygiene(기존 spec 행에 부연 산문 추가 + 기존 파일에 Rationale 섹션 신설)으로, 새로운 공식 식별자(요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·파일 경로)를 도입하지 않는다. Rationale 본문이 참조하는 모든 코드 심볼과 spec 절 번호는 기존 코퍼스에 확립된 것들이며, 어떤 카테고리에서도 명명 충돌이 발견되지 않았다.

## 위험도

NONE
