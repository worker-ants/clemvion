# 요구사항(Requirement) 리뷰 — workflow-version-creator

## 검증 개요

DB 마이그레이션(`V001__initial_schema.sql:258` — `created_by UUID NOT NULL REFERENCES "user"(id)`, `ON DELETE` 절 없음 = `NO ACTION`), 엔티티(`workflow-version.entity.ts` — `createdBy`/`creator` 선언), `User` 엔티티(`name`/`email` 모두 `nullable` 미지정 = NOT NULL), spec(`spec/3-workflow-editor/5-version-history.md` §7.1/§7.2/§8), 프런트엔드 미러(`codebase/frontend/src/lib/api/workflows.ts`, `version-history-panel.tsx`)를 직접 Read/Grep 으로 대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 확인 불필요 — 읽기만 수행).

## 발견사항

- **[INFO]** 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 관련 두 항목이 아직 `[ ]`(미완료)로 남아 있다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1026`(`workflow-versions.service.ts 의 공유 select 6키를 상수로`), `:1032`(`WorkflowVersion*Dto.creator 의 §5.4 금지 조합을 갚는다`)
  - 상세: 이번 PR 의 plan(`plan/in-progress/workflow-version-creator.md`)은 스스로 "트래커의 인접한 두 항목을 한 PR 로 닫는다"고 명시하고 실제로 두 항목의 요구사항을 코드로 충족했지만(`VERSION_METADATA_SELECT` 상수화, `creator`/`changeSummary` §5.4 기본형 전환), 트래커 파일 쪽 체크박스는 아직 `[x]` 로 바뀌지 않았다. 같은 plan 의 체크리스트에도 `- [ ] 트래커 두 항목 닫기`로 남아 있어 self-consistent 하다 — 즉 developer 도 이 단계가 아직 안 끝났다는 것을 알고 있다.
  - 제안: 코드 결함은 아니다. `--impl-done` 이전 마무리 커밋에서 트래커 두 항목을 `[x]` 로 닫고 완료 각주(프런트엔드 미러 미변경 결정 등, plan 의 INFO 4 처분과 동일)를 남길 것. 이번 리뷰의 진행을 막을 사유는 아니다.

- **[INFO]** `spec/3-workflow-editor/5-version-history.md` §7.2 의 기존 spec 이격(응답 타입명 `WorkflowVersion` vs 실제 `WorkflowVersionDto`, `## Rationale` 섹션 부재)은 이번 PR 범위 밖의 선행 상태이며, 이미 이 PR 의 `--impl-prep`(`review/consistency/2026/09/26/23_55_27` W1·W2)에서 식별돼 트래커에 planner 항목(`spec-draft-nullable-notation-followups.md:1056`)으로 등재돼 있다.
  - 상세: 재확인 결과 지적 자체는 정확하다 — §7.1 은 `WorkflowVersionListItemDto[]` 로 정확히 DTO 명을 적는데 §7.2 는 엔티티명 `WorkflowVersion` 을 그대로 적어 표기가 형제 섹션과 어긋난다. 다만 이번 PR 코드 변경과는 무관하고 planner 소관으로 이미 라우팅돼 있어 중복 지적할 필요는 없다.
  - 제안: 조치 불필요(이미 추적 중). spec 수정은 project-planner 몫.

## 점검 관점별 확인 결과

