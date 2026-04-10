## 발견사항

### [INFO] `single_turn` 무조건 포트에 `error` 포트 추가 — 사실상 신규 기능
- **위치**: `custom-node.tsx` 변경, `spec/4-nodes/3-ai-nodes.md` 공통 섹션
- **상세**: 기존 코드는 조건 0개 시 `getNodeDefinition(data.type)?.outputs ?? []`를 반환했으며, 노드 정의가 `out`만 포함했다면 `error` 포트는 없었음. 이번 변경에서 `single_turn` 무조건 케이스에 `error` 포트가 명시적으로 추가되었음. 이는 단순 동작 수정이 아니라 기존 single_turn 노드(조건 없음)의 포트 구성을 변경하는 것임.
- **제안**: 의도된 변경이라면 스펙과 테스트가 잘 정렬되어 있으므로 문제없음. 단, 기존 워크플로우에서 `error` 포트가 없던 single_turn 노드가 있다면 의도치 않은 포트 추가로 UI가 달라짐을 인지해야 함.

### [INFO] `multi_turn` 무조건 케이스 — backward compatibility 파괴
- **위치**: `custom-node.tsx` L46-53, `spec/4-nodes/3-ai-nodes.md` 공통 섹션
- **상세**: 이전 스펙은 `multi_turn` 조건 0개 케이스를 "하위 호환 — `out` + `error`" 로 명시했으나, 이번 변경으로 `user_ended` + `max_turns` + `error` (out 없음)으로 전환됨. 이로 인해 기존 `multi_turn` 노드에 연결된 `out` 엣지가 dangling 상태가 됨.
- **제안**: 스펙 변경과 구현이 일치하므로 의도된 변경으로 판단됨. 다만 마이그레이션 가이드(기존 `out` 엣지 처리)가 스펙에 명시되어 있지 않음. `timeout` 포트 마이그레이션 가이드처럼 추가 고려 필요.

---

## 요약

3개 파일(스펙, 구현, 테스트)이 하나의 일관된 목적 — "AI Agent 조건 0개 케이스를 하위 호환 방식에서 모드별 전용 포트 방식으로 전환" — 을 위해 수정되었다. 무관한 파일 변경, 불필요한 리팩토링, 포맷팅 노이즈, 임포트 변경은 없으며 변경 범위가 명확히 제어되어 있다. 스펙 → 구현 → 테스트가 모두 정합하게 갱신되었다. 주목할 사항은 `multi_turn` 조건 0개 케이스의 backward compatibility 파괴(기존 `out` 엣지 dangling)이나, 이는 스펙 변경에서 의도적으로 채택된 방향으로 보이며 범위 이탈보다는 설계 결정에 해당한다.

## 위험도

**LOW**