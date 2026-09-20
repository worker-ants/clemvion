# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 「D. PATCH cron → nextRunAt 재계산」 케이스의 cron 리터럴 교체 + 판별 단언 추가 (실제 코드 변경의 전부)
- `plan/in-progress/schedule-cron-flake.md` — 신규 plan 문서 (프로세스 산출물)
- `review/consistency/2026/09/20/11_21_16/*.{md,json}` — 이번 작업의 `--impl-prep` consistency-check 산출물 (자동 생성 리포트/상태 파일)

뮤테이션 없이 읽기 전용으로 분석했다 (`git status --short` 변화 없음, 저장소에 아무것도 쓰지 않았다).

## 발견사항

### `schedule-trigger.e2e-spec.ts` (실제 코드 변경)

- **[INFO]** 허용 오차 상수(5초·65초)가 인라인 리터럴
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:314-315`
  - 상세: `expect(nextRunMs).toBeGreaterThan(patchedAt - 5_000)` / `toBeLessThanOrEqual(patchedAt + 65_000)` 의 `5_000`·`65_000` 이 이름 없는 리터럴이다. 다만 바로 위 줄(313번)에 "`*/1 * * * *` 의 다음 실행은 늘 다음 분 경계 — 요청 시각부터 60초 안이다(경계·시계 오차로 5초 여유)" 라는 근거 주석이 붙어 있고, 같은 파일의 기존 테스트 A(line 112, `Date.now() - 60_000`)도 같은 방식(인라인 리터럴 + 주석)을 쓰고 있어 이 파일의 기존 컨벤션과 일치한다. 새로 도입된 결함이 아니라 기존 스타일을 그대로 따른 것.
  - 제안: 지금 형태로도 근거가 명확해 급히 고칠 필요는 없다. 이런 시간창 허용값이 세 번째로 등장하면 그때 `MINUTE_CRON_TOLERANCE_MS` 류의 이름 있는 상수로 뽑는 것을 고려.

- **[INFO]** 연 1회 cron 리터럴 `'0 0 1 1 *'` 이 D·E 두 케이스에서 중복
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:298`(D), `:336`(E — 기존 코드, 이번 diff 밖)
  - 상세: 이번 수정으로 D 케이스가 기존 E 케이스와 동일한 cron 리터럴을 쓰게 됐다. plan 문서(`plan/in-progress/schedule-cron-flake.md` §할 것 1)가 "같은 파일 E 케이스가 쓰는 값" 이라고 명시적으로 근거를 남겨 의도된 재사용임이 분명하고, 각 `it()` 이 자기 완결적으로 fixture 를 만드는 것이 이 파일의 기존 패턴(C/G/H/I 등 모두 각자 cron 리터럴을 인라인으로 든다)이라 새로운 위반은 아니다.
  - 제안: 조치 불요. 세 번째로 "겹칠 수 없는 연 1회 cron" 이 필요해지면 그때 헬퍼/상수화를 고려.

- **가독성/일관성 (양호, 발견사항 아님)**: 새로 추가된 JSDoc 스타일 주석(`283-290`)이 "무엇이 문제였는지 → 왜 대리 지표가 무너지는지 → 무엇을 추가로 보는지"를 근거(실측 인용 `plan/complete/ssrf-catch-instanceof.md`)와 함께 서술하는 방식은, 같은 파일의 다른 `it()` 앞에 붙은 설명 주석들(예: 66-75행 V110 인덱스 테스트, 481-488행 J 테스트)과 형식·어조가 일치한다. `patchedAt`/`nextRunMs` 네이밍도 `originalNext`/`scheduleId` 등 기존 변수명과 카멜케이스·의미 전달 면에서 일관적이다. 함수 길이(`it('D. ...')` 본문 약 35줄)·중첩 깊이(0단 — 순차 statement 만)도 파일 내 다른 테스트 대비 과도하지 않다.

### `plan/in-progress/schedule-cron-flake.md`

- 발견사항 없음. 이 저장소의 plan 템플릿(frontmatter → 무엇이 문제인가 → 실측 → 할 것 → 비대상 → 테스트 → 체크리스트)을 그대로 따르고 있고, 실측치·인용 경로가 구체적이라 다음 사람이 재구성할 필요 없이 읽힌다.

### `review/consistency/2026/09/20/11_21_16/*` (자동 생성 리포트/상태 파일)

- 코드가 아닌 사람이 직접 손으로 유지보수하지 않는 1회성 산출물(checker 리포트 markdown, `meta.json`, `_retry_state.json`)이라 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도 관점의 유지보수성 리스크가 원천적으로 낮다. 훑어본 결과 구조적 이상(예: 불필요하게 큰 중복 블록, 깨진 표 등)은 없었다.

## 요약

이번 변경은 사실상 e2e 테스트 파일 한 곳의 cron 리터럴 교체 + 판별 단언 2줄 추가로, 범위가 매우 작고 근거 주석이 충분하다. 새로 추가된 매직 넘버(5초/65초 허용창)와 cron 리터럴 중복은 모두 이 파일의 기존 스타일(인라인 리터럴 + 근거 주석, 테스트별 자기완결 fixture)을 그대로 따르고 있어 새로운 유지보수성 결함으로 보기 어렵다. plan 문서와 consistency-check 산출물도 저장소 컨벤션을 준수한다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
