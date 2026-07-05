# 변경 범위(Scope) Review — V-04 folder depth/cycle guard

## 검토 대상 요약

13개 파일: 코드 3개(`folders.controller.ts`, `folders.service.ts`, `folders.service.spec.ts`), spec 문서 2개(`spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`), 나머지 8개는 `review/consistency/2026/07/05/14_08_56/` 하위 신규 산출물(`--impl-prep` 실행 결과: SUMMARY/meta/5개 checker 리포트/`_retry_state.json`).

작업 의도(SUMMARY.md 및 cross_spec.md 에 명시): `FoldersService.update()` 의 `parentId` 변경 경로에 계층 무결성 검증(같은 워크스페이스·비순환·최대 깊이 5)을 추가하고, `getDepth()` 에 방문 집합 가드를 추가해 손상 데이터에서의 무한 루프를 방지하는 것 (spec-code-cross-audit 잔여 항목 V-04).

## 발견사항

- **[INFO]** consistency-check 산출물(review/consistency/**)이 코드 리뷰 changeset 에 포함됨
  - 위치: `review/consistency/2026/07/05/14_08_56/*` (파일 4~11, 8개)
  - 상세: 이 파일들은 실제 기능 코드가 아니라 CLAUDE.md §Skill 체계가 의무화하는 `developer` 워크플로 사전 단계(`consistency-check --impl-prep`)의 산출물이다. 프로젝트 규약상 "구현 착수 직전 consistency-check --impl-prep 의무" + "일관성 검토자 쓰기 권한 = review/consistency/**" 이므로, 이 산출물이 같은 PR/커밋 changeset 에 포함되는 것은 의도된 절차이지 스코프 이탈이 아니다. 다만 변경 범위(Scope) 리뷰어 관점에서는 "코드 변경"과 "리뷰 프로세스 산출물"이 하나의 diff 로 섞여 있어, 순수하게 "요청된 코드 변경"만 놓고 보면 더 큰 surface 로 보일 수 있다는 점을 기록해 둔다.
  - 제안: 실질 문제 아님. 프로젝트 표준 워크플로에 부합하므로 조치 불필요.

- **[INFO]** `getDepth()` 방어 로직 강화가 "요청된 갭"의 일부인지 확인
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:88-90` (`visited` Set + `depth > MAX_NESTING_DEPTH + 1` 상한 추가)
  - 상세: `getDepth()` 는 기존에 `create()` 경로에서만 쓰이던 헬퍼였으나, 이번 변경으로 `validateParentChange()` 에서도 재사용된다. 순환 방지 가드 추가는 "cycle 은 getDepth 무한루프 유발" 이라는 diff 내 주석과 SUMMARY.md 착수 계획 3번("getDepth() 무한루프 가드")에 명시적으로 포함된 작업이므로 요청 범위 내다. `create()` 경로 자체의 동작 변경(신규 폴더 생성 시 깊이 계산 결과)은 없다 — 가드는 오직 "이미 손상된 parentId 체인" 케이스에서만 발동하므로 정상 동작에 회귀 위험이 없다.
  - 제안: 스코프 이탈 아님. 정보 기록용.

- **[INFO]** spec 문서 2건 수정은 코드 변경과 1:1 대응
  - 위치: `spec/1-data-model.md §2.5`, `spec/2-navigation/1-workflow-list.md §3.1`
  - 상세: 두 spec 수정 모두 이번에 구현한 검증 로직(동일 workspace·비순환·깊이 5)을 문서에 반영하는 최소 문구 추가이며, cross_spec.md 가 "code-only 로 명시됐으나 문서 동기화가 바람직하다"고 권고한 항목과 정확히 일치한다. 새로운 요구사항이나 무관한 섹션 수정은 없다.
  - 제안: 없음.

- **[INFO]** 컨트롤러 diff는 Swagger 설명 문구 한 줄만 변경
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:95-98` (`@ApiOperation` description)
  - 상세: `update()` 핸들러 로직·데코레이터 구성 자체는 변경 없음. 새로 추가된 검증 동작을 API 문서에 설명하는 문구만 확장됐다. `@ApiBadRequestResponse` 등 다른 데코레이터는 그대로다(리뷰어 참고: consistency 산출물의 INFO 에서 이 비대칭을 별도로 지적했으나, 이는 spec-coverage 관점 지적이지 이번 diff 의 스코프 이탈은 아니다).
  - 제안: 없음.

- **[INFO]** 테스트 추가분은 신규 로직 커버리지에 정확히 대응
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts` (`describe('update — parentId 재검증 (V-04)')`)
  - 상세: 8개 케이스(rename-no-revalidate, self-parent cycle, cross-workspace/nonexistent parent, descendant cycle, depth 초과, root 이동 허용, 정상 shallow reparent, cyclic parent chain 종료)가 모두 `validateParentChange`/`getDepth` 변경분에 직접 대응한다. 기존 `create` depth 테스트 등 무관 영역 수정은 없음(`describe('create', ...)` 블록은 diff 대상 아님 — 컨텍스트에는 보이지만 unchanged).
  - 제안: 없음.

- 리팩토링/포맷팅/주석/임포트/설정 관점: 해당 사항 없음. `folders.controller.ts` 는 import 변경 없음, `folders.service.ts` 는 신규 private 메서드 2개(`validateParentChange`, `collectSubtree`) 추가 외 기존 코드 스타일 변경 없음, 공백/줄바꿈만 바뀐 hunk 없음.

## 요약

diff 는 "V-04: FoldersService.update() parentId 재부모화 시 계층 무결성 검증 추가" 라는 단일하고 명확한 목표에 정확히 대응한다. 코드 3파일(컨트롤러 Swagger 문구·서비스 신규 검증 로직·서비스 테스트)과 spec 문서 2파일(문서화 동기화) 모두 같은 의도의 직접적 파생물이며, 무관한 리팩토링·기능 확장·포맷팅 변경·불필요한 주석/임포트 변경은 발견되지 않았다. `review/consistency/**` 산출물 8개가 changeset 에 포함된 것은 프로젝트 CLAUDE.md 가 의무화한 `--impl-prep` 사전 검토 절차의 표준 산출물이므로 범위 이탈이 아니라 정상 워크플로 흔적이다. 전반적으로 매우 타이트하게 스코프가 지켜진 변경이다.

## 위험도

NONE
