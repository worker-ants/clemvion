# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `kb-stats.helper.ts` 클래스 독스트링 — dead path 제거 배경 설명이 충실하게 포함되어 있음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L3-L20 (JSDoc 블록)
  - 상세: 클래스 레벨 JSDoc 에 변경 배경·제거 이유·UX 영향 없음 근거·참조 문서(plan/spec) 링크까지 명시되어 있다. `refresh()` 메서드 자체에는 별도 독스트링이 없으나, 클래스 독스트링 마지막 줄("호출자는 … 한 번씩 호출")이 사용 계약을 충분히 설명한다.
  - 제안: 현 상태로 충분. 메서드 시그니처(`async refresh(knowledgeBaseId: string): Promise<void>`)가 단순하므로 별도 @param/@returns 추가는 선택적 수준.

- **[INFO]** `refresh()` 메서드의 RETURNING 결과 미사용에 대한 인라인 주석 부재
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L22-L30 (`await this.dataSource.query(...)`)
  - 상세: SQL 에 `RETURNING entity_count, relation_count` 절이 남아있으나 반환값을 변수에 바인딩하지 않는다. 이전 코드에서는 RETURNING 결과를 WebSocket emit 에 사용했으나 지금은 단순히 atomic UPDATE 검증용(행이 없으면 빈 배열)으로 남아있다. 코드만 보면 의도적 미사용인지 누락인지 불분명하다.
  - 제안: `// RETURNING 절은 UPDATE 성공 여부(빈 배열 = KB 행 미존재) 확인 목적; 현재 호출자는 반환값을 사용하지 않음` 수준의 한 줄 인라인 주석 추가를 권장.

- **[INFO]** 테스트 파일(`kb-stats.helper.spec.ts`)에 describe/it 설명은 충분하지만 파일 레벨 주석 없음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` 전체
  - 상세: 각 `it()` 설명문이 테스트 의도를 명확히 서술하고 있어 가독성은 양호하다. 다만 테스트 파일 상단에 "이 파일이 무엇을 검증하는지" 요약하는 블록 주석이 없다. 프로젝트 전반의 테스트 파일 관례와 일치하는지 확인 필요.
  - 제안: 프로젝트 다른 `.spec.ts` 파일에 파일 레벨 주석 관례가 없다면 현 상태 유지. 관례가 있다면 추가.

- **[INFO]** plan 문서가 미완료 체크박스를 포함한 상태로 `in-progress/`에 위치 — 정상
  - 위치: `plan/in-progress/kb-graph-stats-dead-path.md`
  - 상세: `[ ] kb-stats.helper.spec.ts 신규 작성`, `[ ] kb-stats.helper.ts broadcast 블록 제거` 등 미완 항목이 존재하므로 `in-progress/`에 두는 것이 프로젝트 규약상 올바르다. 단, 이번 diff에 해당 파일들이 포함되어 있으므로 리뷰 시점에서는 체크박스 갱신이 필요한 상태임.
  - 제안: spec.ts 와 helper.ts 변경이 이번 리뷰 대상에 포함되었으므로, 해당 두 항목(`kb-stats.helper.spec.ts 신규 작성`, `kb-stats.helper.ts broadcast 블록 제거`)의 체크박스를 `[x]`로 갱신하고 plan 문서를 업데이트해야 한다.

- **[INFO]** 클래스 독스트링 내 참조 경로 정확성
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L18-L19
  - 상세: `plan/complete/kb-graph-stats-dead-path.md` 를 참조하고 있으나 현재 해당 파일은 `plan/in-progress/kb-graph-stats-dead-path.md` 에 위치한다. PR 완료 후 `complete/` 로 이동되면 정확해지지만, 코드가 병합되는 시점에 plan 이동과 동기화되지 않으면 잘못된 경로를 가리키는 dead reference 가 된다.
  - 제안: plan 이동(`git mv`) 과 코드 독스트링의 경로 참조가 같은 커밋 또는 연속된 커밋으로 처리되도록 주의. 또는 `plan/` 경로 대신 `spec/5-system/6-websocket-protocol.md ## Rationale` 단독 참조로 교체하는 방안도 검토.

- **[INFO]** README 업데이트 필요성 — 해당 없음
  - 위치: 프로젝트 루트 `README.md`
  - 상세: 이번 변경은 내부 dead path 제거로 공개 API·설정·환경변수 변경이 없다. README 업데이트 불필요.

- **[INFO]** CHANGELOG 업데이트 필요성 — 해당 없음
  - 위치: 프로젝트 전체
  - 상세: 프로젝트가 별도 CHANGELOG 파일을 운영하지 않는 구조(spec + plan 이 역할을 대체)이므로 추가 조치 불필요.

## 요약

문서화 품질은 전반적으로 양호하다. `kb-stats.helper.ts` 의 클래스 독스트링은 dead path 제거의 배경·이유·UX 영향·참조 문서까지 상세히 기술하여 ADR 수준의 설명을 인라인에서 제공하고 있다. plan 문서도 의사결정 근거와 후속 작업을 구조적으로 정리하고 있다. 주요 개선 포인트는 두 가지로, (1) `RETURNING` 절 미사용 의도를 명시하는 한 줄 인라인 주석 추가, (2) 독스트링에서 참조하는 `plan/complete/` 경로가 실제 파일 이동과 동기화되지 않을 경우 dead reference 가 될 수 있으므로 plan 이동 시점과의 정합성 확인이 필요하다.

## 위험도

LOW
