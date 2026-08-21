# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `SOT_DIR` 정규화 계산이 파일 순회 루프 안에서 매번 재수행된다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122` (`findMirrorRedeclarations` 함수 내부)
  - 상세: `SOT_DIR.split(path.sep).join("/")` 는 루프 변수(`rel`, `absolute`)에 의존하지 않는 불변 값인데, `for (const rel of SCAN_DIRS) { for (const absolute of listSourceFiles(...)) { if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue; ... } }` 구조상 스캔되는 파일 수(테스트가 500개 이상을 하한으로 못박음, `masked-marker-mirror.test.ts:51`)만큼 매번 재계산된다. 비용 자체는 미미하지만, 매 반복 재계산은 "이 값이 반복마다 달라지는가?"라는 불필요한 의문을 리뷰어에게 남기고, 함수의 의도(정규화된 SoT 경로 접두사와 비교)를 흐린다.
  - 제안: 두 개 루프 진입 전에 `const sotPrefix = SOT_DIR.split(path.sep).join("/");` 로 한 번만 계산해 루프 안에서는 `relPath.startsWith(sotPrefix)` 로 참조한다.

- **[INFO]** `prepare` 스크립트가 8개 패키지에 걸쳐 동일한 비트리비얼 인라인 JS 문자열로 복제됨(이번 PR 로 9번째 사본 추가)
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`)
  - 상세: `node -e "const f=require('fs'),c=require('child_process');let ts=true;try{require.resolve('typescript/package.json')}catch{ts=false};if(ts){c.execSync('tsc',{stdio:'inherit'})}else if(!f.existsSync('dist')){throw new Error(...)}"` 형태의 스크립트가 `ai-end-reason`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`/`expression-engine`/`web-chat-sdk`/`sdk`/`masked-markers` package.json 전부에 문자 그대로 동일하게 박혀 있다(실측 grep 대조로 확인). 새 패키지 추가 시마다 이 로직을 고쳐야 한다면 8~9곳을 동시에 손대야 하는데, 이 PR 자체는 그저 기존 관행을 그대로 복제한 것이라 새로 만든 결함은 아니다. 이미 이 저장소가 "진짜 동일 보일러플레이트만 추출, axes 발산 시 full-unification 은 defer" 판단을 한 선례가 있어(과거 세션 결정) 지금 당장 손대라는 뜻은 아니며, 이 diff 의 책임 범위 밖(기존 컨벤션을 그대로 따른 것)이라 INFO 로만 남긴다.
  - 제안: 이번 PR 범위는 아님. 향후 9번째 이상 패키지가 추가되기 전에 `scripts/pkg-prepare.js` 같은 공유 스크립트로 추출해 각 package.json 은 `"prepare": "node ../../../scripts/pkg-prepare.js"` 형태로 위임하는 것을 검토할 가치가 있다.

## 요약

이 변경은 backend/frontend에 손으로 복제돼 있던 마스킹 마커 상수·판정 로직을 `@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터다. 실제 로직 변경은 최소화돼 있고(값·동작 무변경), 기존 소비처는 재export(`export { X }` 로컬 임포트 후 재출력 패턴, JSDoc 첨부 목적)로 import 경로를 그대로 유지해 하위 호환을 지켰다. 신규 파일들(`masked-markers/src/index.ts`, `masked-marker-mirror-guard.ts`, 대응 테스트)은 함수가 짧고 책임이 하나씩이며(예: `listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 분리), 중첩 깊이도 최대 3단(for-for-if/for)에 그쳐 과도하지 않다. 네이밍은 `MAX_MASK_DEPTH`라는 중립 이름을 canonical 로 정하고 backend `MAX_REDACT_DEPTH`를 지역 별칭으로 명시하는 등 기존 두 이름의 혼선을 정리하는 방향으로 개선됐다. "왜 리터럴이 아니라 심볼 재선언만 감지하는가"(오탐 방지) 같은 설계 결정이 코드 인접 주석에 근거와 함께 남아 있어 향후 유지보수자가 재발견 비용을 치르지 않도록 배려돼 있다. package.json/Dockerfile/CI workflow 8곳의 등록 변경은 전부 기계적 한 줄 추가이고 기존 패턴(예: `ai-end-reason`)과 완전히 동일한 형태라 일관성 위반이 없다. 발견한 두 건은 모두 INFO 급 — 하나는 루프 내 불변 값 재계산(가독성 미세 흠집), 다른 하나는 이번 PR 이 새로 만든 게 아니라 기존 저장소 관행을 그대로 답습한 스크립트 복제 확대(9번째 사본)다. 코드 복잡도·중복·매직넘버·가독성 어느 축에서도 차단 사유가 될 만한 문제는 없다.

## 위험도
NONE
