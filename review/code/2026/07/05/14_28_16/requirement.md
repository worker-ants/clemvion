# 요구사항(Requirement) Review — folder-depth-cycle-guard (V-04)

## 발견사항

- **[INFO]** 관련 spec (`spec/1-data-model.md §2.5`, `spec/2-navigation/1-workflow-list.md §3.1`) 은 이미 이 구현을 반영하도록 갱신되어 있고, 코드와 line-level 로 정확히 일치한다.
  - 위치: `spec/1-data-model.md:140-142`, `spec/2-navigation/1-workflow-list.md:140`, `codebase/backend/src/modules/folders/folders.service.ts:60-148`
  - 상세: spec §2.5 "중첩 깊이 제한: 최대 5단계 (생성·부모 변경 모두에 적용)", "`parent_id` 는 같은 워크스페이스의 폴더만 가리킨다", "계층은 비순환(acyclic) — 폴더는 자기 자신·자손을 부모로 가질 수 없다 (부모 변경 시 검증)" 를 명시하고, `1-workflow-list.md §3.1` PATCH 행이 "새 부모가 같은 워크스페이스에 없거나, 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 `VALIDATION_ERROR`. `parentId: null` 로 루트 이동은 항상 허용" 이라고 명시한다. `validateParentChange()` 구현은 이 4가지 조건(같은 워크스페이스/self/자손/깊이) 을 정확히 그 순서·에러코드(`VALIDATION_ERROR`)로 구현하며, `newParentId === null` 조기 반환도 spec 의 "항상 허용" 과 일치한다. 리뷰 대상 diff 자체에는 spec 변경이 포함되어 있지 않지만(코드만 diff), 현재 워크트리의 spec 본문은 이미 이 구현을 전제로 갱신된 상태 — 즉 consistency-check(`review/consistency/2026/07/05/14_08_56/`)가 지적한 "PATCH 행 에러코드 미문서화" WARNING 은 이미 해소되어 있다(문서화 선행 완료 후 코드 구현).
  - 제안: 없음 — spec-code 정합 확인.

- **[INFO]** naming_collision 체커가 우려한 "신규 cycle 에러코드 vs 기존 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 충돌" 위험은 실제로 해소되었다 — 신규 코드를 만들지 않고 기존 `VALIDATION_ERROR` 를 재사용.
  - 위치: `folders.service.ts:104-108` (`validateParentChange` JSDoc), `:116-146`
  - 상세: JSDoc 주석이 "신규 cycle 코드를 도입하지 않아 `CONTAINER_CYCLE`(노드)·`CYCLE_DETECTED`(그래프)와의 혼동을 피한다" 고 명시하고, 실제로 self-parent·not-found·descendant-cycle·depth-exceeded 4개 실패 경로 모두 `code: 'VALIDATION_ERROR'` 를 던진다. `create()` 의 depth 검증과 동일 코드를 사용해 API 계약이 일관적이다.
  - 제안: 없음.

- **[INFO]** `getDepth()` 무한루프 방지 가드가 기존 `create()` 경로의 동작을 바꾸지 않으면서 `update()` 재사용에도 안전하도록 보강됨.
  - 위치: `folders.service.ts:81-102`
  - 상세: `visited` Set + `depth > MAX_NESTING_DEPTH + 1` 상한으로 손상된 순환 데이터에서도 종료를 보장한다. 정상 트리(최대 depth 5)에서는 이 가드가 조기 종료를 유발하지 않음 — `depth > 6` 조건이라 5단계 체인은 전혀 영향받지 않는다. 테스트("getDepth terminates on cyclic parent chain")가 `create()` 경유로 이 가드를 검증한다 — `update()` 경유 별도 순환 테스트는 없으나, `validateParentChange` 가 `getDepth`/`collectSubtree` 를 그대로 재사용하므로 동일 가드가 적용된다.
  - 제안: 없음(견고).

