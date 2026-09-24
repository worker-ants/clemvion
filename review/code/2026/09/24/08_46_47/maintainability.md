# 유지보수성(Maintainability) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정 (2라운드)

이번 라운드는 직전 리뷰(`review/code/2026/09/24/08_09_57`)의 WARNING 6건이 실제로 어떻게
조치됐는지까지 포함한 diff다. 조치 내역(`RESOLUTION.md`)과 실제 코드를 대조해 회귀 여부를
확인했다.

## 발견사항

- **[INFO]** 직전 라운드 WARNING 6(재진입 락 오케스트레이션 2번째 복제)은 헬퍼로 뽑지 않고
  트래커 등재로 갈음했다 — 새 결함이 아니라 확인 사항으로 기록한다.
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (`it('제거 중 대상이 owner 로 승격되면 지우지 않고 403 이다', ...)` 블록, 209행부터) vs `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` (동일한 `BEGIN → FOR UPDATE → 발사 → 공허성가드 → mutate → COMMIT → finally ROLLBACK+드레인` 구조)
  - 상세: `BEGIN`/`FOR UPDATE`/공허성 가드/`COMMIT`/`finally` 드레인 순서가 두 파일에 손으로 복제돼 있다. 다만 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4951행 항목)에 "세 번째 자리가 생기면 그때 뽑는다"는 임계값과 후보 이름(`reenterUnderHeldLock`)까지 숫자로 고정해 등재했고, 지금(둘뿐) 뽑으면 파라미터화 비용이 공유 이득보다 크다는 근거(#1377의 `raceUnderHeldLock` 설계 판단 인용)도 함께 남겼다. 판단을 다음 사람에게 미루지 않고 조건까지 명시했으므로 결함으로 보지 않는다.
  - 제안: 조치 불요 — 세 번째 자리가 실제로 생길 때 재확인.

- **[INFO]** 단위 테스트 두 블록이 구조적으로 거의 동일하다 — `targetOnReread.role` 값 하나만 다르고 나머지 6줄이 동일하다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1561`(`'DELETE 시점에 대상이 owner 로 승격됐으면 403 이고 감사가 없다'`)와 `:1589`(`'재조회가 강등된 행을 봐도 403 이다 — 막은 것은 owner 였다'`)
  - 상세: 둘 다 `wireFindOne(..., { ...role: 'owner' | 'admin' })` → `delete` 0-affected → `403 CANNOT_REMOVE_OWNER` 단언으로 몸체가 사실상 동일하다. 형식적 DRY 기준으로는 `it.each([['owner'], ['admin']])` 로 합칠 수 있는 후보다. 다만 인접 JSDoc(1581~1588행)이 "이 블록이 «재조회의 role 을 본다» 로 되돌리는 편집을 죽인다"고 명시적으로 밝히듯, 두 블록은 서로 다른 뮤턴트(옛 분기 형태 `still?.role === 'owner'` 복귀)를 겨냥해 의도적으로 분리돼 있고 같은 파일의 다른 대조군(1605행 근방 `it.each([[undefined], [null]])`)과 달리 이 둘은 "죽이는 대상"이 이름 있는 개별 뮤턴트라 합치면 그 표적성이 흐려진다.
  - 제안: 현행 유지 권장. 굳이 통합한다면 뮤턴트별 코멘트를 `it.each` 의 각 케이스 설명에 그대로 옮겨야 정보 손실이 없다.

- **[INFO]** `removeMember()` DELETE 문 앞 인라인 주석(24행, 830~853행)이 메서드 JSDoc(802~809행)의 "동시성 보장" 요약과 내용이 겹친다 — JSDoc 은 요약, 인라인은 메커니즘 상세(EvalPlanQual)와 타 모듈(§8) 비교라 완전 중복은 아니지만, 둘 다 "왜 락을 새로 안 들이는가"를 설명한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:802-809`(JSDoc) 및 `:830-853`(DELETE 앞 인라인 주석)
  - 상세: 실행 코드는 5줄(854~858행)인데 그 앞 주석이 24줄이라 함수 본문을 눈으로 훑을 때 실제 흐름(가드 → DELETE → 0-분기 → 감사)을 찾기 전에 긴 서술을 통과해야 한다. 다만 이 저장소는 같은 층위의 다른 헬퍼(`concurrency.ts` 의 `raceUnderHeldLock`, `VACUITY_GUARD_MS` 등)에서도 동일하게 근거·선례·기각 사유를 인라인에 남기는 것이 확립된 컨벤션이라(예: `review/code/2026/07/17/...` 류 인용이 저장소 전역에 수십 건), 이 파일만의 이례적 편차는 아니다 — 일관성 위반은 아니다.
  - 제안: 조치 불요. 다만 이후 이 메커니즘(EvalPlanQual 근거)이 바뀌면 JSDoc·인라인 주석·`plan/in-progress/member-owner-toctou.md` §B 세 곳을 동시에 갱신해야 한다는 점만 인지하고 있을 것.

## 확인한 양호 사항

- `throwCannotRemoveOwner()` 추출(349~360행)은 바로 위 `throwMemberNotFound()` 세 벌 복제 선례를 명시적으로 인용하며 같은 실수를 예방한다 — 좋은 리팩터링 패턴 재사용.
- `removeMember()` 는 74줄로 같은 파일의 `deleteWorkspace`(70줄)·`transferOwnership`(82줄)과 비슷한 크기라 이 diff 로 인한 함수 비대화는 없다. 분기 수(멤버 부재·자가탈퇴 위임·owner 조기가드·0-affected 이유 판별)도 5개 내외로 과도한 순환 복잡도는 아니다.
- `VACUITY_GUARD_MS` export 로 매직 넘버 3중 하드코딩이 해소됐고 `assertGuardBelowKnownTimeouts` 검사 범위 안으로 들어왔다 — 직전 라운드 WARNING 5가 실제로 닫혔다.
- `'owner'` 리터럴은 이 diff 이전부터 파일 전역에서 문자열로 쓰이는 기존 패턴(`ADMIN_ROLES`, 여러 `role === 'owner'` 비교)과 일관되며, 이번 diff 가 새로 매직 스트링을 도입한 것은 아니다.
- `CANNOT_REMOVE_OWNER` 에러 코드 정의는 `throwCannotRemoveOwner()` 한 곳뿐이고 테스트는 문자열 리터럴로만 참조한다 — 중복 정의 없음.
- 워크트리 오염 없음: 이번 리뷰는 `Read`/`grep`/`git status` 로만 확인했고 저장소 파일을 수정하지 않았다(`git status --short` 확인 완료, 세션 시작 시점과 동일).

## 요약

이번 diff 는 직전 유지보수성 리뷰의 WARNING 6건 중 5건(CHANGELOG, 권한순서 서술, 제3상태 분기, 테스트 오염, 매직넘버 export)을 코드로 고쳤고 나머지 1건(재진입 보일러플레이트 2번째 복제)은 숫자 임계값과 근거를 갖춘 트래커 등재로 정당하게 유예했다. 새로 도입된 헬퍼 추출(`throwCannotRemoveOwner`)은 기존 패턴을 재사용해 일관성이 높고, 함수 길이·분기 수·네이밍 모두 이 파일의 기존 규모와 부합한다. 남은 관찰 사항은 전부 INFO 수준(의도적으로 분리된 근-중복 테스트 블록, 이미 트래커에 등재된 보일러플레이트 중복, JSDoc·인라인 주석의 정보 중첩)이며 저장소의 기존 문서화 컨벤션과 일치해 병합을 막을 사유가 아니다.

## 위험도

LOW
