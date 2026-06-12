# 신규 식별자 충돌 검토 결과

## 발견사항

### [CRITICAL] `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로 기술이 두 plan 파일에서 충돌

- **target 신규 식별자**: `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로를 `resolveConfig` ws default 경로만으로 좁히는 기술 — target(`spec-fix-error-code-routing.md`) 의 제안 §1 "After" 텍스트: `resolveConfig` 의 ws default 경로만 명시하고 `resolveEmbedding` 은 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용함을 주석으로 추가하는 방향
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/plan/in-progress/spec-update-pr4b-embedding-retire.md` 라인 60 에서 `MODEL_CONFIG_DEFAULT_MISSING` 의 설명을 `"resolveConfig / resolveEmbedding ws default 경로"` — 즉 두 경로 모두 포함하는 것으로 기술함
- **상세**: `spec-update-pr4b-embedding-retire.md` 는 `MODEL_CONFIG_DEFAULT_MISSING` 의 발행 경로로 `resolveConfig` 와 `resolveEmbedding` 모두를 열거한다(라인 60). 반면 `spec-fix-error-code-routing.md`(target) 는 이 두 경로가 의도적으로 다른 에러코드를 사용하며(`resolveEmbedding` 은 `MODEL_CONFIG_NOT_FOUND`(404), `resolveConfig` 는 `MODEL_CONFIG_DEFAULT_MISSING`(400)), `spec-update-pr4b-embedding-retire.md` 의 기술 자체가 잘못됐다고 전제한다. 두 plan 파일이 동일한 식별자(`MODEL_CONFIG_DEFAULT_MISSING`)의 의미·발행 경로를 정반대로 기술하고 있어 충돌한다. 현재 `spec/5-system/3-error-handling.md §1.3` 라인 51 의 실제 spec 본문은 `resolveConfig` 의 ws default 경로만 기술하고 있어 target plan 의 전제(resolveEmbedding 은 이미 NOT_FOUND(404) 를 쓴다)와 일치한다. 즉 `spec-update-pr4b-embedding-retire.md` 라인 60 의 "resolveConfig / resolveEmbedding ws default 경로" 표기가 부정확하다.
- **제안**: `spec-update-pr4b-embedding-retire.md` 라인 60 을 target(`spec-fix-error-code-routing.md`)의 결론과 일치하도록 수정 — `resolveEmbedding` 을 `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로에서 제외하고, `resolveEmbedding` 의 ws-default 부재는 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용한다고 주석을 추가해야 두 plan 파일이 일관된 계약을 제공한다. target 의 spec 변경 자체(§1.3 설명 추가·Rationale 보강·KB nav 주석)는 현행 spec 본문과 충돌하지 않고 보완 관계이므로 진행 가능하다.

---

### [INFO] `resolveEmbedding` 이라는 함수명이 plan 파일과 spec 본문 사이에서 표기 스타일이 다름

- **target 신규 식별자**: target 문서가 `resolveEmbedding` 을 에러코드 발행 경로의 공식 식별자로 반복 사용
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/8-embedding-pipeline.md` 라인 159–170 에서 `ModelConfigService.resolveEmbedding` 으로 동일 이름 사용. `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/7-llm-usage.md` 라인 119 에서도 `resolveEmbedding` 으로 일치함
- **상세**: 이름 자체의 충돌은 없고 동일 심볼을 참조하고 있다. target 이 도입하는 `resolveEmbedding` 식별자는 기존 spec 과 명명이 완전히 일치한다.
- **제안**: 별도 조치 불필요.

---

### [INFO] target 의 spec 변경이 `spec-update-pr4b-embedding-retire.md` 의 완료 체크박스 범위와 중첩 가능성

- **target 신규 식별자**: `spec/5-system/3-error-handling.md §1.3` 에 대한 추가 변경 제안
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/plan/in-progress/spec-update-pr4b-embedding-retire.md` 라인 108 에서 동일 파일(`spec/5-system/3-error-handling.md §1.3`)을 변경 대상으로 이미 열거하고 있음
- **상세**: 두 plan 파일이 동일 파일의 동일 섹션을 수정 대상으로 잡고 있으나, target 이 추가하는 내용(`resolveEmbedding` 경로 명시 + Rationale 추가)은 `spec-update-pr4b-embedding-retire.md` 가 커버하지 않은 추가 명시이므로 실질 내용은 보완적이다. 단, 두 plan 이 같은 파일 섹션에 순차 편집을 요구할 경우 적용 순서를 조율해야 한다.
- **제안**: target plan 을 적용할 때 `spec-update-pr4b-embedding-retire.md` 의 §1.3 편집이 먼저 완료됐는지 확인하고, 최종 텍스트가 두 plan 의 의도를 모두 반영하는지 검증한다.

---

## 요약

신규 식별자 충돌 관점에서 가장 중요한 문제는 `MODEL_CONFIG_DEFAULT_MISSING` 의 발행 경로를 두 plan 파일이 서로 모순되게 기술하고 있다는 점이다. `spec-update-pr4b-embedding-retire.md`(라인 60)는 `resolveEmbedding` 도 이 코드를 발행하는 경로로 포함하지만, target(`spec-fix-error-code-routing.md`)은 `resolveEmbedding` 은 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용하며 두 경로가 의도적으로 다름을 명시한다. 현행 `spec/5-system/3-error-handling.md §1.3`(라인 51)은 target 의 전제와 일치하므로, `spec-update-pr4b-embedding-retire.md` 라인 60 이 부정확한 쪽이다. target 이 제안하는 spec 변경 자체(설명 추가·Rationale 보강·KB nav 주석)는 새 에러코드나 새 식별자를 신설하지 않으며 기존 spec 본문과 이름 충돌이 없어 진행 가능하다. 단, 병행 편집 중인 `spec-update-pr4b-embedding-retire.md` 의 잘못된 경로 기술을 함께 수정해야 한다.

## 위험도

MEDIUM
