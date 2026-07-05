# 유지보수성(Maintainability) 코드 리뷰

리뷰 대상 changeset 은 `codebase/backend/src/modules/folders/{folders.controller.ts, folders.service.ts, folders.service.spec.ts}` (V-04: 폴더 `update()` parentId 재검증 — 깊이·cycle·타 workspace 가드) 의 프로덕션/테스트 코드와, 이를 감싸는 plan(`spec-code-cross-audit-2026-06-10.md`)·spec(`1-data-model.md`, `2-navigation/1-workflow-list.md`) 갱신, 그리고 직전 리뷰 세션(`review/code/2026/07/05/14_28_16/**`)의 산출물 커밋을 포함한다.

**확인**: `folders.controller.ts`·`folders.service.ts`·`folders.service.spec.ts` 의 실제 diff 내용은 직전 세션(`14_28_16`)에서 이미 리뷰된 것과 **동일한 프로덕션 코드**다(현재 워킹트리의 `folders.service.ts` 를 직접 대조 확인). 즉 이번 changeset 은 신규 코드 변경이 아니라, (a) 직전 review 세션의 SUMMARY/RESOLUTION/각 리뷰어 산출물이 커밋에 포함되고 (b) plan 체크박스·spec 본문이 그 결과를 반영해 갱신된 것이 diff 로 다시 잡힌 상태로 보인다. 아래는 프로덕션 코드에 대한 유지보수성 재검토이며, 직전 세션 `maintainability.md` 의 INFO 발견사항들은 RESOLUTION 에서 "비차단, 미조치(현 규모 적정)"로 의도적으로 보류된 상태 그대로다.

## 발견사항

- **[INFO]** `getDepth()` 상한 가드의 `+ 1` 매직 오프셋 근거 미기재 (직전 리뷰 재확인, 미조치)
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:92` (`if (visited.has(currentId) || depth > MAX_NESTING_DEPTH + 1) break;`)
  - 상세: `MAX_NESTING_DEPTH`(5)는 명명된 상수이나 가드 조건의 `+ 1`이 왜 정확히 1만큼 더 허용하는지(정상 트리의 정상 최대 깊이 케이스를 오탐하지 않기 위한 여유분)에 대한 근거가 주석에 없다. 바로 위 주석("정상 트리는 상한에 닿지 않는다")만으로는 오프셋 값 자체의 유래가 불명확해, 향후 리팩터링 시 `+ 1`을 실수로 제거하거나 다른 값으로 바꿀 위험이 있다.
  - 제안: "정상 트리는 depth ≤ MAX_NESTING_DEPTH 이므로 상한을 MAX_NESTING_DEPTH 로 두면 정상 케이스가 오탐될 수 있어 +1 여유를 둔다" 형태로 한 줄 보강.

- **[INFO]** `create()` 와 `validateParentChange()` 의 깊이 검사 조건식이 표현 형태가 달라 대응 관계 파악에 노력이 듦 (직전 리뷰 재확인, 미조치)
  - 위치: `folders.service.ts:45` (`depth >= MAX_NESTING_DEPTH`) vs `folders.service.ts:142` (`parentDepth + height > MAX_NESTING_DEPTH`)
  - 상세: 두 곳 모두 "최종 깊이가 5 초과 금지"라는 동일 불변식을 표현하지만 부등호 방향과 피연산자가 다르다(`create()`는 리프 1개 추가만 고려, `update()`는 서브트리 height 를 합산). 로직 자체는 정확하고 테스트로 경계값이 검증되어 있으나, 코드만으로는 두 검사가 같은 공식의 인스턴스임이 바로 보이지 않는다.
  - 제안: 서비스 코드에 "parentDepth + height ≤ MAX 여야 함(height=1 이면 create() 케이스와 동일)" 같은 한 줄 대응 설명을 추가하거나, `create()` 조건도 `depth + 1 > MAX_NESTING_DEPTH` 형태로 맞춰 두 함수가 동일 공식임을 드러내는 것을 고려. 선택 사항.

- **[INFO]** `validateParentChange()` 가 4가지 검증 책임(self-parent·workspace 소속·cycle·깊이)을 한 함수에서 순차 수행 (직전 리뷰 재확인, 미조치)
  - 위치: `folders.service.ts:109-148`
  - 상세: 함수 길이는 40줄 이내로 과도하지 않고 각 단계가 순서 의존적(자기참조를 먼저 걸러야 이후 조회가 안전)이며 주석으로 설명되어 가독성 저하는 크지 않다. 다만 이 파일에서 순환 복잡도가 가장 높은 함수이므로, 향후 검증 규칙이 추가되면(예: 워크플로우 포함 여부 등) 조기 리팩터링 검토가 필요하다.
  - 제안: 현재는 문제 없음. 규칙이 5개 이상으로 늘어나면 `assertNotSelfParent`, `assertSameWorkspace` 등 개별 private 메서드로 분리 권장.

- **[INFO]** `VALIDATION_ERROR` BadRequestException 구성 블록이 파일 내 5회 반복되나 기존 스타일과 일관 (직전 리뷰 재확인, 미조치)
  - 위치: `folders.service.ts:46-49`, `116-119`, `124-128`, `136-139`, `143-146`
  - 상세: `throw new BadRequestException({ code: 'VALIDATION_ERROR', message: ... })` 패턴이 반복되나, `findById()`의 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })` 도 동일 패턴이라 이 서비스 전반의 기존 관행을 따른 것이며 신규 도입된 중복이 아니다.
  - 제안: 현재 규모에서는 헬퍼 추출이 과도. 향후 throw 지점이 더 늘면 `private throwValidationError(message)` 소형 헬퍼 도입을 고려.

