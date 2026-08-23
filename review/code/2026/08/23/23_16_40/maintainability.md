# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 diff(26개 파일)는 대부분 `review/code/2026/08/23/22_51_46/**`(직전 코드 리뷰 라운드 산출물)와 `review/consistency/2026/08/23/22_26_33/**`(consistency-check 산출물), plan/spec 문서로 구성돼 있다. 이들은 markdown 리포트·JSON 상태 파일이라 함수 길이·중첩·네이밍 등 코드 유지보수성 지표가 적용되지 않는다(직전 라운드 `maintainability.md` 자신도 같은 이유로 이 범주를 리뷰 대상에서 제외했다 — `review/code/2026/08/23/22_51_46/maintainability.md`).

실질 코드 변경은 다음에 집중된다:
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput` 함수, `toFanoutEnvelope` 배선
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — JSDoc·allowlist 배열
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts`, `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts`, `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` — 캐너리/리터럴 테스트 추가

`websocket.service.ts`·`node-output-allowlist.ts` 자체는 직전 라운드(`22_51_46`)에서 이미 리뷰된 코드와 **동일**함을 `Read` 로 확인했다(RESOLUTION 적용분은 CHANGELOG·plan·신규 테스트에만 반영되고 이 두 파일의 프로덕션 로직은 바뀌지 않았다). 따라서 아래 발견사항은 직전 라운드가 INFO 로 남긴 항목의 재확인이며, `review/code/2026/08/23/22_51_46/RESOLUTION.md` 의 #7·#8·#9 가 각각 "3번째 소비 지점 생기면"·"우선순위 낮음"·"그룹 4개 이상에서" 조건으로 이미 근거를 대며 의식적으로 defer 했다.

### 발견사항

- **[INFO]** `allowlistFanoutNodeOutput` 내부에 "narrow 후 참조 비교해 병합" idiom 이 두 번(top-level `nodeOutput` / 중첩 `buttonConfig.nodeOutput`) 반복되고, 두 번째 블록은 한 겹 더 파고들어 `if (bc) → if (inner) → if (narrowed !== inner)` 3중 중첩이 생긴다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205`(함수 `allowlistFanoutNodeOutput`), 특히 187-191 블록 vs 193-202 블록
  - 상세: 소비 지점이 2곳뿐이고 각 자리가 envelope 안에서 위치·깊이가 달라 공용 헬퍼로 뽑으면 인자가 늘어나는 트레이드오프가 있다. 함수 전체는 24줄로 짧고 순환 복잡도도 낮아 지금 크기에서 강제 리팩터링을 요할 정도는 아니다.
  - 제안: 세 번째 소비 지점(예: 신규 waiting 타입)이 생기면 `applyIfNarrowed(container, key, path)` 류의 작은 헬퍼로 통합을 검토.

- **[INFO]** 로컬 변수명이 `top`/`bc`/`inner`/`next`/`narrowed` 로 축약돼, 두 블록을 오갈 때 "이 `narrowed` 가 top 것인지 buttonConfig 것인지" 를 되짚어야 한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:187,189,193,195,197`
  - 상세: 파일의 기존 스타일(`sanitizeInner` 의 `obj`/`v`/`k` 등)이 원래 축약형을 쓰므로 스타일 일관성 자체는 지켜졌으나, 이 함수는 서로 다른 두 "nodeOutput 서브트리"를 같은 스코프에서 동시에 다룬다.
  - 제안: 우선순위 낮음 — `topNodeOutput`/`nestedNodeOutput` 처럼 문맥을 드러내는 이름이면 두 블록 대조가 쉬워지나, 강제 사항은 아님.

- **[INFO]** allowlist 그룹 설명이 JSDoc 표와 배열 인라인 주석 두 곳에 사실상 동일 정보로 존재해 손-동기화 지점이 둘이다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:44-48`(JSDoc 표, 3그룹) ↔ `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92`(배열 + 인라인 주석)
  - 상세: 이번 PR 이 표와 배열을 3그룹으로 함께 갱신했고(`22_26_33` consistency WARNING 반영), 코드 자체(50행)가 "이 표는 배열의 요약이 아니라 함께 갱신돼야 하는 미러다"라고 명시적으로 경고해 무지에 의한 drift 위험은 낮췄다. 다만 구조적으로는 여전히 두 곳을 손으로 맞추는 형태다.
  - 제안: 즉각 조치 불요. 그룹이 4개 이상으로 늘면 표를 배열에서 파생 생성하는 편이 근본적으로 안전(직전 RESOLUTION #9 와 동일 재개 신호).

- **[INFO]** 신규 테스트(`websocket.service.spec.ts` 4개 블록, `interaction.service.spec.ts` 1개 블록, `node-output-allowlist.spec.ts` 리터럴 배열 확장)는 기존 파일 관례(캐스팅 idiom `gateway.broadcastToChannel.mock.calls[0][2] as Record<...>` 은 이 파일에서 이미 20회 이상 쓰이던 패턴, `it.each` 로 4키 보존 케이스의 반복을 회피)를 그대로 따르고 각 캐너리 앞에 "왜 필요한지"를 JSDoc/주석으로 설명해 가독성이 좋다. 새로 도입된 유지보수성 이슈는 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:762-904`, `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:733-763`
  - 제안: 없음(양호).

## 요약

이번 라운드에서 리뷰 대상 diff 의 대부분(약 20/26 파일)은 이전 코드 리뷰·consistency-check 라운드의 markdown/JSON 산출물이라 코드 유지보수성 지표가 적용되지 않는다. 실질 프로덕션 코드(`websocket.service.ts`, `node-output-allowlist.ts`)는 직전 라운드에서 이미 검토된 것과 동일하며, 이번에 추가된 것은 CHANGELOG 정정·plan 갱신·신규 캐너리/리터럴 테스트뿐이다. 신규 테스트는 기존 파일 관례를 잘 따르고 중복을 `it.each` 로 적절히 눌러 유지보수성 문제가 없다. 유일하게 남는 관찰은 직전 라운드에서 이미 INFO 로 지적되고 근거와 함께 명시적으로 defer 된 세 항목(narrow-and-merge idiom 반복, 축약 변수명, JSDoc 표 vs 배열 이중 관리)이며, 모두 재개 조건(3번째 소비 지점/그룹 4개 이상)이 아직 도래하지 않아 즉시 수정을 요하지 않는다. CRITICAL/WARNING 급 유지보수성 결함은 발견되지 않았다.

## 위험도
LOW
