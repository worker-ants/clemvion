# 신규 식별자 충돌 검토

target: `spec/2-navigation/` (구현 착수 전 검토, `--impl-prep`)

## 배경

이 검토 시점의 `spec/2-navigation/` 은 대부분 이전 세션들에서 이미 여러 차례 검토·확정된 기존 내용이다. 이번
사이클에서 실제로 새로 추가된 부분은 커밋 `a8bfd1492`(참조의 소속 규칙)이 `1-workflow-list.md` 에 더한 것뿐이며,
같은 draft 는 이미 `--spec` 단계 검토(`review/consistency/2026/09/27/20_05_26/naming_collision.md`)에서
naming-collision 관점 위험도 NONE 으로 판정받았다. 이번 `--impl-prep` 검토는 (a) 그 판정이 여전히 유효한지
재확인하고, (b) 이번에 처음 등장하는 구현측 산출물(테스트 파일 등)까지 범위를 넓혀 확인한다.

`spec/2-navigation/` 의 18개 파일 중 컨텍스트 예산으로 15개(`4-integration.md`, `6-config.md`,
`9-user-profile.md`, `14-execution-history.md`, `_product-overview.md`, `5-knowledge-base.md`,
`8-marketplace.md`, `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`,
`13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`)는 프롬프트 본문에서 생략됐고,
관련 spec 코퍼스(`spec/1-data-model.md`, `spec/data-flow/*`, `spec/5-system/*` 등 95개)도 전부 생략됐다. 이
번들 갭은 `Read`/`git show` 로 직접 열어 보완했다(아래 근거 참고) — 생략을 "충돌 없음" 의 근거로 쓰지 않았다.

## 발견사항

없음.

### 확인한 근거

1. **요구사항 ID** — 이번 변경이 새로 부여하는 `NAV-*`/`R-*`/`W-*` 류 ID 없음. `1-workflow-list.md` §3·§3.1 에
   추가된 문장들은 기존 endpoint 설명에 검증 조건을 덧붙인 것이고, Rationale §3 에 추가된 "(2026-09-27 정정)"
   단락도 새 heading 을 만들지 않고 기존 Rationale §3 본문에 문단만 추가했다.
2. **엔티티/타입명** — `folderId` / `parentId` / `containerId` / `toolOwnerId` / `sourceNodeId` /
   `targetNodeId` / `workflowId` 는 모두 `spec/1-data-model.md` §2.4~§2.9 에 이미 정의된 기존 필드이며, 새
   DTO·인터페이스·엔티티명은 도입되지 않는다.
3. **API endpoint** — `POST/PATCH /api/workflows`, `POST/PATCH /api/folders` 는 기존에 등재된 endpoint 다.
   새 endpoint 는 추가되지 않는다(`git show a8bfd1492 -- spec/2-navigation/1-workflow-list.md` 확인 — 메서드/경로
   행은 그대로, 설명 컬럼만 확장).
4. **이벤트/메시지명** — webhook·queue·sse 이벤트 이름 추가·변경 없음.
5. **환경변수·설정키** — 없음.
6. **파일 경로** —
   - `spec/1-data-model.md` 신설 섹션 `### 1.1 참조의 소속` (앵커 `#11-참조의-소속`): 그 문서에 기존 `### 1.x`
     서브섹션이 없어 번호 충돌 없음. `spec/data-flow/12-workspace.md` 에도 자신의 `### 1.1 워크스페이스 생성
     (team)` 이 있으나, 저장소 관례상 교차 참조가 항상 문서명으로 한정("데이터 모델 §1.1")되어 있어 혼동 사례
     아님 — grep 확인(`참조의 소속` 문자열은 `spec/1-data-model.md:57`(정의)·`spec/data-flow/11-workflow.md:83`
     (재인용) 2곳뿐, 둘 다 같은 개념을 가리킨다).
   - 새 e2e 테스트 파일 `codebase/backend/test/cross-workspace-references.e2e-spec.ts` (금번 워크트리에 untracked
     상태로 존재) — `ls codebase/backend/test/*.e2e-spec.ts` 전수 확인 결과 동명·유사명 기존 파일 없음
     (`workspace-delete-concurrency` / `workspace-path-guard` / `workspace-rbac` 와는 접두사만 겹치고 각각 다른
     관심사). 명명도 저장소 관례(설명적 시나리오명, plan slug 그대로 베끼지 않음 — 예:
     `patch-null-rejection.e2e-spec.ts` ↔ plan `patch-null-validation`)와 일치해 plan slug
     `cross-workspace-refs`(축약 "refs") 와 파일명 "references"(완전형)가 다른 것도 이 저장소의 기존 패턴이지
     충돌이 아니다.
   - plan 파일 `plan/complete/spec-draft-cross-workspace-refs.md` · `plan/in-progress/cross-workspace-refs.md`
     쌍은 기존 `spec-draft-<slug>.md` ↔ `<slug>.md` 짝짓기 컨벤션과 일치, 동명 기존 파일 없음(`find plan
     -iname "*cross-workspace*"` 로 2건만 확인).
7. **에러 코드 재사용** — `VALIDATION_ERROR` / `details.code='INVALID_FIELD'` / `MODEL_CONFIG_NOT_FOUND` /
   `AUTH_CONFIG_NOT_FOUND` 는 `spec/5-system/2-api-convention.md` §5.3 · `spec/5-system/3-error-handling.md`
   §1.3/§1.11 에 이미 정의된 코드의 재사용이며, `details[].field='folderId'` / `details[].field='parentId'` 로
   지정되는 필드-에러 매핑도 `spec/2-navigation/1-workflow-list.md` 를 제외한 다른 spec 문서에서는 쓰인 적이
   없다(grep 0건) — 같은 필드명에 다른 의미의 에러 규약이 이미 존재하는 경우는 없다.

## 요약

이번 `--impl-prep` 범위(`spec/2-navigation/`)에서 실질적으로 새로 도입되는 식별자는 거의 없다. 유일한 신설 자리인
`spec/1-data-model.md §1.1` 섹션 앵커와 신규 e2e 테스트 파일 경로 모두 기존 명명 컨벤션·앵커 체계와 충돌하지
않으며, 재사용되는 에러 코드·필드명도 기존 정의와 의미가 일치한다. 이는 같은 draft 에 대한 이전 `--spec` 검토
(`review/consistency/2026/09/27/20_05_26/naming_collision.md`, 위험도 NONE)의 판정을 뒤집을 근거를 찾지 못했다는
뜻이며, 구현 착수 시점에도 신규 식별자 충돌 관점의 차단 사유는 없다.

## 위험도

NONE
