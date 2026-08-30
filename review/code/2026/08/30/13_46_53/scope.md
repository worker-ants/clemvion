### 발견사항

- **[INFO]** `update-returning-rows.spec.ts` 의 `SRC` 상수를 파일 상단으로 hoist — 새 `describe` 블록과 무관한 기존 코드를 함께 건드림
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (import 직후 신설 `const SRC = join(__dirname, '..', '..');` + 기존 `describe('UPDATE/DELETE 결과를 직접 소비하는 지점이 다시 생기지 않는다', ...)` 안에서 동일 선언 제거)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/common/utils/update-returning-rows.spec.ts` 로 직접 대조 확인했다. 이 hoist 는 새로 추가하는 두 `describe` 블록이 `SRC` 를 공유해야 해서 나온 결과이고, 커밋 코멘트가 이전 라운드(`13_15_58` maintainability INFO 2, "SRC 상수가 같은 파일 내 두 describe 블록에 재선언된다")를 명시적으로 인용한다 — 지어낸 근거가 아니라 실제 이전 리뷰 라운드의 발견사항을 정정한 것이다. 순수 리팩터링이지만 (1) 대상 파일이 이미 이번 PR 로 크게 손을 대는 파일이고 (2) 변경이 상수 위치 이동 한 줄뿐이며 (3) 근거가 문서화돼 있어, "관련 없는 코드 정리"로 보기 어렵다.
  - 제안: 조치 불요 — 근거가 명확하고 위험이 없는 최소 침습 정리다.

- **[INFO]** `kb-stats.helper.ts` / `kb-stats.helper.spec.ts` production 코드·mock 수정이 표제("raw UPDATE 가드를 큐레이션→발견형으로 확장")보다 넓다 (carry-over, 신규 아님)
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(`refresh()` 내부 `dataSource.query<...>` 제네릭 인자 튜플화), `kb-stats.helper.spec.ts`(mock을 `[[...], count]` 튜플로 정정)
  - 상세: 새 발견형 스캐너가 이 파일을 잡아내자, allowlist 에 사유를 적어 면제하는 대신 타입 자체를 정정했다. 이는 `review/code/2026/08/30/12_41_15/scope.md`와 `review/code/2026/08/30/13_15_58/scope.md` 두 라운드 모두 이미 INFO로 판정·기록한 항목과 정확히 같은 대상이며, 이번 라운드(`13_46_53`)에서 그 판정 범위가 넓어지지도 않았다(`git diff origin/main...HEAD -- codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts.spec.ts` 로 직접 재확인, diff는 타입 인자 1줄 + 설명 주석뿐). 런타임 SQL·바인딩은 불변, 반환값은 여전히 미소비라 실질 동작 변화 없음. plan 완료 배너(`plan/in-progress/update-returning-tuple-shape.md`)에 "allowlist 대신 직접 고쳤다"는 판단 근거가 명시돼 있다.
  - 제안: 조치 불요(이전 두 라운드에서 이미 승인·기록됨, 확대 없음).

- **[정보 확인 — 문제 없음]** 41개 변경 파일 전수가 실제 diff와 정확히 일치, 숨은 변경 없음
  - 확인 방법: `git diff --stat origin/main...HEAD` 와 `git log --oneline origin/main..HEAD`(커밋 11개: `2fde73934`~`fb8662733`)를 직접 실행해 프롬프트에 제시된 41개 파일·게이트 번호와 1:1 대조했다. `CHANGELOG.md`(+22/-0), `source-scan.ts`(+67/-0), `source-scan.spec.ts`(+100/-1), `update-returning-rows.spec.ts`(+250/-11 중 대부분 신규), `kb-stats.helper.{ts,spec.ts}`(+9-2, +11-2), `plan/in-progress/update-returning-tuple-shape.md`(+41/-1) 모두 실측값이 프롬프트 서술과 일치했다.
  - 신규 import(`readdirSync`/`relative`/`sep`/`countRawUpdateReturning`/`hasRawUpdateReturning`)는 전부 실사용을 확인했다(`grep`). 사용하지 않는 import·죽은 export 없음.
  - 나머지 28개 파일은 `review/code/2026/08/30/{12_41_15,13_15_58}/**` (두 차례 이전 리뷰/RESOLUTION 라운드 산출물)과 `review/consistency/2026/08/30/12_17_21/**`(consistency-check 산출물)로, `CLAUDE.md`가 정한 정확한 경로 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`)에 위치하며 이 프로젝트가 구현 완료 후 상시 승인된 강제 워크플로(`/ai-review` + fix + `--impl-prep` consistency-check)로 요구하는 정상 산출물이다. 스코프 이탈이 아니다.
  - 저장소 트리에 남은 뮤테이션 잔여물(`*.bak`, 프로브 파일 등)도 `find codebase/backend/src -iname "*raw-update-probe*" -o -iname "*.bak"`로 확인한 결과 없음, `git status --short`도 이번 리뷰 세션 자체의 출력 디렉터리 외 잔여 없음.
  - 포맷팅 잡음·설정 파일 변경·불필요한 주석 변경도 발견되지 않았다. 추가된 모든 주석은 "왜"를 설명하는 신규 함수/블록에 국한된다.

### 요약

이번 diff(41개 파일, +2294/-11)는 매우 명확하게 스코프 안이다. `git diff --stat`·`git log`를 직접 실행해 프롬프트가 제시한 파일·라인 수를 전수 대조한 결과 숨겨진 변경은 없었다. 핵심 변경(`source-scan.ts`/`source-scan.spec.ts`의 발견형 스캐너, `update-returning-rows.spec.ts`의 개수 기반 판정 가드)은 선언된 목표("큐레이션 목록 → 전수 발견")에 정확히 국한된다. 두 개의 경계 사례 — `update-returning-rows.spec.ts`의 `SRC` 상수 hoist(기존 코드 소폭 정리)와 `kb-stats.helper.ts`의 production 타입 정정(테스트 가드가 스스로 찾아낸 결함의 즉시 수정) — 는 둘 다 이전 리뷰 라운드가 이미 명시적 근거와 함께 검토·판정한 항목의 반복이며, 이번 라운드에서 범위가 확대되지 않았다. 나머지 28개 파일은 이 저장소가 CLAUDE.md로 강제하는 리뷰/일관성-검토 워크플로 산출물로, 정해진 경로에 정확히 위치해 스코프 이탈이 아니다. 사용하지 않는 import, 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 잡음, 설정 파일 변경은 발견되지 않았다.

### 위험도
NONE
