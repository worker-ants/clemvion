# 유지보수성(Maintainability) 리뷰

## 리뷰 대상 요약

`prepare` 스크립트를 `[ -d dist ] || tsc` (디렉터리 존재만 확인) 에서 typescript 해석 가능 여부로 분기하는 `node -e "..."` 인라인 스크립트로 교체(7개 `codebase/packages/*/package.json`), 이를 회귀 방지하는 신규 테스트(`test_packages_prepare_contract.py`), CI 트리거 등록(`harness-checks.yml`), 문서화(`.claude/tests/README.md`).

### 발견사항

- **[WARNING]** 동일한 대형 인라인 `node -e` 스크립트가 7개 `package.json` 파일에 문자 그대로 중복
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12` (모두 `scripts.prepare` 필드)
  - 상세: 약 350자짜리 동일한 JS 로직(`require.resolve('typescript/package.json')` 성공 여부로 분기 → `tsc` 실행 / no-op / throw)이 7개 파일에 escape 된 문자열로 반복 등재되어 있다. 로직을 바꾸려면 사람이 7곳을 손으로 동일하게 고쳐야 하고, JSON 문자열이라 문법 하이라이팅·린트·포매터의 도움을 받지 못한다. `test_every_package_that_builds_uses_the_same_prepare` (`.claude/tests/test_packages_prepare_contract.py`) 가 "byte-identical" 을 강제하므로 조용한 drift 는 CI 가 잡아주지만, 이는 **사후 감지**일 뿐 편집 부담 자체를 줄여주지는 않는다 — 실패 시 결국 7곳을 다시 손으로 맞춰야 한다.
  - 제안: 저장소 내부에 공유 스크립트(예: `scripts/pnpm-package-prepare.cjs` 혹은 각 패키지에서 상대경로로 참조 가능한 위치)를 두고 `"prepare": "node ../../scripts/pnpm-package-prepare.cjs"` 형태로 위임하는 방안을 검토할 것. 단, `@workflow/sdk`/`@workflow/web-chat` 처럼 npm 배포(publish) 가능성이 있는 패키지는 `prepare` 가 소비자 측(git dependency 설치 등)에서 실행될 수 있어 모노레포 외부 상대경로 스크립트에 의존하면 깨질 수 있다는 점은 실제로 확인이 필요 — 만약 이 경로 의존이 문제라면 현재의 인라인 방식이 의도적 트레이드오프일 수 있다. 다만 최소한 내부 전용 패키지들만이라도 공유 스크립트로 추출하거나, 현재 방식을 유지한다면 그 이유("배포 가능 패키지이므로 self-contained 이어야 한다")를 테스트/문서에 한 줄 남겨두는 것을 권장.

- **[INFO]** 인라인 스크립트의 변수명이 1글자(`f`, `c`, `ts`)로 축약되어 있음
  - 위치: 위와 동일한 7개 파일의 `scripts.prepare` 값 (예: `codebase/packages/sdk/package.json:9`)
  - 상세: `const f=require('fs'),c=require('child_process');let ts=true;...` — 한 줄짜리 인라인 커맨드로 압축해야 하는 제약(JSON 문자열 내부, escape 필요)은 이해되나, `f`/`c`/`ts` 는 문맥 없이는 의미가 즉시 드러나지 않는다.
  - 제안: 공유 스크립트 파일로 추출한다면(위 항목) 자연스럽게 `fs`/`child_process`/`hasTypescript` 같은 온전한 이름을 쓸 수 있다. 현재 형태를 유지한다면 이 정도 축약은 실용적 타협으로 수용 가능한 수준.

- **[INFO]** `PrepareBranchBehaviourTest.setUpClass` 가 "모든 prepare 가 byte-identical" 이라는 다른 테스트 클래스(`PrepareIsUniformTest`)의 불변식에 암묵적으로 의존
  - 위치: `.claude/tests/test_packages_prepare_contract.py` — `PrepareBranchBehaviourTest.setUpClass` (`cls.prepare = sorted(prepares)[0]`)
  - 상세: `unittest` 는 테스트 클래스 간 실행 순서를 보장하지 않으므로, 만약 향후 어떤 패키지의 `prepare` 가 나머지와 달라지는 회귀가 생기면 `PrepareIsUniformTest` 가 그 사실을 잡아주긴 하지만, `PrepareBranchBehaviourTest` 는 임의로 하나(정렬 후 첫 번째)만 골라 그것만 행위 검증한다 — 즉 나머지 6개 패키지의 실제 문자열이 달라도 이 클래스는 그 사실을 알지 못한 채 통과한다. 실무적으로는 `PrepareIsUniformTest` 가 이미 그 케이스를 CRITICAL 하게 잡아주므로 큰 문제는 아니나, 두 클래스가 서로의 전제에 기대는 결합이 문서화되어 있지 않다.
  - 제안: 사소한 수준이라 필수 수정 사항은 아님. 원한다면 `setUpClass` 주석에 "uniqueness 는 `PrepareIsUniformTest` 가 보장한다"는 한 줄을 남겨 결합을 명시할 수 있다.

### 그 외 확인한 항목 (문제 없음)

- `.claude/tests/README.md`: 기존 표 컨벤션(각 행에 "왜 필요한가 + 측정치 + 배경"을 서술)을 그대로 따름. 신규 행 추가만 있고 스타일 일탈 없음.
- `.github/workflows/harness-checks.yml`: 기존 `paths:` 목록의 "왜 이 파일을 등재했는가"를 설명하는 주석 패턴을 그대로 따름. 일관성 양호.
- `test_packages_prepare_contract.py`: 함수 길이·중첩 깊이 적절. `_manifests()`/`_run()` 헬퍼로 중복을 스스로 잘 제거함(4개 테스트가 `_run(typescript=.., dist=..)` 헬퍼를 공유). 매직넘버 `5` (패키지 최소 개수 하한)는 "도출 기반 테스트가 vacuous 하게 통과하지 않게 하는 바닥"이라는 주석이 붙어 있어 의도가 명확함 — 매직 넘버로 보지 않음.
- `[ -d dist ] || tsc` → 통일된 `node -e` 형태로의 전환은 기존에 `sdk` 패키지만 다른 형태(`node -e "...existsSync..."`)를 쓰던 불일치를 오히려 해소해 **일관성은 개선**되었다.

## 요약

이번 변경의 핵심 로직(회귀 테스트 + CI 트리거 등록 + 문서화)은 함수 길이·중첩·네이밍·일관성 면에서 양호하고, 특히 `test_packages_prepare_contract.py` 는 헬퍼 추출로 자기 자신의 중복은 잘 억제했다. 유일하게 눈에 띄는 유지보수성 리스크는 실제 빌드 로직(`prepare` 스크립트)이 7개 `package.json` 에 동일한 인라인 JS 문자열로 문자 그대로 중복된 점이다 — 신규 테스트가 drift 를 사후에 잡아주지만 편집 부담과 가독성(1글자 변수, JSON 문자열 내 이스케이프) 문제는 남는다. 공유 스크립트 파일로의 추출은 검토할 가치가 있으나, 배포 가능 패키지(sdk/web-chat-sdk)의 self-contained 필요성이 실제로 걸림돌인지는 확인이 필요해 이번 라운드에서 필수 차단 사유로 보지는 않는다.

## 위험도

LOW
