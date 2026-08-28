# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 죽은 devDependency(`@eslint/eslintrc`) 제거 — 프로덕션 코드에는 영향 없음, 검증 근거는 이 diff 밖(plan)에 있음
  - 위치: `codebase/backend/package.json` (devDependencies 섹션, `@eslint/js` 선언 직전 — 삭제된 줄이라 게이트 번호 없음)
  - 상세: `"@eslint/eslintrc": "^3.3.6"` 제거는 devDependency 라 런타임/배포 아티팩트에는 영향이 없다. `codebase/backend`·`codebase/frontend`·`codebase/channel-web-chat`·루트 어디에도 `@eslint/eslintrc` import 또는 `FlatCompat` 사용처가 없음을 직접 grep 으로 재확인했다(0건). 다만 이 diff 자체(`side_effect.md` 프롬프트에 포함된 5개 파일)에는 이 근거가 없고 plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md`)의 서술에 의존한다 — 근거 재현이 실측으로 확인되므로 회귀 위험은 낮다.
  - 제안: 조치 불요. 참고 사항으로만 기록.

- **[INFO]** `pnpm-lock.yaml` 의 `@jest/core@30.4.2`(peer-suffix 없는 변형) 스냅샷 엔트리 삭제
  - 위치: `pnpm-lock.yaml` (`snapshots:` 섹션, 삭제된 줄이라 게이트 번호 없음 — unified diff `@@ -11739,42 +11736,6 @@` 블록)
  - 상세: `@eslint/eslintrc` 제거로 해당 패키지가 끌어오던 `@jest/core@30.4.2`(peer 접미사 없는 변형)의 중복 해소 엔트리가 사라졌다. 실제 테스트가 쓰는 `@jest/core@30.4.2(ts-node@10.9.2(...))` 변형은 `pnpm-lock.yaml` 에 6군데 그대로 남아 있음을 확인했다 — jest 실행 경로에 영향 없는 lockfile 정리(dedup)다.
  - 제안: 조치 불요.

- **[INFO]** 신규 회귀 테스트 2건은 공유 상태·전역·파일시스템·네트워크·이벤트 콜백을 건드리지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:141` (`it('원본 예외를 \`cause\` 로 보존한다...')`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:202` (`it('원본 컴파일 예외를 \`cause\` 로 보존한다...')`)
  - 상세: 두 테스트 모두 각 `describe` 블록의 기존 `beforeEach`(`service`/`handler`/`context` 재생성)에 의존하며, 자체적으로 `process.env`·모듈 레벨 변수·타이머·소켓을 건드리지 않는다. `try/catch` 로 예외를 잡아 로컬 변수(`thrown`)에만 담고 종료하므로 다른 테스트 케이스로 상태가 누수되지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 프로덕션 코드(런타임 서비스 로직) 를 전혀 건드리지 않는다 — 대상은 (1) 사용처 0건이 확인된 devDependency 제거, (2) 그 제거를 반영한 `pnpm-lock.yaml` dedup, (3) 기존 `cause: err` 부착(이전 라운드에서 이미 반영·리뷰된 프로덕션 변경)을 잠그는 회귀 테스트 2건 추가, (4) plan 문서 갱신뿐이다. 시그니처·공개 API·전역 상태·환경변수·네트워크·이벤트 표면 어느 것도 변경되지 않았고, 신규 테스트는 격리돼 있어 교차 오염 위험이 없다. devDependency 제거의 "사용처 0건" 근거는 이 diff 안에 직접 포함돼 있지 않지만 실측(grep) 재현으로 확인했다.

## 위험도

NONE
