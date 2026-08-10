# Scope Review — Gate C 하드닝 (plan-scan.ts / plan-scan.test.ts / spec-plan-completion.test.ts)

## 조사 방법

프롬프트에는 세 파일 모두 "전체 파일 컨텍스트"만 제공되고 unified diff 섹션이 없어,
스코프 판단을 위해 실제 git 이력을 대조했다. 이 리뷰 세션(`05_39_08`)은 직전 이력
(`git log --oneline -5`)상 최신 커밋 `6aacded22`("spec/ 접두 검사가 `..` 로 뚫렸다")의
`/ai-review 05_27_20` 라운드 적용 결과를 재검증하는 targeted rerun 으로 보인다. 실제 diff:

```
git diff HEAD~1 -- plan-scan.ts plan-scan.test.ts spec-plan-completion.test.ts
 3 files changed, 28 insertions(+), 5 deletions(-)
```

## 발견사항

- **[INFO]** 한 커밋에 서로 다른 두 결함 수정(W1: `spec/` 경로 traversal 정규화, W2: `rawScalar`
  의 정규식 메타문자 미이스케이프)이 함께 들어 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` `makeSpecExists`
    (게이트 112~134) / `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` `rawScalar`
    (게이트 214~225)
  - 상세: 커밋 메시지 본문이 `## W1`/`## W2`/`## SPEC-DRIFT` 세 절로 두 코드 수정과 문서(SoT)
    정정을 명시적으로 구분해 서술하고 있어 "의도 이상의 변경"으로 보기는 어렵다 — 둘 다 같은
    `/ai-review 05_27_20` 라운드(WARNING 2 + SPEC-DRIFT 1)가 낸 발견을 반영한 것이고, 이 PR
    이력 전반에 같은 패턴(예: `4e1995cb8`도 두 W항목을 한 커밋에 묶음)이 확립돼 있다. 다만
    두 결함이 논리적으로 독립적(경로 정규화 vs 정규식 이스케이프)이라 커밋 단위 원자성 관점에서는
    분리 여지가 있었다는 점만 기록해 둔다.
  - 제안: 조치 불요. 향후 유사 라운드에서 결함 성격이 뚜렷이 갈릴 때는 별도 커밋도 고려할 수
    있다는 정도의 참고 사항.

- **[INFO]** `rawScalar` 의 정규식 이스케이프(W2)는 현재 유일한 호출부(`"started"` 리터럴)에는
  즉시 영향이 없는 방어적 하드닝이다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 게이트 219~221
    (`const escaped = key.replace(...)`)
  - 상세: 커밋 메시지·인라인 주석 모두 "지금 즉시 위험은 없으나 export 된 범용 유틸이라
    메타문자가 오면 조용히 틀어진다"고 명시해 근거를 밝히고 있고, 이 자체가 `/ai-review` 가
    지적한 항목(W2)에 대한 반응적 수정이라 "요청하지 않은 기능 확장"으로 보기는 어렵다.
    다만 현재 도달 불가능한 방어 코드라는 점은 유지보수 관점에서 참고할 만하다(별도
    maintainability 리뷰 영역과 겹칠 수 있음).

## 스코프 확인 — 관련 없는 파일/영역 혼입 여부

- `spec-plan-completion.test.ts`/`plan-scan.ts`/`plan-scan.test.ts` 세 파일 모두 이번 작업의
  주제(Gate C — plan-completion spec-consistency 하드닝)와 직접 관련된 코드/테스트만 포함한다.
  불필요한 리팩토링, 무관 파일 수정, 포맷팅-only 변경, 임포트 정리, 설정 변경은 발견되지 않았다.
- `plan-scan.ts` 헤더 주석이 언급하는 walker 통합("네 벌 → 한 벌")은 이번 diff 범위 밖이며,
  실제로 남은 통합 여지(‵spec-links.ts` 내부 두 walker, Gate C 의 `collectCompletePlans`)는
  `plan/in-progress/docs-guard-walker-dedup.md` 로 명시적으로 분리돼 있다 — 스코프를 넓히지
  않으려는 의도적 절제가 확인된다(긍정적 신호).
- `git diff HEAD~1` 로 확인한 최신 커밋에 추가로 딸린 `.claude/docs/plan-lifecycle.md` 변경
  (SPEC-DRIFT 정정)은 review 대상 3파일 밖이지만, 커밋 메시지에 근거가 명시돼 있고 게이트
  판정 로직 변경에 따른 SoT 문서 동기화로 정당하다 — 임의 확장이 아니다.
- 디버그 아티팩트(`console.log`/`TODO`/`FIXME`/`eslint-disable`) 신규 추가 없음(grep 확인).
- 사용하지 않는 임포트 추가/불필요한 정리 없음 — 이번 diff 는 신규 import 를 추가하지 않았다.

## 요약

리뷰 대상 3개 파일의 최신 변경은 직전 `/ai-review` 라운드(05_27_20)가 낸 WARNING 2건 +
SPEC-DRIFT 1건에 대한 반응적 수정으로, 요청 범위(Gate C `spec_impact` 경로 검증 하드닝)를
벗어나지 않는다. 한 커밋에 두 개의 독립적 결함 수정이 묶여 있으나 커밋 메시지가 둘을 명확히
구분해 서술하고 있고 이 PR 의 확립된 패턴과 일치해 문제로 보지 않는다. 무관한 파일 수정,
불필요한 리팩토링, 포맷팅 혼입, 임포트/설정 변경은 발견되지 않았고, 오히려 walker 통합처럼
스코프를 넓힐 수 있었던 지점을 별도 plan(`docs-guard-walker-dedup.md`)으로 의도적으로
분리한 점이 확인된다.

## 위험도

NONE