- **[INFO]** depth 산식 일관성 검증 — `create()` 와 `update()` 가 같은 임계값 의미를 사용.
  - 위치: `folders.service.ts:43-51` (create), `:141-147` (update)
  - 상세: `create()` 는 `getDepth(parent) >= 5` 시 거부(신규 리프 추가로 depth+1>5 와 동치). `update()` 는 `getDepth(newParent) + height(subtree) > 5` 로 일반화했고, 리프 이동(height=1) 케이스에서 두 공식이 정확히 같은 경계에서 거부한다(스펙 테스트 "allows a valid shallow reparent": parentDepth=1, height=1 → 2≤5 허용, "rejects when resulting depth exceeds max": parentDepth=5, height=1 → 6>5 거부). 서브트리를 통째로 옮기는 경우(height>1)까지 올바르게 일반화되어 있어 create 에는 없는 케이스도 정확히 처리한다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-04 체크박스가 이번 diff 에 포함되어 있지 않아 미해결로 남아 있다(라인 34 "잔여: V-04·...").
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md:34`
  - 상세: 해당 plan 문서는 V-04 를 "major, 결정 대기" 로 나열하고 §"결정 옵션" 에서 "코드 구현" 을 권장한 항목이다. 이번 3개 codebase 파일 diff 로 V-04 코드 구현은 완료됐으나, plan 문서 자체(체크박스·"잔여" 목록)는 갱신되지 않은 채 남아 있다. 코드 정확성 자체에는 영향 없으나, `.claude/docs/plan-lifecycle.md` 관례상 완료된 항목은 plan 에 반영되어야 하며 그렇지 않으면 추후 "V-04 미해결" 로 재조사될 위험이 있다.
  - 제안: developer 가 이번 PR/커밋에 plan 체크박스 갱신(V-04 완료 표시, "잔여" 목록에서 제거)을 포함시킬 것을 권장. 코드 리뷰 자체를 막을 사안은 아님(INFO).

- **[INFO]** `update()` 에서 `name` 변경만 있고 `parentId` 변경이 없는 경우(no-op 검증 skip)와 `parentId` 를 동일 값으로 재전송하는 경우 모두 재검증을 건너뛰어 불필요한 쿼리를 피한다 — 의도된 최적화이자 spec 이 요구하는 "parentId 변경 시" 조건과 정확히 일치.
  - 위치: `folders.service.ts:69` (`data.parentId !== undefined && data.parentId !== folder.parentId`)
  - 상세: `data.parentId === undefined` (필드 미전송) 케이스와 `data.parentId === folder.parentId` (동일 부모로 "변경") 케이스 모두 스킵 — 테스트("renames without parent change")가 `mockRepository.find` 가 호출되지 않음을 검증해 이 최적화를 커버한다. 엣지 케이스로 `parentId` 를 명시적으로 같은 값으로 보내는 PATCH 요청은 테스트되지 않았으나 로직상 안전(문자열 동등 비교로 스킵).
  - 제안: 없음.

## 요약

`FoldersService.update()` 가 `parentId` 변경 시 계층 무결성(같은 워크스페이스·비순환·최대 깊이 5)을 재검증하도록 하는 이번 변경은 `spec/1-data-model.md §2.5`·`spec/2-navigation/1-workflow-list.md §3.1` 의 현재 본문과 line-level 로 정확히 일치하며, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-04 항목이 권장한 "코드 구현(spec 이 SoT)" 결정을 그대로 이행한다. 에러 코드는 신규 도입 없이 기존 `VALIDATION_ERROR` 를 일관되게 재사용해 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와의 네이밍 충돌 위험도 회피했다. `getDepth()`/`collectSubtree()` 모두 방문 집합·상한 가드로 손상 데이터의 순환에서도 종료를 보장하며, depth 산식(`parentDepth + height > 5`)은 기존 `create()` 산식과 리프 이동 케이스에서 수학적으로 동치이면서 서브트리 통째 이동까지 올바르게 일반화한다. 테스트 스위트(18개, 신규 8개 포함)는 rename-only skip, self-parent, cross-workspace/nonexistent parent, descendant cycle, depth 초과, 루트 이동, 정상 shallow reparent, cyclic 데이터에서의 `getDepth` 종료까지 모든 주요 분기·엣지 케이스를 커버하고 실제로 통과한다(`npx jest src/modules/folders` 18/18 pass). 유일한 잔여 갭은 코드 결함이 아니라 프로세스성 — `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-04 체크박스/"잔여" 목록이 이번 diff 에 포함되지 않아 완료 반영이 누락된 점(INFO)이다.

## 위험도

NONE
