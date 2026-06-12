## 발견사항

- **[INFO]** 기존 Rationale 의 분리 기준 기술이 resolveEmbedding 케이스를 묵시적으로 누락
  - target 위치: `plan/in-progress/spec-fix-error-code-routing.md §제안변경 1·2·3`
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §§397-401 Rationale` — "`MODEL_CONFIG_NOT_FOUND`(404) 와 `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리 (PR4b)": "id 지정 경로의 '지정 config 부재'(404)"와 "id 미지정 경로의 '워크스페이스 default 미설정'(400)"으로 분리.
  - 상세: 기존 Rationale 는 분리 기준을 "id 지정 경로 vs id 미지정(default) 경로"로 기술했다. 그러나 `resolveEmbedding`(§5.5 step-2)의 ws-default 부재도 엄밀히 말하면 "id 미지정 default 경로"인데 `MODEL_CONFIG_NOT_FOUND`(404)를 반환한다 — `MODEL_CONFIG_DEFAULT_MISSING`(400)이 아니다. 이 동작은 spec `8-embedding-pipeline.md §5.5`에 이미 명시됐고 `5-knowledge-base.md §R-1`도 `MODEL_CONFIG_NOT_FOUND`를 참조하나, `3-error-handling.md §1.3` 본문과 Rationale 어디에도 이 케이스가 왜 400이 아닌 404인지 기술되지 않았다. 결과적으로 "id 미지정 → 400"이라는 일반론과 resolveEmbedding 동작(id 미지정 → 404)이 충돌처럼 읽힌다. 이것은 **기각된 대안의 재도입이 아니라** 기존 Rationale 에 의도적 예외가 명시되지 않은 누락이다.
  - 제안: target 초안이 제안하는 변경(§1.3 셀 주석 추가 + Rationale 추가 항목)은 이 누락을 직접 보완하는 방향이며 기존 결정을 번복하지 않는다. 제안 그대로 적용 가능.

- **[INFO]** `spec/conventions/error-codes.md §4 Rename 이력` 도 동일한 보완이 필요할 수 있음
  - target 위치: target 초안이 변경 대상으로 열거하지 않은 파일
  - 과거 결정 출처: `spec/conventions/error-codes.md §4` — `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING` rename 설명: "id 미지정 시 워크스페이스 default config 부재 경로. id 부재(404)는 `MODEL_CONFIG_NOT_FOUND`로 별도 분리"
  - 상세: error-codes.md §4의 설명도 "id 미지정 경로 = `MODEL_CONFIG_DEFAULT_MISSING`(400)" 으로 읽히며, `resolveEmbedding`이 동일 경우에 404를 쓰는 예외를 기술하지 않는다. target 초안이 `3-error-handling.md`만 수정하면 `error-codes.md`와의 독자 인지 불일치가 남는다.
  - 제안: `error-codes.md §4` 해당 행 비고에 "단, resolveEmbedding ws-default 부재는 리소스 부재 의미로 `MODEL_CONFIG_NOT_FOUND`(404) 유지 — 3-error-handling.md Rationale 참조"를 한 줄 추가하거나, 3-error-handling.md Rationale 추가 문구에 error-codes.md cross-ref를 명시한다.

---

## 요약

target 초안(`spec-fix-error-code-routing.md`)은 기존 spec 의 Rationale 에서 명시적으로 기각된 대안을 재도입하지 않으며, 합의된 설계 원칙(`MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 분리)도 위반하지 않는다. 오히려 `3-error-handling.md §1.3` Rationale 의 분리 기준 기술이 `resolveEmbedding` 의 의도적 예외를 다루지 않아 발생한 내부 불일치를 해소하기 위한 보완 작업이다. 유일한 INFO 수준 보완 사항은 `spec/conventions/error-codes.md §4` rename 이력 비고도 동일한 맥락 주석이 필요하다는 점이며, 이를 빠뜨리면 독자에게 불일치가 남는다. 전반적으로 기존 결정·Rationale 과의 정합성은 양호하다.

---

## 위험도

LOW
