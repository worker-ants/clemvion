# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — `resume-turn-dispatch.ts` JSDoc 주석 변경: 부작용 없음
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` line 36 (diff 기준)
- 상세: `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개). (§6.2 는 영속화 정책)` 레이블 교정. JSDoc 주석 텍스트만 변경하며 TypeScript 인터페이스 정의(`ResumeTurnDispatch`, `ResumeTurnSelector`, `ResumeTurnContext`) 시그니처·필드·타입은 전혀 변경되지 않는다. 이 파일은 타입 선언 전용이므로 런타임 동작에 영향이 없다.
- 제안: 없음.

### [INFO] 파일 2~5 — plan 문서 신규 생성 (`plan/complete/`): 파일시스템 부작용 의도된 것
- 위치: `plan/complete/spec-sync-resume-dispatch-registry.md`, `plan/complete/spec-update-doc-style.md`, `plan/complete/spec-update-pr2-embedding.md`, `plan/complete/spec-update-sse-single-instance-rationale.md`
- 상세: 4개 plan 파일을 `plan/complete/` 경로에 신규 생성한다. plan 라이프사이클 규약에 따른 완료 이동이며 의도된 파일 생성이다. plan 파일은 코드 동작과 무관하다.
- 제안: 없음.

### [INFO] 파일 6 — `plan/in-progress/spec-update-gap-callout-plan-links.md` 수정: 안전
- 위치: `plan/in-progress/spec-update-gap-callout-plan-links.md` 하단에 heads-up 블록 추가
- 상세: 기존 plan 파일에 변경 컨텍스트 메모만 추가한다. 이 파일을 직접 파싱하거나 읽는 자동화 로직이 있다면 새 텍스트 블록이 예상 밖의 상태 변경을 일으킬 수 있으나, plan 파일은 순수 마크다운 추적 문서로 자동화 파싱 대상이 아니다. worktree 가 다른 `trigger-schedule-sync-f88604` 에서 동일 파일을 병행 편집 중일 경우 merge conflict 가 발생할 수 있으나, 이는 git 수준 충돌이지 부작용이 아니다.
- 제안: 없음.

### [INFO] 파일 7~14 — `review/consistency/` 산출물 파일 신규 생성: 의도된 것
- 위치: `review/consistency/2026/06/13/23_47_46/` 하위 SUMMARY.md, 각 checker 결과 .md 파일들, meta.json, _retry_state.json
- 상세: 리뷰 파이프라인 오케스트레이터가 생성한 산출물이다. 모두 `review/` 경로 하위 신규 생성이며 규약상 의도된 파일시스템 부작용이다. `_retry_state.json` 의 `agents_pending` 필드가 5개 agent 이름을 갖고 `agents_success` 가 비어 있는 초기 상태로 커밋된 점은 이 파일이 "이미 완료된 세션의 초기 스냅샷" 임을 뜻하며 실제 재시도 루프 동작에 영향을 주지 않는다(세션이 이미 종료된 후 생성된 스냅샷).
- 제안: 없음.

### [INFO] 파일 15 — `spec/conventions/interaction-type-registry.md`: 인터페이스·동작 변경 없음
- 위치: frontmatter `code:` 에 `resume-turn-dispatch.ts` 한 줄 추가 + `§1.2` 매트릭스 하단에 resume turn 라우팅 진입점 설명 블록 추가
- 상세: frontmatter `code:` 변경은 spec 메타데이터(파일 경로 목록)만 갱신한다. 이 필드를 읽는 유일한 자동화는 spec-impl-evidence 커버리지 감사 도구이며, `resume-turn-dispatch.ts` 를 spec 추적 목록에 추가하는 것은 의도된 등재다. `§1.2` 신규 노트 블록은 마크다운 본문 추가이며 어떤 enum 값도 추가하지 않는다. `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 는 변경되지 않으므로 테스트 동작에 영향이 없다.
- 제안: 없음.

### [INFO] 파일 16 — `spec/data-flow/15-external-interaction.md`: 동작 변경 없음
- 위치: Rationale 섹션 하단에 "SSE 버퍼 single-instance 한정 이유와 이관 방향" 블록 신규 추가
- 상세: 순수 Rationale 설명 블록이며 어떤 코드 경로, 설정값, 환경 변수도 변경하지 않는다. `SseAdapter.buffers` 의 동작 자체는 변경하지 않고 근거만 기술한다. "Redis Pub/Sub fan-out 으로 교체한다"는 문구는 미래 이관 방향 기록이며 현재 코드에 아무런 영향이 없다.
- 제안: 없음.

### [INFO] 파일 17 — `spec/data-flow/7-llm-usage.md`: 동작 변경 없음
- 위치: `§1.3` attribution 갭 note 한 줄 교체 (압축)
- 상세: `llm_usage_log` 의 `workflow_id` NULL 사실 기술을 Rationale 참조 형태로 압축한다. 실제 attribution 갭의 결정 상태("결정 대기")는 그대로 보존된다. 이 변경은 spec 문서 텍스트만 변경하며 코드·데이터 모델·API에 영향이 없다. Rationale 섹션에 이미 존재하는 "`llm_usage_log` 의 nullable context 컬럼들" 항의 내용은 변경되지 않으므로 단일 진실 원칙이 준수된다.
- 제안: 없음.

## 요약

이번 변경 세트 전체는 spec 문서 doc-sync, plan 파일 라이프사이클 이동, 리뷰 산출물 생성, 코드 JSDoc 주석 교정으로 구성된다. 코드 로직·함수 시그니처·인터페이스·전역 변수·환경 변수·네트워크 호출·이벤트/콜백·파일시스템(의도된 plan/review 디렉터리 파일 생성 제외) 어느 측면에서도 의도하지 않은 부작용이 발견되지 않았다. `resume-turn-dispatch.ts` 의 변경은 JSDoc 주석만 수정하며 TypeScript 타입 선언을 건드리지 않는다. spec 파일 변경 3건은 모두 Rationale·노트·frontmatter 메타데이터 수준이며 enum 값·API 계약·상태 머신 어느 것도 변경하지 않는다.

## 위험도

NONE
