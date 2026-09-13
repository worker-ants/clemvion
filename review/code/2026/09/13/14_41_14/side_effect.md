# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 리네임 후 자매 파일에 죽은 파일명 참조가 남는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` (이번 diff 밖 — Read 로 직접 열어 확인한 실제 파일 줄 번호)
  - 상세: 이번 PR 은 `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 를 삭제하고 `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 로 리네임한다. `plan/in-progress/guide-identifier-existence.md` §C "명명" 절은 "참조처는 `PROJECT.md` 가드 카탈로그 2행과 트래커의 planner 등재 문구다(둘 다 이 PR 이 고칠 수 있다). 자매 `guide-sanitized-message-parity` 는 스코프가 안 바뀌므로 리네임 대상이 아니다"라고 적어 참조처 전수를 확인했다고 주장하지만, 실제로 `guide-sanitized-message-parity.test.ts` 의 JSDoc 은 "자매 `guide-error-code-existence.test.ts` 는 **코드 토큰**의 실재를 본다" 라고 옛 파일명을 그대로 인용하고 있다(이번 diff 에 이 파일은 포함되지 않았다 — 즉 리네임 커밋이 이 자리를 놓쳤다). "자매 파일 자체의 이름을 바꿀 필요는 없다"는 판단과 "그 자매 파일 **안의 옛 파일명 인용**을 갱신해야 한다"는 별개 문제인데 plan 이 둘을 섞어 후자를 누락시켰다. 기능적으로는 깨지지 않지만(그 파일은 옛 스캐너를 import 하지 않는다), `guide-error-code-existence.test.ts` 를 grep 하면 이제 존재하지 않는 파일을 가리키는 히트가 하나 남아 다음 사람이 "이 이름이 아직 살아있나"를 다시 추적하게 만든다.
  - 제안: 이 docstring 의 `guide-error-code-existence.test.ts` 를 `guide-identifier-existence.test.ts` 로 갱신(또는 최소한 각주로 리네임 이력 병기)한다.

- **[WARNING]** env 선언처 수집기가 의도보다 넓은 파일 집합을 읽는다 — 무관 대형 파일(pnpm lockfile) 포함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규 파일, 게이트 48~51행 — `composeTexts` 산출 블록)
  - 상세: `composeTexts` 는 저장소 루트에서 `fs.readdirSync(root).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))` 로 얻은 **모든** 루트 YAML 파일을 읽어 `collectEnvDeclarations` 에 넘긴다. 스캐너 주석(`guide-identifier-scan.ts`)은 이 축의 의도를 "compose 가 컨테이너에 주입만 하는 값"이라고 서술하지만, 구현은 파일명이 아니라 확장자만으로 선별한다 — 그 결과 `docker-compose.yml`·`docker-compose.e2e.yml` 뿐 아니라 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml`도 매 테스트 실행마다 전체를 읽어 정규식으로 스캔한다. 직접 실측한 결과 오늘은 두 파일 다 `composeLine` 패턴(`^\s+(UPPER_SNAKE):\s`)에 걸리는 토큰이 0건이라 기준집합을 오염시키지 않지만, 이는 우연이다 — 루트에 새 YAML(k8s 매니페스트, CI 워크플로 사본 등)이 추가되거나 lockfile 포맷이 바뀌면 조용히 기준집합에 낯선 토큰이 섞여 들어갈 수 있고, 그 경로는 이 가드의 "존재 판정" 자체를 흐리게 한다. 부작용 관점에서는 "예상치 못한 파일을 읽는다"(파일 생성/삭제는 아니지만 스코프 밖 대형 파일에 대한 암묵적 읽기 의존)에 해당한다.
  - 제안: `docker-compose*.yml` 처럼 명시적 파일명 패턴으로 좁히거나, 최소한 `pnpm-lock.yaml`/`pnpm-workspace.yaml` 를 명시적으로 skip 하는 코드와 그 이유를 주석으로 고정한다.

- **[INFO]** 새 모듈은 순수 함수·읽기 전용 파일시스템 접근으로 구성되어 있음을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체, `guide-identifier-existence.test.ts` 전체
  - 상세: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 인자로 받은 텍스트만 다루는 순수 함수이며 부작용은 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 를 통한 **읽기**뿐이다. 쓰기·삭제·네트워크 호출·`process.env` 변경은 없다. `GUIDE_EXTERNAL_VOCABULARY` 는 새 모듈-레벨 export 지만 다른 파일에서 import 되지 않고(grep 확인) 런타임에 변형되지도 않는다.
  - 제안: 없음(정보성).

- **[INFO]** 옛 스캐너 모듈 삭제에 따른 깨진 import 없음 — 확인 완료
  - 위치: 저장소 전수 grep 결과 (`guide-error-code-scan`/`guide-error-code-existence` import 참조)
  - 상세: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` 를 import 하던 곳은 그 두 파일(둘 다 이번 PR 에서 함께 삭제) 뿐이었다. `.claude/**`(하네스 스크립트·CI 설정)에도 옛 파일명을 참조하는 곳이 없어 시그니처/인터페이스 삭제가 다른 호출자에 영향을 주지 않는다.
  - 제안: 없음(정보성).

## 뮤테이션/원복 메모

가설 검증을 위해 저장소 밖에서 `node -e` 스크립트로 `pnpm-lock.yaml`·`pnpm-workspace.yaml`·두 `docker-compose*.yml` 을 **읽기 전용**으로 스캔했을 뿐, 저장소 트리에는 아무것도 쓰지 않았다. `git status --short` 확인 결과 리뷰 시작 전부터 있던 미커밋 `review/**` 산출물 디렉터리 2개 외에 변경 없음.

## 요약

이번 변경은 문서 검증용 vitest 스위트(순수 함수 + 읽기 전용 파일시스템 접근)의 리네임·확장이며, 프로덕션 런타임 경로·전역 상태·환경변수 쓰기·네트워크 호출에는 관여하지 않는다. 실질적 위험은 (1) 리네임이 자매 테스트 파일의 docstring 안 옛 파일명 인용을 놓쳐 죽은 참조를 남긴 것과 (2) env 선언처 수집기의 "compose 파일" 선별이 확장자만 보고 있어 의도보다 넓은 파일(대형 pnpm lockfile 포함)을 조용히 끌어들이는 잠재 오염 경로, 두 가지로 모두 오늘 시점 실측으로는 기능적 손상이 없는 경미한 항목이다.

## 위험도
LOW
