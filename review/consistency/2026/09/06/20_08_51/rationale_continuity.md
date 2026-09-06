# Rationale 연속성 검토 — spec/2-navigation/

## 검토 범위와 방법

- scope 로 지정된 `spec/2-navigation/` 은 이 브랜치에서 **델타 0** — 해당 영역 spec 문서 자체는 변경되지 않았다.
- 구현 diff(23파일/2769줄, 프롬프트 예산 절단)를 워킹트리 절대경로에서 직접 `git diff origin/main...HEAD`로 재구성해 확인했다. 핵심 코드 변경:
  - `codebase/backend/src/modules/triggers/{triggers.controller,triggers.service}.ts` — `(workspace_id, endpoint_path)` UNIQUE 위반을 `409 RESOURCE_CONFLICT` + `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT` 형태로 매핑 (신규 `isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`).
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`, `codebase/backend/src/modules/workspaces/{dto/responses/workspace-response.dto,workspaces.service.spec}.ts` — `User` 엔티티 컬럼 노출 방어(`creator`/`user` 관계 투영 강제) + `WorkspaceMemberDto.joinedAt` 필드 추가.
  - `user-entity-exposure-guard.ts` / `user-secret-absence.ts` / `dto-jsdoc-citation-guard.ts` (신규 정적 가드·테스트 유틸), `pg-error.ts` (SQLSTATE/제약명 추출 SoT 통합), e2e 3건 보강.
  - 이 branch 는 본질적으로 "User 엔티티 컬럼 노출 방어" 작업이며, `spec/2-navigation/*.md` 의 Rationale 이 다루는 화면·API 결정(트리거 R-1~R-16, 스케줄 sort/order 등)과는 대체로 직교한다.
- 위 diff 를 `spec/2-navigation/2-trigger-list.md` §3/§2.3.1 및 그 `## Rationale`(R-1~R-16), `spec/2-navigation/9-user-profile.md`·`6-config.md` 의 `## Rationale`, 그리고 프롬프트에 포함된 인접 spec(`1-data-model.md`, `1-auth.md`, `2-api-convention.md`, `3-error-handling.md` 등) 의 Rationale 발췌와 대조했다.

## 발견사항

### [INFO] 트리거 409 계약 구현 — 기존 Rationale 과 정합, 번복 아님

- target 위치: (참조) `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행 및 §3 API 표 — "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)"
- 상세: spec 이 이미 이 계약을 명문화하고 있었으나 구현은 전역 `GlobalExceptionFilter` 의 일반 `RESOURCE_CONFLICT`(details 없음)만 반환하고 있었다 — "문서한 보장이 구현보다 넓었다" 케이스. 이번 diff 는 그 갭을 메워 spec 이 이미 서술한 계약을 실제로 만족시킨 것이지, 과거 Rationale 이 기각한 대안을 재도입하거나 결정을 번복한 것이 아니다. 코드 주석 자체가 "top-level `code` 를 특화 코드로 교체하는 선례도 7건 있으나, 이 자리는 spec 이 이미 `code`/`details.code` 두 층으로 나눠 적었으므로 그 서술을 그대로 실현한다"고 명시하며, 표현 방식 통일(예: 전역 관례로 승격할지)은 planner 항목으로 별도 등재해 이번 PR 범위에서 임의로 결정하지 않았다 — 이는 오히려 "결정의 무근거 번복" 을 피하는 바람직한 처리다.
- 제안: 없음 (연속성 위반 아님). 다만 "top-level `code` 교체 vs `details.code` 분리" 라는 두 패턴이 저장소에 공존한다는 사실 자체는 이미 planner 트래커에 등재됐다고 코드 주석이 밝히고 있으므로, 그 등재가 실제로 `plan/in-progress/**` 에 존재하는지는 이번 세션 범위 밖에서 별도 확인 권고.

### [INFO] `WorkspaceMemberDto.joinedAt` 신설 — spec/2-navigation 에 대응 Rationale 없음(신규 필드, 번복 아님)

- target 위치: (참조) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
- 과거 결정 출처: 해당 없음 — `spec/2-navigation/9-user-profile.md`·`6-config.md` 의 `## Rationale` 어디에도 `joinedAt`/멤버 목록 응답 형태에 대한 기존 결정이 없음(확인: grep 0건).
- 상세: 이번 diff 는 `GET /api/workspaces/:id/members` 응답에 항상 존재하는 `joinedAt: string | null` 필드를 DTO 에 처음 선언한 것으로, 프런트엔드가 이미 그 값을 소비 중이던 wire 를 문서화(선언)한 것이다. 값 자체(§5.4 "상시 키 존재 + nullable" 기본형 적용)는 `spec/5-system/2-api-convention.md` 의 절대-부재 표현 규약과 부합하며, `spec/2-navigation` 영역의 기존 Rationale 과 충돌하지 않는다.
- 제안: 없음.

### 검토했으나 이상 없음 — 트리거 R-4/R-14/R-16 영역 무변경

- `PATCH /api/triggers/:id { isActive }` 단일 경로(R-4), drawer read-only 배지(R-16), `authConfigId` 단일 인증 바인딩·인라인 인증 필드 제거(R-14), Chat Channel `botToken`/`inboundSigning` single-path 정책(§2.3.1 행) 관련 코드·문자열(`toggle`, `authType`, `hmacSecret`, `bearerToken`, `hmacHeader`, `/auth/rotate-secret`)을 diff 전체에서 검색했으나 **0건** — 이번 PR 은 이 Rationale 들이 지키는 결정 표면을 건드리지 않았다.
- `workflow-versions`/`workspaces` 관련 변경은 `spec/2-navigation` 이 아니라 주로 `spec/3-workflow-editor`(버전 히스토리)·`spec/5-system/1-auth.md`(RBAC/감사) 축의 관심사이며, 그쪽에서도 기존 문서 서술을 뒤집는 대신 **런타임 값이 선언 타입보다 좁던 기존 취약점을 좁히는 방향**(엔티티 전체 노출 → 3필드 투영)이라 "합의된 원칙 위반" 에 해당하지 않는다.

## 요약

이 브랜치(`user-entity-column-defense`)는 `spec/2-navigation/` 문서 자체를 변경하지 않았고, 실제 코드 변경도 그 영역의 Rationale(R-1~R-16, 스케줄 sort/order 등)이 지키는 결정 표면(단일 API 경로, 인증 바인딩 모델, chat channel single-path 정책 등)과 대부분 직교한다. 유일하게 접점이 있는 트리거 409 충돌 처리 변경은 `2-trigger-list.md` 가 이미 서술해 둔 계약을 실제로 구현한 것으로, 기각된 대안의 재도입이나 근거 없는 번복이 아니라 오히려 "문서한 보장이 구현보다 넓었던" 상태를 정합화한 것이다. `WorkspaceMemberDto.joinedAt` 신설도 대응하는 기존 Rationale이 없는 순수 추가라 연속성 위반 소지가 없다. 종합적으로 Rationale 연속성 관점에서 이번 diff 가 spec/2-navigation 의 기존 합의를 훼손하는 지점은 발견되지 않았다.

## 위험도

NONE
