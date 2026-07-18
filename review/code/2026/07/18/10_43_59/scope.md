# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 설정/스크립트 파일 2곳에 추가된 것은 순수 주석(역참조 포인터)뿐
  - 위치: `.claude/test-stages.sh` (+5 lines), `.github/workflows/packages-checks.yml` (+6 lines)
  - 상세: `git show 7a4c69959 -- .claude/test-stages.sh .github/workflows/packages-checks.yml` 로 실제 커밋 diff 를 직접 확인했다. 두 파일 모두 기존 코드(`INTERNAL_PACKAGES` 배열, `on.pull_request/push.paths`, `strategy.matrix.pkg`)는 한 글자도 바뀌지 않았고, 신설 drift 가드 테스트(`internal-package-registration.test.ts`)를 가리키는 설명 주석만 삽입됐다. 이 두 파일은 신설 가드가 실제로 감시하는 대상이므로 "이 목록을 바꾸면 이 가드가 깨진다"는 역참조는 가드 자체의 목적과 직결된다 — scope 밖 수정이 아니다.
  - 제안: 없음 (범위 내 정상 변경)

- **[INFO]** 신규 테스트 파일의 구현 복잡도 (310줄, 커스텀 YAML 리스트 추출기·bash 함수 본문 파서 포함)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
  - 상세: 범용 YAML 파서(`js-yaml`) 대신 경로 스코프 리스트 추출기를 직접 구현한 이유가 파일 내 주석(L761-767 부근)에 명시돼 있다 — "frontend 의 직접 의존이 아니고 workspace 루트 hoist 로만 해소(실측)돼 전이 의존 리스크가 있다". `fnBody` 의 라인 시작 `{` 휴리스틱도 스스로 위반 조건을 감지해 throw 하도록 만들어(자기 검증) 목표(#968 재발 방지)에 부합한다. vacuity 방지 `describe` 블록은 "파싱이 조용히 빈 배열을 반환해 전체가 vacuous PASS 되는" 이 저장소의 반복 실패형(주석에 #960·#962·#968 명시)에 대한 직접 대응이며, 요청 범위를 넘는 부가 기능이 아니라 가드 신뢰성의 핵심 요소다. 커밋 메시지에도 mutation 7종을 실측해 각 케이스가 red 로 전환되는지 확인했다는 근거가 남아 있다.
  - 제안: 없음 (범위 내 정상 변경, over-engineering 아님)

- **[INFO]** 무관한 파일 수정 없음
  - 위치: 커밋 `7a4c69959` 전체 (`git show --stat`)
  - 상세: 변경된 파일은 정확히 3개(`test-stages.sh`, `packages-checks.yml`, 신규 테스트 파일)뿐이며 모두 이번 drift 가드 도입과 직접 연결된다. spec/plan 문서, 다른 소스 파일, 다른 설정 파일에 대한 touch 는 없다. working tree 는 이 리뷰 시점에 clean(리뷰 산출물 디렉토리 외 untracked 없음)하여 표시된 diff 가 실제 변경 전부임을 확인했다.
  - 제안: 없음

- **[INFO]** 포맷팅/리팩터링/임포트/주석 무관 변경 없음
  - 위치: 커밋 전체
  - 상세: 기존 코드의 whitespace·들여쓰기·순서 변경이 전혀 없다(두 기존 파일 모두 순수 추가형 diff, 기존 라인 삭제/이동 0). import 는 신규 파일에서 `vitest`(`describe/it/expect`), `node:fs`, `node:path` 만 사용하며 전부 실제로 쓰인다. 기존 파일의 import/설정 값 변경 없음.
  - 제안: 없음

## 요약
커밋 `7a4c69959`(`test(repo-guards): 내부 패키지 등록 목록 4곳 ↔ 실제 패키지 집합 drift 가드`)은 정확히 3개 파일 — 신규 테스트 1개 + 기존 스크립트/워크플로 파일 2곳에 대한 순수 주석(역참조) 추가 — 로 제한돼 있으며, 모두 "내부 패키지 등록 목록 4곳의 drift 를 신설 가드로 차단한다"는 단일 목표(브랜치명 `internal-packages-validation-guard`, 커밋 메시지, 직전 사고 #968 배경과 일치)에 직결된다. 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 뒤섞임, 불필요한 주석/임포트/설정 변경은 발견되지 않았다. 테스트 구현이 다소 정교(커스텀 파서 다수)하지만, 이는 가드가 스스로도 신뢰할 수 있어야 한다는 명시된 요구사항(자기 검증형 파서·vacuity 방지)의 필수 결과이지 스코프 밖 기능 추가가 아니다.

## 위험도
NONE
