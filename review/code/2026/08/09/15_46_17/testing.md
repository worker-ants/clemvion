STATUS=success testing review complete — 0 critical, 0 warning, 2 info

===REPORT_MARKDOWN_BELOW===

# 테스트(Testing) 리뷰 — review/consistency/2026/08/09/15_09_04/*

## 스코프 확인

이번 세션의 리뷰 대상 6개 파일은 전부 `review/consistency/2026/08/09/15_09_04/` 아래 **신규 추가된 consistency-checker 산출물**(`convention_compliance.md`·`cross_spec.md`·`meta.json`·`naming_collision.md`·`plan_coherence.md`·`rationale_continuity.md`)이다. 실제 애플리케이션 코드(`workspace-reflection-canary.ts`·`uuid.ts`·`workspace-context.util.ts`·각 `*.spec.ts` 등)는 이번 diff 에 포함되지 않는다 — 이미 이전 세션(`review/code/2026/08/09/14_36_39`, `15_20_33`)에서 별도로 리뷰됐고, 이번 diff 는 그 코드에 대한 `--impl-done` consistency-check **결과 문서**만 신규로 저장소에 커밋한 것이다.

따라서 "테스트(Testing)" 관점의 표준 8개 점검(테스트 존재/커버리지 갭/엣지케이스/Mock/격리/가독성/회귀/테스트 용이성)은 **실행 가능한 코드가 아닌 산문 문서**에는 직접 적용되지 않는다. 대신 이 문서들이 테스트 관련해서 주장하는 내용(신규 테스트 존재·동작 서술)이 실제 코드와 부합하는지를 fact-check 하는 것이 이 리뷰에서 가장 실질적인 가치라 판단해 다음을 직접 대조했다.

## Fact-check 결과 (테스트 관련 인용의 정확성)

각 문서가 인용하는 테스트 관련 주장을 실제 워크트리 소스로 직접 대조했다:

- `rationale_continuity.md` (§4 "암묵적 가정 충돌")가 인용한 `roles.guard.spec.ts` 신규 테스트 — `codebase/backend/src/common/guards/roles.guard.spec.ts` 를 열어 확인한 결과 `'형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이 헤더 파싱보다 먼저다'`, `'형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다'`, `'403(비멤버)이 아니라 400 이다 — 두 실패를 뭉개면 클라이언트가 구분할 수 없다'` 세 테스트가 실제로 존재하고, `getMemberRole` 미호출 단언도 실측한 그대로다. 인용 정확함.
- `naming_collision.md`가 나열한 신규 export(`WorkspaceIdReflectionBrokenError`·`countWorkspaceIdConsumingRoutes`·`assertWorkspaceIdReflectionWorks`·`isUuidShaped`·`UUID_SHAPE_PATTERN`)는 각각 `workspace-reflection-canary.ts`·`uuid.ts` 에 정확히 그 이름으로 존재한다(`export class WorkspaceIdReflectionBrokenError` / `export function countWorkspaceIdConsumingRoutes` / `export function assertWorkspaceIdReflectionWorks`). fixture 상수 목록(`HEADER_WS`/`TOKEN_WS`/`OWN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`/`WS1`)도 각 `.spec.ts` 파일에서 grep 으로 실측 확인됨 — 지어낸 인용 없음.
- `rationale_continuity.md`가 "`isUuidShaped`(nil UUID 포함) vs `isValidUuid`(RFC variant 엄격)" 경계로 설명한 부분은 `uuid.ts`/`uuid.spec.ts` 의 실제 구현·테스트(`'accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)'`)와 정확히 일치한다.
- `cross_spec.md`가 언급한 "`workspace-context.util.ts` 의 신규 `BadRequestException({code:'VALIDATION_ERROR'})`" 분기와 그 테스트 커버리지도 `workspace-context.util.spec.ts` 의 `'형식이 깨진 X-Workspace-Id 헤더'` describe 블록(`%s → 400 VALIDATION_ERROR`)에서 실측 확인됨.

5개 문서 전반에 걸쳐 테스트 관련 주장의 **fabrication 은 발견되지 않았다** — 과거 세션 교훈("Rationale '기각된 대안' 은 실제 이력 필수, 지어내면 checker 가 잡는다")을 이 문서들 스스로도 통과한다.

## 발견사항

