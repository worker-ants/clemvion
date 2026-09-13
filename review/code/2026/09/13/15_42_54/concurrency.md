# 동시성(Concurrency) 코드 리뷰

## 발견사항

해당 없음. 이번 변경 세트는 다음으로 구성된다:

- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md`, `review/consistency/**`, `review/code/**/*.md`, `*.json` — 문서·플랜·리뷰 산출물(과거 리뷰 라운드의 아카이브 포함)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제(구 가드, 리네임 전신)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규(대체 가드, 축을 에러 코드 전용 → 식별자 전반으로 확장)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — docstring 한 줄만 리네임 반영

실제 소스(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 현재 파일 전문을 직접 `Read`로 확인)는 `vitest` 프로세스 안에서 단일 스레드로 동기 실행되는 정적 텍스트 스캐너다:

- I/O는 전부 동기 API(`fs.readFileSync`, `fs.readdirSync`, `fs.existsSync`)만 사용한다.
- `async`/`await`/`Promise`/타이머/`Worker`/`child_process`/락/세마포어가 코드 전체에 전혀 없다.
- 모듈 스코프에 정의된 정규식(`FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK`, `envLine`, `composeLine` 등)은 `g` 플래그로 상태(`lastIndex`)를 갖는 공유 객체이지만, 매 호출 진입 시 `rx.lastIndex = 0`으로 명시적으로 리셋한 뒤 그 함수 호출 스택 안에서만 동기적으로 소진되므로 — 단일 스레드 실행 모델에서 재진입(reentrancy) 문제가 발생할 여지가 없다. vitest가 테스트 파일을 별도 워커(프로세스/스레드)로 격리하더라도 각 워커는 이 모듈을 독립적으로 로드하며, 한 워커 내부의 `describe`/`it` 블록들은 (여기서 `test.concurrent`를 쓰지 않았으므로) 순차 실행된다 — 모듈 스코프 정규식 공유가 교차 테스트 경쟁으로 이어지지 않는다.
- `Set`/`Array`/`Map` 등 컬렉션은 각 함수 호출 안에서 지역적으로 생성·소비되며 전역 가변 상태로 남지 않는다.

프롬프트 전체(조립 문서, 이번 라운드 3046줄)에 대해 `async|await|promise|mutex|lock|race|thread|worker|concurren|setTimeout|Promise\.all`을 확인했을 때, 실제 신규/변경 코드 라인에서는 매치가 없었고 매치는 전부 문서 프로즈(과거 리뷰 산출물의 서술)뿐이었다.

## 요약

이번 diff는 유저 가이드 식별자(에러 코드 + 환경변수) 실재성을 검증하는 vitest 정적 분석 테스트/스캐너의 교체(`guide-error-code-*` → `guide-identifier-*`, 축을 문맥-게이팅 3축에서 백틱-전수 3축으로 확장)와 관련 문서·plan·리뷰 산출물 갱신으로 구성되며, 모든 로직이 단일 스레드·동기 실행 경로에서 완결된다. 이전 라운드(`review/code/2026/09/13/14_41_14`, `15_03_06`, `15_24_12`)의 concurrency 리뷰 결론과 일관되게, 이번 라운드에서도 경쟁 조건·데드락·동기화·스레드 안전성·async/await·원자성·이벤트 루프·리소스 풀링 어느 항목도 해당하지 않는다.

## 위험도

NONE
