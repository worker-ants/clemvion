# 요구사항(Requirement) 코드 리뷰

## 사전 확인

이 배치(B-1~B-8)는 이미 3라운드의 `/ai-review`(`12_53_08`·`13_34_28`·`14_01_56`, 각 라운드
RESOLUTION.md 동반, Critical 0 유지)와 3회의 `--impl-done`/1회의 `--impl-prep` consistency
check 를 거쳤다. 프롬프트 번들의 상당 부분(파일 27~110)은 그 라운드들의 산출물 자체가
커밋된 것이라 이번 리뷰의 1차 대상이 아니다 — 실제 기능 변경은 파일 1~23(`.claude/test-stages.sh`,
`PROJECT.md`, `CHANGELOG.md`, backend/frontend 소스 20개, `scripts/*typecheck-ratchet.py`)이다.
이 리뷰는 그 실제 코드 변경을 워킹트리에서 직접 `Read`/`grep` 으로 재확인하고, 기존 3라운드가
이미 다룬 항목은 재론하지 않는다.

핵심 로직 재검증 결과:
- `pg-error.ts`(`isPostgresUniqueViolation`/`pgErrorConstraint`)와 `http-exception.filter.ts`
  의 분기 순서(`HttpException` → `isPostgresUniqueViolation` → `Error`)를 직접 열어 확인 —
  raw 표면·wrapped 표면 모두 정확히 처리하고, `null`/비-`Error` throw 등 엣지 케이스도
  기존 default(500/`INTERNAL_ERROR`)로 안전하게 떨어진다.
- `workspaces.service.ts` 의 `listMembers` `select` 투영(`id, userId, role, joinedAt,
  user:{id,email,name}`)이 실제 반환 매핑(6키)과 정확히 대응함을 확인. `spec/1-data-model.md
  §2.1.1`(민감 7컬럼)·`## Rationale`(2026-09-06, `select:false` 기각 사유)과 코드 주석이
  인용하는 내용이 line-level 로 일치한다.
- `endpoint-path-conflict-wrap-guard.ts` + 소비 spec 을 `triggers.service.ts` 실제 소스와
  대조 — 예상 wrapped 목록(`create`/`update`)·unwrapped 목록(6개 키, `promoteRotated…` 의
  `#2` 포함)이 실제 `triggerRepository.save()`/`scheduleRepository.save()` 호출 부위와
  1:1 로 정확히 일치한다(라인 832/1163/1211/1445/1476/1527, `create`/`update` 의
  `const saved = await …save(…).catch(rethrowEndpointPathConflict)` 형태 포함).
- `webhook-trigger.e2e-spec.ts` B4 케이스가 단언하는 `{code:'RESOURCE_CONFLICT',
  details:{field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}}` 는
  `triggers.service.ts:1607`(`rethrowEndpointPathConflict`)의 실제 throw 형태 및
  `spec/5-system/3-error-handling.md` L234·L238(§1.10 카탈로그)과 정확히 일치.
- `tsconfig.build.json` 의 `**/__test-utils__/**` exclude 가 실측과 일치 — 저장소 전체에서
  `__test-utils__` 디렉터리 안 비-spec `.ts` 파일이 정확히 5개(`common/` 3 + `modules/
  integrations/` 2)이고, 코드 주석의 "두 곳에 흩어져 있다"는 서술과 부합한다.
