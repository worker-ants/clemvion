# RESOLUTION — exec-test-dataset-22 / ai-review 10_39_40

## 오탐 분류 (stale-base 아티팩트)

W-4, W-5, W-9 는 ai-review prepare 시점에 branch 가 origin/main(#610 form-validation 포함) 보다
뒤처진 상태에서 `git diff origin/main..HEAD` 2-dot diff 가 #610 변경을 "삭제" 로 표기한
stale-base 아티팩트다. 재-rebase 완료 후 `git diff origin/main..HEAD --diff-filter=D --name-only`
에 form/review 관련 파일이 전혀 출력되지 않음으로 확인. 코드 수정 없음.

W-1, W-2 (IDOR) 는 서비스 코드가 프롬프트에 생략돼 발생한 오탐.
- list(): `WHERE workflow_id AND workspace_id AND (owner_id=user OR visibility=workspace)` 로
  workspace_id 격리 + 내 것/공유본 필터 동시 적용.
- update/remove/clone: `findAccessible(id, workspaceId, userId, requireOwner)` 가
  `findOne({where:{id, workspaceId}})` 로 workspace 격리 후 ownerId 검사 및 visibility 가시성
  검사를 수행. 비소유 private 는 404 로 존재 은닉.
- e2e `workflow-test-dataset.e2e-spec.ts` 케이스 D(타 유저 PATCH 403·private clone 404) 와
  E(cross-workspace 403/404) 가 통과하여 IDOR 차단 입증.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 오탐 (IDOR) | — | findAccessible + e2e D/E 통과로 격리 입증 (서비스 코드 프롬프트 생략 오탐) |
| W-2 | 오탐 (IDOR) | — | 동일 사유 (clone 은 findAccessible requireOwner=false 로 가시성 검사) |
| W-3 | 코드 (JSDoc) | 60635810 | copyName JSDoc 을 "충돌 시 409 DUPLICATE_NAME 반환, 재시도 클라이언트 책임" 으로 수정 |
| W-4 | 오탐 (stale-base) | — | 재-rebase 후 --diff-filter=D 0건 확인 |
| W-5 | 오탐 (stale-base) | — | 동일 사유 |
| W-6 | 코드 (API) | 60635810 | list() 쿼리에 .take(200) 방어 상한 + 코드 주석 추가 |
| W-7 | 코드 (Swagger) | 60635810 | clone 핸들러에 @ApiConflictResponse({ description: '동일 이름 복제본 이미 존재 (DUPLICATE_NAME)' }) 추가 |
| W-8 | 코드 (user-guide) | 60635810 | running-a-workflow.{mdx,en.mdx} 에 "테스트 데이터셋" 섹션 신설 (KO/EN 동등) |
| W-9 | 오탐 (stale-base) | — | 동일 사유 |
| I-13 | 코드 (문서화) | 60635810 | service.update JSDoc 추가, UpdateDto.input description 보강 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6972 passed, 1 skipped — 사전 면제된 슬롯 포함)
- e2e   : 통과 (198/198, 34 suites — workflow-test-dataset.e2e-spec.ts 포함)

## 보류·후속 항목

- I-1 (JSONB 페이로드 크기 제한): INFO 수준 — 글로벌 Body Size Limit 기존 설정 재확인 후 필요 시 follow-up
- I-2 (PATCH/DELETE 소유자 검증): INFO — findAccessible requireOwner=true 코드 확인 완료, 검증됨
- I-3 (assertWorkflow 이중 쿼리): INFO / 성능 — 현 규모 무시, 장기 follow-up
- I-4 (list input 컬럼 전체 조회): INFO — W-6 take(200) 으로 부분 완화, 장기 목록 DTO 분리 follow-up
- I-5 (모듈 경계 묵시적 결합): INFO / 아키텍처 — 장기 부채, 즉시 필수 아님
- I-6 (TestDatasetVisibility 중복 정의): INFO / 아키텍처 — 공유 패키지 장기 이전
- I-7 (엔티티 속성/컬럼명 불일치): INFO — TransformInterceptor 근본 개선 장기 부채
- I-8 (EditorToolbar 850+ 줄): INFO / 유지보수성 — 기존 부채, 장기 서브컴포넌트 분리
- I-9 (컨트롤러 단위 테스트 부재): INFO — 장기 controller.spec.ts 추가
- I-10 (e2e update/remove happy-path): INFO — defer
- I-11 (frontend clone/delete UI 테스트): INFO — defer
- I-12 (list() 인덱스 매칭): INFO / DB — EXPLAIN ANALYZE 후 필요 시 복합 인덱스 추가
- I-14 (list 응답 래핑 일관성): INFO — TransformInterceptor 동작 확인 후 Swagger 수정 follow-up

## 후속 주의사항

fix commit(60635810) 이 review stale 화 발생 → main 이 fresh /ai-review 1회 더 필요
(`--branch main` 으로 재실행하여 clean 확인).
