# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/2-navigation/` (impl-done, diff-base=origin/main)
실질 변경 범위: `spec/1-data-model.md` §2.5 Folder 제약, `spec/2-navigation/1-workflow-list.md` §3.1 폴더 PATCH 설명, `codebase/backend/src/modules/folders/{folders.service.ts, folders.controller.ts, folders.service.spec.ts}` (V-04: `update()` 재부모화 시 계층 무결성 — cycle·타 workspace parent·깊이 5 초과 가드)

## 발견사항

- **[INFO]** cycle-guard 재사용 결정(`VALIDATION_ERROR` vs 신규 코드)의 근거가 spec Rationale 이 아닌 코드 주석에만 존재
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 PATCH `/api/folders/:id` 행 (신규 문장: "새 부모가 같은 워크스페이스에 없거나, 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 `VALIDATION_ERROR`")
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"; `spec/conventions/error-codes.md` §1 (의미 기반 명명 — 신규 도메인 코드 신설 여부 판단 근거는 통상 spec/conventions 레벨에 남김)
  - 상세: `folders.service.ts`(`validateParentChange` 주석)에는 "신규 cycle 코드를 도입하지 않아 `CONTAINER_CYCLE`(노드)·`CYCLE_DETECTED`(그래프)와의 혼동을 피한다" 는 명확하고 타당한 근거가 있으나, 이 근거는 코드 주석에만 있고 spec 문서(`1-workflow-list.md` 또는 `1-data-model.md`)의 `## Rationale` 절에는 반영되지 않았다. 두 파일 모두 기존 Rationale 섹션이 있어 3섹션 구조 자체는 이미 충족하지만, 이번 변경으로 추가된 비자명한 설계 결정(왜 `FOLDER_CYCLE` 류의 새 코드를 만들지 않고 범용 `VALIDATION_ERROR` 를 재사용했는가)이 코드에만 남아 spec 만 읽는 독자(planner, 향후 리뷰어)는 그 근거를 알 수 없다.
  - 제안: `1-workflow-list.md` `## Rationale` 절에 짧은 항목을 추가 — "폴더 cycle 가드는 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와 별개 신규 코드를 만들지 않고 `VALIDATION_ERROR` 로 통합한다. 폴더 계층은 워크플로우 그래프·컨테이너와 다른 리소스 계층이라 코드명 재사용은 혼동을 유발하며, `error-codes.md §1` 의 "시스템 전역 공용 코드는 prefix 없이" 원칙에도 부합" 정도. CRITICAL/WARNING 아님 — 문서 완결성 제안.

- **[INFO]** `MAX_NESTING_DEPTH` 상수가 spec 수치(5)와 이중 관리되지만 단일 진실 표기가 없음
  - target 위치: `spec/1-data-model.md` §2.5 "중첩 깊이 제한: 최대 5단계 (생성·부모 변경 모두에 적용)" / `spec/2-navigation/1-workflow-list.md` §3.1
  - 위반 규약: 직접적 규약 위반은 아님(참고용 INFO) — `spec/conventions/spec-impl-evidence.md` 의 `code:` glob 근거 원칙과 유사한 맥락에서, 수치 상수가 두 spec 파일 + 코드 상수(`MAX_NESTING_DEPTH = 5`, `folders.service.ts`)에 흩어져 있어 향후 수치 변경 시 3곳 동기화가 필요
  - 상세: 이번 diff 자체는 기존 "5" 값을 그대로 유지하며 검증 범위(생성 전용 → 생성+수정)만 확장한 것이라 drift 는 없다. 다만 규약 문서(`spec/conventions/**`)에 "이런 매직넘버는 코드 상수를 SoT 로 삼고 spec 은 그 값을 인용한다" 류의 명시적 규칙이 없어, 향후 값이 바뀌면 정합성 검토에 의존해야 한다.
  - 제안: 규약화가 필요하면 `spec/conventions/` 에 별도 문서를 만들기보다, 기존 관례대로 코드 주석/데이터모델 문서 상호 참조만 유지해도 무방 — 액션 불요, 참고 사항.

## 검토 관점별 확인 결과 (문제 없음)

