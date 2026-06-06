# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후, diff-base=origin/main)
검토 시각: 2026-06-06

---

## 발견사항

### INFO — `input_type` 헤더 용어와 Cafe24 API 카탈로그의 동명 필드
- target 신규 식별자: `spec/5-system/8-embedding-pipeline.md §5.4` 섹션 제목 "비대칭 입력 (input_type / prefix)" 의 `input_type` 표기
- 기존 사용처: `spec/conventions/cafe24-api-catalog/order/orders.md`, `spec/conventions/cafe24-api-catalog/order/orderform-properties.md`, `spec/conventions/cafe24-api-catalog/store/orderform-setting.md` — Cafe24 주문서 추가항목 입력형식(T/M/R/C/S/D/I) 필드명
- 상세: 섹션 제목에 포함된 `input_type` 텍스트는 임베딩 API 의 query/document 구분 힌트 개념이고, Cafe24 카탈로그의 `input_type` 은 주문서 UI 입력 폼 형식 enum 이다. 두 사용처가 완전히 다른 도메인에 격리되어 있어 실제 충돌은 없다. 코드상 식별자도 별개(`InputType` enum vs Cafe24 API 스키마 필드)다.
- 제안: 충돌 없음. 섹션 제목의 괄호 표기는 개념 설명이므로 변경 불필요.

### INFO — `§5.4` 섹션 번호가 기존 계획 파일들의 "§5.4" 레퍼런스와 중복 가능성
- target 신규 식별자: `spec/5-system/8-embedding-pipeline.md §5.4 비대칭 입력` (origin/main 에서 §5.3 이 마지막이었고 §5.4 는 신규 삽입)
- 기존 사용처: `plan/in-progress/` 다수 파일에 `§5.4` 형태 레퍼런스가 존재하나, 그 모두가 `8-embedding-pipeline.md` 가 아닌 타 spec 파일(slack.md, canvas.md, discord.md, telegram.md, chat-channel.md, node-output-redesign/ 등)의 §5.4 를 가리킨다.
- 상세: `8-embedding-pipeline.md` 의 §5.4 는 이번 신규 추가이며, 기존 plan 파일들 중 `8-embedding-pipeline.md §5.4` 를 가리키는 레퍼런스는 존재하지 않는다(검색 결과 0건). 신규 섹션 번호가 기존 plan 참조를 오염시키지 않는다.
- 제안: 이슈 없음.

---

## 요약

이번 변경이 도입하는 주요 신규 식별자는 다음과 같다: `inputType` 파라미터(LLMClient.embed / LlmService.embed), `embedding-input-type.ts` 모듈, `§5.4 비대칭 입력` 섹션, `embedding-model-recommendation.ts` 프론트엔드 모듈, "한국어 추천" UI 텍스트 배지. 이들 중 어느 것도 기존 spec, plan, 또는 컨벤션 파일에서 다른 의미로 사용 중인 동일 식별자와 충돌하지 않는다. `input_type` 텍스트는 Cafe24 API 카탈로그에 동명 필드가 존재하지만 완전히 다른 도메인(주문서 UI 입력폼 형식)으로 격리되어 있어 실질적 혼선이 없다. `R-1` Rationale 앵커는 origin/main 시점에 이미 `5-knowledge-base.md` 에 존재하던 것으로 신규 식별자가 아니며 변경 없이 그대로 유지되었다. 기존 호출부 하위호환(inputType 생략 시 'document' 기본값)도 spec 에 명시되어 있어 API 충돌 위험이 없다.

---

## 위험도

NONE
