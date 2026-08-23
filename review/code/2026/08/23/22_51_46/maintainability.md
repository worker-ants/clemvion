# 유지보수성(Maintainability) Review

## 리뷰 범위

핵심 로직 변경은 4개 TS 파일에 집중돼 있다:

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — allowlist 4키 추가
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput` 신설 + `toFanoutEnvelope` 배선
- `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts`, `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 캐너리/리터럴 테스트 추가

나머지(파일 5~16)는 plan 문서·consistency-check 산출물(JSON/MD)·spec 문서로, 함수·네이밍·중첩·복잡도 등 코드 유지보수성 지표가 적용되지 않아 이 리뷰의 주 대상에서 제외했다(plan 문서의 `<details>` 이력 보존 패턴은 이 저장소의 기존 관례와 일치).

### 발견사항

- **[INFO]** `allowlistFanoutNodeOutput` 내부에 "narrow 후 참조 비교해 병합" 패턴이 두 번(top-level `nodeOutput` / 중첩 `buttonConfig.nodeOutput`) 반복된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205` (함수 `allowlistFanoutNodeOutput`), 특히 187-191 블록과 193-202 블록이 구조적으로 유사.
  - 상세: 두 블록 모두 `(값이 object 인가) → allowlistNodeOutputKeys 호출 → 참조가 바뀌었으면 next 재구성` 이라는 동일 idiom 을 따른다. 다만 두 번째 블록은 `buttonConfig` 한 겹을 더 파고들어야 해서 `if (bc) → if (inner) → if (narrowed !== inner)` 로 3중 중첩이 생겼다(함수 전체 중첩 깊이 자체는 과도하지 않음, 이 저장소 다른 순회 함수들과 비슷한 수준). 소비처가 지금은 2곳뿐이고 각 자리가 봉투 안에서 위치·깊이가 달라 완전한 공용 헬퍼로 뽑으면 오히려 인자가 늘어나는 트레이드오프가 있어, 현재 크기(24줄)에서는 과잉 추상화 위험이 duplication 비용보다 커 보인다. 다만 세 번째 소비 지점이 생기면 이 패턴을 뽑아낼 필요가 커진다.
  - 제안: 지금 당장 리팩터링을 요구할 정도는 아니나, 다음에 유사 위치(예: 신규 waiting 타입)가 추가되면 `applyIfNarrowed(container, key, path)` 류의 작은 헬퍼로 통합을 검토.

- **[INFO]** 로컬 변수명이 문맥 구분 없이 축약형(`top`, `bc`, `inner`, `next`, `narrowed`)이라, 두 블록을 오가며 읽을 때 "이 `narrowed`가 top 것인지 buttonConfig 것인지" 순간적으로 되짚어야 한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:187,189,193,195,197` (변수 선언부)
  - 상세: 이 파일의 기존 스타일(`sanitizeInner`의 `obj`/`v`/`k` 등)이 원래 축약형을 쓰므로 스타일 일관성 자체는 지켜졌다. 다만 이 함수는 두 개의 서로 다른 "nodeOutput 서브트리"를 같은 스코프에서 동시에 다루므로, 예컨대 `topNodeOutput`/`nestedNodeOutput` 처럼 살짝 더 구체적인 이름이었으면 두 블록을 눈으로 대조하기 쉬웠을 것이다.
  - 제안: 우선순위 낮음 — 강제하지 않되, 세 번째 소비 지점 추가나 다음 리팩터링 시 참고.

- **[INFO]** allowlist 그룹 설명이 두 곳(파일 상단 JSDoc 표, 배열 내부 인라인 주석)에 사실상 동일한 정보로 존재해 손-동기화 지점이 둘이다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:43-51`(JSDoc 표) ↔ `codebase/backend/src/shared/utils/node-output-allowlist.ts:65-91`(배열 + 인라인 주석)
  - 상세: 이번 PR 이 마침 표와 배열을 3그룹으로 함께 갱신했고(`22_26_33` consistency WARNING #3 반영), 코드 자체(50행)가 "이 표는 배열의 요약이 아니라 함께 갱신돼야 하는 미러다"라고 명시적으로 경고하고 있어 무지에 의한 drift 는 아니다. 다만 구조적으로는 여전히 "두 곳을 손으로 맞추는" 형태이며, `git blame`/consistency-checker 로 반복 확인되는 위험 축이라는 점은 남는다.
  - 제안: 즉각 조치 불요. 다음 라운드에 그룹이 4개 이상으로 늘어나면 표를 배열에서 파생 생성(예: 배열 자체에 `group` 메타 필드를 붙이고 표는 생성 스크립트/테스트로 검증)하는 편이 근본적으로 안전하다.

### 요약

핵심 변경(`allowlistFanoutNodeOutput` 신설, allowlist 4키 확장, 대응 캐너리/리터럴 테스트)은 함수 길이·네이밍·복잡도 면에서 모두 양호하다. 신규 함수는 24줄, 순환 복잡도 낮음(분기 4~5개), 매직 넘버 없음, 기존 파일의 명명·캐스팅 관례를 그대로 따른다. JSDoc 이 "왜 이 위치인지", "왜 표면별로 안 가르는지", "왜 안 바뀌는 게 안전 조건인지"를 상세히 설명해 가독성·의도 전달이 우수하고, 테스트는 `it.each` 로 반복을 잘 눌러 중복을 최소화했다. 지적된 항목은 전부 INFO 수준(경미한 구조적 반복, 변수명 구체성, 표-배열 이중 관리)이며 즉시 수정을 요하지 않는다.

### 위험도
LOW
