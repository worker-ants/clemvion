# 성능(Performance) 리뷰 — guide-identifier-existence (post-resolution 재검토)

## 범위 안내

이번 diff 세트(44개 파일)의 실질 코드는 파일 3~9(`guide-error-code-*` 삭제 →
`guide-identifier-*` 신설, `guide-sanitized-message-parity.test.ts` 주석 갱신, plan 문서
2건)뿐이다. 나머지 35개 파일(`CHANGELOG.md`·`PROJECT.md` 및 파일 10~44)은 전부
`review/code/**`·`review/consistency/**` 산출물(마크다운 리포트·`meta.json`·
`_retry_state.json`)이거나 문서 텍스트이며, 런타임에 실행되지 않으므로 성능 관점에서
스킵한다. 이 changeset 은 이전 라운드(`review/code/2026/09/13/14_41_14`)가 이미 리뷰한
코드에 대한 **RESOLUTION 반영 후 재검토**이므로, 이전 라운드의 performance 지적이 실제로
고쳐졌는지를 최우선으로 실측했다.

## 발견사항

- **[INFO]** 이전 라운드 WARNING(`composeTexts` 가 저장소 루트의 모든 `.yml`/`.yaml`을
  읽어 `pnpm-lock.yaml`(784KB) 등 무관 파일까지 스캔)이 실제로 좁혀졌음을 확인 — 새 결함 아님, 해소 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:53-56`
  - 상세: 현재 코드는 `.filter((f) => /^docker-compose.*\.ya?ml$/.test(f))` 로 파일명을
    좁혀 `docker-compose.yml`/`docker-compose.e2e.yml` 외의 YAML(`pnpm-lock.yaml`,
    `pnpm-workspace.yaml` 등)을 더 이상 읽지 않는다. `maintainability.md`/`architecture.md`
    (14_41_14 라운드)가 지적한 "이름·JSDoc 이 약속한 범위보다 구현이 넓다" 문제가 정규식
    필터로 해소됐다. 오늘도 절대 비용은 무시할 수준(compose 파일 2개)이었으므로 성능
    영향 자체는 이전에도 미미했지만, 범위가 저장소 루트 파일 증가에 좌우되지 않게 된 점은
    구조적 개선이다.
  - 제안: 조치 불요.

- **[INFO]** `collectEnvDeclarations`/env 기준집합 병합은 여전히 매 테스트 실행마다
  전체 계산되며 오늘 판정에는 기여하지 않는다 — 기존 지적 유지, 트레이드오프 명시돼 있어 결함 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:44-59`
    (basis 병합), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:183-190`
    (`collectEnvDeclarations` docstring — "오늘 이 병합은 판정을 지탱하지 않는다 —
    뮤턴트가 그것을 반증했다")
  - 상세: `.env.example` 2개 + compose 2개 파일 read/파싱 비용이 매 실행마다 발생하지만
    코드·plan(`plan/in-progress/guide-identifier-existence.md`) 양쪽에 "내일의 오탐 방지"
    목적이 실측(뮤턴트 테스트)과 함께 명시돼 있다. 절대량이 작아(파일 4개) 성능 결함으로
    볼 수준이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 가드 계열 전체가 `codebase/backend/src` + `codebase/packages` 를 파일별로
  독립 재적재하는 기존 구조가 그대로 유지됨 — 이번 PR 이 새로 만든 비용 증가는 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:35-38`
    (`walkTree(...).map((f) => fs.readFileSync(...))`)
  - 상세: `guide-error-code-existence.test.ts` 가 하던 동일 walk+read 를 1:1 대체한 것이라
    이번 diff 로 인한 신규 비용은 없다. 자매 가드(`impl-anchor-existence.test.ts` 등)도
    같은 두 디렉터리를 독립적으로 walk 한다 — 가드 개수가 늘수록 스위트 전체의 I/O+정규식
    스캔 총량은 선형으로 커지는 구조적 여지가 있으나, 이번 PR 범위의 회귀는 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 가드가 더 늘어날 계획이면 backend+packages 소스
    텍스트를 여러 테스트 파일이 공유하는 모듈 레벨 캐시를 후속으로 검토할 가치는 있다.

- **[INFO]** 정규식 패턴 형태 재확인 — 이차 백트래킹(ReDoS) 형태 아님, 판정 불변
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:90`
    (`UPPER_SNAKE`), `:102`(`FIELD_TABLE_NAME`), `:105`(`CODE_FIELD`), `:113`(`BACKTICK`),
    `:163`(`collectSourceTokens` 의 `\b(...)\b`), `:197`/`:205`(`collectEnvDeclarations` 의
    `envLine`/`composeLine`)
  - 상세: 모든 패턴이 `[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+` 형태로 `_` 가 각 반복을 분리해
    중첩 정량자로 인한 지수적 백트래킹 경로가 없다. `g`/`gm` 플래그로 수동 `exec` 루프를
    돌 때마다 `rx.lastIndex = 0` 으로 리셋하고 있어(예: `guide-identifier-scan.ts:140`,
    `:166`, `:199`, `:207`) 상태 누수로 인한 무한 루프·오탐 매치 위험도 없다. 이전
    라운드의 판단(선형, 안전)과 동일하게 재확인.
  - 제안: 조치 불요.

## 요약

이번 changeset 의 실질 코드 변경(파일 3~9)은 순수 vitest 시점 정적 스캐너로, 알고리즘
복잡도는 전부 코퍼스 크기에 선형이고 정규식도 안전한 형태다. 무엇보다 이전 라운드
(`14_41_14`)의 유일한 성능 관련 WARNING — `composeTexts` 가 저장소 루트의 모든
YAML(락파일 포함)을 읽던 문제 — 이 `docker-compose.*\.ya?ml` 정규식으로 실제로 좁혀졌음을
현재 소스에서 직접 확인했다. 나머지 INFO 항목(env 병합의 오늘-무기여, 가드별 독립
재적재)은 전부 이전 라운드에서 이미 문서화된 트레이드오프이며 이번 diff 로 새로 생기거나
악화된 것이 아니다. 이번 diff 의 나머지 35개 파일은 리뷰/컨시스턴시 산출물과 문서
텍스트로 런타임 실행 경로와 무관하다. 신규 CRITICAL/WARNING 급 성능 결함은 발견되지
않았다.

## 위험도

NONE