1. **명명 규약**: `FoldersService.validateParentChange` / `collectSubtree` / `getDepth` 등 신규 private 메서드명, `folders.controller.ts` 의 라우트(`GET/POST/PATCH/DELETE /api/folders[/:id]`)는 `spec/5-system/2-api-convention.md` §2.2(복수형 리소스명·2단계 중첩)·§3(PATCH 부분수정)·§12.1(상태 토글은 PATCH, 전용 endpoint 지양) 과 일치. 신규 endpoint 를 추가하지 않고 기존 PATCH 계약 안에서 검증만 강화한 점도 규약 부합.
2. **출력 포맷 규약**: 에러 발생 시 전부 `throw new BadRequestException({ code: 'VALIDATION_ERROR', message })` 형태로, `spec/5-system/2-api-convention.md` §5.3 에러 응답 포맷(`{ error: { code, message, requestId, details? } }`, 400 기본 코드 `VALIDATION_ERROR`)과 정합. `error-codes.md` §1 의 "시스템 전역 공용 코드는 prefix 없이" 원칙에도 부합 — `workflows.service.ts`/`triggers.service.ts` 등 동일 패턴 기존 코드와도 일관(`RESOURCE_NOT_FOUND`/`VALIDATION_ERROR` 재사용, grep 으로 교차 확인).
3. **문서 구조 규약**: `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md` 모두 기존에 Overview/본문/Rationale 3섹션 구조를 이미 보유(이번 diff 는 표·문장 수정 수준이라 구조 자체 변경 없음). `id:`/`status:`/`code:`/`pending_plans:` frontmatter 스키마는 `spec/conventions/spec-impl-evidence.md` 요건(예: `partial` 은 `pending_plans` 필수, 해당 path `plan/in-progress/spec-sync-workflow-list-gaps.md` 실존 확인)을 충족. `code:` 의 `codebase/backend/src/modules/folders/**` glob 이 신규 테스트 파일(`folders.service.spec.ts`)까지 이미 커버해 frontmatter 갱신 불요.
4. **API 문서 규약**: `folders.controller.ts` 의 `@ApiOperation`/`@ApiParam`/`@ApiOkWrappedResponse`/`@ApiBadRequestResponse` 등은 `spec/conventions/swagger.md` §0(운영 노출 정책)·§1(DTO JSDoc + `@ApiProperty` 보강 패턴)과 일치. `update-folder.dto.ts` 의 JSDoc 주석 + `@ApiPropertyOptional` 조합도 동일 컨벤션 준수. PATCH 설명 문구 갱신(`@ApiOperation.description`)이 spec §3.1 신규 문구와 내용상 정합.
5. **금지 항목**: `error-codes.md` §3 historical-artifact 예외 레지스트리에 새 항목을 추가하지 않았고(신규 코드 미도입), `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와 명칭이 충돌하는 신규 코드를 만들지 않은 점은 오히려 금지 패턴(무분별한 유사 코드 증식)을 피한 사례. PUT 미사용, 케밥/카멜 케이스 혼용 등 다른 금지 패턴도 발견되지 않음.

## 요약

이번 변경(V-04: 폴더 `PATCH` 재부모화 시 cycle·깊이·workspace 무결성 가드 추가)은 정식 규약 관점에서 위반 사항이 없다. API 엔드포인트·에러 응답 포맷·Swagger 데코레이터·DTO 명명은 각각 `spec/5-system/2-api-convention.md`, `spec/conventions/error-codes.md`, `spec/conventions/swagger.md` 와 정합하며, 특히 신규 cycle 전용 에러 코드를 만들지 않고 기존 `VALIDATION_ERROR` 를 재사용해 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와의 명명 충돌을 피한 판단은 규약 취지에 부합한다. 유일한 아쉬운 점은 그 판단 근거가 코드 주석에만 남고 spec 의 `## Rationale` 절에는 반영되지 않아, spec-only 독자에게는 "왜 새 코드를 안 만들었는가" 가 드러나지 않는다는 것(INFO 수준). 이는 채택을 막을 사안이 아니라 문서 완결성 제안이다.

## 위험도

LOW
