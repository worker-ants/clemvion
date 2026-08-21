STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — masked-marker-contract-7d2e14 (라운드 6, 13_14_29)

## 검토 방법

이 PR 은 5라운드째 리뷰 대상이며, 이전 4개 코드 리뷰 라운드(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`)가
차례로 WARNING 을 찾아 수정해 왔다(경로 게이팅 사각지대 → channel-web-chat 무방비 → 감시 목록 자체가
미러 → 스캔 파생이 얕음 → `SOT_DIR` 접두 경계 backend/frontend 비대칭). 프롬프트의 diff 는 이 히스토리
전체(리뷰 산출물 자체)를 포함하지만, 요구사항 관점에서 의미 있는 대상은 실제 코드(`codebase/**`) 변경
이므로 다음을 직접 `Read`/`grep` 으로 현재 저장소 상태와 대조했다(diff 인용이 아니라 최종 파일 실측):

- `codebase/packages/masked-markers/src/index.ts` — 신규 SoT 패키지 본체
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `codebase/frontend/src/lib/utils/masked-markers.ts` — 재export shim
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` + `.spec.ts` / `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` + `.test.ts` — 신규 미러 소멸 가드 (backend/frontend 쌍)
- `spec/5-system/14-external-interaction-api.md` R17 (§마커 SoT 서술) 및 frontmatter `code:`
- `plan/in-progress/masked-marker-shared-package.md` 체크리스트 실제 상태
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (§R17 재제출 거부 가드, 소비처)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (별개 불변식 `MAX_SANITIZE_DEPTH`, 합치지 않았는지 확인)

## 발견사항

이전 라운드(특히 `12_50_37`)가 지적한 backend/frontend 비대칭(경로 접두 경계 하드닝이 backend 에만
적용되고 frontend 는 누락)은 **현재 상태에서 이미 해소**돼 있음을 직접 확인했다 — 양쪽
`findMirrorRedeclarations` 모두 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 형태의
경계 비교를 쓰고(backend `masked-marker-mirror-guard.ts:141`, frontend 동일 파일:143-144), 양쪽
스펙 파일 모두 "SoT 와 접두가 겹치는 형제 패키지는 탐지 대상이다" 캐너리(합성 fixture
`masked-markers-extra`)와 "함수 선언 형태의 재선언을 탐지한다" 캐너리를 대칭으로 갖고 있다. 새로
CRITICAL/WARNING 급 요구사항 불일치는 발견하지 못했다.

- **[INFO] AST 재선언 탐지기가 var/function/class 세 형태만 잡고 enum/namespace 선언은 다루지 않는다 — 다만 이는 문서화된 설계 범위와 정확히 일치하며 현재 SoT 심볼(상수 6개, 함수 1개)에는 적용 가능성이 없다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 의 `visit()` 함수(`findRedeclaredSymbols` 내부, `ts.isVariableDeclaration`/`ts.isFunctionDeclaration`/`ts.isClassDeclaration` 세 분기만 존재), frontend 동일 구조.
  - 상세: JSDoc 자체가 "변수 선언·함수 선언·클래스 선언만 센다"고 명시하고 실제 구현이 정확히 그 세 형태만 처리한다 — 의도와 구현이 일치하며 괴리가 아니다. `export enum MASKED_MARKERS {...}` 나 `namespace` 형태로 재선언되면 이 가드를 우회할 수 있지만, SoT 심볼이 전부 `const`/`function` 이라 실질적으로 도달 가능성이 낮다(누군가 고의로 enum 으로 재구현해야 우회된다). 차단 사유 아님.
  - 제안: 조치 불필요. 향후 SoT 에 enum 형 심볼이 추가되면 `ts.isEnumDeclaration` 분기 보강을 검토.

- **[INFO] `codebase/packages/masked-markers/src/__tests__/index.spec.ts` 의 `MAX_MASK_DEPTH` 단언이 정확한 값(10)이 아니라 "정수·양수"만 고정한다**
  - 위치: `codebase/packages/masked-markers/src/__tests__/index.spec.ts` — `it("MAX_MASK_DEPTH 는 양의 정수다", ...)` (`Number.isInteger`/`toBeGreaterThan(0)` 만 단언)
  - 상세: 파일 헤더가 이 선택을 명시적으로 정당화한다 — "값 자체보다 '둘이 같은 것을 본다' 가 중요하다"는 설계 의도다. 실제 값-경계 회귀(정확히 depth 10/11 에서 마스킹되는지)는 frontend `hasMaskedMarkerLeaf` 테스트가 `nest(10)→true`/`nest(11)→false` 로 이미 고정하고 있어(선행 리뷰 라운드가 확인), 이 spec 파일이 값을 재고정하지 않아도 실질 커버리지 공백은 아니다. backend 쪽 `deepRedactSecrets` 깊이 경계 테스트 부재는 이미 `plan/in-progress/masked-marker-shared-package.md:165` 에 별도 트래커 항목으로 등재돼 있어 새 발견이 아니다.
  - 제안: 조치 불필요(이미 트래커에 있음, 재등재하지 않음).

## Spec Fidelity 재확인

`spec/5-system/14-external-interaction-api.md:1625-1631` (R17) 이 "마커 집합과 깊이 상한의 SoT 는
공유 패키지 `@workflow/masked-markers` 다 ... backend/frontend 는 재export shim 이라 갱신할 미러가
없다"로 실제 이관 결과와 line-level 로 일치함을 확인했다. frontmatter `code:` 목록(`:16`)에도
`codebase/packages/masked-markers/src/index.ts` 가 등재돼 있다. `plan/in-progress/masked-marker-shared-package.md`
의 관련 체크리스트(`:120-136`)는 전부 `[x]` 이고 "spec R17 정정" 항목도 실제 집행 경로(어느 라운드
RESOLUTION 에서 처리했는지)를 정확히 서술한다 — 이전 라운드(`11_53_49` documentation WARNING)가
지적했던 "plan 체크박스가 실제 상태를 반영하지 않는다"는 stale 상태도 현재는 해소돼 있다.

재제출 거부 가드(`reject-masked-resubmission.ts:3-4,134`)는 `isMaskedMarker` 를 여전히
`shared/utils/sanitize-error-message` 경로에서 import 한다(패키지 직접 import 아님) — 소비처 import
경로를 바꾸지 않는다는 재export 전략과 정확히 일치하며 R17 이 요구하는 "재제출 거부 가드와 egress
마스킹이 같은 판정기를 쓴다"는 불변식도 값 경로 이관 후에도 동일 함수를 공유하므로 유지된다.
`websocket.service.ts` 의 `MAX_SANITIZE_DEPTH`/`depth > MAX_SANITIZE_DEPTH` 비교는 여전히 별개로
남아 있고(패키지의 `MAX_MASK_DEPTH` 와 합쳐지지 않음) — README/index.ts JSDoc 이 명시한 "별개
불변식이므로 함께 움직이지 않는다"는 설계 결정과 일치한다.

## 요약

5라운드에 걸친 반복 리뷰-수정 사이클의 최종 상태를 요구사항 충족 관점에서 독립적으로 재검증한 결과,
이전 라운드들이 지적한 모든 WARNING(경로 게이팅 사각지대, channel-web-chat 무방비, 감시 목록 손 복제,
스캔 파생 얕음, `SOT_DIR` 접두 경계 backend/frontend 비대칭, plan 체크박스 stale, spec R17 미갱신)이
현재 저장소 상태에서 실제로 해소돼 있음을 원본 파일 직접 대조로 확인했다. 이 PR 의 핵심 목표(마스킹
마커 상수·판정 로직·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 추출하고 backend/frontend
가 재export shim 이 되는 것)는 값·시그니처·기본값(`MAX_MASK_DEPTH=10`)·판정 규칙(정확 일치)이 이관
전후 동일하게 완전히 구현됐고, spec R17 본문·frontmatter 도 line-level 로 이관 사실과 일치한다. 새로
발견한 두 건은 모두 INFO 수준(AST 탐지기의 문서화된 처리 범위 한계, 패키지 spec 의 의도적 값-비고정
선택)이며 기능 완전성·비즈니스 로직·에러 시나리오·반환값 어느 축에서도 차단 사유가 되는 결함은
없었다.

## 위험도
NONE
