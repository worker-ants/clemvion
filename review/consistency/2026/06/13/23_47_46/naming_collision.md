# 신규 식별자 충돌 검토 — spec-sync-s-batch-draft

## 발견사항

발견된 CRITICAL/WARNING 등급 충돌 없음.

---

### [INFO] 변경 2의 내부 이슈 라벨 "W2"가 기존 spec 내 "W2 SPEC-DRIFT" 레이블과 표기 중복

- target 신규 식별자: draft 문서 내 `(W2)` — "spec/conventions/interaction-type-registry.md 재개 turn 라우팅 진입점 등재" 검토 항목 번호
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` L1343: `(W2 SPEC-DRIFT)` — `direct-drive vs executeInline 재호출` 설계 결정 라벨
  - `/Volumes/project/private/clemvion/spec/data-flow/13-agent-memory.md` L76: `W2` — 단일 트랜잭션 루프 주석
  - `plan/` 산하 다수 complete 항목에서 `/ai-review` Warning 번호 `W2` 로 혼용
- 상세: draft 의 `(W2)` · `(W10)` · `(I3)` 는 해당 consistency-check 세션의 **내부 임시 이슈 번호**이며 spec 본문에 직접 삽입되는 식별자가 아니다. spec 에 등재될 내용은 section 참조(`§1.2`, `§7.5`, `§Rationale`)와 코드 식별자(`dispatchResumeTurn`, `resumeTurnRegistry`, `resume-turn-dispatch.ts`)이고, 이들은 이미 `spec/5-system/4-execution-engine.md` L925–L926, L1336 에 동일 의미로 등재돼 있다. 혼동 위험은 draft 파일 자체에 한정되고, 최종 spec 편집물에는 이 번호가 포함되지 않는다.
- 제안: 현행 그대로 진행 가능. draft 의 `(W2)`·`(W10)`·`(I3)` 표기는 spec 본문에 반영될 식별자가 아니므로 충돌 없음. spec 편집 시 해당 괄호 표기를 그대로 본문에 남기지 않도록 작성자가 주의.

---

### [INFO] `§1.2` 노트 추가 위치 — 기존 §1.2 매트릭스 구조와의 혼동 가능성

- target 신규 식별자: `spec/conventions/interaction-type-registry.md §1.2` 매트릭스 하단 추가 노트
- 기존 사용처: `/Volumes/project/private/clemvion/spec/conventions/interaction-type-registry.md` L37–L44: §1.2 값→처리분기 매트릭스 (4행, WaitingInteractionType 값 기준)
- 상세: draft 가 추가하려는 노트는 **enum 값 행 추가가 아닌** 재개 진입점 설명 블록이므로 매트릭스 구조와 충돌하지 않는다. `dispatchResumeTurn` / `resumeTurnRegistry` / `resume-turn-dispatch.ts` 라는 코드 식별자는 이미 `spec/5-system/4-execution-engine.md` L925–L926, L1336 에 동일 의미로 등재돼 있어 신규 명명이 아니다.
- 제안: 충돌 없음. 노트가 §1.2 매트릭스의 "Backend emit 위치" 열 설명의 부연이지 enum 값 등록이 아님을 명확히 하면 충분.

---

## 요약

target draft(spec-sync-s-batch-draft)가 도입하는 신규 식별자는 모두 기존 spec 에서 이미 동일 의미로 사용 중인 코드 식별자(`dispatchResumeTurn`, `resumeTurnRegistry`, `resume-turn-dispatch.ts`, `driveResumeAwaited`, `driveResumeFrame`)이거나, spec 본문에 직접 등재되지 않는 내부 이슈 번호(W2, W10, I3)다. 모든 세 변경(llm-usage §1.3 압축, interaction-type-registry §1.2 노트 추가, external-interaction Rationale SSE 블록 신설)이 기존 식별자·엔티티·API endpoint·이벤트·환경변수·파일 경로와 충돌하지 않는다. 신규 정책·데이터 모델·API 추가가 없는 doc-sync 변경이므로 식별자 충돌 위험도는 NONE 이다.

## 위험도

NONE
