### 발견사항

- **[INFO]** 가드 신설(테스트) 범위에 production 파일(`kb-stats.helper.ts`) 수정이 딸려 있음
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:26`~`37` (전체 파일 컨텍스트 게이트 기준, `refresh()` 메서드 내부)
  - 상세: 이 PR 의 표제(및 plan 체크리스트 항목)는 "raw UPDATE 가드를 큐레이션→발견형으로 바꾼다"는 테스트 인프라 작업이다. 그런데 새 발견형 스캐너가 `kb-stats.helper.ts` 를 대상으로 잡아내자, 이를 `ALLOWED` allowlist 에 사유와 함께 등재하는 대신 production 코드의 제네릭 타입 인자(`{ entity_count; relation_count }[]` → `[{ entity_count; relation_count }[], number]`)를 직접 정정하고 설명 주석 7줄을 추가했다. 커밋 메시지·plan 완료 배너에 이 판단(왜 allowlist 로 덮지 않았는지)이 명시적으로 근거와 함께 기록돼 있고, 변경은 타입 레벨에 국한되며 런타임 SQL·동작은 전혀 바뀌지 않는다(반환값을 애초에 소비하지 않으므로 무해).
  - 판단: 엄밀히는 "가드 신설"이라는 선언된 범위를 넘어 "가드가 찾아낸 결함의 즉시 수정"까지 포함한 확장이지만, (1) 그 결함이 바로 이 PR 이 방지하려는 결함 클래스(거짓 타입 선언이 향후 오용을 유발)의 실례였고, (2) allowlist 로 덮는 대안을 고려했다가 명시적으로 기각했으며, (3) diff 가 타입 주석 한 줄 + 설명 주석에 그쳐 최소침습적이라 전형적인 "의도치 않은 부수 변경"과는 성격이 다르다. 위험도 낮음 — 다만 통합 리뷰 시 "test(backend):" 커밋 표제만 보고 이 production 수정을 놓치지 않도록 표기해 둔다.
  - 제안: 별도 조치 불요. 다만 커밋 표제에 `fix` prefix 병기(예: `test(backend): ... (+ fix: kb-stats.helper.ts 타입 정정)`)를 고려하면 다음 사람이 diff-stat 만 보고 놓치는 일을 줄일 수 있다.

### 요약

리뷰 대상 12개 파일 중 핵심 변경은 4개(`source-scan.ts` 신규 함수, `update-returning-rows.spec.ts` 신규 describe 블록, `kb-stats.helper.ts` 타입 정정, plan 문서 갱신)이고 나머지 8개는 `review/consistency/2026/08/30/12_17_21/**` 로 이 저장소가 의무화한 `--impl-prep` consistency-check 산출물이다 — CLAUDE.md 가 명시한 워크플로 필수 단계이자 기존 커밋들에서 반복 관측되는 정상 패턴이므로 범위 이탈이 아니다. `git diff --stat origin/main...HEAD` 로 대조한 결과 프롬프트에 제시된 12개 파일이 전체 diff 와 정확히 일치해 숨은 변경은 없다. 신규 import(`readdirSync`/`relative`/`sep`/`hasRawUpdateReturning`)는 전부 실사용되고, 불필요한 리팩토링·포맷팅 변경·무관 파일 수정은 발견되지 않았다. 유일한 경계 사례는 `kb-stats.helper.ts` 의 production 타입 수정으로, "테스트 가드 신설"이라는 선언된 범위를 기술적으로는 넘지만 같은 결함 클래스를 다루는 이 PR 의 취지에 정확히 부합하고 근거가 커밋/plan 양쪽에 충분히 기록돼 있어 실질적 위험은 낮다.

### 위험도
LOW
