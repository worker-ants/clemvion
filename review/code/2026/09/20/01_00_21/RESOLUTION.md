# RESOLUTION — 컬럼 층 가드의 남은 빈칸 (1라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 8. 정지 규칙(리뷰 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인 라운드에서 수렴,
최대 3라운드.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W2 기본값 왕복 테스트의 연결이 새어 나갈 수 있음 | `connect()` · `startTransaction()` 을 `try` 안으로. `finally` 는 `isTransactionActive` 일 때만 롤백하고, 롤백이 던져도 안쪽 `finally` 로 `release()` | `a71642fe0` |
| INFO 1 두 테스트의 `try`/`finally` 관용구가 다름 | 읽기 전용 테스트도 `initialize()` 를 `try` 안에, `finally` 는 `isInitialized` 일 때만 `destroy()` — 컬럼 층 테스트와 같다 | `a71642fe0` |
| INFO 7 헤더가 새 테스트를 말하지 않음 | «컬럼 층은 양방향이다» 문단 끝에 두 테스트의 목적 · 근거 plan | `a71642fe0` |
| W1 `--impl-prep` scope(`spec/2-navigation/`)가 이 작업과 무관 | **코드 밖 · 조치 없음(근거 기록).** `--impl-prep` 은 디렉터리만 받는데 이 작업의 spec(`spec/1-data-model.md`)은 `spec/` 최상위 파일이라 직접 줄 수 없다 — 이 가드를 다룬 앞선 PR 과 같은 선례를 따랐다. 리뷰어가 적은 «보정 블록을 한 checker 만 받았다» 는 사실이 아니다 — `_prompts/` 다섯 파일 모두에 한 번씩 붙어 있다(`grep -c "main 추가"` → 1 × 5; `_prompts/` 는 gitignore 라 리뷰어가 볼 수 없었다). scope 가 끌어온 무관한 spec 공백(WARNING 2 · INFO)은 마무리 커밋에서 트래커의 planner 항목으로 등재한다(INFO 2 도 이것) | 마무리 |
| INFO 3 · 4 · 5 · 6 · 8 | 조치 없음 — 3: 부모 행 raw INSERT 는 파일별 자기완결 선례(넷째 파일이 필요하면 헬퍼) · 4: 두 컬럼이 같은 부모 · 트랜잭션을 공유해 한 `it` · 5: 부모 행은 검증 대상이 아니고, 스키마가 바뀌면 이 가드 파일이 먼저 알아야 하는 자리다 · 6: 판별력 기록은 plan 과 커밋 본문(뮤턴트 셋) · 8: 부수 효과 없음 확인 | — |

## TEST 결과

- lint: 통과 (재실행 — 1라운드 조치 뒤)
- unit: 통과
- build: 통과
- e2e: 통과 (366)
