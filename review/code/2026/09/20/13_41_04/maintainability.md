# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

이번 프롬프트는 머지된 `schedule-cron-flake` 작업의 전체 diff(main 기준)를 담고 있고, 그중 실제 "코드"는
`codebase/backend/test/schedule-trigger.e2e-spec.ts` 한 파일뿐이다. 나머지(`plan/**`, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/**`,
`review/consistency/2026/09/20/{11_21_16,13_34_15}/**`)는 이번 작업이 4라운드에 걸쳐 스스로 산출한 plan 문서·리뷰
산출물이며, 사람이 직접 짜서 유지보수하는 소스가 아니라 유지보수성 8관점(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성)의
대상이 아니다. 이 산출물들 자체는 4라운드 동안 이미 각 라운드의 maintainability 리뷰(`review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/maintainability.md`)가
반복 검토했고 매번 위험도 NONE 이었다 — 재조사해도 새 결함이 없다.

뮤테이션 없이 읽기 전용으로 분석했다(`git status --short` 변화 없음).

## 발견사항

### `schedule-trigger.e2e-spec.ts` — 실질 코드 변경분

최종 상태를 직접 열어 확인(`codebase/backend/test/schedule-trigger.e2e-spec.ts:54-108`, 'D. PATCH cron → nextRunAt 재계산' 케이스).

- **[INFO]** 시간창 허용 오차(`30_000`·`90_000`)가 이름 없는 인라인 리터럴
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:94-95`
  - 상세: `expect(nextRunMs).toBeGreaterThan(patchedAt - 30_000)` / `toBeLessThanOrEqual(patchedAt + 90_000)` 의 두 숫자가 매직 넘버다. 다만 바로 위(91-92행)에 근거 주석("분 단위 cron 의 다음 실행은 늘 다음 분 경계 — 요청 시각부터 60초 안이다. 여유 30초는 e2e 부하 몫")이 붙어 있고, 같은 파일 다른 케이스(`:112`, `Date.now() - 60_000`)도 동일하게 "인라인 리터럴 + 근거 주석" 패턴을 쓴다 — 파일 기존 컨벤션과 일치하며 이번에 새로 생긴 위반이 아니다.
  - 제안: 조치 불요. 같은 성격의 허용창이 세 번째로 등장하면 그때 상수화(`PER_MINUTE_CRON_TOLERANCE_MS` 등)를 고려.

- **[INFO]** 연 1회 cron 리터럴 `'0 0 1 1 *'` 이 D·E 두 케이스에서 중복
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:79`(D, 이번 diff), `:117`(E, 기존 — 위치는 diff 밖이지만 값이 같음을 직접 grep 으로 확인)
  - 상세: 각 `it()` 이 cron 리터럴을 스스로 인라인으로 드는 것이 파일 전체(C/G/H 등)의 기존 패턴이라, D 가 E 와 같은 값을 쓰는 것 자체는 새로운 위반이 아니다. plan 문서(`plan/complete/schedule-cron-flake.md` §할 것 1)도 "같은 파일 E 케이스가 쓰는 값"이라는 근거를 명시해 의도된 재사용임을 밝히고 있다.
  - 제안: 조치 불요. 세 번째 사용처가 생기면 헬퍼/상수 추출을 고려.

- **가독성/일관성 (양호, 발견사항 아님)**: 새로 추가된 JSDoc(`:54-71`)은 "무엇을 재계산 판정 지표로 안 쓰는지 → 왜 대리 지표가 무너지는지 → 무엇을 대신 보는지 → 남는 잔여가 무엇인지" 순으로 구성되어 있고, 근거를 각 문단마다 구체적 리뷰 세션 경로로 인용한다. 이 파일의 다른 케이스 앞 설명 주석(예: V110 인덱스 테스트, J 테스트)과 어조·형식이 일치한다. `patchedAt`/`nextRunMs` 네이밍도 이 파일의 기존 변수명(`scheduleId`, `nextRuns`)과 카멜케이스·의미 전달 면에서 일관적이다. 테스트 본문 길이(`it('D. ...')` 약 37줄, JSDoc 제외 시 약 20줄)와 중첩 깊이(0단 — 순차 statement 만)도 파일 내 다른 테스트 대비 과도하지 않다.

### plan/review 산출물 (`plan/complete/schedule-cron-flake.md`, `spec-draft-nullable-notation-followups.md` 증분, `review/**`)

- 발견사항 없음. plan 문서는 저장소 템플릿(frontmatter → 무엇이 문제인가 → 실측 → 할 것 → 비대상 → 테스트 → 체크리스트)을 그대로 따르고, 체크리스트 취소선(`~~생성 cron 의 값은 그 창 밖임을 함께 단언한다~~`)으로 폐기된 대안을 남겨 이력을 보존하는 방식도 이 저장소의 관례(자기-반증형 정정)와 일치한다. 트래커(`spec-draft-nullable-notation-followups.md`) 증분은 기존 항목 하나를 체크(`[ ]` → `[x]`)하고 후속 항목 둘을 새로 등재하는 정형적 편집이라 구조적 문제가 없다.

## 요약

이번 diff 의 실질 코드 변경은 e2e 테스트 한 케이스의 cron 리터럴 교체 + 판별 단언 3줄 교체뿐이며, 범위가 작고 근거 주석이
충분하다. 매직 넘버(30초/90초 허용창)와 cron 리터럴 중복은 모두 이 파일의 기존 스타일(인라인 리터럴 + 근거 주석, 테스트별
자기완결 fixture)을 그대로 따르므로 새로운 유지보수성 결함으로 보기 어렵다 — 4라운드에 걸쳐 이미 동일한 결론(INFO, 조치 불요)에
도달했고, 이번 재검토에서도 다른 결론에 이르지 않았다. plan·review 산출물도 저장소 관례를 준수한다. CRITICAL/WARNING 급
발견사항은 없다.

## 위험도

NONE
