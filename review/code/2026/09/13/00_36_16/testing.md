# 테스트(Testing) 리뷰 — keyset 커서 UUID 검증 (filter-pg-invalid-text)

## 검증 수행 내역

- 관련 unit 테스트 3개 스위트(`login-history.service.spec.ts` ·
  `background-runs.service.spec.ts` · `uuid.spec.ts`) 직접 실행 — 44 tests 전부 PASS.
- 독립 뮤테이션 1건 직접 수행: `login-history.service.ts` 의
  `if (!isUuidShaped(id)) return null;` 를 주석 처리 → **정확히 신규 테스트
  1건만 RED**(`expect(selectQb.andWhere).not.toHaveBeenCalled()` — received 1
  call). plan 문서가 주장한 M1 예측(RED)과 일치. 뮤테이션은 저장소 밖
  scratch(`/private/tmp/.../scratchpad/backup/login-history.service.ts.orig`)에
  원본을 `cp` 해 둔 뒤 수행했고, 검증 후 그 백업으로 다시 `cp` 복원 →
  `diff` 로 원본과 바이트 단위 일치 확인, `git status --short` 로 해당 파일에
  잔여 변경 없음 확인(리뷰 산출물 디렉터리 외 dirty 항목 없음). 원복 후
  같은 스위트 재실행 12/12 PASS.
- `uuid.ts`/`uuid.spec.ts` docstring 이 SoT 로 지목하는 재현 grep 을 직접
  실행해 실측: `isUuidShaped(` 호출부가 정확히 3곳
  (`workspace-context.util.ts:74` · `login-history.service.ts:61` ·
  `background-runs.service.ts:178`) — 문서가 주장하는 개수·grep 명령이 이번엔
  정확함을 확인.

## 발견사항

