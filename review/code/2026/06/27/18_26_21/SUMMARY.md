# Code Review 통합 보고서 (ModelListDto swagger fix, range 9381d0bce..HEAD)

## 전체 위험도
**LOW** — Critical 0 / **Warning 0**. 전 발견 INFO. swagger OpenAPI 메타데이터 정합 수정으로 런타임 동작 byte-identical, 실질 위험 없음.

## Critical / WARNING
_없음._

## 참고 (INFO) — 전부 선택적/pre-existing/범위 외

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | Security | `GET :id/models` 공통 가드 소속 검증 문서화 — pre-existing, 본 변경 무관 | 별 트랙 |
| 2 | Security | preview apiKey 예외 노출 가능성 — pre-existing, 범위 외 | 별 트랙 |
| 3 | Architecture | `ModelTypeFilter extends ModelInfo['type']` 컴파일 assertion 부재 | 선택적 — #720 I-6 과 동일, model-config→llm 역import 우려로 보류 |
| 4 | Architecture | `ModelInfo` JSDoc 에 대응 DTO 역참조 추가 | 선택적 |
| 5 | Scope | `mc-config-polish.md` spec_impact 추가가 범위 외 — 단, Gate C 테스트 통과 위한 불가피 선행, 플랜·커밋에 문서화 | 수용(문서화됨) |
| 6 | Maintainability | `@ApiTooManyRequestsResponse` description 3핸들러 리터럴 — pre-existing(#720) | 선택적 |
| 7 | Maintainability | preview/listModels description 동일 | 선택적 |
| 8 | Maintainability | `ModelInfoDto` JSDoc 폐기 이력 5줄 | 선택적 |
| 9 | Testing | swagger 메타데이터 직접 검증 부재 — `wrapItemsSchema` 는 api-wrapped.spec 별도 검증, 회귀 위험 낮음 | 선택적 |
| 10 | API Contract | codegen 클라이언트 `type` 신규 필드 — 하위호환 파괴 아닌 버그 수정(런타임은 이미 type 반환) | 안내 |
| 11 | API Contract | 삭제 안전성 packages/ 재확인 | **확인 완료 — packages/·channel-web-chat 참조 0** |
| 12 | Documentation | JSDoc 경로 산문형 표기 | 선택적 |
| 13 | Documentation | `ModelTestConnectionResultDto.dimension` 영문 description — pre-existing | 별 트랙 |

## 에이전트별 위험도

| 에이전트 | 위험도 |
|----------|--------|
| architecture / requirement / scope / side_effect / maintainability / documentation | NONE |
| security / testing / api_contract | LOW (전부 INFO) |

## 라우터 결정

실행 9명, 제외 5명(performance·dependency·database·concurrency·user_guide_sync — swagger 메타데이터 전용 변경, spec_impact:none).

## 결론

clean (Critical/Warning 0). 핵심 수정(Swagger↔wire shape 정합)이 의도대로 반영. INFO 전부 선택적/별 트랙. push 가능.
