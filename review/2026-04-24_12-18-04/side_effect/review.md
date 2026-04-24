## 발견사항

### [INFO] `ExploreToolsService` 생성자 시그니처 변경 — DI 이외 직접 생성 코드 영향
- **위치**: `explore-tools.service.ts` 생성자, 62–68번째 줄 (diff 기준)
- **상세**: `executionRepo`, `nodeExecutionRepo` 두 인자가 추가되어 생성자 아리티가 6→8로 늘었다. NestJS DI로 주입받는 production 코드는 `workflow-assistant.module.ts` 의 `TypeOrmModule.forFeature` 등록 추가로 자동 해결되지만, **직접 `new ExploreToolsService(...)` 하는 테스트**가 추가된 인자를 빠뜨리면 런타임 오류(undefined injection)가 발생한다. 이번 변경에 포함된 `explore-tools.service.spec.ts` 는 8개 인자를 모두 넘기므로 문제없으나, 이 서비스를 직접 인스턴스화하는 다른 테스트 파일이 있다면 누락 업데이트 위험이 있다.
- **제안**: CI에서 `grep -r "new ExploreToolsService" --include="*.spec.ts"` 검색으로 누락 파일 없음을 확인.

---

### [INFO] `getCount()` + `.limit(1)` 조합의 실제 동작 확인 필요
- **위치**: `explore-tools.service.ts` — `getExecutionDetails` 내 "2-depth 자손 확인" 블록
- **상세**:
  ```typescript
  const deeperExists = await this.executionRepo
    .createQueryBuilder('e')
    .where('e.parent_execution_id IN (:...childIds)', { childIds: ... })
    .limit(1)
    .getCount();
  ```
  TypeORM의 `getCount()`는 내부적으로 메인 쿼리를 서브쿼리로 래핑해 `SELECT COUNT(1) FROM (...) sub`를 실행한다. `.limit(1)`이 서브쿼리에 포함되면 최적화 의도(최소 1행 존재 확인 후 중단)대로 동작하지만, TypeORM 버전에 따라 `getCount()` 경로에서 LIMIT이 무시되는 경우가 있다. 기능적 정확성(`deeperExists > 0` 판정)은 영향 없으나, 최적화 효과가 보장되지 않을 수 있다.
- **제안**: 최적화가 필요하면 `.limit(1).getMany()` 후 `length > 0` 으로 교체하거나, `getExists()`(TypeORM 0.3.x+) 사용을 검토.

---

### [INFO] `directChildren` 조회에 `take` 제한 없음 — 잠재적 대용량 응답
- **위치**: `explore-tools.service.ts` — `getExecutionDetails` 내 `directChildren` 쿼리
- **상세**:
  ```typescript
  const directChildren = await this.executionRepo.find({
    where: { parentExecutionId: execution.id },
    relations: ['workflow'],
    order: { startedAt: 'ASC' },
  });
  ```
  `take`/`limit` 없이 조회하므로, 루프나 병렬 분기가 많은 실행이 수백 개의 직계 자식 실행을 가질 경우 `Promise.all(directChildren.map(child => loadTimeline(child.id)))` 가 대량의 병렬 쿼리를 발행한다. 일반적인 워크플로 설계에서는 발생하기 어렵지만, 자동화 루프 노드가 sub-workflow를 반복 호출하는 패턴에서는 DoS성 부하가 생길 수 있다.
- **제안**: 직계 자식 수에 합리적인 상한(예: `take: 20`)을 적용하고, 초과 시 `subExecutionsTruncatedDepth` 와 유사한 방식으로 신호하거나 스펙에 상한 명시.

---

### [INFO] `tsconfig.json` — 테스트 파일 빌드타임 타입 체크 제외
- **위치**: `frontend/tsconfig.json`
- **상세**: `*.spec.ts`, `*.test.ts`, `__tests__/**` 가 `exclude` 에 추가되어 Next.js 빌드타임 타입 체크(`tsc --noEmit`) 대상에서 벗어난다. 빌드 오류를 방지하는 의도는 타당하나, 테스트 파일의 타입 오류가 `tsc`로는 감지되지 않고 Jest 실행 시에만 발견된다.
- **제안**: Jest 설정(`tsconfig.jest.json` 또는 `ts-jest` 옵션)이 별도 tsconfig로 테스트 파일을 포함해 타입 검사를 수행하는지 확인. 그렇지 않으면 테스트 파일의 타입 오류가 완전히 누락될 수 있다.

---

### [INFO] `get_execution_details` — `id` 인자 누락 시 빈 문자열 전달
- **위치**: `workflow-assistant-stream.service.ts` — `case 'get_execution_details'`
- **상세**:
  ```typescript
  return this.exploreTools.getExecutionDetails(
    workspaceId,
    currentWorkflowId,
    asString(args.id, ''),
  );
  ```
  LLM이 `id` 없이 도구를 호출하면 `''`가 전달되고, UUID 정규식 검증에서 `INVALID_ID`로 반환된다. 오류를 전파하지 않고 구조화된 에러 객체로 응답하는 것은 올바른 방어적 처리이나, `''`는 명시적 의도를 드러내지 않으므로 `asString(args.id)` (undefined 반환) 후 UUID 검증 실패로 동일 효과를 낼 수도 있다. 현재 동작은 안전하다.

---

## 요약

이번 변경은 전체적으로 **부가적(additive)** 성격이 강하다. 기존 공개 API·전역 상태·파일시스템에 의도치 않은 변경이 없으며, 보안 경계(workspace scope, UUID 검증, 민감 필드 마스킹)는 서비스 레이어에서 일관되게 적용된다. 가장 주목할 부분은 `ExploreToolsService` 생성자 아리티 변경으로, NestJS DI를 통한 운영 코드는 `workflow-assistant.module.ts` 수정으로 자동 해결되지만 직접 생성하는 다른 테스트가 없는지 확인이 필요하다. `directChildren` 무제한 조회와 `tsconfig.json` 에서 테스트 타입 체크 제외는 실용적 결정이나 각각 한계를 인지하고 운영해야 한다.

## 위험도

**LOW**