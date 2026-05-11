# Archive

이 폴더는 `docs-consolidation` 작업(2026-05-12)으로 옛 `memory/`·`user_memo/` 폴더가 제거되면서, **spec/에 inline 흡수되지 않은 시점 기반·1회성 문서**를 보존하기 위한 공간이다.

`spec/`은 제품의 최종 상태만 기술하고, `plan/in-progress/`·`plan/complete/`는 작업 추적 라이프사이클을 담는다. 이 archive는 그 어느 쪽에도 해당하지 않지만 역사적 가치가 있는 문서들의 묘지다.

## 구조

- `from-memory/` — 옛 `memory/` 폴더에 있던 1회성 분석·진행 로그
- `from-user-memo/` — 옛 `user_memo/` 폴더의 초기 기획·노드별 개선안·불일치 매트릭스

## 주의

- 이 폴더의 문서는 **참고 자료**이지 최신 사실의 출처가 아니다. 최신 상태는 항상 `spec/`을 본다.
- 본문에 등장하는 절차·노드 스펙·결정 사항이 현재 `spec/`과 충돌할 경우 `spec/`이 정답이다.
- 새 문서를 이 폴더에 추가하지 않는다. 신규 결정·분석은 `spec/`의 Rationale 섹션 또는 `plan/in-progress/`에 둔다.