1. **기능 완전성**: `WorkflowVersionDto`/`WorkflowVersionListItemDto` 양쪽의 `creator`(`@ApiProperty({ type: () => WorkflowVersionCreatorDto })`, non-optional)·`changeSummary`(`@ApiProperty({ type: String, nullable: true })`, non-optional)가 §5.4 기본형으로 정확히 전환됐고, 두 서비스 메서드(`findByWorkflow`/`findOne`)의 공유 select 6키가 `VERSION_METADATA_SELECT` 상수로 추출돼 있다. 완전하다.
2. **엣지 케이스**: `creator` 는 DB 제약(`created_by NOT NULL REFERENCES user(id)`, `ON DELETE` 없음)상 항상 존재 — null/undefined 케이스가 실제로 발생할 수 없음을 마이그레이션 파일로 직접 확인했다. `changeSummary` 는 컬럼이 `nullable: true` 라 null 케이스가 실재하며 DTO 도 그렇게 선언한다.
3. **TODO/FIXME**: 변경분에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음 — 주석("항상 실린다 — `created_by` 가 NOT NULL REFERENCES...")이 실제 마이그레이션·엔티티와 line-level 로 일치함을 확인했다.
5. **에러 시나리오**: `findOne` 의 `NotFoundException` 경로, `createVersion` 의 `ConflictException` 경로 모두 변경 없음 — 회귀 없음.
6. **데이터 유효성**: 해당 없음(응답 스키마 선언 변경, 입력 검증 로직 변경 없음).
7. **비즈니스 로직**: spec §7.1 표(`id·workflowId·version·changeSummary·createdBy·createdAt·creator` 모두 "포함")와 구현이 일치. §9 의 `change_summary` NOT NULL 예외 없음(nullable 허용)과도 일치.
8. **반환값**: `findByWorkflow`/`findOne` 반환 타입(`WorkflowVersionListItem[]`/`WorkflowVersionDetailProjection`) 변경 없음, DTO 매핑도 실제 select 결과와 일치.
9. **spec fidelity**: `spec/3-workflow-editor/5-version-history.md` §7.1 표와 완전히 일치(위 INFO 항목 제외 — 무관한 기존 이격). 마이그레이션·엔티티 대조로 `creator` required, `changeSummary` nullable 선언이 런타임과 정확히 일치함을 실측 확인했다.

## 테스트 커버리지 평가

- 단위: DTO 선언 캐너리(`workflow-version-response.dto.spec.ts`), 공유 select 대칭 단언(`workflow-versions.service.spec.ts`), 래칫(`swagger-dto-contract.spec.ts` 4행 제거)이 각 축을 분리해서 고정한다.
- e2e: `workflow-crud.e2e-spec.ts` H 케이스가 목록·상세 양쪽에 이름 기반(`expectNoUserSecrets`) + 선언 기반(`assertMatchesContract`) 이중 축을 걸고, `creator` 3필드 양성 고정까지 포함한다. `assertMatchesContract`(`response-contract.ts`)는 `$ref` 를 재귀 해소하므로 `WorkflowVersionCreatorDto` 중첩 required 필드까지 검증된다.
- 뮤테이션(plan 기재 M1~M5, 단위 330건/e2e 413건) 결과 5개 전부 KILLED — 다만 M5 는 예측한 축(계약 대조)이 아니라 `expectNoUserSecrets` 이름 축이 먼저 죽였다고 plan 에 정직하게 기록돼 있다. 이 사실 자체가 결함은 아니지만, "계약 대조가 `creator` 부재를 잡는다"는 기대는 테스트 실행 순서상 검증되지 않은 채로 남아 있다 — 순서를 바꿔 계약 대조가 먼저 죽는지도 별도로 확인하면 더 강한 증거가 되겠으나, 현재도 방어 자체는 실효성 있게 작동(이름 축으로 KILLED)하므로 이는 개선 여지일 뿐 결함이 아니다.

## 요약

`workflow-versions` 버전 응답 DTO 의 `creator`/`changeSummary` 를 §5.4 금지 조합(optional+nullable)에서 기본형(required 참조 / required-nullable 값)으로 좁히는 변경이며, DB 제약(`NOT NULL REFERENCES`, `ON DELETE` 없음)과 엔티티·서비스 select 투영을 직접 대조한 결과 선언이 런타임과 정확히 일치한다. 공유 `select` 6키의 `VERSION_METADATA_SELECT` 상수화도 두 조회의 발산을 막는 정당한 리팩터다. 관련 spec(`5-version-history.md` §7.1)과 line-level 로 일치하며, 단위·e2e·래칫 3중 방어가 각 축(선언 캐너리/실제 값 대조/이름 기반 비밀 노출)을 분리해서 고정하고 있어 회귀 방지력이 충분하다. CRITICAL/WARNING 급 결함은 발견되지 않았고, 트래커 체크박스 미동기화만 plan 위생 차원의 INFO 로 남는다.

## 위험도

LOW
