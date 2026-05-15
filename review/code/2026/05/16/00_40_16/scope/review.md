# 변경 범위(Scope) 리뷰

## 발견사항

### kb-stats.helper.ts

- **[INFO]** `refresh()` 반환값 타입 파라미터 제거
  - 위치: diff +11 (`await this.dataSource.query(` — 제네릭 `<{ entity_count: number; relation_count: number }[]>` 삭제)
  - 상세: RETURNING 결과를 더 이상 사용하지 않으므로 타입 파라미터 제거는 dead path 코드 제거의 직접적 결과다. 별개 리팩토링이 아니며 변경 의도에 부합한다.
  - 제안: 이슈 없음. 현재 처리 적절.

- **[INFO]** JSDoc 주석 내용 확장
  - 위치: diff +7~+18 (주석 블록 재작성)
  - 상세: 기존 2-item 목록을 산문으로 바꾸고 dead path 결정 근거·참조 문서 경로를 추가했다. 이는 아키텍처 결정 근거(Rationale)를 spec 이 아닌 코드 주석에 직접 남기는 방식으로, CLAUDE.md 규약상 결정 근거는 spec 의 `## Rationale` 섹션에 두도록 권장된다. 단, 코드 주석에서 `plan/complete/kb-graph-stats-dead-path.md` 와 `spec/5-system/6-websocket-protocol.md ## Rationale` 를 명시적으로 가리키고 있어 단일 진실 원칙을 위반하지는 않는다. 주석 분량이 다소 길어졌으나 dead path 제거 결정의 이유를 현장에서 읽히게 하려는 의도로 판단된다. 범위 이탈이라기보다 허용 범주의 문서화.
  - 제안: 허용. 다만 미래에 동일 파일이 추가 수정될 때 주석이 최신 상태와 어긋나지 않도록 유의.

### kb-stats.helper.spec.ts (신규 파일)

- **[INFO]** 신규 테스트 파일 — 의도된 변경
  - 위치: 파일 전체 (46 라인)
  - 상세: plan 문서 작업 단위에 `kb-stats.helper.spec.ts 신규 작성 — refresh() SQL UPDATE 동작 회귀 방지 (TDD)` 가 명시되어 있으며, TDD 의무 규약에도 부합한다. `@nestjs/testing`, `typeorm.DataSource` 두 임포트 모두 테스트 본문에서 실제로 사용되므로 불필요한 임포트 없음.
  - 제안: 이슈 없음.

- **[INFO]** 반환값 미검증 (RETURNING 결과 활용 안 함)
  - 위치: spec.ts L56–65 (첫 번째 `it` 블록)
  - 상세: 프로덕션 코드(`refresh`)가 RETURNING 결과를 사용하지 않으므로 `entityCount`, `relationCount` 를 assert 하지 않는 것은 올바른 설계다. SQL 패턴 검증에 집중한 테스트 범위는 현재 구현과 정확히 일치한다. 범위 이탈 없음.
  - 제안: 이슈 없음.

### plan/in-progress/kb-graph-stats-dead-path.md

- **[INFO]** plan 문서 갱신 — 의도된 변경
  - 위치: diff 전체
  - 상세: worktree 배정(`dead-path-removal-2f1c8a`), decision 필드 추가, 옵션 결정 섹션 신설, 작업 단위 체크리스트 갱신, 후속 항목 명시. 모두 plan 라이프사이클 규약에 따른 정상 갱신이며 구현 변경 범위와 직접 연결된다.
  - 제안: 이슈 없음.

- **[INFO]** plan 문서 미완 체크박스 다수 잔존
  - 위치: `## 작업 단위 (옵션 B)` — `[ ]` 항목 5개 잔존
  - 상세: 본 리뷰 시점은 구현 진행 중으로, 체크박스 미체크는 정상 상태다. plan 이 `in-progress/` 에 위치하는 것도 규약에 부합한다. 범위 이탈 아님.
  - 제안: 이슈 없음.

---

## 요약

세 파일 모두 변경 의도(dead path WebSocket broadcast 코드 제거 + 회귀 방지 테스트 추가 + plan 상태 갱신)와 정확히 일치한다. `kb-stats.helper.ts` 에서 WebsocketService 임포트·constructor 인자·emit 블록 제거, 타입 파라미터 제거, JSDoc 재작성이 이루어졌으며 모두 dead path 제거의 논리적 연쇄 결과다. 요청 범위를 벗어나는 추가 리팩토링, 기능 확장, 무관 파일 수정, 의미 없는 포맷팅 변경은 관찰되지 않는다. JSDoc 분량 증가는 아키텍처 결정 문서화 목적으로 범위 내 허용 수준이다.

## 위험도

NONE
