# 변경 범위(Scope) 리뷰 결과

리뷰 대상: chat-channel-error-notify 브랜치 (42개 파일)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] review/ 산출물 파일 다수 포함 (파일 23~36)
- 위치: `review/consistency/2026/05/25/11_07_03/` 및 `review/consistency/2026/05/25/12_12_13/` 하위 10개 파일
- 상세: `_retry_state.json`, `meta.json`, `convention_compliance.md`, `cross_spec.md`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md` 등이 diff 에 포함되어 있다. 이 파일들은 consistency-check 워크플로우가 구현 착수 전(--impl-prep) 과 spec draft 검토(--spec) 단계에서 의무적으로 생성하는 산출물이다. 본 PR 작업 흐름의 정상 산출물이므로 불필요한 범위 이탈이 아니다.
- 제안: 없음. 정상 워크플로우 산출물.

### [INFO] `plan/in-progress/` 파일 2개 포함 (파일 21~22)
- 위치: `plan/in-progress/chat-channel-error-notify.md`, `plan/in-progress/spec-draft-chat-channel-error-notify.md`
- 상세: plan 파일 갱신은 CLAUDE.md developer 역할 쓰기 권한 범위 내(`plan/**`)이며, SDD 워크플로우의 작업 추적 의무에 해당한다. 특히 spec-draft plan 은 spec 변경과 동반되어야 한다.
- 제안: 없음. 정상 워크플로우 산출물.

### [INFO] 기존 테스트 케이스 교체 — 의미론적 확장 (파일 3, 5)
- 위치: `slack-message.renderer.spec.ts:306`, `telegram-message.renderer.spec.ts:499`
- 상세: 두 파일에서 기존 테스트 케이스(`'failed → 사용자 안전 안내'`)가 CCH-ERR-03 민감정보 미노출 검증 케이스로 교체되었다. 기존 케이스는 `error.message` 원문(`'something'`, `'internal'`)을 결과 텍스트에서 `toContain` 검증했는데, 이는 이번 변경이 수정하는 바로 그 동작(민감정보 노출)을 검증하는 것이었다. 따라서 교체는 단순 삭제가 아니라 구 동작 spec 이 파괴적으로 변경됨에 따른 테스트 갱신이다. breaking change 가 명시적으로 기술되어 있으므로(`renderFailedMessage` 주석 "Breaking change (2026-05-25)") 범위 이탈이 아니다.
- 제안: 없음. 의도된 breaking change 동반 테스트 갱신.

### [INFO] 문서 섹션 번호 재지정 — 기존 콘텐츠 변경 없음 (파일 15~20)
- 위치: 6개 MDX 파일 (`discord.en.mdx`, `discord.mdx`, `slack.en.mdx`, `slack.mdx`, `telegram.en.mdx`, `telegram.mdx`) 의 Troubleshooting / Limitations 섹션 번호
- 상세: 각 파일에서 신규 "안내 메시지 커스터마이즈" 섹션이 추가됨에 따라 기존 "7. Troubleshooting", "6. Troubleshooting", "7. Limitations", "7. 트러블슈팅", "7. 제한 사항" 등이 "8." 또는 "7." 로 번호가 올라갔다. 기존 콘텐츠 내용은 변경되지 않았고 새 섹션을 앞에 삽입하는 순서 조정이다. 신규 기능 문서화의 자연스러운 결과이므로 불필요한 리팩토링이 아니다.
- 제안: 없음. 섹션 삽입에 따른 필연적 번호 재지정.

### [INFO] `DTO` 파일에 validator 로직 상당량 추가 (파일 12)
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:119~182`
- 상세: `LanguageHintsPlaceholderValidator` 클래스(`@ValidatorConstraint`), `FAILURE_HINT_KEYS` 상수, `findFirstUnknownPlaceholder` 함수, `languageLocale` 필드 선언이 추가되었다. 이 모든 추가는 CCH-ERR-03 (placeholder 화이트리스트) + `languageLocale` 필드 검증을 위한 것으로 직접적 요구사항(`R-CC-15 (c)`) 범위 내다. 추가 코드 규모가 크지만 단일 목적(DTO 검증)에 집중되어 있다.
- 제안: 없음. 요구사항에 직결된 DTO 확장.

### [INFO] `spec/conventions/chat-channel-adapter.md` diff 가 프롬프트 크기 제한으로 생략됨 (파일 42)
- 위치: `spec/conventions/chat-channel-adapter.md`
- 상세: diff 가 "... (diff omitted due to prompt size limit) ..." 로 생략되어 전체 내용을 검토할 수 없었다. consistency review 산출물(`rationale_continuity.md`)에서 이 파일에 `§3.1 Execution Failed 분류 알고리즘` 과 Rationale `R5` 가 추가된다고 언급하고 있어, 해당 내용이 plan 에 명시된 변경 범위 내임은 간접 확인 가능하다. 단, 직접 diff 를 검토하지 못했으므로 해당 파일에 범위 외 변경이 없다는 것은 완전히 검증되지 않았다.
- 제안: orchestrator 가 필요하다면 해당 파일의 diff 를 별도로 추출해 추가 검토 가능. 그러나 산출물의 간접 증거로는 범위 내 변경으로 판단한다.

### [INFO] `spec/5-system/15-chat-channel.md` diff 가 프롬프트 크기 제한으로 생략됨 (파일 40)
- 위치: `spec/5-system/15-chat-channel.md`
- 상세: 위와 동일 사유로 diff 생략. consistency review 결과물들이 `§3.5 CCH-ERR-*` 신설, `§4.1 languageLocale` 필드 추가, `§4.1.1 default 문구 표`, `R-CC-15` Rationale 추가를 기술하고 있어 계획된 변경이 반영된 것으로 간접 확인 가능하다.
- 제안: 위와 동일.

---

## 요약

42개 변경 파일 전체를 검토한 결과, 변경 범위를 이탈하는 파일은 발견되지 않았다. 핵심 변경(3개 provider renderer 의 `execution.failed` 분류 helper 도입, 공유 `execution-failure-classifier.ts` / `language-hint-defaults.ts` 신설, DTO validator 추가, 6개 doc 파일 신규 섹션, 3개 provider spec `§5.6` 신설, `spec/5-system/15-chat-channel.md` + `3-error-handling.md` + `spec/conventions/chat-channel-adapter.md` 갱신, plan 파일 갱신, consistency review 산출물)은 모두 CCH-ERR-* 요구사항과 `plan/in-progress/chat-channel-error-notify.md` 에 명시된 작업 범위 내에 있다. 기존 테스트 케이스 교체는 breaking change 에 수반되는 필수 갱신이며, review/ 및 plan/ 산출물은 프로젝트 워크플로우 의무 결과물이다. 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 변경은 관찰되지 않았다. diff 생략으로 2개 파일(파일 40, 42)의 직접 검증이 불완전하다는 점을 기록하나, 간접 증거를 고려할 때 전체 위험도는 낮다.

---

## 위험도

NONE