- **[INFO]** `cross_spec.md` 가 스스로 밝힌 "내용 미검증" 캐버트가 테스트 관점에서 유효한 잔여 갭
  - 위치: `review/consistency/2026/08/09/15_09_04/cross_spec.md` — "검토했으나 충돌 없음으로 확인한 항목" 목록의 마지막 행("`system-status.e2e-spec.ts` 가 nil UUID … 실제 파일 존재로 확인됨(파일명 대조, **내용까지는 미검증**)")
  - 상세: 이 캐버트 자체는 정직한 자기고백이라 결함이라기보다 좋은 관행이지만, `isUuidShaped` 도입 근거(코드 주석·plan 양쪽)가 "nil UUID 를 e2e 가 타 워크스페이스 프로브로 실제 사용 중"이라는 사실에 의존하고 있다. 이번 5개 consistency 문서 어디에도 `system-status.e2e-spec.ts` 의 실제 assertion(예: nil UUID 요청이 403 을 받는지, 400 으로 뒤바뀌지 않는지)을 실행/열람해 재확인한 흔적은 없다 — `isUuidShaped` 회귀(예: 향후 누군가 실수로 `isValidUuid` 로 되돌리는 변경)가 났을 때 이 e2e 가 실제로 그 회귀를 잡아주는지는 이번 리뷰 라운드에서 검증되지 않은 채로 남았다.
  - 제안: 문서 자체를 고칠 필요는 없음(이미 정직하게 스코프를 명시함). 다만 후속 라운드나 developer 워크트리에서 `system-status.e2e-spec.ts` 를 열어 "nil UUID 프로브가 403 을 기대한다"는 assertion 이 실제로 존재하는지 1회 확인해 두면 이 하드닝의 회귀 방지망이 문서상으로도 완결된다.

- **[INFO]** fixture 상수 재사용 시 동명이인(same name, different value) — naming_collision.md 는 "충돌 없음"으로 정확히 판정했으나 재사용 함정은 별도로 존재
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts`(`OTHER_WS`), `codebase/backend/src/common/utils/workspace-context.util.spec.ts`(`OTHER_WS`) — 두 파일 모두 파일-스코프 `const OTHER_WS` 를 선언하지만 값이 다르다(`roles.guard.spec.ts`: `'dddddddd-4444-...'`, `workspace-context.util.spec.ts`: `'cccccccc-3333-...'`). `DECOY_WS`/`HEADER_WS`/`TOKEN_WS` 도 파일별로 값이 부분적으로 겹치거나 어긋난다.
  - 상세: `naming_collision.md` 의 판정("export 없음, 실제 충돌 없음")은 정확하다 — TypeScript 모듈 스코프상 런타임 충돌은 없다. 다만 이는 "이름 충돌" 관점이 아니라 "테스트 가독성/유지보수" 관점에서 별도로 볼만한 함정이다: 향후 이 스펙 파일들을 나란히 열어보거나 fixture 를 복사-붙여넣기 하는 개발자가 `OTHER_WS` 라는 같은 이름을 보고 같은 워크스페이스를 가리킨다고 오인할 수 있다. plan 의 "후속 (이 PR 밖)" 항목에 언급된 "fixture 공용 모듈화"(이미 `plan_coherence.md` 가 인용)가 채택되면 이 문제는 자연히 해소된다.
  - 제안: 조치 불요 — 이미 plan 이 fixture 공용화를 후속으로 인지하고 있고, 이번 리뷰 대상(consistency 문서)의 결함도 아니다. 참고 목적으로만 기록.

## 요약

이번 diff 는 애플리케이션/테스트 코드를 전혀 포함하지 않고 `--impl-done` consistency-check 결과 문서 5종 + `meta.json` 만 신규로 추가한다. 표준 테스트 체크리스트(존재·커버리지·엣지케이스·mock·격리·가독성·회귀·테스트 용이성)는 실행 코드가 아닌 이 문서들에 직접 적용되지 않으므로, 대신 문서가 인용하는 테스트 관련 주장(신규 테스트 이름·assertion 내용·fixture 상수·export 명)을 실제 소스와 전수 대조했다. 대조 결과 5개 문서 전반에 걸쳐 **fabrication 은 없었고** 인용은 전부 정확했다. 유일하게 남는 잔여 갭은 `cross_spec.md` 스스로 밝힌 "e2e 파일 내용 미검증" 캐버트(nil UUID 프로브의 실제 assertion 을 이번 라운드가 재확인하지 않음)이며, 이는 차단 사유가 아닌 후속 확인 권고 수준이다. 추가로 여러 `.spec.ts` 파일에 걸쳐 동명 fixture 상수(`OTHER_WS` 등)가 서로 다른 값을 가지는 점은 런타임 충돌은 아니지만 향후 유지보수 시 혼동 여지가 있어 참고로 기록했다(plan 이 이미 후속으로 인지).

## 위험도

NONE
