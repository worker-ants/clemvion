# Cross-Spec 일관성 검토 결과

target 문서: `plan/in-progress/spec-fix-error-code-routing.md`

---

## 발견사항

### 1. [INFO] `3-error-handling.md §1.3` 본문 — `MODEL_CONFIG_DEFAULT_MISSING` 행 기술 범위 미명시

- **target 위치**: target draft §제안 변경 1 — `3-error-handling.md §1.3` `MODEL_CONFIG_DEFAULT_MISSING` 행 before/after
- **충돌 대상**: `/spec/5-system/3-error-handling.md` §1.3 (line 51)
- **상세**: 현재 `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING` 행 설명은 "`resolveConfig` 의 ws default 경로 (`model-config.service.ts` 발행)"로만 기술되어 있다. `resolveEmbedding` 이 ws-default 부재 시 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용한다는 사실이 이 카탈로그 행에 나타나지 않으므로, 두 코드를 나란히 보는 독자가 `resolveEmbedding` 경로가 어떤 코드를 사용하는지 한눈에 판단할 수 없다. target draft 의 after 문구는 이를 인라인 주석으로 보완하며 내용 자체는 기존 spec 과 모순되지 않는다.
- **제안**: target draft 제안 그대로 적용하면 카탈로그 일관성이 개선된다. 추가로 `8-embedding-pipeline.md §5.5` line 168 의 "둘 다 없으면 `MODEL_CONFIG_NOT_FOUND`(404)" 표현도 같은 맥락 주석을 달 수 있으나, 해당 행은 이미 resolveEmbedding 전용 섹션 안에 있어 혼동 위험이 낮으므로 의무 수정은 아니다.

---

### 2. [INFO] `3-error-handling.md` Rationale — `resolveEmbedding` 404 유지 근거 미기술

- **target 위치**: target draft §제안 변경 2 — Rationale 분리 섹션 말미 추가 문구
- **충돌 대상**: `/spec/5-system/3-error-handling.md` §Rationale (line 395–401)
- **상세**: 현재 Rationale 의 분리 섹션은 id 경로(NOT_FOUND 404) vs default 미설정(DEFAULT_MISSING 400) 분리 근거를 설명하지만, `resolveEmbedding` 이 의도적으로 NOT_FOUND(404)를 유지하는 이유는 기술하지 않는다. target draft 가 추가하려는 문구는 기존 Rationale 내용과 직접 모순되지 않으며, 미기술된 설계 의도를 보완한다.
- **제안**: target draft 제안 그대로 적용하면 Rationale 완결성이 향상된다.

---

### 3. [INFO] `2-navigation/5-knowledge-base.md` — `MODEL_CONFIG_NOT_FOUND` 맥락 주석 미기술

- **target 위치**: target draft §제안 변경 3 — KB nav spec 맥락 주석 추가
- **충돌 대상**: `/spec/2-navigation/5-knowledge-base.md` (line 239 Rationale 단락)
- **상세**: KB nav spec 의 Rationale 단락(line 239)은 "없으면 임베딩 사용 전 ModelConfig 설정 필요 — `MODEL_CONFIG_NOT_FOUND`"로 기술한다. `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING`(400) 와의 의도적 분리가 이 위치에 명시되지 않아 I-4 혼선이 잔존한다. target draft 의 맥락 주석 추가는 기존 KB spec 내용과 모순되지 않으며, 에러코드 분리 의도를 서술형으로 보강한다.
- **제안**: target draft 제안 그대로 적용 가능하다. 추가 주석을 삽입할 위치는 line 239 의 "없으면 임베딩 사용 전 ModelConfig 설정 필요 — `MODEL_CONFIG_NOT_FOUND`" 문장 뒤가 적합하다.

---

### 4. [INFO] `conventions/error-codes.md §4` Rename 이력 — `resolveEmbedding` 경로 언급 부재

- **target 위치**: target draft 가 직접 수정 대상으로 명시하지 않은 연관 문서
- **충돌 대상**: `/spec/conventions/error-codes.md` §4 (line 70)
- **상세**: §4 의 `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING` 이력 행 비고에 "id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리"만 기술되어 있고, `resolveEmbedding` 의 `MODEL_CONFIG_NOT_FOUND`(404) 사용이 rename 이력 맥락에서 언급되지 않는다. `3-error-handling.md §1.3` 개정과 함께 이 행 비고를 동기화하면 이력 추적이 완결된다. 현재는 모순이 아닌 누락이다.
- **제안**: target draft 적용 후 `conventions/error-codes.md §4` line 70 의 비고 문구를 다음과 같이 보강 검토: "id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리. `resolveEmbedding` ws-default 부재도 `MODEL_CONFIG_NOT_FOUND`(404) 유지 (리소스 부재 — 사용자 결정 2026-06-12)." (의무 아님, 동기화 권장.)

---

## 요약

target draft 가 제안하는 세 가지 spec 변경(에러코드 카탈로그 행 보강, Rationale 추가, KB nav 맥락 주석)은 기존 spec 과 직접 모순되지 않는다. 현재 `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING` 행은 `resolveConfig` 경로만 명시하고 `resolveEmbedding` 이 `MODEL_CONFIG_NOT_FOUND`(404)를 사용한다는 사실이 카탈로그에서 은닉되어 있어 W-1/I-4 혼선이 잔존하는 상태이므로, target draft 의 보강은 올바른 방향이다. 부가적으로 `conventions/error-codes.md §4` rename 이력 행 비고도 동기화하면 cross-spec 완결성이 높아지나, 이는 강제 사항이 아니다.

## 위험도

NONE
