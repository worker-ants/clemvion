# 신규 식별자 충돌 검토

target: `plan/in-progress/spec-draft-cross-workspace-refs.md` (spec draft, `--spec` 검토 모드)

## 발견사항

없음 — 검토한 6개 관점(요구사항 ID · 엔티티/타입명 · API endpoint · 이벤트/메시지명 · 환경변수/설정키 · 파일 경로) 모두에서
충돌을 찾지 못했다. 확인한 근거는 다음과 같다.

- **요구사항 ID**: draft 가 신규로 부여하는 requirement ID(`NAV-*`/`R-*`/`W-*` 류)가 없다. 본문의 `W1:`(BLOCK 사유 메모)은 이
  저장소 여러 plan 문서에서 반복되는 문서-로컬 shorthand("Warning 1")이지 전역 레지스트리 식별자가 아니다(`plan/complete/*.md`
  10곳 이상에서 같은 패턴 확인 — 매번 그 문서 안에서만 유효).
- **엔티티/타입명**: 새 엔티티·DTO·인터페이스를 만들지 않는다. `container_id` · `tool_owner_id` · `source_node_id` ·
  `target_node_id` · `folder_id` · `workflow_id` 는 모두 `spec/1-data-model.md` §2.4~§2.9 에 이미 정의된 기존 컬럼이고,
  draft 는 그 옆에 소속 제약 문구만 추가한다.
- **API endpoint**: `POST/PATCH /api/workflows`, `POST/PATCH /api/folders`, 캔버스 저장 API 모두
  `spec/2-navigation/1-workflow-list.md` §3·§3.1, `spec/3-workflow-editor/0-canvas.md` 에 이미 등재된 endpoint 다. 새 endpoint
  는 추가되지 않는다.
- **이벤트/메시지명**: webhook·queue·sse 이벤트 이름 변경·추가 없음.
- **환경변수·설정키**: 없음.
- **파일 경로**: draft 자신의 경로 `plan/in-progress/spec-draft-cross-workspace-refs.md` 는 이미 저장소에 있는
  `spec-draft-nullable-notation-followups.md` · `spec-draft-eia-62-waiting-payload.md` ·
  `spec-draft-eia-notification-payload-contract.md` 등 `spec-draft-<slug>.md` 명명 컨벤션과 일치하고, 같은 작업의
  구현 plan `plan/in-progress/cross-workspace-refs.md` 와 slug 가 짝을 이룬다(선례: nullable-notation-followups 와도 동일
  패턴). 새로 만드는 spec 파일은 없다(기존 5개 파일만 수정).

### 에러 코드 재사용 확인 (충돌 없음, 참고용)

draft 가 거부 응답에 쓰는 `VALIDATION_ERROR` / `details.code: 'INVALID_FIELD'` 는 `spec/5-system/2-api-convention.md` §5.3 ·
`spec/5-system/3-error-handling.md` §1.3 이 이미 정의한 generic 코드이며, `codebase/backend/src/common/pipes/validation.pipe.ts`
등 구현에서도 동일하게 쓰인다 — **새 코드가 아니라 기존 코드의 재사용**이다. `MODEL_CONFIG_NOT_FOUND` · `AUTH_CONFIG_NOT_FOUND`
도 마찬가지로 `spec/5-system/3-error-handling.md` §1.11 · Rationale 에 이미 등재된 코드를 그대로 인용한다. draft 의
`## Rationale`은 오히려 "새 `_NOT_FOUND` 코드를 만들지 않는다"고 명시해 신규 식별자 증식을 스스로 차단하고 있다 —
신규 식별자 충돌 관점에서는 바람직한 설계다.

### 섹션 번호 신설 확인 (충돌 없음, 참고용)

`spec/1-data-model.md`에 신설하는 `### 1.1 참조의 소속`은 현재 그 문서에 `### 1.x` 서브섹션이 없어(§1은 엔티티 관계도 다이어그램만
포함) 번호 충돌이 없다. `데이터 모델 §1.1`이라는 교차 참조 표현도 저장소 전체에서 이 draft 이전에는 쓰인 적이 없다(grep 0건).
`spec/data-flow/12-workspace.md`에도 별도의 기존 `### 1.1 워크스페이스 생성 (team)`이 있지만, 이 저장소의 기존 관례대로 모든
교차 참조가 항상 문서명으로 한정("데이터 모델 §1.1" vs 그 문서 자신의 "§1.1")되어 있어 혼동 사례가 아니다.

## 요약

target draft 는 새 식별자(요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로)를 사실상 전혀 새로 만들지 않고, 기존에
정의된 필드명(`folderId`/`parentId`/`containerId`/`toolOwnerId`/`sourceNodeId`/`targetNodeId`)과 기존 에러 코드
(`VALIDATION_ERROR`/`INVALID_FIELD`/`MODEL_CONFIG_NOT_FOUND`/`AUTH_CONFIG_NOT_FOUND`)만 재사용해 저장 전 소속 검사 규칙을
한 곳(`데이터 모델 §1.1`)에 모으는 방식이다. 신설하는 유일한 새 식별자인 섹션 번호 `§1.1`과 draft 파일 경로 모두 기존 명명
관례·번호 체계와 충돌하지 않는다.

## 위험도

NONE
