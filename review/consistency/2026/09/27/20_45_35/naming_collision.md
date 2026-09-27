# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 검토 범위 확인

target 문서(draft 2)가 실제로 도입하는 변경은 네 가지뿐이다 — 모두 **기존에 이미 존재하는 파일의 frontmatter 값 갱신 또는 산문 한 문장 교체**이며, 신규 요구사항 ID·엔티티·DTO·endpoint·이벤트명·ENV var·파일 경로를 새로 만들지 않는다.

1. `spec/2-navigation/1-workflow-list.md` `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가 — 확인 결과 이 문서는 이미 `pending_plans:`(`marketplace-and-plugin-sdk.md`, `workflow-duplicate-nodes-edges.md`) 목록을 갖고 있어 **키 자체는 기존 사용처와 동일 의미로 사용**된다. 항목 추가일 뿐 식별자 신설이 아니다.
2. `spec/3-workflow-editor/0-canvas.md` 동일 — 이 문서도 이미 `pending_plans:` 목록(`ai-agent-tool-connection-rewrite.md`, `spec-sync-canvas-gaps.md`)을 갖고 있다.
3. `spec/1-data-model.md` `status: implemented` → `partial` + `pending_plans:` 신설 — `status` 필드 자체는 이미 존재(값만 교체), `pending_plans` 키는 이 문서엔 처음이지만 `spec/conventions/spec-impl-evidence.md` §2.1 이 정의한 **기존 컨벤션 키**를 그대로 재사용하는 것이라 새 식별자가 아니다.
4. `1-workflow-list.md` `## Rationale` §3 정정 단락의 끝 문장 텍스트 교체(`plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md`, 과거형 → 현재형) — 산문 인용 경로 표기 변경일 뿐, 새 식별자 도입이 아니다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 해당 없음. draft 2 는 새 요구사항 ID를 부여하지 않는다.
2. **엔티티/타입명 충돌** — 해당 없음. 새 엔티티·DTO·인터페이스 명 없음.
3. **API endpoint 충돌** — 해당 없음. 새 endpoint 없음(`processing`한 `POST /api/folders` 등은 draft 2 가 아니라 구현 plan `cross-workspace-refs.md`/선행 spec 커밋 `a8bfd1492` 의 범위).
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — 해당 없음. `pending_plans`·`status` 는 신규 키가 아니라 `spec/conventions/spec-impl-evidence.md` 가 이미 정의한 기존 frontmatter 컨벤션 키이고, 값(경로·상태 리터럴)도 실재 파일/기존 enum 값이다.
6. **파일 경로 충돌** — draft 2 자신은 완료 시 `plan/complete/spec-draft-cross-workspace-refs-2.md` 로 이동할 것이라 적는다(§Rationale). 실측 결과 그 경로에 기존 파일이 **없다**(`plan/complete/` 에는 1차 draft `spec-draft-cross-workspace-refs.md` 만 존재) — 충돌 없음. 명명 패턴(`spec-draft-<slug>-2.md`)도 1차 draft `spec-draft-cross-workspace-refs.md` 의 연번 관례를 그대로 따른다.

## 보조 확인

- `spec/1-data-model.md` §1.1 "참조의 소속" 섹션은 이미 존재(직전 커밋 `a8bfd1492` 가 신설) — draft 2 가 새로 만드는 섹션이 아니라 인용만 한다.
- `pending_plans` 에 같은 plan 경로(`plan/in-progress/cross-workspace-refs.md`)가 세 문서에 중복 등재되는 것은 그 구현 plan의 `spec_impact` 가 세 파일 모두를 가리키므로 의도된 것이며 식별자 충돌이 아니다.

## 발견사항

없음 — target 문서가 새로 부여하는 식별자가 존재하지 않아 여섯 관점 모두 위반 사례가 없다.

## 요약

draft 2 는 신규 식별자를 전혀 도입하지 않는 순수 frontmatter/추적 메타데이터 정정 문서(`pending_plans` 항목 추가, `status` 값 전이, Rationale 인용 경로·시제 교정)다. 세 대상 spec 파일 모두 확인한 결과 `pending_plans`·`status` 키는 이미 확립된 컨벤션(`spec/conventions/spec-impl-evidence.md`)의 재사용이며, draft 자신의 예정 이동 경로(`plan/complete/spec-draft-cross-workspace-refs-2.md`)도 기존 파일과 겹치지 않는다. 신규 식별자 충돌 관점에서 이 draft 는 무해하다.

## 위험도

NONE