- `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 후 저장소 전체에 옛 이름의
  잔존 참조가 0건(grep 확인) — 타입 오류·의도 불일치 없음.

## 발견사항

- **[WARNING]** `listMembers` 를 DB 레벨 `select` 투영으로 전환했는데, 그 안전성 서술의 근거였던
  e2e 스펙 자신의 JSDoc 은 "전부 로드" 하던 옛 구현을 여전히 사실로 서술한다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:590-593` (함수/블록: `it('J. GET
    /:id/members — 멤버 목록에 \`User\` 비밀 컬럼이 실리지 않는다', …)` 바로 위 JSDoc). 이
    파일은 이번 diff 대상이 아니라 소스 라인 게이트가 없어 `Read` 로 직접 연 실제 줄 번호다.
  - 상세: 이 JSDoc 은 `"GET /:id/members 는 User 를 통째로 로드하는 세 자리 중 하나다"`,
    `"WorkspacesService.listMembers 가 relations:['user'] 로 멤버의 User 엔티티를 전부
    싣고, 지금은 email·name 만 뽑아 새 객체로 돌려준다"` 라고 적고 있다. 이번 배치(B-4)가
    바로 그 `listMembers` 를 DB 레벨 `select` 투영(`workspaces.service.ts:213-232`)으로
    바꿨으므로 이 문장은 더 이상 사실이 아니다 — 이제는 `User` 전체가 로드되지 않고 처음부터
    3컬럼만 온다. 같은 PR 이 정확히 이 이유로 자매 파일 두 곳(`workspaces.service.spec.ts`
    L1123-1134, `user-entity-exposure.spec.ts` L79-98)의 JSDoc/주석을 명시적으로 정정했는데,
    "안전망은 e2e `workspace-rbac` J. 뿐" 이라고 예전부터 지목되어 온 바로 이 e2e 파일
    자신의 JSDoc 은 갱신에서 빠졌다. `git log` 로 확인한 결과 이 파일은 `#1292`(2026-09-08
    이전) 이후 이번 배치에서 전혀 건드려지지 않았다 — 즉 이번 diff 가 만든 stale 이다.
    기능적 결함은 아니지만(테스트 자체는 여전히 통과하고 유효한 방어선을 검증한다), 이
    문서가 "지금 유일한 방어선은 JS 매핑뿐" 이라는 인상을 남겨, 다음 사람이 이 JS 매핑을
    넓히는 변경의 위험도를 실제보다 높게(또는 DB 투영이라는 이미 존재하는 방어선을 모른 채)
    오판할 수 있다 — 이 저장소가 반복 기록해 온 "orphaned/stale docstring" 클래스와 같다.
  - 제안: 이 JSDoc 의 "전부 로드" 서술을 `workspaces.service.spec.ts`/
    `user-entity-exposure.spec.ts` 와 같은 방식(취소선 + `> 정정 (2026-09-08)`)으로 갱신해
    "이제 DB 레벨 `select` 투영이라 애초에 3컬럼만 로드되고, 이 e2e 는 그 투영이 넓어지거나
    JS 매핑이 실수로 필드를 늘릴 때를 잡는 두 번째 방어선"이라고 정정한다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts` 의 `isWrappedByConflictCatch` 가 부모
  체인을 타고 올라가며 첫 `.catch(...)` 를 찾는 방식이라, `Promise.all([...triggerRepository
  .save(x)]).catch(cb)` 형태(배열/다른 콤비네이터 경유)가 있으면 그 `save()` 호출을 실제로는
  콜백이 개별 실패를 감싸지 않는데도 "래핑됨" 으로 오분류할 여지가 이론상 있다(fail-open
  방향)
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    함수 `isWrappedByConflictCatch`(정확한 줄은 이번 diff 의 신규 파일이라 게이트가 없어
    함수명으로 기재 — `Read` 로 열람한 파일 기준 88~104행)
  - 상세: 이 가드는 스스로를 "좁고 눈먼 술어" 로 명시하고(`review/code/2026/09/08/12_53_08`
    W1 대응 이후) `destructuring` 별칭 등 다른 사각지대는 이미 defer 로 트래커에 등재돼
    있다(`review/code/2026/09/08/14_01_56/RESOLUTION.md` INFO#4). 저장소 실측상
    `triggerRepository.save()` 는 전부 단독 호출·직접 `.catch()` 체인이고 `Promise.all`
    등으로 감싸는 자리는 0건이라 지금 당장 실피해는 없다. 다만 이 축은 다른 defer 항목과
    달리 "래핑 없음(fail-safe)" 이 아니라 "래핑됨(fail-open)" 방향으로 틀릴 수 있는
    유일한 경로라 성격이 다르다.
  - 제안: 지금 조치 불요 — 실사례가 없고 가드 헤더가 이미 한계를 문서화하는 관례를 따른다.
    다음에 이 가드를 만질 기회에 defer 목록(`14_01_56/RESOLUTION.md`)에 "콤비네이터 경유
    fail-open 가능성" 한 줄만 추가해 두면 향후 재검토가 쉬워진다.

## 요약

배치 B(B-1~B-8)의 실제 코드 변경(파일 1~23)을 워킹트리에서 직접 재확인한 결과, 기능 완전성·
엣지 케이스·에러 시나리오·반환값·spec 일치 여부 모두에서 새로운 CRITICAL 급 결함은 없다.
`pg-error.ts` SoT 통합, `listMembers` DB 투영, 트리거 `endpointPath` 래핑 래칫, 트리거 409
e2e, 타입 개명, `__test-utils__` dist 제외, typecheck ratchet 편입 — 8개 항목 모두 실제
소스와 대조했을 때 주장하는 대로 정확히 동작하고, 관련 spec(`spec/5-system/3-error-handling.md
§1.10`, `spec/1-data-model.md §2.1.1·## Rationale`)과 line-level 로 일치한다. 유일한 실질적
공백은 B-4 가 두 자매 파일(`workspaces.service.spec.ts`, `user-entity-exposure.spec.ts`)의
JSDoc 은 정정했지만, "안전망은 이 e2e 뿐" 이라고 스스로 지목해 온 세 번째 파일
(`workspace-rbac.e2e-spec.ts`)의 JSDoc 은 옛 구현("User 전부 로드")을 그대로 둔 것이다 —
동작 결함은 아니나 이 저장소가 반복 지적해 온 stale-docstring 클래스와 같은 형태이며, 같은
PR 이 이미 두 곳에서 실천한 정정을 세 번째 자리에서 빠뜨린 누락이다. 그 외 하나는 신규 AST
가드의 이론적·미실현 fail-open 경로에 대한 참고성 지적(INFO)이다.

## 위험도

LOW
