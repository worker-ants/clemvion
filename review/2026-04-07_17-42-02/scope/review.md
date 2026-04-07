## 발견사항

### [INFO] `back-edge-identifier.ts` 엣지 처리 암묵적 동작
- **위치**: `back-edge-identifier.ts`, adjacency 구성 부분 (line 20-27)
- **상세**: 양 끝점 모두 `nodeIds`에 있는 경우만 adjacency에 추가하지만, 최종 분류 루프는 원본 `edges` 전체를 순회합니다. 결과적으로 한쪽 끝점이 노드 셋에 없는 엣지는 `backEdgeSet`에 포함되지 않아 자동으로 `forwardEdges`로 분류됩니다. 테스트가 이 동작을 검증하고 있어 의도된 설계이지만, 주석이나 문서화가 없어 추후 혼란 가능성이 있습니다.
- **제안**: 해당 처리 방식을 코드 주석으로 명시 (`// Edges with unknown endpoints are treated as forward edges`)

---

### [INFO] `executedNodes` Set이 back-edge 재실행 구간에서 초기화되지 않음
- **위치**: `execution-engine.service.ts`, back-edge 점프 이후 실행 로직
- **상세**: pointer가 되감길 때 `portRoutingSkipped`는 초기화되지만 `executedNodes`는 유지됩니다. 재실행 구간의 노드들이 이미 `executedNodes`에 포함된 상태로 `gatherNodeInput`이 호출되며, 이전 캐시 출력이 입력으로 사용됩니다. `nodeOutputCache`가 재실행 시 덮어쓰여지므로 동작상 문제는 없으나, 첫 재실행 순간에는 이전 출력이 입력으로 전달됩니다.
- **제안**: 현재 구현이 의도된 동작이라면 주석으로 명시. 재실행 시 입력 초기화가 필요하다면 `executedNodes`에서 해당 범위 노드를 제거하는 로직 추가 고려.

---

## 요약

모든 변경사항은 "순환 참조(Cyclic Graph) 실행 지원" 기능을 구현하기 위한 의도된 범위 내에 있습니다. `detectCycle` → `identifyBackEdges` 교체, pointer 기반 실행 루프 전환, `ConfigService` 주입 및 `MAX_NODE_ITERATIONS` 가드 추가, 신규 파일(`back-edge-identifier.ts/.spec.ts`) 생성, 스펙 문서 갱신이 모두 일관된 목적으로 연결되어 있습니다. 불필요한 리팩토링, 무관한 파일 수정, 과도한 기능 확장은 발견되지 않았습니다.

## 위험도

**LOW**