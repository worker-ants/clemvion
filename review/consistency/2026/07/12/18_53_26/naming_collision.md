# 신규 식별자 충돌 검토 — Manual Trigger 저장 시점 검증 spec 반영

## 검토 범위 확인

target 으로 지정된 `spec/4-nodes/7-trigger/1-manual-trigger.md` 는 diff 상 **순수 문서 갱신**이다 (`git diff` 확인). 실제 변경분은 다음 4개 spec 파일:

- `spec/4-nodes/7-trigger/1-manual-trigger.md` — §6 저장 시점 발행 경로 각주 + frontmatter `code:` 에 `workflows.service.ts` 추가 + `## Rationale` 절 신설
- `spec/5-system/3-error-handling.md` — §1.7 문구에 저장 경로 언급 추가
- `spec/data-flow/10-triggers.md` — 저장 경로 검증 각주 추가
- `spec/data-flow/11-workflow.md` — 시퀀스 다이어그램 Note 에 `400 INVALID_TRIGGER_PARAMETERS` 분기 추가

이 변경이 텍스트에 등장시키는 식별자는 `validateManualTrigger`(private method), `skipLegacyDataGates`(파라미터), `INVALID_TRIGGER_PARAMETERS`(에러 코드), `restoreVersion` 이며, 관련 plan(`plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`)이 명시하듯 **"코드/이름 변경 불요 — 순수 문서 갱신"** 이다. 즉 target 은 "새 식별자" 를 도입하는 것이 아니라 **이미 코드에 존재하고 이미 다른 spec 문서에서 참조되던 식별자를 해당 spec 문서에 처음 노출**시키는 작업이다.

## 사실관계 검증 (grep)

- `validateManualTrigger`: `codebase/backend/src/modules/workflows/workflows.service.ts:601`(정의) 기존 구현 완료 상태이며, `spec/conventions/execution-context.md:72`, `plan/in-progress/manual-trigger-default-param.md:31` 등에 이미 선재(先在) 언급됨. target 신규 등장 아님.
- `skipLegacyDataGates`: `workflows.service.ts:408/413/415/492` 기존 파라미터. target 에서 처음 spec 화됐을 뿐 동일 의미로 일관 사용.
- `INVALID_TRIGGER_PARAMETERS`: `workflows.controller.ts`/`workflows.service.ts`/e2e 스펙에 기존 구현. `spec/5-system/12-webhook.md:313`, `spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md` 등 여러 spec 문서에서 **동일 의미**(Manual Trigger 파라미터 스키마 검증 실패 400 코드)로 일관 사용 — 실행 경로(`POST /:id/execute`)와 저장 경로(`POST /:id/save`) 양쪽에서 같은 코드를 재사용하는 것으로 명시돼 있어 의미 분기 없음.
- `restoreVersion`: `spec/5-system/3-error-handling.md:85`, `spec/conventions/execution-context.md:72/76` 에서 이미 "legacy-data escape" 의미로 정의돼 있고, target 문서의 사용(파라미터 스키마 게이트 skip)은 **같은 의미의 연장**(예약 변수명 게이트와 파라미터 스키마 게이트 둘 다 스킵) — 상충 없음.

## 발견사항

없음. 6개 점검 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로) 모두에서 target 이 **새로 도입하는 식별자가 존재하지 않는다** — 전부 기존 구현·기존 spec 참조를 문서에 반영하는 것뿐이다. API endpoint(`POST /api/workflows/:id/save`, `POST /:id/execute`)도 이미 여러 spec에 정의돼 있던 기존 endpoint이고, 파일 경로 역시 기존 4개 spec 파일의 본문 수정(frontmatter code glob 1건 추가)일 뿐 신규 파일 생성이 없다.

## 요약

target 변경은 코드에 이미 구현된 저장 시점(`POST /:id/save`) `INVALID_TRIGGER_PARAMETERS` 검증 경로를 spec 문서에 사후 반영하는 순수 문서화 작업으로, 텍스트에 등장하는 모든 식별자(`validateManualTrigger`, `skipLegacyDataGates`, `INVALID_TRIGGER_PARAMETERS`, `restoreVersion`)가 기존 코드베이스 및 기존 타 spec 문서(`execution-context.md`, `error-handling.md`, `12-webhook.md` 등)에서 이미 동일 의미로 사용 중임을 grep 으로 확인했다. 새로 부여되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로가 전혀 없어 신규 식별자 충돌 리스크 자체가 발생하지 않는 변경이다.

## 위험도

NONE
