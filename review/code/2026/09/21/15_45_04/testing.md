# 테스트(Testing) 리뷰 — `AuthConfigsService.remove()` 동시 삭제 이중 감사 수정 (+ 선행 리뷰 15_18_16 후속 조치)

## 검증 방법

`Read` 로 실제 소스(`auth-configs.service.ts`, `auth-configs.service.spec.ts`,
`auth-config-delete-concurrency.e2e-spec.ts`)를 직접 열어 diff 와 대조했고, 저장소 안에서
`npx jest src/modules/auth-configs/auth-configs.service.spec.ts` 를 실행해 현재 51건 전부
GREEN 임을 확인했다. 이어서 plan(`plan/in-progress/authconfig-dup-delete.md`) 체크리스트가
주장하는 두 뮤턴트를 **직접 재현**했다(저장소 밖 scratch 로 원본을 `cp` 백업 후 `sed` 로 뮤테이션
→ jest 실행 → `cp` 로 원복, `git checkout`/`restore` 미사용):

- 뮤턴트 (a) `affected === 0` → `!affected`: 대조군 2건(`it.each([[undefined],[null]])`)이 정확히
  RED — plan 이 예측한 "대조군 2건 RED" 와 일치.
- 뮤턴트 (b) `if (affected === 0) this.throwAuthConfigNotFound();` 라인 통째 제거: 진 쪽 테스트
  1건("진 쪽은 404 RESOURCE_NOT_FOUND...")만 RED — plan 이 예측한 "진 쪽 1건 RED" 와 일치.

두 원복 후 `git status --short` 로 워킹트리 clean 확인(리뷰 종료 시점에도 `review/code/2026/09/21/15_45_04/`
자기 산출물 외 변경 없음). 저장소에 다른 파일 뮤테이션·백업 파일을 남기지 않았다.

## 발견사항

