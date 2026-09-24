# 테스트(Testing) 리뷰 — `@nestjs/typeorm` 12 dependency bump (deps-typeorm12 / 58cc6361c)

## 리뷰 대상 정리

이번 변경은 애플리케이션 소스 코드(`.ts`) 수정이 **0줄**이고, 실질 diff는
`codebase/backend/package.json` 한 줄(`@nestjs/typeorm` `^11.0.3` → `^12.0.1`)과
`pnpm-lock.yaml`, 두 개의 `plan/in-progress/*.md` 문서, `review/consistency/**` 산출물뿐이다.
따라서 "새 로직에 대한 테스트가 있는가"라는 통상 질문은 적용 대상이 없고, 리뷰의 초점은
① 이 dependency bump 를 검증한 **방법론 자체의 타당성**과 ② plan 문서가 제시한 실측치의
**재현 가능성**으로 좁혔다.

## 독립 재현 결과 (본 리뷰에서 직접 실행, 저장소 무변경)

- `node --experimental-vm-modules jest --listTests` → **473개 스위트** (plan 의 "473스위트" 주장과 일치)
- reflection 3스위트(`workspace.decorator.spec.ts` · `workspace-reflection-canary.spec.ts` ·
  `roles.guard.spec.ts`) 단독 실행 → **3 suites / 48 tests 전부 통과** (plan 의 "48 통과/48" 주장과
  일치, 현재 설치된 `@nestjs/typeorm@12.0.1` 위에서 확인)
- `node_modules/@nestjs/typeorm/package.json` 버전 실측 → `12.0.1` (lockfile 과 일치, 실제로 해당
  버전이 설치돼 있음을 확인)
- `src/**/*.ts`(non-spec) 중 `@nestjs/typeorm` import 99건, `.spec.ts` 중 31개 파일이 그 API 를
  직접 사용 — deprecated 된 `InjectConnection` 은 코드베이스에 사용처 없음(grep 0건). 즉 실제로
  변경된 패키지(`@nestjs/typeorm`)의 표면을 회귀 스위트가 우회 없이 폭넓게 통과한다.
- `git status --short` — 위 명령들은 저장소를 변경하지 않았음을 확인(untracked
  `review/code/2026/09/24/18_22_23/` 는 이 리뷰 세션 산출물).

full 9950-테스트 스위트/e2e 380/Docker build 는 시간 예산상 재실행하지 않았으나, 위 표본
재현(스위트 수·reflection 서브셋)이 plan 이 보고한 수치와 정확히 일치해 나머지 주장의 신뢰도를
뒷받침한다.

## 발견사항

- **[INFO]** 판별자(MB) mutation test 가 코드베이스에 영속화된 자동 회귀 자산이 아니라 PR 마다
  반복되는 수작업 절차다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` "§C 업그레이드 전 기준값" 절
    (`handlerConsumesWorkspaceId` 를 항상 `false` 로 만드는 한 줄 뮤턴트 실측 부분) /
    `plan/in-progress/deps-typeorm12.md` "## C. 검증" 절
  - 상세: `handlerConsumesWorkspaceId` 가 fail-open 이라 "스위트 통과"만으로는 reflection 경로가
    살아있음을 증명하지 못한다는 지적은 정확하고, 그 판별자를 업그레이드 전/후로 비교한 방법론도
    타당하다. 다만 이 뮤턴트는 저장소에 커밋된 테스트 코드가 아니라 매 `@nestjs/*` 업그레이드
    PR 마다 사람이 소스를 `cp` 로 복사해 수작업으로 넣었다 빼는 절차로 문서에만 남는다
    (`(원복은 cp + 절대경로, 원복 후 워킹트리 diff 빈 출력 확인.)`). 다음 `@nestjs/*` 업그레이드를
    담당할 세션이 이 절차 자체를 잊거나 생략하면, "48/48 통과"라는 숫자만 보고 fail-open 회귀를
    놓칠 수 있다 — 정확히 이 문서가 스스로 경고하는 함정이다.
  - 제안: 필수 조치는 아니지만, 이 판별자를 `.claude/tests/` 또는 backend 자체의 별도
    mutation-canary 스크립트(예: `handlerConsumesWorkspaceId` 를 강제로 false 로 바꾼 빌드를
    한 번 돌려 reflection 3스위트가 특정 개수만큼 RED 가 나는지 자동 확인)로 코드화해 두면,
    앞으로의 `@nestjs/*` 업그레이드마다 사람이 절차를 기억해 재현할 필요 없이 CI/스크립트가
    강제할 수 있다. (이 저장소가 이미 유사 패턴 — cp 복원 뮤테이션 — 을 여러 PR 에서 반복해 온
    관례이므로 새로운 지적이라기보다 일반화 기회로 남긴다.)

- **[INFO]** `@nestjs/typeorm@12.0.1` 이 lockfile 에 새 `engines: {node: '>=20.19.0'}` 제약을
  도입했다 — 실측상 문제 없음, 다만 plan 의 검증 목록에 명시적으로 언급되진 않는다
  - 위치: `pnpm-lock.yaml` (`'@nestjs/typeorm@12.0.1':` 스냅샷 블록, engines 필드 추가된 라인)
  - 상세: 11.0.3 스냅샷에는 없던 `engines` 필드가 12.0.1 에 새로 생겼다. 저장소의
    `codebase/backend/Dockerfile` 은 `node:24-alpine`, `codebase/backend/package.json` 의
    `engines.node` 는 `>=24` 라 실제로는 아무 충돌이 없음을 직접 확인했다. plan 문서의 검증
    체크리스트(§C, §D "그 밖에 예상되는 것")에는 이 엔진 제약 변경이 항목으로 등장하지 않는데,
    결과적으로 문제가 없었을 뿐 "확인했다"고 명시된 항목은 아니다.
  - 제안: 조치 불요(이미 통과하는 조건). 다음에 `@nestjs/*` 서브패키지를 개별 범프할 때
    engines 필드 diff 를 pnpm-lock 에서 훑는 것을 §D 유형의 체크리스트 항목으로 일반화해 두면
    node 버전이 낮은 환경(로컬 개발자 머신 등)에서의 잠재적 실패를 조기에 잡을 수 있다.

## 요약

애플리케이션 코드 변경이 없는 순수 dependency bump이며, 새로운 유닛/e2e 테스트가 필요하지
않다는 판단은 타당하다. 오히려 이 변경이 인상적인 지점은 "관련 없어 보이는 패키지 bump"에도
불구하고 fail-open 보안 가드(reflection 기반 `RolesGuard`/`@WorkspaceId()`)에 대해 전/후
비교와 판별자(mutation) 검증까지 수행한 점으로, 통과 여부만 보는 얕은 회귀 검증보다 한 단계
위의 방법론이다. 본 리뷰에서 스위트 수(473)와 reflection 서브셋(48/48)을 독립적으로
재실행해 plan 문서의 주장과 정확히 일치함을 확인했다. 지적할 잔여 갭은 두 가지 모두 INFO
수준으로, ① 이 판별자 뮤테이션 검증이 코드화된 회귀 자산이 아니라 수작업 절차로 문서에만
남아 다음 업그레이드에서 재현이 사람 의존적이라는 점, ② 신규 `engines` 제약이 검증 체크리스트에
명시적으로 다뤄지지 않았다는 점(실측상 문제는 없음)이다. 둘 다 병합을 막을 사유는 아니다.

## 위험도

LOW
