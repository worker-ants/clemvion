# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 기존 테스트 케이스 제목 및 본문 수정 (범위 내)
  - 위치: `cafe24-api.client.spec.ts` diff 라인 62~85 (기존 'PUT — serialises body as JSON with content-type' 테스트)
  - 상세: 기존 PUT 테스트의 이름과 검증 로직이 새로운 envelope 동작에 맞게 변경되었다. 이는 실질 변경(envelope wrapping)의 직접 결과이므로 정당한 수정이다. 단, 기존 테스트가 Content-Type 헤더만 검증했던 것 외에 `JSON.parse(init.body as string)`으로 바꾸면서 동시에 Content-Type 검증도 유지하고 있어 하위 호환 보장이 된다.
  - 제안: 해당 없음. 범위 내 수정이다.

- **[INFO]** GET 케이스 추가 테스트 (경계 검증)
  - 위치: `cafe24-api.client.spec.ts` 라인 138~151 ('GET — never wraps in envelope (no body)')
  - 상세: GET 메서드에는 envelope을 적용하지 않는다는 소극적 검증 테스트가 추가되었다. commit message에는 "4 new test cases"라고 명시했으나 실제로는 GET 포함 5개의 테스트 케이스가 추가/수정되었다. GET 케이스는 commit message가 명시한 범위("PUT with/without shop_no, POST, degenerate shop_no-only body")에 없지만, wrapInCafe24Envelope 함수가 GET에 영향을 미치지 않음을 보장하는 regression 방어 성격으로 기능 범위 내 정당한 추가이다.
  - 제안: commit message의 "4 new test cases" 표현이 실제로는 5개(수정 1 + 신규 4)에 해당하므로 정확성 측면에서 주석 또는 메시지 개선을 고려할 수 있으나, 리뷰 차단 사유는 아니다.

- **[INFO]** `wrapInCafe24Envelope` 함수 JSDoc 추가
  - 위치: `cafe24-api.client.ts` 라인 1195~1208 (새 함수의 블록 주석)
  - 상세: 새 private 함수에 JSDoc을 작성한 것은 의도한 변경의 일환이므로 불필요한 주석 추가가 아니다. 함수의 배경(Cafe24 400 에러 원인), 동작 원칙, 공식 문서 링크를 담고 있어 향후 유지보수에 가치가 있다.
  - 제안: 해당 없음.

- **[INFO]** spec 파일 미수정 (의도적 범위 분리)
  - 위치: commit message 내 "Plan + spec-update note under plan/in-progress for the planner to fold the wire-format rule into spec/conventions/cafe24-api-metadata.md"
  - 상세: 개발자 역할은 `spec/`을 read-only로 취급하고 spec 수정은 project-planner에 위임하는 것이 프로젝트 규약이다. commit message가 이 위임 사실을 명시한 것은 올바른 절차 준수다.
  - 제안: 해당 없음.

## 요약

이번 변경은 Cafe24 Admin API의 `request` envelope 요구사항에 대응하기 위한 최소한의 수정으로 구성되어 있다. 구현 측면에서는 `executeWithRateLimit` 내부의 단 한 줄(JSON.stringify 호출 대상을 wrapInCafe24Envelope 결과로 교체)과 이를 구현하는 23줄짜리 순수 함수 추가가 전부다. 테스트 파일은 기존 PUT 테스트 1개를 새 동작에 맞게 수정하고, 추가 엣지 케이스(shop_no 없음, POST, shop_no만 있음, GET 비적용) 4개를 신규 추가했다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 변경, 임포트 정리, 설정 파일 변경은 발견되지 않았다. commit message에서 명시한 "4 new test cases"가 실제 변경(수정 1 + 신규 4)과 정확히 일치하지 않는 경미한 표현 불일치가 있으나, 코드 품질에는 영향이 없다. 전체적으로 변경 범위는 의도된 fix의 경계를 충실히 준수하고 있다.

## 위험도

NONE
