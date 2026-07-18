# 변경 범위(Scope) 리뷰 — internal-package-registration drift 가드

## 검토 대상

- `.claude/test-stages.sh` (주석 5줄 추가)
- `.github/workflows/packages-checks.yml` (주석 6줄 추가)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` (신규, 269줄)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (신규, 364줄)

베이스 커밋(`0638186ac`) 대비 diff stat 은 정확히 이 4개 파일만 변경됨을 확인 (`git diff 0638186ac..f82b3a4c8 --stat`) — 무관한 파일 혼입 없음.

## 배경 확인

이 변경은 단일 목적(PR #968 클래스 — 내부 공유 패키지 등록 목록 4곳 drift 미탐지)을 위해 4개 커밋에 걸쳐 반복(`/ai-review` WARNING 반영 3회) 진행됐다:
1. `7a4c69959` — 최초 가드 도입
2. `86de33a32` — WARNING 반영(1차): heredoc fail-loud + 합성 fixture
3. `e210032c8` — WARNING 반영(2차): fs 코어 분리 + fixture
4. `f82b3a4c8` — WARNING 반영(3차): 명령위치 판정 + 파서/테스트 파일 분리

각 커밋 메시지가 직전 `/ai-review` 라운드의 구체적 WARNING 을 인용하며 대응하고 있어, 반복된 확장이 자발적 스코프 확장이 아니라 리뷰 피드백에 대한 정당한 응답임을 뒷받침한다.

## 발견사항

- **[INFO]** 가드 구현이 "4곳 등록 목록 drift 체크"라는 원 목표 대비 상당히 무거운 커스텀 파서(mini bash parser + YAML 서브셋 파서)로 성장
  - 위치: `internal-package-registration-guard.ts` `fnBody()`(heredoc 조기닫힘 감지, tab-strip `<<-EOF` 변형, here-string 제외 lookaround, 라인시작 블록 조기열림 감지), `explicitFilterCalls()`(주석/명령구분자 기반 "명령 위치" 판정)
  - 상세: 파일 자신의 docstring 이 인정하듯("현재 cmd_* 3개는 heredoc 이 없어 즉시 트리거되지 않으나") 이 edge-case 처리들은 현재 `.claude/test-stages.sh` 의 실제 3개 함수에는 존재하지 않는 가상의 미래 문법(heredoc, 중첩 브레이스)에 대한 방어다. 원 요청("4곳 목록 ↔ 패키지 집합 drift 가드")을 넘어 그 가드 자체의 무결성을 지키는 별도의 정적분석 미니 라이브러리(약 640줄, 파서 함수 8개, 합성 fixture 테스트 30여 건)로 확장됐다.
  - 다만 이 확장은 전부 이전 `/ai-review` 라운드의 명시적 WARNING(파서 자신이 #968급 조용한 무검증을 재현할 수 있다는 지적)에 대한 응답이며, 임의로 추가된 기능이 아니다. 커밋 메시지가 각 확장의 유발 WARNING 을 정확히 인용하고 있어 추적 가능하다. 따라서 CRITICAL/WARNING 이 아닌 INFO 로 기록 — 최종 결과물의 복잡도가 최초 요청 대비 커졌다는 사실 자체는 향후 유지보수 부담으로 남을 수 있어 참고용으로 남긴다.
  - 제안: 별도 조치 불요(이미 review-driven). 다만 향후 이 가드를 더 확장할 필요가 생기면, "현재 존재하지 않는 문법에 대한 방어적 throw" 축적이 계속 늘어나지 않도록 별도 유틸(예: 범용 bash 파서 라이브러리 도입)로의 이관 여부를 검토할 만하다.

- **[INFO]** 두 설정/스크립트 파일(`test-stages.sh`, `packages-checks.yml`)의 변경은 순수 주석 추가만이며 실행 동작·설정 값 변경 없음
  - 위치: `.claude/test-stages.sh` (+5 lines, `INTERNAL_PACKAGES` 배열 위), `.github/workflows/packages-checks.yml` (+6 lines, 파일 헤더)
  - 상세: 두 diff 모두 기존 코드/설정을 전혀 건드리지 않고 가드 존재를 알리는 참조 주석만 추가했다. `paths`/`matrix` 등 실제 CI 트리거 조건은 무변경 — "설정 변경" 리스크 없음.
  - 제안: 없음(문제 아님, 정상 범위).

- **[INFO]** import·미사용 코드 없음
  - 위치: `internal-package-registration-guard.ts`(fs, path), `internal-package-registration.test.ts`(12개 named import)
  - 상세: 두 파일의 모든 import 가 실제로 사용됨을 확인. 불필요한 정리나 무관한 임포트 변경 없음.

- **[INFO]** 파일 분리(guard.ts ↔ test.ts)는 3차 리뷰 WARNING("단일 557줄 파일에 파서 15개+단언 혼재")에 대한 대응으로 명시돼 있고, 실제로 "파서·비교 순수 로직"과 "실측 대조+합성 fixture" 책임이 깔끔히 나뉨 — 관련 없는 리팩토링이 아니라 지적된 결함에 대한 정확한 대응.

## 요약

4개 커밋에 걸친 diff 는 "내부 공유 패키지 등록 목록 4곳 ↔ 실제 패키지 집합 drift 가드" 라는 단일 목적에 집중돼 있으며, 무관한 파일·설정·포맷팅 변경은 발견되지 않았다(베이스 대비 diff stat 이 정확히 이 4개 파일). `test-stages.sh`/`packages-checks.yml` 변경은 순수 주석 추가로 설정 변경 리스크가 없다. 유일하게 주목할 지점은 가드 구현이 반복된 리뷰 피드백에 응답하며 커스텀 bash/YAML 미니 파서(heredoc 감지·명령위치 판정 등, 현재 존재하지 않는 문법까지 방어)로 상당히 커졌다는 점인데, 각 확장이 직전 `/ai-review` WARNING 을 정확히 인용하며 추적 가능해 자발적 스코프 확장(over-engineering)이라기보다 review-driven hardening 에 해당한다고 판단, INFO 로만 기록한다.

## 위험도

LOW
