# Resolution — 2026-04-24 ai-review (text_classifier evidence)

## 조치한 항목

### Warning

| # | 항목 | 조치 |
| --- | --- | --- |
| W1 | sanitizeEvidence 길이 무제한 | `text-classifier.handler.ts`: `MAX_EVIDENCE_ITEMS = 20`, `MAX_EVIDENCE_ITEM_LENGTH = 200` 상한 추가. handler.spec.ts에 oversized 케이스 검증 테스트 추가. |
| W2 | PII echo-back 경고 미문서화 | `en.ts` / `ko.ts` `includeEvidenceHint` 에 "민감정보/PII 입력 사용 시 다운스트림 처리 검토 후 사용" 주의 한 줄 추가. |
| W6 | 테스트 이름 `coerce` ↔ 동작 `drop` 불일치 (4개 에이전트 동시 지적) | `should drop non-string evidence items to preserve string[] contract` 로 rename. |
| W7 | `includeEvidence: true` + `includeConfidence: false` 조합 미검증 | single-label / multi-label 각각 `should expose ... even when includeConfidence is false` 케이스 추가. |
| W8 | multi-label 빈 categories 반환 + evidence 활성 시 fallback 미검증 | `should route to fallback with empty categories when LLM returns []` 케이스 추가. |

### INFO

| # | 항목 | 조치 |
| --- | --- | --- |
| I1 | sanitizeEvidence 단일/다중 라벨 호출 비일관 | single-label에서도 `if (includeEvidence)` 가드로 호출 일관화. |
| I3 | catch 블록 evidence 암묵적 의존 | `evidence = []` 명시적 재할당 추가. |
| I5 | `textClassifierNodeConfigSchema` `includeEvidence` 기본값 미검증 | `schema.spec.ts` 에 `defaults includeEvidence to false`, `accepts includeEvidence: true` 케이스 추가. |

## Out of scope (별도 이슈로 권고)

| # | 항목 | 사유 |
| --- | --- | --- |
| W3 | 카테고리명 프롬프트 인젝션 (개행 문자 등) | 본 PR 이전부터 존재한 기존 취약점. evidence 추가로 신규 노출 면적이 늘어난 것이 아니라(악의적 카테고리명은 evidence 비활성 시에도 위험), 본 PR 범위와 분리해 별도 hardening PR 로 다루는 것이 적절. **TODO**: `validate()` 에 `name` 의 control-character 차단 추가, `categoryList` builder 에 escape 로직 도입. |
| W4 | `OutputOptions` 값 객체로 boolean 플래그 묶기 (OCP) | 현재 플래그 2개 — 즉시 OCP 위반은 아님. **다음(3번째) 플래그 추가 시점** 에 리팩토링 권고. |
| W5 | `responseFields` `filter(Boolean)` → 명시 push 패턴 | 동작은 정확하며 가독성 차원의 권고. 같은 시점 W4 와 함께 정리 권장. |
| INFO 2 | 조건부 spread 패턴 산재 | 현재 2개 플래그 수준에서는 허용 범위. W4/W5 와 같은 시점 정리. |
| INFO 4 | `usage` 픽스처 인라인 중복 | 가독성 차원 권고. 별도 테스트 청소 PR 시 일괄 정리. |
| INFO 6 | `sanitizeEvidence` 단위 테스트 분리 | 핸들러 통합 경로(상한, drop, fallback)로 모든 분기가 커버됨. export 분리는 이득 대비 비용이 크지 않아 보류. |
| INFO 7 | `includeConfidence` UI 기본값(`?? true`) ↔ schema 기본값(`false`) ↔ spec(`기본: false`) 불일치 | **이번 PR 이전부터의 기존 버그**. UI default 를 변경하면 기존 사용자 노드의 표시 상태가 바뀌어 사용자 영향 가능. spec doc 수정/별도 마이그레이션 검토 필요. 본 PR 범위 외. |
| INFO 8 | 어댑터 평탄화(`output.result.*` → `output.*`) 미문서화 | 기존 구조적 사안. 별도 문서 정리 PR 권장. |
| INFO 9 | spec 출력 예시에 `includeConfidence: true, includeEvidence: true` 전제 명시 | 현재 예시 본문 텍스트에 "`evidence` 는 `includeEvidence: true` 일 때만 포함" 명시되어 있어 혼동 위험 낮음. 권고 보류. |
| INFO 10 | spec flat → result wrapper 수정의 PR 분리 권고 | 본 PR 의 evidence 필드 추가 자체가 `output.result.*` 위치에 추가되므로 spec 와 핸들러 정합성을 맞추는 변경이 필수적. 동일 PR 에 포함하는 것이 정합성 측면에서 더 안전. |

## 후속 액션 제안

1. **Security hardening PR**: 카테고리명 control-character 차단 + 프롬프트 escape (W3).
2. **OutputOptions 리팩토링**: 다음 플래그(예: `includeReasoning`, `includeChainOfThought`) 추가 시 W4/W5/INFO 2 함께 처리.
3. **UI default 정합화 PR**: `includeConfidence` UI 기본값을 schema 기본값(`false`)에 맞추거나, spec 에 의도된 UX 예외로 명시 (INFO 7).
