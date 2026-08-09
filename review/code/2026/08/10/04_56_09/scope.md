# 변경 범위(Scope) 리뷰

## 검토 방법

두 파일 모두 프롬프트에는 "전체 파일 컨텍스트"만 제공되어(diff 섹션 없음), 실제
변경분을 특정하기 위해 저장소를 직접 열어 다음을 확인했다.

- `git show --stat HEAD` / `git diff HEAD~1 HEAD -- <두 파일>` — 세션 디렉터리
  시각(`04_56_09`)이 직전 fix 커밋(`5860f295b`, `04:55:37`, "Gate C 가 망가진 started
  를 조용히 면제했다")과 바로 이어져, 이번 라운드가 그 커밋(직전 `/ai-review 04_38_50`
  의 W1/W2/W3 조치)을 검토 대상으로 삼는 것으로 판단.
- `git diff origin/main...HEAD --stat -- <두 파일>` — 브랜치 전체 누적분도 대조.

## 발견사항

- **[INFO]** `plan-scan.ts` 의 내부 헬퍼 `rawScalar`/`isIsoDate` 를 `export` 로 전환
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196`, `:212`
  - 상세: 커밋 diff 상 `function rawScalar` → `export function rawScalar`,
    `function isIsoDate` → `export function isIsoDate` 로 바뀌었다. export 표면이
    넓어지는 변경이지만, `spec-plan-completion.test.ts` 의 `startedDate`/
    `hasMalformedStarted` 가 이 두 함수를 그대로 재사용해야 "판정 이중화" 를 피할 수
    있다는 것이 이번 fix(W1)의 핵심 취지이므로 범위 내 필요 변경으로 판단된다.
    커밋 메시지("내가 하드닝한 그 클래스인데 자매 함수엔 적용 안 했다")와도 정합.
  - 제안: 없음(정보 제공 목적).

- **[INFO]** `spec-plan-completion.test.ts` 에서 `enforced` 필터 계산 전에
  `parsedPlans`(전체 plan 을 1회 파싱한 배열)를 새로 도입
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:115-119`
  - 상세: 종전에는 `enforced` 필터 내부에서 파싱하고, per-plan `describe` 블록에서
    다시 파싱해 "같은 plan 을 두 번 파싱" 했다(주석에도 명시돼 있었음). 이번 diff 는
    이를 한 번으로 합치면서 동시에 W1 이 요구하는 "malformed started" 신규 `it` 이
    같은 파싱 결과를 공유하도록 했다. 신규 테스트 추가와 직접 결합된 리팩터링이라
    "무관한 리팩토링"으로 보기 어렵다.
  - 제안: 없음.

## 범위 밖 변경 여부

- 코드 변경은 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`,
  `spec-plan-completion.test.ts` 두 파일로 한정되며, 커밋에 함께 포함된 나머지
  변경분은 `review/code/2026/08/10/04_38_50/**` 산출물(직전 라운드의 리뷰 아티팩트)
  뿐이다 — 워크플로가 자동 생성하는 리뷰 부산물이라 수동 스코프 이탈이 아니다.
- import 변경: `spec-plan-completion.test.ts` 의 import 목록에 `isIsoDate`,
  `rawScalar` 가 추가됐고 둘 다 `startedDate`/`hasMalformedStarted`/직접 호출
  (`rawScalar(p.parsed!.block, "started")`, L186 부근)에서 실사용된다. 미사용 임포트
  없음.
- 포맷팅: 순수 공백/개행만 바뀐 라인은 발견되지 않았다. 모든 diff hunk 가 로직
  변경 또는 그 로직을 설명하는 주석과 짝을 이룬다.
- 주석 변경: `plan-scan.ts` 헤더 주석 재구성(diff 상 "네 벌이 모였다" / "spec-links.ts
  의 walker 둘"을 문단 분리)은 커밋 메시지의 W3("헤더 주석이 산술적으로 모순")에 대한
  명시적 수정이며, 직전 리뷰 라운드가 지적한 항목이다. drive-by 주석 손질이 아니다.
  `spec-plan-completion.test.ts` 에 추가된 다수의 JSDoc/인라인 주석도 새로 추가된
  분기(`hasMalformedStarted`, 원문 블록 기반 판정으로의 시그니처 변경)의 근거를
  설명하는 것으로, 이 저장소의 기존 컨벤션(다른 함수들에도 동일 밀도의 근거 주석이
  이미 존재)과 일관된다.
- 설정 변경: 없음.
- 기능 확장(over-engineering): `hasMalformedStarted` 신규 함수·`it` 은 직전 리뷰가
  지적한 실측 결함(fail-open)에 대한 직접 대응이지 임의의 기능 추가가 아니다. 커밋
  메시지에 명시된 대로 실데이터 357건 전수 확인까지 마쳤다.

## 요약

이번 라운드의 실제 diff(직전 fix 커밋)는 바로 앞 `/ai-review` 가 지적한 W1(malformed
`started` fail-open)·W2(`hasValidSpecImpact` 미배선)·W3(헤더 주석 모순) 세 항목에
정확히 대응하는 변경으로 구성돼 있고, 두 파일 모두 그 세 항목과 무관한 리팩토링·포맷팅·
임포트 정리·설정 변경은 발견되지 않았다. export 표면 확대와 파싱 1회화 리팩토링도
새 테스트/판정 재사용에 직접 필요한 변경이라 범위 이탈로 보기 어렵다.

## 위험도

NONE
