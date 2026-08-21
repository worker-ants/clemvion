# 유지보수성(Maintainability) Review — masked-marker-contract-7d2e14 (round 12_25_15)

## 발견사항

- **[WARNING]** `resolveScanDirs` 의 "파생" 이 `codebase/` 바로 아래 한 단계만 내려가, `codebase/packages/**` (SoT 패키지를 제외한 7개 형제 워크스페이스 패키지 — `ai-end-reason`/`expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation`/`sdk`/`web-chat-sdk`) 를 스캔 대상에서 통째로 빠뜨린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수 `resolveScanDirs` (44-53행) / `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수 `resolveScanDirs` (39-48행) — 두 사본 동일 로직
  - 상세: `resolveScanDirs` 는 `codebase/` 의 **직계 자식**만 나열해 `codebase/<child>/src` 존재 여부로 필터링한다. 직접 실행해 확인한 실제 반환값은 `['codebase/backend/src', 'codebase/channel-web-chat/src', 'codebase/frontend/src']` 세 개뿐이다 — `codebase/packages/src` 라는 디렉터리 자체가 존재하지 않으므로(각 패키지는 `codebase/packages/<pkg>/src` 처럼 한 단계 더 깊다) `packages` 서브트리 전체가 필터를 통과하지 못한다. 즉 `codebase/packages/ai-end-reason/src`, `codebase/packages/sdk/src` 등 7개 형제 패키지의 소스는 **단 한 번도 `findMirrorRedeclarations` 에 전달되지 않는다.** 함수 JSDoc 은 "스택이 늘어도 자동으로 포함된다" 고 서술하지만 이는 `codebase/` 바로 아래 새 스택(`backend`/`frontend`/`channel-web-chat` 같은)에만 해당하고, `codebase/packages/` 아래 새 내부 패키지에는 해당하지 않는다 — 이 비대칭이 함수 어디에도 문서화돼 있지 않다. 부수 효과로, `findMirrorRedeclarations` 안의 `SOT_DIR` 자기 제외 분기(`relPath.startsWith(SOT_DIR...)`, backend 132행/frontend 134행)는 애초에 `codebase/packages/**` 경로가 스캔 결과에 들어오지 않으므로 **현재 도달 불가능한 코드**다(이 표면적 사실 자체는 `11_27_29` RESOLUTION 의 "미조치 INFO" 목록에 "방어적 no-op" 로 이미 짧게 언급됐으나, 그 문서는 이를 "SoT 자신만 제외되는 셈이라 무해하다"는 톤으로 남겼을 뿐 — SoT 패키지 하나가 아니라 **7개 형제 패키지 전체**가 스캔 밖이라는, 이 가드의 핵심 보장("SoT 패키지 밖에서 마커 심볼을 재선언하지 않는다")에 실질적으로 구멍을 내는 사실까지는 명시하지 않았다). 캐너리 테스트("[캐너리] 스캔 대상 파일 목록이 비어 있지 않다", backend spec 43-51행/frontend test 52-61행)는 `dirs.length >= 3` 과 파일 합계 `> 500` 만 확인하므로, 지금의 "정확히 3개 최상위 디렉터리만 스캔됨" 상태를 그대로 GREEN 으로 통과시킨다 — 이 갭을 잡아내지 못하는 형태의 vacuous-방지다. 다른 내부 패키지가 실수로(또는 복붙으로) `MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH` 같은 이름을 재선언해도, 이 PR 의 핵심 목적인 "미러 재발 감지" 가 조용히 놓친다 — 이 PR 이 다른 두 라운드(`11_27_29`/`11_53_49`)에서 이미 두 번 겪은 "가드 커버리지가 서술보다 좁다" 패턴의 세 번째 사례에 해당한다.
  - 제안: `resolveScanDirs` 를 재귀적으로(또는 `codebase/*/src` 뿐 아니라 `codebase/packages/*/src` 도 명시적으로) 확장해 `codebase/packages/` 아래 각 워크스페이스 패키지의 `src` 도 스캔 목록에 포함시킨다. 최소한 캐너리 테스트에 "`codebase/packages/` 아래 SoT 가 아닌 다른 패키지의 `src` 도 스캔 목록에 들어 있다"를 직접 단언하는 항목을 추가해, 향후 리팩터가 이 갭을 다시 만들어도 GREEN 으로 통과하지 않도록 한다.

- **[INFO]** frontend `masked-marker-mirror.test.ts` 에 backend 쌍둥이 파일에는 없는 이중 빈 줄이 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:62-63` (`it("[캐너리] 스캔 대상 파일 목록이 비어 있지 않다", …)` 블록의 닫는 `});` 직후)
  - 상세: 61행 `});` 다음 62·63행이 연속으로 빈 줄이고, 64행에 다음 테스트의 JSDoc 이 이어진다. 파일의 다른 모든 `it`/`describe` 블록 사이는 빈 줄 하나로 일관되고, "완전히 동일해야 한다"고 헤더·이전 리뷰(11_53_49 maintainability INFO)가 명시한 backend 쌍둥이(`masked-marker-mirror.spec.ts`)에는 이 이중 빈 줄이 없다(직접 대조 확인). 기능에는 영향 없는 순수 스타일 흠집이지만, "두 사본이 동일해야 안전하다"는 이 가드의 설계 전제와 맞물려 두 사본이 diff 단위로 미세하게 갈리고 있다는 정황을 하나 더 보탠다.
  - 제안: 빈 줄 하나를 제거해 파일 내 다른 블록·backend 쌍둥이 파일과 형식을 맞춘다.

- **[INFO]** (참고, 조치 불요) backend/frontend 미러 가드 로직 4개 파일이 quote 스타일 등 표면적 차이만 빼면 여전히 거의 100% 동일한 코드를 담고 있다 — 이미 `11_27_29`/`11_53_49` 라운드에서 검토·수용된 의도된 트레이드오프(각 스택이 자기 워크플로에서 도는 독립 사본을 가져야 CI 경로 게이팅을 벗어난다)이므로 새 지적 아님. 이번 라운드에서 다시 짚는 이유는 위 WARNING 이 바로 이 "두 사본을 손으로 계속 맞춰야 한다"는 구조에서 비롯된 새로운 종류의 drift(스캔 범위 로직 자체의 숨은 갭)라는 점을 연결하기 위함이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전체 vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전체
  - 제안: 없음(기존 처분 유지).

- **[INFO]** (참고, 조치 불요) `codebase/packages/masked-markers/package.json` 의 `prepare` 스크립트가 저장소 내 9번째로 동일한 인라인 JS 문자열을 복제한다 — 기존 8개 내부 패키지(`ai-end-reason`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`/`expression-engine`/`sdk`/`web-chat-sdk` 등) 전부가 이미 이 패턴이고, 이번 PR 은 그 관행을 그대로 따랐을 뿐이다(선존 갭, 이전 라운드에서도 동일하게 지적·이월됨).
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`)
  - 제안: 이번 PR 범위 밖. 향후 패키지가 더 늘기 전에 공유 스크립트로 추출하는 것을 장기적으로 검토.

## 요약

이번 PR 의 핵심 산출물 — 손으로 복제되던 마스킹 마커 상수·판정 로직을 `@workflow/masked-markers` 로 추출하고, 재발 방지용 미러-소멸 가드를 backend/frontend 양쪽에 심볼-재선언 탐지 방식으로 배치한 것 — 은 함수가 짧고 책임이 분리돼 있으며(`listSourceFiles`/`findRedeclaredSymbols`/`resolveScanDirs`/`findMirrorRedeclarations`), 이전 두 라운드(`11_27_29`·`11_53_49`)가 지적한 "가드 배치가 서술보다 좁다"류 문제들(backend-only PR 무방비, web-chat 무방비, 감시 목록 자체가 손 복제 미러였던 문제)을 순서대로 닫아 온 성실한 이력을 보여준다. 그런데 이번 라운드에서 실측해 보니, 손 목록을 없애기 위해 도입한 `resolveScanDirs` 의 "디렉터리 실측 파생" 이 `codebase/` 바로 아래 한 단계만 내려가는 얕은 구현이라, 정작 `codebase/packages/` 아래 8개 내부 패키지 중 SoT 자신을 뺀 7개 형제 패키지의 소스가 스캔에서 전부 빠진다 — 이 가드의 존재 이유(마커 심볼이 SoT 밖에서 재선언되면 잡는다)에 직접 구멍을 내는 지점이고, 캐너리 테스트의 하한값(`dirs.length >= 3`, 파일 수 `> 500`)이 우연히 이 축소된 상태에서도 통과해 vacuous 방지가 이 특정 갭은 잡지 못한다. 그 외에는 형식적 이중 빈 줄 하나(INFO)와, 이미 이전 라운드에서 검토·수용된 두 항목(가드 로직 자체의 의도된 이중화, `prepare` 스크립트 9번째 복제)을 참고로만 남긴다. 가독성·네이밍·매직 넘버·순환 복잡도 축에서는 별다른 문제가 없다.

## 위험도
MEDIUM