- **[INFO]** mock `delete()` 시뮬레이션이 `workspaceId` 를 무시한다 — cross-tenant negative 테스트는
  이 모듈 전체(`create`/`findById`/`update`/`remove`)에 여전히 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:48-51`
    (`delete: jest.fn(async ({ id }: { id: string }) => { const existed = store.delete(id); ... })`)
  - 상세: `'워크스페이스로 스코프한 원자적 DELETE 를 친다'` 테스트는
    `expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS })` 로 **호출 인자**만 단언한다.
    mock 구현 자체는 `id` 만으로 지우므로 "다른 workspaceId 를 주면 실제로 안 지워진다" 는 행동은
    이 mock 으로 검증 불가능하다(같은 `id` 면 `workspaceId` 값과 무관하게 항상 지워진다). 직전
    리뷰(`review/code/2026/09/21/15_18_16/testing.md` INFO #2)가 같은 것을 지적했고,
    `RESOLUTION.md` 가 "main 지시대로 무조치" 로 명시적으로 유보한 항목이다 — 신규 결함이 아니라
    이 리뷰 라운드에서도 여전히 남아 있음을 재확인한 것. 형제 `integrations.service.spec.ts` 의
    `delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] })` 는 정적 반환이라 오히려 이보다
    덜 현실적이므로, 이 PR 이 유독 뒤처진 것은 아니다(직접 대조 확인).
  - 제안: 조치 불요(기존 관례·이미 유보 확정). 여유가 있으면 `findById`/`remove` 에 대해
    "다른 workspaceId 로는 조회/삭제되지 않는다" 는 최소 1건의 cross-tenant 테스트를 이 모듈
    전체 단위로 추가하는 백로그가 여전히 유효하다.

- **[INFO]** e2e 공허성 가드의 `setTimeout(() => resolve('pending'), 1_500)` 타이머가 정리되지 않음
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts:88-93` (`Promise.race` 블록)
  - 상세: 직전 리뷰(`testing.md` 15_18_16 세션 인용 없음, `SUMMARY.md` INFO #8)가 이미 지적했고
    `RESOLUTION.md` 가 "우선순위 낮음" 으로 무조치 처리한 항목. `pending` 이 먼저 settle 되면
    `setTimeout` 핸들이 `clearTimeout` 되지 않아 Jest `--detectOpenHandles` 진단에서 노이즈가 될
    수 있는 수준이며, 결과(`raced` 판정)에는 영향 없다.
  - 제안: 조치 불요. 다음에 이 e2e 계열(8·9번째 자리)을 공용 헬퍼로 추출할 때 함께 정리할 것.

## 긍정적으로 확인된 것 (재검증)

- **회귀 커버리지 4건이 `remove()` 의 모든 분기를 닫는다**: 정상 삭제(스코프 단언 포함) · 경합
  패자(404, 감사 미기록) · 대조군 2건(드라이버 미보고 `undefined`/`null` → 정상 삭제 취급) ·
  대상 부재(사전 `findById` 에서 조기 종료, `delete` 미호출). `it.each` 분기까지 포함해 51개
  전체 테스트가 GREEN 이고, 위에서 직접 재현한 두 뮤턴트가 각각 정확한 개수(2건/1건)로 RED
  되는 것을 확인했다 — plan 의 "뮤턴트 예측과 일치" 주장이 지어낸 근거가 아니라 실측이다.
- **직전 리뷰의 실질 지적 2건이 이번 diff 에서 실제로 고쳐졌다**: 죽은 `remove: jest.fn(...)` mock
  필드 제거, 미존재 대상 테스트의 no-op `mockClear()` 제거 — 둘 다 현재 spec 파일에서 부재함을
  직접 `Read` 로 확인.
- **타입 안전성**: mock `delete` 반환 타입을 `Promise<DeleteResult>` 로 명시해 대조군의
  `affected: null|undefined` 캐스트가 `mockResolvedValueOnce` 파라미터 타입에 실제로 대입되는지
  검증했다(주석의 "타입체크 ratchet 실측" 주장과 일치 — 이 시그니처를 되돌리면 `tsc` 가 캐스트를
  거부하는지까지는 별도 확인하지 않았으나, 현재 시그니처로 51건 GREEN·타입 오류 없음은 확인).
- **테스트 격리**: `beforeEach` 마다 `makeAuthConfigRepo()` 로 `store: Map` 을 새로 생성 — 테스트 간
  상태 누수 없음. e2e 는 `uniqueEmail`/`uniqueName` 로 fixture 충돌을 피하고 `db`/`locker` 두
  커넥션을 `afterAll` 에서 명시적으로 `end()`, `finally` 블록이 `ROLLBACK`/`pending` 양쪽을
  `.catch(() => undefined)` 로 흡수해 unhandled rejection 여지가 없다.
- **e2e 판별력**: `SELECT ... FOR UPDATE` 로 실제 겹침을 만들고 락 해제 **전** `Promise.race` 로
  "아직 안 끝났음" 을 관측하는 공허성 가드가 있어, 겹침을 만들지 못하는 vacuous e2e 를 스스로
  방지한다. 상태쌍을 정렬(`sort`) 후 `[204, 404]` 단언 + 진 쪽 `code` 별도 단언이라 응답 도착
  순서에 flaky 하지 않다. `test/jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 가 신규 파일을
  자동 수집함을 확인(별도 등록 불요).
- **가독성**: `seed()` 헬퍼로 반복 축소, 각 테스트 주석이 "무엇을 왜" 단언하는지 명시(특히
  대조군 테스트가 "#1371 에서 같은 뮤턴트가 32건 통과했다" 는 회귀 배경을 코드 옆에 남긴 것).

## 요약

이 diff 는 동시 삭제 이중 감사 결함(형제 클래스 일곱 번째 자리)의 회귀 테스트를 정상/패자/대조군
2건/사전확인까지 빠짐없이 커버하고, 직전 리뷰(15_18_16)의 테스트 관점 지적 중 실질 코드 지적 2건
(죽은 mock 필드, no-op mockClear)은 이번 diff 에서 실제로 제거됐음을 확인했다. plan 이 주장하는
뮤턴트 킬 결과(대조군 2건 RED · 진 쪽 1건 RED)를 저장소를 오염시키지 않는 방식으로 직접 재현해
근거가 실측임을 검증했다. 남은 발견 2건(mock 의 workspaceId 미검증 시뮬레이션, e2e 타이머 미정리)은
모두 직전 리뷰 라운드에서 이미 식별·유보(`RESOLUTION.md` "main 지시대로 무조치")된 기존 관례 수준의
INFO 이며, 이번 라운드에서 새로 발견된 결함은 없다. 차단 사유 없음.

## 위험도

LOW
