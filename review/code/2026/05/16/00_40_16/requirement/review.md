# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `refresh()` 반환값이 RETURNING 결과를 활용하지 않음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L236–248
  - 상세: 현재 `refresh()` 는 `Promise<void>` 를 반환하며 DB RETURNING 결과를 완전히 버린다. 의도된 설계(주석에 명시)이고 호출자도 반환값을 사용하지 않으므로 현재 요구사항 범위에서는 문제 없다. 그러나 향후 호출자가 갱신된 카운트를 필요로 할 경우 API 변경 비용이 발생한다.
  - 제안: 현재 옵션 B 결정 범위 내에서는 유지해도 무방하다. 필요 시 `Promise<{ entityCount: number; relationCount: number } | null>` 로 시그니처를 확장할 수 있음을 주석에 남겨두는 것을 고려.

- **[INFO]** `knowledgeBaseId` 입력 유효성 검증 없음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L236
  - 상세: `knowledgeBaseId` 가 빈 문자열, undefined, null 인 경우 SQL 파라미터로 그대로 전달된다. PostgreSQL 은 `WHERE id = ''` 를 정상 실행해 0 rows 업데이트하므로 런타임 오류는 없으나 호출자 버그를 묵과하게 된다. 현재 호출 사이트가 TypeScript 타입으로 `string` 을 강제하고 있어 실질적 위험은 낮음.
  - 제안: 필수 요구사항은 아니나, `if (!knowledgeBaseId) return;` 또는 guard clause 추가를 고려.

- **[INFO]** 테스트가 반환값(entity_count, relation_count)을 검증하지 않음
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` L50–65
  - 상세: 첫 번째 테스트에서 mock 이 `{ entity_count: 12, relation_count: 34 }` 를 반환하도록 설정했으나, `refresh()` 의 반환값이 `void` 이므로 해당 값이 정확히 처리되는지를 테스트하는 assertion 은 존재하지 않는다. 이는 현재 `void` 반환 설계와 일치하나, 테스트 설명 문구("returns the new values")와 미묘한 불일치가 있다.
  - 제안: 테스트 설명을 "runs a single atomic UPDATE that recounts entity + relation" 으로 단순화해 실제 검증 범위와 일치시키는 것을 권장.

- **[INFO]** plan 문서에 미완료 체크박스 3개 존재 (정상 상태)
  - 위치: `plan/in-progress/kb-graph-stats-dead-path.md` L377–381
  - 상세: `kb-stats.helper.spec.ts` 신규 작성, `kb-stats.helper.ts` 코드 제거, TEST WORKFLOW, REVIEW WORKFLOW, plan 이동 + PR 생성 항목이 미완료 상태다. 이는 현재 리뷰 대상 변경이 작업 진행 중임을 나타내며, plan 이 `in-progress/` 에 위치한 것은 규약과 일치한다.
  - 제안: 해당 체크박스들은 이번 diff 에서 완료된 두 항목(spec.ts 작성, helper.ts 수정)으로 마킹 업데이트가 필요하다.

## 요약

이번 변경은 `KbStatsHelper` 에서 도달 불가능한 WebSocket broadcast dead path 를 제거하는 명확한 목적의 작업이다. `kb-stats.helper.ts` 는 `WebsocketService` 의존성을 제거하고 SQL UPDATE + RETURNING 단일 호출로 단순화되었으며, 이는 요구사항(옵션 B 선택)에 완전히 부합한다. 테스트는 핵심 시나리오 3가지(정상 실행·빈 RETURNING·DB 오류)를 모두 커버하며, 의도한 SQL 구조를 정규식으로 구체적으로 검증한다. 발견된 항목들은 모두 INFO 등급으로, 기능 완전성·에러 시나리오·비즈니스 로직 반영 측면에서 심각한 문제는 없다. 테스트 설명 문구의 사소한 의도-구현 불일치와 반환값 미활용은 현재 요구사항 범위를 벗어나지 않는다.

## 위험도

LOW
