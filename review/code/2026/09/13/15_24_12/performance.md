# 성능(Performance) 리뷰 — guide-identifier-existence (라운드 3 재검토)

## 범위 안내

이번 changeset(71개 파일)에서 런타임에 실제로 실행되는 코드는 `guide-identifier-existence.test.ts`·
`guide-identifier-scan.ts`(구 `guide-error-code-*` 삭제 → 대체)뿐이다. 나머지는 `CHANGELOG.md`·
`PROJECT.md` 문구 갱신, `plan/in-progress/*.md`, `review/code/**`·`review/consistency/**` 산출물로
전부 문서·리포트이며 실행 경로와 무관하다.

이 라운드(`15_24_12`)의 실질 코드 델타는 이전 리뷰 라운드(`14_41_14`, `15_03_06`)가 이미 검토한
`guide-identifier-scan.ts`(무변경, round 2 diff 확인)를 제외하면, `guide-identifier-existence.test.ts`에
대한 **round 2 fix 커밋**(`938060138`)뿐이다: `root`/`readIfPresent`/`envExampleTexts` 를 `describe()`
콜백 내부에서 모듈 최상위 스코프로 옮기고(참조 위치 변경일 뿐 실행 시점·횟수는 동일 — 여전히 파일
로드 시 1회), `collectEnvDeclarations` 분기 커버리지를 겨눈 합성 fixture 테스트 5개를 추가했다.
이 5개 테스트는 전부 몇 줄짜리 인메모리 문자열을 인자로 받아 실행되는 트리비얼한 순수 함수
호출이라 성능 영향이 없다.

`git diff 69847f45f 938060138 -- codebase/frontend/.../guide-identifier-existence.test.ts` 로 확인한
결과 위 변경 외에 프로덕션 로직(`guide-identifier-scan.ts`)이나 I/O 패턴 변경은 없다.

## 발견사항

- **[INFO]** `composeTexts` 가 `docker-compose*.y{a,}ml` 로 좁혀진 상태가 이번 라운드에도 유지됨 —
  새 결함 아님, 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`
  - 상세: 이전 라운드(`14_41_14`)의 WARNING("루트의 모든 `.yml`/`.yaml`을 읽어
    `pnpm-lock.yaml`(784KB) 포함 스캔")이 `.filter((f) => /^docker-compose.*\.ya?ml$/.test(f))` 로
    해소된 상태 그대로다. 이번 diff 는 이 부분을 건드리지 않았다(round 2 는 `.env.example`/
    compose 병합 로직 자체가 아니라 스코프 위치와 신규 테스트만 추가).
  - 제안: 조치 불요.

- **[INFO]** `collectEnvDeclarations`/env 기준집합 병합은 여전히 매 실행마다 계산되며 오늘
  판정에는 기여하지 않는다 — 절대 비용(`.env.example` 2개 + compose 2개, 총 수백 줄)이 미미해
  성능 결함 수준이 아님. 코드 주석(`guide-identifier-scan.ts:183-190`)과 새로 추가된 대조군
  테스트(`guide-identifier-existence.test.ts:206-245`)가 "왜 이 병합을 지탱 안 하는 채로
  유지하는가"를 뮤테이션 실측과 함께 명시하고 있어 근거가 투명하다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:9-16`
    (모듈 스코프로 이동한 `envExampleTexts`), `:60-62`(`basis` 병합)
  - 제안: 조치 불요.

- **[INFO]** 가드 계열 전체가 `codebase/backend/src` + `codebase/packages` 를 가드별로 독립
  재적재(walk+read)하는 기존 구조가 그대로 유지됨 — 이번 PR 이 새로 만든 비용 증가는 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:45-48`
  - 상세: `describe()` 콜백은 vitest 수집 시점에 **파일당 1회**만 실행되므로 이 파일 내부의
    15개+ `it()` 블록이 소스 재적재를 반복하지는 않는다(N+1 아님). 다만 자매 가드
    (`impl-anchor-existence.test.ts` 등)가 각자 같은 두 디렉터리를 독립적으로 walk 하는 구조는
    가드 개수가 늘수록 스위트 전체 I/O+정규식 스캔 총량이 선형으로 커진다 — 이전 두 라운드가
    이미 지적한 트레이드오프이며 이번 PR 범위의 회귀는 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 후속으로 가드가 늘면 backend+packages 소스 텍스트를
    여러 테스트 파일이 공유하는 모듈 레벨 캐시를 검토할 가치는 있다(기존 지적 유지).

- **[INFO]** 정규식 패턴(`UPPER_SNAKE`/`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`/
  `collectSourceTokens`/`collectEnvDeclarations` 내부 패턴) 무변경 — 이차 백트래킹(ReDoS) 형태
  아님, 이전 두 라운드 판단과 동일
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(무변경, round 2 diff
    에 포함되지 않음)
  - 제안: 조치 불요.

## 요약

이 라운드의 실질 코드 변경은 `guide-identifier-existence.test.ts`에 한정되며, 내용은 변수 스코프
재배치(모듈 레벨로 끌어올림 — I/O 횟수·시점 불변)와 `collectEnvDeclarations` 분기 커버리지를
겨눈 5개의 트리비얼한 합성-fixture 유닛 테스트 추가뿐이다. `guide-identifier-scan.ts`(핵심
스캐너 로직)는 이번 diff 에 포함되지 않아 이전 라운드(`15_03_06`)의 "선형·안전" 판정이 그대로
유지된다. 이전 라운드가 지적했던 유일한 성능 WARNING(`composeTexts` 과다 스코프)은 이미 해소된
채로 유지되고 있음을 재확인했다. 신규 CRITICAL/WARNING 급 성능 결함은 없다.

## 위험도

NONE
