# 테스트(Testing) 리뷰 — model-config 동시 삭제 중복 감사 수정

## 검증 방법

`codebase/backend/src/modules/model-config/model-config.service.spec.ts`,
`model-config.service.ts`, `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts`
를 직접 `Read`/`Grep`으로 열람했다. 형제 패턴(`auth-config-delete-concurrency.e2e-spec.ts`)과
1:1 대조했고, `model-config.controller.spec.ts`가 `service.remove`(메서드명 자체는 불변)를
목킹하는 지점이라 이번 내부 구현 전환(`repo.remove`→`repo.delete`)의 영향권 밖임을 확인했다.
저장소 파일은 수정하지 않았다(`git status --short` 미실행 필요 없음 — 뮤테이션 없이 정적 열람만 수행).

## 발견사항

- **[INFO]** `beforeEach`의 `mockRepo` fixture에 이제 아무도 호출하지 않는 `remove` mock이 남아 있다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:35` (`remove: jest.fn().mockResolvedValue(undefined),`)
  - 상세: `model-config.service.ts`의 `remove()`는 이번 커밋으로 `this.repo.remove(config)` 호출을 완전히 `this.repo.delete({ id, workspaceId })`로 대체했다(`model-config.service.ts:422`, `grep -c "repo\.remove"` = 0). 반면 spec 파일의 `mockRepo.remove` 선언(35번 줄)은 그대로 남아 있고, 파일 전체에서 `mockRepo.remove`를 참조하는 테스트는 0건이다(`grep -n "mockRepo\.remove"` 결과 없음). 실행에 해를 끼치지는 않지만(단순 미사용 mock), 다음에 이 파일을 편집하는 사람이 "여전히 `remove` 경로가 있나?" 오인하게 만들 수 있는 죽은 fixture다.
  - 제안: 34번 줄(`delete` mock) 도입에 맞춰 35번 줄 `remove` 키를 fixture에서 제거해 "이 서비스는 이제 `delete`만 쓴다"는 사실을 mock 형태로도 드러낸다.

## 각 관점별 평가

1. **테스트 존재 여부** — 충분하다. unit(진 쪽 404/감사·통지 억제, `affected` undefined/null 대조군)과 e2e(실제 두 커넥션 경합) 양쪽에 신규 테스트가 추가됐고, 기존 3개 테스트(`toHaveBeenCalled`류)가 새 API(`delete`)를 겨냥하도록 갱신됐다.
2. **커버리지 갭** — 눈에 띄는 갭 없음. `affected: 1`(정상 단일 삭제) happy path는 `beforeEach` 기본 mock으로 기존 다수 테스트가 암묵적으로 덮는다. 워크스페이스 불일치 삭제는 `findEntity`가 이미 그 이전 단계에서 404를 던지므로 이번 diff가 새로 여는 경로가 아니다 — 별도 테스트 불필요가 타당하다.
3. **엣지 케이스 테스트** — 강점. `affected === 0`(진 쪽) vs `affected === undefined|null`(드라이버 미보고)을 `it.each`로 명시적으로 분리해, `!affected`로 회귀했을 때 잡아내는 대조군을 만들었다(주석에 #1371에서 이 대조군 부재로 뮤턴트 32건이 생존했다는 근거를 남김 — 근거가 검증 가능한 형태로 기록돼 있다).
4. **Mock 적절성** — `delete: jest.fn<Promise<DeleteResult>, [unknown]>()`으로 반환 타입을 명시해 `mockResolvedValueOnce`의 파라미터가 좁은 리터럴로 추론되지 않게 막은 점이 실측(타입체크 ratchet) 근거와 함께 주석돼 있다. 실제 TypeORM `Repository.delete()`의 반환 형태(`{ affected, raw }`)와 정확히 일치한다.
5. **테스트 격리** — `beforeEach`가 매 테스트마다 `mockRepo`·`service`를 새로 만들고, `mockResolvedValueOnce`는 각 테스트 인스턴스에 국한되므로 테스트 간 상태 누수 없음.
6. **테스트 가독성** — 각 테스트 상단 주석이 "왜 이 형태인가"(흉내가 허구가 된 이유, 대조군이 막는 회귀)를 명시해 의도가 뚜렷하다.
7. **회귀 테스트** — 기존 `mockRepo.remove`를 겨냥하던 3개 단언(vacuous가 될 뻔한 지점)이 모두 `mockRepo.delete` 겨냥으로 전환됐다. TypeORM `remove(entity)`의 id 파괴를 흉내 내던 `mockImplementation(async () => { delete entity.id; delete entity.kind; })`도 `delete(criteria)` 전환으로 더 이상 유효하지 않은 전제라 제거됐다 — 남겨뒀다면 "위험을 막고 있다"는 착시를 주는 vacuous 테스트가 됐을 것이므로 이 판단은 타당하다.
8. **테스트 용이성** — 서비스가 `Repository<ModelConfig>`를 DI로 주입받아 mock 대체가 쉬운 구조 그대로 유지된다. 신규 로직(`affected` 판정)도 순수 조건문이라 mock 값만 바꿔 분기 테스트가 가능했다.

## e2e 파일 검토

`model-config-delete-concurrency.e2e-spec.ts`는 `auth-config-delete-concurrency.e2e-spec.ts`(직전 형제)와 구조가 사실상 동일하되, 이 모듈 고유의 차이(에러 코드 `MODEL_CONFIG_NOT_FOUND` vs 형제의 `RESOURCE_NOT_FOUND`, 테이블명 `model_config`/액션 `model_config.delete`)를 정확히 반영했다. `isDefault: false`로 생성해 default-swap 트랜잭션 경로와 섞이지 않게 격리한 점, 락 해제 전 `Promise.race`로 "아직 안 끝났음"을 확인하는 공허성 가드(vacuous-guard)도 형제 패턴 그대로 이식돼 있다. 코드 자체를 실행해 e2e를 재현하지는 않았으나(스코프 밖), 정적으로는 형제 7건과 대조해 구조적 결함이 없다.

## 요약

이 변경은 형제 패턴(7건)을 그대로 계승한 8번째 동시성 버그 수정으로, unit 테스트는 뮤테이션 테스트로 실측된 대조군(`affected` 명시 비교 vs falsy 비교)을 갖추고 있고, 기존 테스트 중 API 전환으로 vacuous해질 뻔한 단언들을 정확히 식별해 `delete` mock을 겨냥하도록 갱신했으며 더 이상 사실이 아닌 흉내(entity id 파괴 시뮬레이션)는 근거를 남기고 제거했다. e2e 테스트도 실제 두 DB 커넥션 경합으로 결함을 재현하는 형제 패턴을 정확히 이식했다. 유일한 흠은 `beforeEach` fixture에 남은 미사용 `mockRepo.remove` 선언으로, 실행에는 영향이 없는 인지 부하 수준의 문제다.

## 위험도

LOW