- **[INFO]** `login-history.service.ts` `decodeCursor` 의 신규 가드
  (`if (!isUuidShaped(id)) return null;`)에 대해 커서 id 성분이 **빈 문자열**인
  경로(`raw.split('|')` 결과 `id === ''`)는 새 회귀 테스트로 명시적으로 커버되지
  않는다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` 함수
    `decodeCursor` (diff 게이트 45~63줄, 가드는 61줄) / 대응 테스트는
    `codebase/backend/src/modules/auth/login-history.service.spec.ts` 의
    `describe('findForUser')` 신규 `it('id 성분이 UUID 가 아니면...')` (게이트
    193~203줄).
  - 상세: `!id` 체크가 먼저 실행되어 빈 문자열은 이미 이전 줄에서 걸러지므로
    실제로 `isUuidShaped('')` 분기에 도달하지 않는다(도달 불가 코드 경로가 아니라
    상위 가드가 선점). 위험도는 낮음 — `isUuidShaped('')` 자체는
    `uuid.spec.ts` 전역 스위트에서 이미 `false` 로 고정돼 있어 술어 자체의
    회귀 위험은 없다. 다만 "이 서비스 레벨 가드가 왜 필요한가"를 보여주는
    테스트 스위트에 이 경계(빈 id)가 어느 계층에서 걸리는지에 대한 명시적
    앵커가 없어, 다음 사람이 `!id` 체크를 실수로 제거해도 이 스위트만으로는
    바로 잡히지 않을 수 있다(다른 기존 테스트인 `'ignores malformed cursor'`
    가 파이프 없는 문자열만 커버하고 트레일링 파이프는 다루지 않음).
  - 제안: 필수는 아니나, `cursor: '2026-05-01T00:00:00.000Z|'` (id 성분 공백)
    케이스를 `'ignores malformed cursor'` 인근에 한 줄 추가하면 두 가드
    (`!id` vs `isUuidShaped`) 의 경계가 테스트로도 명시된다.

- **[INFO]** `background-runs.service.spec.ts` 의 `'커서 검증이 소유권
  검사보다 먼저 돈다'` 테스트는 의도적으로 ownership mock 을 세우지 않아,
  순서가 뒤바뀌면 `TypeError`(undefined 에 `.leftJoin` 호출)로 실패하도록
  설계돼 있다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`
    `it('커서 검증이 소유권 검사보다 먼저 돈다 — 타 워크스페이스 + 잘못된
    커서는 400 (404 아님)')` (diff 게이트 657~679줄).
  - 상세: 테스트 코드 주석이 이 의도("mock 부재로 깨진다")를 명시적으로
    적어 두었으므로 vacuous 는 아니다. 다만 순서가 뒤바뀌었을 때 jest 가
    실제로 내보내는 실패 메시지는 `rejects.toMatchObject({...})` 불일치가
    아니라 `TypeError: Cannot read properties of undefined (reading
    'leftJoin')` 형태가 될 가능성이 높아, 실패 시 원인 진단이 한 단계
    간접적이다(디버깅 시간 소폭 증가 정도, 테스트의 정확성 자체는 문제 없음).
  - 제안: 조치 불요. 향후 유지보수자가 이 실패 메시지를 볼 때를 대비해
    주석에 "실패 시 TypeError 가 뜨면 순서 회귀" 한 줄만 덧붙이면 진단
    시간을 줄일 수 있다는 정도의 참고 사항.

## 평가 요약 (관점별)

1. **테스트 존재 여부**: `decodeCursor` 양쪽(login-history, background-runs)
   모두에 대해 (a) 비-UUID 거부 (b) 느슨한 형태(nil UUID) 통과 대조군 (c)
   기존 계약 유지(무시 vs 400) 를 각각 unit 레벨에서, 그리고 "mock 이
   증명 못 하는 실 Postgres 22P02 발생 여부"를 각각 e2e 레벨에서
   보강했다. 변경 표면 전체가 테스트로 덮여 있다.
2. **커버리지 갭**: 위 INFO 1건(빈 id 경계) 외에는 특별한 갭이 보이지 않는다.
   `background-runs` 의 우선순위 변경(소유권 검사보다 커서 검증이 먼저 →
   타 워크스페이스+잘못된 커서 400)도 전용 테스트로 고정됐다.
3. **엣지 케이스**: nil UUID·v7·비-RFC variant 등 `isUuidShaped` 가 받아들여야
   하는 경계값은 `uuid.spec.ts` 전역 스위트 + 양쪽 서비스의 `[대조군]` 테스트
   이중으로 고정돼 있다. `isValidUuid` 로 교체 시 회귀하도록 설계된 대조군도
   존재(뮤턴트 M3/M4 로 plan 문서가 검증 완료, 위 독립 검증에서 M1 도 재확인).
4. **Mock 적절성**: `background-runs.service.spec.ts`/`login-history.service.spec.ts`
   의 QueryBuilder mock 은 "검증이 값을 거부하는가"만 증명 가능하다는 한계를
   테스트 주석에 명시하고, 그 한계를 메우기 위해 실 Postgres 를 태우는 e2e
   2건(`background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`)을
   별도로 추가했다 — mock 의 대표성 문제를 정면으로 다룬 드문 사례.
5. **테스트 격리**: 각 `beforeEach` 에서 mock 을 새로 구성하고, e2e 는
   `setupUser`/`createBackgroundFailingWorkflow` 로 매 테스트 독립 리소스를
   생성한다. 테스트 간 상태 공유 없음.
6. **가독성**: 각 신규 테스트에 "왜 이 fixture 인가"·"무엇을 대조하는가"를
   설명하는 주석이 붙어 있어 의도가 명확하다. `[대조군]` 표기로 positive/negative
   쌍이 시각적으로 구분된다.
7. **회귀 테스트**: 기존 `'applies composite cursor filter when provided'`
   테스트의 fixture 가 비-UUID(`'cursor-id'`) 였던 것을 UUID 로 교체했는데,
   이는 종전 결함을 "정상"으로 고정하고 있던 자리를 바로잡은 것으로
   plan 문서·주석에 근거가 남아 있고 위 독립 뮤테이션으로 그 인과가 재확인된다.
8. **테스트 용이성**: `decodeCursor` 가 순수 함수(login-history) 또는
   사이드이펙트 없는 private 메서드(background-runs)로 분리돼 있어
   검증 로직 추가가 기존 구조를 흔들지 않고 국소적으로 이루어졌다.

## 요약

커서 id 검증 추가에 대한 테스트는 unit(양쪽 서비스 각각의 거부/통과/기존계약
유지) + e2e(mock 의 한계를 인지하고 실 Postgres 로 22P02→500 전제를 실측) 이중
구조로 매우 충실하게 구성되어 있으며, 대조군·순서 변경 고정 테스트·뮤테이션
검증(plan 문서 6/6 + 본 리뷰 독립 재현 1/1)까지 갖춰 vacuous 위험이 낮다.
직접 수행한 뮤테이션 검증(`login-history.service.ts` 가드 제거 → 신규 테스트
정확히 1건만 RED)도 plan 의 주장과 일치해 자기 보고의 신뢰도가 높다. 발견된
갭은 커서 id 빈 문자열 경계가 상위 `!id` 가드에 가려 명시적으로 테스트되지
않는다는 점 정도로, 심각도는 낮다(INFO 2건, WARNING/CRITICAL 없음).

## 위험도

LOW
