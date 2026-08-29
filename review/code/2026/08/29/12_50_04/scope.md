# 변경 범위(Scope) 리뷰

## 검증 방법

- `git log origin/main..HEAD --oneline` 로 이 브랜치의 커밋 4건(`3e2360db0`·`58806c380`·
  `89e9b5d53`·`86f74145d`)을 확인.
- `git diff origin/main...HEAD --stat` / `--name-only` 로 실제 변경 파일 27개 전수를 프롬프트에
  제시된 18개 파일 섹션과 대조 — 정확히 일치.
- `git diff origin/main...HEAD --name-only | grep -v '^review/'` 로 review 산출물을 뺀 "실제
  코드/문서" 변경이 정확히 5개 파일(spec 2 + 신규 패키지 spec 1 + 프로덕션 파일 1(주석만) +
  plan 1)뿐임을 확인.
- `git diff origin/main...HEAD -- codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
  전체를 직접 열람해 프롬프트에 잘린 diff 조각이 아니라 실제로 주석 5줄 추가뿐임을 확인.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 §2 백로그 항목과 diff 내용을 line-level
  대조 — "C2 를 단언으로 잠그기" 항목이 세 라운드(11_58_35 → 12_23_45 → 이번 커밋들)를 거치며
  진화한 이력이 plan 자체에 기록돼 있음을 확인.

## 발견사항

없음.

## 점검한 관점

- **의도 이상의 변경**: 없음. `git diff origin/main...HEAD --name-only` 에서 review 산출물을
  제외하면 정확히 5개 파일만 남고, 전부 plan §2 가 스스로 등재한 두 항목("C2 를 단언으로
  잠그기", `secret-resolver.service.ts` 주석 보강)으로 귀결된다. 신규 패키지 테스트 파일
  (`packages/expression-engine/src/__tests__/error-shape.spec.ts`)은 새로운 목표가 아니라, 같은
  "C2 잠그기" 항목이 2라운드 리뷰(`12_23_45`)에서 "소비처 경로만 잠그면 새 하위 클래스가 조용히
  샌다"는 지적을 받아 축을 하나 더 추가한 것이다 — plan 이 그 판단 과정을 `RESOLUTION.md`·plan
  본문에 명시적으로 남겨 추적 가능하다.
- **불필요한 리팩토링**: 없음. 두 spec 파일의 `captureThrown`/`captureRejected` 헬퍼 추출은
  1라운드 리뷰(WARNING #3, 캡처 보일러플레이트 반복 지적)에 대한 직접 대응이지 무관한 정리가
  아니다. 실제 구현부(`expression-resolver.service.ts`, `code.handler.ts`)는 이번 diff 에
  포함되지 않았다 — 이전 PR(`#1230`)에서 이미 처리된 파일이라 범위 밖이 맞다.
- **기능 확장**: 없음. `error-shape.spec.ts` 는 프로덕션 기능이 아니라 회귀 테스트다. 새 프로덕션
  API·옵션·설정 플래그는 추가되지 않았다.
- **무관한 수정**: 없음. `secret-resolver.service.ts` 는 §6.3.1 C1/C2 판정과 직접 관련된 자리에만
  4줄 문단을 추가했고(diff 게이트 95-99), 이는 이전 라운드 INFO #2(리뷰 `11_58_35`)에 대한 직접
  대응이다.
- **포맷팅 변경**: 없음. 4개 소스/테스트 파일 diff 는 전부 순수 추가(hunk 헤더 `@@ -N,M +N,M+k
  @@` 형태로 컨텍스트 줄 재배치·개행 스타일 변경이 섞이지 않음)이고, plan.md 의 삭제 2줄은
  `[ ]` → `[x]` 체크박스 전환에 대응하는 정상 편집이다.
- **주석 변경**: 신규 주석은 전부 이번에 신설한 테스트/코드 설명이거나(캐너리 근거), plan 의
  자기 정정 규약(§자기-반증형 소정정)이 요구하는 취소선 처리다. 기존 주석의 무단 삭제·수정은
  없음.
- **임포트 변경**: 5개 비-review 파일 어디에도 불필요한 import 추가/정리가 없다. 신규
  `error-shape.spec.ts` 의 `import * as errors from '../errors'; import { ErrorCode,
  ExpressionError } from '../errors';` 는 전수 열거(`Object.entries(errors)`)와 타입 가드에
  실제로 쓰인다.
- **설정 변경**: 설정 파일(`eslint.config.mjs`, `package.json`, CI workflow 등) 변경 없음.

## review/ 산출물 커밋에 대한 판단

diff 의 대부분(27개 중 22개)은 `review/code/2026/08/29/{11_58_35,12_23_45}/**` 아래 이전 두
라운드의 리뷰 산출물(SUMMARY/RESOLUTION/개별 reviewer 리포트/meta.json/_retry_state.json)이다.
이는 CLAUDE.md 가 정의한 "코드 리뷰 산출물 저장 위치"(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)
그대로이고, `developer` 가 `review/**/RESOLUTION.md` 뿐 아니라 `review/**` 전반에 쓰기 권한을
갖도록 넓힌 최근 결정(커밋 `051c7e7c1`)과도 부합한다. 스코프 이탈이 아니라 강제된 review→fix
워크플로의 정상 산출물이다.

## 요약

이 diff 는 plan `deps-peer-gating-and-eslint10.md` §2 가 등재한 두 좁은 후속 항목만을 구현하며,
두 번의 리뷰 라운드를 거치며 같은 항목이 "한 종류만 검증" → "세 종류 `it.each`" →
"클래스 전수 열거 축 추가"로 진화한 이력이 plan·RESOLUTION 문서에 그대로 남아 추적 가능하다.
실제 프로덕션 로직 변경은 `secret-resolver.service.ts` 의 주석 4줄이 유일하고 그마저도 예고된
항목의 취지 안에 있다. review 산출물 커밋은 규약이 정한 위치·권한과 일치한다. 무관한 파일·
포맷팅·임포트·설정 변경, 요청받지 않은 리팩토링·기능 확장은 발견되지 않았다.

## 위험도

NONE