- **[INFO]** 테스트의 `mockResolvedValueOnce` 다회 체이닝이 서비스 내부 호출 순서에 강하게 결합
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts` (`update — parentId 재검증 (V-04)` describe 블록 전반, 특히 `rejects parent in another workspace / nonexistent`, `rejects when resulting depth exceeds max`, `getDepth terminates on cyclic parent chain`)
  - 상세: `findOne`/`find` 에 순서대로 `mockResolvedValueOnce`를 쌓아 "findById → parent lookup → getDepth 체인 / collectSubtree BFS" 순서를 그대로 흉내낸다. 각 mock 에 `// findById`, `// parent lookup` 등 주석이 붙어 가독성은 확보되어 있지만, `validateParentChange` 내부 조회 순서가 바뀌면(예: workspace 검사 전에 다른 조회 추가) 실제 버그 없이도 테스트가 깨지는 화이트박스 결합도를 갖는다. `getDepth terminates on cyclic parent chain` 테스트는 `mockImplementation`(id 기반 분기)으로 작성돼 순서 결합도가 낮아 상대적으로 견고하다.
  - 제안: 현재 8~9개 테스트 규모에서는 비용 대비 실용적인 트레이드오프로 판단되며 즉시 조치는 불요. 향후 `validateParentChange`/`collectSubtree` 내부 호출 순서를 바꾸는 리팩터링을 할 때는 이 결합도로 인해 다수 테스트를 동시에 갱신해야 함을 유의할 것.

- **[INFO]** plan 파일(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`) V-04 체크박스 갱신 — 서술이 길지만 추적성 확보에 기여
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md:34`
  - 상세: 한 줄 항목에 구현 브랜치·검증 규칙·에러 코드 재사용 근거·spec 갱신 대상·테스트/리뷰 결과까지 압축해 서술한다. 가독성보다 추적성(監査 audit trail)을 우선한 이 저장소의 plan 컨벤션과 일치하며, 신규 패턴 도입이 아니다.
  - 제안: 조치 불요.

## 요약

이번 changeset 의 핵심 프로덕션 코드(`folders.controller.ts`, `folders.service.ts`)는 직전 리뷰 세션(`14_28_16`)에서 이미 Critical 0·WARNING 5(조치 완료/조치 불요 판정)로 클리어된 것과 동일한 코드이며, 재검토 결과도 동일하게 CRITICAL/WARNING 급 유지보수성 이슈는 없다. `validateParentChange`/`collectSubtree`/`getDepth` 는 함수 길이·중첩 깊이가 적정 범위이고, 신규 로직에는 "왜"를 설명하는 주석이 충실히 달려 있으며, 매직 넘버(`MAX_NESTING_DEPTH`)는 명명 상수로 관리된다. 남은 소소한 개선 여지(`+1` 오프셋 근거, `create()`/`update()` 깊이 검사 조건식 표현 비대칭, 테스트의 호출 순서 결합도)는 모두 INFO 수준이며, 직전 RESOLUTION 에서 "비차단, 미조치(현 규모 적정)"로 의도적으로 보류된 항목과 일치한다. 병합을 막을 이유는 없다.

## 위험도

LOW
